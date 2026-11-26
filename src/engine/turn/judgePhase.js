// ── WO-13 判官管线（S4 纯搬家：原 runTurn.js 判官段原样移入，零行为变化）──
// runJudgePhase(…)：前哨听意 → 纯函数判官 → 定案单/铁律块/路由回执/交互意向全接线。
// 返回 { judgeVerdict, isGroupTalk, visibleNpcsPre, stale }；deps 按引用原位写入
// （groupTalkRuleBlock/derivedRespondedNpcs/judgePipelineActive/judgeVerdict/causalBudget/
// judgeRuleBlock/routeReceipts/deferredIntents），与搬家前完全同口径。
import { judgeTurn } from "../../domain/rules/judge/judgeTurn.js";
import { buildCausalBudgetInput } from "../../domain/rules/judge/budgetInput.js";
import { getInnerRoom } from "../../domain/rules/map/innerMap.js";
import { resolveContainerContext } from "../../domain/rules/world/containers.js";
import { resolvePrepItemsForJudge, buildPrepMaterialBlock } from "../../domain/rules/prep/prepConsumption.js";
import { buildIntakeUserContent, normalizeIntakeResult, synthesizeTalkIntake, shouldSkipIntakeForTalk, hasHostileHint, applyTalkTargetFallback } from "./intakeTurn.js";
import { buildExtractionCfg } from "../../domain/rules/prompt/structuredCallCfg.js";
import { buildJudgeRuleBlock, buildGroupTalkRuleBlock } from "../../domain/rules/judge/judgeRuleBlock.js";
import { collectDeferredIntents, deferredIntentReceipt, deferredFailureReceipt, DEFERRED_INTENT_KINDS } from "../../domain/rules/judge/deferredIntents.js";
import { inferAppeaseStance } from "../../domain/rules/npc/appeaseStance.js";
import { resolveFloatingItems } from "../../domain/rules/judge/floatingRelics.js";
import { questAdvanceCandidates } from "../../domain/rules/quests/questAdvanceCandidates.js";
import { withAI } from "../ports/withAI.js";
import { random } from "../../utils/rng.js";


// getGameStateTime：原 runTurn.js 模块级 helper 原样移入——runTurn 后段仍用，
// 从此处 re-export 供其 import（避免 engine 内环依赖）。
export function getGameStateTime(ctx, deps) {
  const t = ctx.getGameState?.()?.time ?? deps.time;
  return Number.isFinite(t) ? t : 0;
}

export async function runJudgePhase({ ctx, deps, opts, preparedPrompt, convo, cmd, ai, isTalk, isSettle, trace }) {
  // ── WO-13 判官管线：前哨听意 → 纯函数判官 → 定案单注入主叙事 ──
  // 降级安全：intake 调用失败/不合形制一律空听意单，判官照常签发（多半空事实），
  // 主叙事拿不到锚点任务时退化为普通正文，锚点剥离/尾章校对全是 no-op。
  let judgeVerdict = null;
  // 闸门：① 单调用 JSON 模式的输出契约是纯 JSON，锚点+SEAL 的散文指令会让模型
  // 丢 JSON 骨架，故只在双调用叙事（extractionEnabled）模式激活；
  // ② settle 回合（赠礼/赔罪/求教等）状态在进叙事前已由 feature 层硬结算落账
  // （giftNpc/learnNpcSkill/inviteCompanion 先扣先写），判官再裁会双重结算——
  // settle 回合不激活；待后续工单把前置硬写改成「事实请求先裁后落」才可开放。
  // ③ WO-16A 搭话开闸：纯搭话回合也进判官，但 envelope.talkOnly 让判官只产
  // 小额社交事实（白名单），give/take/inspect 等硬事实在判官内整条拦截——
  // 不会因为纯搭话误搬物品，同时闲聊好感/熟人登记有了替代通道。
  // WO-16H-H1 群聊判定（先于判官闸）：isTalk && !talkTarget && 在场人数>0 的
  // 多人群聊回合不进前哨/判官——尾章指引换群聊回响块，只写对白神态心思、
  // 不改任何游戏状态，SEAL 只有 respondedNpcs 一键（parseGroupTalkSeal 白名单过滤）。
  const visibleNpcsPre = preparedPrompt.visibleNpcsForAI || preparedPrompt.visibleNpcs || deps.room?.npcs || [];
  const talkTargetNow = ctx.talkTarget || deps.talkTarget || ctx.prompt?.talkTarget || "";
  // 门槛 >=2：roadmap 语义是「好几个人同在场」的多人群聊——单人在场未点选仍进
  // 判官 talkOnly（好感/熟人账照常），两名及以上在场才跳过判官走群聊尾章。
  // settle 回合永不算群聊——结算叙事禁带尾章（roadmap「其余结算回合留空」），
  // 否则送礼/赔罪 narration 会被要求写群聊 SEAL 并误切尾章。
  const isGroupTalk = !!isTalk && !isSettle && !talkTargetNow && visibleNpcsPre.length >= 2;
  if (isGroupTalk && deps.apiCfg?.extractionEnabled) {
    const playerName0 = (ctx.getGameState?.()?.char || deps.char)?.name || "主角";
    deps.groupTalkRuleBlock = buildGroupTalkRuleBlock(playerName0);
    trace("群聊尾章", "pass", `多人群聊回合（在场 ${visibleNpcsPre.length} 人）：跳过前哨/判官，尾章只收 respondedNpcs`);
  }
  // WO-16F-F3：赔罪 settle 单独进判官——appease 在 feature 层本无前置硬结算
  // （anger.js 只记尝试不写状态），无双结算风险；送礼/求教/邀同行 settle 仍排除。
  const isAppeaseSettle = !!isSettle && opts.settleKind === "appease" && !!opts.settleNpc;
  // WO-16F-F4a：普通送礼 settle 进判官——giftNpc 判官链下 defer（不前置扣物/写好感）
  // 才带 giftRequest；任务交付/雪豹/草药/信物/生气/送银 settle 不带此键，仍排除在外。
  const isGiftSettle = !!isSettle && opts.settleKind === "gift" && !!opts.settleNpc && !!opts.giftRequest;
  // WO-16F-F4b：按钮求教 settle 进判官——learnNpcSkill 判官链下 defer（不前置扣银/加技能/
  // 写好感）才带 learnRequest；门规不过/束脩不足/legacy/特殊通道 settle 不带此键，仍排除。
  const isLearnSettle = !!isSettle && opts.settleKind === "learn_skill" && !!opts.settleNpc && !!opts.learnRequest;
  if (deps.apiCfg?.judgePipelineEnabled && deps.apiCfg?.extractionEnabled && (!isSettle || isAppeaseSettle || isGiftSettle || isLearnSettle) && !isGroupTalk) {
    try {
      const visibleNpcs = visibleNpcsPre;
      // B1 任务推进候选：只能由系统 helper 现场生成——小模型挑候选、
      // 判官白名单核验，全流程无模型自编 flag 的通道。
      const liveNow = ctx.getGameState?.() || {};
      const questCandidates = questAdvanceCandidates({
        questProgress: liveNow.questProgress || deps.questProgress || {},
        flags: liveNow.flags || deps.flags || [],
        varTree: deps.varTree || ctx.memory?.varTreeLatest || {},
        char: liveNow.char || deps.char || {},
        room: deps.room || {}, inv: liveNow.inv || deps.inv || [],
        innerRoomName: liveNow.innerRoomName ?? deps.innerRoomName ?? null,
        questTriggerMode: deps.apiCfg?.questTriggerMode || "prompt",
      });
      // WO-22A 容器视图：房间内容表声明 ∪ varTree 坍缩状态。
      // room.name 是据点名、innerRoomName 是内层房间（外层据点无容器清单）。
      const vtNow = deps.varTree || ctx.memory?.varTreeLatest || {};
      const innerRoomNow = liveNow.innerRoomName ?? deps.innerRoomName ?? null;
      // WO-22B-P2：timeNow 提前到容器解析前——悬空秘宝过滤与 openContainers 的
      // hasFloating 口径同源（有未定秘宝时已坍缩容器仍列为落点）；影子同口径。
      const timeNow = getGameStateTime(ctx, deps);
      const floatingItems = resolveFloatingItems({
        place: deps.room?.name || "",
        day: Math.floor(timeNow / 24) + 1,
        relicState: vtNow?.世界?.悬空秘宝,
      });
      const { containerPlace, containerView, openContainers } = resolveContainerContext({
        districtName: deps.room?.name, innerRoomName: innerRoomNow, varTree: vtNow, roomDefLookup: getInnerRoom,
        hasFloating: floatingItems.length > 0,
      });
      // WO-24D 备料消费：真实判官与影子同一适配入口（resolvePrepItemsForJudge），
      // prep_item 进 envelope.prepItems 走 judgeTurn 既有第二关（仍在 budget/warrant
      // 管线内）——绝不直接发背包；文本素材只作前哨参考，不是事实。
      const prepStateSlice = { room: deps.room || {}, innerRoomName: innerRoomNow, time: timeNow, varTree: vtNow };
      const prepItemsForJudge = resolvePrepItemsForJudge(prepStateSlice, deps.prepSeeds);
      const prepMaterialBlock = buildPrepMaterialBlock(prepStateSlice, deps.prepSeeds);
      // WO-16G-G2 三级分流：纯搭话跳过前哨——本地合成听意单直接进纯函数判官，
      // 零次 AI 调用（底稿 4.2：面板按钮和简单指令直接进纯函数判官）。talkOnly 白名单
      // 路径（WO-16A）不变；target 沿用现有 talkTarget 上游判定，查不出填「无」。
      // 复合自由行动不是 isTalk，仍走一次 turn.intake。
      // 混合分流（复审裁决）：有任务推进候选的搭话仍调一次 intake——「说动对方」
      // 才能产 quest_advance，这个成本有意保留；闸门 helper 与 shadow 同源。
      let intakeResult;
      if (isAppeaseSettle) {
        // WO-16F-F3：appease settle 本地合成听意单——诚意 inferAppeaseStance 关键词
        // 保守判定，不再额外调 intake AI；玩家原话优先 settleOptions.attempt。
        const appeaseNpcName = typeof opts.settleNpc === "string" ? opts.settleNpc : opts.settleNpc?.name || "";
        // 诚意只评真实玩家原话 opts.attempt——按钮模板 cmd（含「赔罪」字样）进关键词
        // 判定会必中 sincere（模板穿透）；无 attempt 明确回落 casual。text 仍留 cmd 供叙事。
        const attemptText = typeof opts.attempt === "string" && opts.attempt.trim() ? opts.attempt : "";
        intakeResult = {
          read: "", refIds: [],
          actions: [{
            kind: "appease", target: appeaseNpcName, itemId: "", direction: "none",
            stance: inferAppeaseStance(attemptText, opts.giftInfo || null),
            text: cmd,
          }],
          proposals: [],
        };
      } else if (isLearnSettle) {
        // WO-16F-F4b：learn settle 本地合成听意单——learnRequest 载荷随 action 直送
        // judgeTurn「直签转写」路径（门规/束脩 feature 已裁，不二次掷骰），不调 intake AI。
        const learnNpcName = typeof opts.settleNpc === "string" ? opts.settleNpc : opts.settleNpc?.name || "";
        intakeResult = {
          read: "", refIds: [],
          actions: [{
            kind: "learn", target: learnNpcName, itemId: "", direction: "none",
            stance: "casual", text: cmd, learnRequest: opts.learnRequest,
          }],
          proposals: [],
        };
      } else if (isGiftSettle) {
        // WO-16F-F4a：gift settle 本地合成听意单——与自由文本 give 同口径进判官
        // give 分支裁定收/拒，不再额外调 intake AI。itemId 用 giftRequest 确定性
        // 寻址（对象条目=id，字符串条目=名字），不读 cmd 文本猜物。
        const giftNpcName = typeof opts.settleNpc === "string" ? opts.settleNpc : opts.settleNpc?.name || "";
        const req = opts.giftRequest || {};
        intakeResult = {
          read: "", refIds: [],
          actions: [{
            kind: "give", target: giftNpcName, itemId: req.itemId || req.itemName || "",
            direction: "none", stance: "casual", text: cmd,
          }],
          proposals: [],
        };
      } else if (shouldSkipIntakeForTalk(isTalk, questCandidates) && !hasHostileHint(cmd)) {
        const soleTalkTarget = deps.talkTarget || (visibleNpcs.length === 1 ? visibleNpcs[0]?.name || "" : "");
        intakeResult = synthesizeTalkIntake(cmd, deps.talkTarget, soleTalkTarget);
      } else {
        const intakeContent = buildIntakeUserContent({
          playerInput: cmd,
          recentTurns: convo.slice(-4).map((m) => (m.role === "user" ? { user: m.content } : { engine: m.content }))
            .reduce((acc, cur) => { if (cur.user) acc.push({ user: cur.user, engine: "" }); else if (acc.length) acc[acc.length - 1].engine = cur.engine; return acc; }, []),
          npcs: visibleNpcs,
          entries: [],
          questCandidates,
          containers: openContainers,
          // WO-16G PR-G1 喂料同源：房间/内层/任务进度/背包直传，清单口径全在
          // buildIntakeUserContent 内部——shadow 传的是同一组参数名，两处不得各写。
          room: deps.room || {}, innerRoomName: innerRoomNow,
          questProgress: liveNow.questProgress || deps.questProgress || {},
          flags: liveNow.flags || deps.flags || [],
          inv: liveNow.inv || deps.inv || [],
          char: liveNow.char || deps.char || {},
          varTree: vtNow,
          prepBlock: prepMaterialBlock,
        });
        // WO-16G-G2：前哨走提取链模型口径（玩家给双调用/提取链选的 extractionModel 优先），
        // 不再是主模型直传——#451 审查指出的前哨模型口径在此钉住。buildExtractionCfg 自带关思考。
        const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: buildExtractionCfg("INTAKE", deps.apiCfg) }, { ai, apiCfg: deps.apiCfg, throwOnError: false, epoch: String(ctx.proseEpoch ?? "default") });
        if (ctx.isStale?.()) return { stale: true };
        intakeResult = normalizeIntakeResult(intakeRes?.data);
        // S2/S2-review 补洞：模型听意 target 填「无」时与本地合成同一回填口径——
        // 显式点选优先；未点选但单人在场也落到这位唯一在场者，多人仍保持「无」。
        const soleTalkTarget = deps.talkTarget || (visibleNpcs.length === 1 ? visibleNpcs[0]?.name || "" : "");
        applyTalkTargetFallback(intakeResult, deps.talkTarget, soleTalkTarget);
      }
      judgeVerdict = judgeTurn({
        turn: timeNow, day: Math.floor(timeNow / 24) + 1, place: deps.room?.name || "",
        // S7 送银桥：玩家原文是金额唯一可信来源（ground truth）——
        // action.text 是模型复述不可信（Review 实证可编数），判官绝不从模型输出取钱数。
        playerInput: cmd,
        npcs: visibleNpcs, varTree: vtNow,
        inv: deps.inv || [], entries: [],
        // WO-16F-F3：appease settle 听证不算纯搭话——否则 talkOnly 白名单会把
        // appease 动作整条拦掉，判官路空转、旧仲裁又已被跳过（零裁决穿帮）。
        talkOnly: (isAppeaseSettle || isGiftSettle || isLearnSettle) ? false : isTalk,
        // WO-16F-F1：steal/free_act 检定与伤损/破费定量要读玩家属性与气血银两。
        char: liveNow.char || deps.char || {},
        containers: containerView,
        containerPlace,
        questCandidates,
        pickupJudgment: deps.pickupJudgment || null,
        // WO-22B-P2 悬空秘宝注入：与容器解析同一次计算——地域+现世日+唯一锁过滤，
        // 非合规地域/未到 earliestDay/已落定（placed）一律不注入，第三关复用现有掷骰。
        floatingItems,
        prepItems: prepItemsForJudge,
        // WO-16E：授信输入由 buildCausalBudgetInput 装配（runTurn/shadow 同一入口），
        // 不再硬编码 riskLevel:0——tension 读 encounter 势力字段、risk 按动作兜底、
        // 每日搜刮配额读 varTree 账本跨日归零。
        budget: buildCausalBudgetInput({
          varTree: deps.varTree || ctx.memory?.varTreeLatest || {},
          char: deps.char || liveNow.char || {},
          room: deps.room || {}, inv: deps.inv || [],
          turn: timeNow, day: Math.floor(timeNow / 24) + 1,
          encounter: ctx.encounter || deps.encounter || null,
          questCandidates,
        }, intakeResult, { gm: !!ctx.gm }),
      }, intakeResult, { rng: random });
      // WO-16A respondedNpcs 系统推导：intake 听意单里 kind=talk 的 target 即
      // 本轮玩家对话对象——不再依赖叙事模型在 SEAL/JSON 里自证。SEAL 字段仅在
      // 推导为空时兜底（低可信过渡，见 docs），不得用于 pact 自证。
      const derivedTalk = (intakeResult.actions || [])
        // 「无」是 schema 缺省哨兵不是对象名——本地合成/模型都可能在无对象时填它，必须排除
        .filter((a) => a?.kind === "talk" && typeof a.target === "string" && a.target && a.target !== "无")
        .map((a) => a.target);
      deps.derivedRespondedNpcs = [...new Set(derivedTalk)];
      deps.judgePipelineActive = true;
      deps.judgeVerdict = judgeVerdict;
      deps.causalBudget = judgeVerdict.budget;
      // WO-16H-H1：判官铁律块换 roadmap d.judgeRuleBlock 正文——锚点/分寸/条件券/
      // SEAL 五行 JSON 全键契约、天机券词条白名单逐券渲染、不知情者反应导引并块。
      deps.judgeRuleBlock = buildJudgeRuleBlock({
        judgeVerdict,
        playerName: (liveNow.char || deps.char)?.name || "主角",
      });

      // ── WO-16F-F2a 装备/用物/拾取最小确定性路由 ──
      // intake 三类 kind（equip/use_item/take）在叙事生成前由 app 层注入的
      // executeJudgeRoutes 确定性结算（复用 stepEffect/applyResult 同一套账，
      // 引擎只调句柄不反引 features）。回执摘要追加进判官铁律块——主叙事必须
      // 照写系统已发生事实，找不到物件/结算失败的绝不许写成成功。
      // 群聊回合根本不激活判官（上方闸门），settle/GM/单调用不受影响；
      // executor 缺失（测试/直调）时只 trace 不签成功。
      // 路由只执行判官当前允许机械结算的【无前提】动作：
      // ① condition≠「无」的动作一律暂不路由——「要是没人我就捡起钥匙」不能无视前提
      //    立刻捡，前提裁决属 WO-16F 真条件规则，此处 trace/note 留痕不抢跑（G1 interim 口径）；
      // ② isTalk（判官 talkOnly 口径）下三类硬路由一律不执行——纯搭话回合判官白名单
      //    本就禁止硬事实，intake 误产/混产也不能落地。
      const ROUTEABLE = ["equip", "use_item", "take", "invite"];
      const routeCandidates = (intakeResult.actions || []).filter((a) => ROUTEABLE.includes(a?.kind));
      const conditioned = routeCandidates.filter((a) => a?.condition && a.condition !== "无");
      if (conditioned.length) {
        trace("判官管线", "skip", `前提未裁，暂不路由 ${conditioned.length} 条：${conditioned.map((a) => `${a.kind}:${a.item}`).join("、")}（待 WO-16F 真条件裁决）`);
      }
      const judgeRoutes = isTalk ? [] : routeCandidates.filter((a) => !(a?.condition && a.condition !== "无"));
      if (isTalk && routeCandidates.length) {
        trace("判官管线", "skip", `talkOnly 回合禁止硬事实，${routeCandidates.length} 条 equip/use_item/take 不路由`);
      }
      if (judgeRoutes.length) {
        if (typeof ctx.executeJudgeRoutes === "function") {
          try {
            const outcome = ctx.executeJudgeRoutes(judgeRoutes) || null;
            const receipts = (outcome?.receipts || []).filter(Boolean);
            if (receipts.length) {
              deps.routeReceipts = receipts;
              deps.judgeRuleBlock += "\n\n【系统已结算·路由回执】以下事实已由系统确定性结算，正文必须照写，不得编造相反结果：\n"
                + receipts.map((r) => `· ${r.text}`).join("\n");
              trace("判官管线", "pass", `路由结算 ${receipts.filter((r) => r.ok).length}/${receipts.length} 成功：${receipts.map((r) => `${r.kind}${r.ok ? "✓" : "✗"}`).join("、")}`);
            }
          } catch (routeError) {
            trace("判官管线", "fail", `路由结算异常（不阻断回合）：${routeError?.message || routeError}`);
          }
        } else {
          trace("判官管线", "warn", `equip/use_item/take 路由 ${judgeRoutes.length} 条无 executor（直调/测试环境），未结算`);
        }
      }

      // ── WO-16F-F2c duel/trade 交互意向收集（叙事前只收集不执行）──
      // 战斗/商店是交互式子系统，绝不能叙事前开战/开市。收集结果挂 turn 对象
      // deferredIntents，由 useTurn 在 playTurn resolve 且未 stale 后复用
      // intentRouter runDeferred 接原入口。回执措辞必须是意向口径：
      // 邀战/问价，绝不写已开打/已成交。condition/talkOnly 同闸不收集。
      const deferredCandidates = (intakeResult.actions || []).filter((a) => DEFERRED_INTENT_KINDS.has(a?.kind));
      const deferredConditioned = deferredCandidates.filter((a) => a?.condition && a.condition !== "无");
      if (deferredConditioned.length) {
        trace("判官管线", "skip", `前提未裁，暂不收集交互意向 ${deferredConditioned.length} 条：${deferredConditioned.map((a) => `${a.kind}:${a.target}`).join("、")}`);
      }
      if (isTalk && deferredCandidates.length) {
        trace("判官管线", "skip", `talkOnly 回合禁止硬事实，${deferredCandidates.length} 条 duel/trade 意向不收集`);
      }
      const { intents: deferredIntents, failures: deferredFailures } = collectDeferredIntents(
        intakeResult.actions || [], { npcs: visibleNpcs, isTalk },
      );
      if (deferredIntents.length || deferredFailures.length) {
        deps.deferredIntents = deferredIntents;
        deps.judgeRuleBlock += "\n\n【系统已受理·交互意向】以下交互意向系统已受理，正文只写意向本身，不得写成交互结果：\n"
          + deferredIntents.map((it) => `· ${deferredIntentReceipt(it)}`).join("\n")
          + (deferredFailures.length ? `\n${deferredFailures.map((f) => `· ${deferredFailureReceipt(f)}`).join("\n")}` : "");
        trace("判官管线", "pass", `交互意向收集 ${deferredIntents.length} 条（${deferredIntents.map((it) => `${it.kind}→${it.target}`).join("、")}）${deferredFailures.length ? `，失败 ${deferredFailures.length} 条` : ""}`);
      }
      trace("判官管线", "pass", `intake ${intakeResult.actions?.length || 0} 动作/${intakeResult.proposals?.length || 0} 提议 → facts ${judgeVerdict.facts.length} 条/warrants ${judgeVerdict.warrants.length} 张（tier ${judgeVerdict.causalTier}）`, {
        structured: { intake: intakeResult, verdict: judgeVerdict },
      });
    } catch (error) {
      trace("判官管线", "fail", `前哨听意异常降级：${error?.message || error}`);
    }
  }

  return { judgeVerdict, isGroupTalk, visibleNpcsPre, stale: false };
}

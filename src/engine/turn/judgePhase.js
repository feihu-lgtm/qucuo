// ── WO-13 判官管线（S4 纯搬家：原 runTurn.js 判官段原样移入，零行为变化）──
// runJudgePhase(…)：前哨听意 → 纯函数判官 → 定案单/铁律块/路由回执/交互意向全接线。
// 返回 { judgeVerdict, isGroupTalk, visibleNpcsPre, stale }；deps 按引用原位写入
// （groupTalkRuleBlock/derivedRespondedNpcs/judgePipelineActive/judgeVerdict/causalBudget/
// judgeRuleBlock/routeReceipts/deferredIntents），与搬家前完全同口径。
import { judgeTurn } from "../../domain/rules/judge/judgeTurn.js";
import { buildCausalBudgetInput } from "../../domain/rules/judge/budgetInput.js";
import { getInnerRoom, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { evaluateActionCondition, conditionUnmetNote, conditionMetNote } from "../../domain/rules/judge/conditionEval.js";
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
import { intimacyGate, intimacyRefusal, intimacyPromptNote, intimateTicketNote, resolveIntimateTarget } from "../../domain/rules/npc/intimacy.js";
import { isIntimateInput } from "../../domain/rules/prompt/inputIntent.js";
import { INTIMATE_TICKET_NAME } from "../../domain/rules/npc/goldenEgg.js";
import { add, set, applyWrite } from "../../domain/rules/state/applyWrite.js";
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

  const intimacyGateInfoOut = { info: null };
  const runIntimacyGate = (actsOrNull, aiVerdict, roster = null) => {
    // ══ D8 亲密门禁 runner：actsOrNull 为 null 表示 intake 未跑（单调用/管线外）→正则兜底。
      // 拦截逻辑与 V5 前相同只换判意来源——拒：固定性格化拒词+扣好感+中止管线；
      // 过：标已亲密+门槛行注入判官 notes 随定案单进主叙事；凭卡强开落 ticket 待焚。
      {
        const nsfwOnNow = deps.nsfwOn ?? ctx.getGameState?.()?.nsfwOn ?? false;
        const acts = actsOrNull || [];
        const intakeAiVerdict = aiVerdict;
        const intimateHitNow = nsfwOnNow && (intakeAiVerdict
          ? acts.some((a) => a?.intimate === true)
          : isIntimateInput(cmd));
        if (intimateHitNow) {
          const intimateAction = acts.find((a) => a?.intimate === true) || acts[0] || {};
          const rt = resolveIntimateTarget({
            targetName: intimateAction.target && intimateAction.target !== "无" ? intimateAction.target : (ctx.talkTarget || deps.talkTarget || ""),
            cmd, npcs: roster || visibleNpcsPre, convo, allNpcs: deps.room?.npcs || [],
          });
          const npc = (deps.room?.npcs || []).find((n) => n?.name === rt.targetName) || rt.explicitHit;
          if (npc?.name) {
            const vtCur = ctx.getGameState?.()?.varTree || deps.varTree || {};
            const aff = Number(vtCur?.角色?.[npc.name]?.好感度) || 0;
            const gate = intimacyGate(npc, aff);
            const invNow = ctx.getGameState?.()?.inv || deps.inv || [];
            const hasTicket = invNow.some((it) => (typeof it === "object" && it ? it.name : it) === INTIMATE_TICKET_NAME);
            const forceIntimate = !gate.unlocked && hasTicket && !npc.beast;
            if (!gate.unlocked && !forceIntimate) {
              const { line, loss } = intimacyRefusal(npc);
              const logs = [{ t: "cmd", text: `> ${cmd}` }, { t: "desc", text: `  ${line}` }];
              if (loss > 0) {
                const cur = aff;
                const written = applyWrite({ varTree: vtCur, inv: invNow, char: ctx.getGameState?.()?.char || {} }, add(["角色", npc.name, "好感度"], -loss));
                deps.setVarTree?.(written.state.varTree);
                logs.push({ t: "affection", text: `  💗 ${npc.name} 好感度 -${loss}（${cur} → ${cur - loss}）` });
              }
              (deps.addLog || (() => {}))(logs);
              trace("亲密门槛", "fail", `${npc.name} 好感 ${aff}/${gate.threshold}，${gate.forbidden ? "不受人情" : "婉拒"}（intake 判意）`);
              return "refused";
            }
            // 过线/凭卡：标已亲密（凭卡烙印随 commit 焚卡一步落盘——这里只记信息）
            if (!forceIntimate) {
              const stamped = applyWrite({ varTree: vtCur, inv: invNow, char: ctx.getGameState?.()?.char || {} }, set(["角色", npc.name, "已亲密"], true));
              deps.setVarTree?.(stamped.state.varTree);
              deps.setRoom?.((r) => ({ ...r, npcs: (r?.npcs || []).map((n) => (n.name === npc.name ? { ...n, intimate: true } : n)) }));
            }
            intimacyGateInfoOut.info = {
              npc: npc.name,
              note: forceIntimate ? intimateTicketNote(npc) : intimacyPromptNote(npc, aff),
              ticket: forceIntimate ? npc.name : null,
              // V8：判官亲密定档输入——好感余量=aff-threshold 反衬情愿度，凭卡=被迫。
              threshold: gate.threshold,
              affection: aff,
            };
            trace("亲密门槛", "pass", `${npc.name} 好感 ${aff}/${gate.threshold}，${forceIntimate ? "凭卡强开" : "已亲密"}（intake 判意）`);
          }
        }
      }


    return null;
  };

  // D8：单调用/管线外无 intake——正则兜底先跑一道；管线内 AI 判意在 judgeTurn 前再跑。
  if (!(deps.apiCfg?.judgePipelineEnabled && deps.apiCfg?.extractionEnabled && (!isSettle || isAppeaseSettle || isGiftSettle || isLearnSettle) && !isGroupTalk)) {
    if (runIntimacyGate(null, false) === "refused") return { intimacyRefused: true, stale: false };
  }

  if (deps.apiCfg?.judgePipelineEnabled && deps.apiCfg?.extractionEnabled && (!isSettle || isAppeaseSettle || isGiftSettle || isLearnSettle) && !isGroupTalk) {
    try {
      let visibleNpcs = visibleNpcsPre;
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
      let innerRoomNow = liveNow.innerRoomName ?? deps.innerRoomName ?? null;
      // WO-22B-P2：timeNow 提前到容器解析前——悬空秘宝过滤与 openContainers 的
      // hasFloating 口径同源（有未定秘宝时已坍缩容器仍列为落点）；影子同口径。
      const timeNow = getGameStateTime(ctx, deps);
      const floatingItems = resolveFloatingItems({
        place: deps.room?.name || "",
        day: Math.floor(timeNow / 24) + 1,
        relicState: vtNow?.世界?.悬空秘宝,
      });
      let { containerPlace, containerView, openContainers } = resolveContainerContext({
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
          npcs: visibleNpcsPre,
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
          // W-INPUT 指代候选：convo 末条回话角色（appendConvo 落条）喂前哨
          lastResponder: (() => {
            // 只看最近一个 assistant 回合：中间隔了无回话的回合，再老的回话人就不是"上一轮"的了
            const lastAssistant = [...(convo || [])].reverse().find((m) => m?.role === "assistant");
            return Array.isArray(lastAssistant?.respondedNpcs) && lastAssistant.respondedNpcs.length
              ? lastAssistant.respondedNpcs[0] : "";
          })(),
        });
        // WO-16G-G2：前哨走提取链模型口径（玩家给双调用/提取链选的 extractionModel 优先），
        // 不再是主模型直传——#451 审查指出的前哨模型口径在此钉住。buildExtractionCfg 自带关思考。
        const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: buildExtractionCfg("INTAKE", deps.apiCfg) }, { ai, apiCfg: deps.apiCfg, throwOnError: false, epoch: String(ctx.proseEpoch ?? "default") });
        if (ctx.isStale?.()) return { stale: true };
        // D7 Review 修：严格 schema 校验失败（宽容中转缺 useKind 等缺省键）但正文可解析时，
        // 回落 normalize 修复链补默认值——整张听意单不因一个可补缺省键全废。
        let intakeRaw = intakeRes?.data;
        if (!intakeRaw && intakeRes?.text) { try { intakeRaw = JSON.parse(intakeRes.text); } catch { /* 落 degraded */ } }
        intakeResult = normalizeIntakeResult(intakeRaw);
        if (intakeRaw) intakeResult.__aiIntake = true; // D8：真前哨判意标记——intimate 以布尔为准
        // S2/S2-review 补洞：模型听意 target 填「无」时与本地合成同一回填口径——
        // 显式点选优先；未点选但单人在场也落到这位唯一在场者，多人仍保持「无」。
        const soleTalkTarget = deps.talkTarget || (visibleNpcs.length === 1 ? visibleNpcs[0]?.name || "" : "");
        applyTalkTargetFallback(intakeResult, deps.talkTarget, soleTalkTarget);
      }
      // ── D3 前置路由（管线倒挂修）──
      // 无条件的前置动作（move/equip/use_item/take/invite）必须在 judgeTurn 之前
      // 执行——「去后厨，到了就翻灶台」若先跑判官，人还在前堂，既判不了「到达」，
      // 容器表也是前堂的。执行后重取现场刷新 room/innerRoomName/visibleNpcs/
      // containerView，再把刷新后的上下文送入条件裁决与 judgeTurn。
      const ROUTEABLE = ["equip", "use_item", "take", "invite", "move"];
      const routeCandidates = (intakeResult.actions || []).filter((a) => ROUTEABLE.includes(a?.kind));
      const systemMoveTurn = !!(deps.lockedDestName || ctx.lockedDestName || deps.movingDir || ctx.movingDir);
      const preRoutes = isTalk ? [] : routeCandidates.filter((a) => {
        if (a?.condition && a.condition !== "无") return false; // 条件动作 judgeTurn 裁后另处
        if (systemMoveTurn && a?.kind === "move") return false;
        return true;
      });
      const preReceipts = [];
      let preInviteRejected = false;
      let preInviteRejectedTarget = "";
      let preMoved = false;
      if (preRoutes.length && typeof ctx.executeJudgeRoutes === "function") {
        try {
          const outcome = ctx.executeJudgeRoutes(preRoutes) || null;
          for (const r of (outcome?.receipts || []).filter(Boolean)) {
            preReceipts.push(r);
            if (r.kind === "invite" && !r.ok) {
              preInviteRejected = true;
              const inv = preRoutes.find((a) => a.kind === "invite");
              preInviteRejectedTarget = inv?.target && inv.target !== "无" ? inv.target : "";
            }
            if (r.kind === "move" && r.ok) preMoved = true;
          }
        } catch (routeError) {
          trace("判官管线", "fail", `前置路由结算异常（不阻断回合）：${routeError?.message || routeError}`);
        }
      }
      // 刷新现场：前置路由可能已位移/用物——judgeTurn 与条件裁决必须读新现场。
      const liveAfterRoutes = ctx.getGameState?.() || liveNow;
      // Review 修：移动+翻箱复合指令的事件发生在目的地——把路由后房间传给 commitRound，
      // memoryFact 的目击者池与房间作用域按目的地记账，不按出发地。
      deps.postRouteRoom = liveAfterRoutes.room || null;
      deps.postRouteInnerRoom = liveAfterRoutes.innerRoomName ?? null;
      if (preReceipts.some((r) => r.kind === "move")) {
        const newInner = liveAfterRoutes.innerRoomName ?? innerRoomNow;
        const newRoomName = liveAfterRoutes.room?.name || deps.room?.name || "";
        visibleNpcs = (liveAfterRoutes.room?.npcs || visibleNpcs)
          .filter((n) => isNpcVisibleInInnerRoom(newRoomName, newInner, n));
        innerRoomNow = newInner;
        const reCtx = resolveContainerContext({
          districtName: newRoomName, innerRoomName: newInner, varTree: vtNow, roomDefLookup: getInnerRoom,
          hasFloating: floatingItems.length > 0,
        });
        containerPlace = reCtx.containerPlace;
        containerView = reCtx.containerView;
        trace("判官管线", "pass", `前置路由后现场刷新：${newRoomName}/${newInner || "外层"}，在场 ${visibleNpcs.length} 人`);
      }

      // D8：管线内 AI 判意门禁——intake 布尔为准（本地合成/降级时 __aiIntake 无标走正则兜底）。
      {
        const aiV = intakeResult?.__aiIntake === true;
        if (runIntimacyGate(intakeResult?.actions || [], aiV, visibleNpcs) === "refused") return { intimacyRefused: true, stale: false };
      }

      judgeVerdict = judgeTurn({
        turn: timeNow, day: Math.floor(timeNow / 24) + 1, place: deps.room?.name || "",
        // V2 Review修：场所判定用前置路由刷新后的现场——移动回合后破费不在旧房间误判。
        roomName: liveAfterRoutes?.room?.name || deps.room?.name || "",
        innerRoomName: innerRoomNow ?? liveAfterRoutes?.innerRoomName ?? null,
        // S7 送银桥：玩家原文是金额唯一可信来源（ground truth）——
        // action.text 是模型复述不可信（Review 实证可编数），判官绝不从模型输出取钱数。
        playerInput: cmd,
        // Review修：前置路由刷新后的在场名单——复合指令移动后不对已离场者签账。
        npcs: visibleNpcs, varTree: vtNow,
        inv: liveAfterRoutes.inv || deps.inv || [], entries: [],
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
        // D3：条件裁决现场——前置路由后的位置/在场/移动事实 + 敌袭 + invite 拒收信号
        encounter: ctx.encounter || deps.encounter || null,
        // V8：亲密门禁放行信号透传判官——凭卡/门槛/好感定档签发好感事实；
        // 门禁未跑或非亲密回合为 null，判官不补闸。
        intimateCtx: intimacyGateInfoOut.info ? {
          npc: intimacyGateInfoOut.info.npc,
          ticket: !!intimacyGateInfoOut.info.ticket,
          threshold: intimacyGateInfoOut.info.threshold,
          affection: intimacyGateInfoOut.info.affection,
        } : null,
        conditionCtx: {
          encounter: ctx.encounter || deps.encounter || null,
          moved: preMoved || !!systemMoveTurn,
          roomName: liveAfterRoutes.room?.name || deps.room?.name || "",
          innerRoomName: innerRoomNow ?? null,
          visibleNpcs,
          inviteRejected: preInviteRejected,
          inviteRejectedTarget: preInviteRejectedTarget,
        },
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
      // W-ROAM 驻足锁数据源：本轮听意单全部具名对象（不只 talk——送礼/求教/赔罪
      // 都算「找过他」），commitRound 据此刻在场写 驻足锁[name]=time+10。
      deps.intakeRefIds = Array.isArray(intakeResult.refIds) ? intakeResult.refIds : [];
      deps.intakeTargets = [...new Set((intakeResult.actions || [])
        .map((a) => a?.target)
        .filter((t) => typeof t === "string" && t && t !== "无"))];
      deps.judgePipelineActive = true;
      // D8：亲密过线——门槛行注入 notes 随定案单进主叙事；凭卡 ticket 挂 verdict 待 commit 焚。
      // V8 Review 修：门槛行注入与凭卡焚卡都以「门禁对象的亲密动作真执行」为前提——
      // 前提未成/执行旁落时行为未发生，卡不该没、人不该烙、门槛行不该误导叙事。
      if (intimacyGateInfoOut.info && judgeVerdict && judgeVerdict.intimateCtxExecuted !== false) {
        judgeVerdict.notes = [...(judgeVerdict.notes || []), intimacyGateInfoOut.info.note];
        if (intimacyGateInfoOut.info.ticket) judgeVerdict.intimateTicket = intimacyGateInfoOut.info.ticket;
      }
      // D8 Review修：亲密信息双通道——verdict 之外挂 deps 兜底（单调用模式无 verdict）。
      if (intimacyGateInfoOut.info) {
        deps.intimatePromptNote = intimacyGateInfoOut.info.note;
        if (intimacyGateInfoOut.info.ticket) deps.intimateTicket = intimacyGateInfoOut.info.ticket;
      }
      deps.judgeVerdict = judgeVerdict;
      deps.causalBudget = judgeVerdict.budget;
      // ── D3 条件路由裁决：判官跑完后，带前提的路由动作按 verdict.lastActionOutcome
      // 与刷新现场评估——成立执行（复用同一 executor），未成立只留禁写成功批注。──
      const condRoutes = isTalk ? [] : routeCandidates.filter((a) => {
        if (!(a?.condition && a.condition !== "无")) return false;
        if (systemMoveTurn && a?.kind === "move") return false;
        return true;
      });
      const condReceipts = [];
      // Review 修：裁决结果以 judgeTurn 的 conditionResults 为准——它在主循环内按
      // 动作序评估（被拒信号只反映该动作位置之前的拒收），且 notes 已在循环内写过，
      // 此处绝不重估（终态 lastActionOutcome 会被更晚的拒收污染）也不重写批注。
      const condResultOf = (a) => (judgeVerdict?.conditionResults || []).find((r) => r.action === a);
      for (const a of condRoutes) {
        const verdict0 = condResultOf(a) || { met: false, reason: "前提未经判官裁决" };
        if (!verdict0.met) {
          trace("判官管线", "skip", `条件未成立不路由：${a.kind}（${a.condition}，${verdict0.reason}）`);
          continue;
        }
        if (typeof ctx.executeJudgeRoutes === "function") {
          try {
            const outcome = ctx.executeJudgeRoutes([a]) || null;
            condReceipts.push(...(outcome?.receipts || []).filter(Boolean));
          } catch (routeError) {
            trace("判官管线", "fail", `条件路由结算异常（不阻断回合）：${routeError?.message || routeError}`);
          }
        }
      }
      // D3：带前提的 duel/trade 同闸评估——批注必须在铁律块构建前进 notes。
      const deferredCandidatesPre = (intakeResult.actions || []).filter((a) => DEFERRED_INTENT_KINDS.has(a?.kind));
      const deferredConditioned = deferredCandidatesPre.filter((a) => a?.condition && a.condition !== "无");
      const deferredCondPassed = [];
      const condResultOfDef = (a) => (judgeVerdict?.conditionResults || []).find((r) => r.action === a);
      for (const a of deferredConditioned) {
        const verdict0 = condResultOfDef(a) || { met: false, reason: "前提未经判官裁决" };
        if (!verdict0.met) {
          trace("判官管线", "skip", `条件未成立不收集意向：${a.kind}（${a.condition}，${verdict0.reason}）`);
          continue;
        }
        deferredCondPassed.push({ ...a, condition: "无", condition_text: "" });
      }
      // WO-16H-H1：判官铁律块换 roadmap d.judgeRuleBlock 正文——锚点/分寸/条件券/
      // SEAL 五行 JSON 全键契约、天机券词条白名单逐券渲染、不知情者反应导引并块。
      deps.judgeRuleBlock = buildJudgeRuleBlock({
        judgeVerdict,
        playerName: (liveNow.char || deps.char)?.name || "主角",
      });

      // 回执统一进铁律块（前置+条件合并）
      const allReceipts = [...preReceipts, ...condReceipts];
      if (allReceipts.length) {
        deps.routeReceipts = allReceipts;
        deps.judgeRuleBlock += "\n\n【系统已结算·路由回执】以下事实已由系统确定性结算，正文必须照写，不得编造相反结果：\n"
          + allReceipts.map((r) => `· ${r.text}`).join("\n");
        trace("判官管线", "pass", `路由结算 ${allReceipts.filter((r) => r.ok).length}/${allReceipts.length} 成功：${allReceipts.map((r) => `${r.kind}${r.ok ? "✓" : "✗"}`).join("、")}`);
      }
      if (systemMoveTurn && routeCandidates.some((a) => a?.kind === "move")) {
        trace("判官管线", "skip", "系统移动回合，move 不重复路由（位移由移动链结算）");
      }
      if (isTalk && routeCandidates.length) {
        trace("判官管线", "skip", `talkOnly 回合禁止硬事实，${routeCandidates.length} 条 equip/use_item/take 不路由`);
      }

      // ── WO-16F-F2c duel/trade 交互意向收集（叙事前只收集不执行）──
      // 战斗/商店是交互式子系统，绝不能叙事前开战/开市。收集结果挂 turn 对象
      // deferredIntents，由 useTurn 在 playTurn resolve 且未 stale 后复用
      // intentRouter runDeferred 接原入口。回执措辞必须是意向口径：
      // 邀战/问价，绝不写已开打/已成交。condition/talkOnly 同闸不收集。
      const deferredCandidates = (intakeResult.actions || []).filter((a) => DEFERRED_INTENT_KINDS.has(a?.kind));
      if (isTalk && deferredCandidates.length) {
        trace("判官管线", "skip", `talkOnly 回合禁止硬事实，${deferredCandidates.length} 条 duel/trade 意向不收集`);
      }
      const { intents: deferredIntents, failures: deferredFailures } = collectDeferredIntents(
        [...(intakeResult.actions || []), ...deferredCondPassed], { npcs: visibleNpcsPre, isTalk },
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

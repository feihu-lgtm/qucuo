import { callMainOnce } from "./act/actCall.js";
import { parseMainResponse } from "./act/parseResponse.js";
import { step as traceStep } from "../infra/actionTrace.js";
import { PHASE, turnMonitor } from "../infra/turnMonitor.js";
import { runKnowledgeTurn, runRecall } from "./act/memoryLayer.js";
import { formatRecallEntries } from "./ports/recallBlock.js";
import { buildHistBlock, histBlockSavings } from "../domain/rules/memory/histWindow.js";
import { bindTurnAi, createWebAi } from "./ports/ai.js";
import { assemblePrompt } from "./prompt/assemblePrompt.js";
import { getApiModel } from "../content/apiModel.js";
import { filterPlanDelta, filterRejectedEffects } from "../domain/rules/intent/planNotes.js";
import { classifyError } from "../utils/apiErrors.js";
import { withAI } from "./ports/withAI.js";
import { recordSealMetric } from "./ports/releaseMetrics.js";
import { judgeTurn } from "../domain/rules/judge/judgeTurn.js";
import { buildCausalBudgetInput } from "../domain/rules/judge/budgetInput.js";
import { getInnerRoom } from "../domain/rules/map/innerMap.js";
import { resolveContainerContext } from "../domain/rules/world/containers.js";
import { buildIntakeUserContent, normalizeIntakeResult, synthesizeTalkIntake, shouldSkipIntakeForTalk } from "./turn/intakeTurn.js";
import { buildExtractionCfg } from "../domain/rules/prompt/structuredCallCfg.js";
import { verifySealAndMaterialize } from "../domain/rules/effects/sealVerifier.js";
import { buildJudgeRuleBlock, buildGroupTalkRuleBlock, parseGroupTalkSeal } from "../domain/rules/judge/judgeRuleBlock.js";
import { collectDeferredIntents, deferredIntentReceipt, deferredFailureReceipt, DEFERRED_INTENT_KINDS } from "../domain/rules/judge/deferredIntents.js";
import { inferAppeaseStance } from "../domain/rules/npc/appeaseStance.js";
import { resolveFloatingItems } from "../domain/rules/judge/floatingRelics.js";
import { writeTurnProse } from "./act/proseWrite.js";
import { addProseChunks as proseChunkSink } from "./ports/recallBlock.js";
import { random } from "../utils/rng.js";
import { validateEmergenceSeal } from "../domain/rules/npc/npcEmergence.js";
import { questAdvanceCandidates } from "../domain/rules/quests/questAdvanceCandidates.js";
import { getPresentNpcs } from "../domain/rules/prompt/promptRefs.js";

const MAX_AUTO_RETRY = 2;

function assertNonEmpty(rawFull) {
  if (String(rawFull ?? "").trim()) return;
  const err = new Error("接口返回了空内容（模型没有输出任何文字）");
  err.code = "empty";
  throw err;
}

const RATE_LIMIT_BACKOFF_MS = 2000;
const RATE_LIMIT_MAX_WAIT_MS = 30000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryVerdict(error, attempt) {
  if (attempt > MAX_AUTO_RETRY) return { retry: false, why: "重试用尽仍失败" };
  const ec = classifyError(error);
  if (ec.retryable === false) return { retry: false, why: `${ec.title}，重试无用，不自动重试` };
  if (ec.kind !== "rateLimit") return { retry: true, delayMs: 0 };
  const hinted = error?.retryAfterMs == null ? NaN : Number(error.retryAfterMs);
  const delayMs = Number.isFinite(hinted) && hinted >= 0 ? hinted : RATE_LIMIT_BACKOFF_MS * 2 ** (attempt - 1);
  if (delayMs > RATE_LIMIT_MAX_WAIT_MS) return { retry: false, why: `接口要求等 ${Math.ceil(delayMs / 1000)} 秒，超过自动重试上限，不自动重试` };
  return { retry: true, delayMs };
}

function retryNotice(error, verdict, attempt) {
  if (!verdict.delayMs) return `  ⚠ 接口中断（${error.message || error}），正在自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…`;
  return `  ⏳ 接口限流（${error.message || error}），${Math.ceil(verdict.delayMs / 1000)} 秒后自动重试（第 ${attempt}/${MAX_AUTO_RETRY} 次）…`;
}

function withPresenceTrace(ctx) {
  if (!ctx.prompt?.buildPresence) return ctx;
  const buildPresence = (args) => {
    const presence = ctx.prompt.buildPresence(args);
    const { visibleNpcs, visibleNpcsForAI } = presence;
    const { room } = args;
    traceStep(ctx._trace, "在场名单", "info", `喂给AI ${visibleNpcs.length} 人${visibleNpcs.length ? "：" + visibleNpcs.map(n => n.name).join("、") : "（无人）"}${room.npcs.length !== visibleNpcs.length ? `（据点共${room.npcs.length}人，按内层房间过滤掉${room.npcs.length - visibleNpcs.length}人）` : ""}`);
    if (visibleNpcsForAI.length > visibleNpcs.length) {
      traceStep(ctx._trace, "伙伴随行", "info", `${visibleNpcsForAI.at(-1).name}随行在场，已并入喂给AI的在场名单`);
    }
    return presence;
  };
  return { ...ctx, prompt: { ...ctx.prompt, buildPresence } };
}

export function createExtractionState(ctx, deps) {
  const state = ctx.state || {};
  const lockedDestName = state.lockedDestName ?? deps.lockedDestName;
  return {
    room: state.room || deps.room,
    char: state.char || deps.char,
    inv: state.inv || deps.inv || [],
    dao: state.dao || deps.dao,
    varTree: deps.varTree,
    lockedDestName,
    lockedExits: lockedDestName ? ctx.getMapNode?.(lockedDestName)?.exits : null,
    pickupJudgment: deps.pickupJudgment,
    questProgress: state.questProgress || deps.questProgress || ctx.prompt?.questProgress,
    flags: state.flags || deps.flags || ctx.prompt?.flags,
    cmd: deps.cmd,
    innerRoomName: state.innerRoomName ?? deps.innerRoomName ?? ctx.prompt?.innerRoomName,
  };
}

export async function runTurn(ctx, cmd, opts = {}) {
  const trace = ctx._trace || turnMonitor.start(cmd, { source: "engine", commandId: "turnCommit" });
  try {
    const result = await runTurnSteps({ ...ctx, _trace: trace }, cmd, opts);
    if (!ctx._trace) {
      if (result.stale) turnMonitor.transition(trace, PHASE.DISCARDED, "结果已过期");
      else turnMonitor.finish(trace);
    }
    return result;
  } catch (error) {
    if (!ctx._trace) turnMonitor.transition(trace, PHASE.ERROR, String(error));
    throw error;
  }
}


function getGameStateTime(ctx, deps) {
  const t = ctx.getGameState?.()?.time ?? deps.time;
  return Number.isFinite(t) ? t : 0;
}

async function runTurnSteps(ctx, cmd, opts) {
  const ai = bindTurnAi(ctx.ai || createWebAi(), ctx._trace);
  const convo = ctx.convo || [];
  const newConvo = [...convo, { role: "user", content: cmd }];
  const mainConvo = newConvo.filter((message) => !(
    typeof message.content === "string"
    && (message.content.startsWith("（私聊）") || message.content.startsWith("（旁白私聊回应）"))
  ));
  const isTalk = !!ctx.isTalk;
  const isSettle = !!opts.settle || !!ctx.isSettle;
  const contextWindow = ctx.apiCfg?.contextWindow || 16;
  const histWindow = isSettle ? 6 : isTalk ? Math.max(contextWindow, 20) : contextWindow;
  const histSource = mainConvo.length > histWindow ? mainConvo.slice(-histWindow) : mainConvo;
  const hist = buildHistBlock(histSource, { recentPairs: isTalk ? 3 : 2 });
  const historySavings = histBlockSavings(histSource, { recentPairs: isTalk ? 3 : 2 });
  if (historySavings.savedChars > 0) {
    traceStep(ctx._trace, "历史压缩", "info", `${historySavings.legacyChars}→${historySavings.nowChars}字（省 ${historySavings.savedChars}，约 ${Math.round(historySavings.savedChars * 1.6)} tokens）`);
  }
  const onPromptRefMissing = (paths) => traceStep(ctx._trace, "提示词引用缺失", "warn", paths.join("、"));
  const preparedPrompt = assemblePrompt(withPresenceTrace({ ...ctx, onPromptRefMissing }), cmd, opts, convo, mainConvo, hist, newConvo);
  const promptContext = { ...preparedPrompt };
  let knowledgeTurn = null;
  let recall = { recallInfo: null, recallBlock: "" };
  if (ctx.memory) {
    // 知识推演仅更新信息域，不增删 角色 键；与只读向量召回互相独立，可并行执行。
    // 若 playTurn 在软结算阶段已提前发起只读召回，这里直接复用其 Promise。
    const recallPromise = ctx._prefetchedRecall || runRecall({
      ...ctx.memory.recall,
      lastAiText: preparedPrompt.lastAiText || ctx.memory.recall.lastAiText,
      varTreeLatest: ctx.memory.varTreeLatest,
      recentTexts: [hist],
      viewer: ctx.prompt?.char?.name || ctx.char?.name || "主角",
      currentTurn: ctx.getGameState?.()?.time ?? undefined,
      lineage: ctx.getGameState?.()?.proseLineage,
    });
    [knowledgeTurn, recall] = await Promise.all([
      runKnowledgeTurn({
        ...ctx.memory,
        ...(preparedPrompt.visibleNpcsForAI ? { infoDomainNpcNames: preparedPrompt.visibleNpcsForAI.map(n => n.name) } : {}),
        ai,
      }),
      recallPromise,
    ]);
    if (ctx.isStale?.()) return { stale: true };
    if (ctx._prefetchedRecall && recall?.recallInfo) {
      recall = formatRecallEntries(recall.recallInfo, { recentTexts: [hist] });
    }
  }
  const memoryDeps = {
    varTree: knowledgeTurn?.kTree,
    infoDomainBlock: knowledgeTurn?.infoDomainBlock || "",
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
  };
  const baseDeps = {
    ...(typeof ctx.callDeps === "function" ? ctx.callDeps(memoryDeps, promptContext) : (ctx.callDeps || ctx)),
    ...promptContext,
  };
  const deps = {
    ...baseDeps,
    ...Object.fromEntries(Object.entries(memoryDeps).filter(([, value]) => value !== undefined)),
    room: ctx.prompt?.room ?? baseDeps.room,
    activeTarget: ctx.prompt?.activeTarget ?? baseDeps.activeTarget,
    // turnContext 顶层 talkTarget 是 web 链唯一可靠来源——createPromptContext 不带它、
    // callDeps 也不带它（Review 实证：玩家选中 NPC 搭话时 deps.talkTarget 恒 undefined，
    // synthesizeTalkIntake 只能填「无」，搭话事实签不到对象头上）。顶层优先，其余为兜底。
    talkTarget: ctx.talkTarget ?? ctx.prompt?.talkTarget ?? ctx.prompt?.recall?.talkTarget ?? baseDeps.talkTarget,
    cmd,
    ai,
  };
  const addLog = deps.addLog || ctx.addLog || (() => {});
  const trace = (layer, status, detail) => traceStep(deps._trace, layer, status, detail);
  const callDeps = () => ({ ...deps });
  const apiCfg = deps.apiCfg;
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
      const { containerPlace, containerView, openContainers } = resolveContainerContext({
        districtName: deps.room?.name, innerRoomName: innerRoomNow, varTree: vtNow, roomDefLookup: getInnerRoom,
      });
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
      } else if (shouldSkipIntakeForTalk(isTalk, questCandidates)) {
        intakeResult = synthesizeTalkIntake(cmd, deps.talkTarget);
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
        });
        // WO-16G-G2：前哨走提取链模型口径（玩家给双调用/提取链选的 extractionModel 优先），
        // 不再是主模型直传——#451 审查指出的前哨模型口径在此钉住。buildExtractionCfg 自带关思考。
        const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: buildExtractionCfg("INTAKE", deps.apiCfg) }, { ai, apiCfg: deps.apiCfg, throwOnError: false, epoch: String(ctx.proseEpoch ?? "default") });
        if (ctx.isStale?.()) return { stale: true };
        intakeResult = normalizeIntakeResult(intakeRes?.data);
      }
      const timeNow = getGameStateTime(ctx, deps);
      judgeVerdict = judgeTurn({
        turn: timeNow, day: Math.floor(timeNow / 24) + 1, place: deps.room?.name || "",
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
        // WO-22B-P2 悬空秘宝注入：按当前据点地域+现世日+唯一锁过滤——
        // 非合规地域/未到 earliestDay/已落定（placed）一律不注入，第三关复用现有掷骰。
        floatingItems: resolveFloatingItems({
          place: deps.room?.name || "",
          day: Math.floor(timeNow / 24) + 1,
          relicState: vtNow?.世界?.悬空秘宝,
        }),
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
      trace("判官管线", "pass", `intake ${intakeResult.actions?.length || 0} 动作/${intakeResult.proposals?.length || 0} 提议 → facts ${judgeVerdict.facts.length} 条/warrants ${judgeVerdict.warrants.length} 张（tier ${judgeVerdict.causalTier}）`);
    } catch (error) {
      trace("判官管线", "fail", `前哨听意异常降级：${error?.message || error}`);
    }
  }
  // ── WO-15 窄过渡：赔罪（appease）开庭前仲裁 ──
  // 旧 settleTurn 在叙事前跑就是为了把裁定注入叙事——正文必须与系统落账同向，
  // 否则会出现"正文写已消气但系统零写入"的穿帮。裁定结果经 deps.appeaseVerdict
  // 流入 buildSysBase 的 settle 叙事铁律。玩家原话优先取 settleOptions.attempt
  // （按钮/路由生成的 cmd 是模板句，无法判断诚意）。
  let appeaseVerdict = null;
  // WO-16F-F3：判官路已裁 appease 时不再调 turn.appease（双调用）；单调用老路
  // （extractionEnabled=false，判官不激活）仍靠它，行为不变。
  if (apiCfg.extractionEnabled && isSettle && opts.settleKind === "appease" && opts.settleNpc && !deps.judgePipelineActive) {
    const npcName = typeof opts.settleNpc === "string" ? opts.settleNpc : opts.settleNpc?.name || "";
    const npcState = (deps.varTree?.角色 || ctx.memory?.varTreeLatest?.角色 || {})[npcName] || {};
    const anger = npcState.生气状态 || {};
    try {
      const appeaseRes = await withAI(
        "turn.appease",
        {
          cfg: deps.apiCfg,
          npc: npcName,
          reason: anger.reason || "",
          attemptText: opts.attempt || cmd,
          attemptKind: "求和赔罪",
          personality: npcState.性情 || "",
          affection: npcState.好感度,
        },
        { ai, apiCfg: deps.apiCfg, throwOnError: false },
      );
      if (ctx.isStale?.()) return { stale: true };
      const choice = appeaseRes?.data?.choice;
      appeaseVerdict = { choice, npc: npcName };
      if (choice === "奏效") trace("赔罪仲裁", "pass", `${npcName}消了气（系统落账：生气解除+好感+3）`);
      else trace("赔罪仲裁", "skip", `${npcName}未消气（${choice || "判不了"}），本轮零写入`);
    } catch (error) {
      trace("赔罪仲裁", "fail", `裁决异常：${error?.message || error}，本轮零写入`);
      appeaseVerdict = { choice: null, npc: npcName };
    }
    deps.appeaseVerdict = appeaseVerdict;
  }

  let rawFull = "";
  let sealParts = null;
  let p = {};
  let mvuCommands = [];
  let dealResult = null;
  let narrativeText = "";
  let pickupExtractionFailed = false;

  if (apiCfg.extractionEnabled) {
    let mainFinishReason;
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      try {
        const result = await callMainOnce(null, true, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        assertNonEmpty(result.rawFull);
        rawFull = result.rawFull;
        mainFinishReason = result.finishReason;
        sealParts = { sealText: result.sealText, anchors: result.sealAnchors, sealed: result.sealed };
        trace("AI调用", "pass", attempt > 1
          ? `主叙事第${attempt}次尝试成功（双调用·主叙事模型=${getApiModel(apiCfg) || "未设置"}）`
          : `主叙事一次成功（双调用·主叙事模型=${getApiModel(apiCfg) || "未设置"}）`);
        break;
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        const verdict = retryVerdict(error, attempt);
        if (verdict.retry) {
          addLog([{ t: "sys", text: retryNotice(error, verdict, attempt) }]);
          trace("AI调用", "fail", `主叙事第${attempt}次失败：${error.message || error}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `主叙事${verdict.why}：${error.message || error}`);
        throw error;
      }
    }

    const dealMatch = typeof rawFull === "string" && rawFull.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
    if (dealMatch) {
      try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch {}
      rawFull = rawFull.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
    }
    narrativeText = rawFull;
    if (!apiCfg.streamEnabled) {
      const lines = rawFull.split("\n").map((line) => line.trim()).filter(Boolean);
      addLog(lines.map((text) => ({ t: "desc", text: `  ${text}` })));
    }
    if (/length|max[_ ]?tokens|max[_ ]?output/i.test(mainFinishReason || "")) {
      trace("截断检查", "block", `主叙事撞 token 上限（finishReason=${mainFinishReason}）`);
      addLog([{ t: "sys", text: "  ⚠ 本轮叙事被接口中途截断（撞到输出 token 上限），以上是已收到的部分。提取层只能按这段残文结算状态，本轮状态可能不全。" }]);
    }

    // WO-15：独立提取层已整块删除。双调用模式下自由行动状态只来自判官管线的
    // materializeFacts 落账（尾章校对段），不再二次提取；settle 回合靠 feature 前置硬结算。
    p = {};
    mvuCommands = [];

    // WO-15 窄过渡：赔罪裁定在开庭前已完成（见上），这里只按定案落系统 mvu。
    if (appeaseVerdict?.choice === "奏效") {
      mvuCommands = [
        { op: "set", path: `角色.${appeaseVerdict.npc}.生气解除`, value: true },
        { op: "add", path: `角色.${appeaseVerdict.npc}.好感度`, value: 3 },
      ];
    }
  } else {
    for (let attempt = 1; attempt <= MAX_AUTO_RETRY + 1; attempt++) {
      const nudge = attempt > 1
        ? "\n\n（注意：上一次回复未能输出完整闭合的 JSON。请确保本次输出一个语法完整、正常闭合收尾的 JSON，不要中途断开。）"
        : "";
      let finishReason;
      try {
        const result = await callMainOnce(nudge, false, callDeps());
        if (ctx.isStale?.()) return { stale: true };
        assertNonEmpty(result.rawFull);
        rawFull = result.rawFull;
        finishReason = result.finishReason;
        sealParts = { sealText: result.sealText, anchors: result.sealAnchors, sealed: result.sealed };
        trace("AI调用", "pass", attempt > 1
          ? `第${attempt}次重试后成功（单调用·主模型=${getApiModel(apiCfg) || "未设置"}）`
          : `一次成功（单调用·主模型=${getApiModel(apiCfg) || "未设置"}）`);
      } catch (error) {
        if (ctx.isStale?.()) return { stale: true };
        const verdict = retryVerdict(error, attempt);
        if (verdict.retry) {
          addLog([{ t: "sys", text: retryNotice(error, verdict, attempt) }]);
          trace("AI调用", "fail", `第${attempt}次失败：${error.message || error}，重试`);
          if (verdict.delayMs) {
            await (ctx.sleep || sleep)(verdict.delayMs);
            if (ctx.isStale?.()) return { stale: true };
          }
          continue;
        }
        trace("AI调用", "fail", `${verdict.why}：${error.message || error}`);
        throw error;
      }
      ({ p, mvuCommands, dealResult } = parseMainResponse(rawFull));
      normalizeDuelRequest(p, createExtractionState(ctx, deps));
      mvuCommands = filterRejectedEffects(mvuCommands, deps.intentPlan); p = filterPlanDelta(p, deps.intentPlan);
      narrativeText = (p.output || []).join("");
      const truncated = p._truncated || /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (truncated && attempt <= MAX_AUTO_RETRY) {
        addLog([{ t: "sys", text: `  ⚠ 上一轮被接口截断，正在自动重说一遍（第 ${attempt}/${MAX_AUTO_RETRY} 次，这次会更简短）…` }]);
        continue;
      }
      if (p.output?.[0]?.startsWith("（引擎回应格式异常，原始内容）")) {
        throw new Error("AI reply format is invalid");
      }
      if (!truncated) break;
    }
  }

  // ── WO-13 尾章校对与落账编译：漏写锚点系统补句、穿帮告警、
  // fills 编译进 materializeFacts，产物随 turn 带给 finalizeTurn 经 commitRound 落盘。
  let judgeEffects = null;
  if (judgeVerdict && deps.judgePipelineActive) {
    // 状态袋一律以 getGameState 实录为准（deps 里的 inv/char 在部分链路是空壳，
    // 空背包进 materializeFacts 会让 changes.inv 只含新货、把真背包整包抹掉）。
    const live = ctx.getGameState?.() || {};
    const stateForFacts = {
      time: getGameStateTime(ctx, deps),
      inv: live.inv || deps.inv || [], room: live.room || deps.room, char: live.char || deps.char,
      skills: live.skills || deps.skills || [],
      exp: live.exp ?? 0, pot: live.pot ?? 0,
      flags: live.flags || deps.flags || [],
      varTree: live.varTree, companionState: live.companionState,
      claimedMilestones: live.claimedMilestones,
      effectiveSpecialNow: deps.effectiveSpecialNow,
    };
    // 涌现校验必须以模型原始正文为准——系统补锚短句（patchedScreen）不能替模型
    // 完成「正文真实出现」的登场证据，所以在补写发生前先存一份原文。
    const rawNarrative = narrativeText || rawFull;
    const verified = verifySealAndMaterialize({
      sealText: sealParts?.sealText || "",
      screenText: rawNarrative,
      verdict: judgeVerdict,
      anchorIds: (sealParts?.anchors || []).map((a) => a.id),
      state: stateForFacts,
      luck: deps.char?.special?.气运 ?? 0,
      turn: stateForFacts.time,
    });
    if (verified.missingAnchors.length) {
      const before = narrativeText || "";
      const patched = verified.screenText.startsWith(before) ? verified.screenText.slice(before.length) : "";
      narrativeText = verified.screenText;
      // 正文已上屏（流式/非流式皆然）——系统补写的事实短句以旁白行追补落地，不篡改原文
      if (patched.trim()) addLog([{ t: "desc", text: "  " + patched.trim() }]);
    }
    for (const warning of verified.warnings) {
      trace("尾章校对", "warn", warning);
      addLog([{ t: "sys", text: `  ⚠ ${warning}` }]);
    }
    // SEAL respondedNpcs 兜底接线：系统推导（intake talk target）优先——推导非空时
    // SEAL 不覆盖；推导为空（intake 失败/未列 actions）时模型自证作为低可信兜底进 p，
    // 在场过滤仍由 talkKnow 统一执行，不得用于 pact 自证（见 docs）。
    if (!(deps.derivedRespondedNpcs || []).length && Array.isArray(verified.sealData?.respondedNpcs) && verified.sealData.respondedNpcs.length) {
      p = { ...p, respondedNpcs: verified.sealData.respondedNpcs };
    }
    // 涌现过渡复接：SEAL 申报的传闻/登场经五路校验后接回 p——recordRumors、
    // materializeEmergence、fixateNpcs、writeRoom 原管线接管；数值仍由系统侧定量。
    const emergenceCheck = validateEmergenceSeal(verified.sealData, {
      screenText: rawNarrative,
      varTree: live.varTree || deps.varTree || {},
      roomNpcs: (live.room || deps.room)?.npcs || [],
      playerName: (live.char || deps.char)?.name || "",
    });
    for (const note of emergenceCheck.notes) trace("涌现校验", "info", note);
    for (const warning of emergenceCheck.warnings) {
      trace("涌现校验", "warn", warning);
      addLog([{ t: "sys", text: `  ⚠ ${warning}` }]);
    }
    if (emergenceCheck.mentionedNewNpcs.length) {
      p = { ...p, mentionedNewNpcs: emergenceCheck.mentionedNewNpcs };
    }
    if (emergenceCheck.emergedNpc) {
      // materializeNpc 只替换不新增——先把最小形状并入 room.npcs 让原管线替换固化；
      // 不编造数值/随身物/id，战斗数据由 fixateNpcs/materializeEmergence 定量。
      const roomNpcs = [...(p.room?.npcs || [])];
      if (!roomNpcs.some((n) => n?.name === emergenceCheck.emergedNpc.name)) {
        roomNpcs.push({ name: emergenceCheck.emergedNpc.name, brief: emergenceCheck.emergedNpc.description.slice(0, 15) });
      }
      p = {
        ...p,
        emergedNpcName: emergenceCheck.emergedNpc.name,
        emergedNpcDescription: emergenceCheck.emergedNpc.description,
        room: { ...(p.room || {}), npcs: roomNpcs },
      };
    }
    // 放行指标在涌现校验之后统一记录——锚到了但尾章没填空（unfilledWarrants）、
    // 声明新 NPC 被 emergence 拒绝（rejections）都必须计入 failed，早记会漏。
    recordSealMetric({
      epoch: String(ctx.proseEpoch ?? "default"),
      cfg: deps.apiCfg,
      sealText: sealParts?.sealText || "",
      sealData: verified.sealData,
      warnings: verified.warnings,
      missingAnchors: verified.missingAnchors,
      rejectedAffixes: verified.rejectedAffixes,
      unfilledWarrants: verified.unfilledWarrants,
      emergenceRejections: emergenceCheck.rejections,
    });
    judgeEffects = { verdict: judgeVerdict, sealReport: verified, materialized: verified.materialized };
    trace("尾章校对", "pass", `锚点齐 ${judgeVerdict.facts.length - verified.missingAnchors.length}/${judgeVerdict.facts.length}，编译券 ${Object.keys(verified.materialized?.receipts || {}).length}，facts 落盘 ${verified.facts.length} 条`);
  }

  // settle 回合提取被跳过（或没吐出 memory）时，把结算文本登记为本轮事实：
  // 事实账本/小纸条/日总结都走 p.memory 这一个入口，不能因为是结算轮就漏记。
  // 只取首句：settle 文本尾部常带叙事指令（"请让…说道""只描写…"），不是事实不能入账。
  if (isSettle && !(p && p.memory)) {
    const memoryText = cmd.split(/[。！？]/).filter(Boolean)[0] || cmd;
    p = { ...p, memory: memoryText };
  }

  // WO-16A memory 过渡（无 AI 摘要）：双调用判官回合 p.memory 恒空——
  // 改用系统模板串入账，保证删旧提取后事实账本/日总结不断档。
  // ① 判官 facts 非空：取首条事实的模板串（op+npc/itemName+reason 拼句）；
  // ② 纯搭话无 facts：「玩家对X说：原文≤30字截断」；其余自由行动不留账
  // （无事实本就不该入账）。原文段落记忆库归 WO-17，这里只是过渡。
  if (!isSettle && !(p && p.memory) && judgeVerdict && deps.judgePipelineActive) {
    const first = (judgeVerdict.facts || [])[0];
    let memoryText = "";
    if (first) {
      const parts = [first.op, first.npc || first.itemName || "", first.reason || first.detail || ""].filter(Boolean);
      memoryText = parts.join("·").slice(0, 50);
    } else if ((judgeEffects?.materialized?.receipts || []).some((r) => r?.kind === "grant_item")) {
      // WO-16C：条件拾取券在判官 verdict 里刻意无 facts（双证据齐备才合成），
      // memory 模板读 verdict 会漏记路遇拾取——改用落盘回执作事实源，
      // 回执存在即真实入包（拒捡/撞名丢弃均无回执）。
      const grant = judgeEffects.materialized.receipts.find((r) => r?.kind === "grant_item");
      memoryText = `拾得${grant.item?.name || "路遇之物"}`.slice(0, 50);
    } else if (isTalk) {
      const target = (deps.derivedRespondedNpcs || [])[0] || ctx.talkTarget || "";
      memoryText = `${target ? `玩家对${target}说` : "玩家说"}：${String(cmd).slice(0, 30)}`.slice(0, 50);
    }
    if (memoryText) p = { ...p, memory: memoryText };
  }

  // WO-16H-H1 群聊尾章校对：parseGroupTalkSeal 按在场白名单过滤——越界名字
  // 安静丢弃并记 trace，绝不进状态（群聊不改任何游戏状态，只此一键）。
  if (isGroupTalk && deps.groupTalkRuleBlock && sealParts?.sealText) {
    const presentNames = visibleNpcsPre.map((n) => n?.name).filter(Boolean);
    const parsed = parseGroupTalkSeal(sealParts.sealText, presentNames);
    for (const dropped of parsed.dropped) {
      trace("群聊尾章", "warn", `respondedNpcs 越界名字「${dropped}」不在场，已丢弃`);
    }
    if (parsed.respondedNpcs.length) {
      p = { ...p, respondedNpcs: parsed.respondedNpcs };
    }
  }

  // WO-18 原文段落写挂 payload：不在这里触发——commitRound 可能抛错回滚，
  // 被回滚的叙事不能进段落库。payload 随结果带给 finalizeTurn，在事务成功
  // 且未 stale 后统一派发（见 finalizeTurn）。
  const prosePayload = (() => {
    const liveNow = ctx.getGameState?.() || {};
    const roomNow = liveNow.room || deps.room || {};
    return {
      narrativeText,
      turn: getGameStateTime(ctx, deps),
      location: roomNow.name || "",
      playerName: (liveNow.char || deps.char)?.name || deps.charName || "主角",
      roomNpcNames: (roomNow.npcs || []).map((n) => n?.name).filter(Boolean),
      isTalk: !!isTalk,
      talkTarget: ctx.talkTarget || "",
      anchoredFacts: [
        ...(judgeVerdict?.facts || []).map((f) => f?.id).filter(Boolean),
        ...(sealParts?.anchors || []).map((a) => a?.id).filter(Boolean),
      ],
    };
  })();

  return {
    prosePayload,
    p,
    mvuCommands,
    dealResult,
    rawFull,
    narrativeText,
    pickupExtractionFailed,
    knowledgeTree: knowledgeTurn?.kTree,
    knowledgeTreeBase: knowledgeTurn ? ctx.memory.varTreeLatest : undefined,
    recallInfo: recall.recallInfo,
    recallBlock: recall.recallBlock,
    newConvo,
    judgeEffects,
    derivedRespondedNpcs: deps.derivedRespondedNpcs || null,
    judgePipelineActive: !!deps.judgePipelineActive,
    groupTalk: !!deps.groupTalkRuleBlock,
    // WO-16F-F2c：交互意向随 turn 对象带出——finalizeTurn 无需特别处理，
    // useTurn 在 result.ok && !stale 后复用 intentRouter runDeferred 消费。
    deferredIntents: deps.deferredIntents || null,
  };
}

// WO-15：normalizeDuelRequest 自 extractionEngine 内联——单调用 JSON 模式的
// duelRequest 名字解析回在场 NPC 对象（双调用判官管线不经此路）。
function normalizeDuelRequest(parsed, state = {}) {
  if (!parsed || typeof parsed !== "object" || parsed.duelRequest == null) return parsed;
  const raw = parsed.duelRequest;
  let name = "";
  if (typeof raw === "string") name = raw.trim();
  else if (typeof raw?.name === "string") name = raw.name.trim();
  const npc = getPresentNpcs(state).find((candidate) => candidate.name === name);
  if (npc) parsed.duelRequest = npc; else delete parsed.duelRequest;
  return parsed;
}

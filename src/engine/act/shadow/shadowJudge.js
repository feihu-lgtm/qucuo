// WO-16D 影子判官执行器（PR-D1）
// 单调用模式下回合落账后 fire-and-forget 异步补跑 intake+judgeTurn，
// 吃回合前快照、与 commit 后 diff 对比，结果只进 trace + 内存聚合。
// 硬约束：不写 gameStore/convo/log/prompt/IndexedDB/localStorage；
// stale/epoch 丢弃；异常静默；不阻塞回合；route 与 intake 同价不声称省钱。
import { withAI } from "../../ports/withAI.js";
import { buildIntakeUserContent, normalizeIntakeResult } from "../../turn/intakeTurn.js";
import { judgeTurn } from "../../../domain/rules/judge/judgeTurn.js";
import { questAdvanceCandidates } from "../../../domain/rules/quests/questAdvanceCandidates.js";
import { createRng } from "../../../utils/rng.js";
import { diffSnapshots } from "./shadowDiff.js";
import { projectFacts } from "./shadowTaxonomy.js";
import { compareCategories } from "./shadowCompare.js";

// 开关生效值：显式存储值（apiCfg.shadowJudgeEnabled 为布尔）优先；
// 未显式设置时 dev（import.meta.env.DEV）默认 true、production/player 默认 false。
// 不进普通设置 UI——dev 工具，玩家零感知。
export function resolveShadowJudgeEnabled(apiCfg) {
  if (typeof apiCfg?.shadowJudgeEnabled === "boolean") return apiCfg.shadowJudgeEnabled;
  try {
    // vitest/CI 下 MODE=test——测试环境必须确定性默认关，否则影子多发 AI 调用污染 fixture；
    // web dev server MODE=development 才默认开（规格：dev 默认开/player 默认关）。
    return !!import.meta.env?.DEV && import.meta.env?.MODE !== "test";
  } catch {
    return false;
  }
}

// 局级内存聚合：keyed by save epoch，读档/换档自然隔离；不写任何持久层。
const aggregates = new Map(); // epoch -> { turns, match, singleOnly, judgeOnly, bothDiff, byCategory }
export function shadowAggregates(epoch = "default") {
  if (!aggregates.has(epoch)) {
    aggregates.set(epoch, { turns: 0, match: 0, gaps: 0, judgeExtra: 0, byCategory: {} });
  }
  return aggregates.get(epoch);
}
export function _resetShadowAggregates() {
  aggregates.clear();
}

function recordAggregate(epoch, result) {
  const agg = shadowAggregates(epoch);
  agg.turns += 1;
  if (!result.hasGap && !result.judgeExtra) agg.match += 1;
  if (result.hasGap) agg.gaps += 1;
  if (result.judgeExtra) agg.judgeExtra += 1;
  agg.excluded = agg.excluded || {};
  for (const [cat, v] of Object.entries(result.verdicts)) {
    if (v.verdict === "excluded") {
      agg.excluded[cat] = (agg.excluded[cat] || 0) + 1; // 盲区显式计数，不计入覆盖率
      continue;
    }
    if (v.verdict === "match") continue;
    agg.byCategory[cat] = agg.byCategory[cat] || { single_only: 0, judge_only: 0, both_diff: 0 };
    agg.byCategory[cat][v.verdict] = (agg.byCategory[cat][v.verdict] || 0) + 1;
  }
}

// preState/postState：{ inv, flags, varTree, room } 切片（回合前快照/落账后现状）。
// 返回 Promise<结果|null>——调用方 fire-and-forget；stale/epoch/异常一律 null。
export async function runShadowJudge({
  cmd, preState, postState, deps, ai, apiCfg, epoch = "default",
  isStale, epochGuard, trace, convo = [], isTalk = false, moved = false,
  visibleNpcs = null,
}) {
  try {
    if (!resolveShadowJudgeEnabled(apiCfg)) return null;
    if (apiCfg?.extractionEnabled) return null; // 只在单调用模式跑影子
    // 同源喂料：在场名单必须由调用方按 preparedPrompt 同口径（buildPresence：
    // 内层过滤+同伴出战位并入）算好传入——直接用 room.npcs 会让影子与真实判官
    // 输入不同，覆盖率数据失真。
    const npcs = visibleNpcs || preState?.room?.npcs || [];
    const questCandidates = questAdvanceCandidates({
      questProgress: preState?.questProgress || {},
      flags: preState?.flags || [],
      varTree: preState?.varTree || {},
      char: preState?.char || {},
      room: preState?.room || {}, inv: preState?.inv || [],
      innerRoomName: preState?.innerRoomName ?? null,
      questTriggerMode: apiCfg?.questTriggerMode || "prompt",
    });
    // recentTurns 与 runTurn 同口径：convo 尾四条 user/engine 配对折叠。
    const recentTurns = convo.slice(-4).map((m) => (m.role === "user" ? { user: m.content } : { engine: m.content }))
      .reduce((acc, cur) => { if (cur.user) acc.push({ user: cur.user, engine: "" }); else if (acc.length) acc[acc.length - 1].engine = cur.engine; return acc; }, []);
    const intakeContent = buildIntakeUserContent({
      playerInput: cmd,
      recentTurns,
      npcs,
      entries: [],
      questCandidates,
    });
    const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: apiCfg }, { ai, apiCfg, throwOnError: false });
    if (isStale?.() || epochGuard?.()) return null;
    const intakeResult = normalizeIntakeResult(intakeRes?.data);
    const verdict = judgeTurn({
      turn: postState?.turn || 1, day: Math.floor((postState?.turn || 1) / 24) + 1,
      place: preState?.room?.name || "",
      npcs, varTree: preState?.varTree || {},
      inv: preState?.inv || [], entries: [], talkOnly: isTalk,
      questCandidates,
      pickupJudgment: null,
      budget: { riskLevel: 0, luck: preState?.char?.special?.气运 ?? 0 },
    // 影子用隔离 rng 实例——绝不能用全局 random，否则影子抽数会推进游戏共享
    // 随机流，污染后续掷骰/赌博等玩法结果（影子必须零行为变化）。
    }, intakeResult, { rng: createRng((((postState?.turn || 1) * 2654435761) >>> 0) || 1).random });
    if (isStale?.() || epochGuard?.()) return null;

    const diffOut = diffSnapshots(preState, postState, { moved });
    const proj = projectFacts(verdict?.facts || []);
    const result = compareCategories(diffOut, proj);
    if (isStale?.() || epochGuard?.()) return null;
    recordAggregate(epoch, result);
    // 结构化 trace：verdicts 原样进 fields，TraceViewer 按类目渲染含 excluded 盲区；
    // detail 单行摘要供复制文本用。
    trace?.("shadow", "影子对账", {
      kind: "shadow",
      status: result.hasGap ? "block" : "pass",
      detail: Object.entries(result.verdicts)
        .filter(([, v]) => v.verdict !== "match")
        .map(([cat, v]) => `${cat}:${v.verdict}`).join("；") || "各类目一致",
      verdicts: result.verdicts,
    });
    return result;
  } catch (_) {
    return null; // 静默——影子绝不能影响主链
  }
}

// WO-16D 影子判官执行器（PR-D1）
// 单调用模式下回合落账后 fire-and-forget 异步补跑 intake+judgeTurn，
// 吃回合前快照、与 commit 后 diff 对比，结果只进 trace + 内存聚合。
// 硬约束：不写 gameStore/convo/log/prompt/IndexedDB/localStorage；
// stale/epoch 丢弃；异常静默；不阻塞回合；route 与 intake 同价不声称省钱。
import { withAI } from "../../ports/withAI.js";
import { buildIntakeUserContent, normalizeIntakeResult, synthesizeTalkIntake, shouldSkipIntakeForTalk, hasHostileHint, applyTalkTargetFallback } from "../../turn/intakeTurn.js";
import { buildExtractionCfg } from "../../../domain/rules/prompt/structuredCallCfg.js";
import { judgeTurn } from "../../../domain/rules/judge/judgeTurn.js";
import { buildCausalBudgetInput } from "../../../domain/rules/judge/budgetInput.js";
import { getInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { resolveContainerContext } from "../../../domain/rules/world/containers.js";
import { resolveFloatingItems } from "../../../domain/rules/judge/floatingRelics.js";
import { questAdvanceCandidates } from "../../../domain/rules/quests/questAdvanceCandidates.js";
import { createRng } from "../../../utils/rng.js";
import { diffSnapshots } from "./shadowDiff.js";
import { projectFacts, featureRoutedCats, SHADOW_CATEGORIES } from "./shadowTaxonomy.js";
import { compareCategories } from "./shadowCompare.js";
import { resolvePrepItemsForJudge, buildPrepMaterialBlock } from "../../../domain/rules/prep/prepConsumption.js";

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
    aggregates.set(epoch, { turns: 0, match: 0, gaps: 0, judgeExtra: 0, byCategory: {}, samples: [] });
  }
  return aggregates.get(epoch);
}
export function _resetShadowAggregates() {
  aggregates.clear();
}

// WO-16D-M1 single_only 原话采样：每 epoch 最多 20 句，只记 cmd+类目——
// 绝不记叙事正文/API key。这份清单是 WO-16F 判官规则补全的需求来源（roadmap 二.3）。
const SAMPLE_CAP = 20;
// 导出供 M2 聚合口径测试直探（生产路径仍只在 runShadowJudge 内部调用）。
const VERDICT_LOG_CAP = 200;

// 类目 verdict → 紧凑证据（值只留键/数值，长度截断，绝不记叙事正文）
function compactEvidence(v) {
  if (!v || typeof v !== "object") return null;
  const slim = (x) => {
    if (x == null) return x;
    if (Array.isArray(x)) return x.slice(0, 6).map((e) => String(e).slice(0, 24));
    if (typeof x === "object") {
      const out = {};
      for (const [k, val] of Object.entries(x)) {
        if (Array.isArray(val)) out[k] = slim(val);
        else if (typeof val === "number") out[k] = val;
        else if (val && typeof val === "object" && val.verdict) out[k] = val.verdict; // vitals/cultivation sub
      }
      return out;
    }
    return x;
  };
  return { single: slim(v.single), judge: slim(v.judge), ...(v.sub ? { sub: slim(v.sub) } : {}) };
}

export function recordAggregate(epoch, result, cmd = "") {
  const agg = shadowAggregates(epoch);
  agg.turns += 1;
  // Review 修（S5）：计量类目快照戳——旧导出（pre-S5 无 world 类目）/未来类目
  // 增删时，覆盖率摘要只按「当时真测了哪些类目」计 comparable，
  // 未测类目不得按全 match 伪造 100% 覆盖率。
  agg.measuredCats = [...SHADOW_CATEGORIES];
  // WO-16D-3 per-turn verdict 证据：评审可据此判断 single_only/judge_only 是
  // harness 噪声还是真 gap；cap 200 防爆内存，只进内存聚合不进持久层。
  agg.log = agg.log || [];
  if (agg.log.length < VERDICT_LOG_CAP) {
    const cats = {};
    for (const [cat, v] of Object.entries(result.verdicts || {})) {
      if (v.verdict === "match") continue;
      cats[cat] = { verdict: v.verdict, ...compactEvidence(v) };
    }
    agg.log.push({ n: agg.turns, cmd: String(cmd || "").slice(0, 60), cats });
  }
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
    // WO-16D-M2 采样去重：同一 epoch 同一句 cmd 只占一个名额——一句触发多类目
    // 时合并进 cats 数组，不再重复占位挤掉别的样本（上限 20 句仍指去重后的句数）。
    if (v.verdict === "single_only" && cmd) {
      // 去重键用完整 cmd 原文——若按展示截断 60 字当键，两句同前缀不同尾的真不同指令
      // 会被错并成一条（复审 finding）；存储/展示仍只留 60 字截断。
      const full = String(cmd);
      const existing = agg.samples.find((s) => s.key === full);
      if (existing) {
        if (!existing.cats.includes(cat)) existing.cats.push(cat);
      } else if (agg.samples.length < SAMPLE_CAP) {
        agg.samples.push({ cat, cats: [cat], key: full, cmd: full.slice(0, 60) });
      }
    }
  }
}

// preState/postState：{ inv, flags, varTree, room } 切片（回合前快照/落账后现状）。
// 返回 Promise<结果|null>——调用方 fire-and-forget；stale/epoch/异常一律 null。
export async function runShadowJudge({
  cmd, preState, postState, deps, ai, apiCfg, epoch = "default",
  isStale, epochGuard, trace, convo = [], isTalk = false, moved = false,
  visibleNpcs = null, gm = false, talkTarget = null,
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
    // WO-22A 同源：容器视图/坍缩键与 runTurn 完全同口径——影子若按
    // "无容器"判，容器行动覆盖率会假报缺口。
    const vtPre = preState?.varTree || {};
    const innerNow = preState?.innerRoomName ?? null;
    const shadowTurn = preState?.turn ?? postState?.turn ?? 1;
    const floatingItems = resolveFloatingItems({
      place: preState?.room?.name || "",
      day: Math.floor(shadowTurn / 24) + 1,
      relicState: vtPre?.世界?.悬空秘宝,
    });
    const { containerPlace, containerView, openContainers } = resolveContainerContext({
      districtName: preState?.room?.name, innerRoomName: innerNow, varTree: vtPre, roomDefLookup: getInnerRoom,
      hasFloating: floatingItems.length > 0,
    });
    // WO-24D 同源备料：与 runTurn 同一适配入口同一 state 切片形状——
    // 影子若吃不同口径，prepItems 覆盖对账失真。
    const shadowPrepSlice = { room: preState?.room || {}, innerRoomName: innerNow, time: shadowTurn, varTree: vtPre };
    const prepItemsForJudge = resolvePrepItemsForJudge(shadowPrepSlice, preState?.prepSeeds);
    const prepMaterialBlock = buildPrepMaterialBlock(shadowPrepSlice, preState?.prepSeeds);
    // WO-16G-G2 混合分流同源：与 runTurn 共用 shouldSkipIntakeForTalk 闸门——
    // 纯搭话无任务候选时影子也本地合成（不调 withAI），有候选才调 intake；
    // 否则影子与真实判官输入不同源，搭话回合覆盖率数据失真。
    let intakeResult;
    if (shouldSkipIntakeForTalk(isTalk, questCandidates) && !hasHostileHint(cmd)) {
      const soleTalkTarget = talkTarget || (npcs.length === 1 ? npcs[0]?.name || "" : "");
      intakeResult = synthesizeTalkIntake(cmd, talkTarget, soleTalkTarget);
    } else {
      const intakeContent = buildIntakeUserContent({
        playerInput: cmd,
        recentTurns,
        npcs,
        entries: [],
        questCandidates,
        containers: openContainers,
        // WO-16G PR-G1：与 runTurn 同源喂料——同一组参数名，口径只在
        // buildIntakeUserContent 内部一份，影子吃的是回合前快照切片。
        room: preState?.room || {}, innerRoomName: innerNow,
        questProgress: preState?.questProgress || {},
        flags: preState?.flags || [],
        inv: preState?.inv || [],
        char: preState?.char || {},
        varTree: vtPre,
        prepBlock: prepMaterialBlock,
      });
      // 网关 guard 与 epoch 必须传入：stale/换档的影子样本不进网络也不计入
      // intake 指标桶（withAI 在 stale 时提前返回、不 recordIntakeMetric），
      // epoch 缺失会把所有影子样本混进 default 桶污染按档隔离的报表。
      const shadowStale = () => Boolean(isStale?.() || epochGuard?.());
      // WO-16G-G2：影子与真实判官同一模型口径——提取链模型，不能各写一份。
      const intakeRes = await withAI("turn.intake", { userContent: intakeContent, cfg: buildExtractionCfg("INTAKE", apiCfg) }, { ai, apiCfg, throwOnError: false, epoch, isStale: shadowStale });
      if (isStale?.() || epochGuard?.()) return null;
      intakeResult = normalizeIntakeResult(intakeRes?.data);
      const soleTalkTarget = talkTarget || (npcs.length === 1 ? npcs[0]?.name || "" : "");
      applyTalkTargetFallback(intakeResult, talkTarget, soleTalkTarget);
    }
    const verdict = judgeTurn({
      // WO-16E 二审修：真实判官吃 commit 前 timeNow——影子统一用回合前 turn，
      // 否则非搭话回合差 +1，day/跨日配额/warrantId/rng seed/origin 全错位。
      turn: preState?.turn ?? postState?.turn ?? 1, day: Math.floor((preState?.turn ?? postState?.turn ?? 1) / 24) + 1,
      place: preState?.room?.name || "",
      npcs, varTree: preState?.varTree || {},
      inv: preState?.inv || [], entries: [], talkOnly: isTalk,
      // S7 送银桥：与真实判官同一可信源——金额只认玩家原文，影子不同源会对账失真。
      playerInput: cmd,
      containers: containerView,
      prepItems: prepItemsForJudge,
      containerPlace,
      questCandidates,
      pickupJudgment: null,
      floatingItems,
      // WO-16E：与 runTurn 同一 budgetInput 入口——影子判官的授信口径必须
      // 与真实判官逐字一致，否则对账数据失真。
      budget: buildCausalBudgetInput({
        varTree: preState?.varTree || {},
        char: preState?.char || {},
        room: preState?.room || {}, inv: preState?.inv || [],
        turn: preState?.turn ?? postState?.turn ?? 1, day: Math.floor((preState?.turn ?? postState?.turn ?? 1) / 24) + 1,
        encounter: preState?.encounter || null,
        questCandidates,
      }, intakeResult, { gm }),
    // 影子用隔离 rng 实例——绝不能用全局 random，否则影子抽数会推进游戏共享
    // 随机流，污染后续掷骰/赌博等玩法结果（影子必须零行为变化）。
    }, intakeResult, { rng: createRng((((preState?.turn ?? postState?.turn ?? 1) * 2654435761) >>> 0) || 1).random });
    if (isStale?.() || epochGuard?.()) return null;

    const diffOut = diffSnapshots(preState, postState, { moved });
    const proj = projectFacts(verdict?.facts || []);
    // S5：feature 路由 kind 对应类目不参与比较（equip/use_item/take/invite）
    const result = compareCategories(diffOut, proj, { featureRoutedCats: featureRoutedCats(intakeResult?.actions, { npcs }) });
    if (isStale?.() || epochGuard?.()) return null;
    recordAggregate(epoch, result, cmd);
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

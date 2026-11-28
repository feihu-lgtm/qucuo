import { evolveKnowledge, buildInfoDomainBlock, setFactSummary } from "../../domain/rules/prompt/knowledge.js";
import { ensureSideCalls } from "../../domain/rules/prompt/calls/sideCalls.js";
import { recallWithVisibility } from "../ports/recallWithVisibility.js";
import { runFormattedRecall } from "../ports/recallBlock.js";
import { embeddingReady } from "../ports/embeddingService.js";
import { reembedStaleNotes } from "../ports/noteMemory.js";
import { createWebAi } from "../ports/ai.js";
import { withAI } from "../ports/withAI.js";

const MAX_SUMMARY_FAILURES = 5;
let consecutiveSummaryFailures = 0;

export function _resetSummaryCircuitBreaker() {
  consecutiveSummaryFailures = 0;
}

// 同步知识推演：纯函数计算同框传播与淡忘，生成【信息域】约束块与待补摘要事实 ID（<1ms，零网络阻塞）。
export function evolveKnowledgeSync({ varTreeLatest, roomNpcNames, infoDomainNpcNames = roomNpcNames, time, rng }) {
  const evo = evolveKnowledge(varTreeLatest, { roomNpcNames: infoDomainNpcNames, currentTurn: time, rng });
  const kTree = evo.varTree;
  return {
    infoDomainBlock: buildInfoDomainBlock(kTree, infoDomainNpcNames),
    kTree,
    pendingFids: (evo.待补摘要 || []).slice(0, 2),
  };
}

async function generateFactSummaries(pendingFids, { apiCfg, flags, ai }) {
  if (!pendingFids.length) return [];
  ensureSideCalls();
  return Promise.all(pendingFids.map(async (fid) => {
    try {
      // 1) 先拿事实名当查询词，去现成向量库召回相关的真旧事
      let recallTexts = [];
      if (embeddingReady(apiCfg)) {
        const rc = await recallWithVisibility({
          cfg: apiCfg, queryText: fid, contextText: "",
          focusEntities: [], unlockedFlags: flags, topK: 3,
        });
        recallTexts = (rc?.visible || []).map(v => v.text).filter(Boolean);
      }
      // 2) 有命中→据素材归纳（有据不瞎编）；无命中→纯现编兜底（经 withAI 统一出口）
      const callId = recallTexts.length ? "fact.summaryFromRecall" : "fact.summary";
      const res = await withAI(
        callId,
        { cue: fid, recallTexts },
        { ai, apiCfg, throwOnError: false },
      );
      const line = res.ok ? (res.text || "").trim().split("\n")[0].slice(0, 40) : "";
      return { fid, line, failed: !res.ok && Boolean(res.error) };
    } catch (_) {
      /* 补词失败就留空，下回合再试 */
      return { fid, line: "", failed: true };
    }
  }));
}

// 后台异步补全待补摘要（finalizeTurn 落盘后 fire-and-forget）：
// 连续失败 5 次熔断，防止接口异常时后台空转。
export async function backfillFactSummaries({
  pendingFids = [],
  getVarTree,
  setVarTree,
  apiCfg,
  flags,
  ai = createWebAi(),
  isStale,
  subscribeGameReplaced,
  trace,
} = {}) {
  if (!pendingFids.length || typeof setVarTree !== "function") return null;
  if (consecutiveSummaryFailures >= MAX_SUMMARY_FAILURES) return null;
  if (isStale?.()) return null;

  const latestBefore = getVarTree?.();
  const candidates = pendingFids
    .slice(0, 2)
    .filter((fid) => fid && !latestBefore?.世界?.知识领域?.事实?.[fid]?.摘要);
  if (!candidates.length) return null;

  let gameReplaced = false;
  let unsubscribe = null;
  try {
    unsubscribe = subscribeGameReplaced?.(() => { gameReplaced = true; }) ?? null;
    const settled = await generateFactSummaries(candidates, {
      apiCfg,
      flags,
      ai,
    });
    if (isStale?.() || gameReplaced) return null;

    const succeeded = settled.some((s) => Boolean(s.line));
    const hadFailure = settled.some((s) => s.failed);
    if (succeeded) {
      consecutiveSummaryFailures = 0;
      setVarTree((prev) => {
        let next = prev;
        for (const { fid, line } of settled) {
          if (line && !next?.世界?.知识领域?.事实?.[fid]?.摘要) {
            next = setFactSummary(next, fid, line);
          }
        }
        return next;
      });
    } else if (hadFailure) {
      consecutiveSummaryFailures += 1;
    }
    return settled;
  } catch (_) {
    consecutiveSummaryFailures += 1;
    return null;
  } finally {
    unsubscribe?.();
  }
}

// 兼容直接调用入口（单测保留）：同步推演 + 按需补摘要。
export async function runKnowledgeTurn({ varTreeLatest, roomNpcNames, infoDomainNpcNames = roomNpcNames, time, apiCfg, flags, ai = createWebAi(), rng }) {
  const evo = evolveKnowledgeSync({ varTreeLatest, roomNpcNames, infoDomainNpcNames, time, rng });
  let kTree = evo.kTree;
  if (evo.pendingFids.length) {
    const settled = await generateFactSummaries(evo.pendingFids, { apiCfg, flags, ai });
    for (const { fid, line } of settled) {
      if (line) kTree = setFactSummary(kTree, fid, line);
    }
  }
  return { infoDomainBlock: buildInfoDomainBlock(kTree, infoDomainNpcNames), kTree, pendingFids: evo.pendingFids };
}

// 三层记忆·向量召回层（请求段，无副作用）：从长期记忆库里捞出与"当前这句输入 +
// 当前情境"语义相关、但可能早已滑出最近对话窗口的旧事，拼成一段 RecalledMemories
// 注入 prompt，让 AI"想起"窗口外的伏笔/承诺/旧账。
// 双路查询：Q_intent=玩家这句话；Q_context=上轮引擎回复 + 当前位置/在场人物。
// 全程降级安全：没开向量开关或召回失败，recallInfo 为 null，这段完全不影响后续流程。
export async function runRecall({ apiCfg, cmd, lastAiText, room, varTreeLatest, flags, activeTarget, activeGroundItem, isTalk, talkTarget, followingNames = [], recentTexts = [], viewer = "", epoch, currentTurn, lineage } = {}) {
  // WO-18：不在这层按 embeddingReady 截停——原文段落召回是纯本地词法路，
  // 没开向量也必须跑；向量纸条/reembed 的开关判断统一收进 runFormattedRecall 内部。
  // 召回前对账（后台自愈，不阻塞本轮）：把换模型后指纹过期、召不回的老纸条重算向量写回。
  // 有界(每回合最多几条)，逐回合把库里过期纸条慢慢补齐，不影响本轮召回时序。
  if (embeddingReady(apiCfg)) reembedStaleNotes({ cfg: apiCfg }).catch(() => {});
  // 缺 room/varTree 的降级调用（测试替身/边缘链路）也不能炸——prose 召回本来就不需要它们
  const npcNames = (room?.npcs || []).map(n => n.name);
  const focusEntities = Array.from(new Set([
    ...npcNames,
    ...Object.keys(varTreeLatest?.角色 || {}),
    room?.name,
    ...(activeGroundItem ? [activeGroundItem] : []),
  ].filter(Boolean)));
  return runFormattedRecall({
    apiCfg,
    queryText: cmd,
    contextText: `${lastAiText}\n[当前]位置:${room?.name || "?"} 在场:${npcNames.join("、") || "无"} 地上关注物品:${activeGroundItem || "无"}`,
    focusEntities,
    unlockedFlags: flags,
    presentNames: Array.from(new Set([...npcNames, ...followingNames, ...(activeTarget ? [activeTarget] : []), ...(isTalk && talkTarget ? [talkTarget] : [])])),
    topK: 5,
    recentTexts,
    viewer,
    epoch,
    currentTurn,
    lineage,
  });
}

import { evolveKnowledge, buildInfoDomainBlock, setFactSummary } from "../../domain/rules/prompt/knowledge.js";
import { ensureSideCalls } from "../../domain/rules/prompt/calls/sideCalls.js";
import { recallWithVisibility } from "../ports/recallWithVisibility.js";
import { runFormattedRecall } from "../ports/recallBlock.js";
import { embeddingReady } from "../ports/embeddingService.js";
import { reembedStaleNotes } from "../ports/noteMemory.js";
import { createWebAi } from "../ports/ai.js";
import { withAI } from "../ports/withAI.js";

// 信息领域·知识系统（代码驱动）：每回合由代码确定性推演"谁知道什么"——
// 同框传播 + 传闻淡忘（见 knowledge.js）。推演产物是"待补摘要"——在场者涉及、
// 但账上还没有一句话描述的事实。此时才把 AI 当工具点一下：发一个独立小 prompt
// 要一句话，收回来存进账里（agents 式：代码调度，AI 填词）。最后据此账生成
// 【信息域】硬约束块注入主剧情，让 NPC 言行严格符合各自知情状态。
// 请求段无副作用：返回 { infoDomainBlock, kTree }，由 act 统一 setVarTree 提交
// （本回合状态的一部分，失败会随整体回滚）。
// 注意：必须读 act 传来的最新 varTree（varTreeRef 的值）：哪怕 act 是旧闭包
// （切磋结算后 setTimeout 调来的），evolveKnowledge 也基于最新状态推演——否则
// 推演结果整体覆盖写回时会把刚进账的认识/好感度更新冲掉（"交情已加但仍显示
// 尚未认识"bug 的根源，见 varTreeRef 注释）。
// infoDomainNpcNames：【信息域】只列此刻喂给 AI 的在场者（内层房间过滤后+随行伙伴）；
// 知识传播也只能在这批人之间发生——拿据点全员走会让别的内层房间的人隔空
// "教会"本房 NPC，信息域就会点出一个本轮没听过、却忽然知情的名字。
export async function runKnowledgeTurn({ varTreeLatest, roomNpcNames, infoDomainNpcNames = roomNpcNames, time, apiCfg, flags, ai = createWebAi(), rng }) {
  const evo = evolveKnowledge(varTreeLatest, { roomNpcNames: infoDomainNpcNames, currentTurn: time, rng });
  let kTree = evo.varTree;
  // 按需补摘要（最多 2 条/回合，失败静默——摘要非关键，不阻断游戏）
  // 内容层优先从向量库召回真旧事据以归纳；召不回才让 AI 现编兜底。
  const pendingFids = evo.待补摘要.slice(0, 2);
  if (pendingFids.length) {
    ensureSideCalls();
    const settled = await Promise.all(pendingFids.map(async (fid) => {
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
        return { fid, line };
      } catch (_) {
        /* 补词失败就留空，下回合再试 */
        return { fid, line: "" };
      }
    }));
    // 按原始顺序确定性写回 kTree，避免并发乱序
    for (const { fid, line } of settled) {
      if (line) kTree = setFactSummary(kTree, fid, line);
    }
  }
  return { infoDomainBlock: buildInfoDomainBlock(kTree, infoDomainNpcNames), kTree };
}

// 三层记忆·向量召回层（请求段，无副作用）：从长期记忆库里捞出与"当前这句输入 +
// 当前情境"语义相关、但可能早已滑出最近对话窗口的旧事，拼成一段 RecalledMemories
// 注入 prompt，让 AI"想起"窗口外的伏笔/承诺/旧账。
// 双路查询：Q_intent=玩家这句话；Q_context=上轮引擎回复 + 当前位置/在场人物。
// 全程降级安全：没开向量开关或召回失败，recallInfo 为 null，这段完全不影响后续流程。
export async function runRecall({ apiCfg, cmd, lastAiText, room, varTreeLatest, flags, activeTarget, activeGroundItem, isTalk, talkTarget, followingNames = [], recentTexts = [], viewer = "", epoch, currentTurn } = {}) {
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
  });
}

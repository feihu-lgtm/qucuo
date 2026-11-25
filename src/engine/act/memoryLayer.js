import { evolveKnowledge, buildInfoDomainBlock } from "../../domain/rules/prompt/knowledge.js";
import { runFormattedRecall } from "../ports/recallBlock.js";
import { embeddingReady } from "../ports/embeddingService.js";
import { reembedStaleNotes } from "../ports/noteMemory.js";
import { createWebAi } from "../ports/ai.js";

// 信息领域·知识系统（代码驱动）：每回合由代码确定性推演"谁知道什么"——
// 同框传播 + 传闻淡忘（见 knowledge.js），据此账生成【信息域】硬约束块注入主剧情，
// 让 NPC 言行严格符合各自知情状态。
// WO-16：同步阻塞的 fact.summary AI 补词已删——事实标题直接取判官定案模板串，
// 空缺摘要不再阻塞回合；evolveKnowledge 确定性传播保留。
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
  return { infoDomainBlock: buildInfoDomainBlock(kTree, infoDomainNpcNames), kTree };
}

// 三层记忆·向量召回层（请求段，无副作用）：从长期记忆库里捞出与"当前这句输入 +
// 当前情境"语义相关、但可能早已滑出最近对话窗口的旧事，拼成一段 RecalledMemories
// 注入 prompt，让 AI"想起"窗口外的伏笔/承诺/旧账。
// 双路查询：Q_intent=玩家这句话；Q_context=上轮引擎回复 + 当前位置/在场人物。
// 全程降级安全：没开向量开关或召回失败，recallInfo 为 null，这段完全不影响后续流程。
export async function runRecall({ apiCfg, cmd, lastAiText, room, varTreeLatest, flags, activeTarget, activeGroundItem, isTalk, talkTarget, followingNames = [], recentTexts = [] }) {
  if (!embeddingReady(apiCfg)) return { recallInfo: null, recallBlock: "" };
  // 召回前对账（后台自愈，不阻塞本轮）：把换模型后指纹过期、召不回的老纸条重算向量写回。
  // 有界(每回合最多几条)，逐回合把库里过期纸条慢慢补齐，不影响本轮召回时序。
  reembedStaleNotes({ cfg: apiCfg }).catch(() => {});
  const focusEntities = Array.from(new Set([
    ...room.npcs.map(n => n.name),
    ...Object.keys(varTreeLatest.角色 || {}),
    room.name,
    ...(activeGroundItem ? [activeGroundItem] : []),
  ]));
  return runFormattedRecall({
    apiCfg,
    queryText: cmd,
    contextText: `${lastAiText}\n[当前]位置:${room.name} 在场:${room.npcs.map(n => n.name).join("、") || "无"} 地上关注物品:${activeGroundItem || "无"}`,
    focusEntities,
    unlockedFlags: flags,
    presentNames: Array.from(new Set([...room.npcs.map(n => n.name), ...followingNames, ...(activeTarget ? [activeTarget] : []), ...(isTalk && talkTarget ? [talkTarget] : [])])),
    topK: 5,
    recentTexts,
  });
}

// 召回总入口（带可见性过滤）
// ------------------------------------------------------------------
// 这是 apiConfig.js 注释里点名的那个模块。MudRPG 在发送 API 前调它一次，
// 返回结构固定为 { visible, filtered, stats }，直接喂给 callModel 的 opts.recallInfo，
// Pipeline 查看器的"召回"标签页据此渲染（读 m.similarity / m.meta.id / m.text）。
//
// 编排流程（请求段，无副作用）：
//   1. 分别为 Q_intent（当前输入）和 Q_context（上下文）取向量
//   2. 从 IndexedDB 读全部记忆，滤掉指纹不匹配的（换过 embedding 模型的旧记录）
//   3. recallEngine 双路 RRF + 实体过滤 + 强弱分层，取 topK
//   4. 按可见性切分：public 恒可见；private 需对应 flag 已解锁才可见
//   5. 打包成契约结构返回；任何一步异常都降级返回 null（不阻断游戏）

import { getEmbedding, embeddingReady, embeddingFingerprint } from "./embeddingService.js";
import { getAllMemories } from "./memoryStore.js";
import { recall } from "./recallEngine.js";
import { noteVisibleTo } from "./note.js";

export async function recallWithVisibility({
  cfg,
  queryText,       // 当前玩家输入
  contextText,     // 上轮 AI 回复 + 位置/在场NPC 等上下文（拼成一段）
  focusEntities = [],
  unlockedFlags = [],
  presentNames = [],   // 当前在场/在语境里的人名（room.npcs + 对话对象 + 旁白等）——owner 私有召回门用
  topK = 5,
}) {
  if (!embeddingReady(cfg)) return null; // 没开/没配 → 彻底跳过召回

  try {
    const fp = embeddingFingerprint(cfg);

    // 1. 两路查询向量（各一次 embedding 调用；任一失败则该路为 null，引擎自动退化单路）
    const [qIntentVec, qContextVec] = await Promise.all([
      getEmbedding(cfg, queryText),
      contextText ? getEmbedding(cfg, contextText) : Promise.resolve(null),
    ]);
    if (!qIntentVec && !qContextVec) return null; // 两路都取不到向量，没法召回

    // 2. 读全部记忆，只保留指纹一致、且有向量的
    const all = await getAllMemories();
    const usable = all
      .filter(m => m.fingerprint === fp && Array.isArray(m.embedding) && m.embedding.length)
      .map(m => ({ ...m, _vec: Float32Array.from(m.embedding) }));

    if (!usable.length) {
      return { visible: [], filtered: 0, stats: { 库内可用记忆: all.length ? `${usable.length}/${all.length}(指纹过滤后)` : 0 } };
    }

    // 3. 召回
    const hits = recall({ memories: usable, qIntentVec, qContextVec, focusEntities, topK });

    // 4. 可见性切分（owner 三态私有门，逻辑抽在 note.js 的 noteVisibleTo 纯函数里）
    // · owner 空 = 公共见闻，恒可见。
    // · owner 非空 = 私有/共同目击，只有当 owner 里至少一人此刻在场（presentNames）才浮现——
    //   这就是「私聊你俩私有、外人捞不到」的硬约束，向量相似度给不了、靠 owner 名单兜。
    // · 老记录没有 owner 但 visibility=private（旧 flag 私有）：退回原来的 flag 门。
    const visible = [];
    let filtered = 0;
    for (const h of hits) {
      const rec = h.record;
      if (!noteVisibleTo(rec, { presentNames, unlockedFlags })) { filtered++; continue; }
      visible.push({
        id: rec.id,
        text: rec.text,
        similarity: h.similarity,
        tier: h.tier, // 'strong' 给全文 / 'weak' 给截断摘要（由 prompt 组装层决定粒度）
        meta: {
          id: rec.id,
          turn: rec.turn,
          visibility: rec.visibility,
          owner: rec.owner || [],          // [{name,via}]，后续「私有按在场人过滤」用
          ownerTier: rec.ownerTier || (rec.visibility === "public" ? "public" : "private"),
          place: rec.place || null,
          source: rec.source || null,
          entities: rec.entities || [],
        },
      });
    }

    // 5. 打包（stats 里的 key 会原样显示在召回标签页顶部）
    return {
      visible,
      filtered,
      stats: {
        召回候选: hits.length,
        进入prompt: visible.length,
        强相关: visible.filter(v => v.tier === "strong").length,
        弱相关: visible.filter(v => v.tier === "weak").length,
        库内可用: `${usable.length}/${all.length}`,
        双路: qIntentVec && qContextVec ? "是" : "单路降级",
      },
    };
  } catch (err) {
    // 降级：召回整体失败绝不影响主流程，返回 null 让 MudRPG 当作"这轮没召回"
    console.warn("[recall] 召回失败，本轮降级：", err.message || err);
    return null;
  }
}

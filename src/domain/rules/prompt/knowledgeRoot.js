// 知识领域的存取与只读摘要，不依赖 buildPrompt。
// 单独成文件是为了断开 promptRefs → fields → knowledge → buildPrompt → promptRefs 这个循环：
// fields.js 只需要读事实摘要，不该因此把整套 prompt 构建拉进来。

export const KROOT = "知识领域";

export function ensureRoot(varTree) {
  const 世界 = varTree.世界 || {};
  const 领域 = 世界[KROOT] || { 事实: {} };
  if (!领域.事实) 领域.事实 = {};
  return 领域;
}

export function writeRoot(varTree, 领域) {
  return { ...varTree, 世界: { ...(varTree.世界 || {}), [KROOT]: 领域 } };
}

export function allFactSummaries(varTree, limit = 20) {
  const 领域 = ensureRoot(varTree);
  const facts = Object.values(领域.事实)
    .filter(f => f.摘要)
    .sort((a, b) => (b.诞生回合 || 0) - (a.诞生回合 || 0))
    .slice(0, limit);
  return facts.map(f => ({ id: f.id, 摘要: f.摘要, 标签: f.标签, 诞生回合: f.诞生回合 }));
}

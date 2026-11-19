// 关键道具的"当前持有者"追踪——见总纲第七章7.3节。
// 这张表不是给玩家看的UI，是给AI/系统裁决时"查表"用的确定性数据源，
// 类似 knowledge.js 事实账本的定位：AI 不需要自己记忆/编造道具在哪，
// 系统直接从这张表读，AI 只负责在系统给定的状态上叙事。
//
// 存放位置：varTree.世界.关键道具.<itemId>，结构：
// { holder, state, history: [{ turn, event }] }
//
// varTree 是 React state（见 MudRPG.jsx 的 setVarTree），这里所有函数都不
// 原地修改传入对象，而是返回一份新的 varTree，调用方用 setVarTree(vt =>
// transferKeyItem(vt, ...)) 这种写法接。

// 每个关键道具的初始状态——尚未被任何人取得时的默认叙事状态。
export const KEY_ITEM_DEFAULTS = {
  虎胆: { holder: "熊山", state: "尚未现踪，虎王仍活着" },
  税册: { holder: "土司府", state: "库房封存" },
};

// 确保 varTree 里已经有这张表，缺失的道具补上默认初始状态，不覆盖已有数据。
export function initKeyItemTracking(varTree) {
  const existing = varTree?.世界?.关键道具 || {};
  const merged = { ...existing };
  let changed = false;
  for (const [itemId, def] of Object.entries(KEY_ITEM_DEFAULTS)) {
    if (!merged[itemId]) {
      merged[itemId] = { ...def, history: [] };
      changed = true;
    }
  }
  if (!changed && varTree?.世界?.关键道具) return varTree;
  return { ...varTree, 世界: { ...(varTree.世界 || {}), 关键道具: merged } };
}

// 转移关键道具的持有者/状态，并追加一条 history 记录，返回新的 varTree。
export function transferKeyItem(varTree, itemId, newHolder, newState, turn, eventText) {
  const container = varTree?.世界?.关键道具 || {};
  const prev = container[itemId] || { history: [] };
  const updated = {
    holder: newHolder,
    state: newState ?? prev.state ?? "",
    history: [...(prev.history || []), { turn, event: eventText }],
  };
  return {
    ...varTree,
    世界: { ...(varTree?.世界 || {}), 关键道具: { ...container, [itemId]: updated } },
  };
}

// 查询当前状态，供主叙事/提取层判断"这件事现在能不能做"（比如能不能偷）。
export function getKeyItemState(varTree, itemId) {
  return varTree?.世界?.关键道具?.[itemId] ?? KEY_ITEM_DEFAULTS[itemId] ?? null;
}

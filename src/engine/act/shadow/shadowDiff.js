// WO-16D 影子对账·commit 前后 diff（纯函数）
// 审计结论（快照窗口 = playTurn capture 后 → commit 后的非模型写）：
// - 时间推进/移动写房间/记账/ convo 不在五类目字段内，天然排除；
// - markNpcAsKnown 首识播种 INITIAL_FAVORABILITY 会写 varTree.角色.X.好感度——
//   pre 中不存在的 npc 视为系统播种，其基线值整体排除（不算单调用模型归因）；
// - 移动回合的 room.npcs 变化全部由系统写房间产生，npcs 类目标记 excluded 不对比；
// - deterministic feature 前置硬结算（gift/learn/invite/snow/collect）在快照前已落账，
//   不进窗口——无需归因旁路（审计结论支持按类目/规则排除，见 PR 描述）。
import { emptyCategories, itemKey } from "./shadowTaxonomy.js";
import { INTIMATE_TICKET_NAME } from "../../../domain/rules/npc/goldenEgg.js";

const invMap = (inv) => {
  const m = new Map();
  for (const entry of inv || []) {
    // 焚卡等系统消费件按名称归一 key——它们带实例 id，用 id 做 key 无法归因排除
    const name = typeof entry === "object" && entry ? entry.name : entry;
    const k = name === INTIMATE_TICKET_NAME ? INTIMATE_TICKET_NAME : itemKey(entry);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

function diffMultiset(before, after) {
  const add = [], rm = [];
  for (const [k, n] of after) {
    const b = before.get(k) || 0;
    for (let i = 0; i < n - b; i++) add.push(k);
  }
  for (const [k, n] of before) {
    const a = after.get(k) || 0;
    for (let i = 0; i < n - a; i++) rm.push(k);
  }
  return { add, rm };
}

// pre/post：{ inv, flags, varTree, room } 形状快照切片。
// opts.moved=true 时 npcs 类目整体 excluded（移动写房间是系统行为）。
export function diffSnapshots(pre, post, { moved = false } = {}) {
  const out = emptyCategories();
  const excluded = [];

  const invDiff = diffMultiset(invMap(pre?.inv), invMap(post?.inv));
  // 系统归因排除：焚卡强开（burnIntimateTicket）在窗口内消费「女眷一次卡·不可拒绝」，
  // 是 feature deterministic 写不是模型归因——剔出 diff。
  out.inv.add = invDiff.add;
  out.inv.rm = invDiff.rm.filter((k) => k !== INTIMATE_TICKET_NAME);

  const preFlags = new Set(pre?.flags || []);
  out.flags.add = (post?.flags || []).filter((f) => !preFlags.has(f));

  const preChars = pre?.varTree?.角色 || {};
  const postChars = post?.varTree?.角色 || {};
  for (const [npc, node] of Object.entries(postChars)) {
    if (!(npc in preChars)) continue; // 系统首识播种整体排除（含基线 10），不进模型归因
    const before = Number(preChars[npc]?.好感度) || 0;
    const after = Number(node?.好感度) || 0;
    if (after !== before) out.affection[npc] = after - before;
  }

  // 审计结论：room.npcs 在窗口内有整链系统改写（幽灵过滤/驻场剔除/战斗固化/
  // 移动落房/涌现实体化/焚卡烙印），纯 diff 无法归因——v1 恒 excluded，
  // 不做泛化复杂旁路（协调裁决）。
  void moved;
  excluded.push("npcs");

  return { categories: out, excluded };
}

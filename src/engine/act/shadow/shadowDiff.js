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

  // WO-16D-M1 vitals：char.hp[0]/char.money 数值差——窗口内系统写（包扎/战斗结算）
  // 与模型归因混杂的风险存在，但判官侧同样是系统签发事实，对照语义一致；纳入对比。
  const preHp = pre?.char?.hp?.[0], postHp = post?.char?.hp?.[0];
  if (Number.isFinite(preHp) && Number.isFinite(postHp) && postHp !== preHp) out.vitals.hp = postHp - preHp;
  const preMoney = pre?.char?.money ?? 0, postMoney = post?.char?.money ?? 0;
  if (postMoney !== preMoney) out.vitals.money = postMoney - preMoney;

  // skills 多重集 diff（按名/ id 归一，与 inv 同手法）
  const skillKey = (entry) => (typeof entry === "string" ? entry : entry?.id || entry?.name || "");
  const skillMap = (list) => {
    const m = new Map();
    for (const entry of list || []) {
      const k = skillKey(entry);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  const skDiff = diffMultiset(skillMap(pre?.skills), skillMap(post?.skills));
  out.skills.add = skDiff.add;
  out.skills.rm = skDiff.rm;

  // cultivation：exp/pot 顶层数值差
  const preExp = pre?.exp ?? 0, postExp = post?.exp ?? 0;
  if (postExp !== preExp) out.cultivation.exp = postExp - preExp;
  const prePot = pre?.pot ?? 0, postPot = post?.pot ?? 0;
  if (postPot !== prePot) out.cultivation.pot = postPot - prePot;

  // quest 语义投影：questProgress 状态/阶段变化的任务 id——系统 questFlagRule 扫描
  // flags 的自动推进也在窗口内，无法区分模型归因；但判官侧 ADVANCE_QUEST 同样
  // 只签 flag 由规则接管，两边语义对齐（都是「本回合任务有推进」），纳入对比。
  const preQ = pre?.questProgress || {}, postQ = post?.questProgress || {};
  for (const [qid, qp] of Object.entries(postQ)) {
    const before = preQ[qid];
    if (!before) { out.quest.advance.push(qid); continue; }
    if (before.status !== qp?.status || before.currentStageIndex !== qp?.currentStageIndex) out.quest.advance.push(qid);
  }

  // S5 world 类目：varTree.世界 的数值标量 leaf 差（威望 等）——合法 mvu 写账
  // 此前八类目无一覆盖（taxonomy 盲区）。只 diff 数值 leaf：对象/数组账本
  // （容器/调息账/每日搜刮 等）是结构化账本不是标量状态，不混进此类目。
  const preWorld = pre?.varTree?.世界 || {};
  const postWorld = post?.varTree?.世界 || {};
  for (const key of new Set([...Object.keys(preWorld), ...Object.keys(postWorld)])) {
    const bv = preWorld[key], av = postWorld[key];
    if (typeof bv !== "number" && typeof av !== "number") continue;
    const before = Number.isFinite(bv) ? bv : 0;
    const after = Number.isFinite(av) ? av : 0;
    if (after !== before) out.world[key] = after - before;
  }
  // Review 修（S5）：契约违约系统的威望扣减是 deterministic 值守扫描（pactWatch
  // breachTurn 幂等标记，每桩 -5），不经判官也不该算判官漏判——按窗口内新增
  // breachTurn 标记数归因剔除。模型/判官真写威望的差额部分照常保留。
  if (out.world.威望) {
    const countBreaches = (tree) => {
      let n = 0;
      for (const pacts of Object.values(tree || {})) {
        for (const pact of Object.values(pacts || {})) {
          if (Number.isFinite(pact?.breachTurn)) n += 1;
        }
      }
      return n;
    };
    const newBreaches = countBreaches(postWorld.契约) - countBreaches(preWorld.契约);
    if (newBreaches > 0) {
      const explained = -5 * newBreaches; // PACT_BREACH_PRESTIGE_COST=5（pigeon/pactWatch）
      const residual = out.world.威望 - explained;
      if (residual === 0) delete out.world.威望;
      else out.world.威望 = residual;
    }
  }

  // 审计结论：room.npcs 在窗口内有整链系统改写（幽灵过滤/驻场剔除/战斗固化/
  // 移动落房/涌现实体化/焚卡烙印），纯 diff 无法归因——v1 恒 excluded，
  // 不做泛化复杂旁路（协调裁决）。
  void moved;
  excluded.push("npcs");

  return { categories: out, excluded };
}

// 在场名单 · 唯一的写入口（纯函数 reducer 集合）
// ============================================================================
// 【为什么要有这个文件】
// room.npcs 此前有 15 个写入方（MudRPG 11 处 + commitRound 4 处），
// 每一处都自己写一遍 `setRoom(r => ({ ...r, npcs: r.npcs.map(...) }))`。
// 近期连着两个 bug 都出在这儿，而且是同一个病：
//
//   ① commitRound 的原地互动分支写 `npcs: r.npcs`，把另一处刚固化好的
//      carriedItems 整个丢掉 → 切磋赢了掉落池恒为空、偷窃只偷得到招。
//   ② 驻场注入处 `existingNames.has(name)` 就跳过，让 residentNpcs.js 里
//      配好的 carry 永远进不了场 → 「偷才旦摸了半天一无所有」。
//
// 两个 bug 的共同点：**这份状态没有唯一的主人**。谁都能改，改的时候只顾自己
// 那一件事，顺手把别人写进去的东西冲掉——而且不报错、测不出来、要靠玩家打很多场
// 才察觉。文件切多小都治不了这个，得先把写入口收拢。
//
// 【收哪些、不收哪些】
// 只收"改名单"的操作（增删人、补数据、标记随身物）。
// **整体换房间那几处不收**（传送/移动/进出心灵之海：`npcs: []` 或 `npcs: gridNpcs`）——
// 那是"换了个 room 对象"，不是"改这份名单"，混进来反而让职责变糊。
//
// 【为什么写成纯函数而不是 hook】
// 这些操作 commitRound 也要用，它不是组件、拿不到 hook。写成 (npcs, args) => npcs
// 的纯 reducer，两边都能用，还能直接单测——那两个 bug 恰恰是"没法单测"才漏掉的。

// 回填/补数据时只取这些字段。刻意不整份铺盖：名单上的对象可能带着
// 驻场绑定、lockInnerRoom、companionCandidate、innerRoom（当天落点），
// 以及 carriedItems 里的 stolen/dropped 标记——整份覆盖会把它们冲掉，
// 那正是 bug ① 的成因，别在收拢的过程中再犯一次。
export const COMBAT_FIELDS = [
  "carriedItems", "moveset", "special", "combatStats", "levelCap",
  "waigong", "neigong", "baseAtk", "equipAtk", "equipDef", "personalityProfile",
];

export function pickCombatData(src) {
  const out = {};
  for (const k of COMBAT_FIELDS) if (src?.[k] !== undefined) out[k] = src[k];
  return out;
}

// ── ① 注入：把该在场的人放进来，已在的补齐设定 ────────────────────────
// incoming 是完整版本（已过 ensureNpcCombatData），可能包含驻场/游走/护镖/竞价者。
// 【关键】名字已在名单里的，**也要补数据**——这是 bug ② 的修法：
// AI 第一轮就可能报了同名的人（只有 name/brief），若光看名字就跳过，
// residentNpcs.js 里配的 carry/levelCap 永远进不来。
// 补的时候只填目标身上缺的字段，它自己有值的一律保留（AI 给的 brief、
// 当天分配的 innerRoom 都不该被覆盖）。
export function injectNpcs(npcs, incoming) {
  const list = Array.isArray(npcs) ? npcs : [];
  const add = (Array.isArray(incoming) ? incoming : []).filter(n => n?.name);
  if (!add.length) return list;

  const byName = new Map();
  for (const n of add) if (!byName.has(n.name)) byName.set(n.name, n); // 同名只取第一个

  const patched = list.map(o => {
    const full = byName.get(o?.name);
    if (!full) return o;
    if (o.carriedItems) return o;   // 已有随身物就别动（可能带 stolen/dropped 标记）
    const fill = Object.fromEntries(
      Object.entries(full).filter(([k, v]) => o[k] === undefined && v !== undefined),
    );
    return Object.keys(fill).length ? { ...o, ...fill } : o;
  });

  const existing = new Set(list.map(n => n?.name));
  const toAdd = add.filter(n => !existing.has(n.name) && byName.get(n.name) === n);
  return toAdd.length || patched.some((n, i) => n !== list[i]) ? [...patched, ...toAdd] : list;
}

// ── ② 回填固化数据：名单不动，只补战斗字段 ────────────────────────────
// freshByName: Map<name, 已固化的NPC>。用于 commitRound 的原地互动分支——
// 那里 npcs 必须以系统既有名单为准（不信 AI 这轮报的在场名单，那是另一个
// 已修 bug 的根因："此地的人一会好几个一会都走光"），但数据要补齐。
export function patchCombatData(npcs, freshByName) {
  const list = Array.isArray(npcs) ? npcs : [];
  if (!freshByName || !freshByName.size) return list;
  let changed = false;
  const out = list.map(o => {
    if (o?.carriedItems) return o;
    const fresh = freshByName.get(o?.name);
    if (!fresh?.carriedItems) return o;
    changed = true;
    return { ...o, ...pickCombatData(fresh) };
  });
  return changed ? out : list;
}

// ── ③ 标记随身物已失去 ────────────────────────────────────────────────
// reason: "stolen"（被偷/被夺）| "dropped"（战斗掉落）
// 【为什么两个标记不合并成一个】语义不同且都要留：stolen 表示"这件已经不在他身上"，
// dropped 同理但来源是战斗。偷窃系统只滤 stolen、切磋掉落两个都滤——
// 合并会让「偷过的东西在切磋里又掉一次」这类事重新可能。
// match 支持按 id 或按 name（不同调用方手上的信息不一样：切磋掉落只有 name，
// 清剿 loot 有 id）。
export function markCarriedLost(npcs, npcName, match, reason = "stolen") {
  const list = Array.isArray(npcs) ? npcs : [];
  if (!npcName || !match) return list;
  let changed = false;
  const out = list.map(n => {
    if (n?.name !== npcName || !Array.isArray(n.carriedItems)) return n;
    const items = n.carriedItems.map(it => {
      const hit = (match.id && it.id === match.id) || (match.name && it.name === match.name) || it === match;
      if (!hit || it[reason]) return it;
      changed = true;
      return { ...it, [reason]: true };
    });
    return changed ? { ...n, carriedItems: items } : n;
  });
  return changed ? out : list;
}

// ── ④ 涌现登场：把传闻中的人实体化（就地替换成带战斗数据的版本）──────
export function materializeNpc(npcs, npcName, fixed) {
  const list = Array.isArray(npcs) ? npcs : [];
  if (!npcName || !fixed) return list;
  let changed = false;
  const out = list.map(n => {
    if (n?.name !== npcName) return n;
    changed = true;
    return fixed;
  });
  return changed ? out : list;
}

// ── ⑤ 移除（雪豹入队后不再作为驻场兽在场；重生怪先移旧再加新）──────
export function removeNpc(npcs, pred) {
  const list = Array.isArray(npcs) ? npcs : [];
  const out = list.filter(n => !pred(n));
  return out.length === list.length ? list : out;
}

// 重生：先按名字移掉旧的，再放一只新的（村口大公鸡那种无限刷）
export function respawnNpc(npcs, fresh) {
  const list = Array.isArray(npcs) ? npcs : [];
  if (!fresh?.name) return list;
  return [...list.filter(n => n?.name !== fresh.name), fresh];
}

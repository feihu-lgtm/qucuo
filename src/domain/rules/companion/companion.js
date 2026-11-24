// 伙伴系统 · 出战位与导入入队（具名灵兽在 companionAnimals.js，形态文案在 companionLore.js）
// ============================================================================
// ============================================================================
// 曲措乡第一个"动物伙伴/队友"角色——村口卧守、命定只认玩家的无主灵兽，
// 蓝档，可随玩家出战，在切磋里以2v2("玩家+雪豹" vs "1~2个对手")的形态
// 并肩作战。它不属于嘎则或任何人，自雪线之上而来，只与玩家结下羁绊；
// 认主入队后化为人形成年女子（18 岁以上），立绘与外貌描述默认人形、仍可切回兽形，
// 详见 residentNpcs 雪豹设定与 roundNotes 注入的二形态人设。
//
// 【设计原则，跟项目一贯的"系统裁决"一致】
// - 雪豹是固定的具名角色，不是随机生成的路人——七维/招式一次性生成后写死，
//   不会每次战斗都不一样（跟 npcGeneration.js"出生固化"同一个哲学）。
// - 战力走统一战力曲线（atkFromWaigong/hpFromNeigong），蓝档(levelCap=2)，
import { generateNpcAttributes, getTierPower, hpFromNeigong, deriveSignatureMoveset } from "../npc/npcGeneration.js";
import { deriveMovesetFromSig } from "../npc/npcMovesets.js";
import { createEmptyStatusSlots } from "../combat/statusEffects.js";
import { COMPANION_SLOTS } from "./companionSlots.js";
export { initCompanionState } from "./companionState.js";
export { COMPANION_SLOTS } from "./companionSlots.js";
export { SNOW_LEOPARD_PROFILE, createSnowLeopard, unlockSnowLeopard, isSnowLeopardAvailable,
         PEARL_PROFILE, createPearl, unlockPearl, createAsuka, unlockAsuka, isAsukaAvailable }
  from "./companionAnimals.js";
export { COMPANION_DESC_FORMS, COMPANION_LORE } from "./companionLore.js";

// ── 出战位：同时只带一个 ─────────────────────────────────────────────
// 【为什么单槽互斥】战斗引擎是 2v2（玩家+1 队友 vs 敌方），第二个队友没有位置。
// 具名伙伴（雪豹/珍珠/墨团/明日香）+ 玩家入册导入的 NPC 共用这唯一一个出战位——
// 谁上场谁 active，其余一律留守。COMPANION_SLOTS 只登记内置的具名伙伴；导入的
// 伙伴是运行时才产生的，用 imported_<名字> 作 key 动态挂在 companionState 上。
// 下面所有遍历一律走 allCompanionKeys（内置 + 动态），不再只认 COMPANION_SLOTS。
// ── 导入 NPC 入队 ────────────────────────────────────────────────────
// 玩家入册的角色也能被邀请入队，跟具名伙伴抢同一个出战位。跟灵兽不同，导入的是
// 「人」：beast:false、走人类均衡战斗性格（不套雪豹那份纯野兽本能）。数值用它入册
// 时配的品阶/七维/内外功，缺的按品阶兜底；招式若入册配过，deriveSignatureMoveset
// 会经 getImportedSignatureMoves 读到，没配则按品阶回退随机。产出形状与
// createSnowLeopard 一致，buildLeopardUnit 直接能用，战斗引擎无须改动。
const IMPORTED_COMPANION_PROFILE = {
  moveWeights: { 攻击: 0.45, 防御: 0.3, 状态: 0.25 },
  riskAppetite: 0.5,
  avoidRepeat: 0.4,
};

function importedCompanionKey(name) {
  return `imported_${name}`;
}

export function createImportedCompanion(npc) {
  const levelCap = Number.isFinite(npc?.levelCap) ? npc.levelCap : 1;
  const special = (npc?.special && Object.keys(npc.special).length)
    ? { ...npc.special } : generateNpcAttributes({ levelCap });
  const tier = getTierPower(levelCap);
  const neigong = Number.isFinite(npc?.neigong) ? npc.neigong : tier.neigong;
  const waigong = Number.isFinite(npc?.waigong) ? npc.waigong : tier.waigong;
  const maxHp = hpFromNeigong(neigong, special.体魄 ?? 5);

  const npcShape = {
    name: npc.name, id: importedCompanionKey(npc.name),
    levelCap, special, waigong, neigong, baseAtk: tier.baseAtk,
  };
  // npc.signatureMoves：OC 冒险者从 kungfu.moves 折好的专属槽（ocRecruit.ocSignatureMoves）
  const moveset = npc.signatureMoves
    ? deriveMovesetFromSig(npcShape, npc.signatureMoves, { levelCap })
    : deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: false,
    profile: IMPORTED_COMPANION_PROFILE,
    moveset,
    brief: npc.brief || npc.name,
    equipAtk: 0, equipDef: 0,
    combatStats: { hp: [maxHp, maxHp], energy: [10, 10], statusSlots: createEmptyStatusSlots() },
  };
}

// 邀请导入 NPC 入队（幂等）。一入队顶上出战位，其余伙伴自动留守（单槽互斥）。
export function unlockImportedCompanion(companionState, npc) {
  if (!npc?.name) return companionState;
  const key = importedCompanionKey(npc.name);
  const cur = companionState?.[key];
  if (cur?.unlocked && cur?.data) return companionState;
  const next = {
    ...companionState,
    [key]: { unlocked: true, active: true, data: createImportedCompanion(npc), imported: true, label: npc.name, beast: false },
  };
  for (const k of allCompanionKeys(next)) {
    if (k !== key && next[k]) next[k] = { ...next[k], active: false };
  }
  return next;
}

// companionState 里所有有意义的槽位 key：内置四个 + 运行时动态挂上的导入伙伴。
function allCompanionKeys(companionState) {
  const keys = COMPANION_SLOTS.map(s => s.key);
  for (const k of Object.keys(companionState || {})) if (!keys.includes(k)) keys.push(k);
  return keys;
}

// 槽位元信息（label/beast）：内置的从 COMPANION_SLOTS 取，导入的从 state 条目自身取。
function companionMeta(companionState, key) {
  const fixed = COMPANION_SLOTS.find(s => s.key === key);
  if (fixed) return fixed;
  const c = companionState?.[key];
  return { key, label: c?.label || c?.data?.name || key, beast: !!c?.beast };
}

// 当前出战的是谁（没有则 null）。单一真值来源，UI 与战斗都读它。
export function activeCompanionKey(companionState) {
  for (const key of allCompanionKeys(companionState)) {
    const c = companionState?.[key];
    if (c?.unlocked && c?.active && c?.data) return key;
  }
  return null;
}

export function activeCompanion(companionState) {
  const k = activeCompanionKey(companionState);
  if (!k) return null;
  const meta = companionMeta(companionState, k);
  return { key: k, label: meta.label, beast: meta.beast, ...companionState[k] };
}

// 切磋时并肩上场的队友：对手正是出战伙伴本人（偷它被抓、跟它切磋）时打 1v1，不拉它进 2v2。
export function duelAlly(companionState, foe) {
  const comp = activeCompanion(companionState);
  if (!comp?.data) return null;
  if (foe && (foe.name === comp.label || foe.name === comp.data.name || (foe.id && foe.id === comp.data.id))) return null;
  return comp;
}

// 已解锁的候选（供 UI 列出可切换的队友）。返回 {key,label,beast}，形状同 COMPANION_SLOTS。
export function unlockedCompanions(companionState) {
  return allCompanionKeys(companionState)
    .filter(k => companionState?.[k]?.unlocked && companionState?.[k]?.data)
    .map(k => companionMeta(companionState, k));
}

// 按 NPC 名字查它对应的伙伴槽位（雪豹/珍珠/明日香），不是伙伴候选返回 null。
export function companionKeyByName(name) {
  const s = COMPANION_SLOTS.find(x => x.label === name);
  return s ? s.key : null;
}

// 某个具名伙伴候选是否已解锁（供 NpcActionMenu 判断"邀请入队"按钮要不要收起）。
export function isCompanionUnlockedByName(companionState, name) {
  const key = companionKeyByName(name);
  if (key && companionState?.[key]?.unlocked && companionState?.[key]?.data) return true;
  // 导入伙伴：按 imported_<名字> 查
  const ik = importedCompanionKey(name);
  return !!(companionState?.[ik]?.unlocked && companionState?.[ik]?.data);
}

// 换出战队友：把目标置 active，其余一律置 false（互斥）。
// key 传 null 表示谁都不带。
export function setActiveCompanion(companionState, key) {
  const next = { ...companionState };
  for (const k of allCompanionKeys(next)) {
    if (!next[k]) continue;
    next[k] = { ...next[k], active: k === key };
  }
  return next;
}

// ── 留守（docs/设计_OC入队与留守.md 三节）─────────────────────────────
// 条目加 stationed: null | {district, roomId, roomName}。null=随行跟队注入上下文；
// 有值=留在指定房间、落进该房间 npcs 可被对话唤回。active 出战队友不设留守——
// 出战位只有一个，留守 active 等于出站位空转，调用方先 setActiveCompanion 换人。
export function stationCompanion(companionState, key, spot = {}) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data || c.active) return companionState;
  return { ...companionState, [key]: { ...c, stationed: { district: spot.district || null, roomId: spot.roomId || null, roomName: spot.roomName || null } } };
}

// 「跟上我」唤回：清 stationed，回随行队列。
export function unstationCompanion(companionState, key) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data || !c.stationed) return companionState;
  const next = { ...c };
  delete next.stationed;
  return { ...companionState, [key]: next };
}

// 全部留守队友清单（上下文注入「谁在哪个房间等你」用）：[{key,label,stationed}]
export function stationedCompanions(companionState) {
  return allCompanionKeys(companionState)
    .filter(k => companionState?.[k]?.unlocked && companionState?.[k]?.data && companionState[k].stationed)
    .map(k => ({ key: k, label: companionMeta(companionState, k).label, stationed: companionState[k].stationed }));
}

// 某房间里的留守队友，折成 room.npcs 条目形状——在该房间可被对话唤回。
export function stationedNpcsFor(companionState, { district, roomId, roomName } = {}) {
  return stationedCompanions(companionState)
    .filter(c => c.stationed?.roomId === roomId || (roomName && c.stationed?.roomName === roomName && c.stationed?.district === district))
    .map(c => {
      const d = companionState[c.key].data;
      return { name: c.label, id: c.key, companion: true, stationed: true, beast: !!companionState[c.key].beast, brief: d?.brief || c.label, levelCap: d?.levelCap };
    });
}

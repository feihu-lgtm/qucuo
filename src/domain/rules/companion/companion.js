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
import { findAdventurerByName } from "../follower/followers.js";
import { ocSignatureMoves } from "./ocKungfu.js";
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
// 【为什么单槽互斥】出战位 = 玩家可手动选招/换人的那一位；同一主仆组的随从（朵朵+铁伯）
// 不占出战位，但会随出战的主人一并上场、恒托管（见 duelAllies）。
// 具名伙伴（雪豹/珍珠/墨团/明日香）+ 玩家入册导入的 NPC 共用这唯一一个出战位——
// 谁上场谁 active，其余一律随行不出手。COMPANION_SLOTS 只登记内置的具名伙伴；导入的
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

// OC 入队伙伴的招式版本戳：kungfu.moves 分槽规则（ocKungfu）改版时 +1，读档迁移据此重建招式。
// 旧档（按"第N招进第N槽"硬塞的）没有这个戳，会被迁移重建一次。
export const OC_MOVES_REV = 2;

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
    ...(npc.signatureMoves ? { ocMovesRev: OC_MOVES_REV } : {}),
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

// ── 随从伙伴（元朵朵的铁伯）──────────────────────────────────────────
// OC 的 follower 带 joinParty 预设时，主人入队后随从作为独立伙伴槽一并入队：
//   key=imported_<随从名>，servantOf=主人槽 key，mute=true（机关人偶无通灵、不开口，
//   只在随行插话里出机括声），active:false（出战位仍是主人，玩家想让他当盾可在队伍里换上）。
// 为什么不改 2v2 引擎：团战只有「玩家+1 队友」两个己方位，铁伯跟朵朵并排上不了场。
// 朵朵出战时，铁伯的"护主"已折进她的抱头蹲防（见其招式描述）；想让铁伯真身上阵就换他出战。
// 留守/唤回见下方 bondGroup：主仆同进同出。
const FOLLOWER_PRESETS = {
  // 坦克：体魄高、身法慢，防御权重压过攻击，不冒进
  tank: {
    profile: { moveWeights: { 攻击: 0.3, 防御: 0.5, 状态: 0.2 }, riskAppetite: 0.25, avoidRepeat: 0.2 },
    personality: "沉默寡言的机关老仆，无通灵只按宠溺回路行动，一心护主",
    sig: {
      攻击: { archetype: "硬攻", name: "铁臂横扫", desc: "精铁四肢抡开一记横扫，机括咔哒作响，沉而不快，挨上的人只觉像撞了堵铁墙。" },
      防御: { archetype: "防守反击", name: "精钢盾甲", desc: "四肢精钢盾甲层层展开，把主人护在身后，来力顺着甲面滑开，再顺势一拳砸回去。" },
      状态: { archetype: "蓄势", name: "上紧发条", desc: "肚膛里的发条咯吱上紧，下一击更沉。" },
      回气: { name: "炉心微热", desc: "肚膛里的暖炉添了块炭，机括声渐渐匀称。" },
    },
  },
};

// 随从战斗数据：比主人高一档（全靠它硬抗），体魄大幅拉高、身法拉低、悟性压低。
// 一次性生成后固化进存档，跟其余伙伴同一个"出生固化"哲学。
export function createFollowerCompanion(owner) {
  const f = owner.follower;
  const preset = FOLLOWER_PRESETS[f.joinParty];
  const levelCap = Math.min(5, (Number.isFinite(owner.levelCap) ? owner.levelCap : 1) + 1);
  const special = generateNpcAttributes({ levelCap });
  special.体魄 = Math.min(10, special.体魄 + 3);
  special.身法 = Math.max(1, special.身法 - 2);
  special.悟性 = Math.max(1, special.悟性 - 2);
  const tier = getTierPower(levelCap);
  const maxHp = hpFromNeigong(tier.neigong, special.体魄);
  const npcShape = {
    name: f.name, id: importedCompanionKey(f.name),
    levelCap, special, waigong: tier.waigong, neigong: tier.neigong, baseAtk: tier.baseAtk,
  };
  return {
    ...npcShape,
    beast: false,
    profile: preset.profile,
    moveset: deriveMovesetFromSig(npcShape, preset.sig, { levelCap }),
    brief: f.desc || f.name,
    personality: preset.personality,
    equipAtk: 0, equipDef: 0,
    combatStats: { hp: [maxHp, maxHp], energy: [10, 10], statusSlots: createEmptyStatusSlots() },
  };
}

// 主人入队后挂上随从槽（幂等；主人没入队/没配 joinParty 原样返回；不抢出战位）
export function unlockFollowerCompanion(companionState, owner) {
  const f = owner?.follower;
  if (!f?.name || !FOLLOWER_PRESETS[f.joinParty]) return companionState;
  const ownerKey = importedCompanionKey(owner.name);
  if (!companionState?.[ownerKey]?.unlocked) return companionState;
  const key = importedCompanionKey(f.name);
  if (companionState[key]?.unlocked && companionState[key]?.data) return companionState;
  return {
    ...companionState,
    [key]: { unlocked: true, active: false, data: createFollowerCompanion(owner), imported: true, label: f.name, beast: false, mute: true, servantOf: ownerKey },
  };
}

// 读档迁移（挂在 legacyContent.migrateLegacySnapshot 里，幂等，反复跑结果不变）：
//  ① 已入队的 OC 伙伴招式没有当前版本戳 → 按 kungfu.moves 重建（元朵朵：漫天花雨/抱头蹲防）。
//     伙伴 data.moveset 在战斗外没有任何写回（成长招式只在战斗内的 movesetLocal 拷贝里累积，
//     不回写伙伴数据），所以重建不会丢任何成长。
//  ② OC 的随从带 joinParty、主人已入队而随从槽缺失 → 补建随从槽，留守状态跟主人一致。
// 没变化时原样返回同一引用。
export function migrateCompanionState(companionState) {
  if (!companionState || typeof companionState !== "object") return companionState;
  let next = companionState;
  for (const [key, entry] of Object.entries(companionState)) {
    if (!entry?.imported || !entry.unlocked || !entry.data || entry.servantOf) continue;
    const adv = findAdventurerByName(entry.label || entry.data.name);
    if (!adv) continue;
    const sig = ocSignatureMoves(adv);
    const d = entry.data;
    if (sig && d.ocMovesRev !== OC_MOVES_REV) {
      const shape = { name: d.name, id: d.id, levelCap: d.levelCap, special: d.special, waigong: d.waigong, neigong: d.neigong, baseAtk: d.baseAtk };
      next = { ...next, [key]: { ...next[key], data: { ...d, moveset: deriveMovesetFromSig(shape, sig, { levelCap: d.levelCap }), ocMovesRev: OC_MOVES_REV } } };
    }
    const withServant = unlockFollowerCompanion(next, adv);
    if (withServant !== next) {
      const servantKey = importedCompanionKey(adv.follower.name);
      const stationed = next[key].stationed;
      next = stationed
        ? { ...withServant, [servantKey]: { ...withServant[servantKey], stationed: { ...stationed } } }
        : withServant;
    }
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
export function companionMeta(companionState, key) {
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

// 切磋时并肩上场的出战队友：对手正是出战伙伴本人（偷它被抓、跟它切磋）时打 1v1，不拉它进团战。
function isCompanionFoe(comp, foe) {
  return !!foe && (foe.name === comp.label || foe.name === comp.data?.name || (foe.id && foe.id === comp.data?.id));
}
export function duelAlly(companionState, foe) {
  const comp = activeCompanion(companionState);
  if (!comp?.data) return null;
  if (isCompanionFoe(comp, foe)) return null;
  return comp;
}

// 己方上场名单：出战伙伴打头，同一主仆组里随行（没留守）的另一方一并上场——
// 朵朵出战，铁伯也打；对手若是组里的某人，那人不拉进己方。团战引擎的单位数组不限人数，
// 第二位起的伙伴在 TeamDuelScreen 里恒托管。
export function duelAllies(companionState, foe) {
  const lead = duelAlly(companionState, foe);
  if (!lead) return [];
  const mates = bondGroup(companionState, lead.key)
    .filter(k => k !== lead.key && companionState[k]?.unlocked && companionState[k]?.data && !companionState[k].stationed)
    .map(k => ({ key: k, label: companionMeta(companionState, k).label, beast: !!companionState[k].beast, ...companionState[k] }))
    .filter(c => !isCompanionFoe(c, foe));
  return [lead, ...mates];
}

// 敌方随从：对手是带 joinParty 随从的 OC（元朵朵→铁伯）且玩家还没把她/随从收进队，
// 随从陪在她身边一起迎战，返回 buildEnemyUnit 能直接用的 npc 形状；否则 null。
// 随从数据与入队时同一份生成器（createFollowerCompanion），打赢不单独掉落（掉落只 roll 主敌）。
export function duelFoeFollower(companionState, foe) {
  const owner = foe?.name ? findAdventurerByName(foe.name) : null;
  const f = owner?.follower;
  if (!f?.name || !FOLLOWER_PRESETS[f.joinParty]) return null;
  if (companionState?.[importedCompanionKey(owner.name)]?.unlocked || companionState?.[importedCompanionKey(f.name)]?.unlocked) return null;
  const data = createFollowerCompanion(owner);
  return { ...data, id: `foe_${f.name}`, personalityProfile: data.profile, follower: true };
}

// 切磋阵容：1v1 还是团战由这里统一裁决。有己方伙伴或对方带随从就走团战
// （玩家无伙伴时单挑 朵朵+铁伯 也走团战，引擎按单位数组结算，不要求己方成对）。
export function duelLineup(companionState, foe) {
  const allies = duelAllies(companionState, foe);
  const follower = duelFoeFollower(companionState, foe);
  return { allies, enemies: follower ? [foe, follower] : [foe], team: allies.length > 0 || !!follower };
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
// 主仆同进同出：随从（servantOf）不单独留守/唤回——留守任一方即整组（主人+随从）留下；
// 组里有人在出战位就整组拒绝（先换人）。无主仆关系的伙伴组就是自己一个，行为同旧版。
function bondGroup(companionState, key) {
  const root = companionState?.[key]?.servantOf || key;
  return allCompanionKeys(companionState).filter(k => k === root || companionState?.[k]?.servantOf === root);
}

export function stationCompanion(companionState, key, spot = {}) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data) return companionState;
  const group = bondGroup(companionState, key).filter(k => companionState[k]?.unlocked && companionState[k]?.data);
  if (group.some(k => companionState[k].active)) return companionState;
  // since 记留守起点（state.time），供重逢台词算"被丢了多久"
  const stationed = { district: spot.district || null, roomId: spot.roomId || null, roomName: spot.roomName || null, since: spot.since ?? null };
  const next = { ...companionState };
  for (const k of group) next[k] = { ...next[k], stationed: { ...stationed } };
  return next;
}

// 「跟上我」唤回：清 stationed，回随行队列（主仆整组一起回）。
export function unstationCompanion(companionState, key) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data || !c.stationed) return companionState;
  const next = { ...companionState };
  for (const k of bondGroup(companionState, key)) {
    if (!next[k]?.stationed) continue;
    const entry = { ...next[k] };
    delete entry.stationed;
    next[k] = entry;
  }
  return next;
}

// 全部留守队友清单（上下文注入「谁在哪个房间等你」用）：[{key,label,stationed}]
export function stationedCompanions(companionState) {
  return allCompanionKeys(companionState)
    .filter(k => companionState?.[k]?.unlocked && companionState?.[k]?.data && companionState[k].stationed)
    .map(k => ({ key: k, label: companionMeta(companionState, k).label, stationed: companionState[k].stationed }));
}

// 伙伴槽折成 room.npcs 条目形状（左栏名单、动作菜单、切磋都直接拿这份）。
// 战斗数据（moveset/combatStats/七维…）整份带上：从名单点「切磋」时这份条目就是对手，
// buildEnemyUnit/DuelScreen 读 moveset 选招，缺了第一回合就卡死。
// id 用槽位键（唤回「跟上我」按它找槽），托管性格按敌方口径挂 personalityProfile。
export function companionNpcEntry(companionState, key, extra = {}) {
  const c = companionState?.[key];
  const d = c?.data || {};
  const meta = companionMeta(companionState, key);
  return {
    ...d, personalityProfile: d.profile,
    name: meta.label, id: key, companion: true, beast: !!(meta.beast || c?.beast), brief: d.brief || meta.label, levelCap: d.levelCap,
    ...extra,
  };
}

// 某房间里的留守队友，折成 room.npcs 条目形状——在该房间可被对话唤回。
export function stationedNpcsFor(companionState, { district, roomId, roomName } = {}) {
  return stationedCompanions(companionState)
    // 两个条件都带 district 约束——不同据点可有同名内层房（喇嘛庙·山门 vs 雪山派·山门），
    // 只比房名会把队友显到别的山头去。
    .filter(c => c.stationed?.district === district && (c.stationed?.roomId === roomId || (roomName && c.stationed?.roomName === roomName)))
    .map(c => companionNpcEntry(companionState, c.key, { stationed: true }));
}

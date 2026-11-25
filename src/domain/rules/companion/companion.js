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
import { findAdventurerByName, isSharedFollowerName } from "../follower/followers.js";
import { ocSignatureMoves } from "./ocKungfu.js";
import { deriveMovesetFromSig, generateNpcMoveset } from "../npc/npcMovesets.js";
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

// ── 随从伙伴：77 位 OC 冒险者每人带一个随从（元朵朵的铁伯、史燕的阿财……）──────────
// 主人入队时随从作为独立伙伴槽一并入队——是两个人：各自能换上出战位、各自留守/唤回，
// 切磋只带出战位那一个上场；随行插话两个人都会开口（哑的出机括声/兽声）。
//   key=imported_<随从名>（随从重名时带主人名，见 followerKey），servantOf=主人槽 key（只记归属），
//   active:false（出战位仍是主人）。
// 战斗性格与开口方式按随从类型定；铁伯（joinParty: tank）另有手写的专属招式。
const FOLLOWER_TYPE_PRESETS = {
  兽: {
    profile: { moveWeights: { 攻击: 0.55, 防御: 0.2, 状态: 0.25 }, riskAppetite: 0.6, avoidRepeat: 0.3 },
    personality: "通人性的灵兽，不会说人话，靠叫声、动作和眼神表达",
    beast: true,
  },
  人: {
    profile: IMPORTED_COMPANION_PROFILE,
    personality: "跟随主人多年的随从，护主心切",
  },
  剑灵: {
    profile: { moveWeights: { 攻击: 0.4, 防御: 0.2, 状态: 0.4 }, riskAppetite: 0.5, avoidRepeat: 0.5 },
    personality: "寄身器物的灵体，言语飘忽，只认主人",
  },
  机关人偶: {
    profile: { moveWeights: { 攻击: 0.35, 防御: 0.45, 状态: 0.2 }, riskAppetite: 0.3, avoidRepeat: 0.2 },
    personality: "无通灵的机关造物，只按机括回路行动",
    mute: true,
  },
};
const FOLLOWER_PRESETS = {
  // 坦克（铁伯）：比主人高一档，体魄高、身法慢，防御权重压过攻击，不冒进
  tank: {
    profile: { moveWeights: { 攻击: 0.3, 防御: 0.5, 状态: 0.2 }, riskAppetite: 0.25, avoidRepeat: 0.2 },
    personality: "沉默寡言的机关老仆，无通灵只按宠溺回路行动，一心护主",
    levelBonus: 1,
    statTweak: { 体魄: 3, 身法: -2, 悟性: -2 },
    sig: {
      攻击: { archetype: "硬攻", name: "铁臂横扫", desc: "精铁四肢抡开一记横扫，机括咔哒作响，沉而不快，挨上的人只觉像撞了堵铁墙。" },
      防御: { archetype: "防守反击", name: "精钢盾甲", desc: "四肢精钢盾甲层层展开，把主人护在身后，来力顺着甲面滑开，再顺势一拳砸回去。" },
      状态: { archetype: "蓄势", name: "上紧发条", desc: "肚膛里的发条咯吱上紧，下一击更沉。" },
      回气: { name: "炉心微热", desc: "肚膛里的暖炉添了块炭，机括声渐渐匀称。" },
    },
  },
};

// 哑巴随从：机关人偶一律不开口（机括声）；人类随从卡上写明哑巴/口不能言的（铁牛、哑奴、抱剑童子……）
// 也不开口，只比划；灵兽只出声。voice 存进槽位，随行插话按它选说法。
function followerPreset(f) {
  const base = FOLLOWER_TYPE_PRESETS[f.type] || FOLLOWER_TYPE_PRESETS.人;
  const own = FOLLOWER_PRESETS[f.joinParty] || {};
  const muteHuman = f.type === "人" && /哑|口不能言/.test(`${f.name}${f.desc || ""}`);
  const mute = !!(base.mute || own.mute || muteHuman);
  const voice = base.beast ? "beast" : base.mute || own.mute ? "mechanical" : muteHuman ? "silent" : "human";
  return { ...base, ...own, mute, beast: !!base.beast, voice };
}

// 随从重名（素商、仙音各有一只「青鸟」）时带主人名（「素商的青鸟」）：槽位 key、名单上的名字、
// 好感等按名字记的关系都分开，两只鸟互不串账。
function followerName(owner) {
  const f = owner.follower;
  return isSharedFollowerName(f.name) ? `${owner.name}的${f.name}` : f.name;
}
function followerKey(owner) {
  return importedCompanionKey(followerName(owner));
}

// 随从战斗数据：与主人同档（铁伯高一档），一次性生成后固化进存档，跟其余伙伴同一个"出生固化"哲学。
export function createFollowerCompanion(owner) {
  const f = owner.follower;
  const preset = followerPreset(f);
  const levelCap = Math.min(5, (Number.isFinite(owner.levelCap) ? owner.levelCap : 1) + (preset.levelBonus || 0));
  const special = generateNpcAttributes({ levelCap });
  for (const [stat, delta] of Object.entries(preset.statTweak || {})) {
    special[stat] = Math.max(1, Math.min(10, (special[stat] ?? 5) + delta));
  }
  const tier = getTierPower(levelCap);
  const maxHp = hpFromNeigong(tier.neigong, special.体魄);
  const npcShape = {
    name: followerName(owner), id: followerKey(owner),
    levelCap, special, waigong: tier.waigong, neigong: tier.neigong, baseAtk: tier.baseAtk,
  };
  return {
    ...npcShape,
    beast: preset.beast,
    profile: preset.profile,
    // 只有手写了专属招式的随从（铁伯）走专属表，其余按品阶出通用招式
    moveset: preset.sig ? deriveMovesetFromSig(npcShape, preset.sig, { levelCap }) : generateNpcMoveset(npcShape, { levelCap }),
    brief: f.desc || f.name,
    personality: preset.personality,
    equipAtk: 0, equipDef: 0,
    combatStats: { hp: [maxHp, maxHp], energy: [10, 10], statusSlots: createEmptyStatusSlots() },
  };
}

// 主人入队后挂上随从槽（幂等；主人没入队/没有随从原样返回；不抢出战位）
export function unlockFollowerCompanion(companionState, owner) {
  const f = owner?.follower;
  if (!f?.name) return companionState;
  const ownerKey = importedCompanionKey(owner.name);
  if (!companionState?.[ownerKey]?.unlocked) return companionState;
  const key = followerKey(owner);
  if (companionState[key]?.unlocked && companionState[key]?.data) return companionState;
  const preset = followerPreset(f);
  return {
    ...companionState,
    [key]: {
      unlocked: true, active: false, data: createFollowerCompanion(owner), imported: true,
      label: followerName(owner), beast: preset.beast, mute: preset.mute, voice: preset.voice,
      cannotSpeak: preset.mute || preset.beast, servantOf: ownerKey,
    },
  };
}

// 读档迁移（挂在 legacyContent.migrateLegacySnapshot 里，幂等，反复跑结果不变）：
//  ① 已入队的 OC 伙伴招式没有当前版本戳 → 按 kungfu.moves 重建（元朵朵：漫天花雨/抱头蹲防）。
//     伙伴 data.moveset 在战斗外没有任何写回（成长招式只在战斗内的 movesetLocal 拷贝里累积，
//     不回写伙伴数据），所以重建不会丢任何成长。
//  ② OC 主人已入队而随从槽缺失（旧档只给铁伯建过槽）→ 补建随从槽；主人当时留守在哪，随从就在哪。
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
      const servantKey = followerKey(adv);
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

// 切磋只带出战位那一个上场：主人和随从是两个人，谁在出战位谁上，另一个不跟着下场。
export function duelAllies(companionState, foe) {
  const lead = duelAlly(companionState, foe);
  return lead ? [lead] : [];
}

// 切磋阵容：1v1 还是团战由这里统一裁决。己方有出战伙伴走团战（玩家+出战伙伴 vs 对手），
// 玩家独自上阵打 1v1（DuelScreen，保住战斗道具栏）。对手的随从不跟着下场。
export function duelLineup(companionState, foe) {
  const allies = duelAllies(companionState, foe);
  return { allies, enemies: [foe], team: allies.length > 0 };
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
// 留守在别处的队友不在这里接回：switchCompanion 先拒绝，人得当面唤回（有重逢那一幕）才能上场。
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
// 主人和随从是两个人，各自留守、各自唤回；servantOf 只记归属，不把两人绑成一组。
export function stationCompanion(companionState, key, spot = {}) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data || c.active) return companionState;
  // since 记留守起点（state.time），供重逢台词算"被丢了多久"
  const stationed = { district: spot.district || null, roomId: spot.roomId || null, roomName: spot.roomName || null, since: spot.since ?? null };
  return { ...companionState, [key]: { ...c, stationed } };
}

// 「跟上我」唤回：清 stationed，回随行队列。
export function unstationCompanion(companionState, key) {
  const c = companionState?.[key];
  if (!c?.unlocked || !c?.data || !c.stationed) return companionState;
  const entry = { ...c };
  delete entry.stationed;
  return { ...companionState, [key]: entry };
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
// 不会说话的队友（机关人偶、哑巴随从 mute；随从灵兽 cannotSpeak）折成 cannotSpeak：点「交谈」走不通人言的分支。
export function companionNpcEntry(companionState, key, extra = {}) {
  const c = companionState?.[key];
  const d = c?.data || {};
  const meta = companionMeta(companionState, key);
  return {
    ...d, personalityProfile: d.profile,
    name: meta.label, id: key, companion: true, beast: !!(meta.beast || c?.beast), brief: d.brief || meta.label, levelCap: d.levelCap,
    ...(c?.mute || c?.cannotSpeak ? { cannotSpeak: true } : {}),
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

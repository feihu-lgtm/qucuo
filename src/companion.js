// 伙伴系统（雪豹）
// ============================================================================
// 曲措乡第一个"动物伙伴/队友"角色——村口卧守、命定只认玩家的无主灵兽，
// 蓝档，可随玩家出战，在切磋里以2v2("玩家+雪豹" vs "1~2个对手")的形态
// 并肩作战。它不属于嘎则或任何人，自雪线之上而来，只与玩家结下羁绊；
// 与玩家情深之后（好感≥60）能化为人形女子，详见 residentNpcs 雪豹设定与
// roundNotes 里按好感注入的二形态人设。
//
// 【设计原则，跟项目一贯的"系统裁决"一致】
// - 雪豹是固定的具名角色，不是随机生成的路人——七维/招式一次性生成后写死，
//   不会每次战斗都不一样（跟 npcGeneration.js"出生固化"同一个哲学）。
// - 战力走统一战力曲线（atkFromWaigong/hpFromNeigong），蓝档(levelCap=2)，
//   跟任何其他蓝档NPC同一把尺子，不特殊优待也不特殊削弱。
// - 招式走"雪隐三绝"专属表（见 npcSignatureMoves.js 的"雪豹"条目），原型套
//   硬攻/防守反击/蓄势，风味文本保留"隐身/闪避"的设定描述，机制上是减伤/蓄力
//   ——跟白猿、桑杰朵杰等具名角色的"原型套壳"处理方式完全一致，不新增
//   战斗引擎维度。
// - 托管AI决策=纯野兽本能：不特意配合玩家战术，走高攻击权重/高风险的
//   固定性格档案，不需要LLM生成（不像人类NPC那样由AI起草性格再固化）。
// ============================================================================

import { generateNpcAttributes, getTierPower, atkFromWaigong, hpFromNeigong, deriveSignatureMoveset } from "./npcGeneration.js";
import { createEmptyStatusSlots } from "./combat/statusEffects.js";

export const SNOW_LEOPARD_LEVEL_CAP = 2; // 蓝档——比入门功夫精深，未到镇派绝学

// 雪豹的固定性格档案："纯野兽本能"——高攻击权重、高风险偏好，不特意配合玩家
// 选的招式或目标。跟人类NPC的profile（由AI起草+固化）不同，这份是纯手写常量，
// 因为它就该是"一头野兽"，不需要"人格"。
export const SNOW_LEOPARD_PROFILE = {
  moveWeights: { 攻击: 0.55, 防御: 0.2, 状态: 0.25 },
  riskAppetite: 0.75,   // 高风险偏好：本能驱使的猛兽，不惜力
  avoidRepeat: 0.15,    // 很低：野兽没有"怕被看穿套路"这种心机，遇强则强、连续扑咬很正常
};

// 生成雪豹的固定七维+战斗数值+招式。只应在"雪豹第一次真正加入玩家"时调用一次，
// 结果需要由调用方（MudRPG.jsx）持久化进存档，之后每次读取同一份，不重新生成
// ——否则雪豹会变成"每次切磋数值都不一样"，违背出生固化原则。
export function createSnowLeopard() {
  const levelCap = SNOW_LEOPARD_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  // 雪豹身法/体魄拉高一截、悟性拉低——猛兽敏捷有力但不擅悟道，比随机基准更贴角色。
  special.身法 = Math.min(10, special.身法 + 2);
  special.体魄 = Math.min(10, special.体魄 + 1);
  special.悟性 = Math.max(1, special.悟性 - 2);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);

  const npcShape = { name: "雪豹", id: "companion_snow_leopard", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: true,        // 兽类标记（走兽性招名/立绘/不可对话等）。注：自2026-07-26起 beast 不再等同"武学不可学"，拜师/偷师已对野兽放开。
    profile: SNOW_LEOPARD_PROFILE, // 战斗性格随数据固化，buildLeopardUnit 读它（不再写死）
    moveset,
    equipAtk: 0, equipDef: 0, // 雪豹不能穿装备，恒为0（不接入equipment.js的穿戴系统）
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  };
}

// ── 入队状态 ──────────────────────────────────────────────────────────
// companionState 挂在存档顶层（跟 char/inv/skills 平级），结构：
//   { snowLeopard: { unlocked: bool, active: bool, data: <createSnowLeopard()的结果> } }
// unlocked：雪豹是否已经被玩家"结识/收服"过（剧情解锁，一旦为真永久为真）
// active：当前是否带在身边参战（玩家可以让雪豹"留守"某处，不强制每场战斗都带它）
// data：雪豹固化后的数值+招式，解锁时生成一次，之后只读不重新生成
export function initCompanionState() {
  return {
    snowLeopard: { unlocked: false, active: false, data: null },
    pearl: { unlocked: false, active: false, data: null },
  };
}

// 解锁雪豹（剧情触发，比如玩家跟格桑的雪豹培养出感情后）：若已解锁则不重复生成
// （幂等，防止某个剧情节点被多次触发时把雪豹的数值重新随机一遍）。
export function unlockSnowLeopard(companionState) {
  const cur = companionState?.snowLeopard;
  if (cur?.unlocked && cur?.data) return companionState; // 已解锁，数据已存在，不动
  return {
    ...companionState,
    snowLeopard: { unlocked: true, active: true, data: createSnowLeopard() },
  };
}

export function setSnowLeopardActive(companionState, active) {
  if (!companionState?.snowLeopard?.unlocked) return companionState; // 未解锁不能设置出战
  return { ...companionState, snowLeopard: { ...companionState.snowLeopard, active: !!active } };
}

// 供 MudRPG.jsx 判断"这场切磋要不要带雪豹"：已解锁 + 当前设为出战 + 雪豹自己没有
// 在别的地方处于"倒地不能战"的持久状态（目前不做持久伤势，每场战斗独立结算，
// 雪豹的hp只在单场战斗内变化，不带伤跨场——跟玩家角色的hp在切磋外自然恢复
// 是同一套简化处理，避免"雪豹被打残后再也不能用"这种需要额外疗伤流程的复杂度）。
export function isSnowLeopardAvailable(companionState) {
  return !!(companionState?.snowLeopard?.unlocked && companionState?.snowLeopard?.active && companionState?.snowLeopard?.data);
}

// ── 小马珍珠入队（开局村口·坐骑）──────────────────────────────────────
// 珍珠是一匹通体雪白、长相颇具反差萌的小白马——本名"哈瓦夏日"（藏语"灰色的梅花鹿"），
// 睫毛长长，丰神俊朗，却志不在驰骋，平生两大爱好：专心干饭、就地躺平。可一旦认主，
// 忠心无二，脚力强健，关键时刻撒开四蹄快如白影。蓝档(levelCap=2)，坐骑定位：
// 比雪豹更皮实（体魄高）、更能护主（防御权重高），不冒进。
export const PEARL_LEVEL_CAP = 2; // 蓝档

// 珍珠的战斗性格：坐骑护主，皮实稳健，不冒进——防御权重比雪豹高，风险偏好低。
// 平时懒洋洋（干饭躺平），护主时才见真章，故 avoidRepeat 略高于雪豹（会换着法子护主）。
export const PEARL_PROFILE = {
  moveWeights: { 攻击: 0.4, 防御: 0.35, 状态: 0.25 },
  riskAppetite: 0.5,
  avoidRepeat: 0.25,
};

export function createPearl() {
  const levelCap = PEARL_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  // 体魄拉高（皮实耐驮）、身法略抬（脚力强健），悟性拉低——它满脑子只有干饭和躺平。
  special.体魄 = Math.min(10, special.体魄 + 2);
  special.身法 = Math.min(10, special.身法 + 1);
  special.悟性 = Math.max(1, special.悟性 - 2);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);

  const npcShape = { name: "珍珠", id: "companion_pearl", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: true,
    profile: PEARL_PROFILE, // 坐骑护主：皮实稳健、不冒进，buildLeopardUnit 读它
    moveset,
    equipAtk: 0, equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  };
}

// 解锁珍珠（村口邀它同行时调用，幂等）。它一入队就顶了出战位——其余伙伴自动留守，
// 玩家之后可以随时换（setActiveCompanion）。
export function unlockPearl(companionState) {
  const cur = companionState?.pearl;
  if (cur?.unlocked && cur?.data) return companionState;
  const next = {
    ...companionState,
    pearl: { unlocked: true, active: true, data: createPearl() },
  };
  for (const s of COMPANION_SLOTS) {
    if (s.key !== "pearl" && next[s.key]) next[s.key] = { ...next[s.key], active: false };
  }
  return next;
}

export function isPearlAvailable(companionState) {
  return !!(companionState?.pearl?.unlocked && companionState?.pearl?.active && companionState?.pearl?.data);
}

// ── 明日香入队（终章走完解锁）─────────────────────────────────────────
// 【与雪豹的差别】雪豹是兽：不穿装备、招式走兽性、不能对话。
// 明日香是人，红档，用枪，能说话——所以她的数值走人类档的常规生成，
// 不套雪豹那份"纯野兽本能"的 profile。
export const ASUKA_LEVEL_CAP = 5; // 红档

// 她的战斗性格：高攻高风险、几乎不防御，且**极不愿重复同一招**——
// "被人看穿套路"对她是不能忍的事，这条比雪豹高得多（雪豹 0.15，她 0.7）。
export const ASUKA_PROFILE = {
  moveWeights: { 攻击: 0.6, 防御: 0.1, 状态: 0.3 },
  riskAppetite: 0.85,
  avoidRepeat: 0.7,
};

export function createAsuka() {
  const levelCap = ASUKA_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  // 身法/气运拉高（她是那种赌一把也要赢的人），体魄略低——她不是靠硬扛的打法
  special.身法 = Math.min(10, special.身法 + 2);
  special.气运 = Math.min(10, special.气运 + 1);
  special.体魄 = Math.max(1, special.体魄 - 1);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);

  const npcShape = { name: "明日香", id: "companion_asuka", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: false,
    moveset,
    brief: "红衣长枪的女侠，自称本女侠",
    // carry 会经 buildPresence → visibleNpcsForAI → ctx 的〔身携:…〕喂给 AI，
    // 让她在叙事里是个"身上有东西的人"而不是一串数值。
    // 这几件都有来处：枪与发带是真容立绘上就有的；经轮是藏地这一路留下的；
    // 布偶猴子是从心灵之海那栋白房子的床头带出来的——她自己没解释过为什么要带。
    carry: [
      { name: "朗基努斯", category: "weapon", quality: "红" },
      { name: "红缎发带", category: "accessory", quality: "蓝" },
      { name: "藏银经轮", category: "accessory", quality: "紫" },
      { name: "布偶猴子", category: "misc", quality: "白" },
      { name: "没有标签的药瓶", category: "misc", quality: "蓝" },
      { name: "半块酥油曲奇", category: "misc", quality: "绿" },
    ],
    // 她能穿装备，但入队时先给 0——装备系统目前只服务玩家本人，
    // 队友穿戴要接一整套 UI，不在本轮范围。留字段是为了将来接得上。
    equipAtk: 0, equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  };
}

// 解锁明日香（终章走完时调用，幂等）
export function unlockAsuka(companionState) {
  const cur = companionState?.asuka;
  if (cur?.unlocked && cur?.data) return companionState;
  return {
    ...companionState,
    asuka: { unlocked: true, active: true, data: createAsuka() },
    // 她一入队就顶了出战位——雪豹自动留守。玩家之后可以随时换回去。
    snowLeopard: { ...(companionState?.snowLeopard || { unlocked: false, active: false, data: null }), active: false },
  };
}

export function isAsukaAvailable(companionState) {
  return !!(companionState?.asuka?.unlocked && companionState?.asuka?.active && companionState?.asuka?.data);
}

// ── 出战位：同时只带一个 ─────────────────────────────────────────────
// 【为什么改成单槽互斥】战斗引擎是 2v2（玩家+1 队友 vs 敌方），第二个队友没有位置。
// 此前只有雪豹一个候选，"active" 就够用了；现在有两个候选，必须明确"同时只能一个"，
// 否则 isSnowLeopardAvailable 与 isAsukaAvailable 会同时为真，
// TeamDuelScreen 拿到两个 leopardData 级别的对象，行为未定义。
export const COMPANION_SLOTS = [
  { key: "snowLeopard", label: "雪豹", beast: true },
  { key: "pearl", label: "珍珠", beast: true },
  { key: "asuka", label: "明日香", beast: false },
];

// 当前出战的是谁（没有则 null）。单一真值来源，UI 与战斗都读它。
export function activeCompanionKey(companionState) {
  for (const s of COMPANION_SLOTS) {
    const c = companionState?.[s.key];
    if (c?.unlocked && c?.active && c?.data) return s.key;
  }
  return null;
}

export function activeCompanion(companionState) {
  const k = activeCompanionKey(companionState);
  return k ? { key: k, ...companionState[k] } : null;
}

// 已解锁的候选（供 UI 列出可切换的队友）
export function unlockedCompanions(companionState) {
  return COMPANION_SLOTS.filter(s => companionState?.[s.key]?.unlocked && companionState?.[s.key]?.data);
}

// 按 NPC 名字查它对应的伙伴槽位（雪豹/珍珠/明日香），不是伙伴候选返回 null。
export function companionKeyByName(name) {
  const s = COMPANION_SLOTS.find(x => x.label === name);
  return s ? s.key : null;
}

// 某个具名伙伴候选是否已解锁（供 NpcActionMenu 判断"邀请入队"按钮要不要收起）。
export function isCompanionUnlockedByName(companionState, name) {
  const key = companionKeyByName(name);
  return key ? !!(companionState?.[key]?.unlocked && companionState?.[key]?.data) : false;
}

// 换出战队友：把目标置 active，其余一律置 false（互斥）。
// key 传 null 表示谁都不带。
export function setActiveCompanion(companionState, key) {
  const next = { ...companionState };
  for (const s of COMPANION_SLOTS) {
    if (!next[s.key]) continue;
    next[s.key] = { ...next[s.key], active: s.key === key };
  }
  return next;
}

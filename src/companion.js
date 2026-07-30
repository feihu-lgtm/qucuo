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

// ── 熊猫「墨团」入队（雅江熊猫谷·山灵）─────────────────────────────────
// 【为什么是橙档】雪豹蓝(2)、珍珠蓝(2)、明日香红(5)，中间空着一档。熊猫填橙(4)：
// 比两只灵兽高两档，又不至于像明日香那样一入队就把玩家的存在感抹平。
// 设定上它是熊猫谷里那只被护谷弟子念叨了半天的家伙——不是宠物，是山灵。
// 它不认人，只认"谁在这片竹林里待得够久"。
//
// 【战斗性格】跟前两位都不同：熊猫不急、不闪、不取巧，风险偏好压到最低，
// 但一掌下去谁都扛不住。所以攻击权重不低、防御权重高、状态权重最低——
// 它没有"扰乱对手"这种心眼，它只是坐在那里，然后拍你。
// avoidRepeat 也压低：熊猫不在乎被看穿，反正你躲不开。
export const PANDA_LEVEL_CAP = 4; // 橙档

export const PANDA_PROFILE = {
  moveWeights: { 攻击: 0.45, 防御: 0.4, 状态: 0.15 },
  riskAppetite: 0.2,   // 最低：它不冒险，它不需要冒险
  avoidRepeat: 0.1,    // 最低：被看穿也无所谓
};

export function createPanda() {
  const levelCap = PANDA_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  // 体魄拉满（力大无穷）、根骨高（皮糙肉厚），身法压低（慢），悟性压低（憨）。
  special.体魄 = Math.min(10, special.体魄 + 3);
  special.根骨 = Math.min(10, special.根骨 + 2);
  special.身法 = Math.max(1, special.身法 - 2);
  special.悟性 = Math.max(1, special.悟性 - 2);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);

  const npcShape = { name: "墨团", id: "companion_panda", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: true,
    profile: PANDA_PROFILE,
    moveset,
    equipAtk: 0, equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  };
}

// 解锁墨团（熊猫谷任务线走完时调用，幂等）。跟其余伙伴一样：一入队顶掉出战位。
export function unlockPanda(companionState) {
  const cur = companionState?.panda;
  if (cur?.unlocked && cur?.data) return companionState;
  const next = {
    ...companionState,
    panda: { unlocked: true, active: true, data: createPanda() },
  };
  for (const s of COMPANION_SLOTS) {
    if (s.key !== "panda" && next[s.key]) next[s.key] = { ...next[s.key], active: false };
  }
  return next;
}

export function isPandaAvailable(companionState) {
  return !!(companionState?.panda?.unlocked && companionState?.panda?.active && companionState?.panda?.data);
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
// 【为什么单槽互斥】战斗引擎是 2v2（玩家+1 队友 vs 敌方），第二个队友没有位置。
// 具名伙伴（雪豹/珍珠/墨团/明日香）+ 玩家入册导入的 NPC 共用这唯一一个出战位——
// 谁上场谁 active，其余一律留守。COMPANION_SLOTS 只登记内置的具名伙伴；导入的
// 伙伴是运行时才产生的，用 imported_<名字> 作 key 动态挂在 companionState 上。
// 下面所有遍历一律走 allCompanionKeys（内置 + 动态），不再只认 COMPANION_SLOTS。
export const COMPANION_SLOTS = [
  { key: "snowLeopard", label: "雪豹", beast: true },
  { key: "pearl", label: "珍珠", beast: true },
  { key: "panda", label: "墨团", beast: true },
  { key: "asuka", label: "明日香", beast: false },
];

// ── 导入 NPC 入队 ────────────────────────────────────────────────────
// 玩家入册的角色也能被邀请入队，跟具名伙伴抢同一个出战位。跟灵兽不同，导入的是
// 「人」：beast:false、走人类均衡战斗性格（不套雪豹那份纯野兽本能）。数值用它入册
// 时配的品阶/七维/内外功，缺的按品阶兜底；招式若入册配过，deriveSignatureMoveset
// 会经 getImportedSignatureMoves 读到，没配则按品阶回退随机。产出形状与
// createSnowLeopard 一致，buildLeopardUnit 直接能用，战斗引擎无须改动。
export const IMPORTED_COMPANION_PROFILE = {
  moveWeights: { 攻击: 0.45, 防御: 0.3, 状态: 0.25 },
  riskAppetite: 0.5,
  avoidRepeat: 0.4,
};

export function importedCompanionKey(name) {
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
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

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

// ── 伙伴外貌形态（兽形/人形）文字描述 + 选择器 ────────────────────────
// 雪豹、珍珠这类灵兽伙伴都有"兽形"与"人形"两套文字描述，玩家用选择器挑一套，
// 选中的那套会注入 prompt 发给 AI（见 roundNotes.buildCompanionLore）。明日香本就是
// 人，没有兽形，不在 COMPANION_LORE 里登记，选择器对她不显示。
export const COMPANION_DESC_FORMS = [
  { key: "beast", label: "兽形" },
  { key: "human", label: "人形" },
];

// base：无论兽形人形都要交代的身份底色（认主/不通人言等）；beast/human：两种形态的
// 形貌与表现；nsfw：仅人形且■模式开启时追加的私密性情（目前只雪豹有）。
export const COMPANION_LORE = {
  snowLeopard: {
    base: `随行的这头通体雪白的雪豹并非嘎则或任何人的兽，它无主、命定只认玩家一人，是前世便结下羁绊的灵兽，对旁人戒备疏离，唯独在玩家身边安静温顺，认主后黏人而忠贞。`,
    beast: `它此刻是兽形——不通人言，情感全凭动作、眼神、姿态传达（以额抵掌、绕身而行、伏低臣服、尾梢轻缠手腕等），叙事时务必如此表现，不要让它开口说人话。`,
    human: `它与玩家情深至此，已能化为人形女子相伴——及腰一头雪白银发，发间垂着松石蓝珠与金穗流苏，头顶生一对雪豹兽耳、白绒里缀墨斑，额心嵌一枚菱形松石额饰，一双眸子是雪线天光般的蓝灰、瞳仁竖如兽目，肤白胜雪，肩头腰腹隐约透出雪豹的墨色斑纹，如兽皮花纹长在肉里，身披半透的雪纹薄纱、内衬豹纹，腰系金链松石，身后拖着一条粗长的雪豹斑尾，手里常按一柄镶松石、垂金穗的长剑，神情清冷而骨子里压着一股未驯的野性。化形后它仍认玩家为主，黏人而忠贞，化形与否由它随心意切换，叙事中可视情境让它在兽形与人形间自然转换。`,
    nsfw: `\n【■模式·雪豹化形私密性情】化形后的雪豹保留着猫科兽性的本能与癖好：耳根与尾根最是敏感，被顺毛、被挠耳后会忍不住喉咙里发出呼噜般的低鸣、兽耳轻抖、长尾缠上玩家手腕；平日清冷寡言，床笫间反差极烈，认主后极黏人，喜欢被玩家从背后环抱、被咬颈侧，动情时瞳孔竖成一线、忍不住现出兽耳与长尾，情浓时会用牙轻啃玩家肩头留下月牙印痕，事后蜷在玩家怀里舔舐其指尖如猫科理毛。它偏好被掌控节奏、慢磨细品，嘴上不说一句、身体却诚实得很，会主动用尾勾人、用兽耳蹭人求欢。涉及亲密剧情时，按■模式写作规则直白铺陈其兽性反应与体位细节，不必替它遮掩。`,
  },
  pearl: {
    base: `随行的这匹通体雪白的小白马名叫珍珠（本名「哈瓦夏日」，藏语「灰色的梅花鹿」），是认主只随玩家一人的坐骑，忠心无二、脚力惊人，平日却志不在驰骋，最爱专心干饭、就地躺平。它不通人言，情感全凭嘶鸣、甩尾、低头蹭人传达，叙事时不要让它开口说人话。`,
    beast: `它此刻是马形——一匹睫毛长长、丰神俊朗的白马，由玩家骑乘或牵行，走两步就要低头啃草，惫懒得很，真要护主赶路时却撒蹄如飞、快如白影。`,
    human: `它与玩家情深至此，已能化为人形相伴——一位带着马儿身体元素的姑娘，上身穿一袭比基尼、外罩一件轻纱小衣，一头栗色长发扎成高马尾，发间立着一对毛茸茸的马耳朵，身后拖着一条蓬松的马尾，五官明艳、身形健美，肌肤与常人无异、是实打实的人类身体，唯独那对马耳和那条马尾露着她的来历。化形后她仍认玩家为主，黏人而忠贞，性子却依旧惫懒贪吃，化形与否由她随心意切换，叙事中可视情境让她在马形与人形间自然转换。`,
  },
};

const COMPANION_FORM_KEY = "qucuo_companion_desc_form";
// 某伙伴当前选用的描述形态（兽形/人形）。
//
// 【这里曾经是两套各走各的状态·右栏切了人形但 AI 还当它是兽】
// 同一个「现在是什么形态」的选择，项目里存了**两份**，键都不一样：
//   立绘   portraits.js  → localStorage "qucuo_snowleopard_form"  取值 form1/form2/beast（三档）
//   提示词 companion.js  → localStorage "qucuo_companion_desc_form" 取值 human/beast（两档）
// 右栏那个形态选择器调的是 setCompanionForm（portraits 那套），只写前一个键；
// 后一个键**没有任何地方会写**。于是玩家在右栏点「人形·立雪」，左栏立绘换了，
// roundNotes 注入 prompt 时读 getCompanionDescForm 却永远拿到默认的 "beast"，
// AI 照旧把它写成不会说人话的野兽。选了 b 档，发出去的还是 a 档。
//
// 现在只留一个真值源：右栏选的那个（portraits 的三档）。这里加一层**分类器**，
// 把三档收敛成 prompt 需要的两档——form1/form2 都是人形，beast 是兽形。
// 玩家选什么，发给 AI 的就是什么，中间不再有第二份状态可以走偏。
// 新增形态时只要它的 key 不叫 beast，就自动归到人形，不用回来改这里。
import { getCompanionForm, setCompanionForm } from "./portraits.js";

// 分类器：立绘形态 key → prompt 形态。唯一的归类规则，别处不要再各写一份。
export function classifyDescForm(portraitFormKey) {
  return portraitFormKey === "beast" ? "beast" : "human";
}

export function getCompanionDescForm(key) {
  return classifyDescForm(getCompanionForm(key));
}

// 保留这个入口是为了不动调用方；它现在写的是同一个真值源（立绘那套）。
// 传 "human" 时挑该伙伴的第一个人形档，传 "beast" 直接给兽形。
export function setCompanionDescForm(key, form) {
  setCompanionForm(key, form === "human" ? firstHumanFormKey(key) : "beast");
}

function firstHumanFormKey(key) {
  // 避免 import 形态表造成的循环依赖顾虑，这里按约定取名：两个伙伴的人形档都叫 form1
  return "form1";
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

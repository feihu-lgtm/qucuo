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
  return { snowLeopard: { unlocked: false, active: false, data: null } };
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

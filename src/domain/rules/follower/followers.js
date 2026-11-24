// 随从系统（设计_地宫内层地图.md §A-2 OC 入宫 · 数据层 76 人 OC 的 follower 字段落地）
// follower 原样读数据层结构 {type:"兽"|"人"|"机关人偶"|"剑灵", name, desc}，本文件不改数据层。
// 映射：兽→beast / 人→human / 机关人偶→golem / 剑灵→spirit。
// 纯函数无 IO：rng 由调用方传 seeded 函数。

import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const FULL_POOL = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];

const TYPE_MAP = { 兽: "beast", 人: "human", 机关人偶: "golem", 剑灵: "spirit" };

export function findAdventurer(ownerId) {
  return FULL_POOL.find((a) => a.id === ownerId) || null;
}

// 主人 level 按 levelCap 折算（1-5 档），随从强度取 0.6 档
const ownerPower = (owner) => Math.max(1, Math.round((owner.levelCap ?? 3) * 0.6));

const rollStat = (base, rng) => base + Math.floor(rng() * 3); // 小抖动，同 seed 稳定

/**
 * 召唤随从实体。
 * @param {string} ownerId 冒险者 id（池里带 follower 字段的 OC）
 * @param {() => number} rng seeded rng
 * @returns {{follower: {name, role, combatStat?, aura?, desc}, log} | null}
 *   beast/human → combatStat 简化战斗单位（可参战/观战）；
 *   golem/spirit → aura 一次性机关/灵体增益（1 回合 buff）。
 */
export function summonFollower(ownerId, rng) {
  const owner = findAdventurer(ownerId);
  const raw = owner?.follower;
  if (!raw) return null;
  const role = TYPE_MAP[raw.type] || "beast";
  const p = ownerPower(owner);

  if (role === "beast" || role === "human") {
    const combatStat = {
      hp: rollStat(20 + p * 12, rng),
      atk: rollStat(5 + p * 4, rng),
      def: rollStat(2 + p * 3, rng),
    };
    const kindLog = role === "beast"
      ? `${raw.name}低吼一声窜到${owner.name}身侧，蓄势待发。`
      : `${raw.name}抱拳上前一步，与${owner.name}并肩而立。`;
    return {
      follower: { name: raw.name, role, combatStat, desc: raw.desc, canSpectate: role === "human" },
      log: kindLog,
    };
  }

  // golem/spirit：一次性辅助，aura 挂主人身上 1 回合
  const aura = role === "golem"
    ? { buff: { def: 6 + p * 2 }, duration: 1, uses: 1 }
    : { buff: { atk: 4 + p * 2, hp: 8 }, duration: 1, uses: 1 };
  const kindLog = role === "golem"
    ? `${raw.name}的关节咔哒展开，替${owner.name}挡在身前。`
    : `${raw.name}自${owner.name}身后显化虚影，灵光一闪即逝。`;
  return { follower: { name: raw.name, role, aura, desc: raw.desc }, log: kindLog };
}

/**
 * 战斗中随从对主人的助益。
 * @returns {{assistDelta:{atk,def,hp}, log}}
 *   beast/human 进战斗位分担火力；golem/spirit 消耗一次 use 给 owner 挂 buff。
 */
export function followerEffectInCombat(follower, ownerState = {}) {
  if (!follower) return { assistDelta: { atk: 0, def: 0, hp: 0 }, log: null };
  if (follower.combatStat) {
    const { atk = 0, def = 0 } = follower.combatStat;
    return {
      assistDelta: { atk: Math.ceil(atk / 3), def: Math.ceil(def / 3), hp: 0 },
      log: `${follower.name}扑上前撕咬缠斗，替${ownerState.name || "主人"}分去了几分攻势。`,
    };
  }
  if (follower.aura?.uses > 0) {
    const b = follower.aura.buff;
    return {
      assistDelta: { atk: b.atk || 0, def: b.def || 0, hp: b.hp || 0 },
      log: `${follower.name}的${follower.role === "golem" ? "机关残躯" : "灵光"}覆上${ownerState.name || "主人"}周身，增益一瞬。`,
    };
  }
  return { assistDelta: { atk: 0, def: 0, hp: 0 }, log: null };
}

/**
 * 离队概率：主人死亡必离队；好感低于阈值随数值走低。
 * @param {object} follower
 * @param {{affinity?: number, ownerAlive?: boolean}} ctx
 */
export function followerLeaveChance(follower, { affinity = 60, ownerAlive = true } = {}) {
  if (!follower) return 1;
  if (!ownerAlive) return 1;
  if (affinity < 20) return 0.5;
  if (affinity < 40) return 0.2;
  return 0;
}

/**
 * 遣散随从：返回离队 log（随行列表更新由调用方落账）。
 */
export function dismissFollower(follower, { reason = "遣散" } = {}) {
  if (!follower) return { dismissed: false, log: null };
  return {
    dismissed: true,
    log: reason === "遣散"
      ? `${follower.name}冲你点了点头，转身没入山林深处。`
      : `${follower.name}因${reason}离队而去。`,
  };
}

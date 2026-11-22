// NPC 属性与战力公式（自 npcGeneration.js 拆出）：七维属性生成 +
// 玩家/NPC 共用的外功→攻击、内功→气血/防御统一曲线。
import { random } from "../../../utils/rng.js";
import { createEmptyStatusSlots } from "../combat/statusEffects.js";

export function generateNpcAttributes({ levelCap = 2 } = {}) {
  const base = 3 + levelCap; // levelCap 0-5 对应基准值 3-8
  const rand = () => Math.max(1, Math.min(10, base + Math.floor(random() * 3) - 1));
  return {
    根骨: rand(), 悟性: rand(), 体魄: rand(),
    魅力: rand(), 智谋: rand(), 身法: rand(), 气运: rand(),
  };
}

// ── 统一战力曲线（玩家与NPC共用同一套函数、同一条曲线）──
// 之前的坑：NPC 的 baseAtk/气血按 4.5/档 指数增长（白→红总 1845 倍），跟
// equipment.js 的品质曲线（20^(1/5)，白→红恰好 20 倍）自相矛盾；更要命的是
// 玩家在战斗里 baseAtk 恒为 20、气血恒为 100，从不随修为上档——玩家和 NPC
// 压根不在同一条战力梯子上，导致满配玩家被中档 NPC 一击秒。
//
// 现在统一：攻击力由「外功」决定、气血由「内功」决定，玩家和 NPC 走下面这
// 两个同样的函数。NPC 的外功/内功由 levelCap 给（getTierPower），玩家的就是
// 自己修炼的那两个数（0-100）。这样"外功100/内功100 的玩家 ≈ 红袍 NPC"，
// 攻击力和气血天然可比。R=20^(1/5)，外功/内功每+20 约翻 1.82 倍，0→100 共 20 倍，
// 跟装备品质曲线完全一致。
const COMBAT_GROWTH = Math.pow(20, 1 / 5); // ≈1.8206，与 equipment.js 的 QUALITY_RATIO 同源

// 攻击力 = 18 × R^(外功/20)：外功0→18 / 20→33 / 40→60 / 60→109 / 80→198 / 100→360
export function atkFromWaigong(waigong = 0) {
  const w = Math.max(0, Math.min(100, waigong));
  return Math.round(18 * Math.pow(COMBAT_GROWTH, w / 20));
}

// 气血上限 = (60 + 体魄×8) × R^(内功/20)：内功0→约100（跟旧的固定100兼容），
// 内功100 体魄10 → 约2800。体魄仍是同档位内的胖瘦浮动。
export function hpFromNeigong(neigong = 0, tiPo = 5) {
  const n = Math.max(0, Math.min(100, neigong));
  const base = 60 + (tiPo ?? 5) * 8;
  return Math.round(base * Math.pow(COMBAT_GROWTH, n / 20));
}

// 基础防御力 = 9 × R^(内功/20)：内功0→9 / 20→16 / 40→30 / 60→55 / 80→99 / 100→180。
// 跟 atkFromWaigong 同一条曲线、同一个增长率，只是基数减半——内功现在身兼两职
// （气血上限 + 基础防御力），如果基数跟 atkFromWaigong 一样大，防御力会经常
// 完全吃掉攻击伤害，战斗打不动，所以取一半，防御是"削弱"攻击而不是"抵消"攻击。
// 只在防御类招式判定生效那一回合参与结算（见 resolveTurn.js），不是被动全程生效。
export function defFromNeigong(neigong = 0) {
  const n = Math.max(0, Math.min(100, neigong));
  return Math.round(9 * Math.pow(COMBAT_GROWTH, n / 20));
}

// getTierPower：仍然把 levelCap 翻译成"这个档位对应的外功/内功值"（白5→红95），
// 但 baseAtk 不再是独立的指数值，而是走上面统一的 atkFromWaigong(外功)——
// 保证 NPC 和玩家用同一个公式。hpGrowth 字段废弃，气血改由 hpFromNeigong 算。
export function getTierPower(levelCap = 0) {
  const cap = Math.max(0, Math.min(5, levelCap));
  const neigong = Math.min(100, Math.round(5 + cap * 18)); // 白5 绿23 蓝41 紫59 橙77 红95
  const waigong = neigong;
  return {
    baseAtk: atkFromWaigong(waigong), // 白18 绿33 蓝60 紫109 橙198 红约310
    neigong,
    waigong,
  };
}

// 战斗用的气血/能量初始值。气血上限由内功+体魄决定（跟玩家同一个 hpFromNeigong），
// 能量固定10点上限，这是切磋系统的硬性规则，不受属性影响。
export function generateNpcCombatStats(attrs, levelCap = 0) {
  const { neigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, attrs.体魄);
  return {
    hp: [maxHp, maxHp],
    energy: [10, 10],
    statusSlots: createEmptyStatusSlots(),
  };
}

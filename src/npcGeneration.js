// NPC 出生固化：技能位 + 随身物品
// 核心原则：一个NPC第一次在某个房间出现时，系统本地一次性生成他的四个切磋技能位
// 和随身携带的物品，写死存进这个NPC对象，之后每次交互（查看/切磋/偷窃）都读取
// 这份固定数据，不再变化——跟"移动方向由固定地图裁决""拾取品质由系统骰子决定"
// 是同一个设计哲学：AI不参与数值判定，只负责在系统裁决的结果之上描述细节。
//
// 为什么不让AI在生成NPC时顺手编技能和物品：切磋和偷窃都要用这些数据做真实的
// 数值计算（伤害、克制、成功率），如果每次都让AI自由发挥，同一个NPC今天有这四个
// 技能明天变成另外四个，战斗和偷窃系统就没有稳定的地基可用。

import { rollQuality, QUALITY, makeItem, ITEM_CATEGORY } from "./equipment.js";
import { makeItemSmart, makeNamedItem, CATALOG_INDEX } from "./items/catalog.js";
import { ITEM_DISTRIBUTION } from "./items/distribution.js";
import { ROLE_CARRY, levelCapToRole, regionOf } from "./items/regionMap.js";
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);
import { MOVE_TYPE } from "./combat/moveTypes.js";
import { createEmptyStatusSlots } from "./combat/statusEffects.js";
import { NPC_SIGNATURE_MOVES } from "./npcSignatureMoves.js";
import { resolveArchetype } from "./combat/moveArchetypes.js";

// 生成NPC的七维属性（跟玩家 char.special 同一套体系：根骨/悟性/体魄/魅力/智谋/身法/气运，0-10）。
// "身法"就是速度值，切磋时同类型对撞靠这个字段判定先手，不新增单独的speed字段。
export function generateNpcAttributes({ levelCap = 2 } = {}) {
  const base = 3 + levelCap; // levelCap 0-5 对应基准值 3-8
  const rand = () => Math.max(1, Math.min(10, base + Math.floor(Math.random() * 3) - 1));
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
export const COMBAT_GROWTH = Math.pow(20, 1 / 5); // ≈1.8206，与 equipment.js 的 QUALITY_RATIO 同源

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
function generateNpcCombatStats(attrs, levelCap = 0) {
  const { neigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, attrs.体魄);
  return {
    hp: [maxHp, maxHp],
    energy: [10, 10],
    statusSlots: createEmptyStatusSlots(),
  };
}


// 每个品质档位对应的技能范例池，跟 duel-system-design.md 里的表格一一对应。
// 实际生产环境这份池子应该更丰富（每个类型每个品质多几个候选，避免所有NPC技能撞车），
// 这里先给每格一个代表性技能，验证机制通得通，池子后续可以随时扩充不影响生成逻辑。
export const MOVE_POOL = {
  白: {
    [MOVE_TYPE.ATTACK]: { id: "move_zhi_quan", name: "直拳", energyCost: 2, baseDamageMultiplier: 1.0 },
    [MOVE_TYPE.DEFENSE]: { id: "move_ying_jia", name: "硬架", energyCost: 2, baseDamageMultiplier: 0.6 },
    [MOVE_TYPE.STATUS]: { id: "move_hui_qi", name: "回气", energyCost: 0, energyRestore: 4 },
  },
  绿: {
    [MOVE_TYPE.ATTACK]: { id: "move_lian_huan_tui", name: "连环腿", energyCost: 3, baseDamageMultiplier: 1.15 },
    [MOVE_TYPE.DEFENSE]: { id: "move_tie_bu_shan", name: "铁布衫", energyCost: 3, baseDamageMultiplier: 0.5 },
    [MOVE_TYPE.STATUS]: { id: "move_xu_li", name: "蓄力", energyCost: 3, nextAttackBonus: 0.2 },
  },
  蓝: {
    [MOVE_TYPE.ATTACK]: { id: "move_po_kong_quan", name: "破空拳", energyCost: 4, baseDamageMultiplier: 1.3 },
    [MOVE_TYPE.DEFENSE]: { id: "move_pan_shi_zhuang", name: "磐石桩", energyCost: 4, baseDamageMultiplier: 0.4, onCounterSuccessEnergyGain: 2 },
    [MOVE_TYPE.STATUS]: { id: "move_huo_xin_bu", name: "惑心步", energyCost: 5, confuseChance: 0.5 },
  },
  紫: {
    [MOVE_TYPE.ATTACK]: { id: "move_lie_shi_zhan", name: "裂石斩", energyCost: 5, baseDamageMultiplier: 1.5, doubleVsStatus: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_ting_feng_shi", name: "听风势", energyCost: 6, baseDamageMultiplier: 0.3, onCounterSuccessDamageRatio: 0.7, onCounterFailEnergyPenalty: 3 },
    [MOVE_TYPE.STATUS]: { id: "move_duo_hun_shou", name: "夺魂手", energyCost: 6, energyDiffDamage: true },
  },
  橙: {
    [MOVE_TYPE.ATTACK]: { id: "move_jing_lei_po", name: "惊雷破", energyCost: 7, baseDamageMultiplier: 1.8, ignoreDefense: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_gui_yuan_jue", name: "归元诀", energyCost: 8, baseDamageMultiplier: 0.2, onCounterSuccessDamageRatio: 1.2, onCounterFailEnergyPenalty: 4 },
    [MOVE_TYPE.STATUS]: { id: "move_she_hun_yin", name: "摄魂引", energyCost: 8, freezeEnergyRecovery: true },
  },
  红: {
    [MOVE_TYPE.ATTACK]: { id: "move_yi_jian_xi_lai", name: "一剑西来", energyCost: 9, baseDamageMultiplier: 2.2, forceFirst: true, nullifyStatusOnHit: true },
    [MOVE_TYPE.DEFENSE]: { id: "move_ting_qiao", name: "听桥", energyCost: 9, baseDamageMultiplier: 0.05, onCounterSuccessDamageRatio: 1.0, onCounterSuccessPreemptive: true, onCounterFailEnergyPenalty: 5, onCounterFailDefenseNullified: true },
    [MOVE_TYPE.STATUS]: { id: "move_tian_jing_jue", name: "天惊诀", energyCost: 9, doubleReflectDamage: true },
  },
};

// NPC 的技能品质上限，由角色定位决定——不是所有NPC都该有红色技能，
// 普通村民/路人这种"level"应该封顶在白绿，只有明确设计为高手的角色才给到紫橙红。
// level 对应能解锁到的最高技能品质索引（0=白, 5=红）
function pickQualityWithCap(luck, levelCap) {
  const cappedQuality = () => {
    let q = rollQuality(luck);
    const capIndex = QUALITY.indexOf(QUALITY[levelCap] || "白");
    const rolledIndex = QUALITY.indexOf(q);
    return rolledIndex > capIndex ? QUALITY[capIndex] : q;
  };
  return cappedQuality();
}

// 生成NPC的四个技能位：固定分配为 攻击/防御/状态/状态 各一个（第二个状态位空出来
// 给"回气"这类零消耗保底技能，保证任何NPC能量枯竭时都至少有一个可用选项）
export function generateNpcMoveset(npc, { luck = 5, levelCap = 2 } = {}) {
  const attackQ = pickQualityWithCap(luck, levelCap);
  const defenseQ = pickQualityWithCap(luck, levelCap);
  const statusQ = pickQualityWithCap(luck, levelCap);

  return [
    { ...MOVE_POOL[attackQ][MOVE_TYPE.ATTACK], type: MOVE_TYPE.ATTACK, quality: attackQ },
    { ...MOVE_POOL[defenseQ][MOVE_TYPE.DEFENSE], type: MOVE_TYPE.DEFENSE, quality: defenseQ },
    { ...MOVE_POOL[statusQ][MOVE_TYPE.STATUS], type: MOVE_TYPE.STATUS, quality: statusQ },
    { ...MOVE_POOL["白"][MOVE_TYPE.STATUS], type: MOVE_TYPE.STATUS, quality: "白" }, // 保底回气位，固定白色不受品质上限影响
  ];
}

// levelCap（0-5）→ 品质档位名。越界自动夹到 白/红 之间。
function levelCapToQuality(levelCap) {
  const cap = Math.max(0, Math.min(5, levelCap ?? 0));
  return QUALITY[cap] || "白";
}

// 【NPC 专属出招表派生】按 npcSignatureMoves.js 里每槽声明的"原型+名字"，
// 用 resolveArchetype(原型, levelCap) 算出该档位应有的完整效果（档位越高特效越浓），
// 再套上专属名字/描述。没登记专属的 NPC 返回 null，调用方回退随机品质老逻辑。
//
// 核心：品阶决定"数值段位"(外功→baseAtk，见上) + "特效丰富度"(原型×品阶)。
// 所以红名和平民哪怕用同一个【防守反击】原型，红名解锁到抢先/失败重罚，平民只有
// 基础减伤——这就是"红名听桥≠平民听桥"。
export function deriveSignatureMoveset(npc, { levelCap } = {}) {
  const sig = NPC_SIGNATURE_MOVES[npc?.name];
  if (!sig) return null;

  const cap = npc.levelCap ?? levelCap ?? 0;
  const quality = levelCapToQuality(cap);
  const uid = npc.id || npc.name;

  const buildSlot = (slotKey, fallbackArchetype) => {
    const custom = sig[slotKey] || {};
    const archetypeId = custom.archetype || fallbackArchetype;
    const resolved = resolveArchetype(archetypeId, cap) || {}; // 原型×品阶 → 效果
    return {
      ...resolved,               // type + 该档位的全部数值和特效
      ...(custom.effects || {}), // 可选：覆盖/追加独门效果
      quality,
      archetype: archetypeId,
      id: custom.id || `sig_${uid}_${slotKey}`,
      name: custom.name || archetypeId, // 专属名字，没填退回原型名
      desc: custom.desc,
      signature: true,
    };
  };

  // 回气槽：走【回气】原型（保底，能量枯竭时可用，只按档微调回复量），可改名字。
  const moves = [
    buildSlot("攻击", "硬攻"),
    buildSlot("防御", "防守反击"),
    buildSlot("状态", "致乱"),
    buildSlot("回气", "回气"),
  ];
  // 疗伤槽（可选第五招）：只有专属表里显式配了「疗伤」的角色才有回血招——"有些人可以回血"。
  // 没配的角色 moveset 仍是四招，行为不变。moveset 在 UI/AI 里都是遍历使用、不假定固定长度。
  if (sig["疗伤"]) moves.push(buildSlot("疗伤", "疗伤"));
  return moves;
}

// ── 博弈层招式池（总纲v3第十二章：品阶定下限，博弈定上限） ──
// 跟上面 MOVE_POOL 的核心区别：完全不分品阶档位，任何角色（不管
// levelCap多低）都能装备这里的招式，通过承担风险换取超越自身品阶
// 应有的效果。角色是否装备、装备哪个，由 residentNpcs.js 等数据里
// 显式声明的 burdenMoves 数组决定（不是随机生成的），因为这类招式
// 强绑定角色的处境和性格，不该靠系统随机抽。
//
// 三类效果标志位，在 combat/resolveTurn.js 里统一结算：
// - permanentGrowthOnUse：每次使用后基础威力永久+此数值（"越打越顺手"）
// - allInDamage：消耗当前全部能量，消耗量直接决定伤害倍数（孤注一掷）
// - lowHpBonus：自己生命每损失10%，威力+此系数（残血反扑）
// - selfSacrifice: {hpCost, damageMultiplier}：主动燃烧自身生命比例
//   换一次性大额伤害，最激进的一档，用不好等于自杀
export const BURDEN_MOVE_POOL = {
  move_chuisi_fanji: {
    id: "move_chuisi_fanji", name: "垂死反击", type: MOVE_TYPE.ATTACK,
    energyCost: 4, baseDamageMultiplier: 1.0,
    lowHpBonus: 0.5, // 每损失当前生命10%，威力+50%
  },
  move_menghu_yiji: {
    id: "move_menghu_yiji", name: "孤注一掷", type: MOVE_TYPE.ATTACK,
    energyCost: 0, baseDamageMultiplier: 1.0,
    allInDamage: true, // 消耗全部能量，消耗量决定伤害倍数
  },
  move_yuebai_yuey: {
    id: "move_yuebai_yuey", name: "拼命三招", type: MOVE_TYPE.ATTACK,
    energyCost: 5, baseDamageMultiplier: 1.2,
    selfSacrifice: { hpCost: 0.3, damageMultiplier: 3 }, // 燃烧30%当前生命，伤害×3
  },
  move_shengshou_lianji: {
    id: "move_shengshou_lianji", name: "生手渐熟", type: MOVE_TYPE.ATTACK,
    energyCost: 3, baseDamageMultiplier: 0.8,
    permanentGrowthOnUse: 0.15, // 每次使用后基础倍率永久+0.15，起手弱但越打越强
  },
};

// 根据角色声明的 burdenMoveIds（字符串数组）取出对应的博弈层招式对象。
// 未声明或声明了不存在的id会被安全过滤掉，不会让整个moveset生成报错。
export function resolveBurdenMoves(burdenMoveIds) {
  if (!Array.isArray(burdenMoveIds) || burdenMoveIds.length === 0) return [];
  return burdenMoveIds.map(id => BURDEN_MOVE_POOL[id]).filter(Boolean).map(m => ({ ...m }));
}

// 曲措乡随身物品命名池：按品质档位分组，风格贴合藏汉边境的日常物件质感，
// 不再是"XX的随身物件"这种毫无信息量的占位符——玩家拿到手的东西得有名字、
// 有分类，才能真正进入装备/交易系统的价格和属性计算。
// 每个品质档位配几个候选名字，生成时随机挑一个，同一个品质多次生成不会总是同一个名字。
const CARRIED_ITEM_POOL = {
  白: [
    { name: "旧皮绳", category: ITEM_CATEGORY.MISC },
    { name: "磨损的铜哨", category: ITEM_CATEGORY.ACCESSORY },
    { name: "粗布腰囊", category: ITEM_CATEGORY.MISC },
  ],
  绿: [
    { name: "藏纹银扣", category: ITEM_CATEGORY.ACCESSORY },
    { name: "牛皮护腕", category: ITEM_CATEGORY.ARMOR },
    { name: "短柄猎刀", category: ITEM_CATEGORY.WEAPON },
  ],
  蓝: [
    { name: "松石耳坠", category: ITEM_CATEGORY.ACCESSORY },
    { name: "精铁匕首", category: ITEM_CATEGORY.WEAPON },
    { name: "熟皮护甲", category: ITEM_CATEGORY.ARMOR },
  ],
  紫: [
    { name: "错银腰牌", category: ITEM_CATEGORY.ACCESSORY },
    { name: "雪山冷锋", category: ITEM_CATEGORY.WEAPON },
    { name: "锁子软甲", category: ITEM_CATEGORY.ARMOR },
  ],
  橙: [
    { name: "活佛开光念珠", category: ITEM_CATEGORY.ACCESSORY },
    { name: "土司家传弯刀", category: ITEM_CATEGORY.WEAPON },
    { name: "犀角护心镜", category: ITEM_CATEGORY.ARMOR },
  ],
  红: [
    { name: "古格王朝金印", category: ITEM_CATEGORY.ACCESSORY },
    { name: "断魂雪蚕剑", category: ITEM_CATEGORY.WEAPON },
    { name: "赤金龙纹甲", category: ITEM_CATEGORY.ARMOR },
  ],
};

// 生成NPC随身携带的物品（供偷窃/战斗掉落系统使用），品质分布跟装备掉落用同一套
// rollQuality，数量随机1-3件。物品名字从对应品质档位的手写候选池里随机挑选，
// 属性/价格走 makeItem 统一计算，保证跟交易/装备系统完全接轨。
//
// 品阶下限：之前这里完全不看NPC自己的品质档位，纯靠玩家气运摇——一个红袍高手
// 和路边白袍杂鱼摸出来的东西统计上没区别，"品阶对应身家"这个直觉完全落空。
// 现在品阶档位（levelCap）设一个质量下限：档位越高，随身物品至少是那个档位的
// 品质起步（同时数量也跟着涨），气运只决定"在下限之上能不能超常发挥"。
export function generateNpcCarriedItems(npc, { luck = 5, count = null, levelCap = 0 } = {}) {
  const cap = Math.max(0, Math.min(5, levelCap));
  const itemCount = count ?? (1 + cap + Math.floor(Math.random() * 3));
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const rolled = rollQuality(luck);
    const quality = QUALITY[Math.max(QUALITY.indexOf(rolled), cap)];
    const pool = CARRIED_ITEM_POOL[quality] || CARRIED_ITEM_POOL["白"];
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const item = makeItem({ name: picked.name, category: picked.category, quality });
    items.push({ ...item, id: `${npc.id}_item_${i}`, stolen: false });
  }
  return items;
}

// ── 四池版随身物：rollNpcCarry ──────────────────────────────────────
// 替代 generateNpcCarriedItems 的匿名池，改从 catalog 按 role×region×levelCap
// 抽"真货"（贴合身份与地域），而不是"旧皮绳/错银腰牌"这类无信息占位符。
// 掉落 = 可偷 = 所见即所得：本函数只在 NPC 没有 AI 声明的 carry 时作随机兜底，
// 生成的这批就是打死掉的、也是能偷的同一批（沿用 ensureNpcCombatData 的接线）。
const CAT_KEY = { WEAPON: "WEAPON", ARMOR: "ARMOR", ACCESSORY: "ACCESSORY", MISC: "MISC" };
function catEnumOf(name) {
  const e = CATALOG_INDEX[name];
  if (!e) return null;
  // equipment.ITEM_CATEGORY 的值是小写串；映射回大写枚举名做 role.cats 过滤
  const v = String(e.category);
  if (v.includes("weapon")) return "WEAPON";
  if (v.includes("armor")) return "ARMOR";
  if (v.includes("accessory")) return "ACCESSORY";
  return "MISC";
}
export function rollNpcCarry(npc, { luck = 5, levelCap = 0, region } = {}) {
  const cap = Math.max(0, Math.min(5, levelCap));
  const role = npc.role || levelCapToRole(cap);
  const style = ROLE_CARRY[role] || ROLE_CARRY["平民"];
  const reg = region || regionOf(npc.district || npc.region || "");
  // 候选：该地域 + 该 role 允许的类别，命中 distribution 的 catalog 货
  const candidates = [];
  for (const [name, tag] of Object.entries(ITEM_DISTRIBUTION)) {
    if (!tag.regions.includes(reg)) continue;
    const ck = catEnumOf(name);
    if (!ck || !style.cats.includes(ck)) continue;
    candidates.push(name);
  }
  // 数量：role 决定区间，levelCap 高的取偏上
  const [lo, hi] = style.count;
  const bias = cap >= 3 ? 1 : 0;
  const n = Math.min(hi, lo + bias + Math.floor(Math.random() * (hi - lo + 1)));
  if (!candidates.length || n <= 0) {
    // 该地域该身份没有对味候选 → 回退旧匿名池，保证不空手崩溃
    return generateNpcCarriedItems(npc, { luck, count: Math.max(1, n), levelCap: cap });
  }
  const items = [];
  const QORD = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };
  // 品阶窗口：以 levelCap 为中心，下限=cap-1、上限=cap+1（红/白封边）。
  // 这样 levelCap2 的镖师主要掉绿蓝、偶尔紫，绝不会掉橙红；levelCap0 只掉白绿。
  const floor = Math.max(0, cap - 1);
  const ceil = Math.min(5, cap + 1);
  let picks = candidates.filter(nm => {
    const q = QORD[CATALOG_INDEX[nm].quality] ?? 0;
    return q >= floor && q <= ceil;
  });
  if (picks.length < Math.max(1, n)) {
    // 窗口内货不够，放宽到"不超过上限"（仍不会冒出高于 cap+1 的货）
    picks = candidates.filter(nm => (QORD[CATALOG_INDEX[nm].quality] ?? 0) <= ceil);
  }
  // 无放回抽样，避免同一件重复出现
  const bag = [...picks];
  for (let i = 0; i < n && bag.length; i++) {
    const idx = Math.floor(Math.random() * bag.length);
    const name = bag.splice(idx, 1)[0];
    const it = makeNamedItem(name);
    if (it) items.push({ ...it, id: `${npc.id}_ci${i}`, stolen: false });
  }
  return items.length ? items : generateNpcCarriedItems(npc, { luck, count: 1, levelCap: cap });
}

// 一次性完整初始化：给一个刚出现在场景里、还没有 moveset/carriedItems 字段的NPC
// 补全这两块数据。已经有这两个字段的NPC（说明之前生成过）直接跳过，不重新随机，
// 这是"固定不变"这条核心原则的落地保证。
export function ensureNpcCombatData(npc, options = {}) {
  if (npc.moveset && npc.carriedItems && npc.special && npc.combatStats) return npc; // 已经生成过，直接返回
  const levelCap = npc.levelCap ?? options.levelCap ?? 0;
  const special = npc.special || generateNpcAttributes(options);
  const tierPower = getTierPower(levelCap);
  // 所见即所得：如果 AI 在 room.npcs 里声明了 carry（出场时描述过的可见物品），
  // 用它初始化 carriedItems，而不是随机生成——NPC 身上有什么玩家看到什么，打死只掉那些。
  // carry 未声明（undefined）= 旧数据或未声明，回退到随机生成保持向后兼容。
  // carry = [] = AI 明确声明此人身无长物，carriedItems 为空，战斗只掉银两。
  let carriedItems;
  // 【判「非空」而不是判「存在」】空数组是 truthy——这一个字之差是
  // "偷不到东西/切磋不掉东西" 折腾了好几轮的真正根因：
  // npcPool.toRoomNpc() 会硬给每个人 `carriedItems: []`（占位），
  // 于是所有经它转换的 NPC（游走人口、驻场、护镖目标、赌石竞价者——
  // 也就是除 AI 现场生成之外的**全部** NPC）都会命中这个分支，
  // 拿着那个空数组直接返回，**residentNpcs.js 里精心配的 carry 与
  // rollNpcCarry 的兜底全被跳过**。玩家的体感就是"我给每个人都放了物品，
  // 可谁身上都摸不出东西"。
  // 真要表达"此人身无长物"，走下面 Array.isArray(npc.carry) 且 carry 为 []
  // 那条路（有显式声明），不该靠一个占位空数组来表达。
  if (Array.isArray(npc.carriedItems) ? npc.carriedItems.length > 0 : !!npc.carriedItems) {
    carriedItems = npc.carriedItems;
  } else if (Array.isArray(npc.carry)) {
    carriedItems = npc.carry.map((c, i) => ({
      ...makeGameItem({ name: c.name, category: c.category || ITEM_CATEGORY.MISC, quality: c.quality || "白" }),
      id: `${npc.id}_ci${i}`,
      stolen: false,
    }));
  } else {
    // 四池随身物：按 role×region×levelCap 抽 catalog 真货（替代旧匿名池）
    carriedItems = rollNpcCarry(npc, { ...options, levelCap });
  }
  // 品阶层四招：优先用 npcSignatureMoves.js 里登记的专属出招表（数值仍按
  // levelCap 对应品阶套用，只是名字/描述专属）；没登记专属招式的 NPC 回退到
  // generateNpcMoveset 的随机品质 + MOVE_POOL 通用名老逻辑，行为不变。
  const baseMoveset =
    deriveSignatureMoveset(npc, { ...options, levelCap }) ||
    generateNpcMoveset(npc, { ...options, levelCap });
  return {
    ...npc,
    special,
    // 品阶直接存在NPC身上——之前只在生成瞬间当参数用完就扔，UI想显示"这人是什么
    // 品阶"、AI想在叙事里知道"这人看着是什么分量"，都无从查起，只能反推stats，
    // 现在存成npc自己的字段，谁都能直接读。
    levelCap,
    neigong: npc.neigong ?? tierPower.neigong,
    waigong: npc.waigong ?? tierPower.waigong,
    baseAtk: npc.baseAtk ?? tierPower.baseAtk,
    equipAtk: npc.equipAtk ?? 0,
    equipDef: npc.equipDef ?? 0,
    // moveset = 品阶层固定招式（现有 generateNpcMoveset）+ 博弈层招式
    // （resolveBurdenMoves 解析 npc.burdenMoveIds，见 residentNpcs.js 里
    // 显式声明的博弈层招式id）。博弈层招式不受 levelCap 限制，任何角色
    // 只要声明了 burdenMoveIds 就能装备，体现"品阶定下限，博弈定上限"
    // 这个架构原则（总纲v3第十二章）。未声明 burdenMoveIds 的角色（绝大
    // 多数普通NPC）这里就是空数组，行为跟改动前完全一致，不影响老数据。
    moveset: npc.moveset || [...baseMoveset, ...resolveBurdenMoves(npc.burdenMoveIds)],
    carriedItems,
    combatStats: npc.combatStats || generateNpcCombatStats(special, levelCap),
  };
}

// 武学 <-> 招式：一一对应，不是循环分配。
// 每门武学从学会那一刻起就固定绑定一个招式类型（攻击/防御/状态），
// 招式的名字也随之固定不变——"三脚猫拳法"从入门练到登峰造极，
// 名字一直是"三脚猫拳法"，变的是威力数值，不会练着练着变成完全不相干的
// 另一招。这样"练哪门武学"直接决定"切磋时能用哪一招"，一一对应、
// 不需要再通过循环分配或类型映射去猜。
//
// 招式类型的分配规则：武学预设时（在 presets/qucuo.js 里）可以显式指定
// moveType 字段；没指定的话，按名字里的关键词粗略猜一个合理类型兜底
// （"拳/腿/掌/刀/枪"这类主动攻击类词 -> 攻击；"桩/盾/架/功"这类防守类词
// -> 防御；其余默认状态类），保证旧预设不用大改也能正常映射。
function inferMoveType(skillName) {
  if (/拳|腿|掌|刀|枪|剑|棍|指/.test(skillName)) return MOVE_TYPE.ATTACK;
  if (/桩|盾|架|功|甲/.test(skillName)) return MOVE_TYPE.DEFENSE;
  return MOVE_TYPE.STATUS;
}

// 每个阶段对应的数值强度系数（不是查表换皮，而是同一招式在自身身上的强化）。
// baseDamageMultiplier / energyCost 等具体数值按这个系数缩放，阶段越高
// 缩放幅度越大，跟品质体系（白绿蓝紫橙红）的强度曲线保持一致的感觉，
// 但招式的"骨架"（是攻击还是防御、特殊效果类型）从诞生起就不变。
const STAGE_POWER = { 入门: 1.0, 小成: 1.15, 大成: 1.3, 圆满: 1.5, 登峰造极: 1.8 };
const STAGE_ENERGY_COST = { 入门: 2, 小成: 3, 大成: 4, 圆满: 5, 登峰造极: 6 };
const STAGE_TO_QUALITY = { 入门: "白", 小成: "绿", 大成: "蓝", 圆满: "紫", 登峰造极: "橙" };

// 根据一门武学的当前阶段和类型，生成对应的招式对象。
// moveType 优先取 skill.moveType（预设手写指定），没有就用名字关键词兜底猜测。
export function deriveMoveFromSkill(skill) {
  const moveType = skill.moveType || inferMoveType(skill.name);
  const power = STAGE_POWER[skill.stage] || 1.0;
  const quality = STAGE_TO_QUALITY[skill.stage] || "白";

  const base = {
    id: `skill_move_${skill.name}`,
    name: skill.name, // 招式名字直接就是武学名字，不再是另起的"直拳""硬架"这类别名
    type: moveType,
    quality,
    energyCost: STAGE_ENERGY_COST[skill.stage] || 2,
    sourceSkill: skill.name,
  };

  if (moveType === MOVE_TYPE.ATTACK) {
    return { ...base, baseDamageMultiplier: power };
  }
  if (moveType === MOVE_TYPE.DEFENSE) {
    // 防御类倍率反过来：练得越深，受到的伤害越低（0.6基准往下降，不是往上乘）
    return { ...base, baseDamageMultiplier: Math.max(0.05, 0.65 - (power - 1) * 0.5) };
  }
  // 状态类：练得越深，附加效果的触发几率/强度越高
  return { ...base, confuseChance: Math.min(0.7, 0.3 * power), energyRestore: moveType === MOVE_TYPE.STATUS && skill.name.includes("回气") ? Math.round(4 * power) : undefined };
}

// 玩家的切磋招式池：一门武学对应一个招式，一一映射，不再循环分配/查表。
// 招式数量 = 武学数量。类型缺位（比如玩家所有武学都是攻击类，完全没有
// 防御/状态类可选）用白色基础技能兜底，保证任何时候三个类型至少各有一个。
// 玩家的切磋招式池：只上阵【运功中】(active) 的武学——运功=装备上阵。
// 每个类型(攻/防/状)最多运功一门；某类没运功任何武学，就用白色基础招兜底，
// 保证三类各有一招可用。最后永远保底一个"回气"(0耗能)，防止运功了耗能状态招后
// 能量枯竭无招可出（与 generateNpcMoveset 的保底回气位一致）。
export function deriveMovesetFromSkills(skills) {
  const list = skills || [];
  const moves = [];
  for (const type of [MOVE_TYPE.ATTACK, MOVE_TYPE.DEFENSE, MOVE_TYPE.STATUS]) {
    const equipped = list.find(s => s.active && (s.moveType || inferMoveType(s.name)) === type);
    if (equipped) {
      moves.push((equipped.fixed && equipped.move) ? { ...equipped.move, sourceSkill: equipped.name } : deriveMoveFromSkill(equipped));
    } else {
      const template = MOVE_POOL["白"][type];
      moves.push({ ...template, type, quality: "白", sourceSkill: null });
    }
  }
  if (!moves.some(m => m.id === "move_hui_qi")) {
    const huiqi = MOVE_POOL["白"][MOVE_TYPE.STATUS];
    moves.push({ ...huiqi, type: MOVE_TYPE.STATUS, quality: "白", sourceSkill: null });
  }
  return moves;
}

// 战斗胜利掉落：赢了切磋后，从NPC的随身物品（carriedItems）里随机掉落1件
// （如果还有没被偷过的），加上一笔银两。银两掉落额跟NPC的体魄挂钩——
// 体魄越高说明这个NPC本身越强（levelCap高的NPC体魄基准值也更高），
// 掉落的银两自然应该更多，不需要另起一套跟角色强度无关的固定值。
//
// 之所以复用carriedItems而不是单独设计一套"战利品池"：carriedItems本来就是
// 按luck品质分布生成的、这个NPC真实拥有的东西，赢了直接拿走符合直觉；
// 如果被玩家偷窃系统提前偷光了，战斗掉落就没有装备可拿，只剩银两，
// 这也是合理的——同一份"这个人身上有什么"的数据源，不重复建模。
export function rollBattleLoot(npc) {
  const availableItems = (npc.carriedItems || []).filter(i => !i.stolen);
  const droppedItem = availableItems.length > 0
    ? makeGameItem(availableItems[Math.floor(Math.random() * availableItems.length)])
    : null;

  // 固定必掉（guaranteedLoot）：boss 级/剧情级 NPC 身上按剧情必掉的素材，
  // 不参与随机、一次全给（如虎王必掉 虎胆+虎王牙+虎王筋，供虎胆三重门和
  // 虎啸支线各取所需）。跟 droppedItem 的随机掉落并存。
  const guaranteedLoot = (npc.guaranteedLoot || []).map((g, i) => ({
    ...makeGameItem({ name: g.name, category: g.category || ITEM_CATEGORY.MISC, quality: g.quality || "白", desc: g.desc || "" }),
    id: `${npc.id || "npc"}_gloot_${i}`,
    equipped: false,
  }));

  // 之前掉落银两只看体魄（1-10的小范围），红袍高手和白袍杂鱼身家统计上没区别，
  // 跟"品阶对应身家"这个直觉对不上。baseAtk 已经是按品阶指数增长的数（见
  // getTierPower），这里直接拿来做银两的主要来源，体魄只作为同档位内的小幅浮动。
  const bodyStat = npc.special?.体魄 ?? 5;
  const baseMoney = 10 + Math.round((npc.baseAtk ?? 18) * 0.5) + bodyStat * 3;
  const droppedMoney = baseMoney + Math.floor(Math.random() * baseMoney * 0.6);

  return { droppedItem, droppedMoney, guaranteedLoot };
}

import { computePassiveBonus } from "./kungfu/qucuoKungfu.js";
// 装备与物品系统
// 三大分类（武器/护甲/饰品）各自不限数量存放在背包里，
// 但同一时间只有被标记为"已装备"的那些才真正生效，其余是背包存货。
//
// 物品品质：白(common) 绿(uncommon) 蓝(rare) 紫(epic) 橙(legendary) 红(mythic)
// 概率分布随七维属性"气运"（0-10）在两条分布之间线性插值：
//   气运0（基础）：白50 绿30 蓝10 紫8 橙1.5 红0.5
//   气运10（顶峰）：白0  绿20 蓝20 紫20 橙20 红20
// 数学上是简单的线性混合 t = 气运/10，两端边界精确对应上述数值，且始终合计100%。

export const QUALITY = ["白", "绿", "蓝", "紫", "橙", "红"];

export const QUALITY_COLOR = {
  白: "#c8bfa0", 绿: "#5dcaa5", 蓝: "#5a9bd4", 紫: "#b48adf", 橙: "#e0954a", 红: "#e0526a",
};

const BASE_DIST = [50, 30, 10, 8, 1.5, 0.5];
const PEAK_DIST = [0, 20, 20, 20, 20, 20];

// 根据气运（0-10，超出范围会被裁剪）返回六档品质的概率分布（百分比，合计100）
export function qualityDistribution(luck) {
  const g = Math.max(0, Math.min(10, luck));
  const t = g / 10;
  return BASE_DIST.map((b, i) => b + (PEAK_DIST[i] - b) * t);
}

// 按分布随机抽取一个品质
export function rollQuality(luck) {
  const dist = qualityDistribution(luck);
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) return QUALITY[i];
  }
  return QUALITY[QUALITY.length - 1]; // 浮点误差兜底
}

// 物品分类
export const ITEM_CATEGORY = {
  WEAPON: "weapon", ARMOR: "armor", ACCESSORY: "accessory", MISC: "misc",
};

export const CATEGORY_LABEL = {
  weapon: "武器", armor: "护甲", accessory: "饰品", misc: "杂物",
};

// 统一物品对象结构：{ id, name, category, quality, equipped, desc, ...statsForQuality(category, quality) }
// 数值字段（atk/def/durability/bonus）由系统根据分类+品质自动计算，不接受调用方覆盖，
// 这是"系统裁决"的关键一环：AI 只能决定 name/desc/category/quality，具体数值永远是同一套公式算出来的。
//
// 价格同理系统裁决：买入价按与atk/def同一套QUALITY_RATIO指数曲线缩放，品质越高越贵，
// 跟装备强度增长曲线保持协调，不是另起一套不相关的定价体系。卖出价固定是买入价的一半——
// 这是通用游戏经济学的常见做法，防止"刚买立刻原价卖出"这种无风险套利刷钱的漏洞。
const BASE_BUY_PRICE = { weapon: 30, armor: 25, accessory: 20, misc: 10 };

export function priceForQuality(category, quality) {
  const base = BASE_BUY_PRICE[category] ?? BASE_BUY_PRICE.misc;
  const buyPrice = scaledValue(base, quality);
  const sellPrice = Math.max(1, Math.round(buyPrice / 2));
  return { buyPrice, sellPrice };
}

// 智谋影响买价折扣：会算计、懂门道，掌柜给的价更低。智谋5=原价，每高于5一点打2%折，
// 每低于5一点加2%（智谋10→九折，智谋0→1.1倍）。折扣仅作用于"买入"，卖出不受影响。
// 返回向上取整的实付价（至少1）。
export function discountedBuyPrice(buyPrice, wit = 5) {
  const w = Math.max(0, Math.min(10, wit));
  const coef = 1 - (w - 5) * 0.02; // 智谋10→0.9，5→1.0，0→1.1
  return Math.max(1, Math.ceil(buyPrice * coef));
}

export function makeItem({ name, category = ITEM_CATEGORY.MISC, quality = "白", desc = "",
                           effect, sixDim, consumable, tags } = {}) {
  return {
    id: `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name, category, quality, equipped: false, desc,
    ...statsForQuality(category, quality),
    ...priceForQuality(category, quality),
    // 【必须收下 effect/sixDim】此前这个解构参数只列了 name/category/quality/desc，
    // 调用方传进来的 effect 与 sixDim **被静默丢掉**——打造/定制出来的装备因此
    // 只剩 statsForQuality 给的基础攻防，词条与六维加成一概没有。
    // 玩家的体感就是"打造装备的特效全不生效，加根骨加气运也没加上"。
    // 消费侧一直是好的（computeEquippedStats 聚合 sixDimBonus、effectiveSpecial
    // 叠到七维、mergeItemEffects 叠到招式，单挑与2v2两条战斗路径都接了），
    // 断的是这一处生产侧。
    ...(effect ? { effect: { ...effect } } : {}),
    ...(sixDim ? { sixDim: { ...sixDim } } : {}),
    ...(consumable ? { consumable: { ...consumable } } : {}),
    ...(tags ? { tags: [...tags] } : {}),
  };
}

// 从背包里筛出某个分类当前"已装备"的物品列表
export function getEquipped(inv, category) {
  return inv.filter(i => typeof i === "object" && i.category === category && i.equipped);
}

// 切换某件物品的装备状态（系统裁决层：不限制同分类装备数量）
export function toggleEquip(inv, itemId) {
  return inv.map(i => (typeof i === "object" && i.id === itemId) ? { ...i, equipped: !i.equipped } : i);
}

// 供 system prompt 使用：把背包状态转成简明文本
export function describeEquipment(inv) {
  const cats = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
  return cats.map(cat => {
    const equipped = getEquipped(inv, cat).map(i => `${i.name}(${i.quality})`);
    return `${CATEGORY_LABEL[cat]}:${equipped.length ? equipped.join("、") : "无"}`;
  }).join(" ");
}

// ── 品阶数值曲线 ──
// 参考《装备品阶系统设计文档》：六档品质之间用指数增长，
// ratio = 20^(1/5) ≈ 1.8206，白到红全程相差恰好 20 倍。
// 数值(i) = base × ratio^i，i 为品质索引（白=0 ... 红=5）
export const QUALITY_RATIO = Math.pow(20, 1 / 5);

export function qualityIndex(quality) {
  const i = QUALITY.indexOf(quality);
  return i === -1 ? 0 : i;
}

// 给定某分类的基准值，返回该品质下的实际数值（四舍五入取整）
export function scaledValue(base, quality) {
  return Math.round(base * Math.pow(QUALITY_RATIO, qualityIndex(quality)));
}

// 三大分类的基准值（对应文档里"长矛/羊皮袄/信物"的白档数值），
// 用于系统生成随机装备时，根据品质自动算出对应的攻防/耐久/加成数值。
// 饰品不走攻防曲线，而是用小基数的数值加成（辅助定位），主战场是特殊状态文字。
export const CATEGORY_BASE = {
  weapon: { atk: 7, durability: 20 },   // 白7 → 红100（见 WEAPON_ATK_RATIO）
  armor: { def: 5, durability: 25 },    // 白5 → 红80（见 ARMOR_DEF_RATIO）
  // 饰品不给攻防也不再给那个 bonus 小数——它的战力全在 sixDim 与 effect 上，
  // 跟武器的 atk、护甲的 def 是平级的真字段，界面照样显示。
  // 【bonus 为什么删干净】它是白0.3→红6 的一串小数，界面上打印成「+3.3」，
  // 但战斗里**没有任何一处读它**：伤害公式、防御公式、七维都不碰。
  // 本文件原注释自己也承认「具体挂靠哪个属性由 desc/特殊状态文字体现」——
  // 也就是说它从设计上就只是风味，却长了一副战力数值的样子骗了玩家很久。
  accessory: { durability: 25 },
  misc: {},
};

// 武器攻击力（装备攻击力）、护甲防御力各自独立的品质曲线——不再沿用统一的
// QUALITY_RATIO（20倍跨度），而是按设计者给定的具体区间反推比例：
// 武器 7→100（约14.3倍），护甲 5→80（16倍）。两者都用于 resolveTurn.js 的
// 新伤害公式：攻击输出=(baseAtk+装备攻击力)×招式倍率×体魄系数；
// 防御力=(基础防御力+装备防御力)×防御系数(招式)×根骨系数，攻击输出减防御力
// 得到最终伤害（见 combat/resolveTurn.js 顶部注释）。
export const WEAPON_ATK_RATIO = Math.pow(CATEGORY_BASE.weapon.atk > 0 ? 100 / CATEGORY_BASE.weapon.atk : 1, 1 / 5);
export const ARMOR_DEF_RATIO = Math.pow(CATEGORY_BASE.armor.def > 0 ? 80 / CATEGORY_BASE.armor.def : 1, 1 / 5);

// 根据分类和品质，生成对应的数值字段（供 makeItem 或系统随机生成装备时调用）
export function statsForQuality(category, quality) {
  const base = CATEGORY_BASE[category];
  if (!base) return {};
  const stats = {};
  const i = qualityIndex(quality);
  if (base.atk != null) stats.atk = Math.round(base.atk * Math.pow(WEAPON_ATK_RATIO, i));
  if (base.def != null) stats.def = Math.round(base.def * Math.pow(ARMOR_DEF_RATIO, i));
  if (base.durability != null) stats.durability = scaledValue(base.durability, quality);
  return stats;
}

// 计算玩家当前已装备的武器/护甲总加成（用于后续战斗公式接入）。
// 【接线扩展】除攻防外，聚合已装备物品（含饰品）的 effect（武学特效标志位）
// 和 sixDim（六维加成）——这是"具名/制式物品特效进游戏"的核心出口：
//   - equipEffects：把所有已装备件的 effect 合并成一个对象，战斗时叠到玩家招式上
//   - sixDimBonus：把所有已装备件的 sixDim 累加，供 effectiveSpecial 汇总
// effect 合并规则：数值型标志位取"更强的一件"（避免堆装备无限叠伤），
// 布尔型 true 覆盖，对象型（applyMark/enemyCostPenalty）取 stacks/value 更大的一件。
export function computeEquippedStats(inv) {
  const weapons = getEquipped(inv, ITEM_CATEGORY.WEAPON);
  const armors = getEquipped(inv, ITEM_CATEGORY.ARMOR);
  const accessories = getEquipped(inv, ITEM_CATEGORY.ACCESSORY);
  const allEquipped = [...weapons, ...armors, ...accessories];

  const equipEffects = mergeItemEffects(allEquipped);
  const sixDimBonus = {};
  for (const it of allEquipped) {
    if (it && typeof it === "object" && it.sixDim) {
      for (const [k, v] of Object.entries(it.sixDim)) sixDimBonus[k] = (sixDimBonus[k] || 0) + (Number(v) || 0);
    }
  }

  return {
    totalAtk: weapons.reduce((sum, i) => sum + (i.atk || 0), 0),
    totalDef: armors.reduce((sum, i) => sum + (i.def || 0), 0),
    equipEffects,
    sixDimBonus,
  };
}

// 合并多件装备的 effect 标志位成一个。取"更强的一件"，防止堆装备无限叠。
export function mergeItemEffects(items) {
  const out = {};
  // 【为什么要防 null/字符串】背包条目并非都是对象——纯剧情杂物是字符串
  // （"半袋青稞" 这类，见 presets/qucuo.js 的 inv），读档/迁移也可能留下空洞。
  // 原来直接 it.effect，遇到 null 就整个抛异常，而这函数在战斗进场时被调用，
  // 一炸就是"点了切磋直接崩"。
  for (const it of Array.isArray(items) ? items : []) {
    const e = it && typeof it === "object" ? it.effect : null;
    if (!e || typeof e !== "object") continue;
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === "boolean") {
        out[k] = out[k] || v;
      } else if (typeof v === "number") {
        out[k] = Math.max(out[k] ?? 0, v);
      } else if (v && typeof v === "object") {
        // applyMark:{name,stacks} / enemyCostPenalty:{value,turns} / detonateMark:{perStackRatio}
        const prev = out[k];
        const score = v.stacks ?? v.value ?? v.perStackRatio ?? 0;
        const prevScore = prev ? (prev.stacks ?? prev.value ?? prev.perStackRatio ?? 0) : -1;
        if (score > prevScore) out[k] = { ...v };
      }
    }
  }
  return out;
}

// 有效七维 = 基础七维 + 已装备物品的 sixDim 加成。
// 全项目凡是"要用玩家实际战力/属性"的地方（战斗组 side、属性判定、prompt 展示）
// 都应改读这个，而不是裸读 char.special——否则装备的六维加成就是死数据。
// 基础值缺省 5（跟 DEFAULT 七维一致），加成后不设上限（装备加成可以突破10，
// 跟修炼上限10是两回事：修炼是自身修为封顶，装备是外物临时增益）。
// 第三个参数 skills 是后加的：内功/轻功的 passiveBonus.speedBonus 要叠进「身法」。
// 那批被动此前完全没接线（computePassiveBonus 全项目没人调），梯云纵的身法+2、
// 独孤九剑的身法+2 都是死数据；resolveTurn 里同类型对撞比 special.身法 定先手，
// 所以叠在这里正是 qucuoKungfu.js 文件头承诺的那个用途。
// skills 省略时行为与从前完全一致，老调用点不传也不会变。
export function effectiveSpecial(baseSpecial, inv, skills) {
  const { sixDimBonus } = computeEquippedStats(inv || []);
  const out = { ...(baseSpecial || {}) };
  for (const [k, v] of Object.entries(sixDimBonus)) out[k] = (out[k] ?? 5) + v;
  const speed = computePassiveBonus(skills).speedBonus;
  if (speed) out.身法 = (out.身法 ?? 5) + speed;
  return out;
}


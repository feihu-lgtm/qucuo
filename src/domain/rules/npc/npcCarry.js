// NPC 随身物品生成（自 npcGeneration.js 拆出）：旧匿名池
// generateNpcCarriedItems + 四池版 rollNpcCarry（role×region×levelCap 抽 catalog 真货）。
import { random } from "../../../utils/rng.js";
import { rollQuality, QUALITY, makeItem, ITEM_CATEGORY } from "../economy/equipment.js";
import { makeNamedItem, CATALOG_INDEX } from "../../data/items/catalog.js";
import { ITEM_DISTRIBUTION } from "../../data/items/distribution.js";
import { ROLE_CARRY, levelCapToRole, regionOf } from "../../data/items/regionMap.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

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
function generateNpcCarriedItems(npc, { luck = 5, count = null, levelCap = 0 } = {}) {
  const cap = Math.max(0, Math.min(5, levelCap));
  const itemCount = count ?? (1 + cap + Math.floor(random() * 3));
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const rolled = rollQuality(luck);
    const quality = QUALITY[Math.max(QUALITY.indexOf(rolled), cap)];
    const pool = CARRIED_ITEM_POOL[quality] || CARRIED_ITEM_POOL["白"];
    const picked = pool[Math.floor(random() * pool.length)];
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
// 身份必带物件（合稿「丐帮·七、7.1」加分行为的信物来源）：该身份的游民身上
// 必定有这件东西，切磋/击杀掉落、偷窃都能拿到，交给对应人物换势力声誉。
const ROLE_TROPHY = {
  // faction：只有这个势力的该身份才带凭证——锦官城差役不带土司府的流亡凭证。
  血刀部游骑: { item: "血刀信物", faction: "天龙教" },
  巡丁: { item: "流亡凭证", faction: "土司府" },
  税吏: { item: "流亡凭证", faction: "土司府" },
  差役: { item: "流亡凭证", faction: "土司府" },
};

// ── OC 冒险者随身物：stealables 落地 ─────────────────────────────
// OC 的 stealables{equipment[],sundries[]} 就是"可偷=可掉=所见即所得"那批货：
// equipment 按品阶走（衣甲/兵刃/饰品按名分档），sundries 是杂物白档；
// carry 里的 CATALOG_INDEX 真词条照旧按具名货出。命中 OC 直接整批返回，
// 不再走 role×region 随机池——人设写的私物不能换成地摊货。
export const OC_BY_NAME = Object.fromEntries(
  [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP].map((adv) => [adv.name, adv]),
);
// 名字撞车分辨：OC 数据里的人可能同时是某地驻场 NPC（姬无双/樊未离）。
// 只有确认为 OC 实例——游走层标 ocAdventurer、地宫遭遇标 npcRef、或整张
// 人设卡展开带 rainbowStyle——才走 OC 私物通路；同名驻场保留自己的 carry。
export const isOcNpc = (npc) => {
  const oc = OC_BY_NAME[npc?.name];
  return !!oc && (npc.ocAdventurer === oc.id || npc.npcRef === oc.id || npc.rainbowStyle === oc.rainbowStyle);
};
// 先饰品后兵刃：环/镯/坠/簪 这类字眼首饰和奇门兵刃（子午鸳鸯环、判官笔）都沾，
// 首饰是常态、兵刃是特例——饰品档排前面兜底，判官笔/铁扇这类具名兵刃单独命中。
const EQUIP_CAT = [
  [/裙|甲|袍|衣|装|裤|靴|帽|冠|披风|衫|蓑/, ITEM_CATEGORY.ARMOR],
  [/珮|佩|坠|簪|镯|环|戒|珠|钗|钿|链|坠|缨|络|串/, ITEM_CATEGORY.ACCESSORY],
  [/刀|剑|鞭|爪|钩|匕|刃|杖|弓|锤|锏|枪|矛|戟|槊|棍|叉|斧|钺|判官笔|判官|飞针|袖箭|弩|暗器|铁扇/, ITEM_CATEGORY.WEAPON],
];
function ocEquipCat(name) {
  for (const [re, cat] of EQUIP_CAT) if (re.test(name)) return cat;
  return ITEM_CATEGORY.ACCESSORY;
}
export function ocCarryItems(oc, npc) {
  const items = [];
  let i = 0;
  for (const c of oc.carry || []) {
    const it = makeNamedItem(c.name);
    if (it) items.push({ ...it, id: `${npc.id}_oc${i++}`, stolen: false });
  }
  for (const e of oc.stealables?.equipment || []) {
    const it = makeItem({ name: e.name, category: ocEquipCat(e.name), quality: e.quality || "绿" });
    items.push({ ...it, desc: e.desc, id: `${npc.id}_oc${i++}`, stolen: false });
  }
  for (const d of oc.stealables?.sundries || []) {
    const it = makeItem({ name: d.name, category: ITEM_CATEGORY.MISC, quality: "白" });
    items.push({ ...it, desc: d.desc, id: `${npc.id}_oc${i++}`, stolen: false });
  }
  return items;
}

export function rollNpcCarry(npc, { luck = 5, levelCap = 0, region } = {}) {
  const cap = Math.max(0, Math.min(5, levelCap));
  if (isOcNpc(npc)) {
    const items = ocCarryItems(OC_BY_NAME[npc.name], npc);
    if (items.length) return items;
  }
  // 路上偶遇的游民只有 brief 文案没有 role 字段（信物身份从文案里认），
  // 常驻/任务 NPC 走 npc.role，再没有就用 levelCap 兜底成通用身份。
  const role = npc.role
    || Object.keys(ROLE_TROPHY).find((r) => npc.brief?.includes(r))
    || levelCapToRole(cap);
  const trophySpec = ROLE_TROPHY[role];
  const factionText = `${npc.faction || ""}${npc.brief || ""}`;
  const trophy = trophySpec && factionText.includes(trophySpec.faction) ? trophySpec.item : undefined;
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
  const n = Math.min(hi, lo + bias + Math.floor(random() * (hi - lo + 1)));
  if (!candidates.length || n <= 0) {
    // 该地域该身份没有对味候选 → 回退旧匿名池，保证不空手崩溃；信物照挂。
    const fallback = generateNpcCarriedItems(npc, { luck, count: Math.max(1, n), levelCap: cap });
    if (trophy && !fallback.some((it) => it.name === trophy)) {
      const it = makeNamedItem(trophy);
      if (it) return [...fallback, { ...it, id: `${npc.id}_trophy`, stolen: false }];
    }
    return fallback;
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
    const idx = Math.floor(random() * bag.length);
    const name = bag.splice(idx, 1)[0];
    const it = makeNamedItem(name);
    if (it) items.push({ ...it, id: `${npc.id}_ci${i}`, stolen: false });
  }
  const result = items.length ? items : generateNpcCarriedItems(npc, { luck, count: 1, levelCap: cap });
  if (trophy && !result.some((it) => it.name === trophy)) {
    const it = makeNamedItem(trophy);
    if (it) result.push({ ...it, id: `${npc.id}_trophy`, stolen: false });
  }
  return result;
}

// ── 随身交易 schema（docs/设计_NPC随身交易.md §1）──────────────────
// carry/stealables/follower 条目统一归一化为
// {name, category, quality, slot, sellable, price, cherish}：
// slot 三档 equipment=身上装备 / bag=包袱杂物 / mount=坐骑随从（铁伯这类也算）。
// cherish 钟爱度 0-100，越高越不肯脱手；sellable=false 的给多少钱都不卖。
const CARRY_QUALITY_CHERISH = { 白: 15, 绿: 30, 蓝: 45, 紫: 60, 橙: 75, 红: 90 };
const CARRY_TROPHY_RE = /信物|凭证|令牌|弟子令|令旗|虎符|印信|腰牌|铁券|密匙|关防/;  // 势力信物：敢收也不敢卖
const CARRY_MANUAL_RE = /秘籍|剑谱|拳谱|刀谱|枪谱|心法|真经|秘录|秘本|图谱|手抄|抄本|要诀|诀窍|指要|残卷|古卷|密卷|经卷|典籍|笔录|手稿|拓本|原本/;  // 签名武学

// ── 随身交易读取层（D 单三分区 + E 单换装同步链）──────────────────
// 纯数据：归一化后的随身条目、三分区、♥密度、外露度。domain 层，
// 供 features（买卖链）与 ui（交易面板/look 卡）共用，不反向依赖 features。
import { ADVENTURER_BY_NAME } from "../../data/dungeon/adventurers.js";

const GEAR_CATS = new Set([ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]);

export function normalizeCarryEntry(_npc, entry = {}) {
  const isFollower = !entry.category && (entry.type || entry.slot === "mount");
  const name = entry.name || "";
  // 类目/品阶缺省时查名录补：stealables 装备多数没写 category，名录有词条的按词条走
  const catEntry = name ? CATALOG_INDEX[name] : null;
  const category = entry.category || catEntry?.category || (isFollower ? null : ITEM_CATEGORY.MISC);
  const quality = entry.quality || catEntry?.quality || "白";
  // slot：显式标注优先；随从对象→mount；装备→equipment；杂物→bag
  const slot = entry.slot
    || (isFollower ? "mount" : category === ITEM_CATEGORY.MISC ? "bag" : "equipment");
  // 默认推导（§1.2 表）：misc 可卖 0 钟爱；武器装备饰品 品阶×15；
  // 信物 90 不卖；mount 100 不卖；签名武学 80 不卖。
  let cherish, sellable;
  if (slot === "mount") { cherish = 100; sellable = false; }
  else if (CARRY_TROPHY_RE.test(name + (entry.desc || ""))) { cherish = 90; sellable = false; }
  else if (CARRY_MANUAL_RE.test(name + (entry.desc || ""))) { cherish = 80; sellable = false; }
  else if (slot === "bag") { cherish = 0; sellable = true; }
  else { cherish = CARRY_QUALITY_CHERISH[quality] ?? 15; sellable = true; }
  return {
    ...entry,
    category,
    quality,
    slot,
    cherish: entry.cherish ?? cherish,
    sellable: entry.sellable ?? sellable,
    // 价：明写优先；catalog 真货取定价；编外条目按品阶推算（mount 不卖，价可空）
    price: entry.price ?? CATALOG_INDEX[name]?.buyPrice
      ?? (category ? makeItem({ name, category, quality }).buyPrice : null),
  };
}

// 钟爱密度标记：≥80 三颗、≥50 两颗、其余一颗或不标（bag 杂物 0 钟爱不标）
export function cherishHearts(cherish = 0) {
  if (cherish >= 80) return "♥♥♥";
  if (cherish >= 50) return "♥♥";
  if (cherish > 0) return "♥";
  return "";
}

// 取一个 NPC 的随身条目清单（归一化）：优先读房间 npc 身上的 live 列表
// （sold/stolen 标记写在这里），静态 adv 卡只作不在场时的表底——表底不能只
// 读 carry：OC 的装备在 stealables.equipment、随从在 follower，都得拼进来。
const advAllEntries = (adv) => [
  ...(adv?.carry || []),
  ...(adv?.stealables?.equipment || []),
  ...(adv?.stealables?.sundries || []),
  ...(adv?.follower ? [adv.follower] : []),
];
export function carryTradeEntries(npc) {
  // OC_BY_NAME 覆盖两份卡池（含 adventurersIP），ADVENTURER_BY_NAME 只认主池。
  const adv = OC_BY_NAME[npc?.name] || ADVENTURER_BY_NAME[npc?.name];
  // 读取源三级：live carriedItems（战斗化 NPC）→ 房间实例自带 spread 字段
  // （OC 的 carry/stealables/follower 摊开在他身上，sold 标记写在这里读得见）
  // → 静态 adv 卡表底（不在场时查表）→ npc.carry 宪底。
  const inst = advAllEntries(npc);
  const raw = (npc?.carriedItems?.length ? npc.carriedItems : null)
    || (inst.length ? inst : null)
    || (adv ? advAllEntries(adv) : null)
    || npc?.carry
    || [];
  // 挂载位：随从不是物品、不在 carriedItems 里，但货架挂载区要展示——单独补一行。
  const follower = npc?.follower || adv?.follower;
  const entries = follower && !raw.some((e) => e?.name === follower.name) ? [...raw, follower] : raw;
  return entries
    .filter((e) => e && !e.sold && !e.stolen && !e.dropped)
    .map((e) => normalizeCarryEntry(npc, e));
}

// 三分区：{equipment:[], bag:[], mount:[]}
export function carryTradeSections(npc) {
  const sections = { equipment: [], bag: [], mount: [] };
  for (const e of carryTradeEntries(npc)) {
    sections[e.slot === "mount" ? "mount" : e.slot === "bag" ? "bag" : "equipment"].push(e);
  }
  return sections;
}

// 装备区外露度：equipment 区被扒到只剩饰物/一件不剩时算私密外露。
export function attireExposure(npc) {
  // 没有任何随身数据的 NPC 不算「被扒光」——他本就没穿过，报暴露是误判。
  const adv = OC_BY_NAME[npc?.name] || ADVENTURER_BY_NAME[npc?.name];
  const inst = advAllEntries(npc);
  const raw = inst.length ? inst : (adv ? advAllEntries(adv) : npc?.carriedItems);
  if (!raw?.length) return null;
  const gear = carryTradeEntries(npc).filter((e) => e.slot === "equipment" && GEAR_CATS.has(e.category));
  const hasArmor = gear.some((e) => e.category === ITEM_CATEGORY.ARMOR);
  const hasAccessory = gear.some((e) => e.category === ITEM_CATEGORY.ACCESSORY);
  const hasWeapon = gear.some((e) => e.category === ITEM_CATEGORY.WEAPON);
  // 还披甲/还带兵刃都不算暴露——暴露只留给「只剩饰物」与「一件不剩」两档。
  if (hasArmor || hasWeapon) return null;
  if (hasAccessory) return "只剩零星饰物在身";
  return "衣不蔽体";
}

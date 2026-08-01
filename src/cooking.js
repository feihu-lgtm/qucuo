// ============================================================================
// 烹饪系统 —— 技法 / 炊具 / 配方 数据与裁决逻辑
// ----------------------------------------------------------------------------
// 设计稿：docs/烹饪系统_食材调味品设计稿.md
// 六格槽位：料×4（调味料/食材混装）+ 技法×1 + 炊具×1。
// 配方 = 料槽组合（不分先后）× 技法；炊具只加成不锁配方（蒸需蒸笼）。
// 本模块是纯数据 + 纯函数，不碰 React / 存档，方便单测。
// ============================================================================

// ── 技法（5 种）──────────────────────────────────────────────────────────
// hpMul：对配方基础 hpRestore 的倍率（此处仅作叙事/UI 展示，实际回血由配方
//        自身的 hpRestore 硬编码，倍率留给日后"自由组合无配方"的保底炖汤用）。
// needsSteamer：蒸必须有带 canSteam 的炊具。
export const TECHNIQUES = {
  炖: { id: "炖", icon: "🍲", hpMul: 1.5, turns: 40, needsSteamer: false,
    desc: "文火慢煨，什么都能炖。不挑调料，新手保底。" },
  炒: { id: "炒", icon: "🥘", hpMul: 1.2, turns: 25, buffAttr: "身法", needsSteamer: false,
    desc: "旺火快炒，锅气足。出餐快，身法 buff 短而实用。" },
  烤: { id: "烤", icon: "🔥", hpMul: 1.3, turns: 30, buffAttr: "体魄", needsSteamer: false,
    desc: "明火炙烤，肉食加成。焦香入骨，体魄 buff。" },
  腌: { id: "腌", icon: "🫙", hpMul: 0.6, turns: 50, buffVal: 2, needsSteamer: false,
    desc: "盐醋封坛，日久味长。回血低但 buff 最持久，跑图前备。" },
  蒸: { id: "蒸", icon: "♨", hpMul: 1.8, turns: 40, needsSteamer: true,
    desc: "竹笼水汽，原味不夺。效果最强，需蒸笼。" },
};
export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

// ── 炊具（10 件）─────────────────────────────────────────────────────────
// hpBonus / turnsBonus：按技法键或 all 键加成。canSteam：是否支持蒸。
// default：溪边旧铁锅，灶房自带，永远可用，不进背包也能开火。
export const COOKWARE = [
  { id: "jiutieguo", name: "溪边旧铁锅", quality: "白", default: true, canSteam: false,
    hpBonus: {}, turnsBonus: {},
    desc: "锅沿磕了三个豁口，鱼定大娘说补补还能用十年。灶房自带，炖炒皆可。" },
  { id: "chaoguo", name: "孟记熟铁炒锅", quality: "绿", canSteam: false,
    hpBonus: {}, turnsBonus: { 炒: 5 },
    desc: "孟铁匠锻的，锅气足，炒什么都香。炒 buff +5 回合。" },
  { id: "taoguan", name: "熊山陶炖罐", quality: "白", canSteam: false,
    hpBonus: { 炖: 0.05 }, turnsBonus: {},
    desc: "熊山红陶，炖汤不夺味，摔不烂。炖回血 +5%。" },
  { id: "zhenglong", name: "竹编蒸笼（三层）", quality: "绿", canSteam: true,
    hpBonus: {}, turnsBonus: {},
    desc: "雅江冷箭竹编的，蒸出来带竹香。唯一能上蒸的炊具。" },
  { id: "kaojia", name: "跑马会炭烤架", quality: "绿", canSteam: false,
    hpBonus: {}, turnsBonus: { 烤: 5 },
    desc: "铁条焊的，烤全羊都架得住。烤 buff +5 回合。" },
  { id: "caitan", name: "黑风寨腌菜坛", quality: "白", canSteam: false,
    hpBonus: {}, turnsBonus: { 腌: 10 },
    desc: "坛沿水封得严实，腌三年不坏。腌 buff +10 回合。" },
  { id: "tonghu", name: "铜吊壶", quality: "绿", canSteam: false,
    hpBonus: { 炖: 0.03 }, turnsBonus: {},
    desc: "煮茶煮汤两相宜，铜绿养出来了。炖回血 +3%。" },
  { id: "shizaofu", name: "雪山派石灶釜", quality: "蓝", canSteam: true,
    hpBonus: { all: 0.08 }, turnsBonus: {},
    desc: "雪山顶寒铁铸的，导热极匀。全技法回血 +8%，亦可蒸。" },
  { id: "falan", name: "锦官城珐琅砂锅", quality: "蓝", canSteam: false,
    hpBonus: { 炖: 0.05 }, turnsBonus: { 腌: 10 },
    desc: "官窑珐琅彩，柳青鸢办公桌上炖汤用的同款。炖 +5%，腌 buff +10。" },
  { id: "qingtongding", name: "三星堆仿青铜鼎", quality: "紫", canSteam: true,
    hpBonus: { all: 0.12 }, turnsBonus: { all: 10 },
    desc: "鸭子河畔淘沙人挖出来的，仿商周制式。全技法回血 +12%、buff +10，炖肉有金石气。" },
];
export const COOKWARE_BY_ID = Object.fromEntries(COOKWARE.map(c => [c.id, c]));
export const DEFAULT_COOKWARE_ID = "jiutieguo";

// ── 配方（10 道）─────────────────────────────────────────────────────────
// materials：料槽组合，不分先后（裁决时排序归一化比对）。
// hpRestore：基础回血比例（占最大气血）。buffs：临时六维 [{attr,val,turns}]。
export const RECIPES = [
  { name: "牦牛骨汤", technique: "炖", materials: ["牦牛腱子肉", "贡措海盐"],
    hpRestore: 0.18, buffs: [],
    desc: "骨髓熬化了，汤白得像奶。卓玛说这汤是给病人喝的——不是药，但比药暖。" },
  { name: "松茸炖雪鸡", technique: "炖", materials: ["雪山雪鸡肉", "熊山松茸", "贡措海盐"],
    hpRestore: 0.30, buffs: [{ attr: "悟性", val: 1, turns: 30 }],
    desc: "何雨谢亲手炖的，小火煨一天一夜。呼延雪说师母只炖过三次。" },
  { name: "烤藏香猪", technique: "烤", materials: ["藏香猪五花", "大草甸孜然"],
    hpRestore: 0.20, buffs: [{ attr: "体魄", val: 2, turns: 30 }],
    desc: "吃松果野菌长大的，烤起来一股松脂香。呼延雪闻闻味道就当吃过了。" },
  { name: "烤黄羊腿", technique: "烤", materials: ["大草甸黄羊腿", "贡措海盐", "大草甸孜然"],
    hpRestore: 0.25, buffs: [{ attr: "体魄", val: 2, turns: 30 }],
    desc: "跑马大会集市上现烤的，孜然辣椒撒得厚。梅朵每年跑完马都要吃半条。" },
  { name: "冷锅鱼", technique: "炒", materials: ["青衣江团鱼", "熊山花椒", "雅江菜籽油"],
    hpRestore: 0.22, buffs: [{ attr: "身法", val: 2, turns: 25 }],
    desc: "青衣楼招牌。冷锅底料铺七分熟鱼片，不开火先吃鱼。不吃冷锅鱼等于没来过雅江。" },
  { name: "熊猫笋炒腊肉", technique: "炒", materials: ["熊猫笋", "牦牛腱子肉", "熊山花椒"],
    hpRestore: 0.15, buffs: [{ attr: "身法", val: 1, turns: 25 }],
    desc: "熊猫啃剩的冷箭竹笋尖配腊肉，嫩得能掐出水。护谷弟子说别捡——但确实好吃。" },
  { name: "酸汤裂腹鱼", technique: "腌", materials: ["贡措海裂腹鱼", "黑风寨苞谷醋", "贡措海盐"],
    hpRestore: 0.10, buffs: [{ attr: "根骨", val: 2, turns: 50 }],
    desc: "苞谷醋腌的裂腹鱼，酸得开胃。丹增说这鱼自带盐味，是贡措海的眼泪。" },
  { name: "腊牦牛肉", technique: "腌", materials: ["牦牛腱子肉", "贡措海盐", "熊山花椒"],
    hpRestore: 0.08, buffs: [{ attr: "体魄", val: 2, turns: 50 }],
    desc: "盐与花椒封坛，风干半月。含在嘴里慢慢泡软，一块能吃一上午。" },
  { name: "雪莲蒸蛋", technique: "蒸", materials: ["雪山雪莲瓣", "牦牛奶酪", "贡措海盐"],
    hpRestore: 0.35, buffs: [{ attr: "悟性", val: 2, turns: 40 }],
    desc: "雪莲瓣入蛋，竹笼水汽一蒸，清苦回甘。何雨谢一年只许采三瓣雪莲。" },
  { name: "松茸蒸鸡", technique: "蒸", materials: ["雪山雪鸡肉", "熊山松茸", "喇嘛庙藏红花"],
    hpRestore: 0.40, buffs: [{ attr: "悟性", val: 2, turns: 40 }],
    desc: "藏红花染出金黄，松茸提鲜。住持说佛前的东西不能浪费，入膳也是修行。" },
];

// 料槽组合归一化键：去重、排序、竖线拼接（比对不分先后）
function normKey(names) {
  return [...new Set((names || []).filter(Boolean))].sort().join("|");
}

// ── 食材/调味料风物志（供 AI 出菜时引导想象，"我的描述"）─────────────────
// 键是物品名，值是一句风物白描。cookDesign 把命中料的条目拼进 prompt，
// AI 据此给自由组合的菜起名、写说书人风味介绍——想象有据，不凭空瞎编。
export const INGREDIENT_LORE = {
  // 调味料
  熊山花椒: "麻得舌尖打颤，冷锅鱼底料的灵魂，产自曲措乡熊山。",
  贡措海盐: "咸而微甘，贡措海畔石上自结的霜，不是晒的，是湖水自己结的。",
  锦官豆瓣酱: "咸鲜微辣回甜，晒足一年方出缸，锦官城菜的底子。",
  雅江菜籽油: "青香微辛，冷榨而成，青衣楼冷锅鱼就用这个油。",
  雪山野蜂蜜: "甜带松脂气，量极少，何雨谢一年只收两罐。",
  大草甸孜然: "辛香暖人，马帮从西域带回，跑马会烤肉必备。",
  黑风寨苞谷醋: "酸得粗粝，苞谷酒糟二次发酵，巴桑说酸得正。",
  喇嘛庙藏红花: "微苦暖香，能染色，入药入膳两用，佛前的东西不浪费。",
  天都镇酱油: "咸鲜焦香，黄豆晒制，孟铁匠打铁间隙翻缸。",
  鱼定村野葱油: "辛甜葱香浓，鱼定大娘春天熬的，一罐用半年。",
  // 山珍
  熊山松茸: "菌香浓，不可水洗，洗了就没了山的味道，要用小刀刮泥松针擦。",
  青城山蕨菜: "嫩滑微涩，青城后山所产，松鹤道长说练完剑吃这个清火。",
  熊山铁棍山药: "粉糯黏液多，熊山北坡沙土里挖，一杆下去三尺深。",
  雪山雪莲瓣: "清苦回甘冰凉，雪山顶峰雪莲心里采，何雨谢一年只许采三瓣。",
  贡措海苔花: "鲜而微腥，贡措海浅滩石上刮的，丹增说那是湖底长上来的头发。",
  大草甸野韭: "辛香冲鼻，比家韭冲三倍，春天头茬最嫩。",
  // 水鲜
  狼曲冷水鱼: "肉细刺多鲜甜，狼曲上游石缝里，雪团拍水震鱼嘎则拿草绳串。",
  青衣江团鱼: "肉厚无刺胶质重，冷锅鱼的正主，青衣楼一天用二十条。",
  贡措海裂腹鱼: "肉紧微咸自带盐味，贡措海深处，一年只吃一次是丹增的规矩。",
  熊曲石斑: "肉嫩带苔香，熊曲急流石下，老孙钓的，一年只有两个月肥。",
  // 畜肉
  牦牛腱子肉: "纤维粗肉味浓，玉泉寨牧民散养，炖三时辰才烂，急不得。",
  藏香猪五花: "脂香带松果味，雪山派后山散养，吃松果野菌长大，烤起来满山香。",
  大草甸黄羊腿: "肉紧膻味轻，跑马大会烤全羊用的就是这个。",
  雪山雪鸡肉: "肉紧而嫩清炖最佳，加一味当归就够，加多了尝不出雪鸡自己的味。",
  牦牛奶酪: "奶香带一丝青草味，卓玛用自家牦牛奶做的鲜酪，春天吃野花的牛，奶做的酪是甜的。",
  // 蔬果豆谷
  熊猫笋: "嫩清甜带竹香，熊猫啃剩的冷箭竹笋尖，护谷弟子说别捡但确实好吃。",
  鱼定村青稞: "粗嚼劲足微甜，糌粑和青稞饼的原料。",
  玉泉寨土豆: "粉沙煮烂即化，不挑地，石头缝也长。",
  雅江嫩豆腐: "嫩豆香易碎，青衣江的水点的卤，别处做不出。",
  大草甸蘑菇: "鲜肉厚伞大，雨后草坡上的白伞，不能生吃。",
  锦官城干笋: "脆吸味耐煮，雅江鲜笋晒干运来，泡发要一夜。",
};

// 自由组合（无固定配方）时，AI 出菜名与介绍，数值由系统按技法保底裁决——
// 想象归想象，数值不许 AI 编（与赌石/锻造"创意归 AI、品质归系统"同一铁律）。
export function genericDishEffect(techniqueId, cookware, maxHp) {
  const tech = TECHNIQUES[techniqueId] || TECHNIQUES.炖;
  const base = { 炖: 0.12, 炒: 0.10, 烤: 0.11, 腌: 0.06, 蒸: 0.14 }[techniqueId] ?? 0.10;
  let hpRatio = base;
  let turnsAdd = 0;
  if (cookware) {
    const hb = cookware.hpBonus || {};
    hpRatio += (hb[techniqueId] ?? 0) + (hb.all ?? 0);
    const tb = cookware.turnsBonus || {};
    turnsAdd = (tb[techniqueId] ?? 0) + (tb.all ?? 0);
  }
  const buffs = [];
  if (tech.buffAttr) buffs.push({ attr: tech.buffAttr, val: 1, turns: tech.turns + turnsAdd });
  return {
    hpRatio,
    hpDelta: Math.round((maxHp || 100) * hpRatio),
    buffs,
  };
}

// 裁决：料槽组合 × 技法 → 命中配方或 null
export function matchRecipe(materialNames, techniqueId) {
  const key = normKey(materialNames);
  if (!key) return null;
  return RECIPES.find(r => r.technique === techniqueId && normKey(r.materials) === key) || null;
}

// 技法可用性：蒸必须有 canSteam 的炊具，其余技法任意炊具皆可
export function canUseTechnique(techniqueId, cookware) {
  if (TECHNIQUES[techniqueId]?.needsSteamer) return !!cookware?.canSteam;
  return true;
}

// 计算成品效果：基础回血 + 炊具加成 + buff（炊具只加成不锁配方）
// 返回 { name, technique, hpRatio, hpDelta, buffs, desc }
export function computeDish(recipe, techniqueId, cookware, maxHp) {
  let hpRatio = recipe.hpRestore;
  let turnsAdd = 0;
  if (cookware) {
    const hb = cookware.hpBonus || {};
    hpRatio += (hb[techniqueId] ?? 0) + (hb.all ?? 0);
    const tb = cookware.turnsBonus || {};
    turnsAdd = (tb[techniqueId] ?? 0) + (tb.all ?? 0);
  }
  return {
    name: recipe.name,
    technique: techniqueId,
    hpRatio,
    hpDelta: Math.round((maxHp || 100) * hpRatio),
    buffs: (recipe.buffs || []).map(b => ({ ...b, turns: b.turns + turnsAdd })),
    desc: recipe.desc,
  };
}

// 玩家拥有的炊具：默认旧铁锅永远在，其余按背包名匹配
export function ownedCookware(inv) {
  const names = new Set((inv || []).map(it => (typeof it === "object" ? it?.name : it)).filter(Boolean));
  return COOKWARE.filter(c => c.default || names.has(c.name));
}

// 可烹饪材料判定：tags 含 食材/调味品，或名字在配方用料里（兼容尚未补 tags 的在库件）
const RECIPE_MATERIALS = new Set(RECIPES.flatMap(r => r.materials));
export function isCookingMaterial(item) {
  if (!item) return false;
  const name = typeof item === "object" ? item?.name : item;
  const tags = (typeof item === "object" && Array.isArray(item?.tags)) ? item.tags : [];
  return tags.includes("食材") || tags.includes("调味品") || RECIPE_MATERIALS.has(name);
}

// 背包里可用的材料清单（按名去重计数）
export function availableMaterials(inv) {
  const counts = {};
  for (const it of inv || []) {
    if (!isCookingMaterial(it)) continue;
    const name = typeof it === "object" ? it?.name : it;
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

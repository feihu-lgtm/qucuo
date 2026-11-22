import "../../rules/content/loadDefaultContent.js";
import { getContent } from "../../rules/content/registry.js";
import { ITEM_CATEGORY, statsForQuality, priceForQuality } from "../../rules/economy/equipment.js";
// ============================================================================
// 曲措乡·百物录 —— 具名物品库（catalog）
// ============================================================================
//
// 【定位】这是"具名物品"的权威数据源。跟 equipment.js 的关系：
//   - equipment.js 的 statsForQuality/priceForQuality 是"匿名兜底公式"——
//     路途随机掉落、AI 临时生成的无名装备走那套（同品质同数值）。
//   - 本文件是"具名覆盖层"——霜牙、青鸢这类有来历的物品，吃自己的专属数值，
//     不再跟同品质的杂鱼一个数。查表命中具名 → 用这里的值；查不到 → 回退公式。
//
// 【攻防倍率 atkMul / defMul】用户拍板"倍率跟着公式走"：倍率不是新的乘法层，
//   而是乘在 equipment.js 公式算出的品质基准上，最终仍折成 equipAtk/equipDef
//   这个"加数"进 calcBaseDamage（见 makeCatalogItem）。范围 1.0~1.6 横跨六品阶：
//   同品质里，越贵重/越点题的物品倍率越高，但不会离谱到破坏同档平衡。
//     atk 基准(equipment.js WEAPON)：白7 绿12 蓝20 紫34 橙59 红100
//     def 基准(equipment.js ARMOR)：白5 绿9 蓝15 紫26 橙46 红80
//   例：红档"霜角"配 atkMul 1.6 → equipAtk = round(100×1.6)=160。
//
// 【特效 effect】用户拍板"直接复用武学标志位"。这里挂的字段名必须是
//   combat/resolveTurn.js 真正读取的那批（否则是死字段）。可复用白名单：
//     forceFirst 必先手 / ignoreDefense 无视防御 / doubleVsStatus 克状态翻倍
//     enemyCostPenalty 封穴(抬高对方耗气) / applyMark 内伤印 / detonateMark 引爆内伤
//     freezeEnergyRecovery 封气 / onCounterSuccessDamageRatio 应对反击
//     lowHpBonus 残血增伤 / afterStatusBonus 趁中招追击 / energyRestore 起手回气 …
//   物品的 effect 会在进入战斗时，被 combat 层当作"这件装备赋予的临时招式效果"
//   叠加到玩家/NPC 的对应招式上（接线见 equipment.computeEquippedStats 的扩展）。
//   注意：effect 只在"装备类"（武器/护甲/饰品）上有意义，且高品阶才配，低品阶留空。
//
// 【加六维 sixDim】特效的另一种形态（a特效 / b加六维，二选一为主）：
//   直接加 char.special 的七维（根骨/悟性/体魄/魅力/智谋/身法/气运），
//   数值小而克制（+1~+4），装备时生效、卸下时移除（接线同 effect）。
//
// 【AI 可读】文件末尾导出 CATALOG_INDEX（name→条目）和 describeCatalogForAI()，
//   后者把全部具名物品压成一段给主叙事 AI 看的参考文本，让 AI 知道"这个世界
//   里有哪些叫得出名字的物件、分别是什么来历/品级"，叙事时可以自然引用，
//   但 AI 只能引用/描述，不能篡改数值（数值永远由本表 + 公式裁决）。
// ============================================================================


// 特效类型速查（给维护者看，值本身直接用 resolveTurn 认的字段名）：
// 攻击向：forceFirst / ignoreDefense / doubleVsStatus / lowHpBonus / afterStatusBonus / detonateMark
// 控制向：enemyCostPenalty / freezeEnergyRecovery / applyMark
// 防御向：onCounterSuccessDamageRatio / onCounterSuccessEnergyGain
// 续航向：energyRestore / hpRestore

// ---------------------------------------------------------------------------
// 一、武器（20）
// ---------------------------------------------------------------------------
// 结构：{ name, category, quality, atkMul, effect?, sixDim?, desc }
//  - category 固定 weapon；effect/sixDim 二选一（也可都无，纯靠倍率吃饭）
//  - 白绿档基本只有倍率；蓝档偶有轻特效；紫橙红档才挂强特效或六维
export const WEAPONS = getContent("itemGroup", "WEAPONS").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 二、装备·衣甲（20）
// ---------------------------------------------------------------------------
// 护甲的特效重心天然落在"防御/反击/续航/挨打后变强"，不跟武器抢输出。
// defMul 范围同样 1.0~1.6 横跨六品阶，乘在 ARMOR def 基准（白5→红80）上。
// 高温放飞：几件故意玩"反常识"——越破越硬、越被打越回气、穿上像别人的味道。
export const ARMORS = getContent("itemGroup", "ARMORS").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 三、饰品（20）
// ---------------------------------------------------------------------------
// 饰品不占攻防主战场（accessory 没有 atk/def 基准，只有小 bonus），
// 所以它的价值几乎全在 sixDim（加六维）和 effect（挂武学特效）上——这是最能
// 放飞的一类。高温玩法：情感信物给气运/魅力这类"软"属性；邪门物件挂控制/封气；
// 残念执念之物玩残血博弈；甚至几件"负重"物件——强特效配一点属性反噬，让玩家权衡。
// atkMul 对饰品无意义（无武器基准），故饰品不写 atkMul/defMul，只写 effect/sixDim。
export const ACCESSORIES = getContent("itemGroup", "ACCESSORIES").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 翡翠玉器成品（20）——赌石系统产出/金玉行雕琢的成品，词条预制（对照
// docs/赌石_玉器与原石设计.md §1）。玉非利器，武器类靠"礼器/法器/暗器"立意；
// 护甲玉甲重身；饰品走增益与气运。白绿档基本只倍率，蓝档起才带特效/六维。
// jadeWare:true 标记它是"玉器成品"身份，供金玉行"选购成品/预制打造"柜台按此筛货。
// ---------------------------------------------------------------------------
export const JADE_WARES = getContent("itemGroup", "JADE_WARES").map(id => getContent("item", id));

// 四、杂货·药材食品（20）
// ---------------------------------------------------------------------------
// 归 misc（杂物），大多不进战斗结算，是叙事道具 / 任务辅料 / 商品。少数带
// consumable 字段的是"可服用消耗品"——用户"食材食品1-6"里第5、6批的雏形，
// 本轮先把即时效果占位（hpRestore/energyRestore/临时六维），战斗内外皆可用，
// 待食物 buff 系统（交接任务4）接通后正式生效。tags 标注它在世界里的用途，
// 供商店铺货和 AI 引用（辅料/毒药/燃料/信物类）。
export const SUNDRIES = getContent("itemGroup", "SUNDRIES").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 五、制式量产（武器10 / 装备10 / 饰品10）—— 江湖通货
// ---------------------------------------------------------------------------
// 跟上面"具名物件"是两个层次：具名是独一份、有来历、带私人故事的宝贝；制式是
// 成批打造、流派/产地/用途成套的量产货，铺满白→红全梯度，供商店常规铺货与
// 路途掉落。用户拍板：低中高各1-2个型号；只有少量高阶（紫橙红）制式挂"轻"特效
// （比具名物温和、更通用），白绿蓝素攻素防。制式的脑洞开在"批量特征"上——
// 某个门派/作坊/地域成套的制式风味，不写具体人名。standardIssue:true 标记通货身份。

// —— 制式武器10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_WEAPONS = getContent("itemGroup", "STANDARD_WEAPONS").map(id => getContent("item", id));

// —— 制式装备10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_ARMORS = getContent("itemGroup", "STANDARD_ARMORS").map(id => getContent("item", id));

// —— 制式饰品10（白2 绿2 蓝2 紫2 橙1 红1）——
export const STANDARD_ACCESSORIES = getContent("itemGroup", "STANDARD_ACCESSORIES").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 六、西南武林库·三十品 —— 更放飞的具名宝器
// ---------------------------------------------------------------------------
// 跟第一批具名物同层（named），但整体档次更高（橙紫居多）、脑洞更大、故事更满，
// 且多与现有人物/剧情深度勾连：断念之锷接缴获剑"断念"、青鸢尾/软鞭·柳接柳青鸢、
// 霜角弓接吊睛虎王+狼王、呼延雪的剑穗接雪山崖底真相……属"传世名器/私人信物"级。
// 数值同样倍率跟公式走、特效复用武学标志位；情感信物类（马鞭/剑穗/旧锁/拓片）
// 攻防低但六维/风味重，是"叙事分量 > 战力"的那一类。
export const LEGENDARY = getContent("itemGroup", "LEGENDARY").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 七、通货武器补完（15把，白/绿/蓝各5）—— 填公共池低中档缺口
// ---------------------------------------------------------------------------
// 本批专补"缺口热力图"里武器白绿蓝偏薄的洞：各据点杂货铺/铁铺/武馆的流通货，
// 有地域来历但不写私人故事，走 standardIssue（量产通货），入商店 floating + 掉落池。
export const SUPPLEMENT_WEAPONS = getContent("itemGroup", "SUPPLEMENT_WEAPONS").map(id => getContent("item", id));

// ---------------------------------------------------------------------------
// 八、五神兵（红字武器）—— 各配独立支线，激活5处闲置隐藏地点
// ---------------------------------------------------------------------------
// 特效字段映射说明（避免死字段）：设计稿里的自造字段已映射到 resolveTurn 现成或
// 本轮新增会消费的字段：
//   onHitFreeze → freezeEnergyRecovery（命中封回气，现成）
//   counterDamageRatio → onCounterSuccessDamageRatio（现成）
//   energyRecoveryOnCounterSuccess → onCounterSuccessEnergyGain（现成）
//   justiceStrike / immuneControl / forceCrit / rebirthOnce → 本轮在 resolveTurn/
//     DuelScreen 新增消费分支（见对应文件），不是死字段
//   beastFear → 战斗外遇怪率，接 encounter.js（本轮标记，随支线落地时接）
// 神兵不进公共池、不进商店/掉落——只通过各自支线获得（named:true，非 standardIssue）。
export const DIVINE_ARMS = getContent("itemGroup", "DIVINE_ARMS").map(id => getContent("item", id));
// 五仙教雾隐寨具名物（同第一批具名物层级，named；商店铺货靠 minRep 门槛，不走公共池另控）
export const WUXIAN_GOODS = getContent("itemGroup", "WUXIAN_GOODS").map(id => getContent("item", id));
// 鱼定村具名物（鱼定商号声誉货 + 周铭章随身物 + 鱼定村任务奖励，named）
export const YUDING_GOODS = getContent("itemGroup", "YUDING_GOODS").map(id => getContent("item", id));
// 雪山派具名物（同第一批具名物层级，named；门派商坊靠 minRep 门槛）
export const XUESHAN_GOODS = getContent("itemGroup", "XUESHAN_GOODS").map(id => getContent("item", id));

// ============================================================================
// 核心：把 catalog 条目实例化成一个完整物品对象
// ============================================================================

// 攻防倍率折成"加数"：先用 equipment 的品质公式算出基准 atk/def，
// 再乘具名倍率（atkMul/defMul，1.0~1.6），四舍五入 —— 结果仍是 equipAtk/equipDef
// 这个"加数"，进 calcBaseDamage/calcDefenseValue，不新增乘法层（用户："倍率跟着公式走"）。
// 价格：具名物品在同品质基准价上，按倍率同步抬价（贵重物件更值钱），卖价仍为买价一半。
export function makeCatalogItem(entry) {
  const base = statsForQuality(entry.category, entry.quality); // { atk?/def?/durability?/bonus? }
  const price = priceForQuality(entry.category, entry.quality);

  const out = {
    id: `${entry.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: entry.name,
    category: entry.category,
    quality: entry.quality,
    equipped: false,
    desc: entry.desc,
    named: true, // 标记：这是具名物品（走 catalog），区别于公式随机生成的匿名装备
    durability: base.durability,
  };

  // 攻击倍率（仅武器有 atk 基准）
  if (base.atk != null) {
    const mul = entry.atkMul ?? 1;
    out.atk = Math.round(base.atk * mul);
    out.buyPrice = Math.round(price.buyPrice * mul);
  }
  // 防御倍率（仅护甲有 def 基准）
  if (base.def != null) {
    const mul = entry.defMul ?? 1;
    out.def = Math.round(base.def * mul);
    out.buyPrice = Math.round(price.buyPrice * mul);
  }
  // 饰品/杂物没有攻防基准，价格用基准价（饰品的价值在 effect/sixDim，不体现在攻防倍率）
  if (out.buyPrice == null) out.buyPrice = price.buyPrice;
  out.sellPrice = Math.max(1, Math.round(out.buyPrice / 2));

  // 特效（复用武学标志位，装备时叠到招式上；接线见 combat 层）
  if (entry.effect) out.effect = { ...entry.effect };
  // 加六维（装备时加到 char.special，卸下移除）
  if (entry.sixDim) out.sixDim = { ...entry.sixDim };
  // 消耗品即时效果（食物 buff 系统接通后生效）
  if (entry.consumable) out.consumable = { ...entry.consumable };
  if (entry.tags) out.tags = [...entry.tags];

  return out;
}

// ============================================================================
// 索引 + 查询
// ============================================================================
// CATALOG 含全部：具名80 + 制式30 = 110。named 与 standardIssue 两个布尔区分层次。
export const CATALOG = [
  ...WEAPONS, ...ARMORS, ...ACCESSORIES, ...SUNDRIES,
  ...STANDARD_WEAPONS, ...STANDARD_ARMORS, ...STANDARD_ACCESSORIES,
  ...LEGENDARY,
  ...SUPPLEMENT_WEAPONS,   // 15把通货武器（standardIssue，进公共池）
  ...DIVINE_ARMS,          // 5把神兵（named，只走支线，不进公共池）
  ...JADE_WARES,           // 20件翡翠玉器成品（jadeWare，金玉行选购/预制打造）
  ...WUXIAN_GOODS,         // 五仙教雾隐寨具名物（named，商店+NPC随身物共用条目）
  ...YUDING_GOODS,         // 鱼定村具名物（named，鱼定商号声誉货+周铭章随身物+任务奖励）
  ...XUESHAN_GOODS,        // 雪山派具名物（named，门派商坊+NPC随身物+任务物共用条目）
];

// name → 条目，供"按名取物"（任务发放具名物品、商店铺货、AI 引用时反查数值）
export const CATALOG_INDEX = Object.fromEntries(CATALOG.map(e => [e.name, e]));

// 按名字生成一件物品实例；查不到返回 null（调用方回退 equipment.makeItem 公式）。
// 具名物 named:true，制式物 standardIssue:true，实例会带上对应标记。
export function makeNamedItem(name) {
  const entry = CATALOG_INDEX[name];
  if (!entry) return null;
  const item = makeCatalogItem(entry);
  if (entry.standardIssue) { item.named = false; item.standardIssue = true; }
  return item;
}

// ── 老档补丁：把 catalog 后续更新的词条同步补回旧存档里已经生成好的实例 ──────
// 物品实例是"生产时拍照"：makeCatalogItem 在物品诞生那一刻把 catalog 条目的
// effect/sixDim 复制进实例，此后 catalog 再怎么改，已经存在背包里的那份实例都
// 不会跟着变——这就是"红档武器护甲补七维"那次改动（catalog 数据从"12把只带1把"
// 补到全带）之后，老存档里早就拿到手的红档神兵右栏仍旧空空、装备了也不吃加成的
// 根源：它们诞生时 catalog 那一条压根没有 sixDim 可抄。
// 战斗/属性那边一直是活的（computeEquippedStats 每次都现读 inv 里已装备物件的
// sixDim/effect 求和），不存在"额外重算"这一步——只要把实例上缺失的字段用 catalog
// 现在的数据补上，装备加成和右栏显示会立刻一起恢复正常。
// 只按 name 精确命中 catalog 具名条目，且只补实例上**缺失/空**的字段，绝不覆盖
// 已有值——打造/金玉行定制等系统万一撞名（玩家自己给定制剑起名"折柳"之类），
// 已经写好的词条不该被这次补丁抹掉，这和 makeItemSmart 里"catalog 已有的同名键
// 不覆盖"是同一条原则。
function isEmptyDict(v) {
  return !v || typeof v !== "object" || Object.keys(v).length === 0;
}

export function backfillItemFromCatalog(item) {
  if (!item || typeof item !== "object" || !item.name) return item;
  const entry = CATALOG_INDEX[item.name];
  if (!entry) return item;
  const patch = {};
  if (entry.sixDim && isEmptyDict(item.sixDim)) patch.sixDim = { ...entry.sixDim };
  if (entry.effect && isEmptyDict(item.effect)) patch.effect = { ...entry.effect };
  return Object.keys(patch).length ? { ...item, ...patch } : item;
}

// 供读档时整袋子过一遍（老存档恢复 + 手动读档两处入口都要调，见 MudRPG.jsx）。
// 非物件（纯字符串道具）原样放过。
export function backfillInventoryFromCatalog(inv) {
  if (!Array.isArray(inv)) return inv;
  return inv.map(i => (typeof i === "object" ? backfillItemFromCatalog(i) : i));
}

// ── 智能生成：具名优先，公式兜底 ──────────────────────────────────────────
// 这是"让140件真正进游戏"的总闸。玩家背包物品、NPC carry 都改调这个：
// 传入 { name, category, quality }，若 name 命中 catalog → 吃具名的专属数值/特效/
// 六维（品质以调用方传入的为准还是以 catalog 为准？——以 catalog 条目为准，
// 因为具名物的品质是设计死的，"绿档霜牙"不该被 AI 一句话说成红档）；
// 未命中 → 用传入的 makeItemFallback（即 equipment.makeItem）走匿名公式。
// makeItemFallback 由调用方注入，避免 catalog↔equipment 循环 import。
export function makeItemSmart(spec, makeItemFallback) {
  const named = spec?.name ? makeNamedItem(spec.name) : null;
  if (named) {
    // 具名物的数值/词条以 catalog 为准（"绿档霜牙"不该被一句话说成红档）。
    // 但**调用方显式传入的 effect/sixDim 要能补上**：打造/定制出来的东西名字
    // 多半不在 catalog 里，可万一撞名（比如玩家把定制剑起名"折柳"），
    // 不该因此把这次打造出来的词条丢掉。catalog 已有的同名键不覆盖。
    if (spec.effect) named.effect = { ...spec.effect, ...(named.effect || {}) };
    if (spec.sixDim) named.sixDim = { ...spec.sixDim, ...(named.sixDim || {}) };
    return named;
  }
  return makeItemFallback(spec);
}

// 按分类/品质/标签/层次筛选（供商店按地域性质铺货，见交接任务7"用百物录充实各店"）。
// tier: "named"只出具名 | "standard"只出制式 | 不传则全部。
export function filterCatalog({ category, quality, tag, tier } = {}) {
  return CATALOG.filter(e =>
    (!category || e.category === category) &&
    (!quality || e.quality === quality) &&
    (!tag || (e.tags || []).includes(tag)) &&
    (!tier || (tier === "standard" ? e.standardIssue : tier === "named" ? !e.standardIssue : true))
  );
}

// ============================================================================
// 给 AI 看的参考文本 —— "这世界有哪些叫得出名字的物件"
// ============================================================================
// 原则：只给 AI 名字/品级/一句话来历，不给具体数值——数值永远由本表+公式裁决，
// AI 只能在叙事里自然引用/描述这些物件（"墙上挂着一柄雪山松纹剑"），不能篡改属性。
// 输出压缩成紧凑文本，控制 token 占用。
export function describeCatalogForAI({ categories } = {}) {
  const CAT_NAME = { weapon: "兵器", armor: "衣甲", accessory: "饰品", misc: "杂货" };
  const named = { weapon: WEAPONS, armor: ARMORS, accessory: ACCESSORIES, misc: SUNDRIES };
  const std = { weapon: STANDARD_WEAPONS, armor: STANDARD_ARMORS, accessory: STANDARD_ACCESSORIES };
  // LEGENDARY 按 category 归入具名层各类
  const legendaryByCat = { weapon: [], armor: [], accessory: [], misc: [] };
  for (const e of LEGENDARY) legendaryByCat[e.category]?.push(e);
  const keys = categories || Object.keys(named);
  const namedLines = [];
  for (const k of keys) {
    const all = [...(named[k] || []), ...(legendaryByCat[k] || [])];
    if (!all.length) continue;
    namedLines.push(`【${CAT_NAME[k]}】` + all.map(e => `${e.name}(${e.quality})`).join("、"));
  }
  const stdLines = [];
  for (const k of ["weapon", "armor", "accessory"]) {
    if (categories && !categories.includes(k)) continue;
    if (!std[k]?.length) continue;
    stdLines.push(`【${CAT_NAME[k]}】` + std[k].map(e => `${e.name}(${e.quality})`).join("、"));
  }
  return [
    "曲措乡的物件分两层，叙事时可自然引用其名与来历，但不得虚构其数值属性，",
    "也不得凭空创造未列出的“神兵/秘宝”——具名宝物仅限下列，其余皆寻常之物：",
    "",
    "一、有名有姓、独一份、带来历的宝物（罕见，多与人物/剧情绑定，遇之应郑重）：",
    ...namedLines,
    "",
    "二、成批量产的制式通货（常见，江湖上、店铺里、差役身上到处都是，叙事中",
    "可随口带出，不必渲染稀奇）：",
    ...stdLines,
  ].join("\n");
}


// ── 消耗品·探索态服用（消耗品系统第2步）──
// useConsumable：纯函数，输入一件消耗品的 consumable 字段 + 当前角色状态快照，
// 计算"在探索态（非战斗）服用"会产生的即时效果，返回结构化指令交给 MudRPG 应用。
// 严格遵循"AI 提议内容、系统裁决数值"——所有数值在这里算死，AI 不参与。
//
// 探索态与战斗态的能力边界（重要）：
//   · hpRestore（比例回血）——探索态主力效果，按角色最大气血比例回血、夹在上限内。
//   · energyRestore（回气/真气）——真气是纯战斗内概念（每场重置的 [10,10]），
//     探索态没有对应的持久字段，故不在探索态生效，提示玩家"此丹药需在切磋中服用"。
//   · dispel / rebirthOnce——解异常、假死保命同样是战斗内机制（异常状态存在战斗的
//     statusSlots 里、假死是血将尽时救命），探索态无从施展，同样引导去战斗中用。
//   · sixDimTemp / hpRestoreOverTime / combatBuff 等 B 档 buff——第 3 步接 buffSystem
//     时再处理，本函数暂不负责，遇到时按"尚未支持"返回 ok:false 提示。
//
// 返回：{ ok, hpDelta, note, reason }
//   ok=true  时 hpDelta 为应加到 char.hp[0] 的增量（已按上限夹好上界，负溢出不会发生），
//            note 是给玩家看的服用反馈文字；
//   ok=false 时 reason 说明为何这件东西在探索态吃不出效果（战斗类/未支持/非消耗品）。
export function useConsumable(consumable, char) {
  const c = consumable || {};
  if (!c || Object.keys(c).length === 0) {
    return { ok: false, reason: "这不是能服用的东西。" };
  }

  // 能力分类：
  //   即时回血 hpRestore —— 探索态主力，直接回血。
  //   B档增益 —— 临时六维 sixDimTemp（挂 time 计时的 buff flag）、战前餐 combatBuff
  //     （存 pendingCombatBuff）、持续回血 hpRestoreOverTime（探索态降级为即时回一笔）。
  //   纯战斗内 battleOnly —— 回气/解异常/假死，探索态引导去战斗中用。
  const battleOnly = c.energyRestore || c.dispel || c.dispelAll || c.rebirthOnce;

  // 收集本次服用产生的所有效果（一件药可同时带多种，如"回血+临时体魄"）。
  let hpDelta = 0;
  const sixDimBuffs = [];   // [{ attr, val, duration }]，交给 MudRPG 用 makeBuffFlag 写 flag
  let combatBuff = null;    // 战前餐，交给 MudRPG 累加进 char.pendingCombatBuff
  const noteBits = [];

  // ① 即时回血
  if (c.hpRestore) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * c.hpRestore);
    const room = maxHp - curHp;
    const actual = Math.min(room, heal);
    if (actual > 0) { hpDelta += actual; noteBits.push(`气血回复 ${actual} 点`); }
  }

  // ② 持续回血 hpRestoreOverTime——探索态没有逐回合结算机制，降级为即时回一笔
  //    （总量 = 每回合比例 × 回合数），战斗内道具栏本就不列它。
  if (c.hpRestoreOverTime) {
    const ov = c.hpRestoreOverTime;
    const ratio = typeof ov === "number" ? ov : (ov.ratio || 0);
    const turns = typeof ov === "object" ? (ov.turns || 1) : 1;
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * ratio * turns);
    const room = maxHp - curHp - hpDelta;
    const actual = Math.max(0, Math.min(room, heal));
    if (actual > 0) { hpDelta += actual; noteBits.push(`药力绵长，气血又回 ${actual} 点`); }
  }

  // ③ 临时六维 sixDimTemp: { 属性: 增量 }，默认持续 30 个时辰单位（约合十余回合）
  if (c.sixDimTemp && typeof c.sixDimTemp === "object") {
    const duration = c.buffDuration || 30;
    for (const [attr, val] of Object.entries(c.sixDimTemp)) {
      if (val > 0) { sixDimBuffs.push({ attr, val, duration }); noteBits.push(`${attr}暂增 ${val}`); }
    }
  }

  // ④ 战前餐 combatBuff（作用于下一场战斗）
  if (c.combatBuff && typeof c.combatBuff === "object") {
    combatBuff = { ...c.combatBuff };
    noteBits.push(c.combatBuffNote || "一餐入腹，只待临阵，气力自不同往日");
  }

  // ── C 档降级（消耗品系统第4步：砍/降级重机制，不为个别药新增系统）──
  // ⑤ 跳回合回满 skipTurnsHeal / fullHeal：原设计"跳过N回合、睡一觉回满血"需要一套
  //    时间跳跃机制，砍掉，简化为"即时回满血"（探索态最实用、也最省事）。
  if (c.skipTurnsHeal || c.fullHeal) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const room = maxHp - curHp - hpDelta;
    if (room > 0) { hpDelta += room; noteBits.push("沉沉睡去，再睁眼时气血已复如初"); }
  }
  // ⑥ 全队 buff teamBuff：玩家没有队友系统，降级为"只作用于自己"。teamBuff 里若是
  //    六维增量，按临时六维处理；若是回血比例，并进即时回血。
  if (c.teamBuff && typeof c.teamBuff === "object") {
    const duration = c.buffDuration || 30;
    if (typeof c.teamBuff.hpRestore === "number") {
      const maxHp = char?.hp?.[1] ?? 100;
      const curHp = char?.hp?.[0] ?? maxHp;
      const heal = Math.round(maxHp * c.teamBuff.hpRestore);
      const room = maxHp - curHp - hpDelta;
      const actual = Math.max(0, Math.min(room, heal));
      if (actual > 0) { hpDelta += actual; noteBits.push(`众人本欲同飨，然形单影只，独得气血 ${actual} 点`); }
    }
    for (const [attr, val] of Object.entries(c.teamBuff)) {
      if (attr !== "hpRestore" && typeof val === "number" && val > 0) {
        sixDimBuffs.push({ attr, val, duration });
        noteBits.push(`${attr}暂增 ${val}`);
      }
    }
  }
  // ⑦ 涂抹武器 weaponCoat（毒蝎粉/雪盲药水，原为"下一击附加中毒/目盲"）：这是全新的
  //    "给招式挂临时异常"重机制，砍掉不做。第5步录 catalog 时这类物件应改用 hpRestore
  //    等已支持字段录入；万一仍带了 weaponCoat 字段，这里静默忽略、不报错、不产生效果。
  //    （不在这里给兜底回血——避免"砍了却又偷偷补一个效果"的语义混乱。）

  const producedSomething = hpDelta > 0 || sixDimBuffs.length > 0 || combatBuff;
  if (producedSomething) {
    const extra = battleOnly ? "（另有回气/解毒之效，须在切磋中服用方见）" : "";
    return {
      ok: true,
      hpDelta,
      sixDimBuffs,
      combatBuff,
      note: `服下之后，${noteBits.join("，")}。${extra}`,
    };
  }

  // 没产生任何探索态效果：要么纯战斗内、要么血已满
  if (c.hpRestore && hpDelta === 0) {
    return { ok: false, reason: "气血本已充盈，此时服用未免暴殄，且留着日后急用。" };
  }
  if (battleOnly) {
    return { ok: false, reason: "此丹药回气解毒、救命于须臾，须在切磋交手之际服用方能立竿见影。" };
  }
  return { ok: false, reason: "这东西一时看不出该怎么用。" };
}

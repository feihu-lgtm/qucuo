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
// 喇嘛庙具名物（达摩药堂货池 + 常驻随身物 + 任务奖励，named）
export const LAMA_GOODS = getContent("itemGroup", "LAMA_GOODS").map(id => getContent("item", id));
// 鱼定村具名物（鱼定商号声誉货 + 周铭章随身物 + 鱼定村任务奖励，named）
export const YUDING_GOODS = getContent("itemGroup", "YUDING_GOODS").map(id => getContent("item", id));
// 雪山派具名物（同第一批具名物层级，named；门派商坊靠 minRep 门槛）
export const XUESHAN_GOODS = getContent("itemGroup", "XUESHAN_GOODS").map(id => getContent("item", id));
export const YUQUAN_GOODS = getContent("itemGroup", "YUQUAN_GOODS").map(id => getContent("item", id));
// 鱼定土司府军需司货池与土司府人物随身物（named；商店铺货靠 minRep 门槛）
export const TUSI_GOODS = getContent("itemGroup", "TUSI_GOODS").map(id => getContent("item", id));
export const TANGMEN_GOODS = getContent("itemGroup", "TANGMEN_GOODS").map(id => getContent("item", id));
// 百花门天都镇具名物（同五仙层级，named；暗阁铺货靠 minRep 门槛）
export const BAIHUA_GOODS = getContent("itemGroup", "BAIHUA_GOODS").map(id => getContent("item", id));
// 天龙八部护法随身物（named，夜叉/阿修罗等护法随身物与任务奖励共用条目）
export const TIANLONG_BABU = getContent("itemGroup", "TIANLONG_BABU").map(id => getContent("item", id));
// 青城派青4/青5/青支任务物与奖励（named）
export const QINGCHENG_QUEST = getContent("itemGroup", "QINGCHENG_QUEST").map(id => getContent("item", id));
export const RESIDENT_FILL_GOODS = getContent("itemGroup", "RESIDENT_FILL_GOODS").map(id => getContent("item", id));
// 跑马大会具名物（named，跑马集市铺货 + 比武彩头仪卫戟）
export const PAOMA_GOODS = getContent("itemGroup", "PAOMA_GOODS").map(id => getContent("item", id));

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
  ...LAMA_GOODS,           // 喇嘛庙具名物（named，达摩药堂货池+常驻随身物+任务奖励）
  ...YUDING_GOODS,         // 鱼定村具名物（named，鱼定商号声誉货+周铭章随身物+任务奖励）
  ...XUESHAN_GOODS,        // 雪山派具名物（named，门派商坊+NPC随身物+任务物共用条目）
  ...YUQUAN_GOODS,         // 玉泉寨具名物（named，茶马货栈+NPC随身物+任务物共用条目）
  ...TUSI_GOODS,           // 鱼定土司府具名物（军需司货池+土司府人物随身物）
  ...TANGMEN_GOODS,        // 唐门具名物（named，门人随身物+拜入信物+任务物共用条目）
  ...PAOMA_GOODS,          // 跑马大会具名物（named，集市铺货+仪卫戟彩头共用条目）
  ...BAIHUA_GOODS,         // 百花门天都镇具名物（named，商店+NPC随身物共用条目）
  ...TIANLONG_BABU,        // 天龙八部护法具名物（named，护法随身物+支线奖励）
  ...QINGCHENG_QUEST,      // 青城派任务物与奖励（named）
  ...RESIDENT_FILL_GOODS,    // 合稿补驻场人物（黑风寨、锦官城）的随身物
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




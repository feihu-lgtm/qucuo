// WO-16E 天机券品阶与品类裁定（纯函数）。
// resolveWarrantQuality：取代 judgeTurn 固定 capQuality("白") 白阶逻辑——
//   1) budget.tier === "GM" 固定红；
//   2) 当日搜刮配额尽（remainingDailyQuota<=0）固定白；
//   3) 其余 fullChance = clamp(0.40 + luck*0.05 + fitMod, 0.15, 0.95)，
//      natural +0.15 / stretch 0 / absurd -0.15；roll < fullChance 中则 budget.maxQuality，
//      不中降一档（白到底不降）。
// inferCategoryFromClaim：取代固定 misc——先查 CATALOG_INDEX 精确命中，
//   剥常见句壳（箱底有把/角落里有个/怀里揣着…）复查，再三段正则：
//   复合耗材与文书词 → 尾缀耗材词 → 饰物 → 兵器 → 护具 → 饰物兜底 → misc。
import { CATALOG_INDEX } from "../../data/items/catalog.js";

const QUALITY_ORDER = ["白", "绿", "蓝", "紫", "橙", "红"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const FIT_MOD = { natural: 0.15, stretch: 0, absurd: -0.15 };

export function resolveWarrantQuality(budget = {}, proposal = {}, luck = 0, roll = 0.5) {
  if (budget.tier === "GM") return "红";
  if (Number.isFinite(budget.remainingDailyQuota) && budget.remainingDailyQuota <= 0) return "白";
  const fitMod = FIT_MOD[proposal?.fit] ?? FIT_MOD.absurd;
  const lk = Number.isFinite(luck) ? luck : 0;
  const fullChance = clamp(0.40 + lk * 0.05 + fitMod, 0.15, 0.95);
  const maxQ = budget.maxQuality || "白";
  const maxIdx = QUALITY_ORDER.indexOf(maxQ);
  if ((Number.isFinite(roll) ? roll : 0.5) < fullChance) return maxQ;
  // 不中降一档，白到底
  return QUALITY_ORDER[Math.max(0, (maxIdx < 0 ? 0 : maxIdx) - 1)];
}

// 常见句壳：叙述性前缀，剥掉后再查一次图鉴
const SHELL_PREFIX = /^(?:箱底|柜里|角落(?:里|中)?|怀里|袖中|包袱里|草堆里|墙缝里|床底下|桌上|架上|匣子里)?(?:还|却|竟|正)?(?:有|藏|搁|放|塞|揣|压|埋|躺|插|挂)(?:着|了|一)?[个把件只条张本粒颗锭片]?/;

// 五级正则（底稿 1.5.2 口径）——按序判定，先中先得：
// 1) 复合耗材与文书词：丹药/毒/食物/书信文书类复合词
// 2) 尾缀耗材词：以散/丸/丹/膏/符/信/书/帖/契/图/谱结尾
// 3) 饰物：佩/镯/簪/坠/环/链/牌/佩饰
// 4) 兵器：刀/剑/枪/棍/匕首/斧/鞭/锤/钩/戟/弓/弩
// 5) 护具：甲/盔/靴/护腕/护心镜/袍/衣/盾
// 兜底饰物特征（玉/金/银/珍珠/宝石材质词）→ accessory，否则 misc
const TIER1_CONSUMABLE_DOC = /丹|药|毒|散|丸|膏|酒|茶|饼|食|米|肉|信|书|帖|契|券|图(?![书黨])|谱|密信|文书|字据|账本|册/;
const TIER2_SUFFIX = /(散|丸|丹|膏|符|信|书|帖|契|图|谱|粉|油|镖药)$/;
const TIER3_ACCESSORY = /佩|镯|簪|坠|环|链|牌|戒|钏|璎珞|香囊|荷包/;
const TIER4_WEAPON = /刀|剑|枪|棍|匕首|斧|鞭|锤|钩|戟|弓|弩|矛|锏|叉|利器|兵刃/;
const TIER5_ARMOR = /甲|盔|靴|护腕|护心镜|袍|衣|盾|蓑衣|软甲/;
const MATERIAL_ACCESSORY = /玉|金|银|珍珠|宝石|翡翠|玛瑙|琉璃/;

export function inferCategoryFromClaim(claim) {
  const text = String(claim || "").trim();
  if (!text) return "misc";
  // 第一关：图鉴精确命中——整句或剥壳后
  const direct = CATALOG_INDEX[text];
  if (direct?.category) return direct.category;
  const stripped = text.replace(SHELL_PREFIX, "");
  if (stripped && stripped !== text) {
    const hit = CATALOG_INDEX[stripped];
    if (hit?.category) return hit.category;
  }
  const target = stripped || text;
  // 五级判定
  // 仓内合法类目仅 weapon/armor/accessory/misc——耗材以 misc 类目承载
  // （affixPointTable 以 misc 为耗材类目挂 consumable 词条），不存在 consumable/food 类目。
  // 耗材与文书词在最前级截停：否则「金疮药」会被材质兜底误判饰物。
  if (TIER1_CONSUMABLE_DOC.test(target)) return "misc";
  if (TIER2_SUFFIX.test(target)) return "misc";
  if (TIER3_ACCESSORY.test(target)) return "accessory";
  if (TIER4_WEAPON.test(target)) return "weapon";
  if (TIER5_ARMOR.test(target)) return "armor";
  if (MATERIAL_ACCESSORY.test(target)) return "accessory"; // 饰物兜底
  return "misc";
}

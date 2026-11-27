// 按游戏字段查美术素材的 URL。查不到返回 null，调用方只显示文字或降级占位。
// 关系约定（设计稿·夜色精修 §四「地点头图与建筑头图放哪」）：
//   天地栏小图 = 外层据点图，只在换据点时变；它和江湖栏「进场横幅」是同一张图、同一构图。
//   建筑图只出现在打开的建筑面板顶部：先查个别建筑专图，再查类型图。
//   人物/物品/任务小图统一使用 public/art/{npc,item,quest}/*.webp（高分辨抠底/裁切版）。
import {
  BUILDING_ART,
  BUILDING_ID_ART,
  HOME_ART,
  ITEM_ART,
  MAP_ART,
  NPC_ART,
  PLACE_ART,
  QUEST_ART,
} from "../../domain/data/art/artManifest.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";

const ROOT = (import.meta.env && import.meta.env.BASE_URL) || "/";
const BASE = `${ROOT}art/`;

const NPC_ART_SET = new Set(NPC_ART);
const ITEM_ART_SET = new Set(ITEM_ART);
const QUEST_ART_SET = new Set(QUEST_ART);

export function placeArtUrl(district, manifest = PLACE_ART) {
  const file = district && manifest[district];
  return file ? `${BASE}place/${file}.webp` : null;
}

export function buildingArtUrl(building, { byId = BUILDING_ID_ART, byType = BUILDING_ART } = {}) {
  if (!building) return null;
  const file = (building.id && byId[building.id]) || (building.type && byType[building.type]);
  return file ? `${BASE}building/${file}.webp` : null;
}

export function homeArtUrl(featureId, manifest = HOME_ART) {
  const file = featureId && manifest[featureId];
  return file ? `${BASE}building/${file}.webp` : null;
}

// 舆图底卷：大地图外层视图铺在节点与连线底下；没跑图时返回 null。
export function mapArtUrl(file = MAP_ART) {
  return file ? `${BASE}map/${file}.webp` : null;
}

// 主栏地名行 → 外层据点名：「    鱼定村·歇马居」「    天都镇（马车）」都归到前半段。
export function districtOfRoomLine(text) {
  const name = String(text || "").trim().replace(/（[^）]*）$/, "");
  return name ? name.split("·")[0].trim() : "";
}

export function npcArtUrl(name, uploadedPortraits = null) {
  if (!name) return null;
  if (uploadedPortraits && uploadedPortraits[name]) return uploadedPortraits[name];
  if (NPC_ART_SET.has(name)) return `${BASE}npc/${encodeURIComponent(name)}.webp`;
  return null;
}

export function narratorArtUrl(affection = 0) {
  const a = Number(affection) || 0;
  const file = a >= 90 ? "true.webp"
    : a >= 70 ? "tier4.webp"
    : a >= 45 ? "tier3.webp"
    : a >= 20 ? "tier2.webp"
    : "tier1.webp";
  return `${ROOT}portraits/narrator/${file}`;
}

export function questArtUrl(questId) {
  if (!questId || !QUEST_ART_SET.has(questId)) return null;
  return `${BASE}quest/${encodeURIComponent(questId)}.webp`;
}

const WEAPON_RULES = [
  [/弩|箭|弓/, "weapon-crossbow"],
  [/匕|短刀|短刃|爪|刺/, "weapon-dagger"],
  [/锤|杵|鞭锏|铎/, "weapon-hammer"],
  [/飞刀|暗器|针|镖|翎|算盘|折扇|扇/, "weapon-hidden"],
  [/鞭|索|带|拂尘/, "weapon-whip"],
  [/枪|矛|戟|叉/, "weapon-spear"],
  [/刀|弯刀|猎刀|戒刀/, "weapon-saber"],
  [/杖|棍|棒|拐|尺|勺/, "weapon-staff"],
  [/剑/, "weapon-sword"],
];

const ARMOR_RULES = [
  [/围裙|围腰|皮围/, "armor-apron"],
  [/袈裟|僧袍|百衲|禅衣/, "armor-monk"],
  [/道袍|法衣|鹤氅/, "armor-taoist"],
  [/重甲|铁甲|锁甲|战铠|玄甲/, "armor-heavy"],
  [/护腕|护肩|护臂|护腿|护膝|皮帽|头盔/, "armor-guard"],
  [/裘|狐|貂|豹|狼|熊皮|羊皮|毛领/, "armor-fur"],
  [/皮甲|皮衣|皮背心|革/, "armor-leather"],
  [/软甲|纱衣|绸衣|锦衣|织锦/, "armor-soft"],
  [/布|衫|袍|斗篷|短打|练功服|骑装/, "armor-cloth"],
];

const ACCESSORY_RULES = [
  [/念珠|佛珠|手串|珠/, "accessory-beads"],
  [/护身符|平安符|符|红线|守宫砂|结/, "accessory-charm"],
  [/牙|角|骨/, "accessory-fang"],
  [/簪|钗|步摇|耳坠|流苏/, "accessory-hairpin"],
  [/镜/, "accessory-mirror"],
  [/戒|扳指|指环/, "accessory-ring"],
  [/香囊|荷包|囊|袋/, "accessory-sachet"],
  [/印|牌|帖|券|令|锁片|铃|地图|烟斗|火镰/, "accessory-token"],
  [/玉|翠|翡|珏|璧|佩|石/, "accessory-jade"],
];

const MISC_RULES = [
  [/信|笺|柬|函|书信|急报|密折/, "misc-letter"],
  [/钥|匙|密匙/, "misc-key"],
  [/酒|茶|酿|酥油茶|酪/, "misc-wine"],
  [/炒面|糌粑|糖|饼|干粮|肉|糕|果|面|菜|食/, "misc-food"],
  [/银|钱|元宝|金子|铜板/, "misc-silver"],
  [/经|谱|卷|册|书|秘籍|残页|贝叶/, "misc-sutra"],
  [/草|花|参|归|莲|茸|苓|芪|木|根|叶|脂|皮|骨|胆/, "misc-herb"],
  [/丹|丸|散|膏|药/, "misc-pill"],
  [/符|咒|香|油|蜡/, "misc-talisman"],
];

function matchRule(text, rules) {
  for (const [re, key] of rules) {
    if (re.test(text)) return key;
  }
  return null;
}

export function classifyItemArtKey(itemOrName) {
  if (!itemOrName) return null;
  const rawName = typeof itemOrName === "object" ? itemOrName.name : String(itemOrName);
  const catalogEntry = rawName ? CATALOG_INDEX[rawName] : null;
  const obj = typeof itemOrName === "object"
    ? { ...(catalogEntry || {}), ...itemOrName }
    : { name: rawName, ...(catalogEntry || {}) };

  const nameText = String(obj.name || "");
  const descText = String(obj.desc || "");
  const cat = obj.category;
  const pick = (rules, fallback) =>
    matchRule(nameText, rules) || matchRule(descText, rules) || fallback;
  let key = null;
  if (cat === "weapon") key = pick(WEAPON_RULES, "weapon-sword");
  else if (cat === "armor") key = pick(ARMOR_RULES, "armor-cloth");
  else if (cat === "accessory") key = pick(ACCESSORY_RULES, "accessory-jade");
  else if (cat === "food") key = "misc-food";
  else if (cat === "misc") key = pick(MISC_RULES, "misc-herb");
  else {
    key = matchRule(nameText, WEAPON_RULES)
      || matchRule(nameText, ARMOR_RULES)
      || matchRule(nameText, ACCESSORY_RULES)
      || matchRule(nameText, MISC_RULES)
      || matchRule(descText, WEAPON_RULES)
      || matchRule(descText, ARMOR_RULES)
      || matchRule(descText, ACCESSORY_RULES)
      || matchRule(descText, MISC_RULES);
  }
  return key && ITEM_ART_SET.has(key) ? key : null;
}

export function itemArtUrl(itemOrName) {
  const key = classifyItemArtKey(itemOrName);
  return key ? `${BASE}item/${key}.webp` : null;
}

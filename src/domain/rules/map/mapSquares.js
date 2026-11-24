import { random } from "../../../utils/rng.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { rollEncounter } from "./encounter.js";
import { rollQuality, ITEM_CATEGORY } from "../economy/equipment.js";
import { cleanJsonString } from "../../../utils/jsonClean.js";
import { filterCatalog } from "../../data/items/catalogOps.js";

// 地图格子系统（扫雷式预埋）
// ---------------------------------------------------------------------------
// 外层据点只有 14 个，每个据点每天后台预跑一次"格子"：系统先掷骰埋好拾取/路遇
// （概率与品质全由系统裁决），再用精简 prompt 让小模型一次性写好到达文本、物件
// 名字词条、路遇人物、环顾文本。玩家之后到访/路过该据点时纯前端消费格子，零 API
// 等待；首次到访（无缓存）仍走 AI 主叙事建场，并把该格烧掉（埋好的内容作废，避免
// 与 AI 轮自己的拾取骰双重发放）。每日刷新时全图重埋。
//
// square: {
//   day, desc, lookText, findLine,
//   item: null | { name, quality, category, desc }, itemTaken,
//   encounter: null | { name, id, brief, tier, label, line }, encounterMet,
//   burned,
// }

let squares = {};

const PICKUP_CHANCE = 0.35; // 与主流程移动拾取基础几率一致

// 系统掷骰：这个格子埋不埋拾取（品质/分类）、埋不埋路遇（势力）。AI 只管写作。
export function rollSkeleton(nodeName, luck = 5, { isTaken } = {}) {
  let item = null;
  if (random() < PICKUP_CHANCE) {
    const quality = rollQuality(luck);
    const category = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY, ITEM_CATEGORY.MISC][Math.floor(random() * 4)];
    item = { quality, category };
  }
  const en = rollEncounter(nodeName, luck, { isTaken });
  const encounter = en ? { factionKey: en.factionKey, label: en.faction.label, roamers: en.faction.roamers, passer: en.passer || null } : null;
  return { item, encounter };
}

// 精简预跑 prompt：一批最多 3 个据点，一次调用写完全套素材。
export function buildSquarePrompt(batch) {
  const system = `你是武侠世界的"地图预跑员"，为据点批量生成固定场景素材。这些文字会在玩家日后抵达该地时直接展示，请写成可直接展示的成品白描，不要写成设定说明。
每个据点输出：
1. desc：到达场景描述，80字内——白话古文、说书人口吻、具体有画面（地貌/建筑/气息）。**不要写时辰、天色、天气，也不要写玩家的行动**（你不知道玩家何时抵达）。
2. lookText：环顾四周文本，60字内——站在此地放眼可见的格局。
3. 若该据点"埋有物件"（系统已定品质与分类）：findLine，1-2句，发现它的那一刻（半掩泥中/石缝反光/草丛遗落之类，贴合此地地貌）；itemName，贴合品质的具体名字（品阶越高越有分量，不脱离世界观）；itemDesc，一句话物件描述。
4. 若该据点"埋有路遇"（系统已定势力）：encounterName（符合其身份的名字或称谓）；encounterBrief（15字内，点明势力归属）；encounterTier（白|绿|蓝|紫 之一，寻常奔波者白|绿，有职事者蓝，头目级紫）；encounterLine（40字内，此人正忙着自己的营生、与玩家短暂照面的一刻，不是专程来找玩家的）。
输出纯JSON数组，元素 {"name":"据点名","desc":"...","lookText":"...","findLine":"...","itemName":"...","itemDesc":"...","encounterName":"...","encounterBrief":"...","encounterTier":"...","encounterLine":"..."}，未埋的项对应字段省略。除数组外不要输出任何内容。`;
  const user = batch.map(b => {
    const lines = [`据点：${b.name}｜底本：${b.base}｜出口：${b.exits}`];
    lines.push(b.item ? `埋有物件：品质「${b.item.quality}」、分类「${b.item.category}」` : `埋有物件：无`);
    lines.push(!b.encounter ? `埋有路遇：无`
      : b.encounter.passer ? `埋有路遇：势力【${b.encounter.label}】，人已定：${b.encounter.passer.name}（${b.encounter.passer.brief}，${b.encounter.passer.personality}）——encounterName 照抄此名`
        : `埋有路遇：势力【${b.encounter.label}】（可能的身份：${b.encounter.roamers}）`);
    return lines.join("\n");
  }).join("\n\n");
  return { system, user };
}

export function parseSquareBatch(text) {
  let js = (text || "").replace(/```json\s*|```\s*/g, "").trim();
  const i0 = js.indexOf("["), i1 = js.lastIndexOf("]");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  js = cleanJsonString(js);
  try {
    const arr = JSON.parse(js);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// 小模型没给出物件名时，从百物录按品质+类别挑一件真东西顶上，告别"X品路遇之物"
// 这种垃圾占位名。品质+类别命中不了就逐级放宽（只按类别/只按品质），全空才退通用名。
// 给到真名字后，消费侧 makeGameItem 走具名优先，能吃到 catalog 专属数值与特效。
const notQuestItem = (e) => !e.tags?.includes("任务");

function pickCatalogName(quality, category) {
  let pool = filterCatalog({ quality, category }).filter(notQuestItem);
  if (!pool.length) pool = filterCatalog({ category }).filter(notQuestItem);
  if (!pool.length) pool = filterCatalog({ quality }).filter(notQuestItem);
  if (!pool.length) return { name: `${quality === "白" ? "" : quality}品物件`, desc: "路上拾得的物件。" };
  const e = pool[Math.floor(random() * pool.length)];
  return { name: e.name, desc: e.desc || "" };
}

// 小模型给的字段可能是数字/对象，一律只认字符串，避免 .trim() 抛错连累整批据点。
const aiText = (value) => (typeof value === "string" ? value.trim() : "");

// 把 AI 写好的素材与系统掷好的骨架按据点名合并入库。
// AI 没给名字时拾取退品质通用名（预跑失败不致命，格子照用）。
export function applySquareBatch(day, parsed, skeletons) {
  // 本批每个据点系统定好的过路人名字：某条目自带的路遇字段若写的是别处的过路人，
  // 那份台词归别处认领，本地不拿来兜底，免得同一句台词落到两个人身上。
  const fixedNames = new Set(Object.values(skeletons || {}).map((s) => s?.encounter?.passer?.name).filter(Boolean));
  for (const p of parsed || []) {
    const sk = skeletons[p?.name];
    if (!sk || typeof p.desc !== "string" || !p.desc.trim()) continue;
    let item = null;
    if (sk.item) {
      let itemName = aiText(p.itemName);
      let itemDesc = aiText(p.itemDesc);
      if (!itemName) {
        const pick = pickCatalogName(sk.item.quality, sk.item.category);
        itemName = pick.name;
        itemDesc = itemDesc || pick.desc;
      }
      item = {
        name: itemName,
        quality: sk.item.quality,
        category: sk.item.category,
        desc: itemDesc || "路上拾得的物件。",
      };
    }
    let encounter = null;
    const fixed = sk.encounter?.passer;
    // 人已定的路遇按名字认领台词：小模型偶尔把 A 地的路遇字段写进 B 地的条目，
    // 这里按 encounterName 找回；本条目写的若是别处过路人，就不拿它兜底。
    const ownName = aiText(p.encounterName);
    const lineSource = fixed && ownName !== fixed.name
      ? (parsed.find((q) => aiText(q?.encounterName) === fixed.name) || (fixedNames.has(ownName) ? {} : p))
      : p;
    if (sk.encounter && (fixed || ownName)) {
      encounter = {
        name: fixed?.name || ownName,
        id: `roamer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        brief: fixed?.brief || aiText(p.encounterBrief).slice(0, 20) || sk.encounter.label,
        tier: fixed ? ["白", "绿", "蓝", "紫"][fixed.levelCap] || "白" : ["白", "绿", "蓝", "紫"].includes(p.encounterTier) ? p.encounterTier : "白",
        faction: sk.encounter.factionKey,
        label: sk.encounter.label,
        line: aiText(lineSource.encounterLine),
      };
    }
    squares[p.name] = {
      day, desc: p.desc.trim(), lookText: aiText(p.lookText), findLine: aiText(p.findLine),
      item, itemTaken: false, encounter, encounterMet: false, burned: false,
    };
  }
}

// 消费一次到达：desc 每次回访都给（据点的标准到达文本），物件/路遇一次性。
// 格子未就绪（预跑失败/未跑）返回全 null，调用方用 destNode.desc 兜底——回访永远纯前端。
export function consumeArrival(name, day) {
  const sq = squares[name];
  if (!sq || sq.day !== day) return { desc: null, findLine: "", item: null, encounter: null };
  const item = (sq.item && !sq.itemTaken && !sq.burned) ? sq.item : null;
  const encounter = (sq.encounter && !sq.encounterMet && !sq.burned) ? sq.encounter : null;
  if (item) sq.itemTaken = true;
  if (encounter) sq.encounterMet = true;
  return { desc: sq.desc, findLine: sq.findLine || "", item, encounter };
}

export function getLookText(name, day) {
  const sq = squares[name];
  return (sq && sq.day === day && sq.lookText) ? sq.lookText : null;
}

// AI 主叙事接管了这次到达（首次到访建场）：埋好的物件/路遇作废，避免双重发放。
export function burnSquare(name) { if (squares[name]) squares[name].burned = true; }

// 每日重埋：清空全图格子，预跑会重新掷骰写文。
export function resetForDay() { squares = {}; }

export function pendingNodes(day) {
  return Object.keys(QUCUO_MAP).filter(n => !squares[n] || squares[n].day !== day);
}

export function serializeSquares() { return JSON.parse(JSON.stringify(squares)); }
export function loadSquares(obj) { squares = (obj && typeof obj === "object") ? obj : {}; }

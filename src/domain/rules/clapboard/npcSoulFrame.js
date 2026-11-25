// @在场活人切片（WO-07）：为每位在场角色输出独立分块——性情与说话禁忌、
// 当前时辰营生、对主角社交体温、该角色可见的场记板条目。
// 叙事模型写 NPC 时按人取块，不再是千人一腔的笼统「在场人物」。
// 全部纯函数：不掷骰、不读时间，同输入恒同输出。

import { filterEntriesForViewer, renderClapboardSection } from "./clapboard.js";

// 性情关键词 → 说话禁忌（ deterministic 映射：什么性子的人吃不住什么话）。
const TABOO_RULES = [
  { keys: ["冷", "傲"], taboo: "忌轻佻调笑、忌套近乎攀交情" },
  { keys: ["豪爽", "爽朗", "直率", "粗豪"], taboo: "忌拐弯抹角、忌文绉绉绕弯子" },
  { keys: ["精明", "算计", "商"], taboo: "忌空口白牙、忌赊欠含糊" },
  { keys: ["暴", "烈", "急躁"], taboo: "忌黏缠磨叽、忌当面顶撞" },
  { keys: ["温", "善", "柔", "慈"], taboo: "忌恶语相向、忌喊打喊杀" },
  { keys: ["狡", "猾", "奸"], taboo: "忌交底露财、忌轻信其许诺" },
  { keys: ["僧", "禅", "道"], taboo: "忌荤俗玩笑、忌谈杀伐" },
];

function personaLine(npc) {
  const persona = npc.personality || npc.brief || "";
  if (!persona) return null;
  const hit = TABOO_RULES.find((r) => r.keys.some((k) => persona.includes(k)));
  return `性情：${persona}${hit ? `；说话禁忌：${hit.taboo}` : ""}`;
}

// 时辰 → 常态营生；按角色身份关键词微调（掌柜看铺、猎人喂鹰之类，认不出就用通用句）。
const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const LIVELIHOOD_RULES = [
  { keys: ["掌柜", "老板", "店"], day: "照看铺面、拨弄算盘", night: "盘账熄灯、准备打烊" },
  { keys: ["猎"], day: "擦磨刀箭、照料猎具", night: "烤火歇脚、整理猎物" },
  { keys: ["僧", "喇嘛"], day: "诵经礼佛、洒扫寺院", night: "打坐入定" },
  { keys: ["兵", "卒", "巡"], day: "巡守当值", night: "轮班守夜" },
  { keys: ["铁匠", "匠"], day: "抡锤打铁、照看炉火", night: "封火收锤" },
];

function livelihoodLine(npc, time) {
  const t = Number.isFinite(Number(time)) ? Number(time) : 0;
  const hour = ((Math.floor(t) % 24) + 24) % 24;
  const shi = SHICHEN[Math.min(11, Math.floor(hour / 2))];
  const isDay = hour >= 6 && hour < 18;
  const identity = `${npc.brief || ""}${npc.title || ""}${npc.personality || ""}`;
  const hit = LIVELIHOOD_RULES.find((r) => r.keys.some((k) => identity.includes(k)));
  const doing = hit ? (isDay ? hit.day : hit.night) : (isDay ? "忙着自己的营生" : "歇着养神");
  return `眼下${shi}时，${npc.name}正${doing}`;
}

// 社交体温：好感档位 + 怒气 + 旧账。全部读 varTree.角色[name]，无记录则按寻常陌路。
function warmthLine(npc, attrs) {
  const parts = [];
  const affection = Number(attrs?.好感度);
  if (Number.isFinite(affection)) {
    const tier = affection >= 80 ? "过命的交情"
      : affection >= 60 ? "颇为亲近"
        : affection >= 40 ? "熟络"
          : affection >= 20 ? "相识有余、亲近不足"
            : affection > 0 ? "不过是点头之交"
              : "心存芥蒂";
    parts.push(`对主角${tier}（好感${affection}）`);
  } else {
    parts.push("与主角素不相识");
  }
  const anger = attrs?.生气状态;
  if (anger?.active) parts.push(`正在气头上（${anger.reason || "心有芥蒂"}）`);
  const ledger = attrs?.旧账?.lines;
  if (Array.isArray(ledger) && ledger.length) {
    parts.push(`心里记着旧账：${ledger.slice(-2).join("；")}`);
  }
  return parts.join("，");
}

// 为每位在场角色输出独立分块 { name, text }。
// clapboardEntries 经 filterEntriesForViewer 按该角色视角过滤——raw_memory 条目的
// 他人心理（rawText）在过滤层已被覆写成 publicText，想泄也泄不出去。
export function buildNpcSoulFrames({ visibleNpcs = [], varTree = {}, time = 0, clapboardEntries = [], entriesBudget = 200 } = {}) {
  return (Array.isArray(visibleNpcs) ? visibleNpcs : []).map((npc) => {
    if (!npc?.name) return null;
    const attrs = varTree?.角色?.[npc.name] || {};
    const lines = [];
    const persona = personaLine(npc);
    if (persona) lines.push(persona);
    lines.push(livelihoodLine(npc, time));
    lines.push(warmthLine(npc, attrs));
    const visible = filterEntriesForViewer(clapboardEntries, npc.name);
    const section = renderClapboardSection(visible, entriesBudget);
    if (section) lines.push(`其所知所见：${section}`);
    return { name: npc.name, text: `【${npc.name}】${lines.join("；")}` };
  }).filter(Boolean);
}

// 渲染成提示词段落（@在场活人切片 引用值）：一人一块，块间换行。
export function renderNpcSoulFrames(input) {
  return buildNpcSoulFrames(input).map((f) => f.text).join("\n");
}

// @体感态势 转译器（WO-07）：把系统状态转译成三句感官化的"你现在是什么状态"，
// 给叙事模型一个具身视角——它写主角时不该只看数值表，而该感到伤、穿戴、囊中和天时。
// 全部纯函数：不掷骰、不读时间，同输入恒同输出。

// hp 是 [当前, 上限] 数组；技能/装备品阶等结构以 fields.js 登记的形状为准。
function hpRatio(hp) {
  const cur = Number(hp?.[0]);
  const max = Number(hp?.[1]);
  if (!Number.isFinite(cur) || !Number.isFinite(max) || max <= 0) return 1;
  return cur / max;
}

// 气血伤势档：<30% 重伤渗血、<60% 带伤气喘、>=60% 按内外功深浅写步履气息。
function vitalityLine(char) {
  const ratio = hpRatio(char?.hp);
  if (ratio < 0.3) return "你伤势沉重，伤处渗血不止，每动一下都牵着疼。";
  if (ratio < 0.6) return "你带着伤，气息有些喘，动手时隐隐作痛。";
  const nei = Number(char?.neigong) || 0;
  const wai = Number(char?.waigong) || 0;
  const depth = Math.max(nei, wai);
  if (depth >= 60) return "你气血充盈，步履沉稳无声，吐纳之间自有一股渊深气息。";
  if (depth >= 20) return "你气血尚算充盈，步履轻快，呼吸匀长。";
  return "你武功根基尚浅，气息浮浅，走急了便有些喘。";
}

// 显眼穿戴与扒空度：紫/橙/红名器点名；衣不蔽体（无护甲在身）、身无寸铁点明。
function attireLine(inv) {
  const items = Array.isArray(inv) ? inv : [];
  const equipped = items.filter((it) => it && it.equipped);
  const notable = equipped.filter((it) => ["紫", "橙", "红"].includes(it.quality));
  const hasArmor = equipped.some((it) => it.category === "armor");
  const hasWeapon = equipped.some((it) => it.category === "weapon");
  const parts = [];
  if (notable.length) {
    parts.push(`身上${notable.map((it) => `「${it.name}」`).join("、")}扎眼得很，明眼人一打照面就能瞧出不是凡品`);
  }
  if (!hasArmor) parts.push("衣不蔽体，没什么像样的护甲傍身");
  if (!hasWeapon) parts.push("身无寸铁");
  if (!parts.length) return "你穿戴齐整但不扎眼，混在人堆里并不惹目。";
  return `你${parts.join("，")}。`;
}

// 二十四节气名（用于按游戏日数近似推演节气，游戏级精度：15 日一候）。
const SOLAR_TERMS = [
  "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑",
  "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至", "小寒", "大寒",
];

const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function dayNightLabel(hour) {
  if (hour >= 23 || hour < 1) return "子夜";
  if (hour < 5) return "凌晨";
  if (hour < 7) return "清晨";
  if (hour < 11) return "上午";
  if (hour < 13) return "正午";
  if (hour < 17) return "午后";
  if (hour < 19) return "傍晚";
  return "入夜";
}

// 囊中窘阔与昼夜节气：银两档位 + 游戏时刻 + 近似节气。
function purseAndSeasonLine(char, time) {
  const money = Number(char?.money) || 0;
  const purse = money < 5 ? "囊中羞涩，几无余钱"
    : money < 30 ? "囊中不算宽裕，勉强够嚼用"
      : money < 100 ? "囊中尚算宽裕"
        : "囊中肥实，出手可以阔绰";
  const t = Number.isFinite(Number(time)) ? Number(time) : 0;
  const hour = ((Math.floor(t) % 24) + 24) % 24;
  const day = Math.floor(t / 24) + 1;
  const shi = SHICHEN[Math.min(11, Math.floor(hour / 2))];
  const term = SOLAR_TERMS[Math.floor(Math.max(0, day - 1) / 15) % 24];
  return `${purse}；眼下是${dayNightLabel(hour)}${shi}时，节气近${term}。`;
}

// 输出三句感官态势：气血伤势 / 显眼穿戴与扒空度 / 囊中窘阔与昼夜节气。
export function buildDiegeticState({ char = {}, inv = [], time = 0 } = {}) {
  return [
    vitalityLine(char),
    attireLine(inv.length ? inv : char?.inv || []),
    purseAndSeasonLine(char, time),
  ];
}

// 渲染成提示词段落（@体感态势 引用值）：三句一行一句，空输入也给得出兜底句。
export function renderDiegeticState(input) {
  return buildDiegeticState(input).join("\n");
}

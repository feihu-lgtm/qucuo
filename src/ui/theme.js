// 主题色系统
// 参考《长刀》(Long Knives) 的美学方向：黑白水墨+朱红孤色。
// 不靠七个分区七种色相讲故事，而是靠"几乎无色"本身——大片留白/墨黑打底，
// 线条不做圆角，唯一一点红（朱印/警示/交互）就是全部的色彩语言。
// 玩家走到哪个分区，界面骨架都长一个样：这正是《长刀》的克制，不是疏漏。
//
// ── 日间模式 ──
// 暗夜=墨拓（黑纸白字+朱红），日间=宣纸（白纸黑字+朱红）。两套字段一一对应，
// 下游 117 处 zoneTheme.xxx 引用不需要感知日间/夜间，只要 getZoneTheme 传对
// isDayMode 即可。

// 七个地理分区，对应 qucuoMap.js 里的据点分组（仅供 zoneTheme.name 取分区
// 名做氛围文字用；视觉本身七区统一，不再靠色相分区）：
// 视觉本身七区统一，不再靠色相区分冷暖，仅 name 保留分区flavor文字。
const ZONE_MAP = {
  鱼定村: "village", 鱼定土司: "village", 天都镇: "village", 玉泉寨: "village",
  喇嘛庙: "temple", 白塔: "temple",
  后山平台: "snow", 雪山派: "snow", 山洞: "snow", 顶峰: "snow",
  大草甸: "wild",
  贡措海: "water",
  雅江: "bamboo",
  锦官城: "outland",
};

// 暗夜（墨拓）：黑纸白字，朱红孤色。七区共用同一套值——《长刀》式的克制，
// 不靠色相分区讲故事；name 字段仍保留分区flavor文字。
const NIGHT_INK = {
  accent: "#c8323a",      // 朱红：唯一强调色
  accentDim: "#8a4a48",   // 朱红压暗：次强调/弱高亮
  bg: "#0a0a09",          // 墨黑底
  bgPanel: "#111110",     // 面板略提亮，制造"浮在底色上"的层次
  border: "#4a453c",      // 墨线：暗底上勾一道浅灰线
  text: "#e8e4d6",        // 骨白正文（白墨拓字）
  textDim: "#8f8a7c",     // 中灰次要文字
};

export const ZONE_THEMES = {
  village: { name: "人间烟火", ...NIGHT_INK },
  temple: { name: "梵音低回", ...NIGHT_INK },
  snow: { name: "孤峰积雪", ...NIGHT_INK },
  wild: { name: "莽野无涯", ...NIGHT_INK },
  water: { name: "静水深流", ...NIGHT_INK },
  outland: { name: "他乡异客", ...NIGHT_INK },
  bamboo: { name: "雨城竹海", ...NIGHT_INK },
};

// 日间模式：宣纸白底黑字，朱红孤色。字段一一对应上面的暗夜版。
const DAY_INK = {
  accent: "#a8202a",      // 朱红（深化，白纸上仍要够沉）
  accentDim: "#8a4a42",   // 朱红压暗
  bg: "#eae7dd",          // 宣纸灰白
  bgPanel: "#f4f2e9",     // 面板更白，制造层次
  border: "#2a2620",      // 墨线：近黑描边
  text: "#201d18",        // 墨黑正文
  textDim: "#726c5e",     // 中灰次要文字
};

export const ZONE_THEMES_DAY = {
  village: { name: "人间烟火·昼", ...DAY_INK },
  temple: { name: "梵音低回·昼", ...DAY_INK },
  snow: { name: "孤峰积雪·昼", ...DAY_INK },
  wild: { name: "莽野无涯·昼", ...DAY_INK },
  water: { name: "静水深流·昼", ...DAY_INK },
  outland: { name: "他乡异客·昼", ...DAY_INK },
  bamboo: { name: "雨城竹海·昼", ...DAY_INK },
};

// 根据房间名推断当前分区，返回对应主题；找不到时回退到 village。
// isDayMode=true 时从 ZONE_THEMES_DAY 取（六套浅色版本），默认 false 走原暗夜版，
// 两套主题字段一一对应，调用方不需要额外分支处理。
export function getZoneTheme(roomName, isDayMode = false) {
  const zone = ZONE_MAP[roomName] || "village";
  return (isDayMode ? ZONE_THEMES_DAY : ZONE_THEMES)[zone];
}

// ── 设计基元：孤色语义体系（原"藏地三色"，现收拢进单一朱红家族）────────
// 《长刀》的角色名/警示/交互提示统一用朱红，靠字重深浅而非色相分深浅——
// 案卷里的"已结案"绿灯用的也是朱红徽章，不是绿色。这里 5 个 key 仍保留
// （避免动全部调用方），但取值全部收拢进朱红家族，只用饱和度/色温区分：
// turquoise=交互确认（即主强调色本身）；gold=重要入口，偏暖橙红；
// crimson=警示/危险，最亮最正的朱红；pink=好感/私聊，柔和绛粉；
// green=NPC名/对话，偏赭红棕。
export const INK = {
  turquoise: { night: "#c8323a", day: "#a8202a" },
  gold:      { night: "#c8663a", day: "#96431a" },
  crimson:   { night: "#d63c3c", day: "#b01f24" },
  pink:      { night: "#d68a8a", day: "#a8524a" },
  green:     { night: "#c07050", day: "#8a4a2a" },
};
export const ink = (name, isDayMode) => INK[name][isDayMode ? "day" : "night"];
// 圆角阶：《长刀》线装书式的硬直角——全部归零，不再有 3/4/6/8 的圆角层级。
export const RADIUS = { btn: 0, card: 0, modal: 0 };

export function getZoneName(roomName) {
  return ZONE_MAP[roomName] || "village";
}

// 主题系统
// 参考《长刀》(Long Knives) 的美学方向：黑白水墨+朱红孤色。
// 不靠七个分区七种色相讲故事，而是靠"几乎无色"本身——大片留白/墨黑打底，
// 线条不做圆角，唯一一点红（朱印/警示/交互）就是全部的色彩语言。
// 玩家走到哪个分区，界面骨架都长一个样：这正是《长刀》的克制，不是疏漏。
//
// ── 颜色只有 CSS 变量一套（路线图 U3）──
// 全部色值写在 src/ui/tokens.css：暗夜=墨拓（黑纸白字+朱红）在 :root，
// 日间=宣纸（白纸黑字+朱红）在 :root[data-theme="day"]，由 sessionUiStore 随日夜
// 写根节点的 data-theme。本文件不再定义任何色值，只留分区名映射和两个指向
// CSS 变量的主题对象。迁移前的色值快照冻结在 themeTokens.test.js，逐字段锁住。

// 七个地理分区，对应 qucuoMap.js 里的据点分组。视觉七区统一，分区只用来取
// 氛围文字（左栏「天地」标题旁的那行小字）。
const ZONE_MAP = {
  鱼定村: "village", 鱼定土司: "village", 天都镇: "village", 玉泉寨: "village",
  喇嘛庙: "temple", 白塔: "temple",
  后山平台: "snow", 雪山派: "snow", 山洞: "snow", 顶峰: "snow",
  大草甸: "wild",
  贡措海: "water",
  雅江: "bamboo",
  锦官城: "outland", 蜀南唐堡: "outland",
  雾隐寨: "bamboo",
  天龙营: "wild",
};

export const ZONE_NAMES = Object.freeze({
  village: "人间烟火",
  temple: "梵音低回",
  snow: "孤峰积雪",
  wild: "莽野无涯",
  water: "静水深流",
  outland: "他乡异客",
  bamboo: "雨城竹海",
});

// 根据房间名推断分区，返回氛围文字；找不到时回退到 village。日间加「·昼」。
export function getZoneName(roomName, isDayMode = false) {
  const name = ZONE_NAMES[ZONE_MAP[roomName] || "village"];
  return isDayMode ? `${name}·昼` : name;
}

// 取值全是 CSS 变量的主题对象。颜色由 tokens.css 的 :root 与 :root[data-theme="day"]
// 决定，日夜切换不必再传 isDayMode。只给需要"整个主题对象"的地方用（chromeBtn、
// 子组件的 theme 参数）；单个颜色直接写 "var(--accent)" 这类字面量。
export const THEME_VARS = Object.freeze({
  accent: "var(--accent)",
  accentDim: "var(--accent-dim)",
  bg: "var(--bg)",
  bgPanel: "var(--bg-panel)",
  border: "var(--border)",
  text: "var(--text)",
  textDim: "var(--text-dim)",
});

// 固定暗夜的主题对象：字段同 THEME_VARS，取值指向 tokens.css 里不随日夜切换的墨拓定色
// （--ink-*，值就是暗夜色）。给"暗夜色与日间色混用"的界面用——开始页、开场、创角、开始页的
// 卡牌导入：只有原先读主题对象的地方固定为暗夜，其余 var(--text) 之类照旧跟随日夜。
// 整棵子树都固定暗夜、且子树里没有跟随日夜的组件时，改用根节点 data-theme="night"（酒馆经营）。
export const NIGHT_VARS = Object.freeze({
  accent: "var(--ink-accent)",
  accentDim: "var(--ink-accent-dim)",
  bg: "var(--ink-bg)",
  bgPanel: "var(--ink-bg-panel)",
  border: "var(--ink-border)",
  text: "var(--ink-text)",
  textDim: "var(--ink-text-dim)",
});

// 圆角阶：《长刀》线装书式的硬直角——全部归零，不再有 3/4/6/8 的圆角层级。
export const RADIUS = { btn: 0, card: 0, modal: 0 };

// 主界面统一按钮：文字按钮，一种底色/文字；只有「当前开启」用朱红强调与细框。
export function chromeBtn(theme, { active = false } = {}) {
  return {
    cursor: "pointer", display: "inline-flex", alignItems: "center", height: "var(--ctl-h)", padding: "0 var(--ctl-pad-x)",
    boxSizing: "border-box", lineHeight: 1, whiteSpace: "nowrap", fontSize: "var(--fs-xs)", letterSpacing: "var(--ls-none)",
    borderRadius: "var(--radius-none)", userSelect: "none",
    color: active ? theme.accent : theme.text,
    background: active ? `color-mix(in srgb, ${theme.accent} 14%, transparent)` : "transparent",
    // 夜色精修：主界面按钮是文字按钮，平时不描边（禁用清单「描边方框按钮」），只有开启态用朱红细框。
    border: `1px solid ${active ? theme.accent : "transparent"}`,
  };
}

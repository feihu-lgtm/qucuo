// 主题色系统
// 参考《捉刀》的美学方向：没有精美图片素材，靠排版留白、克制的色彩、
// 简洁的线条营造意境感。核心手段是"每个地理分区一个基调色"，
// 而不是全局死板的单一配色——玩家走到雪山会感受到冷冽，走到鱼定村
// 会感受到暖黄的烟火气，视觉本身参与叙事，不需要任何图片。
//
// ── 日间模式（本轮新增）──
// 原有六套 ZONE_THEMES 全部是暗夜基调（暗背景+亮字）。日间模式不是简单
// 套一份统一浅色，而是给每个分区各自做一次"深→浅"的忠实转换，保留
// "不同地方氛围不同"这个设计初衷：
//   bg/bgPanel  暗背景 → 米色系背景（借鉴 Claude.ai 官方那种暖米白，
//               bgPanel 比 bg 略白，制造同样的"面板浮在底色上"层次感）
//   border      统一收拢到棕色调（各分区仍有细微色相差异，但大类是棕）
//   text        亮色文字 → 深棕黑正文（不用纯黑，暖黑更耐读）
//   textDim     → 中棕灰
//   accent/accentDim  色相基因保留，但大幅拉低明度、适度提高饱和度——
//               暗背景上的"亮丽高亮色"直接搬到浅背景上会糊得看不清，
//               必须换算成"深沉浓郁"的同色系版本才行。
// 两套主题字段完全一一对应（同一个 key 集合），下游 117 处 zoneTheme.xxx
// 引用不需要感知日间/夜间的存在，只要 getZoneTheme 传对 isDayMode 即可。

// 五个地理分区，对应 qucuoMap.js 里的据点分组：
// - village（鱼定村/鱼定土司/天都镇/玉泉寨）：暖褐黄，烟火人间气
// - temple（喇嘛庙/白塔）：赭石与暗金，宗教肃穆感
// - snow（后山平台/雪山派/山洞/顶峰）：冷蓝白，高寒孤峭
// - wild（大草甸）：青灰绿，莽野荒率
// - water（贡措海）：墨蓝，静水深流
// - outland（锦官城）：中性灰褐，象征"离乡"的疏离感
const ZONE_MAP = {
  鱼定村: "village", 鱼定土司: "village", 天都镇: "village", 玉泉寨: "village",
  喇嘛庙: "temple", 白塔: "temple",
  后山平台: "snow", 雪山派: "snow", 山洞: "snow", 顶峰: "snow",
  大草甸: "wild",
  贡措海: "water",
  雅江: "bamboo",
  锦官城: "outland",
};

export const ZONE_THEMES = {
  village: {
    name: "人间烟火",
    accent: "#d4a853",      // 主强调色：暖黄
    accentDim: "#8a6a3a",
    bg: "#0e0c08",           // 面板背景基调（极暗，只是带一点点色相偏移）
    bgPanel: "#120f0a",
    border: "#2a2419",
    text: "#c8bfa0",
    textDim: "#6a6250",
  },
  temple: {
    name: "梵音低回",
    accent: "#c4924a",      // 赭石暗金
    accentDim: "#7a5a30",
    bg: "#0d0a08",
    bgPanel: "#110d0a",
    border: "#2a2015",
    text: "#c8bea8",
    textDim: "#6a5f4a",
  },
  snow: {
    name: "孤峰积雪",
    accent: "#8ab4d4",      // 冷蓝
    accentDim: "#4a6a80",
    bg: "#080a0d",
    bgPanel: "#0a0d11",
    border: "#1a2530",
    text: "#c0cdd8",
    textDim: "#5a6a75",
  },
  wild: {
    name: "莽野无涯",
    accent: "#8ab48a",      // 青灰绿
    accentDim: "#4a6a4a",
    bg: "#090b08",
    bgPanel: "#0c0f0a",
    border: "#1e2818",
    text: "#c0c8b8",
    textDim: "#5a6650",
  },
  water: {
    name: "静水深流",
    accent: "#5a8ab4",      // 墨蓝
    accentDim: "#2a4a68",
    bg: "#080a0e",
    bgPanel: "#0a0d13",
    border: "#1a2535",
    text: "#b8c4d0",
    textDim: "#505f6e",
  },
  outland: {
    name: "他乡异客",
    accent: "#a89a80",      // 中性灰褐
    accentDim: "#6a5f4a",
    bg: "#0b0a09",
    bgPanel: "#0e0d0b",
    border: "#252118",
    text: "#c0b8a8",
    textDim: "#6a6255",
  },
  bamboo: {
    name: "雨城竹海",
    accent: "#7ab48a",      // 竹青绿
    accentDim: "#3a6a4a",
    bg: "#080b09",
    bgPanel: "#0a0f0c",
    border: "#1a2a1e",
    text: "#bcc8b8",
    textDim: "#556a58",
  },
};

// 日间模式：六套的浅色版本，字段一一对应上面的暗夜版。
export const ZONE_THEMES_DAY = {
  village: {
    name: "人间烟火·昼",
    accent: "#8a5a12",       // 暖黄深化：浓郁焦糖棕黄，浅底上依然醒目（比初版再压深，确保小字也够清晰）
    accentDim: "#c49a5a",    // 次强调走浅一档，供禁用态/弱高亮用
    bg: "#f5f0e4",           // 米色主背景
    bgPanel: "#faf7ee",      // 面板略白，制造"浮在底色上"的层次
    border: "#b3987a",       // 棕色边框
    text: "#3d3626",         // 暖黑正文
    textDim: "#8a7c62",      // 中棕灰次要文字
  },
  temple: {
    name: "梵音低回·昼",
    accent: "#8a5a1e",       // 赭石暗金深化
    accentDim: "#c08a4a",
    bg: "#f3ede1",
    bgPanel: "#f8f3e8",
    border: "#ad9270",
    text: "#3a3324",
    textDim: "#877a5f",
  },
  snow: {
    name: "孤峰积雪·昼",
    accent: "#2a5a7a",       // 冷蓝深化，浅底上仍有雪山冷冽感
    accentDim: "#6a94b0",
    bg: "#eef1f0",           // 微冷调米白，呼应雪山
    bgPanel: "#f6f8f7",
    border: "#9aaba8",
    text: "#2e3a3d",
    textDim: "#728085",
  },
  wild: {
    name: "莽野无涯·昼",
    accent: "#3a6a3a",       // 青灰绿深化
    accentDim: "#7aa07a",
    bg: "#eef1e8",
    bgPanel: "#f6f8f0",
    border: "#9aab8a",
    text: "#2e3626",
    textDim: "#748266",
  },
  water: {
    name: "静水深流·昼",
    accent: "#1e4a6a",       // 墨蓝深化
    accentDim: "#5a86a8",
    bg: "#ecf0f2",
    bgPanel: "#f5f8f9",
    border: "#93a8b3",
    text: "#28343d",
    textDim: "#6c7c85",
  },
  outland: {
    name: "他乡异客·昼",
    accent: "#6a5a3e",       // 灰褐深化
    accentDim: "#a0947a",
    bg: "#f0ece2",
    bgPanel: "#f7f4ec",
    border: "#ab9e88",
    text: "#38332a",
    textDim: "#847a68",
  },
  bamboo: {
    name: "雨城竹海·昼",
    accent: "#2a6a3e",       // 竹青深化
    accentDim: "#6aa07a",
    bg: "#eef2ec",
    bgPanel: "#f5f8f3",
    border: "#93ab96",
    text: "#2a362c",
    textDim: "#6c8070",
  },
};

// 根据房间名推断当前分区，返回对应主题；找不到时回退到 village。
// isDayMode=true 时从 ZONE_THEMES_DAY 取（六套浅色版本），默认 false 走原暗夜版，
// 两套主题字段一一对应，调用方不需要额外分支处理。
export function getZoneTheme(roomName, isDayMode = false) {
  const zone = ZONE_MAP[roomName] || "village";
  return (isDayMode ? ZONE_THEMES_DAY : ZONE_THEMES)[zone];
}

// ── 设计基元（本轮新增）：藏地三色点缀 + 语义色日夜适配 ──────────────────
// 总方针「简约为体、藏地为点」：界面骨架维持线条简约的 Claude 风，
// 藏地三色（松石绿/鎏金/绛红）只作语义化点缀——绿=交互/确认，金=重要入口，
// 红=警示/危险。每个色都给夜/日两版：暗夜版明度够亮才在暗底上显色，
// 日间版压深拉饱和，保证米色底上对比度达标（与 LogEntry 对话粉同一换算思路）。
export const INK = {
  turquoise: { night: "#6ec6c6", day: "#1e7a72" }, // 松石绿：设置/切换/交互确认
  gold:      { night: "#d4a853", day: "#8a5a12" }, // 鎏金：重要入口/任务金
  crimson:   { night: "#c85a6a", day: "#a62b3a" }, // 绛红：上报bug/NSFW/警示
  pink:      { night: "#e0a0d0", day: "#8a1e6a" }, // 好感/私聊粉（对齐 LogEntry 对话粉）
  green:     { night: "#8ac48a", day: "#2e6b34" }, // NPC名/对话绿
};
export const ink = (name, isDayMode) => INK[name][isDayMode ? "day" : "night"];
// 统一圆角阶：按钮 3 / 卡片与分组框 6 / 弹窗 8（此前散写 3/4/5/6/8 混用）
export const RADIUS = { btn: 3, card: 6, modal: 8 };

export function getZoneName(roomName) {
  return ZONE_MAP[roomName] || "village";
}

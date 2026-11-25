// 入册界面共用零件 · 常量层（从 widgets.jsx 拆出）
// ============================================================================
// 品阶玉色/条目元数据/七维/体貌两层字段/基础输入样式——纯数据，无 JSX。
//
// 视觉素材全部取自 public/stones/（原本给赌石玩法做的）。其中六档玉色
// jade_1_bai 到 jade_6_hong 正好对上品阶白绿蓝紫橙红，品阶徽记直接用玉石图。


const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
export const S = (p) => `${BASE}stones/${p}`;
// PORTRAIT 已删除。它拼的是 `${BASE}portraits/${f}`，而入册界面用它去取的那十张
// 立绘在 src/assets/portraits/ 走 Vite import，public/portraits/ 下只有
// narrator/pearl/player/snowleopard 四个子目录——十张全 404，配上 onError 隐藏破图，
// 表现成"立绘那一节是空的"。立绘统一走 portraits.js 的 resolveCardPortrait，
// 别再从这里拼路径。

// levelCap 0-5 → 玉色文件名与档位标签
export const TIERS = [
  { key: "bai", label: "白", jade: "jade_1_bai_chun.webp", color: "var(--bug-button-off-light)" },
  { key: "lv", label: "绿", jade: "jade_2_lv_chun.webp", color: "var(--green-soft)" },
  { key: "lan", label: "蓝", jade: "jade_3_lan_chun.webp", color: "var(--footer-hint-title)" },
  { key: "zi", label: "紫", jade: "jade_4_zi_chun.webp", color: "var(--lore-script)" },
  { key: "cheng", label: "橙", jade: "jade_5_cheng_chun.webp", color: "var(--attr-waigong-tag)" },
  { key: "hong", label: "红", jade: "jade_6_hong_chun.webp", color: "var(--red-soft)" },
];

export const KIND_META = {
  person: { label: "人物", icon: "👤", color: "var(--ink-warn)" },
  faction: { label: "势力", icon: "⚔", color: "var(--clay)" },
  place: { label: "地方", icon: "⛰", color: "var(--quest-success-text)" },
  rule: { label: "规矩", icon: "⚖", color: "var(--footer-hint-text)" },
  item: { label: "物件", icon: "◈", color: "var(--tavern-door-label)" },
  player: { label: "我自己", icon: "☯", color: "var(--lore-private)" },
  meta: { label: "框架", icon: "⚙", color: "var(--inject-kind-fallback)" },
  unknown: { label: "待定", icon: "?", color: "var(--ink-muted)" },
  drop: { label: "弃用", icon: "✕", color: "var(--mind-locked)" },
};

export const SEVEN = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

// bodyProfile 的两层。字段名与 bodyProfile.js 完全一致，顺序也照它的。
export const BODY_PUBLIC = [
  ["height", "身量"], ["build", "体型"], ["face", "面容"], ["skin", "肤色"],
  ["hair", "发式"], ["voice", "声音"], ["clothing", "惯常穿着"],
];
export const BODY_PRIVATE = [
  ["scars", "疤痕印记"], ["scent", "体味"], ["intimate", "身体细节"],
  ["sensitive", "敏感处"], ["habit", "习惯癖好"],
];

export const selStyle = {
  boxSizing: "border-box", width: "100%", background: "rgba(0,0,0,.4)",
  border: "1px solid var(--border-deep)", borderRadius: 0, padding: "5px 7px",
  color: "var(--paper)", fontSize: "var(--fs-sm)", outline: "none", fontFamily: "inherit",
  textAlign: "center", textAlignLast: "center",
};

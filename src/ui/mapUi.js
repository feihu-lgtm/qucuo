// 地图 UI 贴图（藏地卷轴风，见 docs/美术_地图UI素材提示词.md）。
// BASE 前缀适配 GitHub Pages 子路径部署（/qucuo/），本地开发时为 "/"。
const MAP_UI_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "stones/mapui/";
export const MAP_UI = {
  scroll:  MAP_UI_BASE + "scroll_bg.webp",
  frame:   MAP_UI_BASE + "frame.webp",
  idle:    MAP_UI_BASE + "cell_idle.webp",    // 已探索
  fog:     MAP_UI_BASE + "cell_fog.webp",     // 未探索·迷雾
  current: MAP_UI_BASE + "cell_current.webp", // 当前所在
};

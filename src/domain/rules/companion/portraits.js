// 立绘系统（领域薄壳）—— 存储与资源表在同目录 portraitStore.js；
// 本文件保留依赖 domain/narrator 好感度分档的旁白立绘两个函数，
// 并原样转发全部存储/资源导出，调用方无需改 import。
import { affectionTier } from "../narrator/narrator.js";

export * from "./portraitStore.js";

// ── 旁白立绘·好感度五档 ──
// 资源放 public/portraits/narrator/ 下，不走 src/assets 硬加载——图片由作者自行
// 投放，构建不该依赖文件是否存在；缺失时界面给占位提示，不影响构建与运行。
// 这五张是好感度自动切（玩家不能选），分档表是 narrator.js 的 AFFECTION_TIERS。
const NARRATOR_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/narrator/";

export function narratorPortraitUrl(affection) {
  return NARRATOR_BASE + affectionTier(affection).portrait;
}

// 当前这一档立绘叫什么（UI 上标一行小字，让玩家知道自己看的是第几形态）。
export function narratorPortraitLabel(affection) {
  return affectionTier(affection).portraitLabel;
}

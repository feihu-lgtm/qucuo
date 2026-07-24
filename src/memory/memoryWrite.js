// 记忆写入（提交段·异步副作用）· 兼容垫片
// ------------------------------------------------------------------
// 历史入口。小纸条系统统一化后（见 note.js），本文件只保留一个向后兼容的
// recordMemory 薄封装：把老调用（主叙事 AI 吐的 memory）转成 writeNote 的
// 「公共小纸条」（owner 空）。新代码请直接用 note.js 的 writeNote，带 owner。
//
// 语义不变：fire-and-forget、失败静默、只走成功路径（回滚不误写）。

import { writeNote, NOTE_SOURCE } from "./note.js";

// 旧签名：{ cfg, text, turn, knownNames, visibility?, requiredFlag? }
// 现有 MudRPG 调用只传前四个 → 写公共小纸条。visibility/requiredFlag 参数保留
// 是为了不破坏任何潜在旧调用签名；owner 模式下不再用 flag 门，忽略即可。
export async function recordMemory({ cfg, text, turn = 0, knownNames = [], place = null }) {
  return writeNote({
    cfg,
    text,
    turn,
    knownNames,
    place,
    owner: [],                       // 公共见闻
    source: NOTE_SOURCE.NARRATIVE,
  });
}

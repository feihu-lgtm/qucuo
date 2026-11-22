// ── NPC 涌现·第一阶段：mentionedNewNpcs 记为传闻中的人物（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree } } 由 commitRound 统一落盘。
import { recordRumoredNpcs } from "../../../domain/rules/npc/npcEmergence.js";

export function recordRumors({ p, narrativeText }) {
  if (!p.mentionedNewNpcs?.length) return null;
  // 用统一的 narrativeText 而不是 p.output——双调用模式下叙事在 rawFull 里，
  // 读 p.output 会拿到空串，传闻人物就成了没有上下文的光杆名字。
  return { changes: { varTree: (prev) => recordRumoredNpcs(prev, p.mentionedNewNpcs, narrativeText) } };
}

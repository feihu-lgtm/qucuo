// ── NPC 涌现·第一阶段：mentionedNewNpcs 记为传闻中的人物（原 commitRound 内嵌块）──
import { recordRumoredNpcs } from "../../../domain/rules/npc/npcEmergence.js";

export function recordRumors(d) {
  if (d.p.mentionedNewNpcs && d.p.mentionedNewNpcs.length) {
    // 用统一的 d.narrativeText 而不是 d.p.output——双调用模式下叙事在 d.rawFull 里，
    // 读 d.p.output 会拿到空串，传闻人物就成了没有上下文的光杆名字。
    d.setVarTree(prev => recordRumoredNpcs(prev, d.p.mentionedNewNpcs, d.narrativeText));
  }
}

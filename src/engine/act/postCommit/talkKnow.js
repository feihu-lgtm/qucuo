// ── 对话即认识：talkTarget/respondedNpcs 标记已认识（原 commitRound 内嵌块）──
import { markNpcAsKnown } from "../../../domain/rules/npc/npcAwareness.js";

export function markTalkAcquaintance(d) {
  if (d.isTalk) {
    const toKnow = new Set();
    if (d.talkTarget) toKnow.add(d.talkTarget); // 选定了对象：直接算认识
    // 没选人(或即便选了人)时，AI 回包的 respondedNpcs 报出本轮真正开口回应玩家的
    // NPC——用它精准标记，不靠解析正文猜"谁说话了"(那样极易误判被提及/路过的人)。
    // 只认在场名单里的名字，AI 若报了不在场的名字(幻觉)一律丢弃。
    if (Array.isArray(d.p.respondedNpcs)) {
      const presentNames = new Set((d.room.npcs || []).map(n => n.name));
      d.p.respondedNpcs.forEach(name => { if (typeof name === "string" && presentNames.has(name)) toKnow.add(name); });
    }
    if (toKnow.size) {
      d.setVarTree(prev => Array.from(toKnow).reduce((tree, name) => markNpcAsKnown(tree, name), prev));
    }
  }
}

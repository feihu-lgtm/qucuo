// ── 对话即认识：talkTarget/respondedNpcs 标记已认识（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree } } 由 commitRound 统一落盘。
import { markNpcAsKnown } from "../../../domain/rules/npc/npcAwareness.js";

export function markTalkAcquaintance({ isTalk, talkTarget, room, p }) {
  if (!isTalk) return null;
  const toKnow = new Set();
  if (talkTarget) toKnow.add(talkTarget); // 选定了对象：直接算认识
  // 没选人(或即便选了人)时，AI 回包的 respondedNpcs 报出本轮真正开口回应玩家的
  // NPC——用它精准标记，不靠解析正文猜"谁说话了"(那样极易误判被提及/路过的人)。
  // 只认在场名单里的名字，AI 若报了不在场的名字(幻觉)一律丢弃。
  if (Array.isArray(p.respondedNpcs)) {
    const presentNames = new Set((room.npcs || []).map(n => n.name));
    p.respondedNpcs.forEach(name => { if (typeof name === "string" && presentNames.has(name)) toKnow.add(name); });
  }
  if (!toKnow.size) return null;
  return { changes: { varTree: (prev) => Array.from(toKnow).reduce((tree, name) => markNpcAsKnown(tree, name), prev) } };
}

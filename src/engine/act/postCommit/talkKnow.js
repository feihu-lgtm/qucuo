// ── 对话即认识：talkTarget/respondedNpcs 标记已认识（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree } } 由 commitRound 统一落盘。
import { markNpcAsKnown } from "../../../domain/rules/npc/npcAwareness.js";

export function markTalkAcquaintance({ isTalk, talkTarget, room, p, derivedRespondedNpcs }) {
  if (!isTalk) return null;
  const toKnow = new Set();
  if (talkTarget) toKnow.add(talkTarget); // 选定了对象：直接算认识
  const presentNames = new Set((room.npcs || []).map(n => n.name));
  // WO-16A：系统推导（intake 听意单 kind=talk 的 target）永远优先——不再依赖
  // 叙事模型自证；模型自证（SEAL/单调用 JSON 的 respondedNpcs）只在推导为空时
  // 兜底，属低可信过渡（见 docs）。只认在场名单，幻觉名字一律丢弃。
  const reported = Array.isArray(derivedRespondedNpcs) && derivedRespondedNpcs.length
    ? derivedRespondedNpcs
    : (Array.isArray(p.respondedNpcs) ? p.respondedNpcs : []);
  reported.forEach(name => { if (typeof name === "string" && presentNames.has(name)) toKnow.add(name); });
  if (!toKnow.size) return null;
  return { changes: { varTree: (prev) => Array.from(toKnow).reduce((tree, name) => markNpcAsKnown(tree, name), prev) } };
}

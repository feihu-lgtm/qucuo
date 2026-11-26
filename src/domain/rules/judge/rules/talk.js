// ── talk 搭话（S4 纯搬家：原 judgeTurn.js talk 分支原样移入）──
// stance 映射确定性小额好感，不掷骰——闲聊不该有随机性社交风险。
import { TALK_STANCE_DELTA } from "./shared.js";

export function handleTalk(J, action, npc) {
  const { facts, nextFactId } = J;
  // 第一道防线：无好感轨道对象（兽类/intimacy.forbidden）判官直接不产社交事实——
  // findNpc 处本来就有对象，不必等 materialize 再拦。cannotSpeak 不算无轨道。
  // 注：谓词就地内联而非 import affection.js——affection→applyWrite→fields
  // 会循环依赖回本模块。口径与 hasNoAffectionTrack 一致：forbidden 或兽类。
  if (npc?.intimacy?.forbidden || npc?.beast) return;
  const delta = TALK_STANCE_DELTA[action.stance] ?? 0;
  if (!delta) return; // perfunctory/未知：零事实
  const fact = {
    id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
    affectionDelta: delta, ledgerKind: delta > 0 ? "恩" : "怨",
    reason: delta > 0 ? "搭话投机" : "言语冲撞", witnesses: ["主角", npc.name],
  };
  // S2+W-FIX2（第 18 式）：hostile 辱骂/羞辱/威胁统一附带 anger——不再只限暴烈
  // 刚烈阴鸷（被骂的人该怒就怒，与老孙暴怒正文一致）；唯一例外是怯懦词条
  // （胆小/怯懦/温顺）——被骂不敢怒。缘由写「当面羞辱」。
  if (action.stance === "hostile" && !/胆小|怯懦|温顺/.test(npc.personality || "")) {
    fact.anger = { active: true, reason: "当面羞辱", turnsLeft: 3 };
  }
  facts.push(fact);
}

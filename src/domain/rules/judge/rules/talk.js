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
  // S2：hostile 辱骂/羞辱/威胁——对方性情含暴烈/刚烈/阴鸷时同时置生气，
  // 缘由写玩家原话前 20 字（与偷窃败露同 anger 形状，appease 链自动可消）。
  if (action.stance === "hostile" && /暴烈|刚烈|阴鸷/.test(npc.personality || "")) {
    fact.anger = { active: true, reason: (action.text || "").slice(0, 20) || "恶语相向", turnsLeft: 3 };
  }
  facts.push(fact);
}

// ── appease 赔罪收拒裁决（S4 纯搬家：原 judgeTurn.js appease 分支原样移入）──
import { personaMod, affectionMod } from "./shared.js";

export function handleAppease(J, action, npc, aff, stanceMod) {
  const { roll, facts, notes, nextFactId } = J;
  // WO-16F-F3：perfunctory 一票否决——敷衍赔罪不受理，零 facts 不掷骰。
  if (action.stance === "perfunctory") {
    notes.push(`${npc.name}面前几句敷衍，赔罪不受理（perfunctory 否决）`);
    if (J.lastActionOutcome) { J.lastActionOutcome.rejected = true; J.lastActionOutcome.kind = "appease"; J.lastActionOutcome.target = npc.name; }
    return;
  }
  const score = 0.5 + personaMod(npc.personality) + affectionMod(aff) + stanceMod;
  if (roll() < Math.max(0.05, Math.min(0.95, score))) {
    J.accept.value = true;
    facts.push({
      id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
      affectionDelta: 3, ledgerKind: "见", reason: "赔罪言和", witnesses: ["主角", npc.name],
      // WO-16F-F3：detail 明示正文方向——renderJudgeVerdict 逐字渲染进定案单，
      // 主叙事不得写成余怒未消。
      detail: "赔罪奏效，怒气消解，好感回暖",
      // WO-16F-F3：成功消气 + 消解对方最近一条未了「怨」（不删原文，只打标记）。
      angerRelease: true, grudgeResolve: true,
    });
  } else {
    notes.push(`${npc.name}余怒未消，赔罪未收下`);
  }
}

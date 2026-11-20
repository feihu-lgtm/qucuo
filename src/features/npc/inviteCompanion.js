import { isNpcAngry } from "../../domain/combat/stealSystem.js";
import { appeaseAngryNpc } from "./anger.js";
import { companionKeyByName, unlockImportedCompanion, unlockPearl, unlockSnowLeopard } from "../../domain/companion/companion.js";
import { markNpcAsKnown as markNpcKnown } from "../../domain/npc/npcAwareness.js";
import { removeNpc } from "../../domain/npc/roomNpcs.js";
import { SNOW_QUEST_ID, SNOW_TRUSTED, SNOW_INVITED } from "../../domain/quests/snowLeopardQuest.js";
import { createQuestProgress } from "../../domain/quests/questEngine.js";

export function inviteCompanion(state, npc, ctx = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "invite" });
  const key = companionKeyByName(npc.name);
  let companionState = state.companionState || {};
  if (key === "snowLeopard" && companionState.snowLeopard?.unlocked) return {};
  if (key === "snowLeopard" && !(state.flags || []).includes(SNOW_TRUSTED)) {
    return { logs: [{ t: "sys", text: "  雪豹偏过头去，不肯随行。山川之灵尚未认你。" }] };
  }
  if (key === "snowLeopard") companionState = unlockSnowLeopard(companionState);
  else if (key === "pearl") companionState = unlockPearl(companionState);
  else if (npc.imported) companionState = unlockImportedCompanion(companionState, npc);
  else return {};

  const now = ctx.getNow?.() ?? Date.now();
  return {
    changes: {
      companionState,
      ...(key === "snowLeopard" ? {
        flags: (f) => [...new Set([...f, SNOW_INVITED])],
        questProgress: (p) => ({ ...p, [SNOW_QUEST_ID]: { ...(p?.[SNOW_QUEST_ID] || createQuestProgress(SNOW_QUEST_ID, now)), status: "completed", currentStageIndex: 2, completedAt: now } }),
      } : {}),
      varTree: (prev) => markNpcKnown(prev || {}, npc.name),
      room: (prev) => ({
        ...prev,
        npcs: removeNpc(prev.npcs, (entry) => entry.name === npc.name && (entry.companionCandidate || entry.imported)),
      }),
    },
    settle: `向${npc.name}伸出手，郑重邀它同行`,
    settleOptions: { settleNpc: npc.name, settleKind: "companion_invite", settleBeast: !!npc.beast },
  };
}

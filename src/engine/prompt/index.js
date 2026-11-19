import { buildPresence, buildNpcContext, buildQuestStageNote, buildForcedEventNote, buildArrivalNote } from "./roundNotes.js";
import { buildBudgetInstruction } from "../../domain/prompt/inputIntent.js";
import { buildEncounterNote } from "../../domain/map/encounter.js";
import { findTargetedRumor } from "../../domain/npc/npcEmergence.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { hasInnerMap } from "../../domain/map/innerMap.js";
import { QUALITY, CATEGORY_LABEL, describeEquipment } from "../../domain/economy/equipment.js";
import { describeTodayForAI } from "../../domain/memory/tally.js";

export { buildPresence, buildNpcContext, buildQuestStageNote, buildForcedEventNote, buildArrivalNote };
export { assemblePrompt } from "./assemblePrompt.js";

export function createPromptContext(state, args = {}) {
  const { importedNpcLore = [], companionForms = {}, ...explicit } = args;
  return {
    buildPresence,
    buildNpcContext: (input) => buildNpcContext({ ...input, importedNpcLore, companionForms }),
    buildQuestStageNote, buildForcedEventNote, buildArrivalNote,
    buildBudgetInstruction, buildEncounterNote, findTargetedRumor,
    getTimeStr, hasInnerMap, quality: QUALITY, categoryLabel: CATEGORY_LABEL,
    describeEquipment, describeTodayForAI,
    ...state,
    timeForToday: state.timeForToday ?? state.time,
    ...explicit,
  };
}

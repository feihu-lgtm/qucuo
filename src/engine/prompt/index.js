import { buildPresence, buildNpcContext, buildQuestStageNote, buildForcedEventNote, buildArrivalNote } from "./roundNotes.js";
import { buildBudgetInstruction } from "../../inputIntent.js";
import { buildEncounterNote } from "../../encounter.js";
import { findTargetedRumor } from "../../npcEmergence.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { hasInnerMap } from "../../innerMap.js";
import { QUALITY, CATEGORY_LABEL, describeEquipment } from "../../equipment.js";
import { describeTodayForAI } from "../../memory/tally.js";

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

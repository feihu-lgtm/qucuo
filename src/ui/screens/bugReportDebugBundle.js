import { buildDebugBundle } from "../../infra/debugBundle.js";

const MODAL_RECENT_LOG_TYPES = new Set([
  "sys",
  "stat",
  "err",
  "quest",
  "item",
  "loot",
  "skill",
]);

export function getSelectedBugReportTurns(turns, selectedTurns) {
  return turns
    .filter((_, index) => selectedTurns.has(index))
    .map(turn => ({ label: turn.label, entries: turn.entries }));
}

export function buildModalDebugBundle(debugSources, turns, selectedTurns, includeActionTrees, actionTrees) {
  const sources = {
    ...debugSources,
    conversation: getSelectedBugReportTurns(turns, selectedTurns),
  };
  if (!includeActionTrees) {
    sources.pipelineCalls = [];
    sources.traces = [];
  } else if (actionTrees) {
    sources.traces = actionTrees;
  }
  const bundle = buildDebugBundle(sources);
  bundle.recentLog = bundle.recentLog.filter(entry => MODAL_RECENT_LOG_TYPES.has(entry?.t));
  return bundle;
}

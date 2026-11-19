import { buildDebugBundle } from "../../infra/debugBundle.js";

export function getSelectedBugReportTurns(turns, selectedTurns) {
  return turns
    .filter((_, index) => selectedTurns.has(index))
    .map(turn => ({ label: turn.label, entries: turn.entries }));
}

export function buildModalDebugBundle(debugSources, turns, selectedTurns, includePipeline) {
  const sources = {
    ...debugSources,
    conversation: getSelectedBugReportTurns(turns, selectedTurns),
  };
  if (!includePipeline) {
    sources.pipelineCalls = [];
    sources.traces = [];
  }
  return buildDebugBundle(sources);
}

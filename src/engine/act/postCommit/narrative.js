// ── 叙事呈现：固定台本覆盖/切磋战报交织/正文输出/截断提示（原 commitRound 内嵌块）──
import { findScriptOverride } from "../commitHelpers.js";
import { interleaveDuelReport } from "../../../domain/rules/combat/duelReport.js";

export function emitNarrative(d) {
  const scriptOverride = findScriptOverride(d.p.delta?.flags_add || [], d.questProgress);
  if (d.duelReport?.rounds) {
    const narrative = Array.isArray(d.p.output) && d.p.output.length ? d.p.output : d.narrativeText || d.rawFull || "";
    d.addLog(interleaveDuelReport(d.duelReport.rounds, narrative));
  } else if (scriptOverride) {
    d.addLog(scriptOverride.split("\n").filter(line => line.length).map(t => ({ t: "desc", text: "  " + t })));
  } else if (d.p.output) {
    d.addLog(d.p.output.map(t => ({ t: "desc", text: "  " + t })));
  }
  if (d.p._truncated) d.addLog([{ t: "sys", text: "  ⚠ 本轮回复被接口中途截断，以上仅为已收到的完整部分（多为中转站/模型输出上限所致，可换接口或调低目标字数；详见 📋 Pipeline 的停止原因）" }]);
}

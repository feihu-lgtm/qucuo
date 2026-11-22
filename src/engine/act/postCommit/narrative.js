// ── 叙事呈现：固定台本覆盖/正文输出/截断提示（原 commitRound 内嵌块）──
// 路线甲纯函数化：不直接写日志，返回 { logs } 由 commitRound 统一落盘。
import { findScriptOverride } from "../commitHelpers.js";

export function emitNarrative({ p, questProgress }) {
  const logs = [];
  const scriptOverride = findScriptOverride(p.delta?.flags_add || [], questProgress);
  if (scriptOverride) {
    logs.push(...scriptOverride.split("\n").filter(line => line.length).map(t => ({ t: "desc", text: "  " + t })));
  } else if (p.output) {
    logs.push(...p.output.map(t => ({ t: "desc", text: "  " + t })));
  }
  if (p._truncated) logs.push({ t: "sys", text: "  ⚠ 本轮回复被接口中途截断，以上仅为已收到的完整部分（多为中转站/模型输出上限所致，可换接口或调低目标字数；详见 📋 Pipeline 的停止原因）" });
  return logs.length ? { logs } : null;
}

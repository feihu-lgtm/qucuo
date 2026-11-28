// WO-25I：茶馆风声接线——已传播到本据点的世界事件喂给 TeahouseScreen。
// 放在 app 层是为了遵守 JSX 不直连 domain/rules 的分层红线。
import { useGameStore } from "../../store/gameStore.js";
import { getKnownEventsForDistrict } from "../../domain/rules/livingWorld/projectWorld.js";

export function useTeahouseEventTexts(limit = 6) {
  return useGameStore((s) =>
    getKnownEventsForDistrict({ varTree: s.varTree, time: s.time }, s.room?.name, limit)
      .map((e) => String(e?.text || e?.summary || "").trim()).filter(Boolean));
}

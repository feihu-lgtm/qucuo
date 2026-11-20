import { random } from "../../core/rng.js";

export function rollStatusApply(move) {
  if (move.confuseChance && random() < move.confuseChance) return "气乱";
  if (move.applyStatus) {
    const status = typeof move.applyStatus === "string" ? move.applyStatus : move.applyStatus.name;
    const chance = move.statusChance ?? move.applyStatus.chance ?? 1;
    if (random() < chance) return status;
  }
  return null;
}

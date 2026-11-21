import { buildPrompt } from "./buildPrompt.js";
import "./calls/sideCalls.js";

export function buildPigeonPrompt(state, letter, preset, trace) {
  return buildPrompt("pigeon.reply", { state, letter, preset, trace }).system;
}

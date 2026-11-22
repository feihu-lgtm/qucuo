import { buildSnapshot } from "../engine/ports/saves.js";
import { GAME_KEYS, gameStore } from "./gameStore.js";
import { getRngState } from "../utils/rng.js";

const pick = (state, keys) => Object.fromEntries(keys.map((key) => [key, state[key]]));

export function snapshotFromStore(extra) {
  return buildSnapshot({ ...pick(gameStore.getState(), GAME_KEYS), ...extra, rngState: getRngState() });
}

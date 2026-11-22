import { buildSnapshot } from "../infra/saves.js";
import { GAME_KEYS, gameStore } from "./gameStore.js";
import { getRngState } from "../infra/rng.js";

const pick = (state, keys) => Object.fromEntries(keys.map((key) => [key, state[key]]));

export function snapshotFromStore(extra) {
  return buildSnapshot({ ...pick(gameStore.getState(), GAME_KEYS), ...extra, rngState: getRngState() });
}

import { buildSnapshot } from "../saves.js";
import { GAME_KEYS, useGameStore } from "./gameStore.js";

const pick = (state, keys) => Object.fromEntries(keys.map((key) => [key, state[key]]));

export function snapshotFromStore(extra) {
  return buildSnapshot({ ...pick(useGameStore.getState(), GAME_KEYS), ...extra });
}

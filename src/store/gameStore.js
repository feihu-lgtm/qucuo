import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { PLAYER_KEYS } from "./slices/player.js";
import { WORLD_KEYS } from "./slices/world.js";
import { NARRATIVE_KEYS } from "./slices/narrative.js";
import { QUEST_KEYS } from "./slices/quest.js";
import { ECONOMY_KEYS } from "./slices/economy.js";

export const GAME_KEYS = [
  ...PLAYER_KEYS,
  ...WORLD_KEYS,
  ...NARRATIVE_KEYS,
  ...QUEST_KEYS,
  ...ECONOMY_KEYS,
];

export const gameStore = createStore(() => ({
  char: undefined,
  dao: undefined,
  skills: undefined,
  exp: undefined,
  pot: undefined,
  inv: undefined,
  companionState: undefined,
  preset: undefined,
  room: undefined,
  innerRoomName: undefined,
  mapData: undefined,
  time: undefined,
  log: undefined,
  convo: undefined,
  narrator: undefined,
  varTree: undefined,
  flags: undefined,
  questProgress: undefined,
  persuasionProgress: undefined,
  claimedMilestones: undefined,
  deposit: undefined,
  depositedAt: undefined,
  pledgedItems: undefined,
}));

const createSetter = (key) => (next) => gameStore.setState((state) => ({
  [key]: typeof next === "function" ? next(state[key]) : next,
}));

export const gameActions = {
  setChar: createSetter("char"),
  setDao: createSetter("dao"),
  setSkills: createSetter("skills"),
  setExp: createSetter("exp"),
  setPot: createSetter("pot"),
  setInv: createSetter("inv"),
  setCompanionState: createSetter("companionState"),
  setPreset: createSetter("preset"),
  setRoom: createSetter("room"),
  setInnerRoomName: createSetter("innerRoomName"),
  setMapData: createSetter("mapData"),
  setTime: createSetter("time"),
  setLog: createSetter("log"),
  setConvo: createSetter("convo"),
  setNarrator: createSetter("narrator"),
  setVarTreeState: createSetter("varTree"),
  setFlags: createSetter("flags"),
  setQuestProgress: createSetter("questProgress"),
  setPersuasionProgress: createSetter("persuasionProgress"),
  setClaimedMilestones: createSetter("claimedMilestones"),
  setDeposit: createSetter("deposit"),
  setDepositedAt: createSetter("depositedAt"),
  setPledgedItems: createSetter("pledgedItems"),
};

const replacedListeners = new Set();

// 读档、新开局、创角会整体换掉一局：时间等字段的跳变不是"过了一回合"，
// 依赖历史（如世界规则的上一次 deps）必须随之作废。
export function subscribeGameReplaced(listener) {
  replacedListeners.add(listener);
  return () => replacedListeners.delete(listener);
}

export function markGameReplaced() {
  for (const listener of [...replacedListeners]) listener();
}

export function initGameStore(values) {
  gameStore.setState(
    Object.fromEntries(GAME_KEYS.map((key) => [key, values[key]])),
    true,
  );
  markGameReplaced();
}

// React 侧的唯一读取口：组件用 selector 订阅 gameStore。
export const useGameStore = (selector) => useStore(gameStore, selector);
useGameStore.getState = gameStore.getState;
useGameStore.setState = gameStore.setState;

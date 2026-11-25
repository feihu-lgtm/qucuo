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
  dungeonRun: undefined,
  npcState: undefined,
  roomCache: undefined,
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

// ── 原文段落谱系写收口（WO-18）──────────────────────────────────
// proseLineage/proseSeq 的写操作只能在这里发生——app/hooks 直写 state 受
// 棘轮只减不增管控，谱系簿记统一收口 store 层。
import { ensureProseLineage, forkLineage, headBranch } from "../domain/rules/memory/lineage.js";

// 同步 seq 分配器：zustand 写读同步，同一 tick 内先读再写即原子。
// 谱系缺失时顺手补建根分支（新开一局/老存档首写都经此路落地）。
export function allocProseSeq(count) {
  const st = gameStore.getState();
  const norm = ensureProseLineage(st);
  if (norm.created || norm.proseLineage !== st.proseLineage || norm.proseSeq !== st.proseSeq) {
    gameActions.setProseLineage(norm.proseLineage);
    gameActions.setProseSeq(norm.proseSeq);
  }
  const head = headBranch(norm.proseLineage);
  const start = (Number.isFinite(norm.proseSeq) ? norm.proseSeq : 0) + 1;
  gameActions.setProseSeq(start - 1 + count);
  return { branchId: head?.b || "", startSeq: start };
}

// 谱系规范化写回（reconcile 用）：缺谱系补建根分支，返回 { created, lineage }。
export function ensureProseLineageInStore() {
  const st = gameStore.getState();
  const norm = ensureProseLineage(st);
  if (norm.created || norm.proseLineage !== st.proseLineage) {
    gameActions.setProseLineage(norm.proseLineage);
    gameActions.setProseSeq(norm.proseSeq);
  }
  return { created: norm.created, lineage: norm.proseLineage };
}

// 迁移占用 seq 记账 + 分叉写回（reconcile 用）
export function writeProseSeq(value) {
  gameActions.setProseSeq(value);
}
export function applyProseLineageFork(atTurn) {
  const cur = gameStore.getState().proseLineage;
  const forked = forkLineage(cur, atTurn);
  gameActions.setProseLineage(forked.proseLineage);
  gameActions.setProseSeq(0);
  return forked.proseLineage;
}

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
  setDungeonRun: createSetter("dungeonRun"),
  setNpcState: createSetter("npcState"),
  setRoomCache: createSetter("roomCache"),
  setTime: createSetter("time"),
  setProseLineage: createSetter("proseLineage"),
  setProseSeq: createSetter("proseSeq"),
  setLog: createSetter("log"),
  setConvo: createSetter("convo"),
  setNarrator: createSetter("narrator"),
  setVarTreeState: createSetter("varTree"),
  // varTree 的唯一写入口：hook 不再经 varTreeRef/传参写它，store 即最新值。
  setVarTree: createSetter("varTree"),
  updateVarTree: (updater) => gameStore.setState((state) => ({ varTree: updater(state.varTree) })),
  setFlags: createSetter("flags"),
  setQuestProgress: createSetter("questProgress"),
  setPersuasionProgress: createSetter("persuasionProgress"),
  setClaimedMilestones: createSetter("claimedMilestones"),
  setDeposit: createSetter("deposit"),
  setDepositedAt: createSetter("depositedAt"),
  setPledgedItems: createSetter("pledgedItems"),
};

const replacedListeners = new Set();
let gameEpoch = 0;
let sessionEpoch = 0;
let nextReplaceIsUndo = false;

// 读档、新开局、创角会整体换掉一局：时间等字段的跳变不是"过了一回合"，
// 依赖历史（如世界规则的上一次 deps）必须随之作废。
export function getGameEpoch() {
  return gameEpoch;
}

export function isGameEpochStale(epoch) {
  return epoch !== gameEpoch;
}

export function getSessionEpoch() {
  return sessionEpoch;
}

export function isSessionEpochStale(epoch) {
  return epoch !== sessionEpoch;
}

export function markNextReplaceAsUndo() {
  nextReplaceIsUndo = true;
}

export function clearNextReplaceAsUndo() {
  nextReplaceIsUndo = false;
}

export function subscribeGameReplaced(listener) {
  replacedListeners.add(listener);
  return () => replacedListeners.delete(listener);
}

export function markGameReplaced() {
  const isUndo = nextReplaceIsUndo;
  nextReplaceIsUndo = false;
  gameEpoch += 1;
  if (!isUndo) sessionEpoch += 1;
  for (const listener of [...replacedListeners]) listener({ isUndo });
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

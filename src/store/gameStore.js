import { useStore } from "zustand";
import { gameStore } from "../core/gameStore.js";

export * from "../core/gameStore.js";

export const useGameStore = (selector) => useStore(gameStore, selector);
useGameStore.getState = gameStore.getState;
useGameStore.setState = gameStore.setState;

// 地宫存档写入口（store 层统一写边界）：ui 不直接 gameActions.setDungeonRun——
// 世界生成回写/活动图档持久化/换图重置三处写收在这里，ui 层只调语义化函数。
import { gameActions, gameStore } from "./gameStore.js";
import { normalizeDungeonStore, syncDungeonWorld } from "../domain/rules/dungeon/engine.js";

export function persistDungeonWorld(dungeonStore, districtKey, world) {
  gameActions.setDungeonRun({
    active: dungeonStore.active,
    worlds: { ...dungeonStore.worlds, [districtKey]: world },
  });
}

export function persistActiveDungeonMapRun(districtKey, nextMapRun, { currentWorld, fallbackTime = 0 } = {}) {
  if (!districtKey || !nextMapRun) return;
  const latest = normalizeDungeonStore(gameStore?.getState?.()?.dungeonRun);
  const baseWorld = latest.worlds?.[districtKey] || currentWorld;
  const synced = baseWorld
    ? syncDungeonWorld(baseWorld, nextMapRun, { time: gameStore?.getState?.()?.time ?? fallbackTime })
    : baseWorld;
  gameActions.setDungeonRun({
    active: nextMapRun.status === "exploring" || nextMapRun.status === "combat" ? nextMapRun : null,
    worlds: synced ? { ...latest.worlds, [districtKey]: synced } : latest.worlds,
  });
}

export function resetDungeonWorldRun(districtKey, freshWorld) {
  const latest = normalizeDungeonStore(gameStore?.getState?.()?.dungeonRun);
  gameActions.setDungeonRun({
    active: null,
    worlds: { ...latest.worlds, [districtKey]: freshWorld },
  });
}

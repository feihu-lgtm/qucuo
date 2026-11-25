export const WORLD_KEYS = [
  "room",
  "innerRoomName",
  "mapData",
  "time",
  // 地宫内层地图 run 态：进 checkpoint 房落地 checkpointSnapshot 后可随存档持久化
  "dungeonRun",
  // NPC 随身交易账（设计稿 §3）：{[npcId]:{trade:{sold,bought}}}，货随人走随档持久化
  "npcState",
  // 房间缓存：{[地名]:{items,npcs}}，访问过的房间物件/人物快照，移动回读与存档持久化
  // （对接 saves.js 已有 roomMap 字段——读档时旧键 roomMap 由 useAutosave 迁移落入本键）
  "roomCache",
];

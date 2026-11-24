export const WORLD_KEYS = [
  "room",
  "innerRoomName",
  "mapData",
  "time",
  // 地宫内层地图 run 态：进 checkpoint 房落地 checkpointSnapshot 后可随存档持久化
  "dungeonRun",
  // NPC 随身交易账（设计稿 §3）：{[npcId]:{trade:{sold,bought}}}，货随人走随档持久化
  "npcState",
];

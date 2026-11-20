export const LEFT_FACE_PREF_KEY = "qucuo_left_faces";
export const LEFT_MODULES = [
  { id: "location", label: "地点信息" },
  { id: "exits", label: "出口" },
  { id: "homestead", label: "家园设施" },
  { id: "buildings", label: "此地建筑" },
  { id: "npcs", label: "此处人物" },
  { id: "map", label: "地图" },
];
export const LEFT_FACE_DEFAULTS = {
  faces: [
    { id: "here", name: "此地", modules: ["location", "exits", "homestead"] },
    { id: "surroundings", name: "周遭", modules: ["buildings", "npcs", "map"] },
  ],
  currentIndex: 0,
};

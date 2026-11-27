export const LEFT_FACE_PREF_KEY = "qucuo_left_faces";
export const LEFT_MODULES = [
  { id: "location", label: "地点信息" },
  { id: "exits", label: "邻近地点" },
  { id: "outerMap", label: "外部地图" },
  { id: "buildings", label: "此地建筑" },
  { id: "homestead", label: "家园设施" },
  { id: "innerMap", label: "内部地图" },
  { id: "npcs", label: "此处人物" },
];
export const LEFT_FACE_DEFAULTS = {
  faces: [
    { id: "here", name: "此地", modules: ["location", "exits", "outerMap"] },
    { id: "surroundings", name: "周遭", modules: ["buildings", "homestead", "innerMap"] },
    { id: "people", name: "人物", modules: ["npcs"] },
  ],
  currentIndex: 0,
};

export function migrateLeftFaces(prefs) {
  if (!prefs?.faces?.length) return prefs;
  const hasHere = prefs.faces.some(f => f.id === "here");
  const hasSurr = prefs.faces.some(f => f.id === "surroundings");
  const hasPeople = prefs.faces.some(f => f.id === "people");
  if (!hasHere || !hasSurr || hasPeople) return prefs;
  return {
    faces: LEFT_FACE_DEFAULTS.faces.map(f => ({ ...f, modules: [...f.modules] })),
    currentIndex: Math.min(Math.max(prefs.currentIndex || 0, 0), LEFT_FACE_DEFAULTS.faces.length - 1),
  };
}

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
    { id: "here", name: "此地", modules: ["location", "exits", "map", "homestead"] },
    { id: "surroundings", name: "周遭", modules: ["buildings", "npcs"] },
  ],
  currentIndex: 0,
};

export function migrateLeftFaces(prefs) {
  if (!prefs?.faces?.length) return prefs;
  const here = prefs.faces.find(f => f.id === "here");
  const surr = prefs.faces.find(f => f.id === "surroundings");
  if (!here || !surr || here.modules.includes("map")) return prefs;
  return {
    ...prefs,
    faces: prefs.faces.map(f => {
      if (f.id === "here") {
        const next = f.modules.filter(id => id !== "map");
        const exitsAt = next.indexOf("exits");
        next.splice(exitsAt >= 0 ? exitsAt + 1 : next.length, 0, "map");
        return { ...f, modules: next };
      }
      if (f.id === "surroundings") {
        return { ...f, modules: f.modules.filter(id => id !== "map") };
      }
      return f;
    }),
  };
}

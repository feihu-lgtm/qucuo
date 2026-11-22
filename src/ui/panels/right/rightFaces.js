export const FACE_PREF_KEY = "qucuo_right_faces";
export const RIGHT_MODULES = [
  { id: "profile", label: "侠客资料" },
  { id: "equipmentBonus", label: "装备总加成" },
  { id: "attributes", label: "内外功七维" },
  { id: "team", label: "队伍" },
  { id: "skills", label: "武学" },
  { id: "combatMoves", label: "临阵招式" },
  { id: "equipment", label: "装备" },
  { id: "inventory", label: "包袱" },
  { id: "narrator", label: "旁白" },
  { id: "jianghu", label: "江湖" },
  { id: "quest", label: "任务" },
];

export const RIGHT_FACE_DEFAULTS = {
  faces: [
    { id: "character", name: "人物", modules: ["profile", "equipmentBonus", "attributes"] },
    { id: "quest", name: "任务", modules: ["quest"] },
    { id: "martial", name: "武学", modules: ["skills", "combatMoves"] },
    { id: "belongings", name: "行囊", modules: ["equipment", "inventory"] },
    { id: "bonds", name: "羁绊", modules: ["team", "narrator"] },
    { id: "jianghu", name: "江湖", modules: ["jianghu"] },
  ],
  currentIndex: 0,
};

export const QUEST_FACE_MIGRATION_KEY = "qucuo_right_faces_quest_added";

// 「任务」面是后加的：已存的老布局里没有它，插到第二面（人物之后），只插一次。
export function addQuestFace(preferences, maxFaces = 6) {
  const { faces, currentIndex } = preferences;
  if (faces.length >= maxFaces || faces.some(face => face.id === "quest" || face.modules.includes("quest"))) return preferences;
  const quest = RIGHT_FACE_DEFAULTS.faces.find(face => face.id === "quest");
  const at = Math.min(1, faces.length);
  return {
    faces: [...faces.slice(0, at), { ...quest, modules: [...quest.modules] }, ...faces.slice(at)],
    currentIndex: currentIndex >= at ? currentIndex + 1 : currentIndex,
  };
}

export function migrateRightFaces(preferences, storage) {
  try {
    if (storage.getItem(QUEST_FACE_MIGRATION_KEY)) return preferences;
    storage.setItem(QUEST_FACE_MIGRATION_KEY, "1");
  } catch { return preferences; }
  return addQuestFace(preferences);
}

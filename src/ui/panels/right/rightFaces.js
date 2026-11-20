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
];

export const RIGHT_FACE_DEFAULTS = {
  faces: [
    { id: "character", name: "人物", modules: ["profile", "equipmentBonus", "attributes"] },
    { id: "martial", name: "武学", modules: ["skills", "combatMoves"] },
    { id: "belongings", name: "行囊", modules: ["equipment", "inventory"] },
    { id: "bonds", name: "羁绊", modules: ["team", "narrator"] },
    { id: "jianghu", name: "江湖", modules: ["jianghu"] },
  ],
  currentIndex: 0,
};

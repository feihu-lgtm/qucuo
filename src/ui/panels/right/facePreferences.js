export const FACE_PREF_KEY = "qucuo_right_faces";
export const MAX_FACES = 6;
export const MODULE_LABELS = Object.freeze({
  profile: "侠客资料",
  equipmentBonus: "装备总加成",
  attributes: "内外功七维",
  team: "队伍",
  skills: "武学",
  combatMoves: "临阵招式",
  equipment: "装备",
  inventory: "包袱",
  narrator: "旁白",
});

export function defaultFacePreferences() {
  return {
    faces: [
      { id: "character", name: "人物", modules: ["profile", "equipmentBonus", "attributes"] },
      { id: "martial", name: "武学", modules: ["skills", "combatMoves"] },
      { id: "belongings", name: "行囊", modules: ["equipment", "inventory"] },
      { id: "bonds", name: "羁绊", modules: ["team", "narrator"] },
    ],
    currentIndex: 0,
  };
}

export function validateFacePreferences(value) {
  if (!value || !Array.isArray(value.faces) || value.faces.length < 1 || value.faces.length > MAX_FACES) {
    return defaultFacePreferences();
  }
  const ids = new Set();
  const faces = [];
  for (const face of value.faces) {
    if (!face || typeof face.id !== "string" || !/^[\w-]{1,80}$/.test(face.id)
      || ids.has(face.id) || typeof face.name !== "string" || !face.name.trim()
      || !Array.isArray(face.modules)) return defaultFacePreferences();
    ids.add(face.id);
    faces.push({
      id: face.id,
      name: face.name.trim().slice(0, 12),
      modules: [...new Set(face.modules.filter(id => typeof id === "string" && Object.hasOwn(MODULE_LABELS, id)))],
    });
  }
  const currentIndex = Number.isInteger(value.currentIndex)
    ? Math.max(0, Math.min(faces.length - 1, value.currentIndex)) : 0;
  return { faces, currentIndex };
}

export function parseFacePreferences(raw) {
  try { return validateFacePreferences(JSON.parse(raw)); }
  catch { return defaultFacePreferences(); }
}

export function rotateFace(preferences, delta) {
  const count = preferences.faces.length;
  return { ...preferences, currentIndex: ((preferences.currentIndex + delta) % count + count) % count };
}

function updateCurrent(preferences, update) {
  return {
    ...preferences,
    faces: preferences.faces.map((face, i) => i === preferences.currentIndex ? update(face) : face),
  };
}

export function renameFace(preferences, name) {
  return updateCurrent(preferences, face => ({ ...face, name: name.slice(0, 12) }));
}

export function toggleModule(preferences, id) {
  if (!Object.hasOwn(MODULE_LABELS, id)) return preferences;
  return updateCurrent(preferences, face => ({
    ...face,
    modules: face.modules.includes(id) ? face.modules.filter(item => item !== id) : [...face.modules, id],
  }));
}

export function moveModule(preferences, id, delta) {
  return updateCurrent(preferences, face => {
    const from = face.modules.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= face.modules.length) return face;
    const modules = [...face.modules];
    modules.splice(to, 0, ...modules.splice(from, 1));
    return { ...face, modules };
  });
}

export function addFace(preferences) {
  if (preferences.faces.length >= MAX_FACES) return preferences;
  let n = 1;
  while (preferences.faces.some(face => face.id === `face-${n}`)) n += 1;
  return {
    faces: [...preferences.faces, { id: `face-${n}`, name: `新面${n}`, modules: [] }],
    currentIndex: preferences.faces.length,
  };
}

export function removeFace(preferences) {
  if (preferences.faces.length <= 1) return preferences;
  const faces = preferences.faces.filter((_, i) => i !== preferences.currentIndex);
  return { faces, currentIndex: Math.min(preferences.currentIndex, faces.length - 1) };
}

export function distributedGap(availableHeight, moduleHeights) {
  if (moduleHeights.length < 2) return 6;
  const spare = availableHeight - moduleHeights.reduce((sum, height) => sum + height, 0);
  return Math.max(6, Math.min(28, spare / (moduleHeights.length - 1)));
}

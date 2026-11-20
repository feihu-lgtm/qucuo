export function cloneDefaults(defaults) {
  return { faces: defaults.faces.map(face => ({ ...face, modules: [...face.modules] })), currentIndex: defaults.currentIndex ?? 0 };
}

export function validateFacePreferences(value, defaults, { availableModules, minFaces = 1, maxFaces = 6 }) {
  if (!value || !Array.isArray(value.faces) || value.faces.length < minFaces || value.faces.length > maxFaces) {
    return cloneDefaults(defaults);
  }
  const allowed = new Set(availableModules.map(module => module.id));
  const ids = new Set();
  const faces = [];
  for (const face of value.faces) {
    if (!face || typeof face.id !== "string" || !/^[\w-]{1,80}$/.test(face.id)
      || ids.has(face.id) || typeof face.name !== "string" || !face.name.trim()
      || !Array.isArray(face.modules)) return cloneDefaults(defaults);
    ids.add(face.id);
    faces.push({
      id: face.id, name: face.name.trim().slice(0, 12),
      modules: [...new Set(face.modules.filter(id => allowed.has(id)))],
    });
  }
  const currentIndex = Number.isInteger(value.currentIndex)
    ? Math.max(0, Math.min(faces.length - 1, value.currentIndex)) : 0;
  return { faces, currentIndex };
}

export function parseFacePreferences(raw, defaults, options) {
  try { return validateFacePreferences(JSON.parse(raw), defaults, options); }
  catch { return cloneDefaults(defaults); }
}

export function rotateFace(preferences, delta) {
  const count = preferences.faces.length;
  return { ...preferences, currentIndex: ((preferences.currentIndex + delta) % count + count) % count };
}

function updateCurrent(preferences, update) {
  return { ...preferences, faces: preferences.faces.map((face, i) => i === preferences.currentIndex ? update(face) : face) };
}

export function renameFace(preferences, name) {
  return updateCurrent(preferences, face => ({ ...face, name: name.slice(0, 12) }));
}

export function toggleModule(preferences, id, availableModules) {
  if (!availableModules.some(module => module.id === id)) return preferences;
  return updateCurrent(preferences, face => ({
    ...face, modules: face.modules.includes(id) ? face.modules.filter(item => item !== id) : [...face.modules, id],
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

export function addFace(preferences, maxFaces = 6) {
  if (preferences.faces.length >= maxFaces) return preferences;
  let n = 1;
  while (preferences.faces.some(face => face.id === `face-${n}`)) n += 1;
  return {
    faces: [...preferences.faces, { id: `face-${n}`, name: `新面${n}`, modules: [] }],
    currentIndex: preferences.faces.length,
  };
}

export function removeFace(preferences, minFaces = 1) {
  if (preferences.faces.length <= minFaces) return preferences;
  const faces = preferences.faces.filter((_, i) => i !== preferences.currentIndex);
  return { faces, currentIndex: Math.min(preferences.currentIndex, faces.length - 1) };
}

export function distributedGap(availableHeight, moduleHeights) {
  if (moduleHeights.length < 2) return 6;
  const spare = availableHeight - moduleHeights.reduce((sum, height) => sum + height, 0);
  return Math.max(6, Math.min(28, spare / (moduleHeights.length - 1)));
}

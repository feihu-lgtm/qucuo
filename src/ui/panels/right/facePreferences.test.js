import { describe, expect, it } from "vitest";
import {
  MAX_FACES, defaultFacePreferences, validateFacePreferences, parseFacePreferences,
  rotateFace, renameFace, toggleModule, moveModule, addFace, removeFace, distributedGap,
} from "./facePreferences.js";
import { readFacePreferences, writeFacePreferences } from "./useFacePreferences.js";
import { faceKeyDirection, faceSwipeDirection } from "./useFaceNavigation.js";

describe("right face preferences", () => {
  it("creates four independent default faces with the existing nine modules", () => {
    const first = defaultFacePreferences();
    expect(first.faces.map(face => face.name)).toEqual(["人物", "武学", "行囊", "羁绊"]);
    expect(first.faces.flatMap(face => face.modules)).toHaveLength(9);
    first.faces[0].modules.pop();
    expect(defaultFacePreferences().faces[0].modules).toHaveLength(3);
  });

  it.each([null, {}, { faces: [] }, { faces: Array(7).fill({}) },
    { faces: [null] }, { faces: [{ id: "a", name: "", modules: [] }] },
    { faces: [{ id: "a", name: "A", modules: null }] },
    { faces: [{ id: "a", name: "A", modules: [] }, { id: "a", name: "B", modules: [] }] },
  ])("falls back safely for invalid schema: %j", value => {
    expect(validateFacePreferences(value)).toEqual(defaultFacePreferences());
  });

  it("drops unknown, non-string and duplicate module ids, but permits empty and shared modules", () => {
    const value = { faces: [
      { id: "a", name: " A ", modules: ["skills", "unknown", "skills", "__proto__", null, ["profile"]] },
      { id: "b", name: "B", modules: ["skills"] },
      { id: "c", name: "C", modules: [] },
    ], currentIndex: 99 };
    expect(validateFacePreferences(value)).toEqual({ faces: [
      { id: "a", name: "A", modules: ["skills"] },
      { id: "b", name: "B", modules: ["skills"] },
      { id: "c", name: "C", modules: [] },
    ], currentIndex: 2 });
    expect(validateFacePreferences({ ...value, currentIndex: -1 }).currentIndex).toBe(0);
    expect(validateFacePreferences({ ...value, currentIndex: "1" }).currentIndex).toBe(0);
  });

  it("handles missing or malformed serialized preferences", () => {
    for (const raw of [null, "", "{", "null", "[]"]) {
      expect(parseFacePreferences(raw)).toEqual(defaultFacePreferences());
    }
    const state = rotateFace(defaultFacePreferences(), 2);
    expect(parseFacePreferences(JSON.stringify(state))).toEqual(state);
  });

  it("rotates in both directions, wrapping across bounds and a single face", () => {
    const state = defaultFacePreferences();
    expect(rotateFace(state, -1).currentIndex).toBe(3);
    expect(rotateFace(state, 5).currentIndex).toBe(1);
    expect(rotateFace({ faces: [state.faces[0]], currentIndex: 0 }, -1).currentIndex).toBe(0);
    expect(state.currentIndex).toBe(0);
  });

  it("renames, toggles and reorders only the current face without mutating input", () => {
    const state = defaultFacePreferences();
    const renamed = renameFace(state, "自定义人物");
    expect(renamed.faces[0].name).toBe("自定义人物");
    expect(state.faces[0].name).toBe("人物");
    const reordered = moveModule(renamed, "attributes", -1);
    expect(reordered.faces[0].modules).toEqual(["profile", "attributes", "equipmentBonus"]);
    expect(moveModule(state, "profile", -1)).toEqual(state);
    expect(moveModule(state, "unknown", 1)).toEqual(state);
    expect(moveModule(state, "attributes", 1)).toEqual(state);
    expect(toggleModule(state, "unknown")).toBe(state);
    const removed = toggleModule(state, "profile");
    expect(removed.faces[0].modules).not.toContain("profile");
    expect(toggleModule(removed, "profile").faces[0].modules.at(-1)).toBe("profile");
    expect(removed.faces[1]).toBe(state.faces[1]);
  });

  it("adds unique empty faces, selects them and caps at six", () => {
    let state = defaultFacePreferences();
    while (state.faces.length < MAX_FACES) state = addFace(state);
    expect(state.faces).toHaveLength(6);
    expect(state.currentIndex).toBe(5);
    expect(state.faces[5].modules).toEqual([]);
    expect(new Set(state.faces.map(face => face.id)).size).toBe(6);
    expect(addFace(state)).toBe(state);
    const replaced = addFace(removeFace(state));
    expect(new Set(replaced.faces.map(face => face.id)).size).toBe(6);
  });

  it("deletes the current face, clamps selection and never removes the last face", () => {
    let state = rotateFace(defaultFacePreferences(), -1);
    state = removeFace(state);
    expect(state.currentIndex).toBe(2);
    expect(state.faces.map(face => face.name)).toEqual(["人物", "武学", "行囊"]);
    state = removeFace(removeFace(state));
    expect(removeFace(state)).toBe(state);
    expect(state.faces).toHaveLength(1);
  });
});

describe("spacing, storage and navigation guards", () => {
  it("distributes spare height between modules, capped at 28px with a 6px overflow minimum", () => {
    expect(distributedGap(100, [30, 50])).toBe(20);
    expect(distributedGap(1000, [30, 50])).toBe(28);
    expect(distributedGap(50, [30, 50])).toBe(6);
    expect(distributedGap(100, [])).toBe(6);
    expect(distributedGap(100, [20])).toBe(6);
  });

  it("persists customized modules and the current face; unavailable storage is nonfatal", () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const state = renameFace(rotateFace(defaultFacePreferences(), 1), "常用武学");
    expect(writeFacePreferences(storage, state)).toBe(true);
    expect(readFacePreferences(storage)).toEqual(state);
    const unavailable = { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } };
    expect(readFacePreferences(unavailable)).toEqual(defaultFacePreferences());
    expect(writeFacePreferences(unavailable, state)).toBe(false);
    expect(writeFacePreferences(storage, renameFace(state, " "))).toBe(true);
    expect(readFacePreferences(storage).faces[1].name).toBe("未命名");
  });

  it("ignores typing, modified keys, composition and already-handled shortcuts", () => {
    expect(faceKeyDirection({ key: "ArrowLeft" })).toBe(-1);
    expect(faceKeyDirection({ key: "ArrowRight" })).toBe(1);
    expect(faceKeyDirection({ key: "i" })).toBe(0);
    for (const guard of ["defaultPrevented", "ctrlKey", "metaKey", "altKey", "shiftKey", "isComposing"]) {
      expect(faceKeyDirection({ key: "ArrowLeft", [guard]: true })).toBe(0);
    }
    expect(faceKeyDirection({ key: "ArrowRight", target: { closest: () => ({}) } })).toBe(0);
  });

  it("requires a deliberate horizontal swipe; vertical scrolling and short taps do not rotate", () => {
    const start = { x: 100, y: 100 };
    expect(faceSwipeDirection(start, { x: 20, y: 110 })).toBe(1);
    expect(faceSwipeDirection(start, { x: 180, y: 110 })).toBe(-1);
    expect(faceSwipeDirection(start, { x: 50, y: 100 })).toBe(0);
    expect(faceSwipeDirection(start, { x: 160, y: 200 })).toBe(0);
    expect(faceSwipeDirection(start, start)).toBe(0);
  });
});

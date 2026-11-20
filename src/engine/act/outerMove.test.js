import { describe, expect, it } from "vitest";
import { resolveOuterLock } from "./outerMove.js";

describe("resolveOuterLock no-exit metadata", () => {
  it("marks 雅江 north as a known direction without a road", () => {
    const result = resolveOuterLock({ isTalk: false, movingDir: "n", roomName: "雅江", questProgress: {}, flags: [] });
    expect(result.noExit).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.lockedDestName).toBeNull();
  });

  it("keeps noExit false for valid and non-movement paths", () => {
    expect(resolveOuterLock({ isTalk: false, movingDir: "w", roomName: "雅江", questProgress: {}, flags: [] }).noExit).toBe(false);
    expect(resolveOuterLock({ isTalk: true, movingDir: "n", roomName: "雅江", questProgress: {}, flags: [] }).noExit).toBe(false);
  });

  it("does not treat a locked destination as a missing road", () => {
    const result = resolveOuterLock({ isTalk: false, movingDir: "w", roomName: "玉泉寨", questProgress: {}, flags: [] });
    expect(result.blocked).toBe(true);
    expect(result.noExit).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { getActivePreset, loadAllPresets } from "./presetSystem.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("headless preset lookup", () => {
  it("uses the default preset when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(loadAllPresets()).toMatchObject({ activeIndex: 0, presets: [{ name: "默认预设" }] });
    expect(getActivePreset().name).toBe("默认预设");
  });
});

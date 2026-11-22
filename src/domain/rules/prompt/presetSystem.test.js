import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPreset, getActivePreset, loadAllPresets } from "./presetSystem.js";
import { LEGACY_DEFAULT_CONTENT, upgradeLegacyDefaults } from "./presetLegacy.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function legacyDefaultPreset(name = "默认预设") {
  const preset = defaultPreset();
  return {
    ...preset,
    name,
    prompts: preset.prompts.map((entry) => {
      const legacy = LEGACY_DEFAULT_CONTENT[entry.id]?.[0];
      return legacy ? { ...entry, content: legacy } : entry;
    }),
  };
}

function defaultContents() {
  return Object.fromEntries(defaultPreset().prompts.map(({ id, content }) => [id, content]));
}

describe("headless preset lookup", () => {
  it("uses the default preset when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(loadAllPresets()).toMatchObject({ activeIndex: 0, presets: [{ name: "默认预设" }] });
    expect(getActivePreset().name).toBe("默认预设");
  });
});

describe("legacy preset upgrades", () => {
  it("upgrades unchanged default entries on load and leaves imported presets alone", () => {
    const savedDefault = legacyDefaultPreset();
    const imported = legacyDefaultPreset("导入的预设");
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ presets: [savedDefault, imported], activeIndex: 0 }),
    });

    const { presets } = loadAllPresets();
    const current = defaultContents();

    expect(presets[0].prompts.find(({ id }) => id === "genrules").content).toBe(current.genrules);
    expect(presets[0].prompts.find(({ id }) => id === "wenfeng").content).toBe(current.wenfeng);
    expect(presets[1]).toEqual(imported);
  });

  it("preserves edited content and entries with other ids", () => {
    const preset = legacyDefaultPreset();
    const edited = `${LEGACY_DEFAULT_CONTENT.genrules[0]}\n玩家补充`;
    const customEntry = { id: "custom", content: LEGACY_DEFAULT_CONTENT.genrules[0] };
    preset.prompts = preset.prompts.map((entry) => entry.id === "genrules"
      ? { ...entry, content: edited }
      : entry);
    preset.prompts.push(customEntry);

    const upgraded = upgradeLegacyDefaults(preset, defaultContents());

    expect(upgraded.prompts.find(({ id }) => id === "genrules").content).toBe(edited);
    expect(upgraded.prompts.find(({ id }) => id === "wenfeng").content).toBe(defaultContents().wenfeng);
    expect(upgraded.prompts.find(({ id }) => id === "custom")).toBe(customEntry);
  });

  it("returns the same preset object when there is nothing to upgrade", () => {
    const preset = defaultPreset();

    expect(upgradeLegacyDefaults(preset, defaultContents())).toBe(preset);
  });
  it("leaves entries with inherited identifiers untouched", () => {
    const preset = { name: "默认预设", prompts: [{ id: "constructor", content: "x" }, { id: "toString", content: "y" }] };
    expect(upgradeLegacyDefaults(preset, { genrules: "new" })).toBe(preset);
  });
});

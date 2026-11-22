import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BODY_FIELDS, INTIMATE_FIELDS, PUBLIC_FIELDS, emptyBodyProfile } from "./bodyProfile.js";
import {
  ALL_BODY_PRESETS,
  BODY_PRESETS,
  BODY_TAG_POOL,
  PLAYER_PORTRAIT_PRESETS,
  appendBodyTag,
  applyBodyPreset,
  defaultPortraitIdForGender,
  getPortraitPreset,
  portraitPresetUrl,
} from "./bodyPresets.js";

describe("bodyPresets & opening portrait profiles", () => {
  it("pairs all 8 player portraits on disk with full 12-field adult profiles plus 6 extra library presets", () => {
    expect(PLAYER_PORTRAIT_PRESETS).toHaveLength(8);
    expect(BODY_PRESETS).toHaveLength(6);
    expect(ALL_BODY_PRESETS).toHaveLength(14);
    for (const preset of PLAYER_PORTRAIT_PRESETS) {
      expect(existsSync(resolve("public/portraits/player", preset.file)), preset.file).toBe(true);
      expect(portraitPresetUrl(preset, "/qucuo/")).toBe(`/qucuo/portraits/player/${preset.file}`);
    }
    expect(defaultPortraitIdForGender("男")).toBe("male");
    expect(defaultPortraitIdForGender("女")).toBe("female");
    expect(defaultPortraitIdForGender("其他")).toBe("other");
    expect(getPortraitPreset("preset3").name).toBe("灵猫行客");

    for (const preset of ALL_BODY_PRESETS) {
      for (const field of BODY_FIELDS) {
        expect(preset.profile[field.key], `${preset.id}.${field.key}`).toBeTruthy();
      }
    }
    for (const field of BODY_FIELDS) {
      expect((BODY_TAG_POOL[field.key] || []).length, field.key).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps intimate fields untouched unless includeIntimate is true", () => {
    const start = { ...emptyBodyProfile(), scent: "自定义旧香" };
    const pubOnly = applyBodyPreset(start, BODY_PRESETS[0], { includeIntimate: false });
    for (const field of PUBLIC_FIELDS) {
      expect(pubOnly[field.key]).toBe(BODY_PRESETS[0].profile[field.key]);
    }
    expect(pubOnly.scent).toBe("自定义旧香");
    expect(pubOnly.sensitive).toBe("");

    const full = applyBodyPreset(start, BODY_PRESETS[0], { includeIntimate: true });
    for (const field of INTIMATE_FIELDS) {
      expect(full[field.key]).toBe(BODY_PRESETS[0].profile[field.key]);
    }
  });

  it("appends quick tags cleanly without duplicating existing phrases", () => {
    expect(appendBodyTag("", "一米七二长腿高挑")).toBe("一米七二长腿高挑");
    expect(appendBodyTag("一米七二长腿高挑", "一米七二长腿高挑")).toBe("一米七二长腿高挑");
    expect(appendBodyTag("一米七二", "腿长腰直")).toBe("一米七二，腿长腰直");
    expect(appendBodyTag("一米七二，", "腿长腰直")).toBe("一米七二，腿长腰直");
  });
});

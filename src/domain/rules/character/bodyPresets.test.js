import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BODY_FIELDS, INTIMATE_FIELDS, PUBLIC_FIELDS, emptyBodyProfile } from "./bodyProfile.js";
import {
  ALL_BODY_PRESETS,
  BODY_PRESETS,
  BODY_TAG_POOL,
  COMPANION_BODY_PROFILES,
  PLAYER_PORTRAIT_PRESETS,
  appendBodyTag,
  applyBodyPreset,
  defaultPortraitIdForGender,
  formatCompanionBodyBlock,
  getPortraitPreset,
  portraitPresetUrl,
} from "./bodyPresets.js";
import { COMPANION_LORE } from "../companion/companion.js";
import { buildNpcContext } from "../../../engine/prompt/roundNotes.js";

describe("bodyPresets & companion humanized body profiles", () => {
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
    for (const key of ["pearl", "snowLeopard"]) {
      for (const field of BODY_FIELDS) {
        expect(COMPANION_BODY_PROFILES[key][field.key], `${key}.${field.key}`).toBeTruthy();
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

  it("gates companion humanized intimate details strictly on nsfw and keeps PR #238 adult contracts", () => {
    for (const key of ["pearl", "snowLeopard"]) {
      expect(COMPANION_LORE[key].human).toContain("年满十八岁以上的成年女子");
      expect(COMPANION_LORE[key].human).toContain("能开口说人话");
      expect(COMPANION_LORE[key].nsfw).toContain("年满十八岁以上的成年女子");

      const pubBlock = formatCompanionBodyBlock(key, { nsfw: false });
      expect(pubBlock).toContain("身量");
      expect(pubBlock).toContain("惯常穿着");
      expect(pubBlock).not.toContain("敏感处");
      expect(pubBlock).not.toContain("习惯癖好");

      const nsfwBlock = formatCompanionBodyBlock(key, { nsfw: true });
      expect(nsfwBlock).toContain("敏感处");
      expect(nsfwBlock).toContain("习惯癖好");
    }

    const baseArgs = {
      room: { name: "鱼定村", npcs: [], items: [], exits: [] },
      cmd: "",
      visibleNpcs: [],
      preset: { npcLore: [] },
      convo: [],
      varTree: { 世界: {} },
      questProgress: {},
      time: 10,
      companionState: { pearl: { unlocked: true, active: true, data: { name: "珍珠" } } },
    };

    const humanSfw = buildNpcContext({ ...baseArgs, nsfwOn: false, companionForms: { pearl: "human" } });
    expect(humanSfw.npcLoreBlockWithQuest).toContain("化形体貌明细");
    expect(humanSfw.npcLoreBlockWithQuest).toContain("一米六八");
    expect(humanSfw.npcLoreBlockWithQuest).not.toContain("■模式·珍珠化形私密性情");
    expect(humanSfw.npcLoreBlockWithQuest).not.toContain("敏感处");

    const humanNsfw = buildNpcContext({ ...baseArgs, nsfwOn: true, companionForms: { pearl: "human" } });
    expect(humanNsfw.npcLoreBlockWithQuest).toContain("■模式·珍珠化形私密性情");
    expect(humanNsfw.npcLoreBlockWithQuest).toContain("敏感处");

    const beastNsfw = buildNpcContext({ ...baseArgs, nsfwOn: true, companionForms: { pearl: "beast" } });
    expect(beastNsfw.npcLoreBlockWithQuest).not.toContain("化形体貌明细");
    expect(beastNsfw.npcLoreBlockWithQuest).not.toContain("■模式·珍珠化形私密性情");
  });
});

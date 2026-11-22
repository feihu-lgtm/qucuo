import { describe, expect, it } from "vitest";
import { allContent, contentEntries, defineContent, getContent, loadContent } from "./registry.js";
import { loadDefaultContent } from "./loadDefaultContent.js";

describe("content registry", () => {
  it("defines and retrieves the original definition, including functions", () => {
    const def = { name: "test", run: () => "ok" };
    expect(defineContent("registry-test", "first", def)).toBe(def);
    expect(getContent("registry-test", "first")).toBe(def);
    expect(getContent("registry-test", "first").run()).toBe("ok");
  });

  it("loads multiple kinds and overrides without changing insertion order", () => {
    const first = { value: 1 }, second = { value: 2 }, override = { value: 3 };
    loadContent({ "override-test": { first, second }, "other-test": { first } });
    loadContent({ "override-test": { first: override } });
    expect(allContent("override-test")).toEqual([override, second]);
    expect(contentEntries("override-test")).toEqual([["first", override], ["second", second]]);
    expect(getContent("other-test", "first")).toBe(first);
  });

  it("handles empty packs and unknown kinds and returns detached lists", () => {
    loadContent({});
    expect(getContent("absent", "id")).toBeUndefined();
    expect(allContent("absent")).toEqual([]);
    expect(contentEntries("absent")).toEqual([]);
    defineContent("list-test", "id", {});
    allContent("list-test").pop();
    expect(allContent("list-test")).toHaveLength(1);
  });

  it.each([
    ["quest", "giver"], ["item", "category"], ["district", "rooms"],
    ["teachableSkill", "questId"],
  ])("validates required %s fields with an actionable message", (kind, field) => {
    const valid = {
      quest: { id: "id", type: "talk", title: "title", giver: null, description: "desc" },
      item: { name: "item", category: "misc", quality: "白" },
      district: { anchor: "entry", rooms: {} },
      teachableSkill: { questId: "quest", moveQuality: "绿", moveType: "攻击" },
    }[kind];
    defineContent(kind, "validation-test", valid);
    const invalid = { ...valid };
    delete invalid[field];
    expect(() => defineContent(kind, "validation-test", invalid))
      .toThrow(`Content ${kind}/validation-test: missing required field "${field}"`);
    expect(getContent(kind, "validation-test")).toBe(valid);
    invalid[field] = undefined;
    expect(() => loadContent({ [kind]: { broken: invalid } })).toThrow(field);
  });

  it("validates resident groups and malformed definitions", () => {
    expect(() => defineContent("residentGroup", "bad", {})).toThrow("expected an NPC array");
    expect(() => defineContent("residentGroup", "bad", [{ name: "npc" }])).toThrow('bad[0]: missing required field "id"');
    expect(() => defineContent("item", "bad", null)).toThrow("definition must be an object");
    expect(() => defineContent("", "id", {})).toThrow("non-empty strings");
    expect(() => defineContent("item", "", {})).toThrow("non-empty strings");
    defineContent("residentGroup", "empty", []);
    expect(getContent("residentGroup", "empty")).toEqual([]);
  });

  it("loads defaults only once and does not overwrite subsequent overrides", () => {
    const before = allContent("quest");
    const quest = getContent("quest", "hunter_learn_quest");
    const override = { ...quest, title: "override" };
    defineContent("quest", quest.id, override);
    loadDefaultContent();
    loadDefaultContent();
    expect(getContent("quest", quest.id)).toBe(override);
    expect(allContent("quest")).toHaveLength(before.length);
    defineContent("quest", quest.id, quest);
  });
});

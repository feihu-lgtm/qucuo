import { describe, expect, it } from "vitest";
import { all, define, entries, get, load } from "./registry.js";
import { loadDefaultContent } from "../../content/index.js";

describe("content registry", () => {
  it("defines and retrieves the original definition, including functions", () => {
    const def = { name: "test", run: () => "ok" };
    expect(define("registry-test", "first", def)).toBe(def);
    expect(get("registry-test", "first")).toBe(def);
    expect(get("registry-test", "first").run()).toBe("ok");
  });

  it("loads multiple kinds and overrides without changing insertion order", () => {
    const first = { value: 1 }, second = { value: 2 }, override = { value: 3 };
    load({ "override-test": { first, second }, "other-test": { first } });
    load({ "override-test": { first: override } });
    expect(all("override-test")).toEqual([override, second]);
    expect(entries("override-test")).toEqual([["first", override], ["second", second]]);
    expect(get("other-test", "first")).toBe(first);
  });

  it("handles empty packs and unknown kinds and returns detached lists", () => {
    load({});
    expect(get("absent", "id")).toBeUndefined();
    expect(all("absent")).toEqual([]);
    expect(entries("absent")).toEqual([]);
    define("list-test", "id", {});
    all("list-test").pop();
    expect(all("list-test")).toHaveLength(1);
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
    define(kind, "validation-test", valid);
    const invalid = { ...valid };
    delete invalid[field];
    expect(() => define(kind, "validation-test", invalid))
      .toThrow(`Content ${kind}/validation-test: missing required field "${field}"`);
    expect(get(kind, "validation-test")).toBe(valid);
    invalid[field] = undefined;
    expect(() => load({ [kind]: { broken: invalid } })).toThrow(field);
  });

  it("validates resident groups and malformed definitions", () => {
    expect(() => define("residentGroup", "bad", {})).toThrow("expected an NPC array");
    expect(() => define("residentGroup", "bad", [{ name: "npc" }])).toThrow('bad[0]: missing required field "id"');
    expect(() => define("item", "bad", null)).toThrow("definition must be an object");
    expect(() => define("", "id", {})).toThrow("non-empty strings");
    expect(() => define("item", "", {})).toThrow("non-empty strings");
    define("residentGroup", "empty", []);
    expect(get("residentGroup", "empty")).toEqual([]);
  });

  it("loads defaults only once and does not overwrite subsequent overrides", () => {
    const before = all("quest");
    const quest = get("quest", "hunter_learn_quest");
    const override = { ...quest, title: "override" };
    define("quest", quest.id, override);
    loadDefaultContent();
    loadDefaultContent();
    expect(get("quest", quest.id)).toBe(override);
    expect(all("quest")).toHaveLength(before.length);
    define("quest", quest.id, quest);
  });
});

import { describe, expect, it } from "vitest";
import { insertBackfill, tagBackfill } from "./backfill.js";

const facts = (key) => tagBackfill([
  { t: "sys", text: "  第一行" },
  { t: "sys", text: "  结局", fillSlot: "end" },
], key);

describe("tagBackfill", () => {
  it("tags each entry with the key and its slot", () => {
    expect(facts("k")).toEqual([
      { t: "sys", text: "  第一行", fillKey: "k", fillSlot: 0 },
      { t: "sys", text: "  结局", fillKey: "k", fillSlot: "end" },
    ]);
  });
});

describe("insertBackfill", () => {
  const log = [{ t: "cmd", text: "> 做事" }, ...facts("k"), { t: "cmd", text: "> 下一件" }];
  const texts = (entries) => entries.map((entry) => entry.text.trim());

  it("puts each line right under its fact row, even after later entries", () => {
    const next = insertBackfill(log, "k", { 0: "描写一。", end: "收尾。" });
    expect(texts(next)).toEqual(["> 做事", "第一行", "描写一。", "结局", "收尾。", "> 下一件"]);
    expect(next[2]).toMatchObject({ t: "desc", fillKey: "k", fillProse: true });
  });

  it("accepts an array and skips blank slots", () => {
    expect(texts(insertBackfill(log, "k", ["  ", "x"]))).toEqual(["> 做事", "第一行", "结局", "> 下一件"]);
    expect(texts(insertBackfill(log, "k", ["描写一。"]))).toEqual(["> 做事", "第一行", "描写一。", "结局", "> 下一件"]);
  });

  it("returns the same log when the batch was rolled back", () => {
    expect(insertBackfill(log, "gone", { 0: "x" })).toBe(log);
    expect(insertBackfill(log, "k", null)).toBe(log);
  });

  it("does not insert twice", () => {
    const once = insertBackfill(log, "k", { 0: "描写一。" });
    expect(insertBackfill(once, "k", { 0: "又一遍。" })).toBe(once);
  });
});

import { describe, it, expect } from "vitest";
import { recruitedNemesisNames } from "./rules.js";

describe("WO-23C4 recruitedNemesisNames（注入过滤/防隔天刷回）", () => {
  const vt = {
    世界: {
      宿敌谱: {
        黑风寨: { entries: { a: { id: "a", name: "麻三", status: "recruited" }, b: { id: "b", name: "仍在册", status: "active" } } },
        雪山派: { entries: { c: { id: "c", name: "已了结者", status: "settled" } } },
      },
    },
  };
  it("只收 recruited 名——active/settled 不除名", () => {
    const names = recruitedNemesisNames(vt);
    expect(names.has("麻三")).toBe(true);
    expect(names.has("仍在册")).toBe(false);
    expect(names.has("已了结者")).toBe(false);
  });
  it("坏账不炸", () => {
    expect(recruitedNemesisNames(null).size).toBe(0);
    expect(recruitedNemesisNames({}).size).toBe(0);
    expect(recruitedNemesisNames({ 世界: { 宿敌谱: { x: null } } }).size).toBe(0);
  });
});

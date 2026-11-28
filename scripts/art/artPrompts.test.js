import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BATCHES, KINDS, STYLE_ANCHOR, renderPrompt } from "./artPrompts.mjs";
import { DOC_PATH, buildDoc } from "./buildArtPrompts.mjs";
import { BUILDING_TYPE } from "../../src/domain/data/buildings/qucuoBuildings.js";
import { HOMESTEAD_FEATURES } from "../../src/domain/rules/map/homestead.js";
import { getBuildingsForLocation } from "../../src/domain/data/buildings/qucuoBuildings.js";
import { QUCUO_MAP } from "../../src/domain/data/map/qucuoMap.js";

// 个别建筑专图按建筑 id 出图（BUILDING_ID_ART），与类型图分开核对。
const BUILDING_IDS = new Set(Object.keys(QUCUO_MAP).flatMap((loc) => getBuildingsForLocation(loc).map((b) => b.id)));

const CJK = /[\u3400-\u9fff]/;

describe("art prompt templates", () => {
  it("每个批次的格数等于该类素材的网格数", () => {
    for (const batch of BATCHES) {
      const [cols, rows] = KINDS[batch.kind].grid;
      expect(batch.cells.length, batch.id).toBe(cols * rows);
    }
  });

  it("批次编号不重复，切出来的文件名不重复", () => {
    const ids = BATCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = BATCHES.flatMap((b) => b.cells.flatMap((cell) => cell.keys.map((key) => `${b.kind}/${key}`)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("交给 GPT 的提示词里没有汉字，免得被画进图里", () => {
    for (const batch of BATCHES) {
      const prompt = renderPrompt(batch, { withReference: true });
      expect(CJK.test(prompt), batch.id).toBe(false);
    }
  });

  it("每条提示词都以完整的画风锚开头，并带版式与禁项", () => {
    for (const batch of BATCHES) {
      const prompt = renderPrompt(batch);
      expect(prompt.startsWith(STYLE_ANCHOR), batch.id).toBe(true);
      expect(prompt).toContain("[FORMAT]");
      expect(prompt).toContain("[SUBJECTS]");
      expect(prompt).toContain("[AVOID]");
    }
  });

  it("建筑图键名与游戏里的建筑类型、家园设施 id 一一对上，不多不少", () => {
    const keys = BATCHES.filter((b) => b.kind === "building").flatMap((b) => b.cells.flatMap((cell) => cell.keys));
    const homeIds = new Set(Object.values(HOMESTEAD_FEATURES).flatMap((home) => home.features.map((f) => f.id)));
    const expected = [...new Set(Object.values(BUILDING_TYPE)), ...[...homeIds].map((id) => `home-${id}`)].sort();
    const typeAndHomeKeys = keys.filter((key) => !BUILDING_IDS.has(key));
    expect([...typeAndHomeKeys].sort()).toEqual(expected);
  });

  it("建筑专图键名都是游戏里真实存在的建筑 id", () => {
    const keys = BATCHES.filter((b) => b.kind === "building").flatMap((b) => b.cells.flatMap((cell) => cell.keys));
    const typeOrHome = new Set([...Object.values(BUILDING_TYPE)]);
    const dedicated = keys.filter((key) => !typeOrHome.has(key) && !key.startsWith("home-"));
    for (const key of dedicated) expect(BUILDING_IDS.has(key), key).toBe(true);
  });

  it("仓库里的提示词全集与数据源一致（改了数据要重新生成）", () => {
    expect(readFileSync(DOC_PATH, "utf8")).toBe(buildDoc());
  });
});

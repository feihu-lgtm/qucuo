import { describe, expect, it } from "vitest";
import { factionOfDistrict, factionRepLabel, factionShopCoef, listFactionRep } from "./factionRep.js";
import { resolveStageRewards, stageRewardPatches } from "../quests/questRewards.js";
import { applyPatches } from "../state/applyPatches.js";
import { applyMvuCommands } from "../prompt/mvu.js";

const tree = (rep) => ({ 世界: { 威望: 0, 势力声誉: rep } });

describe("faction reputation", () => {
  it("maps districts to factions and discounts by tier", () => {
    expect(factionOfDistrict("白塔")).toBe("喇嘛庙");
    expect(factionOfDistrict("天都镇")).toBe(null);
    expect(factionShopCoef(tree({ 黑风寨: 14 }), "黑风寨")).toBe(1);
    expect(factionShopCoef(tree({ 黑风寨: 15 }), "黑风寨")).toBe(0.92);
    expect(factionShopCoef(tree({ 黑风寨: 40 }), "黑风寨")).toBe(0.85);
    expect(factionShopCoef(tree({ 黑风寨: 80 }), "黑风寨")).toBe(0.75);
    expect(factionShopCoef(tree({ 黑风寨: 80 }), "鱼定村")).toBe(1);
    expect(factionRepLabel(-60)).toBe("死敌");
    expect(factionRepLabel(-20)).toBe("交恶");
  });

  it("lists only factions the player has dealt with", () => {
    expect(listFactionRep(tree({ 鱼定村: 10, 黑风寨: 0 }))).toEqual([{ name: "鱼定村", value: 10, label: "平常" }]);
  });

  it("quest rewards write and clamp 世界.势力声誉", () => {
    const rewards = resolveStageRewards({ onReach: { factionRep: { 黑风寨: 10, 鱼定土司府: -5 }, byFlag: { f: { factionRep: { 黑风寨: 5 } } } } }, ["f"]);
    expect(rewards.factionRep).toEqual({ 黑风寨: 15, 鱼定土司府: -5 });
    const { state } = applyPatches({ varTree: tree({ 黑风寨: 95 }) }, stageRewardPatches(rewards));
    expect(state.varTree.世界.势力声誉).toEqual({ 黑风寨: 100, 鱼定土司府: -5 });
  });

  it("limits a single AI write to ±10", () => {
    const { tree: next } = applyMvuCommands(tree({}), [{ op: "add", path: "世界.势力声誉.玉泉寨", value: 30 }]);
    expect(next.世界.势力声誉.玉泉寨).toBe(10);
  });

  it("keeps AI set within ±10 and refuses overwriting the whole table", () => {
    const { tree: next } = applyMvuCommands(tree({ 玉泉寨: 5, 黑风寨: 20 }), [
      { op: "set", path: "世界.势力声誉.玉泉寨", value: 90 },
      { op: "set", path: "世界.势力声誉", value: 0 },
    ]);
    expect(next.世界.势力声誉).toEqual({ 玉泉寨: 15, 黑风寨: 20 });
  });
});

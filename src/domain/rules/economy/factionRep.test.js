import { describe, expect, it } from "vitest";
import { factionOfDistrict, factionRepDeltas, grantFactionRep, factionRepLabel, factionShopCoef, listFactionRep } from "./factionRep.js";
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

  it("caps the whole AI turn at ±10 per faction and keeps nested writes off the table", () => {
    const { tree: next, rejected } = applyMvuCommands(tree({ 玉泉寨: 10, 黑风寨: 20 }), [
      { op: "add", path: "世界.势力声誉.玉泉寨", value: 10 },
      { op: "add", path: "世界.势力声誉.玉泉寨", value: 10 },
      { op: "set", path: "世界.势力声誉.玉泉寨", value: 60 },
      { op: "set", path: "世界.势力声誉.黑风寨.备注", value: "x" },
    ]);
    expect(next.世界.势力声誉).toEqual({ 玉泉寨: 20, 黑风寨: 20 });
    expect(rejected.map((entry) => entry.path)).toEqual(["世界.势力声誉.黑风寨.备注"]);
  });
});

describe("faction reputation ripple", () => {
  it("costs each foe half of a gain, rounded up", () => {
    expect(factionRepDeltas({ 青城派: 5 })).toEqual({ 青城派: 5, 天龙教: -3, 唐门: -3 });
    expect(factionRepDeltas({ 天龙教: 2 })).toEqual({ 天龙教: 2, 青城派: -1, 峨眉派: -1, 丐帮三星分舵: -1 });
  });

  it("does not ripple losses or factions without foes", () => {
    expect(factionRepDeltas({ 青城派: -4 })).toEqual({ 青城派: -4 });
    expect(factionRepDeltas({ 鱼定村: 10 })).toEqual({ 鱼定村: 10 });
  });

  it("keeps an explicitly written foe delta instead of stacking the ripple", () => {
    expect(factionRepDeltas({ 黑风寨: 10, 鱼定土司府: -5 })).toEqual({ 黑风寨: 10, 鱼定土司府: -5 });
  });

  it("charges foes only for the gain that actually lands under the cap", () => {
    expect(factionRepDeltas({ 青城派: 5 }, tree({ 青城派: 98 }))).toEqual({ 青城派: 5, 天龙教: -1, 唐门: -1 });
    expect(factionRepDeltas({ 青城派: 5 }, tree({ 青城派: 100 }))).toEqual({ 青城派: 5 });
    const rewards = resolveStageRewards({ onReach: { factionRep: { 唐门: 6 } } });
    const { state } = applyPatches({ varTree: tree({ 唐门: 100, 青城派: 0 }) }, stageRewardPatches(rewards));
    expect(state.varTree.世界.势力声誉).toMatchObject({ 唐门: 100, 青城派: 0 });
  });

  it("applies the ripple through quest reward patches", () => {
    const rewards = resolveStageRewards({ onReach: { factionRep: { 唐门: 6 } } });
    const { state } = applyPatches({ varTree: tree({}) }, stageRewardPatches(rewards));
    expect(state.varTree.世界.势力声誉).toMatchObject({ 唐门: 6, 青城派: -3 });
  });

  it("quest rewards land their full value, foes lose half the landed gain", () => {
    const rewards = resolveStageRewards({ onReach: { factionRep: { 峨眉派: 25, 天龙教: -13 } } });
    const { state } = applyPatches({ varTree: tree({ 峨眉派: 90 }) }, stageRewardPatches(rewards));
    expect(state.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 100, 天龙教: -13, 五仙教: -5 });
  });
});

describe("system-granted reputation", () => {
  const tree = (reps) => ({ 世界: { 势力声誉: reps } });

  it("factionRepDeltas caps the gain at 10 by default, uncapped with step: Infinity", () => {
    expect(factionRepDeltas({ 峨眉派: 20 }, tree({}))).toMatchObject({ 峨眉派: 20, 天龙教: -5, 五仙教: -5 });
    expect(factionRepDeltas({ 峨眉派: 20 }, tree({}), { step: Infinity })).toMatchObject({ 峨眉派: 20, 天龙教: -10, 五仙教: -10 });
    expect(factionRepDeltas({ 峨眉派: 20 }, tree({ 峨眉派: 90 }), { step: Infinity })).toMatchObject({ 天龙教: -5, 五仙教: -5 });
  });

  it("grantFactionRep lands the full +20 and charges foes half the landed gain", () => {
    const { applied, varTree } = grantFactionRep(tree({ 峨眉派: 40 }), { 峨眉派: 20 });
    expect(varTree.世界.势力声誉).toMatchObject({ 峨眉派: 60, 天龙教: -10, 五仙教: -10 });
    expect(applied).toEqual({ 峨眉派: 20, 天龙教: -10, 五仙教: -10 });
    expect(grantFactionRep(tree({ 峨眉派: 100 }), { 峨眉派: 20 }).applied).toEqual({});
  });
});

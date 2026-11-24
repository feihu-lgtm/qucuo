import { describe, expect, it } from "vitest";
import { buildNpcContext } from "./npcContext.js";

describe("buildNpcContext", () => {
  it("assembles unified persona, gear, exposure, carryNames, tradeCounts, favorability, and location", () => {
    const npc = {
      id: "caidan",
      name: "才旦",
      brief: "年轻猎户",
      appearance: "玄衣束袖",
      personality: "爽朗直率",
      combatStats: { hp: [35, 60] },
      carriedItems: [
        { id: "c1", name: "鱼定猎刀", category: "weapon" },
        { id: "c2", name: "羊皮甲", category: "armor", sold: true },
        { id: "c3", name: "青稞饼", category: "misc" },
      ],
    };
    const state = {
      varTree: { 角色: { 才旦: { 好感度: 52, 所在地: "鱼定村" } } },
      npcState: {
        caidan: {
          trade: {
            sold: { c2: { name: "羊皮甲", category: "armor", slot: "equipment" } },
            bought: [{ id: "b1", name: "草药", category: "misc" }],
          },
        },
      },
    };

    const ctx = buildNpcContext(npc, state, {
      history: ["替他寻回猎刀"],
      convoLines: ["问及雪山近况"],
      letters: ["他的回信：多保重"],
    });

    expect(ctx.name).toBe("才旦");
    expect(ctx.persona).toBe("玄衣束袖");
    expect(ctx.bio).toBe("，年轻猎户性情：爽朗直率。");
    expect(ctx.favorability).toBe(52);
    expect(ctx.location).toBe("鱼定村");
    expect(ctx.gear).toEqual(["鱼定猎刀"]);
    expect(ctx.exposure).toBeNull();
    expect(ctx.carryNames).toEqual(["鱼定猎刀", "青稞饼", "草药"]);
    expect(ctx.tradeCounts).toEqual({ bought: 1, sold: 1 });
    expect(ctx.hp).toEqual([35, 60]);
    expect(ctx.history).toEqual(["替他寻回猎刀"]);
  });

  it("detects attireExposure from trade ledger and supports OC pool lookup when requested", () => {
    const strippedNpc = {
      id: "n1",
      name: "元朵朵",
      carriedItems: [{ id: "n1_0", name: "软甲", category: "armor", sold: true }],
    };
    const ctx = buildNpcContext(strippedNpc, {}, { includeOcPool: true });
    expect(ctx.name).toBe("元朵朵");
    expect(ctx.exposure).toBe("衣不蔽体");
    expect(ctx.chatterPersona.length).toBeGreaterThan(2);
    expect(ctx.chatterPersona).toContain("，");
  });
});

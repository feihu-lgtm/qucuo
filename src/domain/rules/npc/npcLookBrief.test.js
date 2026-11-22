import { describe, expect, it } from "vitest";
import { buildNpcLookPrompt, npcGear, npcLookCard } from "./npcLookBrief.js";

const npc = {
  name: "才旦", brief: "村长之女", personality: "工于心计",
  combatStats: { hp: [30, 60] },
  carriedItems: [
    { name: "鱼定猎刀", category: "weapon" },
    { name: "青稞饼", category: "misc" },
    { name: "护佑结", category: "accessory", stolen: true },
    { name: "熊皮坎肩", category: "armor", dropped: true },
  ],
};

describe("npcLookCard", () => {
  it("只列来历和没被偷走、没在切磋中掉落的装束，不列杂物", () => {
    expect(npcGear(npc)).toEqual(["鱼定猎刀"]);
    expect(npcLookCard(npc).map(r => r.text)).toEqual(["  才旦：村长之女", "  装束：鱼定猎刀"]);
  });
  it("没装束时只出名字行", () => {
    expect(npcLookCard({ name: "路人" }).map(r => r.text)).toEqual(["  路人"]);
  });
});

describe("buildNpcLookPrompt", () => {
  it("带上人设、装束和受伤气血", () => {
    const { sys, user } = buildNpcLookPrompt(npc, { place: "鱼定村" });
    expect(sys).toContain("不添新物品");
    expect(user).toContain("人设：工于心计");
    expect(user).toContain("装束：鱼定猎刀");
    expect(user).toContain("气血：30/60");
  });
});

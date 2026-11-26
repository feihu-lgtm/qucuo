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
    expect(npcLookCard(npc).map(r => r.text)).toEqual(["  才旦 村长之女", "  装束 鱼定猎刀"]);
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

  it("appearance 优先于 fullBio/personality 进人设段", () => {
    const n = { name: "元朵朵", appearance: "金红马面裙双环髻", fullBio: "首富之女", personality: "娇憨" };
    const { user } = buildNpcLookPrompt(n);
    expect(user).toContain("人设：金红马面裙双环髻");
    expect(user).not.toContain("首富之女");
  });

  it("三层上下文齐全时带分层标题进 user", () => {
    const { user } = buildNpcLookPrompt(npc, {
      history: ["上月你在村口替他挡了一刀", "他欠你一顿青稞酒"],
      convoLines: ["问才旦山上的雪狼", "才旦让你别去"],
      letters: ["你去信：问他要羊皮袄", "他的回信：天暖了再说"],
    });
    expect(user).toContain("你和他的过往：\n· 上月你在村口替他挡了一刀\n· 他欠你一顿青稞酒");
    expect(user).toContain("最近的交谈：\n· 问才旦山上的雪狼");
    expect(user).toContain("书信往来：\n· 你去信：问他要羊皮袄\n· 他的回信：天暖了再说");
  });

  it("三无（无过往/无交谈/无书信）时一个标题都不写", () => {
    const { user } = buildNpcLookPrompt(npc);
    expect(user).not.toContain("你和他的过往");
    expect(user).not.toContain("最近的交谈");
    expect(user).not.toContain("书信往来");
  });
});

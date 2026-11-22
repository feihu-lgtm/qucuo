import { describe, expect, it } from "vitest";
import { buildSettleNarrationPrompt, canBackfillSettle, parseSettleNarration, settleFactText } from "./settleBrief.js";

describe("settleBrief", () => {
  it("只有不走软结算、没关结算的才后台补写", () => {
    expect(canBackfillSettle({})).toBe(true);
    expect(canBackfillSettle({ settleNpc: "温掌柜" })).toBe(true);
    expect(canBackfillSettle({ settleKind: "gift", settleNpc: "师父" })).toBe(false);
    expect(canBackfillSettle({ settleKind: "learn_skill" })).toBe(false);
    expect(canBackfillSettle({ settle: false })).toBe(false);
  });

  it("事实行只取首句，去掉尾部叙事指令", () => {
    expect(settleFactText("到金玉行，把玉料交给玉匠。请让玉匠说道一两句。")).toBe("到金玉行，把玉料交给玉匠");
    expect(settleFactText("在钱庄取出银两30两（含利息）")).toBe("在钱庄取出银两30两（含利息）");
  });

  it("提示词带上地点、人物和整段结算文本", () => {
    const { sys, user } = buildSettleNarrationPrompt("从当铺赎回「玉佩」，花费20两", { place: "当铺", npc: "朝奉" });
    expect(sys).toContain("不改判");
    expect(user).toBe("地点：当铺\n相关人物：朝奉\n事实：从当铺赎回「玉佩」，花费20两");
  });

  it("解析成单槽描写，空文本不补", () => {
    expect(parseSettleNarration("```\n掌柜拱手。\n收了银子。\n```")).toEqual(["掌柜拱手。收了银子。"]);
    expect(parseSettleNarration("  ")).toBeNull();
    expect(parseSettleNarration(null)).toBeNull();
  });
});

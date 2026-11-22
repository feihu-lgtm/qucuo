import { describe, expect, it } from "vitest";
import { buildDuelNarrationPrompt, duelFactLine, duelFactLogs, insertDuelNarration, parseDuelNarration } from "./duelBrief.js";

const round = {
  round: 1,
  playerMove: { name: "野球拳", type: "攻击" },
  npcMove: { name: "回气", type: "状态" },
  result: { nameA: "陈尧天", nameB: "老孙", damageToB: 92, damageToA: 0 },
};

describe("duelFactLine", () => {
  it("states only moves and numbers", () => {
    expect(duelFactLine(round)).toBe("第1回合 野球拳对回气，老孙−92");
  });

  it("says no damage plainly", () => {
    expect(duelFactLine({ ...round, result: { nameA: "甲", nameB: "乙" } })).toBe("第1回合 野球拳对回气，未分高下");
  });

  it("keeps team rounds short", () => {
    expect(duelFactLine({ round: 2, teamLines: [{ result: { worseName: "老孙" } }] })).toBe("第2回合 团战交锋，老孙吃亏");
  });
});

describe("duel narration", () => {
  it("prompt carries the facts and asks for JSON", () => {
    const { sys, user } = buildDuelNarrationPrompt([round], { outcomeText: "你胜", place: "鱼定村" });
    expect(user).toContain("野球拳对回气，老孙−92");
    expect(sys).toContain('"ending"');
  });

  it("parses fenced JSON and trims to the round count", () => {
    const parsed = parseDuelNarration('```json\n{"rounds":["一","二","三"],"ending":"完"}\n```', 2);
    expect(parsed).toEqual({ rounds: ["一", "二"], ending: "完" });
    expect(parseDuelNarration("不是 JSON", 1)).toBeNull();
  });

  it("inserts prose right under its system row and skips a rolled-back duel", () => {
    const log = [{ t: "cmd", text: "> 切磋" }, ...duelFactLogs([round], "k1", "你胜"), { t: "cmd", text: "> 下一场" }];
    const next = insertDuelNarration(log, "k1", { rounds: ["拳到。"], ending: "老孙认输。" });
    expect(next.map((entry) => entry.text.trim())).toEqual(["> 切磋", "第1回合 野球拳对回气，老孙−92", "拳到。", "结局 你胜", "老孙认输。", "> 下一场"]);
    expect(insertDuelNarration(log, "gone", { rounds: ["x"], ending: "y" })).toBe(log);
  });
});

import { describe, expect, it } from "vitest";
import { acceptBounty, acceptEscort, claimBounty } from "./logic.js";

const state = (overrides = {}) => ({
  room: { name: "鱼定村" },
  flags: [],
  questProgress: {},
  char: { money: 0 },
  dao: { karma: 0 },
  pot: 0,
  ...overrides,
});

describe("building quest logic", () => {
  it("accepts an escort only at its origin and refuses duplicates", () => {
    const quest = { id: "eq_zhangshang_yuquan" };
    expect(acceptEscort(state(), quest).changes.questProgress["eq_zhangshang_yuquan"]).toEqual({ active: true });
    expect(acceptEscort(state({ room: { name: "喇嘛庙" } }), quest)).toEqual({ logs: [] });
    expect(acceptEscort(state({ questProgress: { [quest.id]: { active: true } } }), quest)).toEqual({ logs: [] });
    expect(acceptEscort(state({ flags: [`quest_done_${quest.id}`] }), quest)).toEqual({ logs: [] });
    expect(acceptEscort(state(), { id: "missing" })).toEqual({ logs: [] });
  });

  it("accepts and claims a completed bounty", () => {
    const quest = { id: "bounty_daluma" };
    expect(acceptBounty(state(), quest).changes.questProgress.bounty_daluma).toEqual({ active: true, count: 0 });
    const result = claimBounty(state({ questProgress: { bounty_daluma: { active: true, count: 1 } } }), quest);
    expect(result.changes.char.money).toBe(150);
    expect(result.changes.dao.karma).toBe(5);
    expect(result.changes.pot).toBe(10);
    expect(result.changes.flags).toContain("quest_done_bounty_daluma");
    expect(claimBounty(state(), quest)).toEqual({ logs: [] });
    expect(claimBounty(state({ questProgress: { bounty_daluma: { active: true, count: 0 } } }), quest)).toEqual({ logs: [] });
    expect(claimBounty(state({ questProgress: { bounty_daluma: { active: false, count: 1 } } }), quest)).toEqual({ logs: [] });
    expect(claimBounty(state({ flags: ["quest_done_bounty_daluma"] }), quest)).toEqual({ logs: [] });
  });

  it("refuses unknown or already active/completed bounty quests", () => {
    const quest = { id: "bounty_daluma" };
    expect(acceptBounty(state(), { id: "missing" })).toEqual({ logs: [] });
    expect(acceptBounty(state({ questProgress: { [quest.id]: { active: true } } }), quest)).toEqual({ logs: [] });
    expect(acceptBounty(state({ flags: [`quest_done_${quest.id}`] }), quest)).toEqual({ logs: [] });
  });
});

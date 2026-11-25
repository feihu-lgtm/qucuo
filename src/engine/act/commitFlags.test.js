import { describe, expect, it } from "vitest";
import { commitModelFlags } from "./commitFlags.js";

describe("commitModelFlags", () => {
  it("只落盘过滤后的 flags，不再消费废弃的 mode=talk pendingQuestBranch", () => {
    const out = commitModelFlags({
      p: { delta: { flags_add: ["quest_done", "snow_spirit_meat"] } },
      room: { name: "鱼定村", npcs: [] },
      innerRoomName: null,
      questProgress: {},
      pendingQuestBranch: { questId: "q1", flag: "quest_done", mode: "talk" },
    });
    expect(out.changes.flags([])).toEqual(["quest_done"]);
    expect(out.changes.pendingQuestBranch).toBeUndefined();
    expect(out.logs).toBeUndefined();
  });
});

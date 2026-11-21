import { describe, expect, it } from "vitest";
import { assemblePrompt, buildAngryNote } from "./assemblePrompt.js";

const varTree = {
  角色: {
    商人: {
      生气状态: {
        active: true,
        reason: "偷窃未遂",
        turnsLeft: 2,
        attempts: [
          { kind: "gift", detail: "青稞饼", time: 1 },
          { kind: "trade", detail: "", time: 2 },
        ],
      },
    },
  },
};

describe("angry NPC prompt note", () => {
  it("lists prior attempts and asks the model to judge the current attempt", () => {
    const note = buildAngryNote(varTree, ["商人"]);

    expect(note).toContain("此前已尝试：送礼「青稞饼」、交易");
    expect(note).toContain("在场生气角色");
    expect(note).toContain("道歉/辩解/示好/赠礼");
    expect(note).toContain("奏效则在 output 中体现怒气缓和");
  });

  it("uses the same note in the in-room prompt context", () => {
    const result = assemblePrompt({
      prompt: {
        room: { name: "鱼定村", exits: [], npcs: [{ name: "商人" }], items: [] },
        char: { name: "少侠", hp: [100, 100], special: {} },
        inv: [],
        skills: [],
        dao: { karma: 0, jie: 0 },
        flags: [],
        questProgress: {},
        varTree,
        time: 0,
        apiCfg: { targetWordCount: 220 },
      },
    }, "问候商人", {}, [], [], [], []);

    expect(result.ctx).toContain("此前已尝试：送礼「青稞饼」、交易");
  });

  it("omits NPCs that are no longer angry", () => {
    expect(buildAngryNote({ 角色: { 商人: { 生气状态: { active: false } } } }, ["商人"])).toBe("");
  });
});

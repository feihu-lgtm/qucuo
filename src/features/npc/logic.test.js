import { describe, expect, it } from "vitest";
import { MOVE_TYPE } from "../../combat/moveTypes.js";
import { learnNpcSkill } from "./logic.js";

const npc = {
  name: "师父",
  levelCap: 1,
  moveset: [{
    id: "move_teaching_palm",
    name: "掌法",
    type: MOVE_TYPE.ATTACK,
    archetype: "拳术",
    quality: "白",
  }],
};

const makeState = (overrides = {}) => ({
  char: { money: 100 },
  skills: [],
  varTree: { 角色: { 师父: { 好感度: 40 } }, 世界: {} },
  ...overrides,
});

describe("NPC skill-learning logic", () => {
  it("teaches available moves, marks the master known, and returns settlement metadata", () => {
    const result = learnNpcSkill(makeState(), npc);

    expect(result.changes.char).toEqual({ money: 20 });
    expect(result.changes.skills).toHaveLength(1);
    expect(result.changes.skills[0]).toMatchObject({
      id: "move_teaching_palm",
      name: "掌法",
      fixed: true,
      source: "拜师",
    });
    expect(result.changes.varTree.世界.已认识人物).toEqual(["师父"]);
    expect(result.logs).toEqual([{
      t: "sys",
      text: "  （习得 1 招，奉上束脩银80两，已录入武学栏 · 授业绝学，学即完整）",
    }]);
    expect(result.settle).toBe("拜师父为师，师父将平生所学「掌法(拳术)」倾囊相授，我凝神习得");
    expect(result.settleOptions).toMatchObject({
      settleNpc: "师父",
      settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "掌法(拳术)", totalPrice: 80, beast: false },
    });
  });

  it("refuses to teach below the favorability gate without changing state", () => {
    const result = learnNpcSkill(makeState({
      varTree: { 角色: { 师父: { 好感度: 39 } }, 世界: {} },
    }), npc);

    expect(result).toEqual({
      logs: [{ t: "sys", text: "  师父似乎还有所保留：交情尚浅（39/40），还需再多些走动。" }],
    });
  });

  it("refuses unaffordable tuition without changing state", () => {
    const result = learnNpcSkill(makeState({ char: { money: 79 } }), npc);

    expect(result).toEqual({
      logs: [{ t: "sys", text: "  师父愿意传授，但束脩需银80两（现有79两），你银两不够，一时难以成行。" }],
    });
  });

  it("reports when all eligible moves are already learned", () => {
    const result = learnNpcSkill(makeState({
      skills: [{ id: "move_teaching_palm" }],
    }), npc);

    expect(result).toEqual({
      logs: [{ t: "sys", text: "  师父这一身本事你都已学全，再无新招可授。" }],
    });
  });

  it("rejects a missing NPC", () => {
    expect(learnNpcSkill(makeState(), null)).toEqual({
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
  });
});

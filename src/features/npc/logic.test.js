import { describe, expect, it } from "vitest";
import { MOVE_TYPE } from "../../domain/rules/combat/moveTypes.js";
import { learnNpcSkill, settleNpcDuel } from "./logic.js";
import { DUEL_HOURS } from "./settleDuel.js";

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

describe("NPC duel report settlement", () => {
  it("returns report rounds and suppresses their old log rows when a report follows", () => {
    const state = {
      char: { name: "少侠", hp: [60, 60], special: { 气运: 5 }, money: 100 },
      room: { name: "鱼定村", npcs: [], items: [] },
      varTree: { 角色: {}, 世界: {} },
      inv: [], flags: [], skills: [], pot: 0, questProgress: {}, time: 0,
    };
    const result = settleNpcDuel(state, { name: "师父", levelCap: 1 }, {
      outcome: "win",
      reportFollows: true,
      battleLog: [{
        round: 1,
        playerMove: { name: "野球拳", type: "攻击" },
        npcMove: { name: "铁布衫", type: "防御" },
        result: {
          nameA: "少侠",
          nameB: "师父",
          damageToA: 0,
          damageToB: 3,
          statusDamageA: 0,
          statusDamageB: 0,
          hpAfterA: [60, 60],
          hpAfterB: [57, 60],
          hpBandA: "healthy",
          hpBandB: "healthy",
          statusAppliedToA: null,
          statusAppliedToB: null,
          markAppliedToA: null,
          markAppliedToB: null,
          hpRestoreA: 0,
          hpRestoreB: 0,
          dodgeSuccessA: false,
          dodgeSuccessB: false,
          statusSlotsAfterA: {},
          statusSlotsAfterB: {},
          statusLogA: [],
          statusLogB: [],
          worseName: "师父",
        },
      }],
    });

    expect(result.reportRounds[0]).toMatchObject({
      round: 1,
      text: expect.stringContaining("师父 −3"),
      playerMove: { name: "野球拳", type: "攻击" },
      result: { damageToB: 3, worseName: "师父" },
    });
    expect(result.logs[0]).toMatchObject({ t: "sys", text: "　── 与师父切磋 ──" });
    expect(result.logs.some(({ text }) => text?.includes("第1回合"))).toBe(false);
    expect(result.changes.time(0)).toBe(DUEL_HOURS);
  });

  it("does not advance time when the duel has no outcome", () => {
    const result = settleNpcDuel(makeState(), { name: "师父", levelCap: 1 }, { outcome: null, battleLog: [] });
    expect(result.changes.time).toBeUndefined();
  });

  it("settles 60 nothing-versus-nothing rounds after phrase pools exhaust", () => {
    const battleLog = Array.from({ length: 60 }, (_, index) => ({
      round: index + 1,
      playerMove: { name: "回气", type: MOVE_TYPE.STATUS },
      npcMove: { name: "调息", type: MOVE_TYPE.STATUS },
      result: {
        nameA: "少侠",
        nameB: "师父",
        damageToA: 0,
        damageToB: 0,
        statusDamageA: 0,
        statusDamageB: 0,
        hpRestoreA: 0,
        hpRestoreB: 0,
        statusAppliedToA: null,
        statusAppliedToB: null,
        markAppliedToA: null,
        markAppliedToB: null,
        statusSlotsAfterA: {},
        statusSlotsAfterB: {},
        hpBandA: "healthy",
        hpBandB: "healthy",
      },
    }));

    const result = settleNpcDuel(makeState(), { name: "师父", levelCap: 1 }, {
      outcome: "win",
      battleLog,
    });
    const reportLines = result.logs.filter(({ t }) => t === "desc");

    expect(result.reportRounds).toHaveLength(60);
    expect(reportLines).toHaveLength(60);
    expect(reportLines.every(({ text }) => text.length > 0)).toBe(true);
  });
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
    expect(result.changes.varTree(makeState().varTree).世界.已认识人物).toEqual(["师父"]);
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

  it("marks the master known without dropping later varTree edits", () => {
    const state = makeState();
    const result = learnNpcSkill(state, npc);
    const latestVarTree = {
      ...state.varTree,
      世界: { ...state.varTree.世界, 本日移动次数: 1 },
    };

    const updated = result.changes.varTree(latestVarTree);

    expect(updated.世界.本日移动次数).toBe(1);
    expect(updated.世界.已认识人物).toEqual(["师父"]);
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

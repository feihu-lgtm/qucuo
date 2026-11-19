import { describe, expect, it } from "vitest";
import { comfort, resolveTrauma, enterSeaOfMind, leaveSeaOfMind, confessToNarrator } from "./logic.js";
import { narratorVars, setNarratorVars } from "../../mvu.js";
import { NNPC_STAGE } from "../../narrator.js";
import { SCENE_ARRIVE, SCENE_RESOLVE } from "../../narratorQuest.js";
import { SAFE_HOUSES } from "../../safeHouse.js";
import { SEA_OF_MIND, describeSeaGate, seaEntryHint } from "../../seaOfMind.js";
import { QUCUO_MAP } from "../../qucuoMap.js";
import { applyResult } from "../run.js";
import { gameActions } from "../../core/gameStore.js";

const state = (vars = {}, overrides = {}) => ({
  varTree: setNarratorVars({}, vars), inv: [], flags: [],
  narrator: { affection: 100, stage: NNPC_STAGE.CHEAT },
  room: { name: SAFE_HOUSES[0].district }, innerRoomName: SAFE_HOUSES[0].room,
  ...overrides,
});

describe("narrator logic", () => {
  it("comforts without mutating the input and preserves transition log order", () => {
    const s = state({ comfort: { verbal: 1 } });
    const before = structuredClone(s);
    const result = comfort(s, "verbal");
    expect(result.logs.map(l => l.t)).toEqual(["cmd", "desc", "affection", "sys"]);
    expect(result.logs[2].text).toBe("  她抬眼看了你一下。");
    expect(result.logs[3].text).toBe("  ⟡ 她像是有话要说。问问她。");
    expect(narratorVars(result.changes.varTree(s.varTree)).comfort.verbal).toBe(2);
    expect(s).toEqual(before);
    expect(comfort(state(), "verbal").logs.map(l => l.t)).toEqual(["cmd", "desc"]);
  });

  it.each([
    ["unknown", {}, "  做不到。"],
    ["hug", {}, "  你刚一伸手，她整个人就缩开了。「别碰我。」"],
    ["food", { verbal: 2 }, "  你手里没有蛋糕。"],
    ["medication", { verbal: 5 }, "  你手里没有抗焦虑药。"],
  ])("refuses comfort %s without changes", (key, counts, text) => {
    expect(comfort(state({ comfort: counts }), key)).toEqual({ logs: [{ t: "desc", text }] });
  });

  it.each(["蛋糕", { name: "蛋糕" }])("accepts string and object inventory items", item => {
    const s = state({ comfort: { verbal: 2 } }, { inv: [item] });
    expect(narratorVars(comfort(s, "food").changes.varTree(s.varTree)).comfort.food).toBe(1);
  });

  it("resolves all knots and records the note", () => {
    const s = state({ comfort: { verbal: 16 }, knots: ["hebe", "corner", "doll"] });
    const result = resolveTrauma(s);
    expect(narratorVars(result.changes.varTree(s.varTree))).toMatchObject({ traumaResolved: true, questStage: 4 });
    expect(result.changes.narrator(s.narrator)).toEqual({ ...s.narrator, stage: NNPC_STAGE.RESOLVED });
    expect(result.logs).toEqual(SCENE_RESOLVE);
    expect(result.note.owner[0].name).toBe("旁白");
  });

  it.each([{ comfort: { verbal: 16 }, knots: [] }, { comfort: {}, knots: ["hebe", "corner", "doll"] }, {}])("refuses unresolved knots or high defense", vars => {
    expect(resolveTrauma(state(vars))).toEqual({ logs: [{ t: "sys", text: "  还不到说这句话的时候。" }] });
  });

  it("enters the sea with first-visit logs in order and store-compatible changes", () => {
    const s = state({ seaUnlocked: true });
    const result = enterSeaOfMind(s);
    expect(result.logs).toEqual([
      { t: "narrator", text: seaEntryHint(SAFE_HOUSES[0].label) },
      { t: "room", text: "" },
      { t: "desc", text: "  你闭上眼。再睁开时，脚下是白色的沙。太阳正在落山——永远在落山。" },
      ...SCENE_ARRIVE,
    ]);
    expect(result.changes.room.name).toBe(SEA_OF_MIND.district);
    expect(result.changes.narrator(s.narrator).stage).toBe(NNPC_STAGE.SPIRIT);
    let tree;
    expect(() => applyResult({ setVarTree: fn => { tree = fn(s.varTree); } }, result)).not.toThrow();
    expect(narratorVars(tree).seaVisited).toBe(true);
    for (const key of Object.keys(result.changes).filter(k => k !== "varTree")) {
      expect(gameActions[`set${key[0].toUpperCase()}${key.slice(1)}`]).toBeTypeOf("function");
    }
  });

  it("does not repeat arrival or regress a resolved narrator", () => {
    const s = state({ seaVisited: true }, { flags: [SEA_OF_MIND.flag], narrator: { stage: NNPC_STAGE.RESOLVED } });
    const result = enterSeaOfMind(s);
    expect(result.logs.map(l => l.t)).toEqual(["room", "desc"]);
    expect(result.changes.narrator).toBeUndefined();
  });

  it.each([
    [state(), "locked"],
    [state({ seaUnlocked: true }, { innerRoomName: null }), "notInSafeHouse"],
  ])("refuses sea entry", (s, reason) => {
    expect(enterSeaOfMind(s)).toEqual({ logs: [{ t: "sys", text: `  ${describeSeaGate(reason)}` }] });
  });

  it("returns to the saved district or the default", () => {
    for (const back of [undefined, { room: "雪山派", inner: "内堂" }]) {
      const result = leaveSeaOfMind(state(), back);
      const name = back?.room || "鱼定村";
      expect(result.changes.room).toEqual({ name, desc: QUCUO_MAP[name].desc, exits: Object.keys(QUCUO_MAP[name].exits), npcs: [], items: [] });
      expect(result.logs).toHaveLength(1);
    }
    expect(leaveSeaOfMind(state(), { room: "missing" })).toEqual({ logs: [{ t: "sys", text: "  回不去了……？" }] });
  });

  it("confesses and preserves narrator fields", () => {
    const s = state();
    const result = confessToNarrator(s);
    expect(result.changes.narrator(s.narrator)).toEqual({ ...s.narrator, confessed: true, stage: NNPC_STAGE.CHEAT });
    expect(result.logs.map(l => l.t)).toEqual(["sys", "confess", "confess", "confess", "sys"]);
  });

  it.each([{ affection: 99 }, { affection: 100, confessed: true }])("silently refuses confession", narrator => {
    expect(confessToNarrator(state({}, { narrator }))).toEqual({ logs: [] });
  });
});

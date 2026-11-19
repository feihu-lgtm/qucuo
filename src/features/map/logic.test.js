import { describe, expect, it } from "vitest";
import { innerMove } from "./logic.js";

const makeState = (overrides = {}) => ({
  room: { name: "鱼定村", npcs: [] },
  innerRoomName: "村口",
  flags: [],
  varTree: {},
  questProgress: {},
  inv: [],
  char: {},
  time: 6,
  ...overrides,
});

describe("inner movement logic", () => {
  it("moves one inner exit and returns the same arrival logs as the UI branch", () => {
    const result = innerMove(makeState(), {
      direction: "e",
      forceLayer: "inner",
      command: "走 东",
    });

    expect(result.changes).toEqual({
      innerRoomName: "歇马居",
      time: 7,
      varTree: {},
    });
    expect(result.logs).toContainEqual({ t: "cmd", text: "> 走 东" });
    expect(result.logs).toContainEqual({ t: "room", text: "    鱼定村·歇马居" });
    expect(result.logs.some((entry) => entry.text.includes("村里的客栈"))).toBe(true);
  });

  it("marks newly visible NPCs seen and records their last-seen turn", () => {
    const state = makeState({
      room: { name: "鱼定村", npcs: [{ name: "客商", innerRoom: "歇马居" }] },
      varTree: { 世界: {} },
    });
    const result = innerMove(state, { direction: "e", forceLayer: "inner", command: "走 东" });

    expect(result.changes.varTree.世界.曾经出现人物).toEqual(["客商"]);
    expect(result.changes.varTree.世界.上次同框回合).toEqual({ 客商: 6 });
    expect(result.logs.at(-1)).toEqual({ t: "sys", text: "  ※ 新人物出现：客商（点击可细看其人）" });
  });

  it("returns logs only when an explicit inner move is blocked", () => {
    const result = innerMove(makeState({ innerRoomName: "马车行" }), {
      direction: "s",
      forceLayer: "inner",
      command: "走 南",
    });

    expect(result).toEqual({
      logs: [
        { t: "cmd", text: "> 走 南" },
        { t: "sys", text: "  内里这个方向没有去处。" },
      ],
    });
  });

  it("accepts an adjacent room name as the movement target", () => {
    const result = innerMove(makeState({ innerRoomName: "歇马居" }), "去 马车行");

    expect(result.changes.innerRoomName).toBe("马车行");
    expect(result.changes.time).toBe(7);
  });

  it("leaves non-inner directions to the outer movement path unless forced", () => {
    expect(innerMove(makeState({ innerRoomName: "马车行" }), {
      direction: "s",
      forceLayer: null,
      command: "往南走",
    })).toBeNull();
  });
});

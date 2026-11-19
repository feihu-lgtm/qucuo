import { describe, expect, it } from "vitest";
import { innerMove, outerArrival, planAutoTravel } from "./logic.js";

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
      varTree: expect.any(Function),
    });
    expect(result.logs).toContainEqual({ t: "cmd", text: "> 走 东" });
    expect(result.logs).toContainEqual({ t: "room", text: "    鱼定村·歇马居" });
    expect(result.logs.some((entry) => entry.text.includes("村里的客栈"))).toBe(true);
  });

  it("emits exactly one command entry when act already echoed the movement", () => {
    const actEcho = { t: "cmd", text: "> 走 东" };
    const result = innerMove(makeState(), {
      direction: "e",
      forceLayer: "inner",
      command: "走 东",
      includeCommand: false,
    });

    expect([actEcho, ...result.logs].filter((entry) => entry.t === "cmd")).toEqual([actEcho]);
  });

  it("marks newly visible NPCs seen and records their last-seen turn", () => {
    const state = makeState({
      room: { name: "鱼定村", npcs: [{ name: "客商", innerRoom: "歇马居" }] },
      varTree: { 世界: {} },
    });
    const result = innerMove(state, { direction: "e", forceLayer: "inner", command: "走 东" });

    const nextVarTree = result.changes.varTree(state.varTree);
    expect(nextVarTree.世界.曾经出现人物).toEqual(["客商"]);
    expect(nextVarTree.世界.上次同框回合).toEqual({ 客商: 6 });
    expect(result.logs.at(-1)).toEqual({ t: "sys", text: "  ※ 新人物出现：客商（点击可细看其人）" });
  });

  it("applies movement awareness to the latest varTree without dropping intervening edits", () => {
    const state = makeState({
      room: { name: "鱼定村", npcs: [{ name: "客商", innerRoom: "歇马居" }] },
      varTree: { 世界: {} },
    });
    const result = innerMove(state, { direction: "e", forceLayer: "inner", command: "走 东" });
    const latestVarTree = {
      世界: {
        ...state.varTree.世界,
        本日移动次数: 1,
      },
    };

    const updated = result.changes.varTree(latestVarTree);

    expect(updated.世界.本日移动次数).toBe(1);
    expect(updated.世界.曾经出现人物).toEqual(["客商"]);
    expect(updated.世界.上次同框回合).toEqual({ 客商: 6 });
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

  it("resolves room names only through actual adjacent exits", () => {
    const pandaValley = makeState({
      room: { name: "雅江", npcs: [] },
      innerRoomName: "熊猫谷",
    });
    const gate = innerMove(pandaValley, {
      target: "东城门",
      targetKind: "room",
      command: "去 东城门",
    });
    expect(gate.changes.innerRoomName).toBe("东城门");

    const nonAdjacentRoom = innerMove(pandaValley, {
      target: "西厢僧舍",
      targetKind: "room",
      command: "去 西厢僧舍",
    });
    expect(nonAdjacentRoom).toEqual({
      logs: [
        { t: "cmd", text: "> 去 西厢僧舍" },
        { t: "sys", text: "  内里这个方向没有去处。" },
      ],
    });

    const monastery = makeState({
      room: { name: "喇嘛庙", npcs: [] },
      innerRoomName: "大殿",
    });
    const adjacentRoom = innerMove(monastery, {
      target: "西厢僧舍",
      targetKind: "room",
      command: "去 西厢僧舍",
    });
    expect(adjacentRoom.changes.innerRoomName).toBe("西厢僧舍");
  });

  it("leaves non-inner directions to the outer movement path unless forced", () => {
    expect(innerMove(makeState({ innerRoomName: "马车行" }), {
      direction: "s",
      forceLayer: null,
      command: "往南走",
    })).toBeNull();
  });

  it("returns cached outer-arrival state changes and a deferred square operation", () => {
    const state = makeState({
      room: { name: "鱼定村", npcs: [] },
      char: { special: { 气运: 5 } },
      inv: [{ id: "existing", name: "旧物" }],
      mapData: { 鱼定村: { x: 0, y: 0 } },
      varTree: { 世界: {} },
      convo: [],
    });
    const result = outerArrival(state, {
      direction: "e",
      destName: "雅江",
      command: "走 东",
      roomMap: {
        雅江: {
          npcs: [{ id: "npc_traveler", name: "客商" }],
          items: [{ id: "ground_item", name: "石阶旁的草叶" }],
        },
      },
      squares: {
        雅江: {
          day: 0,
          desc: "格子里的到达描述。",
          findLine: "石缝中露出一角",
          item: { name: "雪山当归", category: "misc", quality: "蓝", desc: "一味药材。" },
          itemTaken: false,
          encounter: null,
          encounterMet: false,
          burned: false,
        },
      },
    });

    expect(result.cached).toBe(true);
    expect(result.squareOps).toEqual([{ op: "consume", key: "雅江", day: 0 }]);
    expect(result.changes.room).toMatchObject({
      name: "雅江",
      desc: "格子里的到达描述。",
      npcs: [{ id: "npc_traveler", name: "客商" }],
      items: [{ id: "ground_item", name: "石阶旁的草叶" }],
    });
    expect(Array.isArray(result.changes.room.exits)).toBe(true);
    expect(result.changes.time(state.time)).toBe(state.time + 1);
    expect(result.changes.inv(state.inv).map((item) => item.name)).toEqual(["旧物", "雪山当归"]);
    expect(result.changes.mapData(state.mapData)).toEqual({
      鱼定村: { x: 0, y: 0 },
      雅江: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    });
    expect(result.changes.varTree(state.varTree)).toEqual({
      世界: {
        曾经出现人物: ["客商"],
        上次同框回合: { 客商: state.time },
      },
    });
    expect(result.logs.map(({ t, text }) => [t, text])).toEqual([
      ["room", ""],
      ["room", "    雅江"],
      ["room", ""],
      ["desc", "  格子里的到达描述。"],
      ["item", "  石缝中露出一角  ✓ 你拾得「雪山当归」，收入行囊。"],
      ["sys", "  ※ 新人物出现：客商（点击可细看其人）"],
    ]);
    expect(result.changes.convo).toEqual([
      { role: "user", content: "走 东" },
      { role: "assistant", content: "格子里的到达描述。" },
    ]);
  });

  it("returns a burn operation for an uncached outer destination", () => {
    expect(outerArrival(makeState(), {
      direction: "e",
      destName: "雅江",
      roomMap: {},
      squares: {},
    })).toEqual({
      cached: false,
      squareOps: [{ op: "burn", key: "雅江" }],
    });
  });

  it("plans auto-travel only through explored nodes and unlocked destinations", () => {
    const state = {
      ...makeState({ room: { name: "鱼定村" } }),
      mapData: { 鱼定村: {}, 雅江: {} },
    };

    expect(planAutoTravel(state, "雅江")).toEqual({ locked: false, path: ["e"] });
    expect(planAutoTravel(state, "黑风寨")).toEqual({ locked: true, path: null });
  });
});

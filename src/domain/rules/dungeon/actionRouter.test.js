// 房间动作路由契约测试：loot 落袋 / checkpoint 标记 / puzzle 回合推进 / fight 上抛 / needsAI。
import { describe, expect, it, vi } from "vitest";

// 谜题 roll() 走 utils/rng 模块级 random，钉成 0 让检定恒定成功。
vi.mock("../../../utils/rng.js", async (importOriginal) => ({
  ...(await importOriginal()),
  random: () => 0,
}));
import { routeRoomAction, routeRoomText } from "./actionRouter.js";
import { startMapRun } from "./mapRun.js";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";

const hi = () => 0;
const attrs = { craft: 10, wisdom: 10, strength: 10, agility: 10 };

// 手搓最小 runState：跳过地图生成，直接给一房一事
function mkRun(roomEvent, roomPatch = {}) {
  return {
    districtKey: "喇嘛庙地宫",
    seed: "t1",
    map: {
      anchor: "测试房",
      rooms: { 测试房: { desc: "一间测试房。", exits: {}, roomEvent, ...roomPatch } },
    },
    current: "测试房",
    visited: ["测试房"],
    envTags: {},
    envState: {},
    hp: [80, 100],
    loot: { money: 0, exp: 0, pot: 0, items: [] },
    status: "exploring",
    step: 3,
    checkpoint: null,
    log: [],
  };
}

describe("routeRoomAction", () => {
  it("loot 事件：检定过→碎银落袋、标记 resolved", () => {
    const rs = mkRun({ kind: "loot", desc: "佛龛宝匣", check: "craft", dc: 6, outcome: "唐卡一幅", resolved: false });
    const r = routeRoomAction(rs, "撬开宝匣", { attrs, rng: hi });
    expect(r.runState.loot.money).toBeGreaterThanOrEqual(20);
    expect(r.runState.map.rooms.测试房.roomEvent.resolved).toBe(true);
    expect(r.log).toContain("唐卡");
  });

  it("groundLoot 拾取：物品入 loot.items、房间清空", () => {
    const rs = mkRun(null, { groundLoot: [{ name: "雪莲" }, "断剑"] });
    const r = routeRoomAction(rs, "拾取", { attrs, rng: hi });
    expect(r.runState.loot.items).toEqual(["雪莲", "断剑"]);
    expect(r.runState.map.rooms.测试房.groundLoot).toEqual([]);
  });

  it("isCheckpoint 记录存档：checkpoint 快照落地", () => {
    const rs = mkRun(null, { isCheckpoint: true });
    const r = routeRoomAction(rs, "记录存档", { attrs, rng: hi });
    expect(r.runState.checkpoint.room).toBe("测试房");
    expect(r.runState.checkpoint.hp).toEqual([80, 100]);
    expect(r.runState.checkpoint.step).toBe(3);
  });

  it("fight：combatNpc 上抛且事件标 resolved", () => {
    const rs = mkRun({ kind: "fight", desc: "守窟獒", check: "combat", dc: 4, outcome: "獒皮", resolved: false });
    const r = routeRoomAction(rs, "迎战", { attrs, rng: hi });
    expect(r.combatNpc).toBeTruthy();
    expect(r.combatNpc.moveset?.length || r.combatNpc.name).toBeTruthy();
    expect(r.runState.map.rooms.测试房.roomEvent.resolved).toBe(true);
  });

  it("event 失败：hp_loss 扣回 runState.hp", () => {
    const rs = mkRun({ kind: "event", desc: "翻板塌陷", check: "agility", dc: 8, outcome: "摔得不轻", resolved: false });
    const r = routeRoomAction(rs, "硬闯", { attrs: { agility: 0 }, rng: () => 0.999 });
    expect(r.runState.hp[0]).toBe(80 - 40);
  });

  it("meet/watch/nsfw：先挂 options 再按 label 结分支", () => {
    const rs = mkRun({ kind: "meet", desc: "寻宝散人", check: "charm", dc: 5, outcome: "结伴同行", resolved: false });
    const r1 = routeRoomAction(rs, "上前攀谈", { attrs, rng: hi });
    expect(r1.branch.options).toHaveLength(2);
    expect(r1.runState.map.rooms.测试房.roomEvent.options).toHaveLength(2);
    const r2 = routeRoomAction(r1.runState, "上前结交", { attrs: { ...attrs, charm: 10 }, rng: hi });
    expect(r2.branchEffect.type).toBe("companion_offer");
    expect(r2.branchEffect.success).toBe(true);
    expect(r2.runState.map.rooms.测试房.roomEvent.resolved).toBe(true);
    expect(r2.runState.map.rooms.测试房.roomEvent.options).toBeUndefined();
  });

  it("分支选「离开」：清 options 但不标 resolved", () => {
    const rs = mkRun({ kind: "watch", desc: "武僧切磋", check: "stealth", dc: 4, outcome: "招式感悟", resolved: false });
    const r1 = routeRoomAction(rs, "观望", { attrs, rng: hi });
    const r2 = routeRoomAction(r1.runState, "悄然离开", { attrs, rng: hi });
    expect(r2.runState.map.rooms.测试房.roomEvent.resolved).toBe(false);
    expect(r2.runState.map.rooms.测试房.roomEvent.options).toBeUndefined();
  });

  it("puzzle：实例挂 activePuzzle 并上抛", () => {
    const rs = mkRun({
      kind: "puzzle", desc: "唐卡复位", check: "wisdom", dc: 6, outcome: "暗门", resolved: false,
      puzzleType: "sequenceReset",
      puzzleConfig: { items: ["割肉", "喂鹰", "成佛"], stat: "wisdom", dc: 6, prompt: "重挂唐卡" },
    });
    const r = routeRoomAction(rs, "解谜", { attrs, rng: hi });
    expect(r.puzzleInstance.type).toBe("sequenceReset");
    expect(r.runState.activePuzzle.instance.type).toBe("sequenceReset");
  });

  it("无事件无物品：needsAI 兜底", () => {
    const rs = mkRun(null);
    const r = routeRoomAction(rs, "东张西望", { attrs, rng: hi });
    expect(r.needsAI).toBe(true);
    expect(r.text).toBe("东张西望");
    expect(r.runState).toBe(rs);
  });
});

describe("routeRoomText", () => {
  const puzzleEvent = {
    kind: "puzzle", desc: "石像归位", check: "strength", dc: 5, outcome: "暗门", resolved: false,
    puzzleType: "pushPull",
    puzzleConfig: { size: 3, start: { x: 1, y: 2 }, target: { x: 1, y: 0 }, stat: "strength", dc: 5, prompt: "推动石像" },
  };

  it("谜题推进：parseIntent→applyAction 走回合", () => {
    const rs = mkRun(puzzleEvent);
    const r0 = routeRoomAction(rs, "解谜", { attrs, rng: hi });
    expect(r0.runState.activePuzzle).toBeTruthy();
    const r1 = routeRoomText(r0.runState, "推向北", { attrs });
    expect(r1.done).toBe(false);
    expect(r1.runState.activePuzzle.state.pos.y).toBe(1);
    expect(r1.log).toContain("石像");
  });

  it("谜题解完：activePuzzle 摘除、事件 resolved", () => {
    const rs = mkRun(puzzleEvent);
    let s = routeRoomAction(rs, "解谜", { attrs, rng: hi }).runState;
    s = routeRoomText(s, "推向北", { attrs }).runState;
    const fin = routeRoomText(s, "推向北", { attrs });
    expect(fin.done).toBe(true);
    expect(fin.runState.activePuzzle).toBeUndefined();
    expect(fin.runState.map.rooms.测试房.roomEvent.resolved).toBe(true);
  });

  it("无谜题/parseIntent 认不出：needsAI 原样退回", () => {
    const rs = mkRun(null);
    const r = routeRoomText(rs, "看看墙角", { attrs });
    expect(r.needsAI).toBe(true);
    expect(r.text).toBe("看看墙角");

    const rs2 = mkRun(puzzleEvent);
    const s = routeRoomAction(rs2, "解谜", { attrs, rng: hi }).runState;
    const r2 = routeRoomText(s, "念念有词", { attrs });
    expect(r2.needsAI).toBe(true);
  });
});

describe("与真实地图冒烟", () => {
  it("startMapRun 出的 runState 走通动作路由", () => {
    const cfg = Object.keys(DUNGEON_DISTRICTS_ALL)[0];
    const rs = startMapRun(cfg, "router-smoke", { char: { hp: [90, 100] } });
    const r = routeRoomAction(rs, "四下查看", { attrs, rng: hi });
    expect(r.runState).toBeTruthy();
  });
});

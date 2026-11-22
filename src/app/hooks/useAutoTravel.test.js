import { describe, expect, it } from "vitest";
import { enqueueAutoTravelLegs } from "./useAutoTravel.js";

describe("auto-travel route legs", () => {
  it("uses the latest act closure as each previous leg updates the room", async () => {
    const rooms = {
      "鱼定村": { name: "鱼定村", exits: { 北: "雅江" } },
      "雅江": { name: "雅江", exits: { 东: "西城门" } },
      "西城门": { name: "西城门", exits: {} },
    };
    const calls = [];
    const queued = [];
    const scheduler = {
      queue: [],
      enqueue(id, fn, meta) {
        const entry = { id, fn, meta };
        this.queue.push(entry);
        queued.push(entry);
        return Promise.resolve();
      },
    };
    const autoTravelRef = { current: false };
    let actRef;
    const makeAct = (room) => async (direction) => {
      calls.push({ room: room.name, direction });
      actRef.current = makeAct(rooms[room.exits[direction]]);
    };
    actRef = { current: makeAct(rooms["鱼定村"]) };

    enqueueAutoTravelLegs(["北", "东"], { scheduler, actRef, autoTravelRef });
    await scheduler.queue.shift().fn();
    await scheduler.queue.shift().fn();

    expect(queued.map(entry => entry.meta.routeLeg)).toEqual([true, true]);
    expect(calls).toEqual([
      { room: "鱼定村", direction: "北" },
      { room: "雅江", direction: "东" },
    ]);
    expect(autoTravelRef.current).toBe(false);
  });

  it("waits for the re-rendered act closure before running the next leg", async () => {
    // 回归：两段寻路只走第一段——腿间在同一微任务链里连跑，actRef.current 还停在
    // 旧房间闭包时第二程就拿旧 room 判出口。修复后每程先等 roomNameRef 到达本程出发房。
    const calls = [];
    const actAtStart = async (direction, _r, opts) => calls.push({ closure: "鱼定村", direction, turn: opts?.turn });
    const actAtNext = async (direction, _r, opts) => calls.push({ closure: "雅江", direction, turn: opts?.turn });
    const actRef = { current: actAtStart };
    const roomNameRef = { current: "鱼定村" };
    const autoTravelRef = { current: false };
    const queued = [];
    const scheduler = {
      queue: [],
      enqueue(id, fn, meta) {
        const e = { id, fn, meta, trace: { id: `trace-${id}-${queued.length}` } };
        this.queue.push(e); queued.push(e); return Promise.resolve();
      },
    };

    enqueueAutoTravelLegs(["北", "东"], {
      scheduler, actRef, autoTravelRef, roomNameRef,
      expectedRooms: ["鱼定村", "雅江"],
    });

    // 调度器 runEntry 用 entry 调 fn（commandScheduler: entry.fn(entry)），
    // 本程 trace 由腿从 entry.trace 抓住、经 opts.turn 传回 act，await 之后不起游离 trace。
    const leg1 = scheduler.queue[0].fn(scheduler.queue[0]);
    const leg2Promise = scheduler.queue[1].fn(scheduler.queue[1]);
    await leg1;
    // 模拟 React 下一拍才渲染出新闭包：先换 roomNameRef（同一次 render 里 actRef 也换）
    setTimeout(() => { roomNameRef.current = "雅江"; actRef.current = actAtNext; }, 0);
    await leg2Promise;

    expect(calls).toEqual([
      { closure: "鱼定村", direction: "北", turn: queued[0].trace },
      { closure: "雅江", direction: "东", turn: queued[1].trace },
    ]);
  });
});

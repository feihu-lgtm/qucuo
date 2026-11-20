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
});

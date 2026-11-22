import { describe, expect, it } from "vitest";
import { createScheduler } from "./commandScheduler.js";

describe("command scheduler route ordering", () => {
  it("runs beforeRoute commands ahead of the remaining route legs", async () => {
    const scheduler = createScheduler();
    const order = [];
    let finishFirstLeg;
    const firstLeg = scheduler.dispatch("autoTravel", () => {
      order.push("first");
      return new Promise(resolve => { finishFirstLeg = resolve; });
    });
    const secondLeg = scheduler.enqueue("autoTravel", () => { order.push("second"); }, { routeQueue: true, routeLeg: true });
    const waypoint = scheduler.dispatch("npcGift", () => { order.push("gift"); }, { beforeRoute: true });
    finishFirstLeg();
    await Promise.all([firstLeg, secondLeg, waypoint]);
    expect(order).toEqual(["first", "gift", "second"]);
  });
});

import { describe, expect, it } from "vitest";
import { pickGroundItem } from "./logic.js";

describe("pickGroundItem 只捡本房间地上的东西", () => {
  const state = {
    time: 5, inv: [], varTree: {}, innerRoomName: "峰道入口",
    room: { name: "顶峰", items: [{ name: "霜天月", innerRoom: "雪山崖底" }, { name: "冻硬的旧经幡" }] },
  };
  it("别的内层房间的东西捡不到", () => {
    expect(pickGroundItem(state, "霜天月")).toEqual({});
  });
  it("本房间的东西捡得到，且只从地上移走这一件", () => {
    const result = pickGroundItem(state, "冻硬的旧经幡");
    expect(result.changes.room(state.room).items.map((item) => item.name)).toEqual(["霜天月"]);
  });
});

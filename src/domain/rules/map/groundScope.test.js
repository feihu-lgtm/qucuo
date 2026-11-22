import { describe, expect, it } from "vitest";
import {
  getGroundItems, isGroundItemHere, mergeGroundItems, placeGroundItems, removeGroundItems, tagGroundItem,
} from "./groundScope.js";
import { getDistrictAnchor } from "./innerMap.js";

// 顶峰：锚点峰道入口，另有绝顶、雪山崖底
const D = "顶峰";
const ANCHOR = getDistrictAnchor(D);
const room = (items) => ({ name: D, items });

describe("地上物品按内层房间区分", () => {
  it("带归属的只在那间房；不带归属的归锚点；没有内层地图或不在内层时不过滤", () => {
    const sword = { name: "霜天月", innerRoom: "雪山崖底" };
    const pebble = { name: "石子" };
    expect(isGroundItemHere(D, "雪山崖底", sword)).toBe(true);
    expect(isGroundItemHere(D, ANCHOR, sword)).toBe(false);
    expect(isGroundItemHere(D, ANCHOR, pebble)).toBe(true);
    expect(isGroundItemHere(D, "绝顶", pebble)).toBe(false);
    expect(isGroundItemHere(D, "", sword)).toBe(true);
    expect(isGroundItemHere("不存在的据点", "某房", sword)).toBe(true);
    expect(getGroundItems({ room: room([sword, pebble]), innerRoomName: "雪山崖底" })).toEqual([sword]);
  });

  it("放下的东西记在当前房间；字符串物品转成对象", () => {
    expect(tagGroundItem("草绳", D, "绝顶")).toEqual({ name: "草绳", id: "草绳", innerRoom: "绝顶" });
    expect(placeGroundItems([], ["草绳"], D, "绝顶")).toEqual([{ name: "草绳", id: "草绳", innerRoom: "绝顶" }]);
  });

  it("拿走只拿本房间的那一件，别的房间同名的不动", () => {
    const items = [{ name: "旧哈达", innerRoom: "绝顶" }, { name: "旧哈达", innerRoom: "雪山崖底" }];
    expect(removeGroundItems(items, ["旧哈达"], D, "雪山崖底")).toEqual([{ name: "旧哈达", innerRoom: "绝顶" }]);
  });

  it("AI 报回的名单只改写本房间那一份，别的房间原样保留，已有物件沿用原对象", () => {
    const prev = [
      { name: "霜天月", id: "x1", innerRoom: "雪山崖底", quality: "红" },
      { name: "冻硬的旧经幡" },
    ];
    const merged = mergeGroundItems(prev, [{ name: "冻硬的旧经幡" }, { name: "新落的雪块" }], D, ANCHOR);
    expect(merged).toEqual([
      { name: "霜天月", id: "x1", innerRoom: "雪山崖底", quality: "红" },
      { name: "冻硬的旧经幡" },
      { name: "新落的雪块", innerRoom: ANCHOR },
    ]);
    expect(mergeGroundItems(prev, undefined, D, ANCHOR)).toBe(prev);
  });
});

import { describe, expect, it } from "vitest";
import { blockedNoticeText, innerBlockedNoticeText, passableExits } from "./blockedNotice.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { visibleInnerExits } from "./innerMap.js";

describe("blocked direction notice", () => {
  it("shows the unavailable direction and available exits in Chinese", () => {
    expect(blockedNoticeText("n", { w: "鱼定村", e: "锦官城" }))
      .toBe("此路不通 · 往北没有路\n可走：西、东");
  });

  it("omits the exit line when there are no exits", () => {
    expect(blockedNoticeText("sw", {})).toBe("此路不通 · 往西南没有路");
  });

  it("omits an outer route whose destination is quest-locked", () => {
    const exits = passableExits(QUCUO_MAP["玉泉寨"].exits, { layer: "outer", questProgress: {}, flags: [] });
    expect(exits).not.toHaveProperty("w");
    expect(exits).toEqual({ n: "大草甸", e: "贡措海" });
  });

  it("omits an inner route whose destination is stat-locked", () => {
    const exits = visibleInnerExits("顶峰", "绝顶", { char: { waigong: 10, neigong: 10 } });
    expect(exits.e).toBe("雪山崖底");
    const passable = passableExits(exits, {
      layer: "inner", districtName: "顶峰", questProgress: {}, flags: [], inv: [],
      char: { waigong: 10, neigong: 10 },
    });
    expect(passable).not.toHaveProperty("e");
    expect(passable.s).toBe("峰道入口");
  });

  it("lists only passable inner exits in the notice text", () => {
    expect(innerBlockedNoticeText("n", "顶峰", "绝顶", { char: { waigong: 10, neigong: 10 } }))
      .toBe("此路不通 · 往北没有路\n可走：南");
  });
});

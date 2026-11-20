import { describe, expect, it } from "vitest";
import { blockedNoticeText } from "./blockedNotice.js";

describe("blocked direction notice", () => {
  it("shows the unavailable direction and available exits in Chinese", () => {
    expect(blockedNoticeText("n", { w: "鱼定村", e: "锦官城" }))
      .toBe("此路不通 · 往北没有路\n可走：西、东");
  });

  it("omits the exit line when there are no exits", () => {
    expect(blockedNoticeText("sw", {})).toBe("此路不通 · 往西南没有路");
  });
});

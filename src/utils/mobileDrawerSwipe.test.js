import { describe, expect, it } from "vitest";
import {
  getMobileDrawerSwipeAction,
  MOBILE_DRAWER_SWIPE_PX,
} from "./mobileDrawerSwipe.js";

describe("mobile drawer swipe", () => {
  it("opens from either viewport edge after the swipe threshold", () => {
    expect(getMobileDrawerSwipeAction({ startX: 8, endX: 64, width: 390 })).toBe("left");
    expect(getMobileDrawerSwipeAction({ startX: 382, endX: 326, width: 390 })).toBe("right");
  });

  it("requires the horizontal threshold", () => {
    expect(getMobileDrawerSwipeAction({
      startX: 8, endX: 8 + MOBILE_DRAWER_SWIPE_PX - 1, width: 390,
    })).toBeNull();
  });

  it("closes an open drawer with an outward swipe", () => {
    expect(getMobileDrawerSwipeAction({ startX: 110, endX: 40, width: 390, drawer: "left" })).toBe("close");
    expect(getMobileDrawerSwipeAction({ startX: 280, endX: 350, width: 390, drawer: "right" })).toBe("close");
  });

  it("ignores vertical gestures and swipes in the wrong direction", () => {
    expect(getMobileDrawerSwipeAction({
      startX: 8, endX: 80, startY: 10, endY: 90, width: 390,
    })).toBeNull();
    expect(getMobileDrawerSwipeAction({
      startX: 110, endX: 200, width: 390, drawer: "left",
    })).toBeNull();
  });
});

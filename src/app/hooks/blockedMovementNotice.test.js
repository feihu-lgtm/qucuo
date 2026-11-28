import { afterEach, describe, expect, it } from "vitest";
import { clearNotice, uiStore } from "../../store/uiStore.js";
import { resolveInnerBlockedSummary, showOuterNoExitNotice } from "./blockedMovementNotice.js";

afterEach(() => clearNotice());

describe("blocked movement notices", () => {
  it("announces an inner missing road but leaves locked doors to their own message", () => {
    const noExit = { logs: [{ t: "sys", text: "内里这个方向没有去处" }] };
    expect(resolveInnerBlockedSummary(noExit, "n", "鱼定村", "村口", {})).toBe("内层此路不通");
    expect(uiStore.getState().notice.text).toMatch(/^此路不通 · 往北没有路\n可走：/);
    clearNotice();
    expect(resolveInnerBlockedSummary({ logs: [{ t: "sys", text: "门锁着" }] }, "n", "鱼定村", "村口", {})).toBe("门锁着");
    expect(uiStore.getState().notice).toBeNull();
  });

  it("shows the outer notice only for a known no-exit direction", () => {
    showOuterNoExitNotice({ noExit: true }, "ne", "玉泉寨", { questProgress: {}, flags: [] });
    expect(uiStore.getState().notice.text).toBe("此路不通 · 往东北没有路\n可走：北、东、南");
    clearNotice();
    showOuterNoExitNotice({ noExit: false }, "ne", "玉泉寨", { questProgress: {}, flags: [] });
    expect(uiStore.getState().notice).toBeNull();
  });
});

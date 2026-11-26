import { afterEach, describe, expect, it } from "vitest";
import {
  isTopModal, MODAL_LAYERS, modalStackSnapshot, normalizeLayer, popModal, pushModal, resetModalStack, wrapFocusIndex,
} from "./modalStack.js";
import { readFileSync } from "node:fs";

afterEach(() => resetModalStack());

describe("弹窗栈：Esc 只交给最上面那个", () => {
  it("后挂载的在栈顶，卸载后上一层恢复为栈顶", () => {
    pushModal("a");
    pushModal("b");
    expect(isTopModal("b")).toBe(true);
    expect(isTopModal("a")).toBe(false);
    popModal("b");
    expect(isTopModal("a")).toBe(true);
  });

  it("中间层先卸载不影响栈顶，重复压栈不重复登记", () => {
    pushModal("a");
    pushModal("b");
    pushModal("b");
    pushModal("c");
    popModal("b");
    expect(modalStackSnapshot()).toEqual(["a", "c"]);
    expect(isTopModal("c")).toBe(true);
  });

  it("空栈时谁都不是栈顶", () => {
    expect(isTopModal("a")).toBe(false);
  });
});

describe("焦点锁定的回绕", () => {
  it("最后一个按 Tab 回到第一个，第一个按 Shift+Tab 回到最后一个", () => {
    expect(wrapFocusIndex(3, 2, false)).toBe(0);
    expect(wrapFocusIndex(3, 0, true)).toBe(2);
  });

  it("中间位置交给浏览器默认行为", () => {
    expect(wrapFocusIndex(3, 1, false)).toBe(-1);
    expect(wrapFocusIndex(3, 1, true)).toBe(-1);
  });

  it("焦点在弹窗外时拉回弹窗内", () => {
    expect(wrapFocusIndex(3, -1, false)).toBe(0);
    expect(wrapFocusIndex(3, -1, true)).toBe(2);
    expect(wrapFocusIndex(0, -1, false)).toBe(-1);
  });
});

describe("层级档位", () => {
  it("未知档位回落到 dialog", () => {
    expect(normalizeLayer("screen")).toBe("screen");
    expect(normalizeLayer("whatever")).toBe("dialog");
  });

  it("每个档位在 tokens.css 里都有变量和对应的 data-layer 规则，且数值单调递增", () => {
    const tokens = readFileSync("src/ui/tokens.css", "utf-8");
    const values = MODAL_LAYERS.map((layer) => {
      const match = tokens.match(new RegExp(`--z-${layer}:\\s*(\\d+);`));
      expect(match, `--z-${layer}`).not.toBeNull();
      const prefix = "--z-";
      expect(tokens).toContain(`.ui-modal-root[data-layer="${layer}"] { z-index: var(${prefix}${layer}); }`);
      return Number(match[1]);
    });
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(new Set(values).size).toBe(values.length);
  });
});

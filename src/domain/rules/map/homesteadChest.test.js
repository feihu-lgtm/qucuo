import { afterEach, describe, expect, it, vi } from "vitest";
import { loadChest } from "./homestead.js";

afterEach(() => vi.unstubAllGlobals());

describe("loadChest prefill", () => {
  it("prefills a never-opened chest unless prefill is off", () => {
    const store = new Map();
    vi.stubGlobal("localStorage", { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
    expect(loadChest("鱼定土司府客卿偏仓", { prefill: false })).toEqual([]);
    expect(loadChest("鱼定土司府客卿偏仓").length).toBeGreaterThan(0);
  });
});

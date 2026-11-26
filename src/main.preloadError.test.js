// A2：vite:preloadError 兜底——首次触发刷新、30 秒内不重复、存储不可用不刷新只提示。
import { describe, expect, it, vi, beforeEach } from "vitest";

const load = async () => {
  vi.resetModules();
  return await import("./app/preloadErrorFallback.js");
};

const mkStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m };
};

describe("vite:preloadError 兜底", () => {
  beforeEach(() => { vi.resetModules(); });

  it("首次触发：preventDefault + 存档 + 刷新", async () => {
    const { installPreloadErrorFallback } = await load();
    const storage = mkStorage();
    const reload = vi.fn();
    const save = vi.fn();
    const h = installPreloadErrorFallback({ saveSnapshot: save, storage, reload, now: () => 100000 });
    const evt = { preventDefault: vi.fn() };
    h(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem("qucuo_preload_reload_at")).toBe("100000");
  });

  it("30 秒内第二次触发：不再刷新", async () => {
    const { installPreloadErrorFallback } = await load();
    const storage = mkStorage();
    const reload = vi.fn();
    let t = 100000;
    const h = installPreloadErrorFallback({ saveSnapshot: () => {}, storage, reload, now: () => t });
    const evt = { preventDefault: vi.fn() };
    h(evt);
    expect(reload).toHaveBeenCalledTimes(1);
    t += 10_000; // 10 秒后——仍在 30 秒窗内
    h(evt);
    expect(reload).toHaveBeenCalledTimes(1);
    t += 25_000; // 35 秒后——出窗再刷
    h(evt);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("存储不可用：不自动刷新，提示手动刷新", async () => {
    const { installPreloadErrorFallback } = await load();
    const reload = vi.fn();
    // node 环境无 DOM——最小桩 document 验证提示路径
    const appended = [];
    const fakeDoc = {
      getElementById: () => null,
      createElement: () => ({ id: "", style: {}, textContent: "" }),
      body: { appendChild: (el) => appended.push(el) },
    };
    const prevDoc = globalThis.document;
    globalThis.document = fakeDoc;
    try {
      const h = installPreloadErrorFallback({ saveSnapshot: () => {}, storage: null, reload });
      const evt = { preventDefault: vi.fn() };
      h(evt);
      expect(reload).not.toHaveBeenCalled();
      expect(appended).toHaveLength(1);
      expect(appended[0].textContent).toContain("版本已更新，请手动刷新页面");
    } finally {
      if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    }
  });
});

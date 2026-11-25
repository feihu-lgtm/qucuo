import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadStorageConfig, saveStorageConfig, getStorageDriver, setStorageDriver,
  configureCloudFetch, enqueueCloudPush, flushCloudQueue, getCloudQueue, getCloudRevs,
  getCloudConflicts, resolveCloudConflict, wipeCloudAll, mirrorSaveWrite, _resetCloudStateForTest,
} from "./storageDriver.js";

function mockLocalStorage() {
  const data = new Map();
  const ls = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => data.clear(),
    _data: data,
  };
  vi.stubGlobal("localStorage", ls);
  return ls;
}

const boundCfg = () => saveStorageConfig({ driver: "cloud", cloudUrl: "https://cloud.example.com", deviceId: "dev_t1", boundAt: 1 });

describe("storageDriver 配置与驱动切换", () => {
  beforeEach(() => { mockLocalStorage(); _resetCloudStateForTest(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); configureCloudFetch(null); });

  it("默认 local 档；非法档位拒绝", () => {
    expect(loadStorageConfig().driver).toBe("local");
    expect(getStorageDriver()).toBe("local");
    expect(setStorageDriver("bogus")).toBe(false);
    expect(setStorageDriver("cloud")).toBe(true);
    expect(getStorageDriver()).toBe("cloud");
    expect(loadStorageConfig().driver).toBe("cloud");
  });

  it("配置独立于 apiCfg，存 wuxia_mud_storage_config", () => {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://x", deviceId: "d", boundAt: 5 });
    const raw = JSON.parse(localStorage.getItem("wuxia_mud_storage_config"));
    expect(raw.cloudUrl).toBe("https://x");
    expect(raw.driver).toBe("cloud");
  });

  it("local 档镜像 no-op：不进云队列", () => {
    mirrorSaveWrite("autosave", { a: 1 });
    expect(getCloudQueue()).toEqual([]);
  });

  it("cloud 档写镜像入队，同键合并只留最新", () => {
    setStorageDriver("cloud");
    mirrorSaveWrite("autosave", { v: 1 });
    mirrorSaveWrite("autosave", { v: 2 });
    mirrorSaveWrite("slot:1", { v: 3 });
    const q = getCloudQueue();
    expect(q).toHaveLength(2);
    expect(q.find((e) => e.key === "autosave").value).toEqual({ v: 2 });
  });

  it("推送带递增 rev；成功后清空队列", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, body: JSON.parse(init.body || "{}"), method: init.method }); return { ok: true, status: 200 }; });
    enqueueCloudPush("autosave", { v: 1 });
    enqueueCloudPush("slot:1", { v: 2 });
    const r = await flushCloudQueue();
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].body.rev).toBe(1);
    expect(calls[1].body.rev).toBe(1); // 每键独立递增
    expect(calls[0].url).toContain("/saves/autosave");
    expect(getCloudQueue()).toEqual([]);
    // 同键再推 rev 递增
    enqueueCloudPush("autosave", { v: 9 });
    await flushCloudQueue();
    expect(calls[2].body.rev).toBe(2);
  });

  it("3 秒防抖：入队后不立即推，到期自动合批推送", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(init); return { ok: true, status: 200 }; });
    enqueueCloudPush("autosave", { v: 1 });
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3100);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("网络失败保留队列 + 指数退避重试，离线不丢", async () => {
    boundCfg();
    let n = 0;
    configureCloudFetch(async () => { n += 1; if (n < 3) throw new Error("offline"); return { ok: true, status: 200 }; });
    enqueueCloudPush("autosave", { v: 1 });
    const r1 = await flushCloudQueue();
    expect(r1.ok).toBe(false);
    expect(getCloudQueue()).toHaveLength(1);
    // 退避 1s 后自动重试仍失败，再翻倍
    await vi.advanceTimersByTimeAsync(1100);
    expect(n).toBe(2);
    await vi.advanceTimersByTimeAsync(2100);
    expect(n).toBe(3);
    expect(getCloudQueue()).toEqual([]);
  });

  it("409 绝不静默覆盖：进冲突登记，不再重试；裁决 keep_local 才带 force 覆盖", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => {
      const body = JSON.parse(init?.body || "{}");
      calls.push(body);
      return body.force ? { ok: true, status: 200 } : { ok: false, status: 409 };
    });
    enqueueCloudPush("slot:1", { v: "mine" });
    await flushCloudQueue();
    expect(getCloudConflicts()).toHaveLength(1);
    expect(getCloudQueue()).toEqual([]); // 冲突出队待裁决，不原地打转
    expect(calls.every((c) => !c.force)).toBe(true); // 无 force 覆盖发生
    // 玩家选本地覆盖 → 唯一合法 force 路径
    expect(resolveCloudConflict("slot:1", "keep_local")).toBe(true);
    expect(getCloudConflicts()).toEqual([]);
    await vi.advanceTimersByTimeAsync(3100);
    await flushCloudQueue();
    expect(calls.some((c) => c.force === true && c.value?.v === "mine")).toBe(true);
  });

  it("裁决 keep_cloud 放弃推送、不再覆盖", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(JSON.parse(init?.body || "{}")); return { ok: false, status: 409 }; });
    enqueueCloudPush("slot:1", { v: "mine" });
    await flushCloudQueue();
    resolveCloudConflict("slot:1", "keep_cloud");
    await flushCloudQueue();
    expect(calls.every((c) => !c.force)).toBe(true);
  });

  it("flush 在飞互斥：并发重入返回 busy 不双 flush", async () => {
    vi.useRealTimers();
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(init); await new Promise((r) => setTimeout(r, 5)); return { ok: true, status: 200 }; });
    enqueueCloudPush("autosave", { v: 1 });
    const [r1, r2] = await Promise.all([flushCloudQueue(), flushCloudQueue()]);
    expect([r1, r2].some((r) => r.reason === "busy")).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("keep_cloud 带 serverRev 时本地 rev 对齐，下次推送不再必然 409", async () => {
    vi.useRealTimers();
    boundCfg();
    configureCloudFetch(async () => ({ ok: false, status: 409, json: async () => ({ serverRev: 7 }) }));
    enqueueCloudPush("slot:1", { v: "mine" });
    await flushCloudQueue();
    resolveCloudConflict("slot:1", "keep_cloud");
    expect(getCloudRevs()["slot:1"]).toBe(7);
  });

  it("del 冲突 keep_local 走 force DELETE 不静默无效", async () => {
    vi.useRealTimers();
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, method: init.method }); return { ok: false, status: 409, json: async () => ({}) }; });
    enqueueCloudPush("slot:1", undefined, "del");
    await flushCloudQueue();
    configureCloudFetch(async (url, init) => { calls.push({ url, method: init.method }); return { ok: true, status: 200 }; });
    resolveCloudConflict("slot:1", "keep_local");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("force=1"))).toBe(true);
  });

  it("wipeCloudAll 调 DELETE /saves 并清空本地队列/rev/冲突；未绑定拒绝", async () => {
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, method: init.method }); return { ok: true, status: 200 }; });
    expect((await wipeCloudAll()).ok).toBe(false); // 未绑定
    boundCfg();
    enqueueCloudPush("autosave", { v: 1 });
    const r = await wipeCloudAll();
    expect(r.ok).toBe(true);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toMatch(/\/saves$/);
    expect(getCloudQueue()).toEqual([]);
    expect(getCloudRevs()).toEqual({});
    expect(getCloudConflicts()).toEqual([]);
  });
});

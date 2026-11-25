import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadStorageConfig, saveStorageConfig, getStorageDriver, setStorageDriver,
  configureCloudFetch, enqueueCloudPush, flushCloudQueue, getCloudQueue, getCloudRevs,
  getCloudConflicts, resolveCloudConflict, wipeCloudAll, mirrorSaveWrite, _resetCloudStateForTest,
} from "./storageDriver.js";
import { getServerRevs, _resetCloudProtocolForTest } from "./cloudProtocol.js";

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

// canonical 绑定三件套：cloudUrl(host)+spaceId+hubToken 缺一即 unbound
const boundCfg = () => saveStorageConfig({
  driver: "cloud", cloudUrl: "https://cloud.example.com", spaceId: "sp1", hubToken: "tok_test",
  deviceId: "dev_t1", boundAt: 1,
});
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });

describe("storageDriver 配置与驱动切换", () => {
  beforeEach(() => { mockLocalStorage(); _resetCloudStateForTest(); _resetCloudProtocolForTest(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); configureCloudFetch(null); });

  it("默认 local 档；非法档位拒绝", () => {
    expect(loadStorageConfig().driver).toBe("local");
    expect(getStorageDriver()).toBe("local");
    expect(setStorageDriver("bogus")).toBe(false);
    expect(setStorageDriver("cloud")).toBe(true);
    expect(getStorageDriver()).toBe("cloud");
  });

  it("local 档镜像 no-op：不进云队列", () => {
    mirrorSaveWrite("autosave", { a: 1 });
    expect(getCloudQueue()).toEqual([]);
  });

  it("cloud 档写镜像入队，同键合并只留最新", () => {
    setStorageDriver("cloud");
    mirrorSaveWrite("autosave", { v: 1 });
    mirrorSaveWrite("autosave", { v: 2 });
    const q = getCloudQueue();
    expect(q).toHaveLength(1);
    expect(q[0].value).toEqual({ v: 2 });
  });
});

describe("WO-19/20 PR-A canonical adapter", () => {
  beforeEach(() => { mockLocalStorage(); _resetCloudStateForTest(); _resetCloudProtocolForTest(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); configureCloudFetch(null); });

  it("首写 expectedRev=0，成功后 serverRev 台账记响应 rev；续写用台账值", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body || "{}"), method: init.method, headers: init.headers });
      return okJson({ rev: calls.length }); // 服务端权威 rev 1,2,3…
    });
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(calls).toHaveLength(1);
    expect(calls[0].body.expectedRev).toBe(0); // 首写 0
    expect(calls[0].body.rev).toBeUndefined(); // 本地计数器不上送
    expect(calls[0].body.value).toBeUndefined(); // 明文不上送
    expect(getServerRevs().autosave).toBe(1);
    // 续写：expectedRev 取台账 1
    enqueueCloudPush("autosave", { v: 2 });
    await flushCloudQueue();
    expect(calls[1].body.expectedRev).toBe(1);
    expect(getServerRevs().autosave).toBe(2);
  });

  it("payload 是 v1.iv.ct 密文串，不含明文内容", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(JSON.parse(init.body)); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { secretMarker: "绝密存档内容" });
    await flushCloudQueue();
    const payload = calls[0].payloadEnc;
    expect(typeof payload).toBe("string");
    expect(payload.startsWith("v1.")).toBe(true);
    expect(payload).not.toContain("绝密存档内容");
    expect(JSON.stringify(calls[0])).not.toContain("绝密存档内容");
  });

  it("token 必带：x-memory-hub-token 头随每请求；canonical URL 含 /api/spaces/<spaceId>", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, headers: init.headers }); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(calls[0].headers["x-memory-hub-token"]).toBe("tok_test");
    expect(calls[0].url).toBe("https://cloud.example.com/api/spaces/sp1/saves/autosave");
  });

  it("缺 spaceId/hubToken 任一即 unbound：队列原样保留不推不半通", async () => {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://cloud.example.com", deviceId: "d", boundAt: 1 });
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(init); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 1 });
    const r = await flushCloudQueue();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unbound");
    expect(calls).toHaveLength(0);
    expect(getCloudQueue()).toHaveLength(1); // 不丢不推
  });

  it("首次错位 409 自动对齐重推一次成功，不进冲突登记", async () => {
    boundCfg();
    let n = 0;
    const bodies = [];
    configureCloudFetch(async (url, init) => {
      n += 1;
      bodies.push(JSON.parse(init.body));
      if (n === 1) return { ok: false, status: 409, json: async () => ({ serverRev: 7, conflict: true }) };
      return okJson({ rev: 8 });
    });
    enqueueCloudPush("autosave", { v: 1 });
    const r = await flushCloudQueue();
    expect(r.ok).toBe(true);
    expect(n).toBe(2);
    expect(bodies[1].expectedRev).toBe(7); // 对齐服务端 rev 重推
    expect(getServerRevs().autosave).toBe(8);
    expect(getCloudConflicts()).toEqual([]); // 迁移错位不算冲突
  });

  it("真实多端冲突不静默：已有台账的键 409 直接进冲突登记，等玩家裁决", async () => {
    boundCfg();
    configureCloudFetch(async () => okJson({ rev: 3 }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(getServerRevs().autosave).toBe(3); // 有成功推送台账
    // 另一设备把服务端推到了 5——本端再推必 409
    configureCloudFetch(async () => ({ ok: false, status: 409, json: async () => ({ serverRev: 5, conflict: true }) }));
    enqueueCloudPush("autosave", { v: 2 });
    await flushCloudQueue();
    const conflicts = getCloudConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].key).toBe("autosave");
    expect(conflicts[0].serverRev).toBe(5);
  });

  it("DELETE 带 expectedRev；成功后台账清除", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ method: init.method, body: JSON.parse(init.body || "{}") }); return okJson({ rev: 4, deleted: 1 }); });
    enqueueCloudPush("autosave", { v: 1 }, "put");
    await flushCloudQueue();
    enqueueCloudPush("autosave", undefined, "del");
    await flushCloudQueue();
    const del = calls.find((c) => c.method === "DELETE");
    expect(del).toBeTruthy();
    expect(del.body.expectedRev).toBe(4); // 用台账值而非本地计数
    expect(getServerRevs().autosave).toBeUndefined();
  });

  it("force 只玩家裁决触发：自动 flush 绝不带 force；keep_local 裁决才带 force:true", async () => {
    boundCfg();
    const bodies = [];
    configureCloudFetch(async (url, init) => {
      bodies.push(JSON.parse(init.body || "{}"));
      if (bodies.length === 1) return { ok: false, status: 409, json: async () => ({ serverRev: 5 }) };
      return okJson({ rev: 6 });
    });
    // 先制造一个有台账后的真实冲突
    configureCloudFetch(async () => okJson({ rev: 3 }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    bodies.length = 0;
    configureCloudFetch(async (url, init) => {
      bodies.push(JSON.parse(init.body || "{}"));
      return { ok: false, status: 409, json: async () => ({ serverRev: 5 }) };
    });
    enqueueCloudPush("autosave", { v: 2 });
    await flushCloudQueue();
    expect(bodies.every((b) => !b.force)).toBe(true); // 自动流程绝不带 force
    expect(getCloudConflicts()).toHaveLength(1);
    // 玩家显式裁决「本地覆盖云端」
    bodies.length = 0;
    configureCloudFetch(async (url, init) => { bodies.push(JSON.parse(init.body || "{}")); return okJson({ rev: 6 }); });
    resolveCloudConflict("autosave", "keep_local");
    await vi.advanceTimersByTimeAsync(0);
    await vi.runAllTimersAsync();
    expect(bodies.some((b) => b.force === true)).toBe(true);
  });

  it("wipe 重写为 canonical DELETE /api/space/<spaceId>（单数无 saves 后缀）并带 token", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, headers: init.headers, method: init.method }); return okJson({ ok: true }); });
    const r = await wipeCloudAll();
    expect(r.ok).toBe(true);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe("https://cloud.example.com/api/space/sp1");
    expect(calls[0].headers["x-memory-hub-token"]).toBe("tok_test");
  });

  it("网络失败保留队列 + 退避重试，离线不丢", async () => {
    boundCfg();
    // 旗标式失败（不用计数）——模块加载 bootstrap/跨测试泄漏的额外 flush 不干扰确定性
    let fail = true;
    configureCloudFetch(async () => { if (fail) throw new Error("offline"); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(getCloudQueue()).toHaveLength(1); // 失败保留队列
    fail = false;
    for (let i = 0; i < 8 && getCloudQueue().length; i += 1) await vi.advanceTimersByTimeAsync(1500);
    expect(getCloudQueue()).toEqual([]); // 退避重试终成功
  });

  it("3 秒防抖：入队后不立即推，到期自动合批", async () => {
    boundCfg();
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push(init); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 1 });
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3100);
    // WebCrypto 加密链是真异步——vi.waitFor 自动交替推进定时器与微任务直到 fetch 发生
    await vi.waitFor(() => { expect(calls.length).toBeGreaterThan(0); }, { timeout: 2000, interval: 20 });
  });
});

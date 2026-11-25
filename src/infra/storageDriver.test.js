import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadStorageConfig, saveStorageConfig, getStorageDriver, setStorageDriver,
  configureCloudFetch, enqueueCloudPush, flushCloudQueue, getCloudQueue,
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
    expect(getServerRevs()["sp1::autosave"]).toBe(1);
    // 续写：expectedRev 取台账 1
    enqueueCloudPush("autosave", { v: 2 });
    await flushCloudQueue();
    expect(calls[1].body.expectedRev).toBe(1);
    expect(getServerRevs()["sp1::autosave"]).toBe(2);
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

  it("首次错位 409 也一律进冲突登记（裁决收紧：不自动对齐重推）", async () => {
    boundCfg();
    let n = 0;
    configureCloudFetch(async (url, init) => {
      n += 1;
      if (n === 1) return { ok: false, status: 409, json: async () => ({ serverRev: 7, conflict: true }) };
      return okJson({ rev: 8 });
    });
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(n).toBe(1); // 绝不自动重推——新设备误覆盖另一设备存档的代价不可逆
    const conflicts = getCloudConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].serverRev).toBe(7);
    // 台账不自动写——等玩家裁决：keep_cloud 才对齐，keep_local 走 force
    expect(getServerRevs()["sp1::autosave"]).toBeUndefined();
    // 玩家裁决 keep_cloud：台账对齐服务端 rev，后续续写以此为 expectedRev
    resolveCloudConflict("autosave", "keep_cloud");
    expect(getServerRevs()["sp1::autosave"]).toBe(7);
  });

  it("真实多端冲突不静默：已有台账的键 409 直接进冲突登记，等玩家裁决", async () => {
    boundCfg();
    configureCloudFetch(async () => okJson({ rev: 3 }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(getServerRevs()["sp1::autosave"]).toBe(3); // 有成功推送台账
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
    expect(getServerRevs()["sp1::autosave"]).toBeUndefined();
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
    await vi.waitFor(() => { expect(bodies.some((b) => b.force === true)).toBe(true); }, { timeout: 2000, interval: 20 });
  });

  it("Review 修：冲突登记带空间戳——换绑后旧空间冲突裁决作废，force 不打进新空间", async () => {
    boundCfg();
    configureCloudFetch(async () => ({ ok: false, status: 409, json: async () => ({ serverRev: 5 }) }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(getCloudConflicts()[0].spaceId).toBe("sp1");
    // 换绑 sp2 后裁决旧冲突——应作废，绝不向 sp2 发 force
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://cloud.example.com", spaceId: "sp2", hubToken: "tok2", deviceId: "dev_t1", boundAt: 2 });
    const calls = [];
    configureCloudFetch(async (url, init) => { calls.push({ url, body: JSON.parse(init?.body || "{}") }); return okJson({ rev: 1 }); });
    const acted = resolveCloudConflict("autosave", "keep_local");
    await vi.advanceTimersByTimeAsync(100);
    expect(acted).toBe(false);
    expect(calls.filter((c) => c.body.force)).toHaveLength(0);
    expect(getCloudConflicts()).toEqual([]); // 已出登记不残留
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

  it("初审返修：旧本地计数器键（wuxia_mud_cloud_revs）不继承——有旧值仍按无台账首写 expectedRev=0", async () => {
    boundCfg();
    // 旧 seam 遗产：本地递增计数器残留在旧键——绝不当服务端权威 rev
    localStorage.setItem("wuxia_mud_cloud_revs", JSON.stringify({ autosave: 5 }));
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push(JSON.parse(init.body)); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(bodies[0].expectedRev).toBe(0); // 不是 6
  });

  it("初审返修：旧键有值时 409 同样进冲突登记（无自动对齐特例）", async () => {
    boundCfg();
    localStorage.setItem("wuxia_mud_cloud_revs", JSON.stringify({ autosave: 5 }));
    configureCloudFetch(async () => ({ ok: false, status: 409, json: async () => ({ serverRev: 9 }) }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    const conflicts = getCloudConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].serverRev).toBe(9);
  });

  it("Review 修：换 space 后台账不串——旧空间 rev 不作新空间 CAS 依据", async () => {
    boundCfg();
    configureCloudFetch(async () => okJson({ rev: 4 }));
    enqueueCloudPush("autosave", { v: 1 });
    await flushCloudQueue();
    expect(getServerRevs()["sp1::autosave"]).toBe(4);
    // 换空间重绑——expectedRev 必须回 0，绝不拿旧空间 rev 当 CAS
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://cloud.example.com", spaceId: "sp2", hubToken: "tok2", deviceId: "dev_t1", boundAt: 2 });
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push({ url, body: JSON.parse(init.body) }); return okJson({ rev: 1 }); });
    enqueueCloudPush("autosave", { v: 2 });
    await flushCloudQueue();
    expect(bodies[0].body.expectedRev).toBe(0);
    expect(bodies[0].url).toContain("/api/spaces/sp2/");
    expect(getServerRevs()["sp2::autosave"]).toBe(1);
  });

  it("初审返修：wipe 发生在 fetch await 期间——响应返回后翻代停笔，不写台账", async () => {
    boundCfg();
    let resolvePut = null;
    configureCloudFetch(async (url, init) => {
      if (init.method === "PUT") return new Promise((res) => { resolvePut = res; }); // 悬住 PUT
      return okJson({ ok: true }); // wipe 的 DELETE /api/space 即刻成功
    });
    enqueueCloudPush("autosave", { v: 1 });
    const flushing = flushCloudQueue(); // 不 await——让 PUT 悬在飞
    await vi.waitFor(() => { expect(typeof resolvePut).toBe("function"); }, { timeout: 1000, interval: 10 });
    await wipeCloudAll(); // 翻代发生在 PUT 未返回期间
    resolvePut(okJson({ rev: 1 })); // 迟到的成功响应
    await flushing;
    expect(getServerRevs()["sp1::autosave"]).toBeUndefined(); // 台账不得写入已抹 rev
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
    // vi.waitFor 自动交替推进定时器与微任务——加密链/退避定时器时机在全量并行下不确定
    await vi.waitFor(() => { expect(getCloudQueue()).toEqual([]); }, { timeout: 8000, interval: 200 });
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

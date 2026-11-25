// WO-19/20 PR-B prose 上行/查询客户端测试
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { configureCloudFetch, hubQueryProse, hubBinding, _resetCloudProtocolForTest } from "./cloudProtocol.js";
import { enqueueProseUplink, flushProseUplink, getProseUplinkQueue, toCanonicalProseChunk, _resetProseUplinkForTest } from "./proseUplink.js";
import { saveStorageConfig } from "./storageDriver.js";

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

const BASE_CFG = { driver: "cloud", cloudUrl: "https://hub.example.com", spaceId: "sp1", hubToken: "tok-1" };

function boundCfg() { saveStorageConfig({ ...BASE_CFG }); }
function okJson(body) { return { ok: true, status: 200, json: async () => body }; }

function mkChunk(over = {}) {
  return {
    id: "b1_12_3",
    turn: 12,
    location: "曲措乡",
    witnesses: ["主角", "老孙"],
    entities: ["老孙"],
    rawText: "原文段落",
    publicText: "公开段落",
    seq: 3,
    branchId: "b1",
    importance: 2,
    anchorFactIds: ["F1_2"],
    ...over,
  };
}

beforeEach(() => {
  mockLocalStorage();
  vi.useFakeTimers();
  _resetCloudProtocolForTest();
  _resetProseUplinkForTest();
});
afterEach(() => { vi.useRealTimers(); });

describe("toCanonicalProseChunk 元数据映射", () => {
  it("branchId/seq/turn/witnesses 全映射 canonical，importance/anchorFactIds 不落", () => {
    const c = toCanonicalProseChunk(mkChunk());
    expect(c).toEqual({
      chunkId: "b1_12_3", turn: 12, location: "曲措乡",
      witnesses: ["主角", "老孙"], entities: ["老孙"],
      rawText: "原文段落", publicText: "公开段落", seq: 3, branchId: "b1",
    });
    expect(c.importance).toBeUndefined();
    expect(c.anchorFactIds).toBeUndefined();
  });
  it("缺 id/turn 的废段返回 null；缺 witnesses 补 [*]", () => {
    expect(toCanonicalProseChunk({ turn: 1 })).toBeNull();
    expect(toCanonicalProseChunk({ id: "x" })).toBeNull();
    expect(toCanonicalProseChunk(mkChunk({ witnesses: [] })).witnesses).toEqual(["*"]);
  });
});

describe("幂等与队列", () => {
  it("同 chunkId 重推不重复（队列内去重）", () => {
    enqueueProseUplink([mkChunk()]);
    enqueueProseUplink([mkChunk()]);
    expect(getProseUplinkQueue()).toHaveLength(1);
  });
  it("断网/5xx 失败条目留队，退避后重发", async () => {
    boundCfg();
    let calls = 0;
    configureCloudFetch(async () => { calls += 1; return { ok: false, status: 503, json: async () => ({}) }; });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(calls).toBeGreaterThanOrEqual(1);
    expect(getProseUplinkQueue()).toHaveLength(1); // 仍在队
    await vi.advanceTimersByTimeAsync(2100); // 退避 2s 后重试
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(getProseUplinkQueue()).toHaveLength(1);
  });
  it("网络异常（reject）同样留队重试", async () => {
    boundCfg();
    configureCloudFetch(async () => { throw new Error("offline"); });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(getProseUplinkQueue()).toHaveLength(1);
  });
  it("成功推送后出队；同 chunkId 再推服务端幂等兜底由 canonical 形状保证", async () => {
    boundCfg();
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push(JSON.parse(init.body)); return okJson({ inserted: 1 }); });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(getProseUplinkQueue()).toHaveLength(0);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].chunks[0].chunkId).toBe("b1_12_3");
    expect(bodies[0].chunks[0].rawText).toBe("原文段落"); // 明文上行（FTS 需要）
    expect(typeof bodies[0].batchId).toBe("string");
  });
  it("4xx 拒收丢弃不纠缠", async () => {
    boundCfg();
    configureCloudFetch(async () => ({ ok: false, status: 400, json: async () => ({ error: "bad" }) }));
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(getProseUplinkQueue()).toHaveLength(0);
  });
});

describe("绑定与鉴权", () => {
  it("三件套缺一 unbound 不发起任何请求，队列保留", async () => {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://hub.example.com" }); // 缺 spaceId/hubToken
    let calls = 0;
    configureCloudFetch(async () => { calls += 1; return okJson({}); });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toBe(0);
    expect(getProseUplinkQueue()).toHaveLength(1);
  });
  it("请求带 x-memory-hub-token 且打 canonical /api/spaces/<space>/prose", async () => {
    boundCfg();
    const seen = [];
    configureCloudFetch(async (url, init) => { seen.push({ url, headers: init.headers }); return okJson({ inserted: 1 }); });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://hub.example.com/api/spaces/sp1/prose");
    expect(seen[0].headers["x-memory-hub-token"]).toBe("tok-1");
  });
});

describe("查询客户端（纯 FTS）", () => {
  it("谱系过滤参数形状正确：lineage+currentTurn 直通，无任何 embedding 字段", async () => {
    const binding = hubBinding(BASE_CFG);
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push({ url, body: JSON.parse(init.body) }); return okJson({ hits: [] }); });
    const lineage = [{ b: "b1", upTo: null }, { b: "b0", upTo: 30, upToSeq: 4 }];
    await hubQueryProse(binding, { query: "老孙 打铁", viewer: "主角", lineage, currentTurn: 42, topK: 3 });
    expect(bodies).toHaveLength(1);
    expect(bodies[0].url).toBe("https://hub.example.com/api/spaces/sp1/prose/query");
    expect(bodies[0].body).toEqual({ query: "老孙 打铁", viewer: "主角", lineage, currentTurn: 42, topK: 3 });
    expect(bodies[0].body.queryEmbedding).toBeUndefined();
    expect(bodies[0].body.queryEmbeddingModel).toBeUndefined();
    expect(bodies[0].body.queryEmbeddingDim).toBeUndefined();
  });
  it("无谱系才退 maxTurn 宽松口径；两者不并出", async () => {
    const binding = hubBinding(BASE_CFG);
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push(JSON.parse(init.body)); return okJson({ hits: [] }); });
    await hubQueryProse(binding, { query: "x", viewer: "主角", maxTurn: 20 });
    expect(bodies[0]).toMatchObject({ maxTurn: 20 });
    expect(bodies[0].lineage).toBeUndefined();
    await hubQueryProse(binding, { query: "x", viewer: "主角", lineage: [{ b: "b1", upTo: null }], currentTurn: 9, maxTurn: 20 });
    expect(bodies[1].lineage).toBeDefined();
    expect(bodies[1].maxTurn).toBeUndefined();
  });
});

describe("密文/明文口径", () => {
  it("prose 路径不触碰存档加密密钥：明文上行但绝无 hub key 材料", async () => {
    boundCfg();
    const bodies = [];
    configureCloudFetch(async (url, init) => { bodies.push(JSON.parse(init.body)); return okJson({ inserted: 1 }); });
    enqueueProseUplink([mkChunk()]);
    await vi.advanceTimersByTimeAsync(1600);
    const raw = JSON.stringify(bodies[0]);
    expect(raw).toContain("原文段落"); // 明文（设计如此）
    expect(raw).not.toContain("v1."); // 不伪装成密文形状
    expect(localStorage.getItem("wuxia_mud_cloud_hub_key")).toBeNull(); // prose 路径不触发密钥生成
  });
});

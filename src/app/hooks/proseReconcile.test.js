import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { reconcileProseLineageAfterLoad } from "./proseReconcile.js";
import { addProseChunks, getAllProseChunks } from "../../infra/proseStore.js";
import { _resetMemoryDbForTest } from "../../infra/memoryDb.js";
import { gameStore, gameActions, getGameEpoch } from "../../store/gameStore.js";

// 谱系 reconcile 的端到端口径（fake IDB + 真 store）
describe("proseReconcile — 读档按需分叉", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
    gameActions.setProseLineage(undefined);
    gameActions.setProseSeq(undefined);
  });

  it("无谱系老档首读：建根分支 + convo 迁移进根分支可见", async () => {
    const snap = { time: 5, convo: [{ role: "assistant", content: "第一段。\n第二段。" }] };
    await reconcileProseLineageAfterLoad(snap, { epoch: getGameEpoch() });
    const st = gameStore.getState();
    expect(Array.isArray(st.proseLineage)).toBe(true);
    expect(st.proseLineage[0].upTo).toBeNull();
    const chunks = await getAllProseChunks();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].branchId).toBe(st.proseLineage[0].b);
    expect(Number.isFinite(chunks[0].seq)).toBe(true);
  });

  it("头分支无未来段：不分叉沿原分支", async () => {
    gameActions.setProseLineage([{ b: "bTest1", upTo: null }]);
    gameActions.setProseSeq(3);
    await addProseChunks([{ id: "bTest1_3_1", branchId: "bTest1", seq: 1, turn: 3, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "x", rawText: "x", importance: 1, anchorFactIds: [] }]);
    await reconcileProseLineageAfterLoad({ time: 5, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(1);
  });

  it("头分支有未来段：分叉、旧头截断、proseSeq 归零", async () => {
    gameActions.setProseLineage([{ b: "bTest2", upTo: null }]);
    gameActions.setProseSeq(9);
    await addProseChunks([{ id: "bTest2_8_1", branchId: "bTest2", seq: 1, turn: 8, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "x", rawText: "x", importance: 1, anchorFactIds: [] }]);
    await reconcileProseLineageAfterLoad({ time: 5, convo: [] }, { epoch: getGameEpoch() });
    const lin = gameStore.getState().proseLineage;
    expect(lin).toHaveLength(2);
    expect(lin[0].upTo).toBe(5);
    expect(lin[1].upTo).toBeNull();
    expect(gameStore.getState().proseSeq).toBe(0);
  });

  it("代次过期：reconcile 整体丢弃不写", async () => {
    gameActions.setProseLineage(undefined);
    await reconcileProseLineageAfterLoad({ time: 5, convo: [] }, { epoch: -999 });
    expect(gameStore.getState().proseLineage).toBeUndefined();
  });
});

describe("seq 粒度分叉（搭话 time 不递增）", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
    gameActions.setProseLineage(undefined);
    gameActions.setProseSeq(undefined);
  });

  it("同 turn 下 seq>快照proseSeq 判未来并分叉；旧分支 seq<=upToSeq 可见、超出不可见", async () => {
    gameActions.setProseLineage([{ b: "bSeq1", upTo: null }]);
    gameActions.setProseSeq(6);
    // 快照点 proseSeq=5/time=T=10；seq6 是快照后搭话写的（time 不递增仍为 10）
    await addProseChunks([
      { id: "bSeq1_10_5", branchId: "bSeq1", seq: 5, turn: 10, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "快照内", rawText: "x", importance: 1, anchorFactIds: [] },
      { id: "bSeq1_10_6", branchId: "bSeq1", seq: 6, turn: 10, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "快照后搭话", rawText: "x", importance: 1, anchorFactIds: [] },
    ]);
    await reconcileProseLineageAfterLoad({ time: 10, proseSeq: 5, convo: [] }, { epoch: getGameEpoch() });
    const lin = gameStore.getState().proseLineage;
    expect(lin).toHaveLength(2);
    expect(lin[0].upTo).toBe(10);
    expect(lin[0].upToSeq).toBe(5);
    // 可见性：旧分支 seq5 可见、seq6 不可见
    const { branchVisible } = await import("../../domain/rules/memory/lineage.js");
    expect(branchVisible({ branchId: "bSeq1", turn: 10, seq: 5 }, lin, 10)).toBe(true);
    expect(branchVisible({ branchId: "bSeq1", turn: 10, seq: 6 }, lin, 10)).toBe(false);
    expect(branchVisible({ branchId: "bSeq1", turn: 9, seq: 99 }, lin, 10)).toBe(true); // turn<upTo 恒可见
  });

  it("无 upToSeq 老数据兼容 turn<=upTo", async () => {
    const { branchVisible } = await import("../../domain/rules/memory/lineage.js");
    const lin = [{ b: "bX", upTo: 10 }, { b: "bY", upTo: null }];
    expect(branchVisible({ branchId: "bX", turn: 10, seq: 99 }, lin, 12)).toBe(true);
    expect(branchVisible({ branchId: "bX", turn: 11 }, lin, 12)).toBe(false);
  });
});

describe("reconcile-pending 闸门", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
    gameActions.setProseLineage(undefined);
    gameActions.setProseSeq(undefined);
  });

  it("pending 时 recall 保守空；完成后恢复", async () => {
    const { recallProse } = await import("../../engine/ports/recallBlock.js");
    const { setProseReconcilePending } = await import("../../infra/proseStore.js");
    let release;
    setProseReconcilePending(new Promise((r) => { release = r; }));
    const during = await recallProse({ queryText: "铸剑", viewer: "主角", unscoped: true });
    expect(during).toEqual([]);
    release();
    setProseReconcilePending(null);
  });

  it("写挂等闸完成后落到分叉后的新头分支", async () => {
    const { writeTurnProse } = await import("../../engine/act/proseWrite.js");
    const { addProseChunks, getAllProseChunks, setProseReconcilePending, waitProseReconcile } = await import("../../infra/proseStore.js");
    const { allocProseSeq } = await import("../../store/gameStore.js");
    // 分叉后的谱系就位（模拟 reconcile 已分叉），闸还挂着
    gameActions.setProseLineage([{ b: "bOld", upTo: 10, upToSeq: 5 }, { b: "bNew", upTo: null }]);
    gameActions.setProseSeq(0);
    let release;
    setProseReconcilePending(new Promise((r) => { release = r; }));
    writeTurnProse({
      narrativeText: "新时间线的正文第一段。", turn: 10, location: "新店",
      playerName: "主角", roomNpcNames: [], seqAlloc: allocProseSeq, addChunks: addProseChunks,
    });
    // 闸未开：库里应无写入
    await new Promise((r) => setTimeout(r, 20));
    expect((await getAllProseChunks()).length).toBe(0);
    release();
    setProseReconcilePending(null);
    await waitProseReconcile();
    await new Promise((r) => setTimeout(r, 20));
    const chunks = await getAllProseChunks();
    expect(chunks.length).toBe(1);
    expect(chunks[0].branchId).toBe("bNew"); // 新头，不是被截断的 bOld
  });
});

describe("gate token 清理", () => {
  it("两个 reconcile 重叠：旧 gate 先结束，新 gate 仍保持 pending", async () => {
    const { setProseReconcilePending, clearProseReconcilePending, isProseReconcilePending } = await import("../../infra/proseStore.js");
    const gate1 = Promise.resolve();
    setProseReconcilePending(gate1);
    const gate2 = Promise.resolve();
    setProseReconcilePending(gate2); // 第二次读档挂新闸
    clearProseReconcilePending(gate1); // 旧 reconcile finally——不得误清
    expect(isProseReconcilePending()).toBe(true);
    clearProseReconcilePending(gate2); // 新闸 owner 清理才生效
    expect(isProseReconcilePending()).toBe(false);
    clearProseReconcilePending(null);
  });
});

// ── WO-20D 跨设备恢复云探测 ────────────────────────────────────────
import { vi } from "vitest";
import { configureCloudFetch, _resetCloudProtocolForTest } from "../../infra/cloudProtocol.js";
import { saveStorageConfig } from "../../infra/storageConfig.js";

describe("WO-20D 云谱系探测分叉", () => {
  function mockLocalStorage() {
    const data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
      clear: () => data.clear(),
    });
  }
  const okJson = (body) => ({ ok: true, status: 200, json: async () => body });
  function boundCloud() {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://hub.example.com", spaceId: "sp1", hubToken: "tok" });
  }
  function seedLineageOnly() {
    // 谱系已在（非首读），但本设备该 branch 零本地段——模糊场景
    gameActions.setProseLineage([{ b: "bCloud1", upTo: null }]);
    gameActions.setProseSeq(4);
  }

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
    _resetCloudProtocolForTest();
    mockLocalStorage();
    gameActions.setProseLineage(undefined);
    gameActions.setProseSeq(undefined);
  });

  it("模糊场景+云探测 true→按 saveTime/saveSeq 分叉", async () => {
    seedLineageOnly();
    boundCloud();
    const fetchSpy = vi.fn(async () => okJson({ hasFuture: true }));
    configureCloudFetch(fetchSpy);
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toEqual({ branchId: "bCloud1", afterTurn: 5, afterSeq: 4 });
    const lin = gameStore.getState().proseLineage;
    expect(lin).toHaveLength(2);
    expect(lin[0].upTo).toBe(5);
    expect(lin[1].upTo).toBeNull();
  });

  it("模糊场景+云探测 false→不分叉", async () => {
    seedLineageOnly();
    boundCloud();
    configureCloudFetch(vi.fn(async () => okJson({ hasFuture: false })));
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(1);
  });

  it("模糊场景+探测失败（异常/非2xx）→保守分叉", async () => {
    seedLineageOnly();
    boundCloud();
    configureCloudFetch(vi.fn(async () => { throw new Error("down"); }));
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(2);
    // 复位再验非 2xx
    gameActions.setProseLineage([{ b: "bCloud1", upTo: null }]);
    configureCloudFetch(vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(2);
  });

  it("完整本地佐证（branch 有本地段且无未来）+探测失败→不分叉零请求", async () => {
    gameActions.setProseLineage([{ b: "bLocal1", upTo: null }]);
    gameActions.setProseSeq(3);
    await addProseChunks([{ id: "bLocal1_3_1", branchId: "bLocal1", seq: 1, turn: 3, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "x", rawText: "x", importance: 1, anchorFactIds: [] }]);
    boundCloud();
    const fetchSpy = vi.fn(async () => { throw new Error("down"); });
    configureCloudFetch(fetchSpy);
    await reconcileProseLineageAfterLoad({ time: 5, convo: [] }, { epoch: getGameEpoch() });
    expect(fetchSpy).not.toHaveBeenCalled(); // 有佐证不探测
    expect(gameStore.getState().proseLineage).toHaveLength(1);
  });

  it("local driver 零请求不分叉", async () => {
    seedLineageOnly();
    saveStorageConfig({ driver: "local" });
    const fetchSpy = vi.fn(async () => okJson({ hasFuture: true }));
    configureCloudFetch(fetchSpy);
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(gameStore.getState().proseLineage).toHaveLength(1);
  });

  it("坏形状 2xx（hasFuture 非 boolean）→按失败论处保守分叉", async () => {
    seedLineageOnly();
    boundCloud();
    configureCloudFetch(vi.fn(async () => okJson({}))); // 2xx 但无 hasFuture
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(2);
    // 字符串 "true" 也不算 boolean
    gameActions.setProseLineage([{ b: "bCloud1", upTo: null }]);
    configureCloudFetch(vi.fn(async () => okJson({ hasFuture: "true" })));
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    expect(gameStore.getState().proseLineage).toHaveLength(2);
  });

  it("探测超时（挂起）→保守分叉不阻断", async () => {
    seedLineageOnly();
    boundCloud();
    vi.useFakeTimers();
    configureCloudFetch(vi.fn(() => new Promise(() => {})));
    const p = reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: getGameEpoch() });
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    vi.useRealTimers();
    expect(gameStore.getState().proseLineage).toHaveLength(2);
  });

  it("stale 代次：探测 true 也不写分叉", async () => {
    seedLineageOnly();
    boundCloud();
    configureCloudFetch(vi.fn(async () => okJson({ hasFuture: true })));
    await reconcileProseLineageAfterLoad({ time: 5, proseSeq: 4, convo: [] }, { epoch: -999 });
    expect(gameStore.getState().proseLineage).toHaveLength(1);
    expect(gameStore.getState().proseLineage[0].upTo).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { finalizeTurn } from "./finalizeTurn.js";
import { countProseChunks } from "../../infra/proseStore.js";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { _resetMemoryDbForTest } from "../../infra/memoryDb.js";

// commit 成功/失败两条路：写挂只能在事务成功后触发
describe("finalizeTurn 段落写挂触发点", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });
  const flush = () => new Promise((r) => setTimeout(r, 40));
  const mkCtx = (commitImpl) => ({
    commitDeps: () => ({}),
    commitRound: commitImpl,
    isStale: () => false,
    proseSink: undefined, // 走默认 proseChunkSink → fake IDB
    proseSeqAlloc: (n) => ({ branchId: "bF1", startSeq: 1 }),
    proseEpochGuard: () => false,
    bookkeep: false,
    setVarTree: () => {},
  });
  const turn = {
    prosePayload: {
      narrativeText: "一段定稿正文。", turn: 5, location: "x", playerName: "主角",
      roomNpcNames: [], isTalk: false, talkTarget: "", anchoredFacts: [],
    },
    p: {},
  };

  it("commit 成功且未 stale：写挂触发入库", async () => {
    await finalizeTurn({ ctx: mkCtx(() => ({})), trace: turnMonitor.start("test", { source: "test" }), turn, turnOpts: {}, opts: {}, setPhase: () => {} });
    await flush();
    expect(await countProseChunks()).toBe(1);
  });

  it("commit 抛错回滚：写挂不触发，库里零段", async () => {
    await expect(
      finalizeTurn({ ctx: mkCtx(() => { throw new Error("commit rollback"); }), trace: turnMonitor.start("test", { source: "test" }), turn, turnOpts: {}, opts: {}, setPhase: () => {} })
    ).rejects.toThrow("commit rollback");
    await flush();
    expect(await countProseChunks()).toBe(0);
  });

  it("commit 成功但结果 stale：写挂不触发", async () => {
    const ctx = { ...mkCtx(() => ({})), isStale: () => true };
    await finalizeTurn({ ctx, trace: turnMonitor.start("test", { source: "test" }), turn, turnOpts: {}, opts: {}, setPhase: () => {} });
    await flush();
    expect(await countProseChunks()).toBe(0);
  });
});

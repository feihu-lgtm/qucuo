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
  const mkCtx = (commitImpl, liveState) => ({
    commitDeps: () => ({}),
    commitRound: commitImpl,
    getGameState: () => liveState || { time: 11, room: { name: "新店", npcs: [{ name: "新掌柜" }] }, char: { name: "主角" } },
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


describe("post-commit 重算（复审 blocker）", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });
  const flush = () => new Promise((r) => setTimeout(r, 40));

  it("行动前 time=10/commit 后 11：落段 turn=11、新店 location、新店 NPC 进 witnesses", async () => {
    const ctx = {
      commitDeps: () => ({}),
      commitRound: () => ({}),
      // payload 是 commit 前快照：turn=10/旧店/旧 NPC——全部应被 post-commit 覆盖
      getGameState: () => ({ time: 11, room: { name: "新店", npcs: [{ name: "新掌柜" }] }, char: { name: "主角" } }),
      isStale: () => false,
      proseSeqAlloc: (n) => ({ branchId: "bF9", startSeq: 1 }),
      proseEpochGuard: () => false,
      bookkeep: false,
      setVarTree: () => {},
    };
    const turnPre = {
      prosePayload: {
        narrativeText: "移动到了新店。", turn: 10, location: "旧店", playerName: "主角",
        roomNpcNames: ["旧伙计"], isTalk: false, talkTarget: "", anchoredFacts: [],
      },
      p: {},
    };
    await finalizeTurn({ ctx, trace: turnMonitor.start("test", { source: "test" }), turn: turnPre, turnOpts: {}, opts: {}, setPhase: () => {} });
    await flush();
    const { getAllProseChunks } = await import("../../infra/proseStore.js");
    const all = await getAllProseChunks();
    expect(all).toHaveLength(1);
    expect(all[0].turn).toBe(11);
    expect(all[0].location).toBe("新店");
    expect(all[0].witnesses).toContain("新掌柜");
    expect(all[0].witnesses).not.toContain("旧伙计");
  });
});

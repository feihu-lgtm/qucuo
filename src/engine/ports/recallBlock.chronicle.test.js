// WO-25M 编年史索引：重大事件过滤塑形、幂等重发、断网降级、recallProse 按人物名召回。
import { describe, expect, it, beforeEach } from "vitest";
import { isChronicleMajor, chronicleChunkOf, recordWorldChronicle, recallProse } from "./recallBlock.js";
import { IDBFactory } from "fake-indexeddb";
import { getProseUplinkQueue, _resetProseUplinkForTest, flushProseUplink } from "../../infra/proseUplink.js";
import { getAllProseChunks } from "../../infra/proseStore.js";
import { _resetMemoryDbForTest } from "../../infra/memoryDb.js";

const majorEvent = {
  id: "wev_100_sq_a_sq_b", day: 4, turn: 100, kind: "编队冲突",
  text: "天都镇一带，茶马商队与黑风寨游骑遭遇交手，茶马商队占了上风。",
  district: "天都镇", knownDistricts: ["天都镇"], actors: ["镖头甲木"], entities: ["镖头甲木"],
};
const minorEvent = { id: "road_A01_99", day: 4, turn: 99, kind: "road", importance: 1, text: "小事", district: "天都镇" };
const importantRoad = { ...minorEvent, id: "road_B02_98", importance: 2, text: "大事" };

// node 环境无 localStorage——与 proseUplink.test.js 同口径打桩。
function stubLocalStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = stubLocalStorage();
  _resetMemoryDbForTest();
  globalThis.indexedDB = new IDBFactory();
  _resetProseUplinkForTest();
});

describe("WO-25M 编年史索引", () => {
  it("重大口径：importance>=2 或编队交手；小事不上板", () => {
    expect(isChronicleMajor(majorEvent)).toBe(true);
    expect(isChronicleMajor(importantRoad)).toBe(true);
    expect(isChronicleMajor(minorEvent)).toBe(false);
    expect(isChronicleMajor(null)).toBe(false);
  });

  it("塑形：一行短结构化摘要，witnesses 公开、entities 涉事、id 带 chron 前缀", () => {
    const c = chronicleChunkOf(majorEvent, { branchId: "br1", turn: 100 });
    expect(c.id).toBe("chron_wev_100_sq_a_sq_b");
    expect(c.witnesses).toEqual(["*"]);
    expect(c.entities).toContain("镖头甲木");
    expect(c.branchId).toBe("br1");
    expect(c.rawText).toContain("第4日");
    expect(c.rawText).toContain("天都镇");
    expect(c.rawText).toContain("占了上风");
  });

  it("记录入口：重大事件落本地段落库并自动进上行队列；小事不进", async () => {
    const n = await recordWorldChronicle([majorEvent, minorEvent], { branchId: "br1", turn: 100 });
    expect(n).toBe(1);
    const queue = getProseUplinkQueue();
    expect(queue.some((q) => q.chunkId.includes("chron_wev_100"))).toBe(true);
    expect(queue.some((q) => q.chunkId.includes("chron_road_A01"))).toBe(false);
  });

  it("幂等重发：同一事件重复记录不产生重复队列条目", async () => {
    await recordWorldChronicle([majorEvent], { branchId: "br1", turn: 100 });
    const first = getProseUplinkQueue().length;
    await recordWorldChronicle([majorEvent], { branchId: "br1", turn: 100 });
    expect(getProseUplinkQueue().length).toBe(first);
  });

  it("断网降级：未绑定/cloud 未配时 flush 零网络静默保留，队列不丢", async () => {
    await recordWorldChronicle([majorEvent], { branchId: "br1", turn: 100 });
    const before = getProseUplinkQueue().length;
    await flushProseUplink(); // 未绑定 → 直接 return，无网络
    expect(getProseUplinkQueue().length).toBe(before);
  });

  it("recallProse 按人物名召回编年史段", async () => {
    await recordWorldChronicle([majorEvent], { branchId: "br1", turn: 100 });
    const pool = await getAllProseChunks();
    expect(pool.some((c) => c.id === "chron_wev_100_sq_a_sq_b")).toBe(true);
    const hits = await recallProse({ queryText: "镖头甲木 交手", viewer: "镖头甲木", unscoped: true, currentTurn: 200 });
    expect(hits.some((h) => String(h.text || "").includes("茶马商队"))).toBe(true);
  });
});

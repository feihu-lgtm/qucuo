import { describe, expect, it, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { addProseChunks, getProseChunksByTurn, getAllProseChunks, countProseChunks, migrateLegacyConvoAndNotes } from "./proseStore.js";
import { addMemory, getAllMemories } from "./memoryStore.js";
import { _resetMemoryDbForTest } from "./memoryDb.js";

beforeEach(() => {
  _resetMemoryDbForTest();
  globalThis.indexedDB = new IDBFactory();
});

describe("proseStore（fake-indexeddb）", () => {
  it("写入/按 turn 索引读回/计数", async () => {
    await addProseChunks([
      { id: "P7_1", kind: "raw_memory", turn: 7, location: "雪山派", witnesses: ["*"], entities: [], publicText: "甲", rawText: "甲", importance: 1, anchorFactIds: [] },
      { id: "P7_2", kind: "raw_memory", turn: 7, location: "雪山派", witnesses: ["*"], entities: [], publicText: "乙", rawText: "乙", importance: 1, anchorFactIds: [] },
      { id: "P9_1", kind: "raw_memory", turn: 9, location: "经堂", witnesses: ["*"], entities: [], publicText: "丙", rawText: "丙", importance: 1, anchorFactIds: [] },
    ]);
    expect(await countProseChunks()).toBe(3);
    const turn7 = await getProseChunksByTurn(7);
    expect(turn7).toHaveLength(2);
    expect((await getAllProseChunks()).length).toBe(3);
  });

  it("与 memories 同库共存：proseStore 先开也不妨碍 memoryStore 读写", async () => {
    // proseStore 先把库升到 v2，memoryStore 后开——共享 openMemoryDb 不会版本报错
    await addProseChunks([{ id: "P1_1", kind: "raw_memory", turn: 1, location: "", witnesses: ["*"], entities: [], publicText: "x", rawText: "x", importance: 1, anchorFactIds: [] }]);
    await addMemory({ id: "mem_1_x", text: "小纸条", turn: 1, visibility: "public", requiredFlag: null, entities: [], embedding: [], fingerprint: "t", createdAt: 1 });
    expect((await getAllMemories()).length).toBe(1);
    expect(await countProseChunks()).toBe(1);
  });
});

describe("migrateLegacyConvoAndNotes", () => {
  const snapshot = {
    time: 10,
    convo: [
      { role: "user", content: "北" },
      { role: "assistant", content: "第一段。\n\n第二段。" },
      { role: "user", content: "打招呼" },
      { role: "assistant", content: "第三段。" },
    ],
  };

  it("convo 无损转初始段落：原文一字不改、user 消息不迁、幂等", () => {
    const chunks = migrateLegacyConvoAndNotes(snapshot);
    expect(chunks.length).toBe(3); // 2+1 段
    expect(chunks[0].rawText).toBe("第一段。");
    expect(chunks[0].migrated).toBe(true);
    expect(chunks.every((c) => c.kind === "raw_memory")).toBe(true);
    expect(chunks.every((c) => c.witnesses.includes("*"))).toBe(true); // 老档无在场名单不编造
    // 幂等靠确定性 id：同一存档再迁一遍产出完全相同的 id 集合（put 覆盖不增生）
    const again = migrateLegacyConvoAndNotes(snapshot);
    expect(again.map((c) => c.id)).toEqual(chunks.map((c) => c.id));
  });

  it("小纸条一条一 chunk，owner 映射 witnesses", () => {
    const chunks = migrateLegacyConvoAndNotes({ time: 5, convo: [] }, {
      notes: [{ id: "mem_1", text: "呼延雪私下警告少侠", turn: 4, place: "雪山派", owner: [{ name: "呼延雪" }] }],
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].witnesses).toEqual(["呼延雪"]);
    expect(chunks[0].rawText).toBe("呼延雪私下警告少侠");
    expect(chunks[0].location).toBe("雪山派");
  });

  it("空档/坏档不炸", () => {
    expect(migrateLegacyConvoAndNotes(null)).toEqual([]);
    expect(migrateLegacyConvoAndNotes({})).toEqual([]);
  });
});

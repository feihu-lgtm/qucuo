import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";

// file 档整包导出/导入 + local 默认兼容（WO-19）
describe("saves file 档整包与 local 兼容", () => {
  beforeEach(() => {
    const data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
      clear: () => data.clear(),
    });
  });

  it("exportFullSave 含原文段落库；importSave 还原段落且幂等", async () => {
    const { addProseChunks, getAllProseChunks } = await import("./proseStore.js");
    await addProseChunks([{ id: "P1_1", turn: 1, seq: 1, branchId: "b1", publicText: "测试段落", witnesses: ["*"] }]);
    const { exportFullSave, importSave, loadSlot } = await import("./saves.js");
    const snap = { savedAt: 1, preset: { id: "p", name: "n" }, char: { hp: [1, 1] }, room: { name: "r" } };
    const text = await exportFullSave(snap, "测试");
    const parsed = JSON.parse(text);
    expect(parsed.kind).toBe("qucuo-save-export");
    expect(parsed.version).toBe(2);
    expect(parsed.prose.some((c) => c.id === "P1_1")).toBe(true);
    // 导入还原：段落进库（幂等 put），存档进槽位
    const before = (await getAllProseChunks()).length;
    const id = importSave(text);
    expect(loadSlot(id)?.preset?.id).toBe("p");
    await new Promise((r) => setTimeout(r, 30));
    const after = await getAllProseChunks();
    expect(after.length).toBe(before); // 同 id put 幂等不增生
    expect(after.some((c) => c.id === "P1_1")).toBe(true);
  });

  it("local 默认档行为不变：exportSave 同步单快照、importSave 兼容 v1 裸包", async () => {
    const { exportSave, importSave, loadSlot } = await import("./saves.js");
    const snap = { savedAt: 2, preset: { id: "p", name: "n" }, char: {}, room: {} };
    const v1 = exportSave(snap, "旧格式");
    expect(JSON.parse(v1).version).toBe(1);
    const id = importSave(v1);
    expect(loadSlot(id)).toBeTruthy();
  });
});

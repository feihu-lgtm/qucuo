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
    // 三路判重：同 id 同内容幂等跳过——不增生、原段不动
    const after = await getAllProseChunks();
    expect(after.length).toBe(before);
    expect(after.some((c) => c.id === "P1_1")).toBe(true);
    // 无冲突的新段落原样导入（保 branchId/谱系，召回不混排）
    const snap2 = { savedAt: 9, preset: { id: "p", name: "n" }, char: {}, room: {} };
    const text2 = JSON.stringify({ kind: "qucuo-save-export", version: 2, snapshot: snap2, prose: [{ id: "P7_3", turn: 7, seq: 3, branchId: "b9", publicText: "异机段落", witnesses: ["*"] }] });
    importSave(text2);
    await new Promise((r) => setTimeout(r, 30));
    const after2 = await getAllProseChunks();
    expect(after2.some((c) => c.id === "P7_3" && c.branchId === "b9")).toBe(true);
    // 同 id 异内容（跨设备分叉撞号）：加戳并存，绝不覆盖本机段落
    const text3 = JSON.stringify({ kind: "qucuo-save-export", version: 2, snapshot: { ...snap2, savedAt: 10 }, prose: [{ id: "P1_1", turn: 1, seq: 1, branchId: "b1", publicText: "别机版本", witnesses: ["*"] }] });
    importSave(text3);
    await new Promise((r) => setTimeout(r, 30));
    const after3 = await getAllProseChunks();
    expect(after3.find((c) => c.id === "P1_1")?.publicText).toBe("测试段落"); // 本机原段不被覆盖
    expect(after3.some((c) => c.id.startsWith("P1_1_imp") && c.publicText === "别机版本")).toBe(true);
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

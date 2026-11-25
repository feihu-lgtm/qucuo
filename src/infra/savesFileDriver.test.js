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
    // 分支一致重映射口径：导入段落 id/branchId 加确定性戳进导入私域——
    // 本机原段不动、谱系不串、重复导入幂等不增生
    const after = await getAllProseChunks();
    expect(after.length).toBe(before + 1);
    expect(after.find((c) => c.id === "P1_1")?.publicText).toBe("测试段落"); // 本机原段不被覆盖
    const imp = after.find((c) => c.id.startsWith("P1_1_imp"));
    expect(imp).toBeTruthy();
    expect(imp.branchId).toMatch(/^b1_imp/); // 分支同步入私域
    // 谱系一致重映射：槽位快照的 proseLineage 分支同步换戳——读入后召回可见且不串本机
    const { loadSlot: loadSlot2 } = await import("./saves.js");
    const snap2 = { savedAt: 9, preset: { id: "p", name: "n" }, char: {}, room: {}, proseLineage: [{ b: "b9", upTo: null }] };
    const text2 = JSON.stringify({ kind: "qucuo-save-export", version: 2, snapshot: snap2, prose: [{ id: "P7_3", turn: 7, seq: 3, branchId: "b9", publicText: "异机段落", witnesses: ["*"] }] });
    const id2 = importSave(text2);
    await new Promise((r) => setTimeout(r, 30));
    const stored = loadSlot2(id2);
    expect(stored.proseLineage[0].b).toMatch(/^b9_imp/);
    const after2 = await getAllProseChunks();
    expect(after2.find((c) => c.id.startsWith("P7_3_imp"))?.branchId).toBe(stored.proseLineage[0].b); // chunk 分支与谱系一致
    // 重复导入同一文件幂等（戳确定性，put 覆盖自身）
    importSave(text2);
    await new Promise((r) => setTimeout(r, 30));
    expect((await getAllProseChunks()).filter((c) => c.id.startsWith("P7_3_imp"))).toHaveLength(1);
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

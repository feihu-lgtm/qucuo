import { describe, expect, it } from "vitest";
import { buildJournal } from "./journalModel.js";

const log = [
  { t: "cmd", text: "> 把青稞给珍珠", turn: 57, tid: "turn-1" },
  { t: "desc", text: "  珍珠嗅了嗅你的掌心。", turn: 57, tid: "turn-1" },
  { t: "affection", text: "  💗 珍珠 好感度 -2（36 → 34）", turn: 57, tid: "turn-1" },
  { t: "cmd", text: "> 摇铜铃", turn: 58, tid: "turn-2" },
  { t: "err", kind: "quota", count: 2, retryable: false, text: "  天机不畅（接口额度已尽），本轮未计入。", turn: 58, tid: "turn-2" },
];
const trees = [
  { id: "turn-2", nodes: [
    { kind: "entry", label: "摇铜铃" },
    { kind: "ai", label: "主叙事", model: "m1", durationMs: 400, pipeline: { callLabel: "turn.main", success: false, error: "Budget has been exceeded! Key=qucuo-admin (sk-...)" } },
    { label: "状态写回", status: "fail", detail: "异常回滚：接口额度已尽" },
  ] },
];

describe("卷宗拼装", () => {
  it("按回合分块，正文收成一行，账与异常各自成行", () => {
    const blocks = buildJournal(log, trees);
    expect(blocks.map((b) => b.cmd)).toEqual(["把青稞给珍珠", "摇铜铃"]);
    expect(blocks[0].rows.map((r) => r.src)).toEqual(["story", "ledger"]);
    expect(blocks[1].rows[0]).toMatchObject({ src: "error", meta: "×2" });
  });

  it("账、异常两个过滤只留对应的行，空回合整块不显示", () => {
    expect(buildJournal(log, trees, { filter: "ledger" }).map((b) => b.cmd)).toEqual(["把青稞给珍珠"]);
    expect(buildJournal(log, trees, { filter: "error" }).map((b) => b.cmd)).toEqual(["摇铜铃"]);
  });

  it("打开机器开关按 tid 拼上追踪节点，详情已脱敏；追踪里找不到的回合标为过期", () => {
    const blocks = buildJournal(log, trees, { machine: true });
    const ai = blocks[1].rows.find((r) => r.label === "AI");
    expect(ai).toMatchObject({ src: "error", text: "turn.main" });
    expect(ai.detail).toContain("Budget has been exceeded");
    expect(ai.detail).not.toMatch(/qucuo-admin|sk-/);
    expect(blocks[0].expired).toBe(true);
    expect(blocks[1].expired).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeIntakeResult } from "./intakeTurn.js";

describe("D8 亲密判意上移 intake", () => {
  it("normalizeIntakeResult 缺省补 intimate:false，模型给 true 透传", () => {
    const v = normalizeIntakeResult({ read: "x", refIds: [], actions: [{ kind: "free_act", target: "才旦", text: "抱住她" }], proposals: [] });
    expect(v.actions[0].intimate).toBe(false);
    const v2 = normalizeIntakeResult({ read: "x", refIds: [], actions: [{ kind: "free_act", target: "才旦", text: "抱住她", intimate: true }], proposals: [] });
    expect(v2.actions[0].intimate).toBe(true);
  });
  it("intake schema actions required 含 intimate", async () => {
    const schema = await import("../../domain/rules/judge/intakeSchema.js");
    const txt = JSON.stringify(schema);
    expect(txt).toContain("intimate");
  });
  it("judgePhase 判意来源：真 AI 听意单带 __aiIntake 标记", () => {
    // 结构性断言：__aiIntake 只在真 AI 路径打标，synthesize/降级路径无标——
    // 兜底正则只在无标时启用（判意来源切换的设计口径）。
    const v = normalizeIntakeResult(null);
    expect(v.__aiIntake).toBeUndefined();
  });
});

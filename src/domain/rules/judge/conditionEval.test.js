import { describe, it, expect } from "vitest";
import { evaluateActionCondition, conditionUnmetNote, conditionMetNote } from "./conditionEval.js";

const base = {
  encounter: null, moved: false, roomName: "鱼定村", innerRoomName: "村口",
  visibleNpcs: [{ name: "才旦" }], lastActionOutcome: { rejected: false, kind: "", target: "" },
};
const act = (condition, condition_text = "", extra = {}) => ({
  kind: "inspect_container", text: "翻灶台", condition, condition_text, ...extra,
});

describe("D3 evaluateActionCondition 四类口径", () => {
  it("无/空 condition 恒成立", () => {
    expect(evaluateActionCondition(act("无"), base).met).toBe(true);
    expect(evaluateActionCondition(act(""), base).met).toBe(true);
    expect(evaluateActionCondition({ kind: "x" }, base).met).toBe(true);
  });
  it("遇敌：有 encounter 才成立", () => {
    expect(evaluateActionCondition(act("遇敌"), { ...base, encounter: { name: "黑风贼" } }).met).toBe(true);
    const r = evaluateActionCondition(act("遇敌"), base);
    expect(r.met).toBe(false);
    expect(r.reason).toContain("未遇敌袭");
  });
  it("到达：未移动不成立；移动+地名匹配成立；地名不匹配不成立", () => {
    expect(evaluateActionCondition(act("到达"), base).met).toBe(false);
    expect(evaluateActionCondition(act("到达"), { ...base, moved: true }).met).toBe(true);
    // 文本含当前地名
    expect(evaluateActionCondition(act("到达", "到了村口"), { ...base, moved: true }).met).toBe(true);
    // 文本含别处地名
    const r = evaluateActionCondition(act("到达", "到了喇嘛庙"), { ...base, moved: true });
    expect(r.met).toBe(false);
    expect(r.reason).toContain("尚未抵达");
  });
  it("被拒：前序拒收信号为真才成立", () => {
    expect(evaluateActionCondition(act("被拒"), { ...base, lastActionOutcome: { rejected: true, kind: "give", target: "才旦" } }).met).toBe(true);
    const r = evaluateActionCondition(act("被拒"), base);
    expect(r.met).toBe(false);
    expect(r.reason).toContain("并未遭拒");
  });
  it("其他：无人/有人/有某人在三类可核验，其余保守不成立", () => {
    expect(evaluateActionCondition(act("其他", "要是没人"), { ...base, visibleNpcs: [] }).met).toBe(true);
    expect(evaluateActionCondition(act("其他", "要是没人"), base).met).toBe(false);
    expect(evaluateActionCondition(act("其他", "若有人"), base).met).toBe(true);
    expect(evaluateActionCondition(act("其他", "若有人"), { ...base, visibleNpcs: [] }).met).toBe(false);
    expect(evaluateActionCondition(act("其他", "有才旦在"), base).met).toBe(true);
    expect(evaluateActionCondition(act("其他", "有老孙在"), base).met).toBe(false);
    const vague = evaluateActionCondition(act("其他", "要是心情好"), base);
    expect(vague.met).toBe(false);
    expect(vague.reason).toContain("无法确证");
  });
  it("未知条件类型保守不成立", () => {
    expect(evaluateActionCondition(act("天黑"), base).met).toBe(false);
  });
  it("批注文案按工单原文", () => {
    const unmet = conditionUnmetNote(act("遇敌", "", { text: "拔刀" }), "本回合未遇敌袭");
    expect(unmet).toContain("条件未成立");
    expect(unmet).toContain("严禁写成已经动手或已经得手");
    expect(conditionMetNote(act("到达"))).toContain("条件已达成");
  });
});

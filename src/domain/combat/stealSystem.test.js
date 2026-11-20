import { describe, expect, it } from "vitest";
import {
  createAngryState,
  isNpcAngry,
  recordAngerAttempt,
  stealSuccessRate,
  tickAngryState,
} from "./stealSystem.js";

describe("讨饭手偷窃加成", () => {
  it("keeps the old formula by default and adds the optional bonus", () => {
    expect(stealSuccessRate(0, 0)).toBe(0.45);
    expect(stealSuccessRate(0, 0, 0.1)).toBe(0.55);
  });
});

describe("angry state attempts", () => {
  it("starts an empty attempt history and caps recorded attempts at ten", () => {
    const angryState = createAngryState("偷窃未遂", 10);
    expect(angryState.attempts).toEqual([]);

    const withAttempts = Array.from({ length: 11 }, (_, index) => ({
      kind: "talk",
      detail: String(index),
      time: index,
    })).reduce((state, attempt) => recordAngerAttempt(state, attempt), angryState);

    expect(withAttempts.attempts).toHaveLength(10);
    expect(withAttempts.attempts[0]).toEqual({ kind: "talk", detail: "1", time: 1 });
    expect(withAttempts.attempts.at(-1)).toEqual({ kind: "talk", detail: "10", time: 10 });
    expect(angryState.attempts).toEqual([]);
  });

  it("is a no-op for an inactive state", () => {
    const inactive = { active: false, attempts: [{ kind: "gift" }] };

    expect(recordAngerAttempt(inactive, { kind: "talk", time: 1 })).toBe(inactive);
    expect(recordAngerAttempt(null, { kind: "talk", time: 1 })).toBeNull();
  });

  it("preserves attempts while ticking and when anger escalates", () => {
    const attempts = [{ kind: "gift", detail: "青稞饼", time: 10 }];
    const active = { active: true, reason: "偷窃未遂", turnsLeft: 2, attempts };

    expect(tickAngryState(active)).toEqual({ ...active, turnsLeft: 1 });
    expect(tickAngryState({ ...active, turnsLeft: 1 })).toEqual({
      ...active,
      active: false,
      escalated: true,
      turnsLeft: 1,
    });
  });

  it("checks anger by NPC name", () => {
    const varTree = { 角色: { 商人: { 生气状态: { active: true } }, 师父: { 生气状态: { active: false } } } };

    expect(isNpcAngry(varTree, "商人")).toBe(true);
    expect(isNpcAngry(varTree, "师父")).toBe(false);
    expect(isNpcAngry(varTree, "陌生人")).toBe(false);
  });
});

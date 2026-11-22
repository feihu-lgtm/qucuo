import { describe, expect, it } from "vitest";
import { isFreshTyped, shouldRecognize } from "./route.js";

describe("isFreshTyped", () => {
  it("counts typed input even though useTurn always adds schedulerManaged", () => {
    expect(isFreshTyped({ schedulerManaged: true })).toBe(true);
  });

  it("ignores NPC inspection, map clicks, auto-travel and intent-derived commands", () => {
    for (const flag of ["inspect", "forceLayer", "autoTravel", "intentPlan", "intentSkip", "silentCmd", "settle"]) {
      expect(isFreshTyped({ schedulerManaged: true, [flag]: true })).toBe(false);
    }
  });
});

describe("shouldRecognize", () => {
  const cfg = { intentRecognitionEnabled: true };

  it("classifies typed actions", () => {
    expect(shouldRecognize(cfg, "沿着溪边四处走走")).toBe(true);
  });

  it("skips quest steps whose event the system already decided", () => {
    expect(shouldRecognize(cfg, "❢ 村3·藏汉两姓的婚事", { forcedEvent: "鱼定大娘拉住你", keepUndo: true })).toBe(false);
  });
});

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

  it("skips recognition for pure intimate prose with no hard-action keyword", () => {
    expect(shouldRecognize(cfg, "（搂住亲嘴）（舌吻）我喜欢你（摸她的下面…）")).toBe(false);
    expect(shouldRecognize(cfg, "把她搂进怀里")).toBe(false);
  });

  it("still recognizes intimate text that also carries a hard action", () => {
    expect(shouldRecognize(cfg, "搂住她，再送她一壶酒")).toBe(true);
    expect(shouldRecognize(cfg, "亲了她一下，然后往北走")).toBe(true);
    expect(shouldRecognize(cfg, "我喜欢你，给她道歉")).toBe(true);
  });

  it("skips quest steps whose event the system already decided", () => {
    expect(shouldRecognize(cfg, "❢ 村3·藏汉两姓的婚事", { forcedEvent: "鱼定大娘拉住你", keepUndo: true })).toBe(false);
  });

  it("WO-16G-G2 裁决A：判官链激活时整链绕过 intent.classify，单调用老路不受影响", () => {
    const judgeCfg = { ...cfg, judgePipelineEnabled: true, extractionEnabled: true };
    // 复合自由行动——判官链下不再走行动识别闸（turn.intake 单链承担拆句）
    expect(shouldRecognize(judgeCfg, "先看看四周，然后把刀送给才旦，再跟他聊聊")).toBe(false);
    expect(shouldRecognize(judgeCfg, "沿着溪边四处走走")).toBe(false);
    // 单开关缺一——老路保留
    expect(shouldRecognize({ ...cfg, judgePipelineEnabled: true, extractionEnabled: false }, "沿着溪边四处走走")).toBe(true);
    expect(shouldRecognize({ ...cfg, judgePipelineEnabled: false, extractionEnabled: true }, "沿着溪边四处走走")).toBe(true);
    // 本地直达本就不识别——两路一致
    expect(shouldRecognize(judgeCfg, "n")).toBe(false);
  });
});

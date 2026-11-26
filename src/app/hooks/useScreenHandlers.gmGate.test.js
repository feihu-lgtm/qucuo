// Review 修钉死：GM/创造回合判官被 turnContext 关掉（extractionEnabled 派生 false），
// deferToJudge 若不看 gm 会 defer 了无人裁定——礼物/拜师永不落账。
// 接线断言：两处 defer 闸都必须带 GM 豁免。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("deferToJudge GM 豁免接线", () => {
  const src = readFileSync(new URL("./useScreenHandlers.js", import.meta.url), "utf8");
  it("defer 闸带 !gm 豁免且两处都在", () => {
    const gates = src.match(/deferToJudge = !![^;]+/g) || [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
    for (const g of gates) {
      expect(g).toContain("sessionUiStore.getState().gm");
    }
  });
});

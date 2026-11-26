import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// U1-3 Review 修：整屏舞台显式 blocking 标记纳入 hasBlockingLayer。
// hasBlockingLayer 依赖 DOM/getComputedStyle 无法纯测——结构断言钉死接线两端：
// 判定侧认 data-blocking-layer，舞台侧带标记。
describe("U1-3 Review 修：gamble-stage blocking 标记", () => {
  it("hasBlockingLayer 选择器与判定都认 data-blocking-layer", () => {
    const src = readFileSync("src/ui/components/faces/useFaceNavigation.js", "utf8");
    expect(src).toContain("[data-blocking-layer]");
    expect(src.match(/element\.matches\('[^']*data-blocking-layer[^']*'\)/)).toBeTruthy();
  });
  it("GambleStoneScreen 整屏舞台带 data-blocking-layer 标记", () => {
    const src = readFileSync("src/ui/screens/buildings/GambleStoneScreen.jsx", "utf8");
    expect(src).toContain('className="gamble-stage" data-blocking-layer');
  });
});

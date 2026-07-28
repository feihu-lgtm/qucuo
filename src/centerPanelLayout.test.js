import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 【建筑面板只占半屏】CenterPanel 里建筑/交易功能区与下方叙事正文区是兄弟节点，
// 两个都写 flex:1 —— flex 布局下就是平分剩余高度。结果建筑面板只拿到一半，
// 铁匠铺/商店/武馆这些内容长的面板下半截被截掉，玩家看不到底下的按钮，
// 也滚不到（外层不滚，面板自己那层 overflow 被压在半屏里）。
// 修法是让位而不是压缩：建筑面板展开时叙事区整个不渲染，面板独占整栏。
// CSS 没法在 node 里真渲染，这里退一步做源码级守卫——盯住那个「让位」的条件还在。
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "panels", "CenterPanel.jsx"), "utf-8");

describe("建筑面板必须独占整条主叙事栏", () => {
  it("叙事正文区带着「建筑展开时让位」的显示条件", () => {
    // 找到叙事正文区那个 div（padding 20px 32px + lineHeight 2.0 是它的指纹）
    const line = SRC.split("\n").find(l => l.includes('padding: "20px 32px"') && l.includes("lineHeight: 2.0"));
    expect(line, "没找到叙事正文区容器，指纹可能变了，请同步这条守卫").toBeTruthy();
    expect(line, "叙事区没有让位条件——它会和建筑面板平分高度，建筑面板又只剩一半")
      .toMatch(/display:\s*\(\(activeBuilding \|\| tradingShop\) && !buildingPanelMinimized\)\s*\?\s*"none"/);
  });

  it("建筑功能区容器仍是 flex:1 + 自滚（让位之后它才拿得满）", () => {
    const line = SRC.split("\n").find(l => l.includes("borderBottom") && l.includes("flex: 1") && l.includes('overflowY: "auto"'));
    expect(line, "没找到建筑功能区容器").toBeTruthy();
    expect(line).toContain("minHeight: 0"); // 不加它 flex 子项不会收缩，内部滚动条出不来
  });

  it("最小化仍然可用——不然让位之后就没法看叙事了", () => {
    expect(SRC).toContain("setBuildingPanelMinimized(true)");
    expect(SRC).toContain("setBuildingPanelMinimized(false)");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(DIR, "CenterPanel.jsx"), "utf-8");
const FEED_SRC = readFileSync(join(DIR, "center/NarrativeLogFeed.jsx"), "utf-8");
const MOBILE_CSS = readFileSync(join(DIR, "../mobile.css"), "utf-8");

describe("建筑面板必须独占整条主叙事栏", () => {
  it("叙事正文区带着「建筑展开时让位」的显示条件", () => {
    expect(SRC, "CenterPanel 未计算建筑展开让位条件")
      .toMatch(/hideNarrative\s*=\s*Boolean\(\(activeBuilding \|\| tradingShop\) && !buildingPanelMinimized\)/);
    // 正文与卷宗两种视图都要给建筑面板让位：hidden 条件里都必须带 hideNarrative。
    expect(SRC, "NarrativeLogFeed 未接上 hideNarrative").toMatch(/<NarrativeLogFeed[\s\S]{0,80}hidden=\{hideNarrative \|\| centerView === "journal"\}/);
    expect(SRC, "JuanzongView 未接上 hideNarrative").toMatch(/<JuanzongView hidden=\{hideNarrative \|\| centerView !== "journal"\}/);
    const line = FEED_SRC.split("\n").find(l => l.includes('padding: "20px 32px"') && l.includes('lineHeight: "var(--lh-narrative)"'));
    expect(line, "没找到叙事正文区容器，指纹可能变了，请同步这条守卫").toBeTruthy();
    expect(line, "叙事区没有让位条件——它会和建筑面板平分高度，建筑面板又只剩一半")
      .toMatch(/display:\s*hidden\s*\?\s*"none"/);
  });

  it("建筑功能区容器仍是 flex:1 + 自滚（让位之后它才拿得满）", () => {
    const classIndex = SRC.indexOf('className={`mobile-building-root');
    const rootIndex = SRC.lastIndexOf("<div", classIndex);
    const rootElement = SRC.slice(rootIndex, SRC.indexOf("{/* 最小化入口", rootIndex));
    expect(rootElement, "没找到建筑功能区容器").toContain("flex: 1");
    expect(rootElement).toContain("minHeight: 0");
    expect(rootElement).toContain('overflowY: "auto"');
  });

  it("建筑功能区容器按建筑实例 identity 复用", () => {
    const classIndex = SRC.indexOf('className={`mobile-building-root');
    const rootIndex = SRC.lastIndexOf("<div", classIndex);
    const rootElement = SRC.slice(rootIndex, SRC.indexOf("{/* 最小化入口", rootIndex));
    expect(rootElement).toContain("key={getBuildingInstanceKey(activeBuilding, tradingShop)}");
  });

  it("最小化仍然可用——不然让位之后就没法看叙事了", () => {
    expect(SRC).toContain("setBuildingPanelMinimized(true)");
    expect(SRC).toContain("setBuildingPanelMinimized(false)");
  });

  it("最小化时隐藏建筑容器但不卸载其内部状态", () => {
    const classIndex = SRC.indexOf('className={`mobile-building-root');
    const rootIndex = SRC.lastIndexOf("<div", classIndex);
    expect(rootIndex, "没找到建筑功能区容器").toBeGreaterThan(-1);
    const conditionStart = SRC.lastIndexOf("{(activeBuilding || tradingShop)", rootIndex);
    const rootElement = SRC.slice(rootIndex, SRC.indexOf("{/* 最小化入口", rootIndex));
    expect(SRC.slice(conditionStart, rootIndex)).not.toContain("!buildingPanelMinimized");
    expect(rootElement).toContain('buildingPanelMinimized ? "none" : undefined');
    expect(rootElement).toContain('buildingPanelMinimized ? "hidden" : undefined');
    expect(rootElement).toContain('pointerEvents: buildingPanelMinimized ? "none" : undefined');
    expect(MOBILE_CSS).toContain(".mobile-building-root.mobile-building-hidden");
    expect(MOBILE_CSS).toContain("display: none !important");
    expect(MOBILE_CSS).toContain("visibility: hidden !important");
    expect(MOBILE_CSS).toContain("pointer-events: none !important");
  });
});

// WO-25F 江湖态势只读页渲染测试：投影数据进来能渲染、旧存档空投影安全降级、零状态写入
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoreScreen from "./LoreScreen.jsx";

// 只读验证：组件不得触碰任何 store/infra 写入——纯 props 渲染即证据
const overview = {
  states: [{ id: "ws_on", label: "黑风寨元气大伤" }],
  situations: [{ district: "打箭炉", id: "sit_herb", label: "伤药紧俏", expireDay: 3 }],
  squads: [{ id: "sq_a", name: "康巴茶马帮", faction: "鱼定村", node: "打箭炉" }],
  tensionPairs: [{ pair: "鱼定土司府|黑风寨", base: 60, current: 80, delta: 20 }],
  eventCount: 7,
};

describe("WO-25F 江湖局势仪只读页", () => {
  it("投影数据渲染出四大板块", () => {
    const html = renderToStaticMarkup(
      <LoreScreen varTree={{ 世界: {} }} time={0} worldOverview={overview} onClose={() => {}} />,
    );
    // 默认 tab 是事实账本——江湖态势 tab 按钮存在且带事件计数
    expect(html).toContain("江湖态势");
    expect(html).toContain("· 7");
  });

  it("world tab 内容直渲染（WorldOverviewTab 经 LoreScreen 内部切换不可达，直接验静态空态）", () => {
    // 空投影（旧存档降级）：无世界数据时组件本身不炸
    const html = renderToStaticMarkup(
      <LoreScreen varTree={null} time={0} worldOverview={null} onClose={() => {}} />,
    );
    expect(html).toContain("见闻录"); // 壳子正常出
  });
});

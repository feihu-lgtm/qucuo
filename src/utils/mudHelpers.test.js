// W-FIX1：纯方向短令闸门回归测试——长句/复合句不得被 parseDir 秒结截胡，
// 必须完整放行进 runTurn 交前哨拆句+judgeRoutes 裁决（验收第 7/13 式）。
import { describe, it, expect } from "vitest";
import { isPureDirectionCmd, parseDir } from "./mudHelpers.js";

describe("isPureDirectionCmd 纯方向短令闸门", () => {
  it("验收第 7 式原句不被截胡：复合条件句后半截翻柜不被吞", () => {
    // 截胡证据前置断言：parseDir 裸调本来就会抢出 e
    expect(parseDir("往东走进铺子里，要是到了地方就把柜子翻开")).toBe("e");
    expect(isPureDirectionCmd("往东走进铺子里，要是到了地方就把柜子翻开")).toBe(false);
  });
  it("验收第 13 式原句不被截胡：带方位词的虚构地名不秒传", () => {
    expect(parseDir("往南边树林深处的忘忧谷走进去")).toBe("s");
    expect(isPureDirectionCmd("往南边树林深处的忘忧谷走进去")).toBe(false);
  });
  it("纯方向短令放行：中文/英文/复合八向", () => {
    for (const cmd of ["东", "往东", "n", "ne", "east", "去东北", "往西南", "上", "下"]) {
      expect(isPureDirectionCmd(cmd)).toBe(true);
    }
  });
  it("超六字长句不放行", () => {
    expect(isPureDirectionCmd("往东边走快一点")).toBe(false);
  });
  it("分句符（逗号/分号/空格）不放行", () => {
    expect(isPureDirectionCmd("往东走，然后翻柜子")).toBe(false);
    expect(isPureDirectionCmd("往东 走")).toBe(false);
    expect(isPureDirectionCmd("往东；翻柜")).toBe(false);
  });
  it("复合动作词不放行：要是/如果/万一/到了/顺便/看看/找/翻/若", () => {
    for (const cmd of ["往东看看", "往东找", "往东翻", "到了就走", "顺便往东"]) {
      expect(isPureDirectionCmd(cmd)).toBe(false);
    }
  });
  it("地名后缀不放行：去.+谷/堡/山", () => {
    expect(isPureDirectionCmd("去忘忧谷")).toBe(false);
    expect(isPureDirectionCmd("往东堡")).toBe(true); // 非「去/往+地名」结构的方向短令不受误伤
  });
  it("fromButton 直通：按钮/罗盘语义本来就是纯方向", () => {
    expect(isPureDirectionCmd("往东走进铺子里看看", { fromButton: true })).toBe(true);
    expect(isPureDirectionCmd("往东", { fromButton: true })).toBe(true);
  });
  it("句末标点剥离后仍按内容裁决", () => {
    expect(isPureDirectionCmd("往东。")).toBe(true);
    expect(isPureDirectionCmd("往东走进铺子里，要是到了就把柜子翻开。")).toBe(false);
  });
  it("空输入/空白不放行", () => {
    expect(isPureDirectionCmd("")).toBe(false);
    expect(isPureDirectionCmd("   ")).toBe(false);
  });
});

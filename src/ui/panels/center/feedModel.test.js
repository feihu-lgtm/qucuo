import { describe, expect, it } from "vitest";
import { createClockMarker, groupReplies, isRuleHint, isSystemFailure, ledgerText } from "./feedModel.js";

describe("时辰戳只标变化", () => {
  it("换时辰写全，同一时辰只写回合号，时间没走不写", () => {
    const mark = createClockMarker();
    expect(mark({ turn: 56 })).toEqual({ full: true, text: "第3日·辰初　第56回合" });
    expect(mark({ turn: 57 })).toEqual({ full: false, text: "第57回合" });
    expect(mark({ turn: 57 })).toBeNull();
    expect(mark({ turn: 58 })).toEqual({ full: true, text: "第3日·巳初　第58回合" });
    expect(mark({ text: "没有时间" })).toBeNull();
  });
});

describe("账目合行", () => {
  it("连着的得物、数值、好感行合成一个账目单元，正文单独成行", () => {
    const units = groupReplies([
      { t: "desc", text: "  正文" },
      { t: "item", text: "  你得到了「半袋青稞」" },
      { t: "affection", text: "  💗 珍珠 好感度 -2（36 → 34）" },
      { t: "sys", text: "  ※ 新人物出现 雪豹" },
      { t: "stat", text: "  气血 -12" },
    ]);
    expect(units.map((u) => u.kind)).toEqual(["entry", "ledger", "entry", "ledger"]);
    expect(units[1].entries).toHaveLength(2);
  });

  it("带操作、回执或流式中的条目不并入账目；战斗结算横条也不并", () => {
    const units = groupReplies([
      { t: "item", text: "  可点的物品", action: "看看" },
      { t: "affection", text: "  ◈ 雪豹 切磋 · 战斗结算" },
    ]);
    expect(units.every((u) => u.kind === "entry")).toBe(true);
  });

  it("账目文字去掉前导空白和装饰符号", () => {
    expect(ledgerText({ text: "  💗 珍珠 好感度 -2（36 → 34）" })).toBe("珍珠 好感度 -2（36 → 34）");
    expect(ledgerText({ text: "  ※ 得到「铜铃」" })).toBe("得到「铜铃」");
  });
});

describe("报错分两种", () => {
  it("带 kind 的是系统故障，不带的是玩法提示", () => {
    expect(isSystemFailure({ t: "err", kind: "quota" })).toBe(true);
    expect(isRuleHint({ t: "err", text: "潜能不足" })).toBe(true);
    expect(isSystemFailure({ t: "err", text: "潜能不足" })).toBe(false);
  });
});

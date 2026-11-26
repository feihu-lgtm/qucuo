import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 夜班虫②：亲密拒决信号必须透传——否则 refusal 漏进 finalize 无载荷炸 .room、
// 整体回滚连拒词扣好感都抹掉；playTurn 收口必须 ok:true 防 useTurn 误走异常回滚。
describe("夜班虫②：亲密拒止信号透传不回滚", () => {
  it("narrateTurn 透传 intimacyRefused 到外层", () => {
    const src = readFileSync("src/engine/turn/narrateTurn.js", "utf8");
    expect(src).toMatch(/if \(turn\.intimacyRefused\) return \{ turn, intimacyRefused: true \}/);
  });
  it("playTurn 拒决早退读外层信号且收口 ok:true——useTurn 不误判异常回滚", () => {
    const src = readFileSync("src/engine/playTurn.js", "utf8");
    expect(src).toMatch(/if \(narrated\.intimacyRefused\)/);
    expect(src).toContain("return { ok: true, done: true, intimacyRefused: true };");
    // useTurn 异常分支只看 !result.ok——ok:true 时拒决回合不出「整体回滚」错文案
    const useTurn = readFileSync("src/app/hooks/useTurn.js", "utf8");
    expect(useTurn).toMatch(/if \(!result\.ok\) \{/);
  });
});

describe("夜班双修 Review 修②：拒决回合时间照走", () => {
  it("playTurn 拒决早退前 setTime+1——用物耗时不白嫖", () => {
    const src = readFileSync("src/engine/playTurn.js", "utf8");
    const idx = src.indexOf("if (narrated.intimacyRefused)");
    const block = src.slice(idx, idx + 400);
    expect(block).toContain("setTime");
    expect(block.indexOf("setTime")).toBeLessThan(block.indexOf("return { ok: true"));
  });
});

describe("夜班三单 Review 0003：门禁修正目标回写动作", () => {
  it("judgePhase 门禁放行后回写无证据 intimate target——放行不签空账", () => {
    const src = readFileSync("src/engine/turn/judgePhase.js", "utf8");
    expect(src).toContain("a.target = gateName");
    // 只回写无 cmd 字面证据的 target——有证据错配留原样（多对象边缘不错账）
    expect(src).toMatch(/!String\(cmd\)\.includes\(a\.target\)/);
  });
});

describe("Review 修：多对象回合保守不回写", () => {
  it("回写只在全场仅一条 intimate 动作——多对象歧义宁签空不错账", () => {
    const src = readFileSync("src/engine/turn/judgePhase.js", "utf8");
    expect(src).toContain("intimateActs.length === 1");
  });
});

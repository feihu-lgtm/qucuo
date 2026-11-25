// 聊天语义好感（工单）：搭话回合的好感 mvu 经系统裁决——clamp -5~+8、
// forbidden/兽类跳过、0 变化不落账。语义判定本身由提取模型产 mvu，
// 这里验的是裁决层对三类输入形态的处理。
import { describe, it, expect } from "vitest";
import { applyWrite, add } from "./applyWrite.js";

const TALK_OPTS = { source: "mvu", talkRange: [-5, 8], charm: 5, time: 0 };
const vt = (favor = 50) => ({ 角色: { 阿妙: { 好感度: favor }, 铁伯: { 好感度: 10 } } });
const apply = (tree, cmd, opts = {}) => applyWrite({ varTree: tree }, cmd, { ...TALK_OPTS, ...opts });

describe("聊天好感裁决 · 三类输入", () => {
  it("夸：正向增量按裁决落账", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", 3));
    expect(r.state.varTree.角色.阿妙.好感度).toBe(53);
    expect(r.logs[0].text).toContain("+3");
  });
  it("骂：负向增量照落（不过日增闸）", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", -4));
    expect(r.state.varTree.角色.阿妙.好感度).toBe(46);
  });
  it("无关闲聊：0 变化整轮丢弃不记日志", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", 0));
    expect(r.reason).toContain("无实质变化");
    expect(r.state.varTree.角色.阿妙.好感度).toBe(50);
    expect(r.logs).toEqual([]);
  });
});

describe("聊天好感裁决 · clamp 与跳过", () => {
  it("超出区间截断：+20 → +8", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", 20));
    expect(r.state.varTree.角色.阿妙.好感度).toBe(58);
  });
  it("负向同样截断：-30 → -5", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", -30));
    expect(r.state.varTree.角色.阿妙.好感度).toBe(45);
  });
  it("_.set 也走 clamp：绕过 add 区间不成立", () => {
    const r = applyWrite({ varTree: vt() }, { op: "set", path: "角色.阿妙.好感度", value: 90 }, TALK_OPTS);
    expect(r.state.varTree.角色.阿妙.好感度).toBe(58); // 50 + 8
  });
  it("_.set 到 forbidden 也被拒", () => {
    const r = applyWrite({ varTree: vt() }, { op: "set", path: "角色.铁伯.好感度", value: 90 }, { ...TALK_OPTS, affectionSkip: new Set(["铁伯"]) });
    expect(r.reason).toContain("无好感轨道");
    expect(r.state.varTree.角色.铁伯.好感度).toBe(10);
  });
  it("forbidden 跳过：整轮拒绝、好感不动", () => {
    const r = apply(vt(), add("角色.铁伯.好感度", 6), { affectionSkip: new Set(["铁伯"]) });
    expect(r.reason).toContain("无好感轨道");
    expect(r.state.varTree.角色.铁伯.好感度).toBe(10);
  });
  it("无裁决参数（无 API/非搭话路径）：单次限幅 ±5，_.set 换算成同样限幅的增量", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", 12), { talkRange: undefined, affectionSkip: undefined });
    expect(r.state.varTree.角色.阿妙.好感度).toBe(55);
    const s = applyWrite({ varTree: vt() }, { op: "set", path: "角色.阿妙.好感度", value: 90 }, { source: "mvu" });
    expect(s.state.varTree.角色.阿妙.好感度).toBe(55);
  });
});

describe("裁决细节 · Review 修复", () => {

  it("_.set 半分扣减不被吃掉（留守衰减留下 .5）", () => {
    const tree = { 角色: { 阿妙: { 好感度: 50.5 } } };
    const r = applyWrite({ varTree: tree }, { op: "set", path: "角色.阿妙.好感度", value: 50 }, TALK_OPTS);
    expect(r.reason).toBeUndefined();
    expect(r.state.varTree.角色.阿妙.好感度).toBe(50);
  });
});


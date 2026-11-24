// 聊天语义好感（工单）：搭话回合的好感 mvu 经系统裁决——clamp -5~+8、
// forbidden/兽类跳过、0 变化不落账。语义判定本身由提取模型产 mvu，
// 这里验的是裁决层对三类输入形态的处理。
import { describe, it, expect } from "vitest";
import { applyWrite, add } from "./applyWrite.js";
import { EXTRACTION_SPECS } from "../prompt/extractionSpecs.js";

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
  it("无裁决参数（无 API/非搭话路径）：沿用旧 ±15 钳制，静默兼容", () => {
    const r = apply(vt(), add("角色.阿妙.好感度", 12), { talkRange: undefined, affectionSkip: undefined });
    expect(r.state.varTree.角色.阿妙.好感度).toBe(62);
  });
});

describe("TALK_CASUAL spec · 性情进上下文", () => {
  const state = {
    varTree: { 角色: { 阿妙: { 好感度: 50 }, 铁伯: { 好感度: 0 } } },
    room: {
      name: "茶肆", npcs: [
        { name: "阿妙", personality: "冷傲寡语", intimacy: { threshold: 70, style: "内敛" } },
        { name: "铁伯", intimacy: { forbidden: true } },
        { name: "雪豹", beast: true },
      ],
    },
  };
  it("在场者性情与界限注入提取提示", () => {
    const prompt = EXTRACTION_SPECS.TALK_CASUAL.user("你在跟阿妙说话", state, null, (t) => t);
    expect(prompt).toContain("在场者性情与界限");
    expect(prompt).toContain("冷傲寡语");
    expect(prompt).toContain("好感界限 70");
    expect(prompt).toContain("铁伯：不通人情");
    expect(prompt).toContain("雪豹：不通人情");
    expect(prompt).toContain("-5~+8");
  });
  it("无在场者提示词照常渲染", () => {
    const prompt = EXTRACTION_SPECS.TALK_CASUAL.user("narrative", { room: { npcs: [] }, varTree: {} }, null, (t) => t);
    expect(prompt).toContain("当前 NPC 关系");
    expect(prompt).not.toContain("在场者性情与界限");
  });
});

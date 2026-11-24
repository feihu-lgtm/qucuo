import { describe, it, expect, vi } from "vitest";

vi.mock("../../utils/rng.js", () => ({ random: () => 0 }));

const { intimacyGate, intimacyRefusal, intimacyPromptNote, ARCHETYPE_INTIMACY, stationedFavorDecayRule } = await import("./intimacy.js");
const { isIntimateInput, classifyIntent, INTENT } = await import("../prompt/inputIntent.js");

describe("intimacyGate · 默认门槛表", () => {
  it.each([["lustful", 25], ["opportunist", 40], ["eccentric", 45], ["gentle", 55], ["chivalrous", 65], ["proud", 75], ["devoted", 85]])("%s → %d", (arch, th) => {
    expect(intimacyGate({ name: "X", archetype: arch }, 0).threshold).toBe(th);
  });
  it("无 archetype 走 none 60", () => {
    expect(intimacyGate({ name: "路人" }, 0).threshold).toBe(ARCHETYPE_INTIMACY.none);
  });
  it("好感过线 unlocked，未过线 below_threshold", () => {
    expect(intimacyGate({ name: "X", archetype: "lustful" }, 25).unlocked).toBe(true);
    expect(intimacyGate({ name: "X", archetype: "lustful" }, 24).reason).toBe("below_threshold");
  });
});

describe("intimacyGate · 逐条覆盖", () => {
  it("朵朵显式 40 盖 eccentric 45", () => {
    expect(intimacyGate({ name: "元朵朵", archetype: "eccentric", intimacy: { threshold: 40, style: "娇憨仗义" } }, 40).unlocked).toBe(true);
    expect(intimacyGate({ name: "元朵朵", archetype: "eccentric", intimacy: { threshold: 40 } }, 44).unlocked).toBe(true);
  });
  it("forbidden 永不解锁（铁伯这类随从）", () => {
    const g = intimacyGate({ name: "铁伯", intimacy: { forbidden: true } }, 100);
    expect(g).toMatchObject({ unlocked: false, forbidden: true, reason: "forbidden" });
  });
});

describe("intimacyRefusal · 拒词扣分", () => {
  it("chivalrous 扣最狠（3-8），forbidden 不扣分", () => {
    const c = intimacyRefusal({ name: "侠", archetype: "chivalrous" });
    expect(c.loss).toBeGreaterThanOrEqual(3);
    expect(c.line).toContain("自重");
    expect(intimacyRefusal({ name: "铁伯", intimacy: { forbidden: true } }).loss).toBe(0);
  });
});

describe("intimacyPromptNote · 门槛注入", () => {
  it("已亲密：附 nsfw 段 + style", () => {
    const npc = { name: "曲艳丝", archetype: "lustful", nsfw: "身段描摹略", intimacy: { style: "冶艳撩人" } };
    const note = intimacyPromptNote(npc, 50);
    expect(note).toContain("已亲密");
    expect(note).toContain("冶艳撩人");
    expect(note).toContain("身段描摹略");
  });
  it("未亲密：写婉拒不写擦边；forbidden：从不", () => {
    expect(intimacyPromptNote({ name: "X", archetype: "proud" }, 10)).toContain("婉拒");
    expect(intimacyPromptNote({ name: "铁", intimacy: { forbidden: true } }, 99)).toContain("从不");
  });
});

describe("isIntimateInput · 指令族识别", () => {
  it.each(["亲吻元朵朵", "搂她入怀", "共赴巫山", "想跟她更进一步"])("命中: %s", (cmd) => {
    expect(isIntimateInput(cmd)).toBe(true);
  });
  it.each(["买东西", "跟她聊聊", "查看元朵朵"])("不命中: %s", (cmd) => {
    expect(isIntimateInput(cmd)).toBe(false);
  });
  it("行动模式分类成 INTIMATE 意图", () => {
    expect(classifyIntent("亲吻元朵朵")).toBe(INTENT.INTIMATE);
  });
});

describe("stationedFavorDecayRule · 留守衰减", () => {
  const companionState = {
    imported_朵朵: { unlocked: true, data: { name: "元朵朵" }, stationed: { district: "锦官城", roomId: "r1" } },
    imported_张三: { unlocked: true, data: { name: "张三" }, stationed: { district: "锦官城", roomId: "r2" } },
    imported_随行: { unlocked: true, data: { name: "随行" } },
  };
  const vt = { 角色: { 元朵朵: { 好感度: 50, 已亲密: true }, 张三: { 好感度: 50 } } };
  it("留守每日 -1，已亲密减半 -0.5", () => {
    const out = stationedFavorDecayRule.run({ time: 48, companionState, varTree: vt }, { firstRun: false });
    expect(out.changes.varTree).toBeTypeOf("function");
    const next = out.changes.varTree(vt);
    expect(next.角色.元朵朵.好感度).toBe(49.5);
    expect(next.角色.张三.好感度).toBe(49);
    expect(next.角色.随行).toBeUndefined();
  });
  it("无留守不动", () => {
    expect(stationedFavorDecayRule.run({ time: 48, companionState: {} }, { firstRun: false })).toBeNull();
  });
});

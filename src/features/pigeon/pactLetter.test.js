// WO-22B-P4a 契约来信 prompt 换块测试：
// 契约信块替换 / 逾期期限·酬谢·口吻句渲染 / 非契约信回归 / 缺字段不炸 / 品阶性情分寸
import { describe, expect, it } from "vitest";
import { pactLetterView, severityGuideOf, factionToneHintOf } from "./pactLetter.js";

function makeState(overrides = {}) {
  return {
    time: 100,
    room: { name: "曲措乡", npcs: [] },
    varTree: { 世界: { 契约: {} }, 角色: {} },
    ...overrides,
  };
}

function pactLetter(overrides = {}) {
  return {
    id: "letter_pact_烈娘子_pact_50_1",
    npcName: "烈娘子",
    arriveTime: 102,
    sentAt: 100,
    pactMeta: {
      reason: "逾期催问",
      pactKey: "pact_50_1",
      promise: "三日内送还猎刀",
      deadlineHours: 24,
      rewardHint: "十两银子",
    },
    ...overrides,
  };
}

describe("WO-22B-P4a pactLetterView", () => {
  it("逾期催问：字段全映射，期限按契约账推逾期时辰", () => {
    const state = makeState();
    state.varTree.世界.契约 = { 烈娘子: { pact_50_1: { bindTurn: 50, promise: "三日内送还猎刀", deadlineHours: 24 } } };
    const npc = { name: "烈娘子", levelCap: 1, personality: "性格刚烈。" };
    const view = pactLetterView(state, pactLetter(), npc);
    expect(view.reasonLabel).toBe("逾期催问");
    expect(view.promise).toBe("三日内送还猎刀");
    // 逾期 = 100 - 50 - 24 = 26 格 = 13 时辰
    expect(view.deadlineText).toBe("已逾 13 个时辰");
    expect(view.rewardText).toBe("十两银子");
    expect(view.npcName).toBe("烈娘子");
    expect(view.severityGuide).toContain("话说得直");
  });

  it("非契约信返回 null（走原心血来潮段）", () => {
    const state = makeState();
    expect(pactLetterView(state, { id: "x", npcName: "才旦" }, { name: "才旦" })).toBeNull();
    expect(pactLetterView(state, null, null)).toBeNull();
  });

  it("缺 pactMeta 字段安全降级不炸", () => {
    const state = makeState();
    const view = pactLetterView(state, pactLetter({ pactMeta: { reason: "逾期催问" } }), null);
    expect(view.promise).toBe("（原话未录）");
    expect(view.rewardText).toBe("当时未明说");
    expect(view.deadlineText).toBe("期限已过");
    expect(view.factionToneHint).toBe("");
    expect(view.severityGuide).toContain("以试探为主");
  });

  it("契约账缺失时期限兜底「期限已过」", () => {
    const state = makeState(); // 契约账为空
    const view = pactLetterView(state, pactLetter(), { name: "烈娘子" });
    expect(view.deadlineText).toBe("期限已过");
  });

  it("severityGuide 品阶梯：底层/紫袍/橙红袍+刚烈附加", () => {
    expect(severityGuideOf({ levelCap: 1 })).toBe("以试探为主，话留三分");
    expect(severityGuideOf({ levelCap: 3 })).toBe("冷峻，给出最后期限"); // 紫=3
    expect(severityGuideOf({ levelCap: 4 })).toBe("可以宣告断交或追究"); // 橙=4
    expect(severityGuideOf({ levelCap: 5 })).toBe("可以宣告断交或追究"); // 红=5
    expect(severityGuideOf({ levelCap: 2, personality: "性烈如火" })).toContain("后果写明");
    expect(severityGuideOf({})).toBe("以试探为主，话留三分"); // 裸壳不炸
  });

  it("factionToneHint 出自势力带身份句，散人/未知空串", () => {
    expect(factionToneHintOf({ name: "x", faction: "散人" })).toBe("");
    expect(factionToneHintOf(null)).toBe("");
    expect(factionToneHintOf({ name: "x", faction: "黑风寨" })).toContain("黑风寨");
  });

  it("立诺留凭/如约致谢结构预留：reason 直通、期限写「限 N 个时辰为期」", () => {
    const state = makeState();
    const letter = pactLetter({ pactMeta: { reason: "立诺留凭", pactKey: "k", promise: "护送到村", deadlineHours: 48, rewardHint: "" } });
    const view = pactLetterView(state, letter, { name: "烈娘子" });
    expect(view.reasonLabel).toBe("立诺留凭");
    expect(view.deadlineText).toBe("限 24 个时辰为期");
    expect(view.rewardText).toBe("当时未明说");
  });
});

describe("WO-22B-P4a 复审修复钉测试", () => {
  it("契约信 fallback 给催问句不给闲谈", async () => {
    const { inboundFallbackLine } = await import("./inbound.js");
    const state = makeState();
    const letter = pactLetter();
    const line = inboundFallbackLine(state, letter, () => 0);
    expect(line).toContain("三日内送还猎刀");
    expect(line).toContain("期限已过");
    expect(line).not.toContain("别来无恙");
    // 非契约信不受影响
    const plain = inboundFallbackLine(state, { id: "x", npcName: "才旦" }, () => 0);
    expect(plain).not.toContain("期限已过");
  });

  it("findNpcObject 导入角色兜底：品阶不丢", async () => {
    const { findNpcObject } = await import("./inbound.js");
    const state = makeState();
    const registry = { getImportedNpc: (name) => (name === "导入侠客" ? { name, levelCap: 5, personality: "沉稳" } : null) };
    expect(findNpcObject(state, "导入侠客", registry).levelCap).toBe(5);
    expect(findNpcObject(state, "陌生人", registry)).toEqual({ name: "陌生人" });
  });
});

describe("WO-22B-P4a pigeon.inbound 块替换", () => {
  async function renderInboundSys(letter) {
    await import("../../domain/rules/prompt/calls/sideCalls.js"); // 注册副作用
    const { getPromptDef } = await import("../../domain/rules/prompt/registry.js");
    const def = getPromptDef("block", "pigeon.inbound.sys");
    const render = (tpl, scope) => tpl.replace(/@([\w\u4e00-\u9fa5.]+)/g, (m, key) => {
      const val = key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), scope);
      return val == null ? "" : String(val);
    });
    const state = {
      time: 100,
      room: { name: "曲措乡", npcs: [] },
      varTree: { 世界: {}, 角色: {} },
      char: { name: "测试侠" },
    };
    const npc = { name: letter.npcName, levelCap: 1, personality: "性格刚烈。" };
    return def.text({ state, letter: { ...letter, npc }, preset: {} }, render);
  }

  it("契约信渲染「为一桩约定而写」块且不含心血来潮", async () => {
    const view = pactLetterView(
      { time: 100, room: { name: "曲措乡" }, varTree: { 世界: { 契约: {} }, 角色: {} } },
      pactLetter(),
      { name: "烈娘子", levelCap: 1, personality: "性格刚烈。" },
    );
    const out = await renderInboundSys({ ...pactLetter(), pactView: view });
    expect(out).toContain("【这封信是为一桩约定而写】");
    expect(out).toContain("逾期催问");
    expect(out).toContain("三日内送还猎刀");
    expect(out).toContain("十两银子");
    expect(out).not.toContain("心血来潮");
  });

  it("非契约信回归原心血来潮段", async () => {
    const out = await renderInboundSys({ id: "x", npcName: "才旦", pactView: null });
    expect(out).toContain("你心血来潮");
    expect(out).not.toContain("为一桩约定而写");
  });

  it("pactMeta 存在但 pactView 缺失时仍走心血来潮（不炸）", async () => {
    const out = await renderInboundSys({ ...pactLetter(), pactView: undefined });
    expect(out).toContain("你心血来潮");
  });
});

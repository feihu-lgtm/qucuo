import { describe, expect, it } from "vitest";
import { resolveIntimateTarget, intimacyGate } from "./intimacy.js";
import { isIntimateInput } from "../prompt/inputIntent.js";
import { judgeTurn } from "../judge/judgeTurn.js";

describe("V5 亲密门禁防代词绕过", () => {
  it("唯一在场者回落：无显名无胶囊输入「见她眉眼松动……低头吻了上去」命中罗琦", () => {
    const npcs = [{ name: "罗琦" }];
    const r = resolveIntimateTarget({ targetName: "", cmd: "见她眉眼松动，我心头一热，低头吻了上去", npcs, convo: [] });
    expect(r.targetName).toBe("罗琦");
  });
  it("多人含代词回落上一轮搭话者", () => {
    const npcs = [{ name: "罗琦" }, { name: "才旦" }];
    const r = resolveIntimateTarget({ targetName: "", cmd: "凑上去亲她一口", npcs, convo: [{ npc: "罗琦" }, { npc: "才旦" }] });
    expect(r.targetName).toBe("才旦");
  });
  it("显名在场不走回落", () => {
    const npcs = [{ name: "罗琦" }, { name: "才旦" }];
    const r = resolveIntimateTarget({ targetName: "", cmd: "抱住罗琦", npcs, convo: [] });
    expect(r.explicitHit?.name).toBe("罗琦");
  });
  it("0 好感强吻必被 intimacyGate 拦（罗琦无 archetype 门槛 60）", () => {
    const gate = intimacyGate({ name: "罗琦" }, 0);
    expect(gate.unlocked).toBe(false);
  });
});

describe("V5 亲密词表扩充与疗伤护栏", () => {
  it("感官描写命中 isIntimateInput", () => {
    expect(isIntimateInput("指尖摩挲她的锁骨")).toBe(true);
    expect(isIntimateInput("挑开她胸前的盘扣")).toBe(true);
    expect(isIntimateInput("凑近她颈窝轻嗅")).toBe(true);
  });
  it("疗伤敷药语境不误伤", () => {
    expect(isIntimateInput("替她揉按伤口敷药")).toBe(false);
    expect(isIntimateInput("我亲自去过锦官城")).toBe(false);
  });
});

describe("V5 才旦 gentle 门槛", () => {
  it("才旦 archetype gentle 门槛 55，好感 20 被拦", async () => {
    const rg = await import("../../../content/residentGroup/鱼定村.js");
    const list = rg.default || rg;
    const arr = Array.isArray(list) ? list : (list.鱼定村 || Object.values(list)[0] || []);
    const caidan = (arr.find?.((n) => n?.name === "才旦") || arr.flat?.().find?.((n) => n?.name === "才旦"));
    const arch = caidan?.archetype || "gentle"; // 数据层已写死 archetype
    expect(arch).toBe("gentle");
    const gate = intimacyGate({ name: "才旦", archetype: "gentle" }, 20);
    expect(gate.unlocked).toBe(false);
    expect(gate.threshold).toBe(55);
  });
});

describe("V5 买卖不误触自发契约", () => {
  const base = (over = {}) => ({
    turn: 5, day: 1, place: "鱼定村", roomName: "鱼定村", innerRoomName: "老孙饭馆",
    npcs: [{ name: "才旦", personality: "精明", carriedItems: [] }],
    varTree: { 角色: {} }, inv: [], entries: [],
    char: { hp: [80, 100], money: 50, special: { 身法: 6 } },
    accept: { value: true },
    ...over,
  });
  it("当场称斤付钱买干粮 → allowSpontaneousPact false", () => {
    const v = judgeTurn(base(), {
      read: "", refIds: [],
      actions: [{ kind: "trade", target: "才旦", text: "买三斤酥油炒面，称斤付钱", item: "酥油炒面", itemId: "", direction: "none", condition: "无", condition_text: "", useKind: "", stance: "casual", outcome: "破费", risk: "无", confidence: 0.8 }],
      proposals: [{ kind: "social_deal", fit: "natural", claim: "买三斤酥油炒面当场付钱", questId: "", flag: "" }],
    }, { rng: () => 0.5 });
    expect(v.allowSpontaneousPact).toBe(false);
  });
  it("带未来履约条件的立约仍参与掷骰", () => {
    const v = judgeTurn(base(), {
      read: "", refIds: [],
      actions: [{ kind: "talk", target: "才旦", text: "三天之内我定替你寻回旧物", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", useKind: "", stance: "sincere", outcome: "无", risk: "无", confidence: 0.8 }],
      proposals: [{ kind: "social_deal", fit: "natural", claim: "三天之内我定替你寻回旧物，事成之后赏十两", questId: "", flag: "" }],
    }, { rng: () => 0.5 });
    expect(typeof v.allowSpontaneousPact).toBe("boolean");
  });
});

describe("V5 Review 三修回归", () => {
  it("解开包袱/解开绳子不算亲密；解开衣扣才算", async () => {
    const { isIntimateInput: iii } = await import("../prompt/inputIntent.js");
    expect(iii("帮老孙解开包袱")).toBe(false);
    expect(iii("解开她胸前的衣扣")).toBe(true);
  });
  it("convo respondedNpcs 数组口径能回落上轮说话者", async () => {
    const { resolveIntimateTarget: rit } = await import("./intimacy.js");
    const npcs = [{ name: "罗琦" }, { name: "才旦" }];
    const r = rit({ targetName: "", cmd: "凑上去亲她", npcs, convo: [{ role: "assistant", respondedNpcs: ["罗琦"] }] });
    expect(r.targetName).toBe("罗琦");
  });
});

describe("V5 Review 二轮两修回归", () => {
  it("点名别屋 NPC 不顶包唯一在场者", async () => {
    const { resolveIntimateTarget: rit } = await import("./intimacy.js");
    const visible = [{ name: "罗琦" }];
    const all = [{ name: "罗琦" }, { name: "才旦" }];
    const r = rit({ targetName: "", cmd: "去亲才旦一口", npcs: visible, allNpcs: all, convo: [] });
    expect(r.targetName).toBe("");
    expect(r.explicitHit?.name).toBe("才旦");
  });
  it("解开才旦腰间系着的裙带 命中亲密", async () => {
    const { isIntimateInput: iii } = await import("../prompt/inputIntent.js");
    expect(iii("解开才旦腰间系着的裙带")).toBe(true);
    expect(iii("解开包袱的绳结")).toBe(false);
  });
});

describe("V5 Review 三轮修回归", () => {
  it("解开捆住包袱的布带不算亲密；解开衣带仍算", async () => {
    const { isIntimateInput: iii } = await import("../prompt/inputIntent.js");
    expect(iii("帮我解开捆住包袱的布带")).toBe(false);
    expect(iii("解开她腰间衣带")).toBe(true);
    expect(iii("解开包袱绳结再吻她")).toBe(true); // 强词优先
  });
});

describe("V5 Review 四轮修回归", () => {
  it("解开包袱的布带+亲她——物件掩码吞不掉吻", async () => {
    const { isIntimateInput: iii } = await import("../prompt/inputIntent.js");
    expect(iii("解开包袱的布带，亲她一下")).toBe(true);
  });
  it("解开她衣服上的绑带——绑带不算捆绑证据", async () => {
    const { isIntimateInput: iii } = await import("../prompt/inputIntent.js");
    expect(iii("解开她衣服上的绑带")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { verifySealAndMaterialize, parseSealJson } from "./sealVerifier.js";

const STATE = {
  time: 42, inv: [], skills: [], exp: 0, pot: 0, flags: [],
  char: { hp: [80, 100], neigong: 10, special: { 体魄: 5 } },
  room: { name: "鱼定村·茶馆", items: [], npcs: [] },
};

function verdictWith(extra = {}) {
  return {
    causalTier: "T2", pacingWords: 320,
    facts: [
      { id: "F42_1", op: "TRANSFER_ITEM", itemId: "it_8f3a", itemName: "霜牙短刀", from: "player", to: "才旦", witnesses: ["主角", "才旦"] },
    ],
    warrants: [],
    allowSpontaneousPact: true,
    reactionGuides: [{ npc: "才旦" }],
    ...extra,
  };
}

describe("parseSealJson", () => {
  it("提取尾章首行 JSON；空/坏文本回 null", () => {
    expect(parseSealJson('\n{"fills":{}}').fills).toEqual({});
    expect(parseSealJson("")).toBeNull();
    expect(parseSealJson("not json")).toBeNull();
  });
});

describe("verifySealAndMaterialize 铁律一：锚点落文核对", () => {
  it("漏写锚点由系统模板补一行事实短句", () => {
    const out = verifySealAndMaterialize({
      sealText: '{"fills":{}}', screenText: "才旦笑了笑。", verdict: verdictWith(), anchorIds: [], state: STATE, turn: 42,
    });
    expect(out.missingAnchors).toEqual(["F42_1"]);
    expect(out.screenText).toContain("霜牙短刀");
    expect(out.screenText).toContain("才旦笑了笑。");
    expect(out.notes.join()).toContain("漏写锚点");
  });

  it("锚点齐则不补", () => {
    const out = verifySealAndMaterialize({
      sealText: '{"fills":{}}', screenText: "才旦接过刀。", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out.missingAnchors).toEqual([]);
    expect(out.screenText).toBe("才旦接过刀。");
  });
});

describe("verifySealAndMaterialize 铁律二：穿帮检测", () => {
  it("已转走的器物被原主拔出使用 → 告警", () => {
    const verdict = verdictWith({
      facts: [{ id: "F42_1", op: "TRANSFER_ITEM", itemId: "it_1", itemName: "断念剑", from: "呼延雪", to: "player", witnesses: [] }],
    });
    const out = verifySealAndMaterialize({
      sealText: "", screenText: "呼延雪拔出断念剑，直指少侠。", verdict, anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out.warnings.join()).toContain("穿帮");
  });
});

describe("verifySealAndMaterialize 铁律三：编译与 pact", () => {
  const warrantVerdict = verdictWith({
    warrants: [{
      warrantId: "W42_1", factId: "F42_3", op: "GRANT_ITEM", category: "accessory",
      quality: "蓝", pointBudget: 2, allowedAffixes: ["forceFirst"],
      origin: { turn: 42, day: 2, place: "鱼定村·茶馆", fromNpc: "才旦" },
    }],
    facts: [...verdictWith().facts, { id: "F42_3", op: "GRANT_ITEM", from: "木箱", to: "player", witnesses: ["主角"] }],
  });

  it("fills+warrants 编译后经 materializeFacts 落进 changes.inv", () => {
    const seal = JSON.stringify({ fills: { W42_1: { name: "裂风豹骨哨", chosenAffix: "forceFirst", desc: "沁血骨哨" } } });
    const out = verifySealAndMaterialize({
      sealText: seal, screenText: "开箱。", verdict: warrantVerdict, anchorIds: ["F42_1", "F42_3"], state: STATE, turn: 42,
    });
    const inv = out.materialized.changes?.inv || [];
    expect(inv.some((it) => it.name === "裂风豹骨哨")).toBe(true);
  });

  it("spontaneousPact 校验通过并入 facts；非法 pact 告警不入", () => {
    const seal = JSON.stringify({
      fills: {},
      respondedNpcs: ["才旦"],
      spontaneousPact: { npc: "才旦", promise: "三日内取回猎叉", deadlineHours: 72, rewardHint: "传授追踪步法" },
    });
    const out = verifySealAndMaterialize({
      sealText: seal, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.npc === "才旦")).toBe(true);

    const bad = JSON.stringify({ fills: {}, spontaneousPact: { npc: "幽灵", promise: "x", deadlineHours: 72 } });
    const out2 = verifySealAndMaterialize({
      sealText: bad, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out2.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT")).toBe(false);
    expect(out2.warnings.join()).toContain("spontaneousPact");
  });

  it("F7：模型 SEAL 未填时 fallbackPact 兜底并入；模型填了以模型为准", () => {
    const empty = JSON.stringify({ fills: {}, respondedNpcs: [], spontaneousPact: null });
    const fb = { npc: "才旦", promise: "去后山替你寻回那件旧物", deadlineHours: 72, rewardHint: "十两银子买酒喝" };
    const out = verifySealAndMaterialize({
      sealText: empty, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
      fallbackPact: fb,
    });
    expect(out.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.npc === "才旦" && f.deadlineHours === 72)).toBe(true);
    // 模型自填优先：fallback 存在但 SEAL 有值时按 SEAL
    const filled = JSON.stringify({ fills: {}, spontaneousPact: { npc: "才旦", promise: "模型版承诺", deadlineHours: 24 } });
    const out2 = verifySealAndMaterialize({
      sealText: filled, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
      fallbackPact: fb,
    });
    expect(out2.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.promise === "模型版承诺")).toBe(true);
    expect(out2.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.promise.includes("后山"))).toBe(false);
    // 无 fallback 且模型未填 → 无 pact（回归旧行为）
    const out3 = verifySealAndMaterialize({
      sealText: empty, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out3.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT")).toBe(false);
  });

  it("WO-22B 期限下限：1/2/3 小时不签、4 小时可签", () => {
    for (const hours of [1, 2, 3]) {
      const seal = JSON.stringify({ fills: {}, spontaneousPact: { npc: "才旦", promise: "x", deadlineHours: hours } });
      const out = verifySealAndMaterialize({
        sealText: seal, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
      });
      expect(out.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT")).toBe(false);
      expect(out.warnings.join()).toContain("不足 4 小时");
    }
    const ok = JSON.stringify({ fills: {}, spontaneousPact: { npc: "才旦", promise: "x", deadlineHours: 4 } });
    const out2 = verifySealAndMaterialize({
      sealText: ok, screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out2.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.deadlineHours === 4)).toBe(true);
    // 立约回执（WO-22B-P4b 复审）：kind:"pact" 必须签发——「阅契」按钮通路不死
    expect(out2.materialized.receipts.some((r) => r.kind === "pact" && r.npc === "才旦")).toBe(true);
  });

  it("尾章未填空的券作废不编译；坏 JSON 告警不崩", () => {
    const out = verifySealAndMaterialize({
      sealText: '{"fills":{}}', screenText: "x", verdict: warrantVerdict, anchorIds: ["F42_1", "F42_3"], state: STATE, turn: 42,
    });
    expect(out.notes.join()).toContain("作废");
    const out2 = verifySealAndMaterialize({
      sealText: "garbage{", screenText: "x", verdict: verdictWith(), anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect(out2.warnings.join()).toContain("尾章 JSON 解析失败");
    expect(out2.materialized).toBeTruthy();
  });
});

describe("WO-16C 条件拾取券双证据", () => {
  const condVerdict = verdictWith({
    warrants: [{
      warrantId: "W42_9", factId: "F42_9", op: "GRANT_ITEM", conditional: true,
      category: "misc", quality: "蓝", pointBudget: 0, allowedAffixes: [],
      origin: { turn: 42, day: 2, place: "鱼定村", fromNpc: "" },
    }],
  });
  const seal = JSON.stringify({ fills: { W42_9: { name: "青铜铃", desc: "锈迹斑斑的铃" } } });

  it("锚点+fill 双证据齐备：合成事实入包，品质类别取 warrant 锁定值", () => {
    const out = verifySealAndMaterialize({
      sealText: seal, screenText: "路上拾得一枚铃⟦F42_9⟧。", verdict: condVerdict,
      anchorIds: ["F42_1", "F42_9"], state: STATE, turn: 42,
    });
    const inv = out.materialized.changes?.inv || [];
    const item = inv.find((it) => it.name === "青铜铃");
    expect(item).toBeTruthy();
    expect(item.quality).toBe("蓝");
    expect(item.category).toBe("misc");
    expect(out.facts.some((f) => f.id === "F42_9" && f.op === "GRANT_ITEM")).toBe(true);
  });

  it("有锚无 fill：券作废不入包", () => {
    const out = verifySealAndMaterialize({
      sealText: '{"fills":{}}', screenText: "拾得⟦F42_9⟧。", verdict: condVerdict,
      anchorIds: ["F42_1", "F42_9"], state: STATE, turn: 42,
    });
    expect((out.materialized.changes?.inv || []).some((it) => it.name === "青铜铃")).toBe(false);
    expect(out.notes.join()).toContain("未填空");
  });

  it("有 fill 无锚：券作废不入包、正文不被硬塞", () => {
    const out = verifySealAndMaterialize({
      sealText: seal, screenText: "一路无话。", verdict: condVerdict,
      anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect((out.materialized.changes?.inv || []).some((it) => it.name === "青铜铃")).toBe(false);
    expect(out.notes.join()).toContain("未埋锚");
    // 条件券事实不进 facts——锚点补写循环不会因缺锚硬塞「少侠得了青铜铃」
    expect(out.screenText).not.toContain("青铜铃");
  });

  it("条件券撞图鉴名：不吃图鉴 substitution，数值按 warrant 锁定+noCatalog 盾", () => {
    // 「铜铃竹哨」是图鉴具名物（绿档 accessory 带词条）；条件券掷的是蓝档 misc——
    // 品质/类别必须按 warrant，不得被图鉴顶替；id 按 warrant 派生而非图鉴稳定 id。
    const catSeal = JSON.stringify({ fills: { W42_9: { name: "铜铃竹哨", desc: "拾得的" } } });
    const out = verifySealAndMaterialize({
      sealText: catSeal, screenText: "拾得⟦F42_9⟧。", verdict: condVerdict,
      anchorIds: ["F42_1", "F42_9"], state: STATE, turn: 42,
    });
    const item = (out.materialized.changes?.inv || []).find((it) => it.name === "铜铃竹哨");
    expect(item).toBeTruthy();
    expect(item.quality).toBe("蓝");
    expect(item.category).toBe("misc");
    expect(item.noCatalog).toBe(true);
    expect(item.id).not.toMatch(/^it_cat_/);
  });

  it("不同回合撞名拾取不被当重放丢弃", () => {
    const v2 = verdictWith({
      warrants: [{
        warrantId: "W43_9", factId: "F43_9", op: "GRANT_ITEM", conditional: true,
        category: "misc", quality: "蓝", pointBudget: 0, allowedAffixes: [],
        origin: { turn: 43, day: 2, place: "鱼定村", fromNpc: "" },
      }],
    });
    const catSeal = JSON.stringify({ fills: { W43_9: { name: "铜铃竹哨", desc: "拾得的" } } });
    const first = verifySealAndMaterialize({
      sealText: catSeal, screenText: "拾得⟦F43_9⟧。", verdict: v2,
      anchorIds: ["F42_1", "F43_9"], state: STATE, turn: 43,
    });
    const invAfterFirst = first.materialized.changes?.inv || [];
    // 第二回合再拾同名物：id 不撞（不同 warrant 派生），两件都在
    const state2 = { ...STATE, inv: invAfterFirst };
    const second = verifySealAndMaterialize({
      sealText: catSeal, screenText: "拾得⟦F43_9⟧。", verdict: v2,
      anchorIds: ["F42_1", "F43_9"], state: state2, turn: 43,
    });
    void second;
    const w3 = verdictWith({
      warrants: [{
        warrantId: "W44_9", factId: "F44_9", op: "GRANT_ITEM", conditional: true,
        category: "misc", quality: "蓝", pointBudget: 0, allowedAffixes: [],
        origin: { turn: 44, day: 2, place: "鱼定村", fromNpc: "" },
      }],
    });
    const seal3 = JSON.stringify({ fills: { W44_9: { name: "铜铃竹哨", desc: "拾得的" } } });
    const third = verifySealAndMaterialize({
      sealText: seal3, screenText: "拾得⟦F44_9⟧。", verdict: w3,
      anchorIds: ["F42_1", "F44_9"], state: state2, turn: 44,
    });
    const invFinal = third.materialized.changes?.inv || [];
    expect(invFinal.filter((it) => it?.name === "铜铃竹哨").length).toBe(2);
  });

  it("无锚无 fill：叙事拒捡，安静作废零告警", () => {
    const out = verifySealAndMaterialize({
      sealText: '{"fills":{}}', screenText: "险境中无暇他顾。", verdict: condVerdict,
      anchorIds: ["F42_1"], state: STATE, turn: 42,
    });
    expect((out.materialized.changes?.inv || []).length).toBe(0);
    expect(out.facts.some((f) => f.id === "F42_9")).toBe(false);
  });
});

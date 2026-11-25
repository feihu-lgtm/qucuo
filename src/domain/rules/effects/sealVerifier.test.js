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

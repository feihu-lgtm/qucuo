import { describe, expect, it } from "vitest";
import {
  adaptPrepItemsForJudge, prepMaterialLines, buildPrepMaterialBlock, resolvePrepItemsForJudge,
} from "./prepConsumption.js";
import { createPrepSeed, prepStateVersion } from "./prepSeeds.js";
import { judgeTurn } from "../judge/judgeTurn.js";

function mkState(overrides = {}) {
  return {
    room: { name: "曲措客栈", npcs: [{ id: "a", name: "掌柜" }] },
    innerRoomName: null,
    time: 48,
    varTree: { 世界: {} },
    ...overrides,
  };
}

function mkSeed(state, kind, payload, overrides = {}) {
  return createPrepSeed({
    kind, turn: state.time, location: state.room.name,
    stateVersion: prepStateVersion(state), subject: payload?.npcName || "", seq: 1,
    payload, ...overrides,
  });
}

const ITEM_PAYLOAD = { containerId: "木箱", name: "油纸包着的旧伤药", category: "misc", quality: "绿", clue: "箱角露出一线油纸" };
const PLAN_PAYLOAD = { npcName: "掌柜", plan: "把赊账的老主顾名册理一遍", nextAction: "夜里去后院点数" };
const RUMOR_PAYLOAD = { text: "听说黑风寨昨夜里又折了个头目", faction: "黑风寨", nemesisId: "" };

describe("adaptPrepItemsForJudge", () => {
  it("prep_item 转 envelope 形状：保留 id/containerId/name/category/quality/clue/taken false", () => {
    const state = mkState();
    const seed = mkSeed(state, "prep_item", ITEM_PAYLOAD);
    const out = adaptPrepItemsForJudge(state, [seed]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: seed.id, containerId: "木箱", name: "油纸包着的旧伤药",
      category: "misc", quality: "绿", clue: "箱角露出一线油纸", taken: false,
    });
  });
  it("失效种子（跨日/换地）滤掉不送进判官", () => {
    const state = mkState();
    const seed = mkSeed(state, "prep_item", ITEM_PAYLOAD);
    expect(adaptPrepItemsForJudge(mkState({ time: 96 }), [seed])).toHaveLength(0);
    expect(adaptPrepItemsForJudge(mkState({ room: { name: "雪山派", npcs: [] } }), [seed])).toHaveLength(0);
  });
  it("坏 payload（缺 name）丢弃不炸", () => {
    const state = mkState();
    const bad = mkSeed(state, "prep_item", { containerId: "x" });
    expect(adaptPrepItemsForJudge(state, [bad])).toHaveLength(0);
    expect(() => adaptPrepItemsForJudge(state, [null, {}, "junk"])).not.toThrow();
  });
  it("非 prep_item 类型不进物件池", () => {
    const state = mkState();
    const seed = mkSeed(state, "tavern_rumor", RUMOR_PAYLOAD);
    expect(adaptPrepItemsForJudge(state, [seed])).toHaveLength(0);
  });
});

describe("prepMaterialLines/buildPrepMaterialBlock", () => {
  it("npc_plan/tavern_rumor 渲染 deterministic 文本行", () => {
    const state = mkState();
    const seeds = [mkSeed(state, "npc_plan", PLAN_PAYLOAD, { subject: "掌柜" }), mkSeed(state, "tavern_rumor", RUMOR_PAYLOAD)];
    const lines = prepMaterialLines(state, seeds);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("掌柜");
    expect(lines[0]).toContain("名册");
    expect(lines[1]).toContain("黑风寨");
    // 同输入同输出
    expect(prepMaterialLines(state, seeds)).toEqual(lines);
  });
  it("注入块带非事实警示，无素材零注入", () => {
    const state = mkState();
    expect(buildPrepMaterialBlock(state, [])).toBe("");
    const block = buildPrepMaterialBlock(state, [mkSeed(state, "tavern_rumor", RUMOR_PAYLOAD)]);
    expect(block).toContain("不是既定事实");
    expect(block).toContain("可用可不用");
  });
  it("只滤当前 state 有效种", () => {
    const state = mkState();
    const seed = mkSeed(state, "tavern_rumor", RUMOR_PAYLOAD);
    expect(prepMaterialLines(mkState({ time: 96 }), [seed])).toHaveLength(0);
  });
});

describe("判官消费 prep_item（仍在既有管线钳制内）", () => {
  function judgeWithPrep(prepItems) {
    return judgeTurn({
      turn: 48, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 世界: {} }, inv: [], entries: [],
      containers: { 木箱: { collapsed: false, presetItems: [] } }, containerPlace: "曲措客栈",
      prepItems,
      budget: { maxPointBudget: 0, maxQuality: "白", luck: 0, riskLevel: 0 },
    }, {
      read: "", refIds: [],
      actions: [{ kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual", text: "翻木箱" }],
      proposals: [],
    }, { rng: () => 0.99 });
  }
  it("有备料物件时翻容器直签 GRANT_ITEM（第二关），不走天机券", () => {
    const verdict = judgeWithPrep([{ id: "prep_x_1", containerId: "木箱", name: "旧伤药", quality: "绿", category: "misc", clue: "油纸角", taken: false }]);
    const grant = (verdict.facts || []).find((f) => f.op === "GRANT_ITEM");
    expect(grant).toBeTruthy();
    expect(grant.itemName).toBe("旧伤药");
    expect(verdict.warrants || []).toHaveLength(0); // 备料直签不产空白券
  });
  it("taken=true 或缺失时不发——备料绝不凭空掉背包", () => {
    const v1 = judgeWithPrep([{ id: "p", containerId: "木箱", name: "旧伤药", taken: true }]);
    expect((v1.facts || []).filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    const v2 = judgeWithPrep([]);
    expect((v2.facts || []).filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
  });
  it("resolvePrepItemsForJudge 是真实/影子同一入口", () => {
    const state = mkState();
    const seed = mkSeed(state, "prep_item", ITEM_PAYLOAD);
    const slice = { room: state.room, innerRoomName: state.innerRoomName, time: state.time, varTree: state.varTree };
    expect(resolvePrepItemsForJudge(slice, [seed])).toEqual(adaptPrepItemsForJudge(state, [seed]));
  });
});

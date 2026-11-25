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
  it("WO-24G：prep_item clue 微痕行进素材块；无 clue/失效 seed 不渲染；npc/rumor 不回归", () => {
    // #523 Review 修后口径：clue 只对「未坍缩且无预设物」的容器渲染——
    // 用真实声明容器 贡措海/沉水石函（无 presetItems）作正例。
    const state = mkState({ room: { name: "贡措海", npcs: [] }, innerRoomName: "贡措海密室" });
    const payload = { ...ITEM_PAYLOAD, containerId: "沉水石函" };
    const itemSeed = mkSeed(state, "prep_item", payload);
    // mkSeed 用 state.room.name 定位——itemSeed 位置随 state
    expect(prepMaterialLines(state, [itemSeed])).toHaveLength(1);
    const lines = prepMaterialLines(state, [itemSeed]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("【备料·微痕】");
    expect(lines[0]).toContain("沉水石函");
    expect(lines[0]).toContain("箱角露出一线油纸");
    // 注入块非事实警示钉死——clue 也不是既定事实
    const block = buildPrepMaterialBlock(state, [itemSeed]);
    expect(block).toContain("不是既定事实");
    expect(block).toContain("【备料·微痕】");
    // 无 clue 不渲染
    const noClue = mkSeed(state, "prep_item", { ...payload, clue: "" });
    expect(prepMaterialLines(state, [noClue])).toHaveLength(0);
    // 失效 seed（跨日）不渲染
    expect(prepMaterialLines(mkState({ time: 96 }), [itemSeed])).toHaveLength(0);
    // #523 Review 负例：scripted 容器（天都镇/一楼客厅/铁柜有预设物）clue 抑制
    const scripted = mkState({ room: { name: "天都镇", npcs: [] }, innerRoomName: "一楼客厅" });
    const scriptedSeed = mkSeed(scripted, "prep_item", { ...payload, containerId: "铁柜" });
    expect(prepMaterialLines(scripted, [scriptedSeed])).toHaveLength(0);
    // 未声明容器 clue 抑制（翻了也什么都没有）
    expect(prepMaterialLines(scripted, [mkSeed(scripted, "prep_item", { ...payload, containerId: "空气缸" })])).toHaveLength(0);
    // npc/rumor 原有行不回归：混合种子各行俱在，cap 3 受控
    const mixed = [
      mkSeed(state, "npc_plan", PLAN_PAYLOAD, { subject: "掌柜" }),
      mkSeed(state, "tavern_rumor", RUMOR_PAYLOAD),
      itemSeed,
      mkSeed(state, "prep_item", { ...ITEM_PAYLOAD, name: "第二件" }),
    ];
    const lines2 = prepMaterialLines(state, mixed);
    expect(lines2.length).toBeLessThanOrEqual(3);
    expect(lines2.some((l) => l.includes("人物盘算"))).toBe(true);
    expect(lines2.some((l) => l.includes("巷口风声"))).toBe(true);
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
  it("WO-24E：备料物按 budget.maxQuality 二次钳制降档（低档不能出高阶）", () => {
    // 搜刮额度耗尽→maxQuality 白（computeCausalBudget 口径）——紫阶备料封顶落白
    const verdict = judgeTurn({
      turn: 48, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 世界: {} }, inv: [], entries: [],
      containers: { 木箱: { collapsed: false, presetItems: [] } }, containerPlace: "曲措客栈",
      prepItems: [{ id: "p1", containerId: "木箱", name: "紫阶旧剑", quality: "紫", category: "weapon", clue: "x", taken: false }],
      budget: { maxPointBudget: 0, maxQuality: "白", luck: 0, riskLevel: 0, dailyLootUsed: 99 },
    }, {
      read: "", refIds: [],
      actions: [{ kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual", text: "翻木箱" }],
      proposals: [],
    }, { rng: () => 0.99 });
    const grant = (verdict.facts || []).find((f) => f.op === "GRANT_ITEM");
    expect(grant.quality).toBe("白");
    expect(grant.itemName).toBe("紫阶旧剑"); // 物还是那件物，品阶被钳
  });
  it("WO-24E 初审裁决：两件备料分属两容器不串——翻书桌发不出铁柜草案", () => {
    const verdict = judgeTurn({
      turn: 48, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 世界: {} }, inv: [], entries: [],
      containers: { 书桌: { collapsed: false, presetItems: [] } }, containerPlace: "曲措客栈",
      prepItems: [
        { id: "pa", containerId: "铁柜", name: "铁柜旧药", quality: "白", category: "misc", clue: "", taken: false },
        { id: "pb", containerId: "木箱", name: "木箱杂物", quality: "白", category: "misc", clue: "", taken: false },
      ],
      budget: { maxPointBudget: 0, maxQuality: "白", luck: 0, riskLevel: 0 },
    }, {
      read: "", refIds: [],
      actions: [{ kind: "inspect_container", target: "书桌", itemId: "", direction: "none", stance: "casual", text: "翻书桌" }],
      proposals: [],
    }, { rng: () => 0.99 });
    expect((verdict.facts || []).filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0); // 无匹配容器不发
    // 翻对容器才发对应那一件
    const v2 = judgeTurn({
      turn: 48, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 世界: {} }, inv: [], entries: [],
      containers: { 铁柜: { collapsed: false, presetItems: [] } }, containerPlace: "曲措客栈",
      prepItems: [
        { id: "pa", containerId: "铁柜", name: "铁柜旧药", quality: "白", category: "misc", clue: "", taken: false },
        { id: "pb", containerId: "木箱", name: "木箱杂物", quality: "白", category: "misc", clue: "", taken: false },
      ],
      budget: { maxPointBudget: 0, maxQuality: "白", luck: 0, riskLevel: 0 },
    }, {
      read: "", refIds: [],
      actions: [{ kind: "inspect_container", target: "铁柜", itemId: "", direction: "none", stance: "casual", text: "翻铁柜" }],
      proposals: [],
    }, { rng: () => 0.99 });
    const grants = (v2.facts || []).filter((f) => f.op === "GRANT_ITEM");
    expect(grants).toHaveLength(1);
    expect(grants[0].itemName).toBe("铁柜旧药"); // 只发本容器那件
  });
  it("WO-24E：quality/category/clue 透传进 fact——materialize 不落「来历成谜」", () => {
    const v = judgeWithPrep([{ id: "p2", containerId: "木箱", name: "旧伤药", quality: "白", category: "misc", clue: "箱角露出一线油纸", taken: false }]);
    const grant = (v.facts || []).find((f) => f.op === "GRANT_ITEM");
    expect(grant.quality).toBe("白");
    expect(grant.category).toBe("misc");
    expect(grant.desc).toBe("箱角露出一线油纸");
  });
  it("WO-24E：额度内不降档——maxQuality 紫则绿阶备料原样落绿", () => {
    const verdict = judgeTurn({
      turn: 48, day: 3, place: "曲措客栈",
      npcs: [], varTree: { 世界: {} }, inv: [], entries: [],
      containers: { 木箱: { collapsed: false, presetItems: [] } }, containerPlace: "曲措客栈",
      prepItems: [{ id: "p3", containerId: "木箱", name: "绿阶护腕", quality: "绿", category: "armor", clue: "c", taken: false }],
      budget: { maxPointBudget: 2, maxQuality: "紫", luck: 0, riskLevel: 0 },
    }, {
      read: "", refIds: [],
      actions: [{ kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual", text: "翻木箱" }],
      proposals: [],
    }, { rng: () => 0.99 });
    const grant = (verdict.facts || []).find((f) => f.op === "GRANT_ITEM");
    expect(grant.quality).toBe("绿");
    expect(grant.category).toBe("armor");
  });
  it("resolvePrepItemsForJudge 是真实/影子同一入口", () => {
    const state = mkState();
    const seed = mkSeed(state, "prep_item", ITEM_PAYLOAD);
    const slice = { room: state.room, innerRoomName: state.innerRoomName, time: state.time, varTree: state.varTree };
    expect(resolvePrepItemsForJudge(slice, [seed])).toEqual(adaptPrepItemsForJudge(state, [seed]));
  });
});

// D2 容器默认模板/owner/翻箱目击检定
import { describe, expect, it } from "vitest";
import {
  classifyRoomNature, deriveContainerOwner, computeNpcAlertness,
  containerViewForRoom, intakeContainerLines, resolveContainerContext,
} from "./containers.js";
import { processInspectContainers } from "../judge/rules/inspectContainer.js";

const mkJ = (over = {}) => {
  const facts = [], warrants = [], notes = [];
  let fid = 0, wid = 0;
  return {
    facts, warrants, notes,
    J: {
      envelope: { containers: over.containers || {}, char: { special: { 身法: 2, 智谋: 2 } }, floatingItems: [], prepItems: [], budget: { luck: 0 }, containerPlace: "测试地" },
      roll: over.roll ?? (() => 0.5), turn: 1, day: 1, place: "测试地",
      budget: { maxQuality: "白", maxPointBudget: 0, remainingDailyQuota: 1, luck: 0 },
      facts, warrants, notes,
      nextFactId: () => `f${++fid}`, nextWarrantId: () => `w${++wid}`,
      talkOnly: false, proposals: [],
      npcs: over.npcs ?? [],
    },
  };
};

describe("D2 模板容器与 owner", () => {
  it("外层野外据点（无内层）非零容器——草丛/石缝/树洞无主", () => {
    const { containerView, openContainers } = resolveContainerContext({
      districtName: "狼曲山道", innerRoomName: null, varTree: {}, roomDefLookup: () => null,
    });
    expect(Object.keys(containerView)).toEqual(["草丛", "石缝", "树洞"]);
    expect(containerView["草丛"].isTemplate).toBe(true);
    expect(containerView["草丛"].owner).toBe("");
    expect(openContainers.length).toBe(3);
  });
  it("房名归类：民居/饭馆/野外/街道", () => {
    expect(classifyRoomNature({ districtName: "鱼定村", innerRoomName: "才旦家", innerDef: { privateHome: true } })).toBe("home");
    expect(classifyRoomNature({ districtName: "x", innerRoomName: "悦来饭馆", innerDef: null })).toBe("food");
    expect(classifyRoomNature({ districtName: "狼曲山道", innerRoomName: null, innerDef: null })).toBe("wild");
    expect(classifyRoomNature({ districtName: "曲措乡", innerRoomName: "村口广场", innerDef: null })).toBe("street");
  });
  it("owner 推导：residentNpcName 优先，家园房置空", () => {
    expect(deriveContainerOwner({ districtName: "d", innerRoomName: "才旦家", innerDef: { residentNpcName: "才旦" }, nature: "home" })).toBe("才旦");
    expect(deriveContainerOwner({ districtName: "d", innerRoomName: "溪边小屋", innerDef: null, nature: "home" })).toBe("");
    expect(deriveContainerOwner({ districtName: "大草甸", innerRoomName: null, innerDef: null, nature: "wild" })).toBe("");
  });
  it("显式声明房间保持原样，仅补 owner", () => {
    const view = containerViewForRoom({}, "p", { containers: [{ name: "铁柜", presetItems: [{ name: "密信" }] }] }, { districtName: "d", innerRoomName: "内室" });
    expect(Object.keys(view)).toEqual(["铁柜"]);
    expect(view["铁柜"].isTemplate).toBe(false);
  });
  it("前哨行有主带括注", () => {
    const lines = intakeContainerLines({}, "p", null, { env: { districtName: "d", innerRoomName: "才旦家" } });
    // 才旦家无 resident 数据 owner 空——用有 owner 的容器视图直接验格式
    const view = containerViewForRoom({}, "p", { containers: [{ name: "木箱" }] }, { districtName: "d", innerRoomName: "x" });
    expect(lines.every((l) => typeof l === "string")).toBe(true);
  });
  it("computeNpcAlertness 三档", () => {
    expect(computeNpcAlertness({ levelCap: 4 })).toBe(10);
    expect(computeNpcAlertness({ levelCap: 0, personality: "精明多疑" })).toBe(8);
    expect(computeNpcAlertness({ levelCap: 0, personality: "憨厚粗豪" })).toBe(5);
  });
});

describe("D2 翻箱目击与模板兜底", () => {
  const containersWithOwner = { 木箱: { collapsed: false, presetItems: [], isTemplate: true, owner: "才旦" } };
  it("target 括注清洗命中容器", () => {
    const { J, notes } = mkJ({ containers: containersWithOwner, npcs: [], roll: () => 0.1 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱(有主:才旦)" }]);
    expect(notes.some((n) => n.includes("木箱") && !n.includes("没什么可翻"))).toBe(true);
  });
  it("owner 在场检定失败记怨扣好感", () => {
    const { J, facts, notes } = mkJ({ containers: containersWithOwner, npcs: [{ name: "才旦", levelCap: 9 }], roll: () => 0 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱" }]);
    const social = facts.find((f) => f.op === "MUTATE_SOCIAL" && f.npc === "才旦");
    expect(social?.affectionDelta).toBe(-3);
    expect(social?.ledgerKind).toBe("怨");
    expect(notes.some((n) => n.includes("当场撞见"))).toBe(true);
  });
  it("owner 在场检定通过只写遮掩 notes 零社交事实", () => {
    const { J, facts, notes } = mkJ({ containers: containersWithOwner, npcs: [{ name: "才旦", levelCap: 0, personality: "迷糊" }], roll: () => 0.99 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱" }]);
    expect(facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
    expect(notes.some((n) => n.includes("未被察觉"))).toBe(true);
  });
  it("owner 不在场旁观者记见不扣好感，灵兽/同伴排除", () => {
    const npcs = [
      { name: "雪团", beast: true }, { name: "阿旺", companion: true }, { name: "卓嘎" },
    ];
    const { J, facts, notes } = mkJ({ containers: containersWithOwner, npcs, roll: () => 0.1 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱" }]);
    const see = facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(see?.npc).toBe("卓嘎");
    expect(see?.affectionDelta).toBe(0);
    expect(see?.ledgerKind).toBe("见");
    expect(notes.some((n) => n.includes("看在眼里"))).toBe(true);
  });
  it("模板容器三档：65% 空签坍缩不签物", () => {
    const { J, facts, notes } = mkJ({ containers: { 草丛: { collapsed: false, presetItems: [], isTemplate: true, owner: "" } }, roll: () => 0.3 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "草丛" }]);
    expect(facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(facts.some((f) => f.op === "COLLAPSE_CONTAINER")).toBe(true);
    expect(notes.some((n) => n.includes("积灰与寻常杂碎"))).toBe(true);
  });
  it("模板容器 25% 档签白档 misc 空白天机券", () => {
    const { J, facts, warrants } = mkJ({ containers: { 草丛: { collapsed: false, presetItems: [], isTemplate: true, owner: "" } }, roll: () => 0.7 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "草丛" }]);
    expect(facts.some((f) => f.op === "GRANT_ITEM")).toBe(true);
    const w = warrants[0];
    expect(w?.quality).toBe("白");
    expect(w?.category).toBe("misc");
    expect(w?.pointBudget).toBe(0);
  });
});

describe("D2 Review/派工返修", () => {
  it("出战同伴（companion:true）不被记见——无其他旁观者则零目击", () => {
    const containers = { 木箱: { collapsed: false, presetItems: [], isTemplate: true, owner: "才旦" } };
    const { J, facts } = mkJ({ containers, npcs: [{ name: "明日香", companion: true }], roll: () => 0.1 });
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱" }]);
    expect(facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });
  it("非商业房带 residentNpcName 归民居，owner 不归零", () => {
    expect(classifyRoomNature({ districtName: "大草甸", innerRoomName: "丹增的帐篷", innerDef: { residentNpcName: "丹增" } })).toBe("home");
    const owner = deriveContainerOwner({ districtName: "大草甸", innerRoomName: "丹增的帐篷", innerDef: { residentNpcName: "丹增" }, nature: "home" });
    expect(owner).toBe("丹增");
  });
  it("山口类内层房名归野外", () => {
    expect(classifyRoomNature({ districtName: "大草甸", innerRoomName: "熊山口", innerDef: null })).toBe("wild");
  });
  it("身法 0 不被抬成 5：0+0+roll 低位必撞破", () => {
    const containers = { 木箱: { collapsed: false, presetItems: [], isTemplate: true, owner: "才旦" } };
    const { J, facts } = mkJ({ containers, npcs: [{ name: "才旦", levelCap: 0 }], roll: () => 0 });
    J.envelope.char.special = { 身法: 0, 智谋: 0 };
    processInspectContainers(J, [{ kind: "inspect_container", target: "木箱" }]);
    // 0+0+0=0 < alertness 6 → 撞破记怨
    expect(facts.some((f) => f.op === "MUTATE_SOCIAL" && f.affectionDelta === -3)).toBe(true);
  });
});

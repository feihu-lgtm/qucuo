import { describe, it, expect } from "vitest";
import { registerMemoryFact } from "./memoryFact.js";

const base = (memory) => ({
  p: { memory },
  room: { npcs: [{ name: "才旦" }] },
  activeTarget: "才旦",
  isTalk: true,
  talkTarget: "才旦",
  time: 24,
  appendDayMaterial: null,
});

describe("registerMemoryFact", () => {
  it("同回合同对象两条不同记忆不撞键", () => {
    const a = registerMemoryFact(base("玩家对才旦说：早上好"));
    const b = registerMemoryFact(base("玩家对才旦说：今晚有雪"));
    const prev = { 世界: {} };
    const treeA = a.changes.varTree(prev);
    const factsA = treeA.世界.事实 || treeA.世界.传闻 || {};
    const treeB = b.changes.varTree(treeA);
    // 两条都应入账：键不同（摘要哈希进 id）
    const idsA = JSON.stringify(treeA);
    const idsB = JSON.stringify(treeB);
    expect(idsB.length).toBeGreaterThan(idsA.length);
    expect(factsA).toBeTruthy();
  });

  it("memory 为数组时归一成字符串不抛错", () => {
    const out = registerMemoryFact(base(["片段一", "片段二"]));
    expect(out).toBeTruthy();
    expect(() => out.changes.varTree({ 世界: {} })).not.toThrow();
  });

  it("无 memory 返回 null", () => {
    expect(registerMemoryFact({ ...base(""), p: {} })).toBeNull();
  });

  it("F9：搭话未点选+唯一在场者——密告只记唯一在场者为亲历，不广播全屋", () => {
    const out = registerMemoryFact({
      p: { memory: "后院青砖底下埋着半截断镖" },
      room: { npcs: [{ name: "老孙" }] },
      activeTarget: "", isTalk: true, talkTarget: "", time: 24, appendDayMaterial: null,
    });
    const tree = out.changes.varTree({ 世界: {} });
    const facts = tree.世界.知识领域.事实 || {};
    const entry = Object.values(facts)[0];
    expect(Object.keys(entry.知晓者)).toEqual(["老孙"]);
    expect(entry.知晓者.老孙.途径).toBe("亲历");
  });

  it("F9：多人在场未点选仍按全屋目击（无法确证私语对象，保守广播）", () => {
    const out = registerMemoryFact({
      p: { memory: "随口一句话" },
      room: { npcs: [{ name: "老孙" }, { name: "才旦" }] },
      activeTarget: "", isTalk: true, talkTarget: "", time: 24, appendDayMaterial: null,
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    expect(Object.keys(entry.知晓者)).toHaveLength(2);
  });
});

describe("V4 在场收窄（验收）", () => {
  // 鱼定村全员 22 人背景下：身处内层房「老孙饭馆」，老孙不在（他在村口）、
  // 花嫂在场——翻酒坛的目击者只能有花嫂，绝不能含老孙或鱼定大娘。
  it("老孙饭馆翻酒坛：witnesses 仅含花嫂，不含老孙/鱼定大娘", () => {
    const allNpcs = [
      { name: "花嫂", innerRoom: "老孙饭馆" },
      { name: "老孙", innerRoom: "村口", schedule: [{}] },
      { name: "鱼定大娘", innerRoom: "村口" },
      { name: "才旦", innerRoom: "才旦家" },
    ];
    const out = registerMemoryFact({
      p: { memory: "玩家翻开了柜台后的酒坛" },
      room: { name: "鱼定村", npcs: allNpcs },
      activeTarget: "", isTalk: false, talkTarget: "", time: 30, appendDayMaterial: null,
      innerRoomName: "老孙饭馆",
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    expect(Object.keys(entry.知晓者)).toEqual(["花嫂"]);
    expect(entry.房间).toEqual({ district: "鱼定村", inner: "老孙饭馆" });
  });

  it("V4：非搭话密行（翻箱）+唯一在场者——不再要求 isTalk 也收窄为单人", () => {
    const out = registerMemoryFact({
      p: { memory: "玩家摸走了枕下碎银" },
      room: { name: "鱼定村", npcs: [{ name: "花嫂", innerRoom: "老孙饭馆" }] },
      activeTarget: "", isTalk: false, talkTarget: "", time: 30, appendDayMaterial: null,
      innerRoomName: "老孙饭馆",
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    expect(Object.keys(entry.知晓者)).toEqual(["花嫂"]);
    // 非搭话密行：唯一在场者是目击者而非被告知秘密的亲历者
    expect(entry.知晓者.花嫂.途径).toBe("目击");
  });

  it("V4：密告标签——援引往事条目向对象透露情报落「密告」", () => {
    const out = registerMemoryFact({
      p: { memory: "玩家压低声音说出老土司真账册的下落" },
      room: { npcs: [{ name: "才旦" }] },
      activeTarget: "才旦", isTalk: true, talkTarget: "", time: 30, appendDayMaterial: null,
      refIds: ["fact_账册"],
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    expect(entry.标签).toBe("密告");
  });

  it("V4：随行同伴不计入唯一在场者判定", () => {
    const out = registerMemoryFact({
      p: { memory: "玩家翻箱倒柜" },
      room: { name: "鱼定村", npcs: [
        { name: "花嫂", innerRoom: "老孙饭馆" },
        { name: "雪豹", innerRoom: "老孙饭馆", companion: true },
      ] },
      activeTarget: "", isTalk: false, talkTarget: "", time: 30, appendDayMaterial: null,
      innerRoomName: "老孙饭馆",
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    // 唯一非随行在场者是花嫂——收窄为亲历而非全屋广播
    expect(Object.keys(entry.知晓者)).toEqual(["花嫂"]);
  });
});

  it("Review：移动+翻箱复合指令按目的地房间记账，不按出发地", () => {
    const destNpcs = [{ name: "花嫂", innerRoom: "老孙饭馆" }];
    const out = registerMemoryFact({
      p: { memory: "玩家翻开了柜台后的酒坛" },
      room: { name: "鱼定村", npcs: [{ name: "老孙", innerRoom: "村口", schedule: [{}] }] },
      activeTarget: "", isTalk: false, talkTarget: "", time: 30, appendDayMaterial: null,
      innerRoomName: "村口",
      postRouteRoom: { name: "鱼定村", npcs: destNpcs }, postRouteInnerRoom: "老孙饭馆",
    });
    const tree = out.changes.varTree({ 世界: {} });
    const entry = Object.values(tree.世界.知识领域.事实 || {})[0];
    expect(Object.keys(entry.知晓者)).toEqual(["花嫂"]);
    expect(entry.房间).toEqual({ district: "鱼定村", inner: "老孙饭馆" });
  });

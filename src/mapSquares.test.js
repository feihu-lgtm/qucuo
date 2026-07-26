import { describe, it, expect, beforeEach } from "vitest";
import {
  buildSquarePrompt, parseSquareBatch, applySquareBatch,
  consumeArrival, getLookText, burnSquare, resetForDay,
  serializeSquares, loadSquares,
} from "./mapSquares.js";

const skeletons = {
  天都镇: { item: { quality: "紫", category: "misc" }, encounter: { factionKey: "玉泉寨", label: "玉泉寨", roamers: "押货的商队伙计" } },
  白塔: { item: null, encounter: null },
};

const aiReply = JSON.stringify([
  { name: "天都镇", desc: "镇口木牌坊上书“天都”二字，街市喧阗，酒旗招展。", lookText: "长街两侧店铺林立，远处传来打铁声。",
    findLine: "泥沼旁半掩着一截深紫色的物事。", itemName: "深紫色兽骨", itemDesc: "云雷纹路，入手沉凝。",
    encounterName: "押货的老张", encounterBrief: "玉泉寨押货伙计", encounterTier: "绿", encounterLine: "一个赶牲口的汉子与你擦肩而过。" },
  { name: "白塔", desc: "白塔静立，经幡猎猎。", lookText: "塔下石阶盘桓，远山如黛。" },
]);

describe("mapSquares", () => {
  beforeEach(() => { resetForDay(); });

  it("prompt 带上据点名与系统裁决", () => {
    const { system, user } = buildSquarePrompt([
      { name: "天都镇", base: "喧闹市镇", exits: "w", item: { quality: "紫", category: "misc" }, encounter: { label: "玉泉寨", roamers: "押货的商队伙计" } },
    ]);
    expect(user).toContain("天都镇");
    expect(user).toContain("品质「紫」");
    expect(user).toContain("玉泉寨");
    expect(system).toContain("不要写时辰");
  });

  it("解析容错：fenced JSON 也能救回", () => {
    const arr = parseSquareBatch("```json\n" + aiReply + "\n```");
    expect(arr.length).toBe(2);
    expect(arr[0].itemName).toBe("深紫色兽骨");
  });

  it("合并：系统骨架 + AI 命名", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    const a = consumeArrival("天都镇", 1);
    expect(a.desc).toContain("天都");
    expect(a.item).toEqual({ name: "深紫色兽骨", quality: "紫", category: "misc", desc: "云雷纹路，入手沉凝。" });
    expect(a.encounter.name).toBe("押货的老张");
    expect(a.encounter.tier).toBe("绿");
  });

  it("消费：物件/路遇一次性，desc 每次都给", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    consumeArrival("天都镇", 1);
    const second = consumeArrival("天都镇", 1);
    expect(second.desc).toBeTruthy();
    expect(second.item).toBeNull();
    expect(second.encounter).toBeNull();
  });

  it("burn 后埋物作废、desc 保留", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    burnSquare("天都镇");
    const a = consumeArrival("天都镇", 1);
    expect(a.desc).toBeTruthy();
    expect(a.item).toBeNull();
    expect(a.encounter).toBeNull();
  });

  it("跨天失效", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    expect(consumeArrival("天都镇", 2).desc).toBeNull();
    expect(getLookText("天都镇", 2)).toBeNull();
  });

  it("lookText 可反复取", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    expect(getLookText("天都镇", 1)).toContain("长街");
    expect(getLookText("天都镇", 1)).toContain("长街");
  });

  it("序列化/读回 round-trip", () => {
    applySquareBatch(1, parseSquareBatch(aiReply), skeletons);
    const snap = serializeSquares();
    resetForDay();
    expect(consumeArrival("天都镇", 1).desc).toBeNull();
    loadSquares(snap);
    expect(consumeArrival("天都镇", 1).item.name).toBe("深紫色兽骨");
  });
});

// 单轨自动分流单测：分段/纯看/纯搭话/复合标注/硬行动配额。
import { describe, expect, it } from "vitest";
import {
  buildCompositeNote, findLookTargetsInText, matchWholeLook,
  routeAutoInput, splitCompositeInput,
} from "./compositeInput.js";

const NPCS = [{ name: "铁伯" }, { name: "元朵朵" }, { name: "燕绾烟" }];

describe("splitCompositeInput", () => {
  it("括号分段 + 逗号/句号断句，按书写顺序", () => {
    expect(splitCompositeInput("（看她）看看你自己，美美的（找她要点钱）"))
      .toEqual(["看她", "看看你自己", "美美的", "找她要点钱"]);
    expect(splitCompositeInput("去后山。跟她说声好"))
      .toEqual(["去后山", "跟她说声好"]);
  });
  it("整句一段就是一段", () => {
    expect(splitCompositeInput("看看铁伯")).toEqual(["看看铁伯"]);
    expect(splitCompositeInput("")).toEqual([]);
  });
});

describe("matchWholeLook / findLookTargetsInText", () => {
  it("整句纯看在场人物命中", () => {
    expect(matchWholeLook("看铁伯", NPCS)?.name).toBe("铁伯");
    expect(matchWholeLook("打量元朵朵！", NPCS)?.name).toBe("元朵朵");
    expect(matchWholeLook("看铁伯然后走", NPCS)).toBeNull();
    expect(matchWholeLook("看看四周", NPCS)).toBeNull();
  });
  it("复合句里点名的看段检出目标", () => {
    const hits = findLookTargetsInText("（看铁伯）夸她，再找元朵朵要钱", NPCS);
    expect(hits.map(n => n.name)).toEqual(["铁伯"]);
  });
});

describe("routeAutoInput", () => {
  it("纯看→lookNpc，纯搭话→talk，其余→action", () => {
    expect(routeAutoInput("看铁伯", NPCS).kind).toBe("lookNpc");
    expect(routeAutoInput("聊聊家常", NPCS).kind).toBe("talk");
    expect(routeAutoInput("（看铁伯）夸她，再找他要钱", NPCS).kind).toBe("action");
    expect(routeAutoInput("随便敲点什么", NPCS).kind).toBe("action");
  });

  it("搭话里混行动 → action；送礼算行动不免费", () => {
    expect(routeAutoInput("聊聊家常，然后捡起枯枝", NPCS).kind).toBe("action");
    expect(routeAutoInput("递给铁伯一枚玉佩", NPCS).kind).toBe("action");
  });
});

describe("buildCompositeNote", () => {
  it("≥2 段才出标注，含硬行动配额一句", () => {
    const note = buildCompositeNote("（看她）夸她，再要钱");
    expect(note).toContain("复合输入");
    expect(note).toContain("最多执行一个决定性硬行动");
    expect(note).toContain("「看她」");
    expect(buildCompositeNote("单打独斗一句话")).toBe("");
  });
});

describe("WO-16F-F2c isTradeInput 交易意向不进免费纯搭话", () => {
  it("「问问老孙价格」「老孙，这个多少钱」分流 action 不免费", () => {
    expect(routeAutoInput("问问老孙价格", []).kind).toBe("action");
    expect(routeAutoInput("老孙，这个多少钱", []).kind).toBe("action");
    expect(routeAutoInput("掌柜，拿货看看", []).kind).toBe("action");
  });
  it("「聊聊家常」仍 talk；送礼排除不回归", () => {
    expect(routeAutoInput("聊聊家常", []).kind).toBe("talk");
    expect(routeAutoInput("把这壶酒送给老孙", []).kind).toBe("action");
  });
  it("元问题不误判：isTradeInput 排除概念问答", async () => {
    const { isTradeInput } = await import("../prompt/inputIntent.js");
    expect(isTradeInput("价格是什么")).toBe(false);
    expect(isTradeInput("什么叫交易")).toBe(false);
    expect(isTradeInput("这个多少钱")).toBe(true);
    expect(isTradeInput("问问价格")).toBe(true);
    // Review 两修：买卖作话题名词非意向；作交易本体（做笔买卖）仍命中
    expect(isTradeInput("聊聊村里的买卖")).toBe(false);
    expect(isTradeInput("谈谈买卖的事")).toBe(false);
    expect(isTradeInput("买把剑")).toBe(true);
    expect(isTradeInput("问问老孙愿不愿跟我做笔买卖")).toBe(true);
  });
});

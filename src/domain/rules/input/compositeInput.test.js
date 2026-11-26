// 单轨自动分流单测：分段/纯看/纯搭话/复合标注/硬行动配额。
import { describe, expect, it } from "vitest";
import {
  buildCompositeNote, findLookTargetsInText, matchWholeLook,
  routeAutoInput, splitCompositeInput,
} from "./compositeInput.js";
import { classifyIntent } from "../prompt/inputIntent.js";

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
  it("无歧义动作线索分流 action 不免费", () => {
    expect(routeAutoInput("老孙，这个多少钱", []).kind).toBe("action");
    expect(routeAutoInput("跟老孙做交易", []).kind).toBe("action");
    expect(routeAutoInput("掌柜，拿货看看", []).kind).toBe("action");
  });
  it("「聊聊家常」仍 talk；送礼排除不回归", () => {
    expect(routeAutoInput("聊聊家常", []).kind).toBe("talk");
    expect(routeAutoInput("把这壶酒送给老孙", []).kind).toBe("action");
  });
  it("保守口径：只认无歧义动作线索，名词性 买卖/价格/价钱 单独出现一概不算", async () => {
    const { isTradeInput } = await import("../prompt/inputIntent.js");
    // 命中：买/卖（动词）/交易/问价/多少钱/开价/拿货看看/什么货/进货/出货
    expect(isTradeInput("买把剑")).toBe(true);
    expect(isTradeInput("这个多少钱")).toBe(true);
    expect(isTradeInput("跟掌柜交易")).toBe(true);
    expect(isTradeInput("你这有什么货")).toBe(true);
    // 名词剥除：买卖/价格/价钱 单独出现一概不算（宁可漏判不误判，裁决收口）
    expect(isTradeInput("聊聊村里的买卖")).toBe(false);
    expect(isTradeInput("谈谈买卖的事")).toBe(false);
    expect(isTradeInput("做笔买卖")).toBe(false);
    expect(isTradeInput("问问价格")).toBe(false);
    expect(isTradeInput("问问老孙最近买卖怎么样")).toBe(false);
    expect(isTradeInput("买卖如何啊")).toBe(false);
    expect(isTradeInput("问问老孙来一笔买卖怎么样")).toBe(false);
    // 元问题排除不回归
    expect(isTradeInput("价格是什么")).toBe(false);
    expect(isTradeInput("什么叫交易")).toBe(false);
  });

});

describe("V1 呼语不拆段与盐价归 talk", () => {
  it("句首呼语（老孙，…/周掌柜，…）不拆成两段", () => {
    expect(splitCompositeInput("老孙，雅江盐价可稳当")).toHaveLength(1);
    expect(splitCompositeInput("周掌柜，最近行市如何")).toHaveLength(1);
  });
  it("在场 NPC 名呼语不拆段，「周掌柜，雅江盐价可稳当」走免费 talk", () => {
    const npcs = [{ name: "周掌柜" }];
    expect(splitCompositeInput("周掌柜，雅江盐价可稳当", { npcs })).toHaveLength(1);
    expect(routeAutoInput("周掌柜，雅江盐价可稳当", npcs).kind).toBe("talk");
  });
  it("非呼语首段照常拆段——往东走，翻柜子 仍两段", () => {
    expect(splitCompositeInput("往东走，翻柜子").length).toBe(2);
  });
  it("盐价稳当吗/最近行市如何 归 talk 不归 trade", async () => {
    const { isTradeInput } = await import("../prompt/inputIntent.js");
    expect(isTradeInput("盐价稳当吗")).toBe(false);
    expect(isTradeInput("最近行市如何")).toBe(false);
    expect(isTradeInput("有什么货色卖")).toBe(true);
    expect(isTradeInput("买两斤盐")).toBe(true);
  });
});

describe("V1 Review 修：呼语带硬行动不吃免费通道+疑问句形归搭话", () => {
  it("「老孙，我喝一口酒」呼语开头但带硬行动动词，归 action 不归免费 talk", () => {
    expect(routeAutoInput("老孙，我喝一口酒", [{ name: "老孙" }]).kind).toBe("action");
  });
  it("「老孙，今晚月色如何」呼语+疑问句形无行动，归免费 talk", () => {
    expect(routeAutoInput("老孙，今晚月色如何", [{ name: "老孙" }]).kind).toBe("talk");
  });
  it("裸疑问句「盐价稳当吗」「最近行市如何」单段归免费 talk 不耗回合", () => {
    expect(routeAutoInput("盐价稳当吗").kind).toBe("talk");
    expect(routeAutoInput("最近行市如何").kind).toBe("talk");
  });
});

describe("V1 Review 二轮：移动不被对话吞/问句不扣回合", () => {
  it("「往北走吧」「往东北走？」判为 MOVE 不落 TALK", () => {
    expect(classifyIntent("往北走吧").code).toBe("MOVE");
    expect(classifyIntent("往东北走？").code).toBe("MOVE");
  });
  it("「老孙，今晚吃什么」问句豁免硬行动排除，归免费 talk", () => {
    expect(routeAutoInput("老孙，今晚吃什么", [{ name: "老孙" }]).kind).toBe("talk");
    expect(routeAutoInput("周掌柜，这种盐价稳当吗", [{ name: "周掌柜" }]).kind).toBe("talk");
  });
  it("陈述句硬行动仍归 action 不被误放", () => {
    expect(routeAutoInput("老孙，我喝一口酒", [{ name: "老孙" }]).kind).toBe("action");
  });
});

describe("V1 Review 三轮：行动软尾吧不被问句豁免吞掉", () => {
  it("「我先翻一下桌上的册子吧」吧是行动软尾非疑问，归 action", () => {
    expect(routeAutoInput("我先翻一下桌上的册子吧").kind).toBe("action");
  });
  it("真问句仍归免费 talk 不回退", () => {
    expect(routeAutoInput("盐价稳当吗").kind).toBe("talk");
    expect(routeAutoInput("老孙，今晚吃什么", [{ name: "老孙" }]).kind).toBe("talk");
  });
});

import { describe, it, expect } from "vitest";
import { parsePactOffer } from "./pactOfferParse.js";

describe("F7 parsePactOffer 口头契约系统兜底解析", () => {
  it("T16 原句：三天+替你寻回旧物+赏十两银子 → 72h/承诺/酬谢全齐", () => {
    const r = parsePactOffer("对才旦正色道，三天之内我定去后山替你寻回那件旧物，事成之后你赏我十两银子买酒喝如何");
    expect(r).toBeTruthy();
    expect(r.deadlineHours).toBe(72);
    expect(r.promise).toContain("寻回");
    expect(r.rewardHint).toContain("十两银子");
  });
  it("时辰单位换算：两个时辰=4h 压线合法", () => {
    expect(parsePactOffer("两个时辰内我帮你把信送到，你赏我一两银子")?.deadlineHours).toBe(4);
  });
  it("三重门槛缺一不立约：无酬谢/无期限/闲聊全 null", () => {
    expect(parsePactOffer("三天之内我定去后山替你寻回旧物")).toBeNull();
    expect(parsePactOffer("我替你做件事，你赏我十两银子")).toBeNull();
    expect(parsePactOffer("今天天气不错，我们去喝酒吧")).toBeNull();
    expect(parsePactOffer("")).toBeNull();
  });
  it("Review 修：追忆往事不立约（无内字期限/过去式要约）", () => {
    expect(parsePactOffer("前两天我去过后山，还是你给我指的路")).toBeNull();
    expect(parsePactOffer("三天前我替你跑过一趟，你还欠我顿酒")).toBeNull();
    // 带内的真立约不受误伤
    expect(parsePactOffer("三天之内我定替你跑一趟，你赏我顿酒")).toBeTruthy();
    // Review 二轮：forward 从句含过/了不再误伤（送过去/修好了再回来）
    expect(parsePactOffer("三天之内我定把货送过去，你赏我二两银子")).toBeTruthy();
    expect(parsePactOffer("两天之内我帮你修好了再回来，你谢我一两银子")).toBeTruthy();
  });

  it("中文数字：十日=240h", () => {
    expect(parsePactOffer("十日之内我定会寻回那物件，你谢我五两银子")?.deadlineHours).toBe(240);
  });
});

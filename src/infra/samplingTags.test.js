import { afterEach, describe, expect, it } from "vitest";
import { getSamplingHeaders } from "./samplingTags.js";

afterEach(() => { delete globalThis.__qucuoSampling; });

describe("A4 采样归属请求头", () => {
  it("dev 下带齐 lane/turn/trace 三头", () => {
    globalThis.__qucuoSampling = { lane: 2, turn: 17, trace: "single-2-17" };
    expect(getSamplingHeaders()).toEqual({
      "x-qucuo-lane": "2",
      "x-qucuo-turn": "17",
      "x-qucuo-trace": "single-2-17",
    });
  });

  it("未挂标签时空头（不影响正常游玩）", () => {
    expect(getSamplingHeaders()).toEqual({});
  });

  it("缺字段只带有的头", () => {
    globalThis.__qucuoSampling = { lane: 0 };
    expect(getSamplingHeaders()).toEqual({ "x-qucuo-lane": "0" });
  });
});

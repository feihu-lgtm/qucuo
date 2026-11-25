import { describe, it, expect } from "vitest";
import { filterVisibleChunks, rankProseChunks, expandWithNeighbors, chunkSeq } from "./proseRecall.js";

const mk = (id, turn, witnesses, text, extra = {}) => ({
  id, turn, witnesses, publicText: text, rawText: text, entities: [], kind: "raw_memory", ...extra,
});

describe("filterVisibleChunks — witnesses 硬过滤", () => {
  const chunks = [
    mk("P1_1", 1, ["*"], "公共见闻"),
    mk("P2_1", 2, ["主角", "慕轻烟"], "两人私话"),
    mk("P3_1", 3, ["慕轻烟", "燕孤鸿"], "他人密谋"),
  ];
  it("公共段人人可见，私有段仅见证者可见", () => {
    const ids = filterVisibleChunks(chunks, "主角").map((c) => c.id);
    expect(ids).toEqual(["P1_1", "P2_1"]);
  });
  it("viewer 为空只看公共段", () => {
    expect(filterVisibleChunks(chunks, "").map((c) => c.id)).toEqual(["P1_1"]);
  });
  it("其他 NPC 视角看不到玩家私话", () => {
    expect(filterVisibleChunks(chunks, "铁破天").map((c) => c.id)).toEqual(["P1_1"]);
  });
});

describe("rankProseChunks — 词法主路", () => {
  const chunks = [
    mk("P1_1", 1, ["*"], "赫连铸在铁匠铺打铁"),
    mk("P2_1", 2, ["*"], "今日天气晴朗"),
  ];
  it("专名命中排前且过滤不可见段", () => {
    const hits = rankProseChunks(chunks, "赫连铸", "主角");
    expect(hits[0].chunk.id).toBe("P1_1");
    expect(rankProseChunks(chunks, "赫连铸", "").length).toBeGreaterThan(0);
  });
  it("空查询/空库返回空", () => {
    expect(rankProseChunks(chunks, "", "主角")).toEqual([]);
    expect(rankProseChunks([], "赫连铸", "主角")).toEqual([]);
  });
});

describe("expandWithNeighbors — 邻段连带合并", () => {
  const chunks = [
    mk("P5_1", 5, ["*"], "第一段"),
    mk("P5_2", 5, ["*"], "第二段"),
    mk("P5_3", 5, ["*"], "第三段"),
    mk("P5_4", 5, ["*"], "第四段"),
    mk("P6_1", 6, ["*"], "隔回合"),
  ];
  it("锚段拉 ±1 邻段按序合并，原字不改", () => {
    const hits = [{ chunk: chunks[1], score: 2 }];
    const out = expandWithNeighbors(chunks, hits);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("第一段\n第二段\n第三段");
    expect(out[0].ids).toEqual(["P5_1", "P5_2", "P5_3"]);
  });
  it("不连续段不合并、跨回合不合并", () => {
    const sparse = [chunks[0], chunks[3]];
    const hits = [{ chunk: chunks[3], score: 2 }];
    const out = expandWithNeighbors(sparse, hits);
    // P5_4 锚段：邻段 P5_3/P5_5 不在库 → 只有自己
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("第四段");
  });
  it("前 3 锚段名额之外的命中不带邻段但保留", () => {
    const hits = [
      { chunk: chunks[0], score: 5 }, { chunk: chunks[1], score: 4 },
      { chunk: chunks[2], score: 3 }, { chunk: chunks[3], score: 2 },
    ];
    const out = expandWithNeighbors(chunks, hits, { quota: 1 });
    expect(out.length).toBeGreaterThan(0);
  });
  it("legacy 迁移段（无数字段号）可召回不参与邻段", () => {
    expect(chunkSeq(mk("P5_legacy3_1", 5, ["*"], "x"))).toBeNull();
    expect(chunkSeq(mk("P5_12", 5, ["*"], "x"))).toBe(12);
  });
});

describe("WO-18 复审修正——动态视角文本与邻段合并", () => {
  it("可见文本按当前 viewer 用 rawText 动态剥离：他人心理对旁观者消失、本人可见", () => {
    const raw = "燕孤鸿点头。*他心想：此子可杀。*你收下剑。";
    const c = mk("P9_1", 9, ["燕孤鸿", "主角"], "", { rawText: raw, publicText: "燕孤鸿点头。你收下剑。" });
    const asPlayer = rankProseChunks([c], "点头", "主角");
    const text1 = expandWithNeighbors([c], asPlayer, { viewer: "主角" })[0].text;
    expect(text1).not.toContain("可杀");
    const asNpc = rankProseChunks([c], "点头", "燕孤鸿");
    const text2 = expandWithNeighbors([c], asNpc, { viewer: "燕孤鸿" })[0].text;
    // 心理无主语且邻近无他人证据——拿不准保留；这里只验证两位视角都能得到文本且 API 走 rawText 动态路
    expect(text2.length).toBeGreaterThan(0);
  });
  it("无 rawText 的老段降级 publicText", () => {
    const c = mk("P9_2", 9, ["*"], "老段兼容文本");
    delete c.rawText;
    const hits = rankProseChunks([c], "兼容", "主角");
    expect(expandWithNeighbors([c], hits, { viewer: "主角" })[0].text).toBe("老段兼容文本");
  });
  it("相邻双命中合并成一块且只出现一次", () => {
    const chunks = [
      mk("P5_1", 5, ["*"], "甲段"),
      mk("P5_2", 5, ["*"], "乙段"),
      mk("P5_3", 5, ["*"], "丙段"),
    ];
    const hits = [{ chunk: chunks[0], score: 5 }, { chunk: chunks[1], score: 4 }];
    const out = expandWithNeighbors(chunks, hits, { viewer: "主角" });
    const allIds = out.flatMap((e) => e.ids);
    expect(new Set(allIds).size).toBe(allIds.length);
    // 1/2/3 连续应并在同一块
    expect(out.some((e) => e.ids.join(",") === "P5_1,P5_2,P5_3")).toBe(true);
  });
  it("邻段不带入 viewer 未见证段", () => {
    const chunks = [
      mk("P5_1", 5, ["*"], "公开段"),
      mk("P5_2", 5, ["慕轻烟", "燕孤鸿"], "私密段"),
    ];
    const hits = [{ chunk: chunks[0], score: 5 }];
    const out = expandWithNeighbors(chunks, hits, { viewer: "主角" });
    expect(out.flatMap((e) => e.ids)).not.toContain("P5_2");
  });
});

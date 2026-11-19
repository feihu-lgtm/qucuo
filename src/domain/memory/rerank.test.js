import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveRerankUrl, rerank, applyRerank } from "./rerank.js";

// 精排是可选的第四步：粗排（intent/context/词法三路 RRF）拿到十几条大致相关的，
// cross-encoder 把 (查询,候选) 成对喂进模型直接出相关度。它贵但准，只用在粗排之后。
// 【最重要的性质：绝不阻断主流程】超时/网络失败/解析失败/全被 minScore 滤掉，
// 一律返回 null，调用方回退粗排顺序——宁可用粗排，也不要因为精排挂了就没有召回。

afterEach(() => { vi.unstubAllGlobals(); });

describe("端点补全", () => {
  it("只给 base 时补 /rerank", () => {
    expect(resolveRerankUrl("https://api.siliconflow.cn/v1")).toBe("https://api.siliconflow.cn/v1/rerank");
  });
  it("已经是全路径就不重复补", () => {
    expect(resolveRerankUrl("https://x.com/v1/rerank")).toBe("https://x.com/v1/rerank");
  });
  it("尾斜杠不影响", () => {
    expect(resolveRerankUrl("https://x.com/v1///")).toBe("https://x.com/v1/rerank");
  });
  it("空值给空串", () => {
    for (const v of ["", null, undefined]) expect(resolveRerankUrl(v)).toBe("");
  });
});

const CANDS = [
  { id: "a", text: "少侠答应才旦帮他找回丢的羊。" },
  { id: "b", text: "少侠答应梅朵去看大草甸的赛马。" },
  { id: "c", text: "少侠在镇口打服了赫连铸。" },
];
const CFG = { endpoint: "https://x.com/v1", apiKey: "k" };

describe("缺条件时不发请求（省一次白调用）", () => {
  it.each([
    ["没端点", { apiKey: "k" }],
    ["没key", { endpoint: "https://x.com/v1" }],
  ])("%s → null", async (_l, cfg) => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await rerank("找羊", CANDS, cfg)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("候选少于2条没有排的意义 → null 且不请求", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await rerank("找羊", [CANDS[0]], CFG)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("空查询 → null", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await rerank("", CANDS, CFG)).toBeNull();
  });
});

describe("正常精排", () => {
  it("按 relevance_score 降序、映射回 id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [
        { index: 1, relevance_score: 0.4 },
        { index: 0, relevance_score: 0.9 },
        { index: 2, relevance_score: 0.2 },
      ] }),
    })));
    const r = await rerank("我答应过才旦什么", CANDS, CFG);
    expect(r.map(x => x.id)).toEqual(["a", "b", "c"]);
    expect(r[0].score).toBe(0.9);
  });

  it("兼容 {data:[...]} 形态", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ index: 2, score: 0.8 }, { index: 0, score: 0.3 }] }),
    })));
    expect((await rerank("赫连铸", CANDS, CFG)).map(x => x.id)).toEqual(["c", "a"]);
  });

  it("minScore 过滤掉不相关的", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [
        { index: 0, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.02 },
      ] }),
    })));
    const r = await rerank("找羊", CANDS, { ...CFG, minScore: 0.1 });
    expect(r.map(x => x.id)).toEqual(["a"]);
  });
});

describe("绝不阻断主流程：一切异常都回退 null", () => {
  it("HTTP 非 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    expect(await rerank("x", CANDS, CFG)).toBeNull();
  });
  it("网络抛错", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await rerank("x", CANDS, CFG)).toBeNull();
  });
  it("返回体解析不了", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => { throw new Error("bad json"); } })));
    expect(await rerank("x", CANDS, CFG)).toBeNull();
  });
  it("返回体形状不认识", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ weird: 1 }) })));
    expect(await rerank("x", CANDS, CFG)).toBeNull();
  });
  it("全被 minScore 滤空 → 也回退（宁可用粗排也不要空召回）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ results: [{ index: 0, relevance_score: 0.01 }] }),
    })));
    expect(await rerank("x", CANDS, { ...CFG, minScore: 0.5 })).toBeNull();
  });
  it("index 越界的脏返回不炸", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ results: [{ index: 99, relevance_score: 0.9 }] }),
    })));
    expect(await rerank("x", CANDS, CFG)).toBeNull();
  });
});

describe("套回粗排列表", () => {
  const fused = [{ record: { id: "a" } }, { record: { id: "b" } }, { record: { id: "c" } }];

  it("命中的按精排顺序提前，未命中的按原序接后面", () => {
    const out = applyRerank(fused, [{ id: "c", score: 0.9 }, { id: "a", score: 0.5 }]);
    expect(out.map(x => x.record.id)).toEqual(["c", "a", "b"]);
  });

  it("精排为空/null 时原样返回（这是回退路径，必须无损）", () => {
    expect(applyRerank(fused, null).map(x => x.record.id)).toEqual(["a", "b", "c"]);
    expect(applyRerank(fused, []).map(x => x.record.id)).toEqual(["a", "b", "c"]);
  });

  it("不丢条目——未命中的只是排后面，由 topK 去截", () => {
    expect(applyRerank(fused, [{ id: "b", score: 1 }]).length).toBe(3);
  });
});

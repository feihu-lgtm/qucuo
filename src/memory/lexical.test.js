import { describe, it, expect } from "vitest";
import { extractTerms, buildIndex, lexicalRank, lengthFactor, bypassQuota, LEXICAL_BYPASS_CAP } from "./lexical.js";
import { recall } from "./recallEngine.js";

// 这一套钉的是「向量最弱的地方是专有名词」这件事。
// 参考姬侠传 char_card_1 module/memory-recall.js：它是三路 RRF（intent 0.6 /
// context 0.4 / 词法 0.5）+ cross-encoder 精排。我们此前只有前两路，
// 于是查"赫连铸"时，一条明写着赫连铸的纸条会排在三条"跟某个恶人打了一架"
// 后面——因为那三条整句话更像查询——然后被中间地带的实体过滤当噪声丢掉。

const MEM = [
  { id: "n1", text: "少侠在天都镇镇口打服了赫连铸，从他脖子上取下一把银灰色钥匙。", entities: ["赫连铸"] },
  { id: "n2", text: "少侠跟一个恶人在镇口打了一架，赢了。", entities: [] },
  { id: "n3", text: "少侠在锦官城宝丰拍卖行以450两拍得衔尾蛇门环。", entities: [] },
  { id: "n4", text: "少侠答应才旦帮他找回丢的羊。", entities: ["才旦"] },
  { id: "n5", text: "少侠拜入雪山派，何雨谢收下束脩。", entities: ["何雨谢"] },
];

describe("抽词", () => {
  it("中文按 2-4 字滑窗，长专名整段也进", () => {
    const t = extractTerms("衔尾蛇门环");
    expect(t.has("门环")).toBe(true);
    expect(t.has("衔尾蛇门环")).toBe(true);
  });
  it("西文/假名整串成词", () => {
    const t = extractTerms("她说了句 Wunderbar");
    expect(t.has("wunderbar")).toBe(true);
  });
  it("停用词与单字不进索引（否则等于索引全部）", () => {
    const t = extractTerms("他的");
    expect(t.has("的")).toBe(false);
    expect(t.has("他")).toBe(false);
  });
  it("少侠/旁白这类满篇都有的词不进（没有区分度）", () => {
    expect(extractTerms("少侠往北走").has("少侠")).toBe(false);
  });
  it("脏输入不炸", () => {
    for (const v of [null, undefined, "", 123]) expect(() => extractTerms(v)).not.toThrow();
  });
});

describe("倒排检索：明写了就一定找得到", () => {
  const idx = buildIndex(MEM);

  it("专名精确命中排第一", () => {
    expect(lexicalRank("赫连铸后来怎么了", idx)[0].id).toBe("n1");
    expect(lexicalRank("我答应过才旦什么", idx)[0].id).toBe("n4");
    expect(lexicalRank("那个门环是哪来的", idx)[0].id).toBe("n3");
  });

  it("idf 加权：罕见词比常见词值钱", () => {
    const rare = lexicalRank("衔尾蛇门环", idx)[0].score;
    const common = lexicalRank("少侠", idx);
    expect(rare).toBeGreaterThan(common[0]?.score || 0);
  });

  it("实体字段命中权重高于滑窗碎片", () => {
    // n1 的 赫连铸 在 entities 里（权重1），n2 没有任何实体
    const r = lexicalRank("赫连铸", idx);
    expect(r[0].id).toBe("n1");
  });

  it("查不到就返回空数组", () => {
    expect(lexicalRank("完全不相干的词句", idx)).toEqual([]);
    expect(lexicalRank("", idx)).toEqual([]);
  });

  it("空索引/脏索引不炸", () => {
    expect(lexicalRank("赫连铸", null)).toEqual([]);
    expect(() => buildIndex(null)).not.toThrow();
    expect(() => buildIndex([null, {}, { id: "x" }])).not.toThrow();
  });
});

describe("长度因子：短输入压低语义路权重", () => {
  it("越短越低，有下限 0.35", () => {
    expect(lengthFactor(0)).toBeCloseTo(0.35);
    expect(lengthFactor(2)).toBeLessThan(0.45);
    expect(lengthFactor(60)).toBeCloseTo(1.0);
    expect(lengthFactor(999)).toBeCloseTo(1.0);
  });
  it("单调不减", () => {
    let last = 0;
    for (let n = 0; n <= 80; n += 5) {
      const f = lengthFactor(n);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });
  it("脏输入回落到下限", () => {
    expect(lengthFactor(null)).toBeCloseTo(0.35);
    expect(lengthFactor(NaN)).toBeCloseTo(0.35);
  });
});

describe("旁路名额有上限（不封顶则一个常见词就刷满结果）", () => {
  it("按全量 20% 算，且不超过绝对上限", () => {
    expect(bypassQuota(5)).toBe(1);
    expect(bypassQuota(10)).toBe(2);
    expect(bypassQuota(1000)).toBe(LEXICAL_BYPASS_CAP);
  });
  it("空库为 0", () => {
    expect(bypassQuota(0)).toBe(0);
    expect(bypassQuota(null)).toBe(0);
  });
});

describe("三路融合：词法把语义分不足的精确命中救回来", () => {
  const V = (x) => new Float32Array([x, 1 - x]);
  // 刻意让"泛泛那条"(n2)在向量上最像查询，明写赫连铸那条(n1)分数不足
  const mem = MEM.map((m, i) => ({ ...m, _vec: V([0.45, 0.95, 0.3, 0.2, 0.25][i]) }));
  const q = V(0.95);

  it("传了 intentText → 明写专名的那条进得来", () => {
    const r = recall({ memories: mem, qIntentVec: q, qContextVec: null, topK: 4, intentText: "赫连铸后来怎么了" });
    expect(r.map(x => x.record.id)).toContain("n1");
  });

  it("不传 intentText → 退化成纯向量，行为与加词法路之前一致（向后兼容）", () => {
    const r = recall({ memories: mem, qIntentVec: q, qContextVec: null, topK: 4 });
    expect(r.every(x => x.tier !== "lexical")).toBe(true);
  });

  it("tier 能看出这条是怎么进来的（供 trace 排查）", () => {
    const r = recall({ memories: mem, qIntentVec: q, qContextVec: null, topK: 5, intentText: "衔尾蛇门环" });
    expect(r.map(x => x.tier).every(t => ["strong", "weak", "lexical"].includes(t))).toBe(true);
  });

  it("空记忆库返回空，不炸", () => {
    expect(recall({ memories: [], qIntentVec: q, intentText: "赫连铸" })).toEqual([]);
    expect(recall({ memories: null, qIntentVec: q, intentText: "赫连铸" })).toEqual([]);
  });

  it("完全没有查询向量时仍能靠词法出结果", () => {
    const r = recall({ memories: mem, qIntentVec: null, qContextVec: null, topK: 3, intentText: "才旦" });
    expect(r.map(x => x.record.id)).toContain("n4");
  });
});

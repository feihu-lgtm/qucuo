import { describe, it, expect } from "vitest";
import { createClapboardEntry, filterEntriesForViewer, renderClapboardSection, CLAPBOARD_KINDS } from "./clapboard.js";

const RAW = {
  kind: "raw_memory", turn: 18, location: "雪山派·演武场",
  witnesses: ["主角", "呼延雪"], entities: ["呼延雪", "it_cat_duannian"],
  publicText: "呼延雪将断念剑拍在石桌上，「三日后若还练不出剑气，莫怪我翻脸。」",
  rawText: "呼延雪将断念剑拍在石桌上，*这蠢材若死在山下倒省心*，「三日后若还练不出剑气，莫怪我翻脸。」",
  importance: 2,
};

describe("createClapboardEntry 规范化", () => {
  it("显式 id 保留；缺 id 按 kind 前缀推导", () => {
    expect(createClapboardEntry({ ...RAW, id: "P18_2" }).id).toBe("P18_2");
    expect(createClapboardEntry({ ...RAW, turn: 18, seq: 2 }).id).toBe("P18_2");
    expect(createClapboardEntry({ kind: "fact_index", turn: 42, seq: 1 }).id).toBe("F42_1");
    expect(createClapboardEntry({ kind: "pact", turn: 42, seq: 3 }).id).toBe("pact_42_3");
    expect(createClapboardEntry({ kind: "prep_seed", turn: 7, seq: 1 }).id).toBe("prep_7_1");
    expect(createClapboardEntry({ kind: "prep_seed", stateVersion: "abc123", seq: 2 }).id).toBe("prep_abc123_2");
    expect(createClapboardEntry({ kind: "prep_seed", stateVersion: 42, seq: 3 }).id).toBe("prep_42_3");
  });

  it("非法 kind 降级 fact_index，不丢事实；importance 钳 1-3", () => {
    expect(createClapboardEntry({ kind: "不存在", turn: 1, seq: 1 }).kind).toBe("fact_index");
    expect(createClapboardEntry({ kind: "pact", importance: 9 }).importance).toBe(1);
    expect(createClapboardEntry({ kind: "pact", importance: 3 }).importance).toBe(3);
  });

  it("数组字段拷贝、缺省为空数组；kind 枚举冻结", () => {
    const e = createClapboardEntry(RAW);
    expect(e.witnesses).toEqual(["主角", "呼延雪"]);
    expect(e.witnesses).not.toBe(RAW.witnesses);
    expect(createClapboardEntry({}).witnesses).toEqual([]);
    expect(CLAPBOARD_KINDS).toContain("raw_memory");
    expect(CLAPBOARD_KINDS).toContain("quest_slip");
  });
});

describe("filterEntriesForViewer 知情过滤", () => {
  const secret = createClapboardEntry(RAW);
  const pub = createClapboardEntry({ kind: "fact_index", turn: 1, seq: 1, rawText: "集上市集开了。", witnesses: [] });
  const star = createClapboardEntry({ kind: "fact_index", turn: 1, seq: 2, rawText: "雪山派招徒。", witnesses: ["*"] });
  const entries = [secret, pub, star];

  it("player/narrator/主角 看全集且原文不动", () => {
    for (const v of ["player", "narrator", "主角"]) {
      const out = filterEntriesForViewer(entries, v);
      expect(out).toHaveLength(3);
      expect(out[0].rawText).toContain("这蠢材");
    }
  });

  it("在场 NPC：看公共常识+含自己名的条目，raw_memory 只读 publicText", () => {
    const out = filterEntriesForViewer(entries, "呼延雪");
    expect(out).toHaveLength(3);
    const mem = out.find((e) => e.kind === "raw_memory");
    expect(mem.rawText).not.toContain("这蠢材");
    expect(mem.rawText).toBe(mem.publicText);
  });

  it("局外 NPC：看不到非公共条目", () => {
    const out = filterEntriesForViewer(entries, "才旦");
    expect(out.map((e) => e.id)).toEqual([pub.id, star.id]);
  });

  it("非数组输入返回空数组", () => {
    expect(filterEntriesForViewer(null, "才旦")).toEqual([]);
  });
});

describe("renderClapboardSection 预算渲染", () => {
  const mk = (id, importance, turn, text) => createClapboardEntry({ id, kind: "fact_index", importance, turn, seq: 1, rawText: text });
  const entries = [
    mk("F1_1", 1, 1, "寻常小事一桩。"),
    mk("F2_1", 3, 2, "刻骨大事一桩。"),
    mk("F3_1", 2, 3, "要紧中事一桩。"),
  ];

  it("预算充足全装，按重要性排序输出", () => {
    const out = renderClapboardSection(entries, 999);
    expect(out).toContain("刻骨大事");
    expect(out.indexOf("刻骨大事")).toBeLessThan(out.indexOf("要紧中事"));
    expect(out.indexOf("要紧中事")).toBeLessThan(out.indexOf("寻常小事"));
  });

  it("预算紧张先丢低重要性条目", () => {
    const full = renderClapboardSection(entries, 999);
    const tight = renderClapboardSection(entries, full.split("\n")[0].length + 2);
    expect(tight).toContain("刻骨大事");
    expect(tight).not.toContain("寻常小事");
  });

  it("一条都装不下返回空串；空输入返回空串", () => {
    expect(renderClapboardSection(entries, 2)).toBe("");
    expect(renderClapboardSection([], 999)).toBe("");
    expect(renderClapboardSection(null, 999)).toBe("");
  });

  it("NPC 过滤后的条目渲染不泄心理描写", () => {
    const filtered = filterEntriesForViewer([createClapboardEntry(RAW)], "呼延雪");
    const out = renderClapboardSection(filtered, 999);
    expect(out).not.toContain("这蠢材");
    expect(out).toContain("断念剑");
  });
});

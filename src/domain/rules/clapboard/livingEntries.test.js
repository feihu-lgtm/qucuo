import { describe, expect, it } from "vitest";
import { buildLivingClapboardEntries } from "./livingEntries.js";
import { filterEntriesForViewer, CLAPBOARD_KINDS } from "./clapboard.js";

const VAR_TREE = {
  世界: {
    知识领域: {
      事实: {
        fact_smith: { id: "fact_smith", 摘要: "铁匠铺新来了一批好钢。", 诞生回合: 12, 标签: "市井", 知晓者: { 才旦: { 途径: "目击", 得知回合: 12 } } },
        fact_secret: { id: "fact_secret", 摘要: "北库里藏着官银。", 诞生回合: 20, 知晓者: { 老孙: { 途径: "告知", 得知回合: 20 } } },
        fact_blank: { id: "fact_blank", 摘要: "", 诞生回合: 1, 知晓者: {} },
      },
    },
    契约: {
      才旦: {
        hunt: { promise: "三日内带一张雪豹皮来", bindTurn: 30, deadlineHours: 72, settled: false },
      },
    },
    宿敌谱: {
      黑风寨: {
        entries: {
          e1: { id: "e1", name: "疤脸刘", status: "active", tier: 2, grudge: 3, firstTurn: 40 },
          e2: { id: "e2", name: "已死者", status: "dead", tier: 1, grudge: 5, firstTurn: 10 },
        },
      },
    },
  },
};

describe("buildLivingClapboardEntries", () => {
  it("三本账规范化为冻结 ClapboardEntry，kind 全部出自冻结枚举", () => {
    const entries = buildLivingClapboardEntries({ varTree: VAR_TREE, time: 50 });
    expect(Object.isFrozen(entries)).toBe(true);
    expect(entries.length).toBe(4); // 2 事实（空摘要不上板）+ 1 契约 + 1 宿敌（死者不上板）
    for (const e of entries) expect(CLAPBOARD_KINDS).toContain(e.kind);
    expect(entries.map((e) => e.kind).sort()).toEqual(["fact_index", "fact_index", "nemesis", "pact"]);
  });

  it("事实条目 witnesses=知晓者名单——不知情者在过滤层天然不可见", () => {
    const entries = buildLivingClapboardEntries({ varTree: VAR_TREE });
    const factSecret = entries.find((e) => e.id === "fact_fact_secret");
    expect(factSecret.witnesses).toEqual(["老孙"]);
    // 才旦视角看不到老孙的密事；老孙视角能看到
    expect(filterEntriesForViewer(entries, "才旦").some((e) => e.id === "fact_fact_secret")).toBe(false);
    expect(filterEntriesForViewer(entries, "老孙").some((e) => e.id === "fact_fact_secret")).toBe(true);
  });

  it("契约带履约状态、宿敌只有 active 上板且仅本人在见证名单", () => {
    const entries = buildLivingClapboardEntries({ varTree: VAR_TREE });
    const pact = entries.find((e) => e.kind === "pact");
    expect(pact.publicText).toContain("在约");
    expect(pact.publicText).toContain("雪豹皮");
    const nemesis = entries.find((e) => e.kind === "nemesis");
    expect(nemesis.publicText).toContain("疤脸刘");
    expect(nemesis.witnesses).toEqual(["疤脸刘"]);
    expect(entries.some((e) => e.publicText.includes("已死者"))).toBe(false);
  });

  it("visibleNpcNames 预算闸门：与在场者无关的私密条目不出列，公共条目不受影响", () => {
    // 在场只有才旦：老孙的密事与疤脸刘的宿敌条不出列，才旦知道的铁匠事实与契约在列
    const entries = buildLivingClapboardEntries({ varTree: VAR_TREE, visibleNpcNames: ["才旦"] });
    expect(entries.some((e) => e.id === "fact_fact_smith")).toBe(true);
    expect(entries.some((e) => e.id === "fact_fact_secret")).toBe(false);
    expect(entries.some((e) => e.kind === "nemesis")).toBe(false);
    expect(entries.some((e) => e.kind === "pact")).toBe(true);
    // 不传则全量出列
    expect(buildLivingClapboardEntries({ varTree: VAR_TREE }).length).toBe(4);
  });

  it("空 varTree / 缺键零报错返回空冻结数组", () => {
    expect(buildLivingClapboardEntries({})).toEqual([]);
    expect(buildLivingClapboardEntries({ varTree: { 世界: {} } })).toEqual([]);
  });
});

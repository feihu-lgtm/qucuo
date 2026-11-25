import { beforeEach, describe, expect, it } from "vitest";
import { formatRecallEntries } from "./recallBlock.js";

describe("formatRecallEntries", () => {
  it("deduplicates memories already present in recent conversation window and truncates weak entries", () => {
    const recallInfo = {
      visible: [
        { text: "少侠在鱼定村茶馆外救下一只三花猫", tier: "strong", meta: { turn: 5 } },
        {
          text: "这是一段早已滑出对话窗口的弱相关极长旧事内容用于测试截断长度超过四十个字的边界行为是否精确执行",
          tier: "weak",
          meta: { turn: 9 },
        },
      ],
      filtered: 0,
    };

    const { recallInfo: deduped, recallBlock } = formatRecallEntries(recallInfo, {
      recentTexts: ["少侠在鱼定村茶馆外救下一只三花猫，之后回到村口。"],
    });

    expect(deduped.visible).toHaveLength(1);
    expect(deduped.deduped).toBe(1);
    expect(recallBlock).toContain("· （第9回合）");
    expect(recallBlock).toContain("…");
    expect(recallBlock).not.toContain("三花猫");
  });

  it("returns empty recallBlock when all visible entries are covered by recent window", () => {
    const recallInfo = {
      visible: [{ text: "昨夜在白塔见过才旦", tier: "strong", meta: { turn: 12 } }],
      filtered: 0,
    };
    const res = formatRecallEntries(recallInfo, {
      recentTexts: ["你回想起昨夜在白塔见过才旦。"],
    });
    expect(res.recallBlock).toBe("");
    expect(res.recallInfo.deduped).toBe(1);
  });
});

// ── WO-18 原文段落混排 ─────────────────────────────────────────────
import { IDBFactory } from "fake-indexeddb";
import { addProseChunks } from "../../infra/proseStore.js";
import { _resetMemoryDbForTest } from "../../infra/memoryDb.js";
import { recallProse } from "./recallBlock.js";
import { runFormattedRecall } from "./recallBlock.js";

describe("WO-18 原文段落召回混排", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });

  const seed = async () => addProseChunks([
    { id: "P5_1", kind: "raw_memory", turn: 5, location: "铁匠铺", witnesses: ["主角", "赫连铸"], entities: ["赫连铸"], publicText: "赫连铸把短剑递给你，说此剑染过血。", rawText: "x", importance: 2, anchorFactIds: [] },
    { id: "P5_2", kind: "raw_memory", turn: 5, location: "铁匠铺", witnesses: ["主角", "赫连铸"], entities: [], publicText: "你收下了剑。", rawText: "x", importance: 1, anchorFactIds: [] },
    { id: "P7_1", kind: "raw_memory", turn: 7, location: "密室", witnesses: ["慕轻烟", "燕孤鸿"], entities: [], publicText: "两人密谋劫镖。", rawText: "x", importance: 1, anchorFactIds: [] },
  ]);

  it("recallProse 词法命中+邻段连带+witnesses 硬过滤", async () => {
    await seed();
    const out = await recallProse({ queryText: "赫连铸的短剑", viewer: "主角" });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].text).toContain("短剑");
    // 邻段 P5_2 连带合并
    expect(out[0].text).toContain("你收下了剑");
    // 玩家未见证的密谋段永不出现
    expect(out.flatMap((e) => e.ids)).not.toContain("P7_1");
  });

  it("慕轻烟视角能看到密谋段", async () => {
    await seed();
    const out = await recallProse({ queryText: "劫镖", viewer: "慕轻烟" });
    expect(out.flatMap((e) => e.ids)).toContain("P7_1");
  });

  it("未开向量开关也有段落场记板（runFormattedRecall 无 embedding 不空）", async () => {
    await seed();
    const r = await runFormattedRecall({ apiCfg: {}, queryText: "赫连铸", viewer: "主角" });
    expect(r.recallBlock).toContain("短剑");
    expect(r.recallBlock).toContain("〔第5回合〕");
  });

  it("近期窗口已出现的原文不再重复入场", async () => {
    await seed();
    const dup = "赫连铸把短剑递给你，说此剑染过血。";
    const r = await runFormattedRecall({ apiCfg: {}, queryText: "赫连铸", viewer: "主角", recentTexts: [dup] });
    expect(r.recallBlock).not.toContain("短剑");
  });

  it("超预算时 weak 项退单行、长文块收缩", async () => {
    await seed();
    const r = await runFormattedRecall({ apiCfg: {}, queryText: "赫连铸", viewer: "主角", budgetChars: 10 });
    // 预算极小：最多只剩收缩后的首段，且整体行数受限
    expect(r.recallBlock.length).toBeLessThan(200);
  });
});

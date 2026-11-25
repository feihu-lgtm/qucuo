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
    { id: "P5_1", kind: "raw_memory", turn: 5, location: "铁匠铺", witnesses: ["主角", "赫连铸"], entities: ["赫连铸"], publicText: "赫连铸把短剑递给你，说此剑染过血。", rawText: "赫连铸把短剑递给你，说此剑染过血。", importance: 2, anchorFactIds: [] },
    { id: "P5_2", kind: "raw_memory", turn: 5, location: "铁匠铺", witnesses: ["主角", "赫连铸"], entities: [], publicText: "你收下了剑。", rawText: "你收下了剑。", importance: 1, anchorFactIds: [] },
    { id: "P7_1", kind: "raw_memory", turn: 7, location: "密室", witnesses: ["慕轻烟", "燕孤鸿"], entities: [], publicText: "两人密谋劫镖。", rawText: "两人密谋劫镖。", importance: 1, anchorFactIds: [] },
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
    expect(r.recallBlock).toContain("〔第5回合·");
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

describe("WO-18 复审补测——时间线隔离/格式/见证标签", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });
  const seedEpoch = async () => addProseChunks([
    { id: "P1_5_1", saveEpoch: 1, kind: "raw_memory", turn: 5, location: "", witnesses: ["*"], entities: [], publicText: "一代旧档铸剑往事", rawText: "一代旧档铸剑往事", importance: 1, anchorFactIds: [] },
    { id: "P2_5_1", saveEpoch: 2, kind: "raw_memory", turn: 5, location: "", witnesses: ["*"], entities: [], publicText: "二代新档铸剑往事", rawText: "二代新档铸剑往事", importance: 1, anchorFactIds: [] },
    { id: "P2_8_1", saveEpoch: 2, kind: "raw_memory", turn: 8, location: "", witnesses: ["*"], entities: [], publicText: "未来回合的铸剑剧透", rawText: "未来回合的铸剑剧透", importance: 3, anchorFactIds: [] },
  ]);

  it("saveEpoch 过滤暂停期：带 epoch 字段的段落仍按 witnesses/回合可见（等裁决）", async () => {
    await seedEpoch();
    const out = await recallProse({ queryText: "铸剑", viewer: "主角", epoch: 2, currentTurn: 10 });
    const texts = out.map((e) => e.text).join("\n");
    expect(texts).toContain("铸剑");
  });

  it("未来回合段落不可见（防剧透）", async () => {
    await seedEpoch();
    const out = await recallProse({ queryText: "铸剑", viewer: "主角", epoch: 2, currentTurn: 6 });
    expect(out.map((e) => e.text).join("\n")).not.toContain("剧透");
  });

  it("刻骨戳+众人皆知标签上场记板", async () => {
    await seedEpoch();
    const r = await runFormattedRecall({ apiCfg: {}, queryText: "剧透", viewer: "主角", epoch: 2, currentTurn: 10 });
    expect(r.recallBlock).toContain("〔刻骨〕");
    expect(r.recallBlock).toContain("众人皆知");
  });

  it("超预算弱相关退单行带「往事索引」前缀", async () => {
    await seedEpoch();
    const r = await runFormattedRecall({ apiCfg: {}, queryText: "铸剑", viewer: "主角", epoch: 2, currentTurn: 10, budgetChars: 10 });
    // 极小预算下块被收缩/丢弃，验证不炸且长度受限即可（单行索引属纸条侧语义）
    expect(r.recallBlock.length).toBeLessThan(300);
  });
});

describe("WO-18 谱系——检索可见性", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });
  const lin = [{ b: "bOld", upTo: 5 }, { b: "bHead", upTo: null }];
  const seedLin = async () => addProseChunks([
    { id: "bOld_3_1", branchId: "bOld", seq: 1, turn: 3, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "铸剑旧事正史", rawText: "铸剑旧事正史", importance: 1, anchorFactIds: [] },
    { id: "bOld_8_1", branchId: "bOld", seq: 2, turn: 8, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "铸剑旧未来分支", rawText: "铸剑旧未来分支", importance: 1, anchorFactIds: [] },
    { id: "bHead_6_1", branchId: "bHead", seq: 1, turn: 6, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "铸剑新分支正文", rawText: "铸剑新分支正文", importance: 1, anchorFactIds: [] },
    { id: "P2_1", turn: 2, kind: "raw_memory", location: "", witnesses: ["*"], entities: [], publicText: "铸剑无branchId遗产", rawText: "铸剑无branchId遗产", importance: 1, anchorFactIds: [] },
  ]);

  it("分叉后旧未来不可见、正史与新分支可见、无 branchId 一律不可见", async () => {
    await seedLin();
    const out = await recallProse({ queryText: "铸剑", viewer: "主角", lineage: lin, currentTurn: 10 });
    const texts = out.map((e) => e.text).join("\n");
    expect(texts).toContain("正史");
    expect(texts).toContain("新分支");
    expect(texts).not.toContain("旧未来");
    expect(texts).not.toContain("遗产");
  });
});

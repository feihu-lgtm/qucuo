import { describe, expect, it } from "vitest";
import { buildNpcSoulFrames, renderNpcSoulFrames } from "./npcSoulFrame.js";
import { createClapboardEntry, filterEntriesForViewer } from "./clapboard.js";

const NPCS = [
  { name: "才旦", personality: "爽朗直率", brief: "猎户" },
  { name: "老孙", personality: "精明算计", brief: "饭馆掌柜" },
];

const VAR_TREE = {
  角色: {
    才旦: { 好感度: 65, 生气状态: { active: true, reason: "被偷了东西" }, 旧账: { lines: ["欠少侠一壶酒"] } },
  },
};

describe("buildNpcSoulFrames", () => {
  it("每位在场角色一个独立分块，含性情禁忌/时辰营生/社交体温", () => {
    const frames = buildNpcSoulFrames({ visibleNpcs: NPCS, varTree: VAR_TREE, time: 10 });
    expect(frames).toHaveLength(2);
    const caidan = frames.find((f) => f.name === "才旦");
    expect(caidan.text).toContain("爽朗直率");
    expect(caidan.text).toContain("忌拐弯抹角");
    expect(caidan.text).toContain("颇为亲近");
    expect(caidan.text).toContain("气头上");
    expect(caidan.text).toContain("欠少侠一壶酒");
    const laosun = frames.find((f) => f.name === "老孙");
    expect(laosun.text).toContain("照看铺面");
    expect(laosun.text).toContain("算盘");
    expect(laosun.text).toContain("素不相识");
  });

  it("时辰营生：白天看铺、夜里盘账", () => {
    const day = buildNpcSoulFrames({ visibleNpcs: [NPCS[1]], varTree: {}, time: 10 })[0];
    expect(day.text).toContain("照看铺面");
    const night = buildNpcSoulFrames({ visibleNpcs: [NPCS[1]], varTree: {}, time: 22 })[0];
    expect(night.text).toContain("盘账");
  });

  it("场记板条目按角色视角过滤，他人心理 rawText 不泄", () => {
    const entries = [
      createClapboardEntry({
        kind: "raw_memory", turn: 3, seq: 1, witnesses: ["主角", "呼延雪"],
        publicText: "呼延雪把剑拍在桌上。",
        rawText: "呼延雪把剑拍在桌上，*这蠢材*。",
      }),
      createClapboardEntry({
        kind: "raw_memory", turn: 3, seq: 2, witnesses: ["主角", "才旦"],
        publicText: "才旦大笑三声。",
        rawText: "才旦大笑三声，*总算出了口气*。",
      }),
    ];
    const frames = buildNpcSoulFrames({ visibleNpcs: [NPCS[0]], varTree: {}, time: 10, clapboardEntries: entries });
    const text = frames[0].text;
    // 才旦只见自己见证的条目；呼延雪那条不可见
    expect(text).toContain("才旦大笑三声");
    expect(text).not.toContain("呼延雪");
    // 心理活动（*...*）绝不外泄
    expect(text).not.toContain("总算出了口气");
  });

  it("无场记板条目时不挂所见层；renderNpcSoulFrames 拼接分块", () => {
    const frames = buildNpcSoulFrames({ visibleNpcs: NPCS, varTree: {}, time: 10 });
    expect(frames[0].text).not.toContain("其所知所见");
    const joined = renderNpcSoulFrames({ visibleNpcs: NPCS, varTree: VAR_TREE, time: 10 });
    expect(joined.split("\n")).toHaveLength(2);
    expect(joined).toContain("【才旦】");
  });

  it("空输入不崩", () => {
    expect(buildNpcSoulFrames({})).toEqual([]);
    expect(renderNpcSoulFrames({})).toBe("");
  });

  it("WO-25A：心账按最近 2 条恩怨渲染（不再是读空的 旧账.lines 错位路径）", () => {
    const vt = {
      角色: {
        才旦: {
          好感度: 65,
          心账: [
            { tag: "恩", summary: "雪夜赠过一件皮袄", turn: 10 },
            { tag: "怨", summary: "酒后失言揭了他的短", turn: 20 },
            { tag: "见", summary: "村口打过照面", turn: 30 },
          ],
        },
      },
    };
    const frame = buildNpcSoulFrames({ visibleNpcs: [NPCS[0]], varTree: vt, time: 10 })[0];
    expect(frame.text).toContain("心里记着账");
    // 恩怨类优先于流水见闻：最新两条恩怨上屏
    expect(frame.text).toContain("怨——酒后失言揭了他的短");
    expect(frame.text).toContain("恩——雪夜赠过一件皮袄");
    expect(frame.text).not.toContain("村口打过照面");
  });

  it("WO-25A：带伤/名器时装束与伤势渲染准确", () => {
    const npc = {
      ...NPCS[0],
      carriedItems: [
        { name: "寒锋七星剑", category: "weapon", slot: "equipment" },
        { name: "牛皮护甲", category: "armor", slot: "equipment" },
      ],
    };
    const vt = { 世界: { 人物动态: { 才旦: { hpRatio: 0.55 } } }, 角色: {} };
    const frame = buildNpcSoulFrames({ visibleNpcs: [npc], varTree: vt, time: 10 })[0];
    expect(frame.text).toContain("装束：寒锋七星剑、牛皮护甲");
    expect(frame.text).toContain("负伤不轻");
    // hpRatio 接近满血或无记录时不展开
    const well = buildNpcSoulFrames({ visibleNpcs: [npc], varTree: { 世界: { 人物动态: { 才旦: { hpRatio: 1 } } } }, time: 10 })[0];
    expect(well.text).not.toContain("伤势沉重");
    expect(well.text).not.toContain("负伤");
  });

  it("WO-25A：非 witnesses 角色 filterEntriesForViewer 绝不泄密别人心理原文", () => {
    const secret = createClapboardEntry({
      kind: "raw_memory", turn: 5, seq: 1, witnesses: ["主角", "呼延雪"],
      publicText: "呼延雪收了剑。",
      rawText: "呼延雪收了剑，*这蠢材也配*。",
    });
    const visible = filterEntriesForViewer([secret], "才旦");
    expect(visible).toHaveLength(0);
    // 目击者本人也只能读到 publicText 覆写后的 rawText
    const selfView = filterEntriesForViewer([secret], "呼延雪");
    expect(selfView[0].rawText).toBe("呼延雪收了剑。");
    expect(JSON.stringify(selfView)).not.toContain("这蠢材也配");
  });
});

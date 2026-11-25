import { describe, expect, it } from "vitest";
import { buildNpcSoulFrames, renderNpcSoulFrames } from "./npcSoulFrame.js";
import { createClapboardEntry } from "./clapboard.js";

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
});

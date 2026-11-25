import { describe, it, expect } from "vitest";
import {
  initialVarTree, applyMvuCommands, isProtectedMvuPath, narratorVars, setNarratorVars,
} from "./mvu.js";

// 这套测试钉的是「AI 提议内容、系统裁决拓扑」这条第一法则在 MVU 层的落地。
//
// 背景（真实的洞）：applyMvuCommands 原本只校验路径**根**（角色/世界/主角），
// "世界" 底下全部自由可写；而 MVU 说明书还写着"其余世界状态按需自由声明"，
// 等于明说随便写。于是 AI 只要在 <mvu> 里写一句
//   _.set('世界.旁白.seaUnlocked', true);
// 就能把整条旁白个人线的门禁一句话开掉——不报错、无人察觉、玩家凭空得到
// 一个本该靠好感90+玄女点破才拿到的入口。

const apply = (cmds, tree = initialVarTree()) => applyMvuCommands(tree, cmds);

describe("系统裁决域：个人线进度不接受 AI 写入", () => {
  it.each([
    "世界.旁白",
    "世界.旁白.seaUnlocked",
    "世界.旁白.metXuannu",
    "世界.旁白.questStage",
    "世界.旁白.随便什么新字段",
  ])("%s 判定为受保护", (path) => {
    expect(isProtectedMvuPath(path)).toBe(true);
  });

  it.each([
    "世界.威望",
    "世界.天气",
    "世界.旁白者",       // 前缀相似但不是同一支，不能误伤
    "世界.旁白记录",
    "角色.玄女.好感度",
    "主角.心情",
  ])("%s 不受保护，照常可写", (path) => {
    expect(isProtectedMvuPath(path)).toBe(false);
  });

  it("AI 想开心灵之海门禁 → 被拒，值不变", () => {
    const { tree, applied, rejected } = apply([
      { op: "set", path: "世界.旁白.seaUnlocked", value: true },
    ]);
    expect(applied).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("系统裁决域");
    expect(narratorVars(tree).seaUnlocked).toBe(false);
  });

  it("AI 想把个人线直接推到终章 → 被拒", () => {
    const { tree, rejected } = apply([
      { op: "set", path: "世界.旁白.questStage", value: 7 },
      { op: "add", path: "世界.旁白.questStage", value: 5 },
    ]);
    expect(rejected).toHaveLength(2);
    expect(narratorVars(tree).questStage).toBe(0);
  });

  it("混在一堆合法指令里也照样只拦那一条", () => {
    const { applied, rejected } = apply([
      { op: "add", path: "角色.玄女.好感度", value: 5 },
      { op: "set", path: "世界.旁白.seaUnlocked", value: true },
      { op: "set", path: "世界.威望", value: 20 },
      { op: "set", path: "世界.天气", value: "雪" },
    ]);
    expect(applied.map(c => c.path)).toEqual(["角色.玄女.好感度", "世界.威望", "世界.天气"]);
    expect(rejected.map(c => c.path)).toEqual(["世界.旁白.seaUnlocked"]);
  });

  it("被拒的指令带得走原因（要能进 trace 给人看）", () => {
    const { rejected } = apply([{ op: "set", path: "世界.旁白.seaUnlocked", value: true }]);
    expect(rejected[0]).toMatchObject({ op: "set", path: "世界.旁白.seaUnlocked" });
    expect(typeof rejected[0].reason).toBe("string");
    expect(rejected[0].reason.length).toBeGreaterThan(0);
  });
});

describe("系统自己写是允许的（走 setNarratorVars 不走 MVU）", () => {
  it("系统绕过 MVU 直接写，写得进去", () => {
    const t = setNarratorVars(initialVarTree(), { seaUnlocked: true, questStage: 1 });
    expect(narratorVars(t).seaUnlocked).toBe(true);
    expect(narratorVars(t).questStage).toBe(1);
  });
  it("系统写完之后 AI 仍然改不动它", () => {
    const t = setNarratorVars(initialVarTree(), { seaUnlocked: true });
    const { tree, rejected } = apply([{ op: "set", path: "世界.旁白.seaUnlocked", value: false }], t);
    expect(rejected).toHaveLength(1);
    expect(narratorVars(tree).seaUnlocked).toBe(true); // 没被关掉
  });
});

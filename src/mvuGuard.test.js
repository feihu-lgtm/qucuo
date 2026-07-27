import { describe, it, expect } from "vitest";
import {
  initialVarTree, applyMvuCommands, isProtectedMvuPath,
  MVU_SYSTEM_INSTRUCTIONS, narratorVars, setNarratorVars,
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

describe("注入侧：说明书里要明写禁令", () => {
  it("MVU 说明书告知 AI 世界.旁白.* 不可写", () => {
    expect(MVU_SYSTEM_INSTRUCTIONS).toContain("世界.旁白");
    expect(MVU_SYSTEM_INSTRUCTIONS).toContain("禁写");
  });
  it("并说明写了会被丢弃（让它别白费 token）", () => {
    expect(MVU_SYSTEM_INSTRUCTIONS).toMatch(/丢弃|不生效|无权/);
  });
});

describe("原有裁剪行为不受影响（回归）", () => {
  it("好感度仍被限幅在 0-100、单次 ±15", () => {
    const { applied } = apply([{ op: "add", path: "角色.某某.好感度", value: 999 }]);
    expect(applied[0].actualDelta).toBeLessThanOrEqual(15);
    expect(applied[0].finalValue).toBeLessThanOrEqual(100);
  });
  it("威望仍被限幅在 -100~100", () => {
    const { applied } = apply([{ op: "set", path: "世界.威望", value: -9999 }]);
    expect(applied[0].finalValue).toBe(-100);
  });
  it("非法路径根仍被拒", () => {
    const { rejected } = apply([{ op: "set", path: "乱写.东西", value: 1 }]);
    expect(rejected[0].reason).toContain("路径根");
  });
  it("add 传非数字仍被拒", () => {
    const { rejected } = apply([{ op: "add", path: "角色.某某.好感度", value: "很多" }]);
    expect(rejected[0].reason).toContain("必须是数字");
  });
  it("applyMvuCommands 不就地改传入的树", () => {
    const t = initialVarTree();
    const snap = JSON.stringify(t);
    apply([{ op: "add", path: "角色.某某.好感度", value: 5 }], t);
    expect(JSON.stringify(t)).toBe(snap);
  });
});

// ── 双调用：禁写声明必须也到得了提取层 ────────────────────────────────
// 【为什么单独钉这一组】
// MVU 在两种调用模式下走的是完全不同的路：
//   单调用——主模型自己产 <mvu>，规矩由 MVU_SYSTEM_INSTRUCTIONS 随 schema 进 13 号位
//   双调用——主叙事只写散文、根本不注入那份说明书，MVU 的唯一落点是**提取层这一次调用**
// 所以禁写声明只加进 MVU_SYSTEM_INSTRUCTIONS 是不够的：七份要 mvu 字段的 spec 里
// 一份都不会提到它，提取模型从来不知道 世界.旁白.* 是禁区，会反复去写、被裁决层
// 反复丢弃，白烧 token 还在全流程日志里刷一串"被拒"。
// 这跟当初 memory/mentionedNewNpcs 在双调用下恒为 undefined 是同一个坑，
// 修法也一样：挂进 commonExtractTail，一处生效、全部 spec 覆盖。
import { buildExtractionSpecExample } from "./extractionEngine.js";

const ALL_SPECS = ["LOOK","MOVE","TALK_CASUAL","GIFT","COMPANION_INVITE","LEARN_SKILL","EXPLORE_ACTION","COMBAT","UNKNOWN"];

describe("提取层（调用2）也必须收到 MVU 路径规矩", () => {
  it.each(ALL_SPECS)("%s spec 含禁写声明", (k) => {
    expect(buildExtractionSpecExample(k)).toContain("世界.旁白");
  });

  it.each(ALL_SPECS)("%s spec 含三前缀路径规则", (k) => {
    expect(buildExtractionSpecExample(k)).toContain("角色 / 世界 / 主角");
  });

  it.each(["gift", "companion_invite", "learn_skill"])("settleKind:%s 专属 spec 同样覆盖", (sk) => {
    expect(buildExtractionSpecExample("UNKNOWN", sk)).toContain("世界.旁白");
  });

  it("明说写了会被丢弃（省得提取模型白试）", () => {
    expect(buildExtractionSpecExample("TALK_CASUAL")).toMatch(/丢弃/);
  });

  // 这条钉的是"面板与实际调用同构"——预览必须带上每次真实调用都会追加的公共尾巴。
  // 此前 buildExtractionSpecExample 只渲染 spec.user() 就返回，面板展示的 prompt
  // 比实际发出去的少了一整段（memory/mentionedNewNpcs 的要求玩家从没在面板上见过）。
  it("预览包含公共尾巴的全部三项（防面板与实际漂移）", () => {
    const t = buildExtractionSpecExample("LOOK");
    expect(t).toContain("memory");
    expect(t).toContain("mentionedNewNpcs");
    expect(t).toContain("mvu 字段的路径规矩");
  });
});

// ── 13/11 分工：形状归 prefill，约束归 user ────────────────────────────
// 【划分依据】不是"是不是规则"，而是"是不是输出格式本身"：
//   13 位(assistant，且是最后一条 = 真 prefill) = 我要开始写了 + 写成什么形状
//   11 位(user) = 我可以写什么、不可以写什么
// 【为什么】往真 prefill 里堆规则，模型容易把规则本身续写完就停了、不产正文。
// NSFW/GM 当初就是踩了这个坑才挪去 11 号位，但 846 字的 MVU 说明书当时漏了。
// 注：不能照抄姬侠传——它的 assistant 在第5位、后面还跟一条 user，那条不是最后
// 一条、不构成真 prefill，所以它塞 246 字规则没事。也不同于酒馆 PHI（system/user）。
import { buildSysBase } from "./sysBase.js";
import { initialNarratorState } from "./narrator.js";

const build = (narrativeOnly, scope, opts = {}) => buildSysBase(
  220, initialNarratorState(), "总纲", null, false, "", narrativeOnly, scope,
  { playerName: "少侠", hasNpc: true, ...opts },
);

describe("13 号位只留形状", () => {
  it.each([
    ["full", false, "full", {}],
    ["settle送礼", false, "settle", { settleNpc: "才旦", settleKind: "gift", giftInfo: { itemName: "剑", quality: "绿" } }],
    ["settle拜师", false, "settle", { settleNpc: "雪豹", settleKind: "learn_skill", learnInfo: { isMaster: true } }],
    ["双调用散文", true, "full", {}],
  ])("%s：phi 里不再有 MVU 说明书", (_l, nar, scope, opts) => {
    const { phiBlock } = build(nar, scope, opts);
    expect(phiBlock.content).not.toContain("<mvu>...</mvu>");
    expect(phiBlock.content).not.toContain("【禁写】");
  });

  it("phi 里也不再有送礼/拜师的世界观铁律", () => {
    const gift = build(false, "settle", { settleNpc: "才旦", settleKind: "gift", giftInfo: { itemName: "剑" } });
    expect(gift.phiBlock.content).not.toContain("送礼世界观铁律");
    const learn = build(false, "settle", { settleNpc: "雪豹", settleKind: "learn_skill", learnInfo: {} });
    expect(learn.phiBlock.content).not.toContain("授业传艺铁律");
  });

  it("但 JSON 骨架/散文声明这些「形状」必须留着", () => {
    expect(build(false, "full").phiBlock.content).toContain('"output"');
    expect(build(true, "full").phiBlock.content).toContain("直接输出叙事散文正文");
  });

  it("仍告知 <mvu> 要另起一行写，只是规则挪去了别处", () => {
    expect(build(false, "full").phiBlock.content).toMatch(/<mvu> 块/);
    expect(build(false, "full").phiBlock.content).toContain("见上文规则");
  });
});

describe("11 号位收下全部约束", () => {
  it("full：phiRules 含 MVU 说明书与禁写", () => {
    const { phiRules } = build(false, "full");
    expect(phiRules).toContain("<mvu>...</mvu>");
    expect(phiRules).toContain("【禁写】");
  });

  it("settle送礼：含铁律 + 幅度建议 + MVU说明书", () => {
    const { phiRules } = build(false, "settle", {
      settleNpc: "才旦", settleKind: "gift",
      giftInfo: { itemName: "青锋剑", quality: "绿", range: [4, 6], suggestedDelta: 5 },
    });
    expect(phiRules).toContain("送礼世界观铁律");
    expect(phiRules).toContain("+4~+6");
    expect(phiRules).toContain("<mvu>...</mvu>");
    expect(phiRules).toContain("这一轮必须给出");
  });

  it("settle无settleKind：措辞是软的「确有变化才给出」", () => {
    const { phiRules } = build(false, "settle", { settleNpc: "温掌柜" });
    expect(phiRules).toContain("确有变化才给出");
    expect(phiRules).not.toContain("这一轮必须给出");
  });

  it("双调用散文：叙事铁律在，MVU 一个字都没有（状态交提取层）", () => {
    const { phiRules } = build(true, "settle", {
      settleNpc: "才旦", settleKind: "gift", giftInfo: { itemName: "剑" },
    });
    expect(phiRules).toContain("送礼世界观铁律");
    expect(phiRules).not.toContain("<mvu>");
  });

  it("场上无人且非GM：不挂 MVU（wantMvu 为假）", () => {
    const { phiRules } = build(false, "full", { hasNpc: false });
    expect(phiRules).not.toContain("<mvu>...</mvu>");
  });
});

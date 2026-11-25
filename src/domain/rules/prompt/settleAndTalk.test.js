import { describe, it, expect, vi } from "vitest";
import { buildSysBase } from "./sysBase.js";
import { classifyIntent, INTENT } from "./inputIntent.js";

function wia(scope, narrativeOnly, opts = {}) {
  // WO-04：物件志/对话取物规范属动态块，已迁出 sysBlocks（worldInfoAfter 只剩
  // 认知隔离+地图铁律）——这里改为拼接 dynBlocks 中对应两块，钉的还是同一套挂载逻辑。
  const { dynBlocks } = buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "剧本总纲占位", null, false, "", narrativeOnly, scope,
    { playerName: "少侠", hasNpc: true, ...opts },
  );
  return [dynBlocks.catalog, dynBlocks.talkItemRule].filter(Boolean).join("\n");
}

describe("scope 物品规范挂载", () => {
  it("full+可发物：挂物件志，不挂对话规范", () => {
    const t = wia("full", false, { mayGrantItem: true });
    expect(t).toContain("曲措乡物件志");
    expect(t).not.toContain("对话轮的物品规范");
  });
  it("talk 单调用：灭物件志，挂对话规范（带 delta 措辞）", () => {
    const t = wia("talk", false);
    expect(t).not.toContain("曲措乡物件志");
    expect(t).toContain("对话轮的物品规范");
    expect(t).toContain("才写 delta");
  });
  it("talk 双调用：同样挂对话规范，但改成散文措辞不提 delta", () => {
    const t = wia("talk", true);
    expect(t).toContain("对话轮的物品规范");
    expect(t).not.toContain("写进 delta");
    expect(t).toContain("后续记账完全照正文来");
  });
  it("move/settle 都不挂对话规范", () => {
    expect(wia("move", false)).not.toContain("对话轮的物品规范");
    expect(wia("settle", false, { settleNpc: "雪豹" })).not.toContain("对话轮的物品规范");
  });
});

describe("拜师 learn_skill 铁律（0728 起改由 11 号位承载，不再在 phi 里）", () => {
  const mk = (narrativeOnly) => buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", narrativeOnly, "settle",
    {
      playerName: "少侠", settleNpc: "雪豹", settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "雪隐三绝", totalPrice: 0, beast: true },
    },
  );

  it("单调用：铁律+幅度区间+必给措辞，全在 phiRules（11位）", () => {
    const { phiRules, phiBlock } = mk(false);
    expect(phiRules).toContain("授业传艺铁律");
    expect(phiRules).toContain("+4~+8");
    expect(phiRules).toContain("_.add('角色.雪豹.好感度', 6)");
    expect(phiRules).toContain("本轮必须输出 <mvu> 且为正向增量");
    // 13 位只剩形状：JSON 骨架在、铁律不在
    expect(phiBlock.content).toContain('"output"');
    expect(phiBlock.content).not.toContain("授业传艺铁律");
  });

  it("双调用：叙事铁律在 phiRules，兽类师父不说人话；phi 仍明确禁产 mvu", () => {
    const { phiRules, phiBlock } = mk(true);
    expect(phiRules).toContain("授业传艺铁律");
    expect(phiRules).toContain("cannotSpeak");
    expect(phiRules).not.toContain("<mvu>");            // 散文模式状态交提取层
    expect(phiBlock.content).toContain("禁输出JSON、<mvu>块及任何结构化内容");
  });

  it("通用 settle（无 settleKind）仍是软措辞", () => {
    const { phiRules } = buildSysBase(220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", false, "settle",
      { playerName: "少侠", settleNpc: "温掌柜" });
    expect(phiRules).toContain("确有变化才给出");
    expect(phiRules).not.toContain("这一轮必须给出");
  });
});


describe("切磋邀战结算", () => {
  const build = (narrativeOnly) => buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", narrativeOnly, "settle",
    { playerName: "少侠", settleNpc: { name: "货郎阿吉" }, settleKind: "duel_invite" },
  );

  it("叙事只到接受邀战、摆开架势，明确在第一招前停止", () => {
    const { phiRules } = build(true);
    expect(phiRules).toContain("接受邀战");
    expect(phiRules).toContain("第一招交手之前立刻停止");
    expect(phiRules).toContain("严禁描写任何招式交锋、回合、伤势、胜负");
    expect(phiRules).toContain("切磋是否开始由玩家");
    expect(phiRules).not.toContain("[object Object]");
  });

  it("状态结算禁止任何 MVU 变化", () => {
    const { phiRules } = build(false);
    expect(phiRules).toContain("不得输出 <mvu>");
    expect(phiRules).toContain("不得修改气血、好感、物品或其他状态");
    expect(phiRules).not.toContain("关于下面那条 <mvu>");
    expect(phiRules).toContain("本轮没有任何状态变化");
  });


});

describe("AI duelRequest", () => {
  it("keeps duel vocabulary as combat-intent hints only", () => {
    expect(classifyIntent("切搓")).toEqual(INTENT.COMBAT);
    expect(classifyIntent("比武")).toEqual(INTENT.COMBAT);
  });

  it("full-mode schema requests only an accepted spar with a present NPC", () => {
    const { phiBlock, phiRules } = buildSysBase(
      220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", false, "full", { hasNpc: true },
    );
    expect(phiBlock.content).toContain('duelRequest（顶层）：仅玩家向在场NPC提切磋且对方应允开架时填"NPC名"');
    expect(phiBlock.content).toContain("拒绝/躲避/仅谈打斗须省略");
    expect(phiRules).toContain("战斗的招式交锋与胜负均由系统结算");
  });




});

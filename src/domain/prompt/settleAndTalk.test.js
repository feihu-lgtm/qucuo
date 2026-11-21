import { describe, it, expect, vi } from "vitest";
import { buildSysBase } from "./sysBase.js";
import { buildExtractionSpecExample, callExtraction, normalizeExtractedFields, SETTLE_KIND_SPECS } from "./extractionEngine.js";
import { classifyIntent, INTENT } from "./inputIntent.js";

function wia(scope, narrativeOnly, opts = {}) {
  const { sysBlocks } = buildSysBase(
    220, { stage: "NORMAL", affection: 20 }, "剧本总纲占位", null, false, "", narrativeOnly, scope,
    { playerName: "少侠", hasNpc: true, ...opts },
  );
  return sysBlocks.find(b => b.tavernBlock === "worldInfoAfter").content;
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
    expect(t).toContain("写进 delta");
  });
  it("talk 双调用：同样挂对话规范，但改成散文措辞不提 delta", () => {
    const t = wia("talk", true);
    expect(t).toContain("对话轮的物品规范");
    expect(t).not.toContain("写进 delta");
    expect(t).toContain("后续记账完全照这段正文来");
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
    expect(phiRules).toContain("这一轮必须给出");
    // 13 位只剩形状：JSON 骨架在、铁律不在
    expect(phiBlock.content).toContain('"output"');
    expect(phiBlock.content).not.toContain("授业传艺铁律");
  });

  it("双调用：叙事铁律在 phiRules，兽类师父不说人话；phi 仍明确禁产 mvu", () => {
    const { phiRules, phiBlock } = mk(true);
    expect(phiRules).toContain("授业传艺铁律");
    expect(phiRules).toContain("cannotSpeak");
    expect(phiRules).not.toContain("<mvu>");            // 散文模式状态交提取层
    expect(phiBlock.content).toContain("不要输出 <mvu> 块");
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
    { playerName: "少侠", settleNpc: { name: "才旦" }, settleKind: "duel_invite" },
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

  it("dual-call extraction returns a no-op without calling the model", async () => {
    const ai = { chat: vi.fn() };
    await expect(callExtraction("COMBAT", "邀战", { char: {} }, {}, {
      settleKind: "duel_invite", settleNpc: { name: "才旦" },
    }, ai)).resolves.toEqual({ p: {}, mvuCommands: [] });
    expect(ai.chat).not.toHaveBeenCalled();
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
    expect(phiBlock.content).toContain('"duelRequest":"NPC名"');
    expect(phiBlock.content).toContain("当前在场名单中的 NPC");
    expect(phiBlock.content).toContain("NPC 拒绝或躲避");
    expect(phiRules).toContain("任何战斗的招式交锋与胜负结果均由系统战斗结算");
  });

  it("duel-report prompt permits the requested report without opening another duel", () => {
    const duelReport = {
      rounds: [{
        round: 1,
        text: "陈尧天一记野球拳正中才旦",
        playerMove: { name: "野球拳", type: "攻击" },
        npcMove: { name: "铁布衫", type: "防御" },
        result: {
          nameA: "陈尧天",
          nameB: "才旦",
          damageToA: 0,
          damageToB: 3,
          statusDamageA: 0,
          statusDamageB: 0,
          hpRestoreA: 0,
          hpRestoreB: 0,
          dodgeSuccessA: false,
          dodgeSuccessB: false,
          hpAfterA: [60, 60],
          hpAfterB: [57, 60],
          hpBandA: "healthy",
          hpBandB: "healthy",
          statusAppliedToA: null,
          statusAppliedToB: "麻穴",
          markAppliedToA: null,
          markAppliedToB: null,
          statusSlotsAfterA: {},
          statusSlotsAfterB: { control: { name: "麻穴", duration: 2 } },
          statusLogA: [],
          statusLogB: ["才旦气机受阻"],
          worseName: "才旦",
        },
      }],
    };
    const { phiBlock, phiRules } = buildSysBase(
      220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", false, "full",
      { hasNpc: true, duelReport },
    );
    expect(phiBlock.content).toContain('"output"');
    expect(phiBlock.content).not.toContain('"duelRequest"');
    expect(phiRules).not.toContain("战斗叙事边界");
    expect(phiRules).toContain("恰好有N+1项");
    expect(phiRules).toContain("【第1回合】");
    expect(phiRules).toContain("【结局】");
    expect(phiRules).toContain("健旺（≥60%）");
    expect(phiRules).toContain("受创（25%–<60%）");
    expect(phiRules).toContain("将倒（<25%）");
    expect(phiRules).toContain("玩家与 NPC 一视同仁");
    expect(phiRules).toContain("回合后气血：A 60/60、B 57/60");
    expect(phiRules).toContain("HP带：A healthy、B healthy");
    expect(phiRules).toContain("当前状态：A {}、B {\"control\":{\"name\":\"麻穴\",\"duration\":2}}");
    expect(phiRules).toContain("状态日志：A []、B [\"才旦气机受阻\"]");

    const dual = buildSysBase(
      220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", true, "full",
      { hasNpc: true, duelReport },
    );
    expect(dual.phiRules).toContain("恰好分成N+1个段落");
    expect(dual.phiRules).toContain("受创（25%–<60%）");
  });

  it("duel-report missing paths reach the prompt trace callback", () => {
    const onDuelReportMissing = vi.fn();
    buildSysBase(
      220, { stage: "NORMAL", affection: 20 }, "x", null, false, "", false, "full",
      { duelReport: { rounds: [{ round: 1, result: {} }] }, onDuelReportMissing },
    );
    expect(onDuelReportMissing).toHaveBeenCalledWith(expect.arrayContaining([
      "第1回合 @round.playerMove.name",
      "第1回合 @round.result.hpAfterA",
    ]));
  });

  it("dual-call extraction prompt includes the accepted-spar rule", () => {
    const example = buildExtractionSpecExample("UNKNOWN");
    expect(example).toContain('"duelRequest"');
    expect(example).toContain("NPC 拒绝或躲避");
  });

  it("keeps only room-visible NPCs from either string or object form", () => {
    const presentNpc = { name: "才旦", innerRoom: "村口广场" };
    const absentNpc = { name: "老猎户" };
    const state = {
      room: { name: "鱼定村", npcs: [presentNpc, absentNpc] },
      innerRoomName: "村口广场",
    };
    expect(normalizeExtractedFields({ duelRequest: "才旦" }, state).duelRequest).toBe(presentNpc);
    expect(normalizeExtractedFields({ duelRequest: { name: "才旦" } }, state).duelRequest).toBe(presentNpc);
    expect(normalizeExtractedFields({ duelRequest: "老猎户" }, state)).not.toHaveProperty("duelRequest");
    expect(normalizeExtractedFields({ duelRequest: "无此人" }, state)).not.toHaveProperty("duelRequest");
  });
});

// ── 提取层（二调用）侧 ──────────────────────────────────────────────
describe("结算专属提取 spec 的路由", () => {
  it("所有 settleKind 都注册在映射表里", () => {
    expect(SETTLE_KIND_SPECS).toEqual({
      gift: "GIFT", companion_invite: "COMPANION_INVITE", learn_skill: "LEARN_SKILL",
      appease: "APPEASE",
    });
  });

  // 这三条钉的是"面板预览 == 实际调用"。示例快照里的每条 settle 都必须自带
  // settleKind，否则 buildExtractionSpecExample 查表落空、静默退回 UNKNOWN 通用
  // spec——面板会理直气壮地展示一份根本不会被调用的 prompt（曾经就是这样）。
  it("送礼预览命中 GIFT 而不是 UNKNOWN", () => {
    const t = buildExtractionSpecExample("UNKNOWN", "gift");
    expect(t).toContain("专门处理送礼场景");
    expect(t).not.toContain("从叙事中提取所有发生变化的游戏状态");
  });
  it("认主预览命中 COMPANION_INVITE", () => {
    expect(buildExtractionSpecExample("UNKNOWN", "companion_invite")).toContain("专门处理伙伴入队场景");
  });
  it("拜师预览命中 LEARN_SKILL，且铁律要求正向好感", () => {
    const t = buildExtractionSpecExample("UNKNOWN", "learn_skill");
    expect(t).toContain("专门处理拜师学艺场景");
    expect(t).toContain("只能上升、不得为 0 或负数");
    expect(t).toContain("_.add('角色.雪豹.好感度'");
  });
});

describe("对话提取 spec（talk 模式 0727 起改走这份）", () => {
  const t = buildExtractionSpecExample("TALK_CASUAL");
  it("给出物品的两个合法来源，替代整本物件志", () => {
    expect(t).toContain("在场人物与其随身之物");
    expect(t).toContain("玩家背包");
    expect(t).toContain("身无长物");
  });
  it("要 respondedNpcs——双调用下'对话即认识'全靠它", () => {
    expect(t).toContain("respondedNpcs");
  });
  it("好感与物品都只在叙事写明时才记", () => {
    expect(t).toContain("确有变化才写");
    expect(t).toContain("只是嘴上提起、许诺日后再给、纯寒暄，一律不记");
  });
});

// ── 心灵之海场景铁律的注入门禁 ────────────────────────────────────────
// 玩家进心灵之海之前，AI 拿到的只有房间 desc，压根不知道这是旁白的内心而非
// 曲措乡的某处：不知道这里只有她一个人、也不知道江湖那套规矩不作数。结果它会
// 照武侠说书人的惯性在这片海滩上安排路人、生出遭遇、发出物件，把一场一对一的
// 内心戏写成又一段江湖见闻。这组测试钉死"在海里必亮、不在海里一个字不发"。
import { buildSeaOfMindRule } from "../narrator/seaOfMind.js";

describe("心灵之海铁律", () => {
  const rule = buildSeaOfMindRule();

  it("说清这是内心不是地方", () => {
    expect(rule).toContain("这不是曲措乡的某处地方");
    expect(rule).toContain("身体还在他自己那间屋子里");
  });

  it("明令不许出现第三者（这是最容易被写坏的一条）", () => {
    expect(rule).toContain("绝不要安排任何第三者出现");
    expect(rule).toMatch(/没有路人|没有过客/);
  });

  it("关掉发物件/遭遇/采集", () => {
    expect(rule).toMatch(/不要在这里发放江湖物件/);
    expect(rule).toMatch(/不要触发遭遇/);
  });

  it("交代她叫不出那些现代物件的名字（说书人视角）", () => {
    expect(rule).toContain("她自己也叫不出名字");
    expect(rule).toMatch(/不要直接说出.*电视/);
  });

  it("只在海里注入，寻常轮次一个字不发", () => {
    const wia = (opts) => buildSysBase(
      220, { stage: "NORMAL", affection: 50 }, "x", null, false, "", false, "full",
      { playerName: "少侠", hasNpc: true, ...opts },
    ).sysBlocks.find(b => b.tavernBlock === "worldInfoAfter").content;
    expect(wia({ inSeaOfMind: true })).toContain("这不是曲措乡的某处地方");
    expect(wia({})).not.toContain("这不是曲措乡的某处地方");
    expect(wia({ inSeaOfMind: false })).not.toContain("这不是曲措乡的某处地方");
  });
});

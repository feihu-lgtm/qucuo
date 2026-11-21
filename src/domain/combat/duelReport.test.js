import { describe, expect, it } from "vitest";
import { applyEndOfTurnStatus, resolveTurn } from "./resolveTurn.js";
import { finalizeDuelRound } from "./finalizeDuelRound.js";
import {
  buildDuelReportRounds,
  formatDuelDisplayLine,
  interleaveDuelReport,
  renderDuelReportRounds,
  resolveDuelReportTemplate,
} from "./duelReport.js";
import { MUTUAL_CONTACTS, REACTION_POOLS } from "./duelPhrases/index.js";

describe("战报逐回合交错", () => {
  const rounds = [
    { round: 1, text: "第一招" },
    { round: 2, text: "第二招" },
    { round: 3, text: "第三招" },
  ];

  it("按三回合和结局交错，去掉显示标记", () => {
    const logs = interleaveDuelReport(rounds, [
      "【第1回合】他使掌法。",
      "【第2回合】我以剑招相迎。",
      "【第3回合】两人各退一步。",
      "【结局】最终罢手。",
    ]);

    expect(logs.map(({ t }) => t)).toEqual(["sys", "desc", "sys", "desc", "sys", "desc", "desc"]);
    expect(logs[1].text).toBe("他使掌法。");
    expect(logs.at(-1).text).toBe("最终罢手。");
    expect(logs.some(({ text }) => text?.includes("【第"))).toBe(false);
  });

  it.each([
    ["次序颠倒", ["【第2回合】乙", "【第1回合】甲", "【第3回合】丙", "【结局】止"]],
    ["缺少标记", ["甲", "乙", "丙", "【结局】止"]],
  ])("%s时先保留全部系统行，再原样保留AI全文", (_label, narrative) => {
    const logs = interleaveDuelReport(rounds, narrative);
    expect(logs.slice(0, 3).map(({ t }) => t)).toEqual(["sys", "sys", "sys"]);
    expect(logs.at(-1)).toEqual({ t: "desc", text: narrative.join("\n") });
  });

  it("双调用段落缺数时也回退并保留原文", () => {
    const narrative = "【第1回合】甲\n\n【结局】收招";
    expect(interleaveDuelReport(rounds, narrative)).toEqual([
      ...rounds.map(({ round, text }) => ({ t: "sys", text: `  第${round}回合 ${text}` })),
      { t: "desc", text: narrative },
    ]);
  });

  it("团战按回合合并既有 teamText 并保留吃亏方", () => {
    const [report] = buildDuelReportRounds([
      {
        round: 1, teamText: "雪豹一爪击中山贼", actor: { name: "雪豹" },
        result: { worseName: "山贼", notes: ["山贼凭涅槃引续住气血"] },
      },
      { round: 1, teamText: "少侠挡开刀势", actor: { name: "少侠" }, result: { worseName: "山贼" } },
    ]);
    expect(report.text).toBe("雪豹一爪击中山贼；少侠挡开刀势（山贼吃亏）");
    expect(report.teamLines[0].result.worseName).toBe("山贼");
    expect(renderDuelReportRounds([report]).text).toContain("雪豹");
    expect(renderDuelReportRounds([report]).text).toContain("山贼凭涅槃引续住气血");
  });

  it("团战吃亏方不可得时只保留原系统战报", () => {
    const [report] = buildDuelReportRounds([
      { round: 1, teamText: "雪豹架住一招", result: { worseName: "平手" } },
      { round: 1, teamText: "少侠转身避开", result: { worseName: "平手" } },
    ]);
    expect(report.text).toBe("雪豹架住一招；少侠转身避开");
  });
});

describe("战报模板路径解析", () => {
  it("解析简单和嵌套字段，未知路径留空并返回trace字段", () => {
    const resolved = resolveDuelReportTemplate(
      "第@round.index回合，气血@round.hpAfter.player；缺失=@round.unknown.value。",
      { round: { index: 2, hpAfter: { player: [9, 20] } } },
    );
    expect(resolved.text).toBe("第2回合，气血9/20；缺失=。");
    expect(resolved.missingPaths).toEqual(["round.unknown.value"]);
  });
});

describe("战报回合数据和短句", () => {
  const hpBand = ([current, max]) => current / max >= 0.6 ? "healthy" : current / max < 0.25 ? "nearDown" : "hurt";
  const entry = (overrides = {}) => {
    const values = {
      playerMove: "野球拳", npcMove: "铁布衫",
      playerMoveType: "攻击", npcMoveType: "防御",
      dmgToNpc: 3, dmgToPlayer: 0, statusDamageToNpc: 0, statusDamageToPlayer: 0,
      hpAfterPlayer: [60, 60], hpAfterNpc: [57, 60],
      statusAppliedToPlayer: null, statusAppliedToNpc: "麻穴",
      markAppliedToPlayer: null, markAppliedToNpc: null,
      hpRestorePlayer: 0, hpRestoreNpc: 0,
      dodgeSuccessPlayer: false, dodgeSuccessNpc: false,
      statusSlotsAfterPlayer: {}, statusSlotsAfterNpc: { control: { name: "麻穴", duration: 2 } },
      statusLogPlayer: [], statusLogNpc: [], notes: ["才旦气机受阻"],
      ...overrides,
    };
    const result = {
      damageToA: values.dmgToPlayer, damageToB: values.dmgToNpc,
      statusDamageA: values.statusDamageToPlayer, statusDamageB: values.statusDamageToNpc,
      nameA: "陈尧天", nameB: "才旦",
      hpAfterA: values.hpAfterPlayer, hpAfterB: values.hpAfterNpc,
      hpBandA: hpBand(values.hpAfterPlayer), hpBandB: hpBand(values.hpAfterNpc),
      statusAppliedToA: values.statusAppliedToPlayer, statusAppliedToB: values.statusAppliedToNpc,
      markAppliedToA: values.markAppliedToPlayer, markAppliedToB: values.markAppliedToNpc,
      hpRestoreA: values.hpRestorePlayer, hpRestoreB: values.hpRestoreNpc,
      dodgeSuccessA: values.dodgeSuccessPlayer, dodgeSuccessB: values.dodgeSuccessNpc,
      statusSlotsAfterA: values.statusSlotsAfterPlayer, statusSlotsAfterB: values.statusSlotsAfterNpc,
      statusLogA: values.statusLogPlayer, statusLogB: values.statusLogNpc,
      notes: values.notes,
      worseName: (values.dmgToPlayer + values.statusDamageToPlayer) === (values.dmgToNpc + values.statusDamageToNpc)
        ? "平手"
        : (values.dmgToPlayer + values.statusDamageToPlayer) > (values.dmgToNpc + values.statusDamageToNpc) ? "陈尧天" : "才旦",
      ...values.result,
    };
    return {
      round: 1,
      playerMove: { name: values.playerMove, type: values.playerMoveType },
      npcMove: { name: values.npcMove, type: values.npcMoveType },
      result,
    };
  };
  const containsReaction = (line, family, band, name) => REACTION_POOLS[family][band]
    .some((fragment) => line.includes(fragment.replace("{target}", name)));

  it("给AI提供招式类型、回合后气血、伤害、状态、吃亏方及HP色调", () => {
    const source = entry();
    const [report] = buildDuelReportRounds([source]);
    const prompt = renderDuelReportRounds([report]).text;
    expect(report.result).toBe(source.result);
    expect(report).not.toHaveProperty("playerName");
    expect(prompt).toContain("玩家陈尧天为A，才旦为B");
    expect(prompt).toContain("野球拳（攻击）对铁布衫（防御）");
    expect(prompt).toContain("回合后气血：A 60/60、B 57/60");
    expect(prompt).toContain("HP带：A healthy、B healthy");
    expect(prompt).toContain("招式伤害：A 0、B 3");
    expect(prompt).toContain("麻穴");
    expect(prompt).toContain("本轮吃亏：才旦");
    expect(report.text).toContain("才旦 −3");
  });

  it("只在存在时把引擎复活备注加入单人提示", () => {
    const note = "涅槃引护住才旦，使她气血复生";
    const [withNote] = buildDuelReportRounds([entry({ notes: [note] })]);
    const [withoutNote] = buildDuelReportRounds([entry({ notes: [] })]);

    expect(renderDuelReportRounds([withNote]).text).toContain(note);
    expect(renderDuelReportRounds([withNote]).text).toContain("引擎备注：");
    expect(renderDuelReportRounds([withoutNote]).text).not.toContain("引擎备注：");
  });

  it("保留共享结算中的闪避与NPC疗伤标记", () => {
    const dodgeLine = formatDuelDisplayLine(entry({
      playerMove: "凌波微步", playerMoveType: "轻功", npcMove: "连环腿", npcMoveType: "攻击",
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: null, dodgeSuccessPlayer: true,
    }));
    expect(dodgeLine).toContain("躲过才旦的连环腿");

    const healLine = formatDuelDisplayLine(entry({
      playerMove: "野球拳", npcMove: "回春功", npcMoveType: "内功",
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: null, hpRestoreNpc: 10,
    }));
    expect(healLine).toContain("才旦");
    expect(healLine).toContain("回春功");
    expect(healLine).toContain("气血渐复（+10）");
  });

  it("区分招式伤害和持续伤害，不把纯持续伤害算作招式命中", () => {
    const record = entry({
      dmgToNpc: 0, dmgToPlayer: 0, statusDamageToNpc: 4,
      hpAfterNpc: [56, 60], statusAppliedToNpc: null,
      statusSlotsAfterNpc: { poison: { name: "毒伤", duration: 2 } },
    });
    const line = formatDuelDisplayLine(record);
    const [report] = buildDuelReportRounds([record]);

    expect(line).toContain("持续伤害 4");
    expect(line).not.toContain("才旦 −0");
    expect(line).not.toContain("才旦 −4");
    expect(renderDuelReportRounds([report]).text).toContain("持续伤害：A 0、B 4");
  });

  it("按每名受击者自己的HP带选择反应并在濒倒时显示余血", () => {
    const healthy = formatDuelDisplayLine(entry({
      npcMoveType: "攻击", statusAppliedToNpc: null,
    }));
    const hurt = formatDuelDisplayLine(entry({
      npcMoveType: "攻击", statusAppliedToNpc: null, hpAfterNpc: [40, 100],
    }));
    const nearDown = formatDuelDisplayLine(entry({
      npcMoveType: "攻击", statusAppliedToNpc: null, hpAfterNpc: [9, 100],
    }));
    expect(containsReaction(healthy, "damaged", "healthy", "才旦")).toBe(true);
    expect(containsReaction(hurt, "damaged", "hurt", "才旦")).toBe(true);
    expect(containsReaction(nearDown, "damaged", "nearDown", "才旦")).toBe(true);
    expect(nearDown).toContain("剩 9");
  });

  it("互攻时分别使用A、B各自的HP带反应", () => {
    const line = formatDuelDisplayLine(entry({
      playerMoveType: "攻击", npcMoveType: "攻击",
      dmgToNpc: 40, dmgToPlayer: 10, statusAppliedToNpc: null, statusAppliedToPlayer: null,
      hpAfterPlayer: [9, 100], hpAfterNpc: [75, 120],
    }));

    expect(containsReaction(line, "damaged", "nearDown", "陈尧天")).toBe(true);
    expect(containsReaction(line, "damaged", "healthy", "才旦")).toBe(true);
    expect(MUTUAL_CONTACTS.some((fragment) => line.includes(fragment))).toBe(true);
  });

  it("互攻只有一方受伤时只加入该方的反应", () => {
    const line = formatDuelDisplayLine(entry({
      playerMoveType: "攻击", npcMoveType: "攻击",
      dmgToNpc: 5, dmgToPlayer: 0, statusAppliedToNpc: null, statusAppliedToPlayer: null,
      hpAfterNpc: [55, 60],
    }));
    const playerReaction = Object.values(REACTION_POOLS).some((families) =>
      Object.values(families).flat().some((fragment) => line.includes(fragment.replace("{target}", "陈尧天"))));

    expect(containsReaction(line, "damaged", "healthy", "才旦")).toBe(true);
    expect(playerReaction).toBe(false);
    expect(MUTUAL_CONTACTS.some((fragment) => line.includes(fragment))).toBe(false);
  });

  it("取消的回气会明确写成被更快的控制招打断", () => {
    const record = entry({
      playerMove: "回气", playerMoveType: "状态", npcMove: "点穴一指", npcMoveType: "状态",
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: null, statusAppliedToPlayer: "麻穴",
      result: { counterStatus: "control", speedWinner: "B", cancelledA: true, interruptedA: true },
    });
    const candidates = Array.from({ length: 1000 }, (_, index) =>
      formatDuelDisplayLine(record, { round: index + 1 }));
    const line = candidates.find((text) => text.includes("一指点住"));

    expect(line).toContain("陈尧天");
    expect(line).toContain("刚要运气");
    expect(line).toContain("便被才旦");
    expect(line).toContain("动弹不得");
  });

  it("控制语气按目标血带选取，而不是施招者血带", () => {
    const line = formatDuelDisplayLine(entry({
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: "麻穴",
      hpAfterPlayer: [9, 100], hpAfterNpc: [60, 60],
    }));
    expect(containsReaction(line, "controlled", "healthy", "才旦")).toBe(true);
    expect(containsReaction(line, "controlled", "nearDown", "才旦")).toBe(false);
  });

  it("双方都受创时分别列伤害、持续伤害和较吃亏者", () => {
    const [worse] = buildDuelReportRounds([entry({
      playerMoveType: "攻击", npcMoveType: "攻击",
      dmgToNpc: 24, dmgToPlayer: 40,
      hpAfterPlayer: [9, 100], hpAfterNpc: [20, 100],
      statusAppliedToNpc: null, statusAppliedToPlayer: null,
    })]);
    expect(worse.text).toContain("陈尧天 −40，剩 9");
    expect(worse.text).toContain("才旦 −24，剩 20");
    expect(renderDuelReportRounds([worse]).text).toContain("本轮吃亏：陈尧天");

    const [tie] = buildDuelReportRounds([entry({ dmgToNpc: 4, dmgToPlayer: 4 })]);
    expect(tie.result.worseName).toBe("平手");
    expect(renderDuelReportRounds([tie]).text).toContain("本轮吃亏：平手");
  });

  it("共享结算引擎记录招式类型和回合末气血", () => {
    const result = resolveTurn(
      { move: { name: "野球拳", type: "攻击", baseDamageMultiplier: 0 }, hp: [60, 60], energy: [10, 10], special: {} },
      { move: { name: "铁布衫", type: "防御", baseDamageMultiplier: 1 }, hp: [60, 60], energy: [10, 10], special: {} },
    );
    expect(result).toMatchObject({ moveNameA: "野球拳", moveTypeA: "攻击", moveNameB: "铁布衫", moveTypeB: "防御" });
    const endTick = applyEndOfTurnStatus(
      { statusSlots: {}, hp: [57, 60] },
      { statusSlots: {}, hp: [60, 60] },
    );
    expect(endTick.hpAfterA).toBe(57);
    expect(endTick.hpAfterB).toBe(60);
    const finalized = finalizeDuelRound(
      { ...result, damageToA: 5, damageToB: 2 },
      {
        statusDamageA: 1, statusDamageB: 0,
        statusSlotsA: { poison: { name: "毒伤", duration: 2 } }, statusSlotsB: {},
        logA: ["毒伤"], logB: [],
      },
      { hpAfterA: [57, 100], hpAfterB: [55, 100], nameA: "陈尧天", nameB: "才旦" },
    );
    expect(finalized).toMatchObject({
      nameA: "陈尧天",
      nameB: "才旦",
      statusDamageA: 1,
      hpAfterA: [57, 100],
      hpBandA: "hurt",
      hpBandB: "hurt",
      statusSlotsAfterA: { poison: { name: "毒伤", duration: 2 } },
      worseName: "陈尧天",
    });
  });
});

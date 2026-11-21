import { describe, expect, it } from "vitest";
import { applyEndOfTurnStatus, resolveTurn } from "./resolveTurn.js";
import {
  buildDuelReportRounds,
  createDuelRoundMetadata,
  formatDuelDisplayLine,
  interleaveDuelReport,
  selectDuelPhrase,
} from "./duelReport.js";
import { DUEL_HP_BANDS, DUEL_MOVE_TYPES, DUEL_OUTCOMES, DUEL_PHRASE_BANK } from "./duelPhrases/index.js";

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
      { round: 1, teamText: "雪豹一爪击中山贼", worseName: "山贼" },
      { round: 1, teamText: "少侠挡开刀势", worseName: "山贼" },
    ]);
    expect(report.text).toBe("雪豹一爪击中山贼；少侠挡开刀势（山贼吃亏）");
    expect(report.aiData).toContain("本轮吃亏：山贼");
  });
});

describe("战报回合数据和短句", () => {
  const entry = (overrides = {}) => ({
    round: 1,
    playerMove: "野球拳",
    npcMove: "铁布衫",
    playerMoveType: "攻击",
    npcMoveType: "防御",
    dmgToNpc: 3,
    dmgToPlayer: 0,
    hpAfterPlayer: [60, 60],
    hpAfterNpc: [57, 60],
    statusAppliedToNpc: "麻穴",
    statusSlotsAfterNpc: { control: { name: "麻穴" } },
    notes: ["才旦气机受阻"],
    ...overrides,
  });

  it("给AI提供招式类型、回合后气血、伤害、状态、吃亏方及HP色调", () => {
    const [report] = buildDuelReportRounds([entry()], { playerName: "陈尧天", npcName: "才旦" });
    expect(report.aiData).toContain("野球拳/攻击");
    expect(report.aiData).toContain("铁布衫/防御");
    expect(report.aiData).toContain("陈尧天 60/60");
    expect(report.aiData).toContain("才旦 57/60");
    expect(report.aiData).toContain("才旦：健旺");
    expect(report.aiData).toContain("才旦 3");
    expect(report.aiData).toContain("麻穴");
    expect(report.aiData).toContain("本轮吃亏：才旦");
    expect(report.text).toContain("才旦 −3");
  });

  it("保留共享结算中的闪避与NPC疗伤标记", () => {
    const endTick = {
      statusDamageA: 0, statusDamageB: 0, statusSlotsA: {}, statusSlotsB: {}, logA: [], logB: [],
    };
    const dodgeMetadata = createDuelRoundMetadata({
      moveTypeA: "轻功", moveTypeB: "攻击", damageToA: 0, damageToB: 0,
      dodgeSuccessA: true, dodgeSuccessB: false, hpRestoreA: 0, hpRestoreB: 0,
    }, endTick, [60, 60], [60, 60]);
    const dodgeLine = formatDuelDisplayLine({
      round: 1, playerMove: "凌波微步", npcMove: "连环腿", ...dodgeMetadata,
    }, { playerName: "陈尧天", npcName: "才旦" });
    expect(dodgeLine).toContain("躲过才旦的连环腿");

    const healMetadata = createDuelRoundMetadata({
      moveTypeA: "攻击", moveTypeB: "内功", damageToA: 0, damageToB: 0,
      dodgeSuccessA: false, dodgeSuccessB: false, hpRestoreA: 0, hpRestoreB: 10,
    }, endTick, [60, 60], [50, 60]);
    const healLine = formatDuelDisplayLine({
      round: 1, playerMove: "野球拳", npcMove: "回春功", ...healMetadata,
    }, { playerName: "陈尧天", npcName: "才旦" });
    expect(healLine).toContain("才旦运起回春功");
  });

  it("把伤势按健旺、受创、将倒分级，濒倒显示剩余气血", () => {
    const healthy = formatDuelDisplayLine(entry(), { playerName: "陈尧天", npcName: "才旦" });
    const hurt = formatDuelDisplayLine(entry({ hpAfterNpc: [40, 100] }), { playerName: "陈尧天", npcName: "才旦" });
    const nearDown = formatDuelDisplayLine(entry({ hpAfterNpc: [9, 100] }), { playerName: "陈尧天", npcName: "才旦" });
    expect(healthy).toContain("浑若无事");
    expect(hurt).toContain("身形一晃");
    expect(nearDown).toContain("眼看就要倒下");
    expect(nearDown).toContain("剩 9");
  });

  it.each([
    ["命中", "hit", entry({ npcMoveType: "攻击" }), "攻击", "你", "对手", "野球拳", "铁布衫"],
    ["格挡", "blocked", entry(), "攻击", "你", "对手", "野球拳", "铁布衫"],
    ["闪避", "dodged", entry({ dodgeSuccessPlayer: true }), "攻击", "你", "对手", "野球拳", "铁布衫"],
    ["运功", "heal", entry({ dmgToNpc: 0, statusAppliedToNpc: "护体" }), "防御", "对手", "对手", "铁布衫", "野球拳"],
    ["双方中招", "bothHit", entry({ dmgToNpc: 4, dmgToPlayer: 2 }), "攻击", "你", "对手", "野球拳", "铁布衫"],
  ])("按%s结果渲染对应短句模板", (_label, outcome, record, moveType, actor, target, move, targetMove) => {
    const expected = selectDuelPhrase(moveType, outcome, "healthy", 1)
      .replace(/\{actor\}/g, actor)
      .replace(/\{target\}/g, target)
      .replace(/\{move\}/g, move)
      .replace(/\{targetMove\}/g, targetMove);
    expect(formatDuelDisplayLine(record)).toContain(expected);
  });

  it("双方都受创时列出两边伤害和较吃亏者，伤害相等则平手", () => {
    const [worse] = buildDuelReportRounds([entry({
      dmgToNpc: 24,
      dmgToPlayer: 40,
      hpAfterPlayer: [9, 100],
      hpAfterNpc: [20, 100],
    })], { playerName: "陈尧天", npcName: "才旦" });
    expect(worse.text).toContain("陈尧天 −40，剩 9");
    expect(worse.text).toContain("才旦 −24，剩 20");
    expect(worse.aiData).toContain("本轮吃亏：陈尧天");

    const [tie] = buildDuelReportRounds([entry({ dmgToNpc: 4, dmgToPlayer: 4 })]);
    expect(tie.disadvantage).toBe("平手");
    expect(tie.aiData).toContain("本轮吃亏：平手");
  });

  it("使用移动类型、结果和血量三维模板，所有分支可确定性选取", () => {
    for (const type of DUEL_MOVE_TYPES) {
      for (const outcome of DUEL_OUTCOMES) {
        for (const band of DUEL_HP_BANDS) {
          const cell = DUEL_PHRASE_BANK[type][outcome][band];
          expect(cell.length, `${type}/${outcome}/${band}`).toBeGreaterThanOrEqual(12);
          expect(selectDuelPhrase(type, outcome, band, 1)).toBe(cell[0]);
          expect(selectDuelPhrase(type, outcome, band, 1)).toBe(selectDuelPhrase(type, outcome, band, 1));
        }
      }
    }
  });

  it("模板库至少有950条互不重复的句式，且只用已知占位符", () => {
    const templates = DUEL_MOVE_TYPES.flatMap((type) => DUEL_OUTCOMES.flatMap((outcome) => (
      DUEL_HP_BANDS.flatMap((band) => DUEL_PHRASE_BANK[type][outcome][band])
    )));
    expect(templates.length).toBeGreaterThanOrEqual(950);
    expect(new Set(templates).size).toBe(templates.length);
    for (const template of templates) {
      const placeholders = [...template.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      expect(placeholders.every((name) => ["actor", "target", "move", "targetMove"].includes(name))).toBe(true);
    }
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
  });
});

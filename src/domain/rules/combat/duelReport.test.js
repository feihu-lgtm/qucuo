import { describe, expect, it } from "vitest";
import { applyEndOfTurnStatus, resolveTurn } from "./resolveTurn.js";
import { finalizeDuelRound } from "./finalizeDuelRound.js";
import {
  buildDuelReportRounds,
  formatDuelDisplayLine,
  resolveDuelReportTemplate,
} from "./duelReport.js";
import { EFFECT_POOLS, MUTUAL_CONTACTS, REACTION_POOLS } from "./duelPhrases/index.js";

describe("战报模板路径解析", () => {
  it("renders a faster attack beating control as a hit and interruption, not immobilization", () => {
    const attack = {
      move: { name: "快拳", type: "攻击" },
      special: { 身法: 8 },
      hp: [100, 100],
      energy: [0, 100],
      baseAtk: 20,
      baseDef: 0,
    };
    const control = {
      move: { name: "点穴指", type: "状态", applyStatus: { name: "麻穴", chance: 1 } },
      special: { 身法: 2 },
      hp: [100, 100],
      energy: [0, 100],
      baseAtk: 10,
      baseDef: 0,
    };
    const result = resolveTurn(attack, control);
    const line = formatDuelDisplayLine({
      round: 1,
      playerMove: attack.move,
      npcMove: control.move,
      result: {
        ...result,
        nameA: "陈尧天",
        nameB: "才旦",
        hpAfterA: [100, 100],
        hpAfterB: [100 - result.damageToB, 100],
        hpBandA: "healthy",
        hpBandB: "hurt",
      },
    });

    expect(result).toMatchObject({
      counterStatus: null,
      speedWinner: "A",
      interruptedB: true,
      statusAppliedToA: null,
    });
    expect(result.damageToB).toBeGreaterThan(0);
    expect(EFFECT_POOLS.hit.some((fragment) => line.includes(fragment.replace("{target}", "才旦").replace(/[，,。！？；：、]+$/g, "")))).toBe(true);
    expect(EFFECT_POOLS.interrupted.some((fragment) => line.includes(fragment.replaceAll("{target}", "陈尧天").replace(/[，,。！？；：、]+$/g, "")))).toBe(true);
    expect(line).not.toContain("动弹不得");
  });

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
  const renderFragment = (fragment, actor = "陈尧天", target = "才旦") => fragment
    .replaceAll("{actor}", actor)
    .replaceAll("{target}", target)
    .replaceAll("{move}", "野球拳")
    .replaceAll("{targetMove}", "铁布衫")
    .replace(/[，,。！？；：、]+$/g, "");
  const containsReaction = (line, family, band, name) => REACTION_POOLS[family][band]
    .some((fragment) => line.includes(renderFragment(fragment, "陈尧天", name)));

  it("把闪避和打断反应中的攻击者绑定到对手", () => {
    const dodgePool = REACTION_POOLS.dodged.healthy;
    const damagePool = REACTION_POOLS.damaged.healthy;
    const originalDodgePool = [...dodgePool];
    const originalDamagePool = [...damagePool];

    try {
      dodgePool.splice(0, dodgePool.length, "{target}避开了{actor}的{move}");
      damagePool.splice(0, damagePool.length, "{target}受了{actor}的{move}");

      const dodgeLine = formatDuelDisplayLine(entry({
        playerMoveType: "防御",
        npcMoveType: "攻击",
        dmgToNpc: 0,
        dmgToPlayer: 0,
        dodgeSuccessPlayer: true,
      }));
      expect(dodgeLine).toContain("陈尧天避开了才旦的铁布衫");
      expect(dodgeLine).not.toContain("陈尧天避开了陈尧天");

      const interruptLine = formatDuelDisplayLine(entry({
        playerMove: "回气",
        playerMoveType: "状态",
        npcMove: "快拳",
        npcMoveType: "攻击",
        dmgToPlayer: 3,
        result: { interruptedA: true },
      }));
      expect(interruptLine).toContain("陈尧天受了才旦的快拳");
      expect(interruptLine).not.toContain("陈尧天受了陈尧天");
    } finally {
      dodgePool.splice(0, dodgePool.length, ...originalDodgePool);
      damagePool.splice(0, damagePool.length, ...originalDamagePool);
    }
  });

  it("保留共享结算中的闪避与NPC疗伤标记", () => {
    const dodgeLine = formatDuelDisplayLine(entry({
      playerMove: "凌波微步", playerMoveType: "轻功", npcMove: "连环腿", npcMoveType: "攻击",
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: null, dodgeSuccessPlayer: true,
    }));
    expect(EFFECT_POOLS.dodged.some((fragment) => dodgeLine.includes(fragment.replace("{target}", "才旦").replace("{targetMove}", "连环腿").replace(/[，,。！？；：、]+$/g, "")))).toBe(true);

    const healLine = formatDuelDisplayLine(entry({
      playerMove: "野球拳", npcMove: "回春功", npcMoveType: "内功",
      dmgToNpc: 0, dmgToPlayer: 0, statusAppliedToNpc: null, hpRestoreNpc: 10,
    }));
    expect(healLine).toContain("才旦");
    expect(healLine).toContain("回春功");
    expect(healLine).toContain("+10");
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
    expect(MUTUAL_CONTACTS.some((fragment) => line.includes(renderFragment(fragment)))).toBe(true);
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
    expect(MUTUAL_CONTACTS.some((fragment) => line.includes(renderFragment(fragment)))).toBe(false);
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

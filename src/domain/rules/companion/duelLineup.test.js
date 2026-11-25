import { describe, expect, it } from "vitest";
import {
  duelLineup, duelAllies, duelFoeFollower, unlockImportedCompanion, unlockFollowerCompanion,
  unlockSnowLeopard, setActiveCompanion, stationCompanion, companionNpcEntry,
} from "./companion.js";
import { ocSignatureMoves } from "./ocKungfu.js";
import { buildEnemyUnit, buildLeopardUnit, buildPlayerUnit } from "../combat/teamUnits.js";
import { decideUnitMove, decideUnitTarget, runTeamTurn } from "../combat/teamBattleEngine.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const DUODUO = ADVENTURER_POOL_IP.find((a) => a.name === "元朵朵");
const duoduoNpc = () => ensureNpcCombatData({ id: "npc_duoduo", name: "元朵朵", levelCap: 1 }, { levelCap: 1 });

// 朵朵已入队（出战）+ 铁伯随行
const recruited = () => {
  const withOwner = unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1, signatureMoves: ocSignatureMoves(DUODUO) });
  return unlockFollowerCompanion(withOwner, DUODUO);
};

describe("敌方阵容：打元朵朵时铁伯陪她迎战", () => {
  it("玩家独自上阵打朵朵走 1v1（保住战斗道具栏），铁伯不下场", () => {
    const lineup = duelLineup({}, duoduoNpc());
    expect(lineup.team).toBe(false);
    expect(lineup.enemies.map((e) => e.name)).toEqual(["元朵朵"]);
  });

  it("铁伯作为敌方随从的战斗数据：防御权重压过攻击、带精钢盾甲", () => {
    const tie = buildEnemyUnit(duelFoeFollower({}, duoduoNpc()), 1);
    expect(tie.side).toBe("enemy");
    expect(tie.movesetLocal.map((m) => m.name)).toContain("精钢盾甲");
    expect(tie.profile.moveWeights.防御).toBeGreaterThan(tie.profile.moveWeights.攻击);
  });

  it("玩家带雪豹打朵朵：己方雪豹，敌方朵朵+铁伯", () => {
    const lineup = duelLineup(unlockSnowLeopard({}), duoduoNpc());
    expect(lineup.allies.map((a) => a.key)).toEqual(["snowLeopard"]);
    expect(lineup.enemies).toHaveLength(2);
  });

  it("别的对手仍是 1v1；朵朵/铁伯已在玩家队里时不再给她配敌方随从", () => {
    expect(duelLineup({}, { name: "拦路山贼" }).team).toBe(false);
    expect(duelFoeFollower(recruited(), duoduoNpc())).toBeNull();
  });
});

describe("名单条目：哑仆点交谈走不通人言分支", () => {
  it("铁伯的条目带 cannotSpeak，朵朵的不带", () => {
    const cs = recruited();
    expect(companionNpcEntry(cs, "imported_铁伯").cannotSpeak).toBe(true);
    expect(companionNpcEntry(cs, "imported_元朵朵").cannotSpeak).toBeUndefined();
  });
});

describe("己方阵容：朵朵出战，铁伯一并上场", () => {
  it("allies = [朵朵(出战), 铁伯]；对手是朵朵本人时 1v1", () => {
    const cs = recruited();
    const lineup = duelLineup(cs, { name: "拦路山贼" });
    expect(lineup.team).toBe(true);
    expect(lineup.allies.map((a) => a.label)).toEqual(["元朵朵", "铁伯"]);
    expect(lineup.enemies).toHaveLength(1);
    expect(duelAllies(cs, { name: "元朵朵" })).toEqual([]);
  });

  it("留守的铁伯不上场；换成雪豹出战则只有雪豹", () => {
    const cs = recruited();
    const withLeopard = setActiveCompanion({ ...cs, snowLeopard: unlockSnowLeopard({}).snowLeopard }, "snowLeopard");
    expect(duelAllies(withLeopard, { name: "山贼" }).map((a) => a.key)).toEqual(["snowLeopard"]);
    const stationed = stationCompanion(withLeopard, "imported_铁伯", { roomName: "客栈" });
    expect(duelAllies(setActiveCompanion(stationed, "imported_元朵朵"), { name: "山贼" }).map((a) => a.key)).toEqual(["imported_元朵朵"]);
  });

  it("团战引擎吃得下 3 个己方单位：玩家+朵朵+铁伯 vs 敌方 1 个，一回合结算正常", () => {
    const cs = recruited();
    const [lead, mate] = duelAllies(cs, { name: "山贼" });
    const playerChar = { name: "我", hp: [100, 100], special: {}, waigong: 0, neigong: 0 };
    const allies = [
      buildPlayerUnit({ playerChar, playerMoveset: duoduoNpc().moveset }),
      buildLeopardUnit(lead.data),
      buildLeopardUnit(mate.data),
    ];
    const enemies = [buildEnemyUnit(ensureNpcCombatData({ id: "bandit", name: "拦路山贼", levelCap: 1 }, { levelCap: 1 }))];
    const intents = {};
    for (const u of [...allies, ...enemies]) {
      const move = decideUnitMove(u, { npcHistory: u.history, npcEnergy: u.energy[0], forbidDefense: u.defenseBroken });
      intents[u.id] = { move, targetId: u.side === "ally" ? enemies[0].id : decideUnitTarget(allies) };
    }
    const { updatedAlly, updatedEnemy, turnLog } = runTeamTurn(allies, enemies, intents);
    expect(updatedAlly).toHaveLength(3);
    expect(turnLog.length).toBeGreaterThan(0);
  });
});

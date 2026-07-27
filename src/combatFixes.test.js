import { describe, it, expect } from "vitest";
import { decideNpcMove } from "./combat/aiDecision.js";
import { resolveTurn } from "./combat/resolveTurn.js";
import { deriveSignatureMoveset } from "./npcGeneration.js";

// 【群友实测反馈】"敌人现在似乎无限体力点""只能应付一个人""激情互秒"
// 以及战报里同一件事说两遍、不知道谁占上风。

describe("修「敌人无限体力」：能量不够时的兜底选招", () => {
  const ms = deriveSignatureMoveset({ name: "狼王", id: "w", levelCap: 4 }, { levelCap: 4 });
  const prof = { moveWeights: { 攻击: 0.6, 防御: 0.2, 状态: 0.2 }, riskAppetite: 0.7, avoidRepeat: 0.2 };

  it("NPC 招式的 id 不叫 move_hui_qi（原兜底永远匹配不上，这是 bug 的来源）", () => {
    expect(ms.some(m => m.id === "move_hui_qi")).toBe(false);
    expect(ms.some(m => (m.energyCost ?? 0) === 0)).toBe(true);   // 但它确实有 cost=0 的回气位
  });

  it("能量为 0 时出的招必须不花能量（此前会免费放出最强攻击招）", () => {
    const m = decideNpcMove(prof, ms, { npcEnergy: 0, energy: [0, 10], npcHistory: [] });
    expect(m).toBeTruthy();
    expect(m.energyCost ?? 0).toBe(0);
  });

  it("各能量水平下都不超支", () => {
    for (const e of [0, 1, 2, 3, 5, 6, 7, 10]) {
      const m = decideNpcMove(prof, ms, { npcEnergy: e, energy: [e, 10], npcHistory: [] });
      expect(m.energyCost ?? 0, `能量${e} 却选了 cost=${m.energyCost} 的「${m.name}」`).toBeLessThanOrEqual(e);
    }
  });

  it("能量充足时仍会用高耗能的强招（别为了修 bug 把敌人改弱）", () => {
    const picks = new Set();
    for (let i = 0; i < 40; i++) {
      picks.add(decideNpcMove(prof, ms, { npcEnergy: 10, energy: [10, 10], npcHistory: [] }).energyCost ?? 0);
    }
    expect(Math.max(...picks)).toBeGreaterThan(0);
  });

  it("残缺 moveset 不炸（历史坑：任务临时 foe 的 profile 可能不全）", () => {
    expect(() => decideNpcMove({}, [], { npcEnergy: 0 })).not.toThrow();
    expect(decideNpcMove({}, [], { npcEnergy: 0 })).toBeNull();
  });
});

describe("修战报重复：攻击克状态 与 状态克防御 是两个分支", () => {
  const side = (name, type, mult, extra = {}) => ({
    move: { id: name, name, type, energyCost: 2, baseDamageMultiplier: mult, ...extra },
    hp: [999, 999], energy: [10, 10], special: {}, waigong: 50, neigong: 50,
    baseAtk: 100, equipAtk: 0, equipDef: 0, statusSlots: {},
  });

  it("攻击克状态：只说一次「被打断」，不再多一句「只顾防住正面」", () => {
    const r = resolveTurn(side("碎岩击", "攻击", 1), side("踞原嗥月", "状态", 0));
    const joined = r.notes.join("|");
    expect(joined).toContain("正面打断");
    expect(joined, "这句属于状态克防御，不该出现在攻击克状态里").not.toContain("只顾防住正面");
  });

  it("攻击克状态时不该跑状态招的效果（此前会顺带施加状态）", () => {
    const r = resolveTurn(
      side("碎岩击", "攻击", 1),
      side("乱心指", "状态", 0, { confuseChance: 1 }),
    );
    expect(r.statusAppliedToB).toBeFalsy();
    expect(r.statusAppliedToA).toBeFalsy();
  });

  it("状态克防御：那句话在它该在的地方", () => {
    const r = resolveTurn(side("乱心指", "状态", 0, { confuseChance: 1 }), side("铁桶阵", "防御", 0.5));
    expect(r.notes.join("|")).toContain("只顾防住正面");
  });
});

describe("战报措辞：点名谁占上风、不用破折号", () => {
  // 复刻 TeamDuelScreen 的拼法
  const line = (e) => {
    const clash = e.targetMove ? `，${e.targetName}以「${e.targetMove}」相抗` : `，${e.targetName}无暇他顾`;
    const updown = e.matchup === "A" ? `${e.actorName}占了上风`
      : e.matchup === "B" ? `${e.targetName}占了上风` : "两招同门相撞";
    const dmg = e.dmgToTarget > 0 ? `${e.targetName}受创${e.dmgToTarget}` : "";
    return `${e.actorName}以「${e.actorMove}」击向${e.targetName}${clash}。${updown}${dmg ? "。" + dmg : ""}。`;
  };
  const base = { actorName: "雪豹", actorMove: "碎岩击", targetName: "狼王", targetMove: "踞原嗥月", dmgToTarget: 86 };

  it("出手方赢 → 点出手方的名字", () => {
    expect(line({ ...base, matchup: "A" })).toContain("雪豹占了上风");
  });
  it("应战方赢 → 点应战方的名字", () => {
    expect(line({ ...base, matchup: "B" })).toContain("狼王占了上风");
  });
  it("不再出现光秃秃的「占了上风」（2v2 一行两三个人名，不说主语读不懂）", () => {
    expect(line({ ...base, matchup: "A" })).not.toMatch(/相抗。占了上风/);
  });
  it("不用破折号（项目成文铁律本来就禁冒号破折号）", () => {
    expect(line({ ...base, matchup: "A" })).not.toContain("——");
  });
});

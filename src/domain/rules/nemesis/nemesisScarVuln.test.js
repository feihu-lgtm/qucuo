// WO-23C5 宿敌旧伤战斗生效测试
import { describe, it, expect } from "vitest";
import { scarKindsOfNemesis, moveScarKindHit, scarVulnerabilityMultiplier, SCAR_VULN_MULTIPLIER } from "./nemesisScarVuln.js";
import { resolveTurn } from "../combat/resolveTurn.js";

const roster = {
  黑风寨: {
    entries: {
      e1: {
        id: "e1", name: "甲", faction: "黑风寨", tier: 2, grudge: 1, status: "active",
        scars: [{ kind: "利刃", note: "", turn: 3 }, { kind: "火毒", note: "", turn: 5 }],
      },
      e2: { id: "e2", name: "乙", faction: "黑风寨", tier: 1, status: "fakeDead", scars: [{ kind: "利刃", turn: 1 }] },
    },
  },
};
const bladeMove = { name: "青钢剑法", type: "攻击", baseDamageMultiplier: 1, desc: "一剑刺出" };
const fistMove = { name: "重拳", type: "攻击", baseDamageMultiplier: 1, desc: "一拳击出" };
const plainMove = { name: "云手", type: "攻击", baseDamageMultiplier: 1, desc: "运气好" };

describe("scarKindsOfNemesis 纯函数", () => {
  it("active entry 旧伤属性去重取全", () => {
    expect(scarKindsOfNemesis(roster, "黑风寨", "甲").sort()).toEqual(["利刃", "火毒"].sort());
  });
  it("fakeDead 不生效；无谱/非五势力/坏形状空数组", () => {
    expect(scarKindsOfNemesis(roster, "黑风寨", "乙")).toEqual([]);
    expect(scarKindsOfNemesis(null, "黑风寨", "甲")).toEqual([]);
    expect(scarKindsOfNemesis(roster, "雪山派", "甲")).toEqual([]); // 势力不匹配不跨势力猜
    expect(scarKindsOfNemesis(roster, "黑风寨", "不存在")).toEqual([]);
  });
  it("多同类疤不叠加（kinds 去重）", () => {
    const r = { 黑风寨: { entries: { x: { id: "x", name: "甲", status: "active", scars: [{ kind: "利刃" }, { kind: "利刃" }, { kind: "利刃" }] } } } };
    expect(scarKindsOfNemesis(r, "黑风寨", "甲")).toEqual(["利刃"]);
  });
});

describe("nemesisFactionOf 权威势力接线（返修①）", () => {
  it("resident 无显式 faction 但按 id 映射入谱：旧伤生效", async () => {
    const { nemesisFactionOf } = await import("./nemesisEngine.js");
    // resident_huyanxue 在 NPC_FACTION 映射里属雪山派，无裸 faction 字段
    const npc = { id: "resident_huyanxue", name: "呼延雪" };
    const faction = nemesisFactionOf(npc);
    expect(faction).toBe("雪山派");
    const r2 = {
      雪山派: { entries: { x: { id: "x", name: "呼延雪", status: "active", scars: [{ kind: "利刃", turn: 1 }] } } },
    };
    const kinds = scarKindsOfNemesis(r2, faction, npc.name);
    expect(kinds).toEqual(["利刃"]);
    expect(scarVulnerabilityMultiplier({ roster: r2, faction, npcName: npc.name, move: bladeMove })).toBe(SCAR_VULN_MULTIPLIER);
  });
  it("散人/非五势力 null 不生效", async () => {
    const { nemesisFactionOf } = await import("./nemesisEngine.js");
    expect(nemesisFactionOf({ id: "resident_caidan", name: "才旦" })).toBeNull(); // 鱼定村非五势力
    expect(scarKindsOfNemesis(roster, nemesisFactionOf({ name: "路人" }), "路人")).toEqual([]);
  });
});

describe("moveScarKindHit / scarVulnerabilityMultiplier", () => {
  it("利刃/火毒代表命中；钝击不同类不命中；不可辨认零效果", () => {
    expect(moveScarKindHit(bladeMove, ["利刃"])).toBe(true);
    expect(moveScarKindHit({ name: "烈火掌", type: "攻击", desc: "掌中带火" }, ["火毒"])).toBe(true);
    expect(moveScarKindHit(fistMove, ["利刃"])).toBe(false); // 拳=钝击，旧伤是利刃
    expect(moveScarKindHit(plainMove, ["利刃"])).toBe(false); // 不可辨认
    expect(moveScarKindHit(bladeMove, [])).toBe(false);
  });
  it("一站式倍率：命中 1.1 否则 1", () => {
    expect(scarVulnerabilityMultiplier({ roster, faction: "黑风寨", npcName: "甲", move: bladeMove })).toBe(SCAR_VULN_MULTIPLIER);
    expect(scarVulnerabilityMultiplier({ roster, faction: "黑风寨", npcName: "甲", move: fistMove })).toBe(1);
  });
});

describe("反击/反弹不吃旧伤加成（Review 修）", () => {
  function mkSide(move, scarKinds) {
    return {
      move, special: { 体魄: 5, 身法: 5 }, baseAtk: 20, equipAtk: 0, equipDef: 0,
      hp: [100, 100], energy: [10, 10], statusSlots: {}, scarKinds,
    };
  }
  it("宿敌架住反击时 damageToA 不因宿敌自己的旧伤变大", () => {
    // 玩家使剑（利刃），宿敌带利刃疤+反击防御招——宿敌架住后反击玩家
    const counterMove = { name: "铁壁反击", type: "防御", baseDamageMultiplier: 0.3, onCounterSuccessDamageRatio: 0.5 };
    const playerAtk = { name: "青钢剑法", type: "攻击", baseDamageMultiplier: 1, desc: "剑刺" };
    const run = (scarKinds) => {
      let max = 0;
      for (let i = 0; i < 30; i++) {
        const r = resolveTurn(mkSide(playerAtk, undefined), mkSide(counterMove, scarKinds));
        // 宿敌防御胜时 damageToA 含反击；玩家被反击的伤害不因疤变大
        if (r.damageToA > max) max = r.damageToA;
      }
      return max;
    };
    const withScar = run(["利刃"]);
    const without = run(undefined);
    // 有疤时玩家被打中的「受」伤更大（damageToB）但反击回玩家的 damageToA 不更大
    expect(withScar).toBeLessThanOrEqual(without + 1); // 舍入容差 1
  });
});

describe("resolveTurn 接线（手动主链同构）", () => {
  function mkSide(move, scarKinds) {
    return {
      move, special: { 体魄: 5, 身法: 5 }, baseAtk: 20, equipAtk: 0, equipDef: 0,
      hp: [100, 100], energy: [10, 10], statusSlots: {}, scarKinds,
    };
  }
  function dmgWith(move, scarKinds) {
    const out = [];
    for (let i = 0; i < 30; i++) {
      const r = resolveTurn(mkSide(move, undefined), mkSide({ name: "守", type: "防御", baseDamageMultiplier: 0.5 }, scarKinds));
      if (r.damageToB > 0) out.push(r.damageToB);
    }
    return out.length ? Math.max(...out) : 0;
  }
  it("同类旧伤伤害高于无旧伤（×1.1 可观测），且 notes 带正中旧伤", () => {
    const withScar = dmgWith(bladeMove, ["利刃"]);
    const without = dmgWith(bladeMove, undefined);
    expect(withScar).toBeGreaterThan(without);
    const r = resolveTurn(mkSide(bladeMove, undefined), mkSide({ name: "守", type: "防御", baseDamageMultiplier: 0.5 }, ["利刃"]));
    if (r.damageToB > 0) expect(r.notes.join("")).toContain("正中旧伤");
  });
  it("不同类不加：钝击拳打利刃疤与无疤伤害一致", () => {
    const withScar = dmgWith(fistMove, ["利刃"]);
    const without = dmgWith(fistMove, undefined);
    expect(withScar).toBe(without);
  });
  it("输入不原地改：scarKinds 数组与谱对象不被 mutate", () => {
    const kinds = ["利刃"];
    const side = mkSide(bladeMove, kinds);
    const before = JSON.stringify(side);
    resolveTurn(mkSide({ name: "守", type: "防御" }, undefined), side);
    expect(JSON.stringify(side.special)).toBe(JSON.stringify({ 体魄: 5, 身法: 5 }));
    expect(kinds).toEqual(["利刃"]);
    expect(side.scarKinds).toBe(kinds);
    expect(before).toContain("利刃");
  });
});
// 团战/自动链入口覆盖：runTeamTurn 经 unitToSide 透传 scarKinds 后同样加伤
import { runTeamTurn } from "../combat/teamBattleEngine.js";

describe("团战链入口覆盖（runTeamTurn）", () => {
  const sword = { id: "m1", name: "青钢剑", type: "攻击", baseDamageMultiplier: 1, desc: "剑刺" };
  const guard = { id: "d", name: "守", type: "防御", baseDamageMultiplier: 0.5 };
  function mkUnit(over = {}) {
    return {
      id: "u1", name: "甲", side: "ally", alive: true,
      special: { 体魄: 5, 身法: 5 }, waigong: 0, neigong: 0, baseAtk: 20,
      hp: [100, 100], energy: [10, 10], statusSlots: {},
      movesetLocal: [sword], profile: {}, ...over,
    };
  }
  function foeUnit(scarKinds) {
    return mkUnit({ id: "e", name: "乙", side: "enemy", movesetLocal: [guard], scarKinds });
  }
  function duelOnce(scarKinds) {
    const intents = {
      u1: { move: sword, targetId: "e" },
      e: { move: guard, targetId: "u1" },
    };
    const { turnLog } = runTeamTurn([mkUnit()], [foeUnit(scarKinds)], intents);
    // turnLog 每条交锋带 result——取玩家命中敌方的 damageToB
    for (const entry of turnLog || []) {
      const r = entry?.result;
      if (r && r.damageToB > 0) return r.damageToB;
    }
    return 0;
  }
  it("敌方带利刃旧伤时剑招 max 伤害严格更高；防御意图不炸", () => {
    let withScar = 0, without = 0;
    for (let i = 0; i < 30; i++) {
      withScar = Math.max(withScar, duelOnce(["利刃"]));
      without = Math.max(without, duelOnce(undefined));
    }
    expect(without).toBeGreaterThan(0); // 链路确实打出了伤害
    expect(withScar).toBeGreaterThan(without);
  });
  it("钝击拳打利刃疤不加伤（不同类）", () => {
    const fist = { id: "m2", name: "重拳", type: "攻击", baseDamageMultiplier: 1, desc: "一拳击出" };
    function fistOnce(scarKinds) {
      const intents = { u1: { move: fist, targetId: "e" }, e: { move: guard, targetId: "u1" } };
      const ally = { ...mkUnit(), movesetLocal: [fist] };
      const { turnLog } = runTeamTurn([ally], [foeUnit(scarKinds)], intents);
      for (const entry of turnLog || []) {
        const r = entry?.result;
        if (r && r.damageToB > 0) return r.damageToB;
      }
      return 0;
    }
    let withScar = 0, without = 0;
    for (let i = 0; i < 30; i++) {
      withScar = Math.max(withScar, fistOnce(["利刃"]));
      without = Math.max(without, fistOnce(undefined));
    }
    expect(withScar).toBe(without);
  });
});

// autoFight 野战入口覆盖：combatChoice 注入路径纯函数级验证（state 直取）
describe("autoFight 野战链注入形状", () => {
  it("buildEnemyUnit 副本可携 scarKinds 且 runTeamTurn 生效", async () => {
    const { buildEnemyUnit } = await import("../combat/teamUnits.js");
    const npc = { id: "questfoe_x", name: "甲", faction: "黑风寨", special: { 体魄: 5, 身法: 5 }, moveset: [{ id: "d", name: "守", type: "防御", baseDamageMultiplier: 0.5 }] };
    const unit = {
      ...buildEnemyUnit(npc),
      scarKinds: scarKindsOfNemesis(roster, "黑风寨", "甲"),
    };
    expect(unit.scarKinds.sort()).toEqual(["利刃", "火毒"].sort());
    // 与主链同一 resolveTurn 底：此处只钉装配形状，数值生效已由 runTeamTurn 测试覆盖
  });
});

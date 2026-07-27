import { describe, it, expect } from "vitest";
import { ensureNpcCombatData } from "../npcGeneration.js";
import { duelDropChance } from "../combat/duelSettleMath.js";

// 这一套钉的是「切磋赢了不掉东西」那个 bug 的链路。
//
// 【bug 原样】commitRound 开头会给 AI 新报的 NPC 跑 ensureNpcCombatData 固化
// carriedItems/moveset/combatStats，但那是写在 d.p.room.npcs 这个**临时对象**上。
// 而原地互动（切磋/对话/查看，即没触发移动的绝大多数回合）走的分支是
//   setRoom(r => ({ ...r, ...d.p.room, npcs: r.npcs }))
// npcs 取旧的 r.npcs，刚固化的数据整个被丢掉。
// 后果：AI 生成的路人永远没有 carriedItems → 掉落池 (carriedItems||[]) 恒为空
// → 那段掷骰压根不执行 → 一件都不掉。
//
// 【为什么很难发现】掉落本来就是概率的（气运5≈33%），不掉看起来像运气差。
// 只有 residentNpcs 里带显式 carry 的驻场走另一条注入路径、能正常掉，
// 所以玩家的体感是"只有村里那个老猎户爆过东西"。
//
// 【修法约束】不能改成信 AI 返回的名单——那是另一个已修 bug 的根因
// （AI 每轮重新发明在场人物，"此地的人一会好几个一会都走光"）。只回填数据、不动名单。

// 复刻修好之后的回填逻辑（与 commitRound 里那段同构）
function pickCombatData(fresh) {
  const out = {};
  for (const k of ["carriedItems", "moveset", "special", "combatStats", "levelCap",
                   "waigong", "neigong", "baseAtk", "equipAtk", "equipDef", "personalityProfile"]) {
    if (fresh[k] !== undefined) out[k] = fresh[k];
  }
  return out;
}
const backfill = (roster, freshMap) => roster.map(o => {
  if (o?.carriedItems) return o;
  const fresh = freshMap.get(o?.name);
  return fresh?.carriedItems ? { ...o, ...pickCombatData(fresh) } : o;
});

describe("固化本身是有效的（兜底会给东西）", () => {
  it("AI 省略 carry 字段时，rollNpcCarry 兜底仍产出随身物", () => {
    const fixed = ensureNpcCombatData({ name: "王铁匠", id: "n1", brief: "镇上铁匠" }, { luck: 5, levelCap: 1 });
    expect(fixed.carriedItems.length).toBeGreaterThan(0);
    expect(fixed.moveset).toBeTruthy();
    expect(fixed.combatStats).toBeTruthy();
  });
  it("carry: [] 是「明确身无长物」，不该被兜底填满", () => {
    const fixed = ensureNpcCombatData({ name: "穷汉", id: "n2", carry: [] }, { luck: 5, levelCap: 0 });
    expect(fixed.carriedItems).toEqual([]);
  });
});

describe("回填：名单不动、数据补齐", () => {
  const fresh = ensureNpcCombatData({ name: "王铁匠", id: "n1", brief: "镇上铁匠" }, { luck: 5, levelCap: 1 });
  const freshMap = new Map([["王铁匠", fresh]]);

  it("旧名单里没有 carriedItems 的人被补上（这就是修的那个洞）", () => {
    const roster = [{ name: "王铁匠", id: "n1", brief: "镇上铁匠" }];
    const out = backfill(roster, freshMap);
    expect(out[0].carriedItems.length).toBeGreaterThan(0);
    expect(out[0].moveset).toBeTruthy();
  });

  it("名单本身不变——不新增也不删除人（这是不能碰的红线）", () => {
    const roster = [{ name: "王铁匠" }, { name: "张三" }];
    const out = backfill(roster, new Map([["王铁匠", fresh], ["李四", fresh]]));
    expect(out.map(n => n.name)).toEqual(["王铁匠", "张三"]);   // 李四不该凭空进来
  });

  it("已固化过的人原样不动（不重新随机随身物）", () => {
    const already = { name: "王铁匠", carriedItems: [{ name: "旧物" }] };
    const out = backfill([already], freshMap);
    expect(out[0]).toBe(already);
    expect(out[0].carriedItems[0].name).toBe("旧物");
  });

  it("回填不冲掉名单上的系统字段（驻场绑定/内层锁/候选标记）", () => {
    const roster = [{
      name: "王铁匠", lockInnerRoom: "孟记铁铺",
      companionCandidate: true, residentBound: true,
    }];
    const out = backfill(roster, freshMap);
    expect(out[0].lockInnerRoom).toBe("孟记铁铺");
    expect(out[0].companionCandidate).toBe(true);
    expect(out[0].residentBound).toBe(true);
    expect(out[0].carriedItems.length).toBeGreaterThan(0);   // 同时数据也补上了
  });

  it("stolen/dropped 标记不被回填覆盖（否则偷过的东西会复活）", () => {
    const looted = {
      name: "王铁匠",
      carriedItems: [{ name: "铁锤", stolen: true }, { name: "布巾", dropped: true }],
    };
    const out = backfill([looted], freshMap);
    expect(out[0].carriedItems[0].stolen).toBe(true);
    expect(out[0].carriedItems[1].dropped).toBe(true);
  });

  it("freshMap 里没这个人时原样返回，不炸", () => {
    const roster = [{ name: "无名路人" }];
    expect(backfill(roster, freshMap)[0].name).toBe("无名路人");
    expect(() => backfill(roster, new Map())).not.toThrow();
  });

  it("脏名单不炸", () => {
    expect(() => backfill([null, {}, { name: "" }], freshMap)).not.toThrow();
  });
});

describe("掉落池非空之后，掷骰这一步本来就是好的", () => {
  it("概率按气运走，不是恒为0", () => {
    expect(duelDropChance(5)).toBeGreaterThan(0.3);
    expect(duelDropChance(10)).toBeCloseTo(0.75);
    expect(duelDropChance(0)).toBe(0);
  });
  it("过滤掉已偷/已掉的之后池子仍可用", () => {
    const carried = [{ name: "a", stolen: true }, { name: "b" }, { name: "c", dropped: true }];
    const pool = carried.filter(it => !it.stolen && !it.dropped);
    expect(pool.map(i => i.name)).toEqual(["b"]);
  });
});

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

// ── 同一个池子还喂着偷窃，所以那条路一起被治了 ────────────────────────
// 【为什么要单独钉这一组】偷窃读的是同一个 npc.carriedItems
// （kungfu/learnSkill.js tryStealFrom 第152行）。池子被丢空时：
//   · 第一掷（得不得手）照常过——基础45%起，看不出异常
//   · 但 pickStealOutcome(有招, **无物**) 会直接返回 "move"
//   → 每一次成功都静默变成偷招，物件一件也偷不到
//   · 若那人连专属招也没有（平民多数如此），落到 outcome===null，
//     玩家看到的是"摸了半天，却发现他身上早已一无所有"——
//     读起来像"这人真穷"的设计，实际是 bug 的症状。
// 历史证据：STEAL_CONFIG.stealMoveChance 的注释写着从 0.5 调到 0.25 是因为
// "玩家体感偷不到东西"——当时把症状当概率问题调了参数，病根其实在固化回填这一环。
// 这组测试就是防止以后又去动那个参数而想不到池子。
import { attemptSteal, pickStealOutcome, stealSuccessRate, STEAL_CONFIG } from "../combat/stealSystem.js";

describe("偷窃：确实掷骰，且吃的是同一个 carriedItems 池", () => {
  it("池子空 → 每次成功都被迫转成偷招（这就是当时的症状）", () => {
    const outcomes = new Set();
    for (let i = 0; i < 50; i++) outcomes.add(pickStealOutcome(true, false));
    expect([...outcomes]).toEqual(["move"]);
  });

  it("池子空且无招可偷 → 落到「身上一无所有」（看着像设计，其实是症状）", () => {
    expect(pickStealOutcome(false, false)).toBeNull();
  });

  it("池子非空 → 偷物才成为主要结果（stealMoveChance=0.25）", () => {
    let item = 0;
    for (let i = 0; i < 400; i++) if (pickStealOutcome(true, true) === "item") item++;
    expect(item / 400).toBeGreaterThan(0.6);   // 期望 0.75
    expect(STEAL_CONFIG.stealMoveChance).toBeLessThan(0.5);
  });

  it("成功率是系统裁决的连续曲线，不是 AI 说了算", () => {
    expect(stealSuccessRate(0, 5)).toBeGreaterThan(0.4);
    expect(stealSuccessRate(100, 10)).toBeCloseTo(STEAL_CONFIG.maxRate);
    // 封顶永远留失败可能——失败要扣好感+生气，风险不能丢
    expect(STEAL_CONFIG.maxRate).toBeLessThan(1);
  });

  it("attemptSteal 附带 rate/roll 供调试面板展示（可复盘的掷骰）", () => {
    const r = attemptSteal(30, 5);
    expect(typeof r.rate).toBe("number");
    expect(typeof r.roll).toBe("number");
    expect(typeof r.success).toBe("boolean");
  });

  it("失败的代价也是写死的：扣好感 + 生气若干回合", () => {
    expect(STEAL_CONFIG.angryFavorabilityLoss).toBeGreaterThan(0);
    expect(STEAL_CONFIG.angryTurns).toBeGreaterThan(0);
  });
});

// ── 驻场NPC的设定被「名字已在就跳过」挡在门外 ──────────────────────────
// 【实测反馈】「你想对才旦下手，摸了半天，却发现他身上早已一无所有」——
// 而 residentNpcs.js 里才旦明明配了 7 件 carry。
//
// 【真实时序】开局第一轮 AI 就在 room.npcs 里报了「才旦」（它只会给 name/brief，
// 不知道 residentNpcs.js 里那 7 件）。之后驻场注入 effect 每次都判定"他已经在了"
// → 整个跳过 → 带着完整 carry/levelCap/beast 的驻场版本**永远进不来**。
// 玩家看到的「一无所有」像是在说这人穷，其实是设定没接上。
//
// 【上一个修复为什么不够】commitRound 那边的回填源是本轮 AI 返回的 npcs 经
// rollNpcCarry 兜底随机出来的，既不是作者配的那 7 件，也只在 AI 恰好返回了
// room.npcs 的回合才有。真正该修的是注入这一处：名字在了也要补数据。

// 复刻修好后的补丁逻辑（与 MudRPG 驻场注入里那段同构）
const patchRoster = (roster, inject) => {
  const byName = new Map(inject.map(n => [n.name, n]));
  return roster.map(o => {
    const full = byName.get(o?.name);
    if (!full) return o;
    if (o.carriedItems) return o;
    return { ...o, ...Object.fromEntries(Object.entries(full).filter(([k, v]) => o[k] === undefined && v !== undefined)) };
  });
};

describe("驻场设定要补给已在名单里的人", () => {
  const aiVersion = { name: "才旦", id: "n1", brief: "村口少年", innerRoom: "村口·广场" };
  const residentVersion = {
    name: "才旦", id: "resident_caidan", brief: "鱼定村少年猎户", levelCap: 1,
    carry: [{ name: "鱼定猎刀" }],
    carriedItems: [{ name: "鱼定猎刀" }, { name: "止血散" }],
    moveset: ["x"], combatStats: { hp: [100, 100] },
  };

  it("AI 版本被补上作者配的随身物（这就是修的那个洞）", () => {
    const out = patchRoster([aiVersion], [residentVersion]);
    expect(out[0].carriedItems.map(i => i.name)).toEqual(["鱼定猎刀", "止血散"]);
    expect(out[0].levelCap).toBe(1);
  });

  it("AI 自己有值的字段保留，不被驻场版覆盖", () => {
    const out = patchRoster([aiVersion], [residentVersion]);
    expect(out[0].brief).toBe("村口少年");          // 不被换成驻场版的 brief
    expect(out[0].innerRoom).toBe("村口·广场");     // 内层落点保留
  });

  it("已经有随身物的人一律不动（否则偷过的东西会复活）", () => {
    const looted = { name: "才旦", carriedItems: [{ name: "鱼定猎刀", stolen: true }] };
    const out = patchRoster([looted], [residentVersion]);
    expect(out[0]).toBe(looted);
    expect(out[0].carriedItems[0].stolen).toBe(true);
  });

  it("不在驻场表里的人原样返回", () => {
    const stranger = { name: "无名路人" };
    expect(patchRoster([stranger], [residentVersion])[0]).toBe(stranger);
  });

  it("名单不新增不删除（补数据不改人数）", () => {
    const out = patchRoster([aiVersion, { name: "张三" }], [residentVersion, { name: "李四", carriedItems: [] }]);
    expect(out.map(n => n.name)).toEqual(["才旦", "张三"]);
  });

  it("脏名单不炸", () => {
    expect(() => patchRoster([null, {}, { name: "" }], [residentVersion])).not.toThrow();
  });
});

describe("回到那句台词：池子补上之后就不该再出现了", () => {
  it("才旦在 residentNpcs 里确实配了随身物（作者说的「每个人身上都放了物品」）", async () => {
    const { getResidentNpcs } = await import("../residentNpcs.js");
    const caidan = getResidentNpcs("鱼定村").find(n => n.name === "才旦");
    expect(caidan).toBeTruthy();
    expect(caidan.carry.length).toBeGreaterThan(0);
  });

  it("配了 carry 的驻场，固化后 carriedItems 就是那几件（不走随机兜底）", async () => {
    const { getResidentNpcs } = await import("../residentNpcs.js");
    const caidan = getResidentNpcs("鱼定村").find(n => n.name === "才旦");
    const fixed = ensureNpcCombatData({ ...caidan }, { luck: 5, levelCap: caidan.levelCap ?? 1 });
    expect(fixed.carriedItems.map(i => i.name)).toEqual(caidan.carry.map(i => i.name));
  });
});

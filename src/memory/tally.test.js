import { describe, it, expect } from "vitest";
import {
  TALLY_KINDS, DAY_TURNS, emptyTally, dayOf, tallyAdd,
  tallyToday, tallyLifetime, tallyTotals,
  describeTodayForAI, describeDayForSummary, describeLifetime,
} from "./tally.js";
import { initialVarTree, isProtectedMvuPath, applyMvuCommands } from "../mvu.js";

describe("两个视野：今日会滚，累计不滚", () => {
  it("同一天累加", () => {
    let t = emptyTally();
    t = tallyAdd(t, "innerMove", 5);
    t = tallyAdd(t, "innerMove", 7);
    expect(tallyToday(t, 7).innerMove).toBe(2);
    expect(tallyLifetime(t).innerMove).toBe(2);
  });

  it("跨天：今日清零、累计续上", () => {
    let t = emptyTally();
    for (let i = 0; i < 5; i++) t = tallyAdd(t, "meditate", 5);   // 第0天
    t = tallyAdd(t, "meditate", DAY_TURNS + 2);                    // 第1天
    expect(tallyToday(t, DAY_TURNS + 2).meditate).toBe(1);
    expect(tallyLifetime(t).meditate).toBe(6);
  });

  it("跨天在写入时就地滚，不依赖任何 effect", () => {
    // 这是关键：effect 有可能因组件卸载/读档时序漏跑，漏一次昨天的数就混进今天且无人发现
    let t = tallyAdd(emptyTally(), "action", 5);
    expect(t.dayStamp).toBe(0);
    t = tallyAdd(t, "action", 100);        // 直接跳到第4天
    expect(t.dayStamp).toBe(dayOf(100));
    expect(tallyToday(t, 100).action).toBe(1);
  });

  it("只读不写也能正确判跨天（上次记数是昨天 → 今日为空）", () => {
    const t = tallyAdd(emptyTally(), "action", 5);
    expect(tallyToday(t, 5).action).toBe(1);
    expect(tallyToday(t, DAY_TURNS + 1)).toEqual({});   // 新的一天，今日空
    expect(tallyLifetime(t).action).toBe(1);            // 累计还在
  });

  it("dayOf 按 24 回合切", () => {
    expect(dayOf(0)).toBe(0);
    expect(dayOf(23)).toBe(0);
    expect(dayOf(24)).toBe(1);
    expect(dayOf(47)).toBe(1);
  });
});

describe("健壮性", () => {
  it("未登记的种类被忽略（防拼错字段污染）", () => {
    const t = tallyAdd(emptyTally(), "乱写的", 5);
    expect(t.lifetime["乱写的"]).toBeUndefined();
  });
  it("非正数增量不记", () => {
    let t = tallyAdd(emptyTally(), "action", 5, 0);
    t = tallyAdd(t, "action", 5, -3);
    expect(tallyLifetime(t).action).toBeUndefined();
  });
  it("脏输入不炸", () => {
    for (const v of [null, undefined, {}, "abc"]) {
      expect(() => tallyAdd(v, "action", 5)).not.toThrow();
      expect(() => tallyToday(v, 5)).not.toThrow();
    }
  });
  it("不就地修改传入对象", () => {
    const t = emptyTally();
    const snap = JSON.stringify(t);
    tallyAdd(t, "action", 5);
    expect(JSON.stringify(t)).toBe(snap);
  });
});

describe("三种输出各有各的用处", () => {
  const build = () => {
    let t = emptyTally();
    for (let i = 0; i < 12; i++) t = tallyAdd(t, "innerMove", 5);
    for (let i = 0; i < 3; i++) t = tallyAdd(t, "meditate", 5);
    for (let i = 0; i < 5; i++) t = tallyAdd(t, "action", 5);
    for (let i = 0; i < 1; i++) t = tallyAdd(t, "duel", 5);
    return t;
  };

  it("给AI的一行：只报今日、按次数降序、有条数上限（是调料不是账本）", () => {
    const line = describeTodayForAI(build(), 5, 2);
    expect(line).toContain("在据点内走动12次");
    expect(line).toContain("行动5次");
    expect(line).not.toContain("切磋");        // 被 max 截掉
    expect(line.split("、").length).toBe(2);
  });

  it("给AI的一行刻意不报累计（每轮读年鉴没有意义）", () => {
    const line = describeTodayForAI(build(), 5);
    expect(line).not.toContain("累计");
  });

  it("今日无动作时给AI的是空串（不注入噪音）", () => {
    expect(describeTodayForAI(emptyTally(), 5)).toBe("");
    expect(describeTodayForAI(build(), DAY_TURNS * 3)).toBe("");   // 已跨天
  });

  it("日总结原料带总数与明细", () => {
    const line = describeDayForSummary(build(), 5);
    expect(line).toContain("共动作21次");
    expect(line).toContain("在据点内走动12次");
  });

  it("年鉴给全量且标出哪类另有 memory", () => {
    const rows = describeLifetime(build());
    expect(rows[0].key).toBe("innerMove");
    expect(rows.find(r => r.key === "innerMove").aiBacked).toBe(false);
    expect(rows.find(r => r.key === "action").aiBacked).toBe(true);
  });

  it("总计两个视野都对", () => {
    const t = build();
    expect(tallyTotals(t, 5)).toEqual({ today: 21, lifetime: 21 });
    expect(tallyTotals(t, DAY_TURNS * 2).today).toBe(0);
  });
});

describe("走AI的和不走AI的都记（否则日总结会说今天什么都没干）", () => {
  it("登记表里两类都有", () => {
    const kinds = Object.values(TALLY_KINDS);
    expect(kinds.some(k => k.aiBacked)).toBe(true);
    expect(kinds.some(k => !k.aiBacked)).toBe(true);
  });
  it("此前完全无痕的那几类都在册", () => {
    for (const k of ["innerMove", "meditate", "equipToggle", "pickGround", "comfort", "companionSwitch", "seaEnter"]) {
      expect(TALLY_KINDS[k], `${k} 未登记`).toBeTruthy();
      expect(TALLY_KINDS[k].aiBacked).toBe(false);
    }
  });
});

describe("计数是系统裁决域，AI 不得编", () => {
  it("新档带起居注", () => {
    expect(initialVarTree().世界.起居注).toEqual(emptyTally());
  });
  it("路径受保护，相似路径不误伤", () => {
    expect(isProtectedMvuPath("世界.起居注")).toBe(true);
    expect(isProtectedMvuPath("世界.起居注.today.meditate")).toBe(true);
    expect(isProtectedMvuPath("世界.起居")).toBe(false);
  });
  it("AI 想改计数被拒且值不变", () => {
    const { tree, rejected } = applyMvuCommands(initialVarTree(), [
      { op: "set", path: "世界.起居注.today.meditate", value: 99 },
    ]);
    expect(rejected).toHaveLength(1);
    expect(tree.世界.起居注.today.meditate).toBeUndefined();
  });
});

// ── 起居注面板会用到的取数（面板本身是纯展示，逻辑都在这几个函数里）──
describe("起居注面板的取数", () => {
  const build = (t0) => {
    let t = emptyTally();
    for (let i = 0; i < 7; i++) t = tallyAdd(t, "innerMove", t0);
    for (let i = 0; i < 2; i++) t = tallyAdd(t, "talk", t0);
    return t;
  };

  it("今日页与累计页取的是同一份真值的两个视野", () => {
    const t = build(5);
    expect(tallyTotals(t, 5)).toEqual({ today: 9, lifetime: 9 });
    // 过一天：今日页空了，累计页不动
    expect(tallyTotals(t, DAY_TURNS + 1)).toEqual({ today: 0, lifetime: 9 });
  });

  it("条形图要用的最大值：两页各自算，不会互相影响比例", () => {
    const t = build(5);
    const todayMax = Math.max(...Object.values(tallyToday(t, 5)));
    const lifeMax = Math.max(...describeLifetime(t).map(r => r.count));
    expect(todayMax).toBe(7);
    expect(lifeMax).toBe(7);
  });

  it("累计页按次数降序，方便一眼看出玩了什么", () => {
    const rows = describeLifetime(build(5));
    expect(rows.map(r => r.count)).toEqual([...rows.map(r => r.count)].sort((a, b) => b - a));
    expect(rows[0].key).toBe("innerMove");
  });

  it("aiBacked 用于区分「只记数」与「另在见闻录有往事」", () => {
    const rows = describeLifetime(build(5));
    expect(rows.find(r => r.key === "innerMove").aiBacked).toBe(false);
    expect(rows.find(r => r.key === "talk").aiBacked).toBe(true);
  });

  it("空档：两页都给空表而不是报错", () => {
    expect(describeLifetime(emptyTally())).toEqual([]);
    expect(tallyToday(emptyTally(), 0)).toEqual({});
    expect(describeLifetime(undefined)).toEqual([]);
  });

  it("第N日的算法与面板标题一致（time/24+1）", () => {
    expect(Math.floor(0 / DAY_TURNS) + 1).toBe(1);
    expect(Math.floor(30 / DAY_TURNS) + 1).toBe(2);
  });
});

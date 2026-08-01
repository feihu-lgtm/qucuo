// 酒馆经营沙盒 · 引擎纯函数回归
// 跟项目其它数据层测试一个风格：不碰 DOM，只验纯函数的形状/确定性/结算。
import { describe, it, expect } from "vitest";
import {
  initSim, advanceTick, buyStock, setPrice, hireStaff, fireStaff,
  hireGuard, fireGuard, upgradeLevel, resolveEvent, getDailyCandidates,
  unlockedMenu, seatCount,
} from "./simEngine.js";
import { STOCK_BATCH, STOCK_INFO, TICKS_PER_DAY, MENU } from "./simData.js";

describe("initSim", () => {
  it("开局形状正确", () => {
    const s = initSim(42);
    expect(s.day).toBe(1);
    expect(s.tick).toBe(0);
    expect(s.funds).toBe(200);
    expect(s.seats.length).toBe(seatCount(s));
    expect(s.pendingEvent).toBeNull();
    // 定价默认等于基准价
    for (const d of MENU) expect(s.prices[d.id]).toBe(d.basePrice);
  });
});

describe("advanceTick", () => {
  it("确定性：同一 state 连调两次结果完全一致", () => {
    const s = initSim(42);
    const a = advanceTick(s);
    const b = advanceTick(s);
    expect(a).toEqual(b);
  });

  it("tick 推进，8 个时段后跨天并日结", () => {
    let s = initSim(42);
    s = { ...s, pendingEvent: null };
    for (let i = 0; i < TICKS_PER_DAY; i++) s = advanceTick(s);
    expect(s.day).toBe(2);
    expect(s.tick).toBe(0);
    expect(s.ledger.length).toBe(1);
    expect(s.ledger[0].day).toBe(1);
    // 打烊清场
    expect(s.seats.every(x => x === null)).toBe(true);
    // 模板夜报兜底一定在（AI 不在也要能玩）
    expect(s.nightReports[1]).toBeTruthy();
  });

  it("待决事件冻结时间", () => {
    let s = initSim(42);
    s = { ...s, pendingEvent: { id: "drunk_brawl", title: "醉酒闹事", desc: "x", options: [] } };
    const next = advanceTick(s);
    expect(next.tick).toBe(s.tick);
  });

  it("长跑 30 天不炸、账目仍是数", () => {
    let s = initSim(42);
    for (let i = 0; i < TICKS_PER_DAY * 30; i++) {
      s = advanceTick(s);
      if (s.pendingEvent) s = resolveEvent(s, s.pendingEvent.options[0].id);
    }
    expect(s.day).toBeGreaterThan(25);
    expect(Number.isFinite(s.funds)).toBe(true);
    expect(s.ledger.length).toBeGreaterThan(20);
  });
});

describe("经营动作", () => {
  it("进货扣钱加库存，钱不够只记日志", () => {
    let s = initSim(42);
    const before = s.pantry.wine;
    s = buyStock(s, "wine");
    expect(s.pantry.wine).toBe(before + STOCK_BATCH);
    expect(s.funds).toBe(200 - STOCK_INFO.wine.unitPrice * STOCK_BATCH);

    let poor = { ...initSim(42), funds: 0 };
    const logLen = poor.log.length;
    poor = buyStock(poor, "food");
    expect(poor.pantry.food).toBe(initSim(42).pantry.food);
    expect(poor.log.length).toBe(logLen + 1);
  });

  it("调价有上下限", () => {
    let s = initSim(42);
    s = setPrice(s, "wine_cup", 99);
    const dish = MENU.find(d => d.id === "wine_cup");
    expect(s.prices.wine_cup).toBe(Math.round(dish.basePrice * 2));
    s = setPrice(s, "wine_cup", 0.01);
    expect(s.prices.wine_cup).toBeGreaterThanOrEqual(1);
  });

  it("招工/辞退/护院佣金", () => {
    let s = initSim(42);
    const cand = { role: "cook", name: "王铁勺", skill: 5, wage: 9 };
    s = hireStaff(s, cand);
    expect(s.staff.cook.name).toBe("王铁勺");
    s = fireStaff(s, "cook");
    expect(s.staff.cook).toBeNull();

    const g = { name: "独臂刀客", skill: 5, fee: 100, wage: 7 };
    s = hireGuard(s, g);
    expect(s.guards.length).toBe(1);
    expect(s.funds).toBe(100);
    s = fireGuard(s, 0);
    expect(s.guards.length).toBe(0);
  });

  it("升级要声望与银子都够", () => {
    let s = initSim(42);
    s = upgradeLevel(s); // 声望 10 不够
    expect(s.level).toBe(0);
    s = { ...s, reputation: 80, funds: 2000 };
    s = upgradeLevel(s);
    expect(s.level).toBe(1);
    expect(s.seats.length).toBeGreaterThan(4);
  });
});

describe("事件", () => {
  it("赔钱了事：扣 12 两并清空待决", () => {
    let s = initSim(42);
    s = { ...s, pendingEvent: { id: "drunk_brawl", title: "醉酒闹事", desc: "x", options: [] } };
    s = resolveEvent(s, "pay");
    expect(s.pendingEvent).toBeNull();
    expect(s.funds).toBe(188);
  });

  it("每日候选种子稳定", () => {
    const s = initSim(42);
    expect(getDailyCandidates(s)).toEqual(getDailyCandidates(s));
  });
});

describe("查询", () => {
  it("菜单按声望解锁", () => {
    const s0 = initSim(42); // 声望 10
    expect(unlockedMenu(s0).every(d => d.minRep <= 10)).toBe(true);
    const s1 = { ...s0, reputation: 100 };
    expect(unlockedMenu(s1).length).toBe(MENU.length);
  });
});

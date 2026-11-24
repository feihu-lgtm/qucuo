import { describe, expect, it } from "vitest";
import { carryTradeSections, carryTradeEntries, cherishHearts, attireExposure } from "../../domain/rules/npc/npcCarry.js";
import { buyCarryEntry } from "./carryTrade.js";
import { ADVENTURER_BY_NAME } from "../../domain/data/dungeon/adventurers.js";

// 池里挑一个 carry 分区齐全的 OC
const OC_NAME = Object.keys(ADVENTURER_BY_NAME).find((n) => {
  const c = ADVENTURER_BY_NAME[n]?.carry || [];
  return c.some((e) => e.slot === "equipment") && c.some((e) => e.slot === "bag");
});

const makeState = (overrides = {}) => ({
  char: { money: 1000 },
  inv: [],
  room: { name: "雅江", npcs: [{ name: OC_NAME, carry: (ADVENTURER_BY_NAME[OC_NAME].carry || []).map(e => ({ ...e })) }] },
  ...overrides,
});

describe("carryTrade 三分区与标记", () => {
  it("carry 归一化成 equipment/bag/mount 三区", () => {
    const npc = { name: OC_NAME };
    const s = carryTradeSections(npc);
    expect(s.equipment.length + s.bag.length).toBeGreaterThan(0);
    expect(carryTradeEntries(npc).every((e) => e.slot && typeof e.sellable === "boolean")).toBe(true);
  });

  it("cherish ♥ 密度：≥80 三颗 / ≥50 两颗 / >0 一颗 / 0 不标", () => {
    expect(cherishHearts(90)).toBe("♥♥♥");
    expect(cherishHearts(60)).toBe("♥♥");
    expect(cherishHearts(20)).toBe("♥");
    expect(cherishHearts(0)).toBe("");
  });
});

describe("buyCarryEntry 买卖链", () => {
  it("不卖条目拒卖（舍不得/不卖），卖出入包扣钱写脱下日志", () => {
    const st = makeState();
    const npc = st.room.npcs[0];
    const unsellable = (npc.carry || []).find((e) => e.sellable === false || e.slot === "mount");
    const sellable = (npc.carry || []).find((e) => e.slot === "bag");
    if (unsellable) {
      const r = buyCarryEntry(st, npc, { ...unsellable, sellable: unsellable.sellable ?? (unsellable.slot === "mount" ? false : true) });
      expect(r.changes).toBeUndefined();
    }
    expect(sellable).toBeTruthy();
    const norm = { ...sellable, slot: "bag", sellable: true, price: sellable.price ?? 10 };
    const r = buyCarryEntry(st, npc, norm);
    expect(r.changes).toBeTruthy();
    expect(r.changes.char(st.char).money).toBe(1000 - norm.price);
    expect(r.changes.inv(st.inv).some((i) => i.name === sellable.name)).toBe(true);
  });

  it("装备类成交写「脱下了」日志并标 sold；钱不够拒闸", () => {
    const st = makeState();
    const npc = st.room.npcs[0];
    const gear = (npc.carry || []).find((e) => e.slot === "equipment" && e.sellable !== false);
    if (gear) {
      const r = buyCarryEntry(st, npc, { ...gear, sellable: true, price: 50 });
      expect(r.logs.some((l) => l.text.includes("脱下了"))).toBe(true);
      const after = r.changes.room(st.room).npcs.find((n) => n.name === npc.name);
      expect(after.carry.find((c) => c.name === gear.name).sold).toBe(true);
    }
    const broke = buyCarryEntry(makeState({ char: { money: 0 } }), st.room.npcs[0], { name: "糖油果子", price: 10, sellable: true, slot: "bag" });
    expect(broke.changes).toBeUndefined();
    expect(broke.logs[0].text).toContain("银两不够");
  });

  it("已标 sold 的 live 条目拒第二次购买（连点不吃亏）", () => {
    const st = makeState();
    const npc = st.room.npcs[0];
    const sellable = (npc.carry || []).find((e) => e.slot === "bag");
    expect(sellable).toBeTruthy();
    const norm = { ...sellable, slot: "bag", sellable: true, price: sellable.price ?? 10 };
    const first = buyCarryEntry(st, npc, norm);
    const roomAfter = first.changes.room(st.room);
    const npcAfter = roomAfter.npcs.find((n) => n.name === npc.name);
    const second = buyCarryEntry({ ...st, room: roomAfter }, npcAfter, norm);
    expect(second.changes).toBeUndefined();
    expect(second.logs[0].text).toContain("已经不在");
    // 玩家把买走的装备送回来（giftNpc 追加一条无标记副本）→ 还能再买
    const npcReturned = {
      ...npcAfter,
      carry: [...npcAfter.carry, { name: sellable.name, category: sellable.category, quality: sellable.quality, slot: "bag" }],
    };
    const third = buyCarryEntry({ ...st, room: roomAfter }, npcReturned, norm);
    expect(third.changes).toBeTruthy();
    // catalog 真货入包带战斗属性
    const inInv = first.changes.inv(st.inv).find((i) => i.name === sellable.name);
    expect(inInv.buyPrice ?? inInv.sellPrice).toBeTruthy();
  });
});

describe("attireExposure 衣不蔽体档", () => {
  it("装备区有护身甲不算暴露；扒光算衣不蔽体", () => {
    const armored = { name: "测试", carry: [{ name: "锁子甲", category: "armor", quality: "蓝", slot: "equipment" }] };
    expect(attireExposure(armored)).toBeNull();
    const bare = { name: "测试", carry: [{ name: "糖块", category: "misc", quality: "白", slot: "bag" }] };
    expect(attireExposure(bare)).toBe("衣不蔽体");
    const onlyWeapon = { name: "测试", carry: [{ name: "短刀", category: "weapon", quality: "白", slot: "equipment" }] };
    expect(attireExposure(onlyWeapon)).toBeNull();
    const onlyTrinket = { name: "测试", carry: [{ name: "银扣", category: "accessory", quality: "白", slot: "equipment" }] };
    expect(attireExposure(onlyTrinket)).toBe("只剩零星饰物在身");
  });
});

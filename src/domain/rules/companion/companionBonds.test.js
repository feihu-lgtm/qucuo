import { describe, expect, it } from "vitest";
import { pairKey, tierOf, readBond, applyBondDelta, applyDuoOutcome, BOND_MIN, BOND_MAX } from "./companionBonds.js";

describe("companionBonds 配对账（V7c 验收）", () => {
  it("配对键字典序幂等", () => {
    expect(pairKey("珍珠", "雪豹")).toBe(pairKey("雪豹", "珍珠"));
    expect(pairKey("珍珠", "雪豹")).toContain("|");
  });

  it("分档边界正确", () => {
    expect(tierOf(-50)).toBe("嫌隙");
    expect(tierOf(-1)).toBe("嫌隙");
    expect(tierOf(0)).toBe("生分");
    expect(tierOf(19)).toBe("生分");
    expect(tierOf(20)).toBe("熟络");
    expect(tierOf(49)).toBe("熟络");
    expect(tierOf(50)).toBe("默契");
    expect(tierOf(79)).toBe("默契");
    expect(tierOf(80)).toBe("过命");
    expect(tierOf(100)).toBe("过命");
  });

  it("applyBondDelta Clamp 在 -50..100 且不改原对象", () => {
    const base = { bonds: { [pairKey("珍珠", "雪豹")]: { score: 98, tier: "过命", lastBeat: "" } } };
    const next = applyBondDelta(base, "雪豹", "珍珠", 5, "拌嘴");
    const bond = next.bonds[pairKey("珍珠", "雪豹")];
    expect(bond.score).toBe(BOND_MAX);
    expect(bond.lastBeat).toBe("拌嘴");
    expect(base.bonds[pairKey("珍珠", "雪豹")].score).toBe(98);
    const down = applyBondDelta(base, "珍珠", "雪豹", -200);
    expect(down.bonds[pairKey("珍珠", "雪豹")].score).toBe(BOND_MIN);
    expect(readBond(down, "珍珠", "雪豹").tier).toBe("嫌隙");
  });

  it("ledgerNote 双向心账写入", () => {
    const cs = { pearl: { label: "珍珠" }, snowLeopard: { label: "雪豹" } };
    const { varTree } = applyDuoOutcome(cs, { 角色: {} }, "珍珠", "雪豹", { bondDelta: 2, ledgerNote: "抢食拌嘴" }, { time: 10, place: "鱼定村" });
    const a = varTree.角色.珍珠.心账.at(-1);
    const b = varTree.角色.雪豹.心账.at(-1);
    expect(a.summary).toContain("与雪豹");
    expect(a.summary).toContain("抢食拌嘴");
    expect(b.summary).toContain("与珍珠");
    expect(a.tag).toBe("见");
  });

  it("transfer 硬拦截：物品不存在于 from 携物——不许凭空造物", () => {
    const cs = {
      pearl: { label: "珍珠", carriedItems: [{ name: "一袋青稞精料" }] },
      snowLeopard: { label: "雪豹", carriedItems: [] },
    };
    const out = applyDuoOutcome(cs, {}, "珍珠", "雪豹", { transfer: { from: "珍珠", to: "雪豹", itemName: "龙涎香" } });
    expect(out.transferApplied).toBeNull();
    expect(out.transferRejected).toContain("不许凭空造物");
    expect(out.companionState.pearl.carriedItems).toHaveLength(1);
  });

  it("transfer 硬拦截：绑定装备不可转交", () => {
    const cs = {
      pearl: { label: "珍珠", carriedItems: [{ name: "藏纹小马鞍", bound: true }] },
      snowLeopard: { label: "雪豹", carriedItems: [] },
    };
    const out = applyDuoOutcome(cs, {}, "珍珠", "雪豹", { transfer: { from: "珍珠", to: "雪豹", itemName: "藏纹小马鞍" } });
    expect(out.transferApplied).toBeNull();
    expect(out.transferRejected).toContain("绑定装备");
  });

  it("transfer 合法：物品从 from 移到 to", () => {
    const cs = {
      pearl: { label: "珍珠", carriedItems: [{ name: "一袋青稞精料" }] },
      snowLeopard: { label: "雪豹", carriedItems: [] },
    };
    const out = applyDuoOutcome(cs, {}, "珍珠", "雪豹", { transfer: { from: "珍珠", to: "雪豹", itemName: "一袋青稞精料" } });
    expect(out.transferApplied).toEqual({ from: "珍珠", to: "雪豹", itemName: "一袋青稞精料" });
    expect(out.companionState.pearl.carriedItems).toHaveLength(0);
    expect(out.companionState.snowLeopard.carriedItems).toHaveLength(1);
  });

  it("bondDelta 超 ±5 被 Clamp", () => {
    const cs = {};
    const { companionState } = applyDuoOutcome(cs, {}, "珍珠", "雪豹", { bondDelta: 99 });
    expect(companionState.bonds[pairKey("珍珠", "雪豹")].score).toBe(5);
  });
});

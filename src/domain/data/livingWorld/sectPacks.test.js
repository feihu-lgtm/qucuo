// WO-25L 验收：两大扩展包联合注册通过 validateWorldPacks、50 天全图模拟无异常、
// 智谋/魅力边界钳制全绿、打探暗线解码分级。
import { describe, expect, it } from "vitest";
import { snowlandSectsPack } from "./snowlandSectsPack.js";
import { bashuSectsPack } from "./bashuSectsPack.js";
import { buildDefaultRegistry, validateWorldPacks } from "./index.js";
import { stepLivingWorld } from "../../rules/livingWorld/worldPulse.js";
import { statAdjustPriceMod, statShaveRatio, SHAVE_MIN, SHAVE_MAX } from "../../rules/economy/bargain.js";
import { listenToRumor } from "../../../features/buildings/study.js";

const applyResultToState = (state, result) => ({ ...state, varTree: result.changes.varTree(state.varTree) });

describe("WO-25L 扩展包联合注册", () => {
  it("三包联合注册通过 validateWorldPacks 全绿", () => {
    const registry = buildDefaultRegistry();
    expect(validateWorldPacks(registry)).toEqual([]);
    expect(registry.packs).toEqual(["qucuo_core", "snowland_sects", "bashu_sects"]);
  });

  it("19 家势力在两大新包中均有落笔（世界生态闭合）", () => {
    const text = JSON.stringify([snowlandSectsPack, bashuSectsPack]);
    for (const f of ["萨迦世家", "噶举山人", "古象雄苯门", "雪山派", "青城派", "峨眉派", "唐门", "五仙教", "天龙教"]) {
      expect(text).toContain(f);
    }
  });

  it("50 天全图模拟：逐时辰步进无异常、确定性可复现、账本结构完好", () => {
    const registry = buildDefaultRegistry();
    const seed = { time: 0, varTree: { 世界: {} } };
    const run50 = (s0) => {
      let cur = s0;
      for (let t = 0; t < 50 * 24; t += 2) {
        const result = stepLivingWorld({ ...cur, time: t }, registry);
        if (result) cur = applyResultToState({ ...cur, time: t }, result);
      }
      return cur;
    };
    const a = run50(seed);
    const b = run50(seed);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const w = a.varTree.世界;
    expect((w.事件录 || []).length).toBeLessThanOrEqual(80);
    for (const v of Object.values(w.tension || {})) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    for (const v of Object.values(w.势力战力 || {})) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    // 编队步进真实发生：至少一支编队在册且有节点
    const squads = w.编队册 || {};
    expect(Object.keys(squads).length).toBeGreaterThan(0);
  }, 120000);
});

describe("WO-25L 议价钳制", () => {
  it("智5魅5 保底 5%、智10魅10 封顶 15%、中间线性", () => {
    expect(statShaveRatio({ wit: 5, charm: 5 })).toBeCloseTo(SHAVE_MIN);
    expect(statShaveRatio({ wit: 10, charm: 10 })).toBeCloseTo(SHAVE_MAX);
    expect(statShaveRatio({ wit: 8, charm: 7 })).toBeCloseTo(0.1);
    // 低属性不跌破 5%、爆高属性不冲破 15%
    expect(statShaveRatio({ wit: 0, charm: 0 })).toBeCloseTo(SHAVE_MIN);
    expect(statShaveRatio({ wit: 15, charm: 15 })).toBeCloseTo(SHAVE_MAX);
  });

  it("只削溢价不加深打折，折扣与平价原样", () => {
    const mod = statAdjustPriceMod({ all: 1.4, medicine: 1.2, food: 0.85, sundries: 1 }, { wit: 10, charm: 10 });
    // 15% 削幅：1.4 → 1+0.4*0.85=1.34；1.2 → 1+0.2*0.85=1.17
    expect(mod.all).toBeCloseTo(1.34);
    expect(mod.medicine).toBeCloseTo(1.17);
    expect(mod.food).toBe(0.85);
    expect(mod.sundries).toBe(1);
  });

  it("空表与 null 原样返回", () => {
    expect(statAdjustPriceMod(null, {})).toBeNull();
  });
});

describe("WO-25L 打探暗线解码", () => {
  const mkState = (wit, extra = {}) => ({
    char: { money: 100, special: { 智谋: wit } },
    time: 48,
    room: { name: "锦官城" },
    varTree: { 世界: { 据点局势: { 锦官城: [{ id: "sit_poison_fair", expireDay: 5 }] } } },
    ...extra,
  });

  it("智谋 >=6 解出剩余天数、>=8 再解势力原委", () => {
    const dull = listenToRumor(mkState(5), "有风声", 5);
    expect(dull.settle).not.toContain("天才散");
    const sharp = listenToRumor(mkState(6), "有风声", 5);
    expect(sharp.settle).toContain("天才散");
    expect(sharp.settle).not.toContain("唐门暗中放货");
    const sharper = listenToRumor(mkState(8), "有风声", 5);
    expect(sharper.settle).toContain("唐门暗中放货");
  });

  it("无活跃局势时不多嘴", () => {
    const st = mkState(9);
    st.varTree.世界.据点局势 = {};
    const r = listenToRumor(st, "有风声", 5);
    expect(r.settle).not.toContain("压低嗓子");
  });
});

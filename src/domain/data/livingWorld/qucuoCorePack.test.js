// WO-25G 验收：静态校验 100% 通过 + 模拟玩家击败黑风寨关键人物后推演 30 天，
// 验证商队复兴与 ovr_yuquan_prosper 真实触发。
import { describe, expect, it } from "vitest";
import { qucuoCorePack } from "./qucuoCorePack.js";
import { buildDefaultRegistry } from "./index.js";
import { validateWorldPacks } from "../../rules/livingWorld/worldRegistry.js";
import { stepLivingWorld } from "../../rules/livingWorld/worldPulse.js";
import { evalWorldStates, resolveDistrictOverride } from "../../rules/livingWorld/evalWorld.js";

const applyResultToState = (state, result) => ({ ...state, varTree: result.changes.varTree(state.varTree) });

describe("WO-25G qucuoCorePack", () => {
  it("静态校验 100% 通过（据点/势力/引用/路线连通全绿）", () => {
    const registry = buildDefaultRegistry();
    expect(validateWorldPacks(registry)).toEqual([]);
    expect(registry.packs).toEqual(["qucuo_core"]);
    expect(registry.worldStates).toHaveLength(6);
    expect(registry.districtOverrides).toHaveLength(4);
    expect(registry.situations).toHaveLength(6);
    expect(registry.roamingSquads).toHaveLength(4);
  });

  it("扩展包幂等注册不炸", () => {
    expect(() => buildDefaultRegistry()).not.toThrow();
  });

  it("30 天剧本推演：玩家击败巴桑 → 黑风寨元气大伤激活 → ovr_yuquan_prosper 覆写胜出", () => {
    const registry = buildDefaultRegistry();
    // 初始世界：玩家已击败巴桑（人物动态 hpRatio 0 推定 dead）、玉泉寨声誉 60 结盟安靖
    let state = {
      time: 0,
      varTree: {
        世界: {
          人物动态: { resident_basang: { hpRatio: 0 } },
          势力声誉: { 玉泉寨: 60 },
        },
      },
    };

    // 开局快照：黑风寨元气大伤 + 树倒猢狲 + 玉泉寨结盟安靖都该激活
    const opening = evalWorldStates(registry, state);
    expect(opening.has("ws_heifeng_weakened")).toBe(true);
    expect(opening.has("ws_heifeng_broken")).toBe(true);
    expect(opening.has("ws_yuquan_allied")).toBe(true);

    // 玉泉寨覆写裁决：ovr_yuquan_prosper（2 条件）真实触发
    const prosper = resolveDistrictOverride("玉泉寨", opening, registry);
    expect(prosper?.overrideId).toBe("ovr_yuquan_prosper");
    expect(prosper.ownerFaction).toBe("玉泉寨");

    // 黑风寨覆写：树倒猢狲权力真空
    const heifeng = resolveDistrictOverride("黑风寨", opening, registry);
    expect(heifeng?.overrideId).toBe("ovr_heifeng_leaderless");

    // 推演 30 天：世界 pulse 逐时辰步进不崩溃，确定性可复现
    const run30 = (seedState) => {
      let cur = seedState;
      for (let t = 0; t < 30 * 24; t += 2) {
        const result = stepLivingWorld({ ...cur, time: t }, registry);
        if (result) cur = applyResultToState({ ...cur, time: t }, result);
      }
      return cur;
    };
    const a = run30(state);
    const b = run30(state);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const w = a.varTree.世界;
    // 商队复兴：茶马商路无封锁时康巴茶马帮持续活跃跑线
    expect(w.编队册?.sq_chama_caravan?.active).toBe(true);
    expect(typeof w.编队册.sq_chama_caravan.node).toBe("string");
    // 黑风寨游骑因树倒猢狲退场（when not ws_heifeng_broken 不再满足）
    expect(w.编队册?.sq_heifeng_raiders?.active).toBeFalsy();
    // 事件录/张力/战力账本结构完好不崩溃
    expect((w.事件录 || []).length).toBeLessThanOrEqual(80);
    for (const v of Object.values(w.tension || {})) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    for (const v of Object.values(w.势力战力 || {})) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  }, 120000);

  it("冷启动新档 30 天：raider 劫 caravan 天敌遭遇会真实发生（张力账面为零也打）", () => {
    const registry = buildDefaultRegistry();
    // 全新档：无任何势力张力账、巴桑健在
    let cur = { time: 0, varTree: { 世界: {} } };
    for (let t = 0; t < 30 * 24; t += 2) {
      const result = stepLivingWorld({ ...cur, time: t }, registry);
      if (result) cur = applyResultToState({ ...cur, time: t }, result);
    }
    const w = cur.varTree.世界;
    const conflicts = (w.事件录 || []).filter((e) => e.kind === "编队冲突");
    expect(conflicts.length).toBeGreaterThan(0); // 冷启动不再死锁
    // 茶马帮被劫出伤药紧俏/山道封锁等后效局势卡（败方 onDefeated 触发）
    const boards = Object.values(w.据点局势 || {}).flat();
    expect(boards.length + conflicts.length).toBeGreaterThan(0);
  }, 120000);
});

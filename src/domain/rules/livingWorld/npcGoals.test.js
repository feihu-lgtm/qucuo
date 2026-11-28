// WO-25J 验收测试：ocWander 与人物动态零冲突、银囊/癖好差异化切片、
// 重逢锚真实事件、飞鸽优先近期有遭遇的熟人。
import { describe, expect, it } from "vitest";
import {
  inferAiPackage, inferQuirks, purseTierOf, resolveLifeSlice, renderLifeSliceLine, AI_PACKAGES, QUIRK_TAGS,
} from "./npcGoals.js";
import { DIMENSION_BY_TYPE, venuesByDimension, affordable, affordanceDetail } from "../../data/livingWorld/buildingAffordances.js";
import { getBuildingsForLocation } from "../../data/buildings/qucuoBuildings.js";
import { BUILDING_TYPE } from "../../data/buildings/buildingType.js";
import { buildReunionBlock } from "../npc/npcAwareness.js";
import { pickLetterSender } from "../../../features/pigeon/inbound.js";

const yajiangBuildings = getBuildingsForLocation("雅江");
const mkState = (world = {}, extra = {}) => ({
  time: 200,
  varTree: { 世界: { ...world }, 角色: extra.角色 || {} },
  ...extra,
});

describe("buildingAffordances 可供性表", () => {
  it("33 类建筑类型尽归五大维度或显式缺席（transport/sectshop/sect_entry/chest/dungeon 无生活维度）", () => {
    const types = Object.values(BUILDING_TYPE);
    const mapped = Object.keys(DIMENSION_BY_TYPE);
    // 设计 7.1 未列的类型：驿站/门派商坊/拜师堂/库房/地宫——允许缺席但必须显式知情
    const absent = types.filter((t) => !mapped.includes(t));
    expect(absent.sort()).toEqual(["chest", "dungeon", "sect_entry", "sectshop", "transport"].sort());
  });

  it("菜谱建筑活计直读真实菜名", () => {
    const lou = yajiangBuildings.find((b) => b.id === "restaurant_yajiang");
    expect(affordanceDetail(lou)).toContain("冷锅鱼");
  });

  it("venuesByDimension 分桶正确", () => {
    const venues = venuesByDimension(yajiangBuildings);
    expect(venues.dine.some((b) => b.id === "restaurant_yajiang")).toBe(true);
  });

  it("银囊门槛：窘迫进不了玉石料场，肥实能进", () => {
    expect(affordable("gamblestone", 0)).toBe(false);
    expect(affordable("gamblestone", 3)).toBe(true);
    expect(affordable("restaurant", 0)).toBe(true);
  });
});

describe("npcGoals 四元推导", () => {
  it("职业包推断：身份关键词命中，带重伤一律 injured_rest", () => {
    expect(inferAiPackage({ brief: "商行掌柜" })).toBe("merchant");
    expect(inferAiPackage({ brief: "巡营兵卒" })).toBe("patrol");
    expect(inferAiPackage({ brief: "游方猎人" })).toBe("ranger");
    expect(inferAiPackage({ brief: "商行掌柜" }, { hpRatio: 0.3 })).toBe("injured_rest");
    expect(AI_PACKAGES).toContain("merchant");
  });

  it("癖好推断 1-2 个标签且都在枚举内", () => {
    const quirks = inferQuirks({ brief: "嘴馋好吃狗", personality: "爱听戏" });
    expect(quirks.length).toBeGreaterThanOrEqual(1);
    expect(quirks.length).toBeLessThanOrEqual(2);
    for (const q of quirks) expect(QUIRK_TAGS).toContain(q);
    expect(inferQuirks({ brief: "嘴馋好吃狗" })).toContain("饕客");
  });

  it("银囊水位：实账优先，无账按种子确定分档", () => {
    const stored = { 世界: { 人物动态: { 甲: { purse: "肥实" } } } };
    expect(purseTierOf(stored, "甲", 100)).toBe(3);
    // 无账推导确定性
    expect(purseTierOf({}, "乙", 100)).toBe(purseTierOf({}, "乙", 100));
    // 跨三日窗可能变，同窗内不变（72 格一窗：100 与 140 同窗）
    expect(purseTierOf({}, "乙", 100)).toBe(purseTierOf({}, "乙", 140));
  });
});

describe("resolveLifeSlice 生活切片", () => {
  const npc = { name: "测试镖师", brief: "走镖的镖师", personality: "" };

  it("同一时辰窗恒同、跨窗可变、形状合规", () => {
    const a = resolveLifeSlice({ npc, varTree: {}, time: 40, buildings: yajiangBuildings });
    const b = resolveLifeSlice({ npc, varTree: {}, time: 41, buildings: yajiangBuildings });
    expect(a).toBeTruthy();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.activityLabel).toBeTruthy();
    expect(a.buildingName).toBeTruthy();
    expect(a.mood).toBeTruthy();
    expect(a.untilTurn).toBeGreaterThan(41);
    expect(a.detail.length).toBeGreaterThan(4);
  });

  it("建筑清单为空/无合适场子返回 null", () => {
    expect(resolveLifeSlice({ npc, varTree: {}, time: 40, buildings: [] })).toBeNull();
  });

  it("带伤人物偏向救急疗养", () => {
    const varTree = { 世界: { 人物动态: { [npc.name]: { hpRatio: 0.5 } } } };
    // 连抽多个时辰窗，带伤者 recovery 命中率应显著高于无伤者
    let injuredRecovery = 0;
    let healthyRecovery = 0;
    for (let t = 24; t < 24 * 20; t += 4) {
      const s1 = resolveLifeSlice({ npc, varTree, time: t, buildings: yajiangBuildings });
      const s2 = resolveLifeSlice({ npc, varTree: {}, time: t, buildings: yajiangBuildings });
      if (s1?.activity === "recovery") injuredRecovery += 1;
      if (s2?.activity === "recovery") healthyRecovery += 1;
    }
    expect(injuredRecovery).toBeGreaterThan(healthyRecovery);
  });

  it("银囊窘迫不进高消费场子", () => {
    const varTree = { 世界: { 人物动态: { [npc.name]: { purse: "窘迫" } } } };
    for (let t = 24; t < 24 * 30; t += 4) {
      const s = resolveLifeSlice({ npc, varTree, time: t, buildings: getBuildingsForLocation("锦官城") });
      if (!s) continue;
      const b = getBuildingsForLocation("锦官城").find((x) => x.id === s.buildingId);
      if (b) expect(affordable(b.type, 0) || s.activity == null).toBe(true);
    }
  });

  it("饕客比非饕客更多落在吃吃喝喝", () => {
    const foodie = { name: "吃货丙", brief: "嘴馋好吃", personality: "" };
    const ascetic = { name: "清修丁", brief: "苦修僧", personality: "" };
    let foodieDine = 0;
    let asceticDine = 0;
    for (let t = 24; t < 24 * 30; t += 4) {
      if (resolveLifeSlice({ npc: foodie, varTree: {}, time: t, buildings: yajiangBuildings })?.activity === "dine") foodieDine += 1;
      if (resolveLifeSlice({ npc: ascetic, varTree: {}, time: t, buildings: yajiangBuildings })?.activity === "dine") asceticDine += 1;
    }
    expect(foodieDine).toBeGreaterThan(asceticDine);
  });

  it("零冲突铁律：切片不含位置写权，只读不碰游走册", () => {
    const registry = { 测试镖师: { at: "雅江", inner: null, since: 0 } };
    const varTree = { 世界: { 游走册: registry } };
    const before = JSON.stringify(registry);
    const slice = resolveLifeSlice({ npc, varTree, time: 40, buildings: yajiangBuildings });
    expect(JSON.stringify(registry)).toBe(before);
    // 快照里没有 at/inner/since 位置字段——位置唯一真源是游走册/房间实际在场
    expect(slice.at).toBeUndefined();
    expect(slice.inner).toBeUndefined();
    expect(slice.since).toBeUndefined();
  });

  it("模版 A 片段渲染：时辰/场所/银囊/心境/由头齐备", () => {
    const slice = resolveLifeSlice({ npc, varTree: {}, time: 40, buildings: yajiangBuildings });
    const line = renderLifeSliceLine(slice, 40);
    expect(line).toContain("此刻生活：");
    expect(line).toContain(slice.buildingName);
    expect(line).toContain(`银囊${slice.purse}`);
    expect(line).toContain(`心境${slice.mood}`);
    expect(line).toContain("可介入由头");
  });
});

describe("buildReunionBlock 重逢锚真实事件", () => {
  const reunions = [{ name: "老孙", lastTurn: 10, gap: 120 }];

  it("有真实事件时附经历摘要且改换补写指令", () => {
    const state = mkState({
      事件录: [
        { id: "e1", turn: 100, text: "老孙在雅江与车队起了冲突，受了些伤。", npcs: ["老孙"], knownDistricts: ["雅江"] },
      ],
    });
    const block = buildReunionBlock(reunions, 100, state);
    expect(block).toContain("真实经历");
    expect(block).toContain("受了些伤");
    expect(block).toContain("直接由所列事件延展");
  });

  it("无真实事件时退回原通用补写提示", () => {
    const state = mkState({ 事件录: [] });
    const block = buildReunionBlock(reunions, 100, state);
    expect(block).toContain("合理、克制、与其处境相称的变化");
    expect(block).not.toContain("真实经历");
  });

  it("不传 state 保持旧行为（向后兼容）", () => {
    const block = buildReunionBlock(reunions);
    expect(block).toContain("合理、克制、与其处境相称的变化");
  });

  it("文本匹配降级：事件 npcs 字段缺失但正文提及此人也算", () => {
    const state = mkState({
      事件录: [{ id: "e2", turn: 90, text: "老孙的饭馆被人砸了场子。", knownDistricts: ["鱼定村"] }],
    });
    const block = buildReunionBlock(reunions, 100, state);
    expect(block).toContain("砸了场子");
  });
});

describe("pickLetterSender 飞鸽读真实事件", () => {
  // 构造最小可用 state：两个已认识 NPC，其中一人近日卷入事件
  const npcA = { name: "云逸", brief: "游方道人", personality: "闲散" };
  const npcB = { name: "郭三", brief: "铁匠", personality: "粗豪" };

  function letterState(events = []) {
    return {
      time: 200,
      room: { npcs: [npcA, npcB] },
      varTree: {
        世界: { 已认识人物: ["云逸", "郭三"], 事件录: events },
        角色: { 云逸: { 好感度: 30 }, 郭三: { 好感度: 30 } },
      },
    };
  }

  it("近日卷入事件的熟人权重更高（大样本下被抽中次数显著多）", () => {
    const events = [
      { id: "e1", turn: 180, text: "云逸在渡口救了个落水的孩子。", npcs: ["云逸"], knownDistricts: ["焚风渡"] },
    ];
    const state = letterState(events);
    let a = 0;
    let b = 0;
    for (let i = 0; i < 400; i += 1) {
      const rng = () => i / 400 + 0.0001; // 固定分位扫一遍加权区间
      const picked = pickLetterSender(state, rng);
      if (!picked) continue;
      if (picked.name === "云逸") a += 1;
      if (picked.name === "郭三") b += 1;
    }
    expect(a).toBeGreaterThan(b);
  });

  it("hint 携带事件摘要与银囊窘迫", () => {
    const events = [
      { id: "e1", turn: 190, text: "云逸与人打赌输了个精光。", npcs: ["云逸"] },
    ];
    const state = letterState(events);
    state.varTree.世界.人物动态 = { 云逸: { purse: "窘迫" } };
    // 扫到云逸为止
    let hint = null;
    for (let i = 0; i < 500 && !hint; i += 1) {
      const picked = pickLetterSender(state, () => i / 500 + 0.0001);
      if (picked?.name === "云逸") hint = picked.hint;
    }
    expect(hint).toBeTruthy();
    expect(hint.events[0]).toContain("打赌输了");
    expect(hint.poorPurse).toBe(true);
  });

  it("超过 3 天的旧事件不加权", () => {
    const events = [
      { id: "e1", turn: 100, text: "云逸百天前的旧事。", npcs: ["云逸"] },
    ];
    const state = letterState(events);
    let picked = null;
    for (let i = 0; i < 500 && !picked; i += 1) {
      const p = pickLetterSender(state, () => i / 500 + 0.0001);
      if (p?.name === "云逸") picked = p;
    }
    expect(picked?.hint?.events?.length || 0).toBe(0);
  });
});

describe("Review 回归：锚定/窗内稳定/癖好同口径", () => {
  const npc = { name: "测试镖师", brief: "走镖的镖师", personality: "" };

  it("0002 锚定建筑：同处一室的人绝不被写进别家场子", () => {
    const lou = yajiangBuildings.find((b) => b.id === "restaurant_yajiang");
    for (let t = 24; t < 24 * 10; t += 4) {
      const s = resolveLifeSlice({ npc, varTree: {}, time: t, buildings: yajiangBuildings, anchorBuilding: lou });
      expect(s).toBeTruthy();
      expect(s.buildingId).toBe("restaurant_yajiang");
      expect(s.detail).toContain("冷锅鱼"); // 锚定饭馆就着饭馆活计
    }
    // 无生活维度的处所（驿站 transport）锚定回退 null——不强造切片
    const station = yajiangBuildings.find((b) => b.type === "transport");
    if (station) {
      expect(resolveLifeSlice({ npc, varTree: {}, time: 40, buildings: yajiangBuildings, anchorBuilding: station })).toBeNull();
    }
  });

  it("0004 窗内任意时刻求值恒同——untilTurn 前不换活", () => {
    // 跨饭点边界的窗（10-14 含午饭点 11-13 与否则权重不同）
    for (const ws of [8, 10, 12, 16, 20]) {
      const at = (t) => resolveLifeSlice({ npc, varTree: {}, time: ws * 1 + t, buildings: yajiangBuildings });
      const a = at(0);
      if (!a) continue;
      for (const dt of [1, 2, 3]) {
        // 同窗内（ws 对齐 4 格窗起点意义下 dt<4 且不落出窗）
        const t0 = Math.floor((ws) / 4) * 4;
        const t1 = ws + dt;
        if (Math.floor(t1 / 4) !== Math.floor(ws / 4)) continue;
        expect(JSON.stringify(at(dt)), `ws=${ws} dt=${dt}`).toBe(JSON.stringify(a));
      }
    }
    // 严格扫一遍：所有时辰窗内 4 格逐格比对
    for (let w = 0; w < 24; w += 4) {
      const base = resolveLifeSlice({ npc, varTree: {}, time: w, buildings: yajiangBuildings });
      for (let dt = 1; dt < 4; dt += 1) {
        const cur = resolveLifeSlice({ npc, varTree: {}, time: w + dt, buildings: yajiangBuildings });
        expect(JSON.stringify(cur), `窗${w}+${dt}`).toBe(JSON.stringify(base));
      }
    }
  });

  it("0003 赌徒癖好参与银囊分档：同一 npc 两处同口径", () => {
    const gambler = { name: "赌鬼戊", brief: "好赌成性", personality: "见骰子就手痒" };
    const quirks = inferQuirks(gambler);
    expect(quirks).toContain("手痒赌徒");
    // 带癖好与不带癖好的分档分布不同（赌徒波动大）——扫多个窗口应有非寻常档出现
    const tiersWith = new Set();
    const tiersWithout = new Set();
    for (let w = 0; w < 30; w += 1) {
      tiersWith.add(purseTierOf({}, "赌鬼戊", w * 72, quirks));
      tiersWithout.add(purseTierOf({}, "赌鬼戊", w * 72, []));
    }
    expect(tiersWith.size).toBeGreaterThanOrEqual(tiersWithout.size);
  });
});

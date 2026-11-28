// 路遇随机事件：数据完整性、池子抽人、活世界对接（谓词、局势、编队、事件录、张力）与提示词。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ROAD_EVENTS, ROAD_EVENT_CATEGORIES, CATEGORY_KEYS, PLACE_TAGS, ALL_TAGS, SITUATION_IDS, livingAffinity } from "../../src/domain/data/roadEvents/index.js";
import {
  SIX_STATS, ITEM_CATEGORY_CODE, parseCast, parseRewardCodes, isEligible, eligibleEvents, ocCandidates, isRomanceEligible,
  rollRoadEvent, resolveRoadEvent, roadEventWrites, buildRoadEventNote, buildResolutionNote, isNight, evalWhen,
} from "./roadEvents.js";
import { DOC_PATH, buildDoc } from "./buildRoadEventsDoc.mjs";
import { SKILL_CATALOG } from "../../src/domain/data/kungfu/qucuoKungfu.js";
import { QUALITY } from "../../src/domain/rules/economy/equipment.js";
import { QUCUO_MAP } from "../../src/domain/data/map/qucuoMap.js";
import { passerRolesOf } from "../../src/domain/data/npc/randomPassers.js";
import { FACTIONS as REP_FACTIONS } from "../../src/domain/data/map/factions.js";
import { WANDERING_OCS } from "../../src/domain/rules/npc/ocWander.js";
import { seededRand } from "../../src/utils/seededRandom.js";

const PASSER_FACTIONS = [...REP_FACTIONS.map((f) => f.name), "散人"];
const SCHOOLS = new Set([...Object.keys(SKILL_CATALOG), "any"]);
const allCodes = (e) => [e.win, e.lose, e.alt].join("|").split("|").filter(Boolean);
const day = (h = 10, extra = {}) => ({ time: 24 * 30 + h, varTree: {}, flags: [], char: { special: { 气运: 5, 悟性: 5 } }, ...extra });
const byId = (id) => ROAD_EVENTS.find((e) => e.id === id);
const withWorld = (w, base = day()) => ({ ...base, varTree: { ...base.varTree, 世界: { ...(base.varTree?.世界 || {}), ...w } } });

describe("路遇事件数据", () => {
  it("20 类各 20 件，共 400 件，编号连续且唯一", () => {
    expect(CATEGORY_KEYS).toHaveLength(20);
    expect(ROAD_EVENTS).toHaveLength(400);
    for (const k of CATEGORY_KEYS) {
      expect(ROAD_EVENTS.filter((e) => e.cat === k).map((e) => e.id), k).toEqual(Array.from({ length: 20 }, (_, i) => `${k}${String(i + 1).padStart(2, "0")}`));
    }
  });

  it("地标签覆盖全部地图节点（特殊节点除外），事件地点都真实存在", () => {
    for (const n of Object.keys(QUCUO_MAP)) if (!["心灵之海", "第三新东京市"].includes(n)) expect(PLACE_TAGS[n], n).toBeTruthy();
    for (const e of ROAD_EVENTS) for (const w of e.where) expect(Boolean(PLACE_TAGS[w]) || ALL_TAGS.includes(w), `${e.id} ${w}`).toBe(true);
  });

  it("来人、检定、难度、稀有度合法", () => {
    for (const e of ROAD_EVENTS) {
      const cast = parseCast(e.cast);
      if (cast?.kind === "role") {
        expect(PASSER_FACTIONS.includes(cast.faction), `${e.id} ${cast.faction}`).toBe(true);
        expect(["男", "女"].includes(cast.gender), e.id).toBe(true);
        expect(passerRolesOf(cast.faction).length, cast.faction).toBeGreaterThan(0);
      }
      if (e.check) expect(SIX_STATS.includes(e.check), e.id).toBe(true);
      expect(e.dc >= 4 && e.dc <= 10, e.id).toBe(true);
      expect([1, 2, 3].includes(e.tier), e.id).toBe(true);
    }
  });

  it("每个奖励码都能解析，引用的门派、品阶、六维、势力、局势卡都真实存在", () => {
    for (const e of ROAD_EVENTS) {
      for (const f of parseRewardCodes(allCodes(e).join("|"), { destNode: "大草甸", rng: () => 0.5 })) {
        if (f.op === "GRANT_ITEM") { expect(Object.values(ITEM_CATEGORY_CODE).includes(f.category), e.id).toBe(true); expect(QUALITY.includes(f.quality), e.id).toBe(true); }
        if (f.op === "BESTOW_SKILL") { expect(SCHOOLS.has(f.school), e.id).toBe(true); expect(["成长", "独门"].includes(f.growthMode), e.id).toBe(true); }
        if (f.op === "SHIFT_SPECIAL_STAT") { expect(SIX_STATS.includes(f.attr), e.id).toBe(true); expect(f.delta).toBe(1); }
        if (f.op === "FACTION_REP") expect(REP_FACTIONS.some((x) => x.name === f.faction), `${e.id} ${f.faction}`).toBe(true);
        if (f.op === "ADD_SITUATION" || f.op === "CLEAR_SITUATION") expect(SITUATION_IDS.includes(f.situation), e.id).toBe(true);
        if (f.op === "APPLY_CONDITION") expect(f.durationTurns, e.id).toBeGreaterThan(0);
      }
    }
    for (const k of CATEGORY_KEYS) for (const s of Object.keys(livingAffinity(k).situations || {})) expect(SITUATION_IDS.includes(s), `${k} ${s}`).toBe(true);
  });

  it("长期奖励（永久六维、武学、同伴、美人、兽伴）的事件都只遇一次", () => {
    for (const e of ROAD_EVENTS) if (/(^|\|)(stat:|skill:|beast:|ally(\||$)|mate(\||$))/.test(e.win)) expect(e.once, e.id).toBe(true);
  });

  it("每个地图节点白天都有足够多的事件可抽（至少 25 件）", () => {
    const st = withWorld({ 传闻人物: { 某人: {} } });
    for (const node of Object.keys(PLACE_TAGS)) expect(eligibleEvents(st, node).length, node).toBeGreaterThanOrEqual(25);
  });

  it("全集文档与数据源一致（改了数据要重新生成）", () => {
    expect(readFileSync(DOC_PATH, "utf8")).toBe(buildDoc());
  });
});

describe("人物从现有池子取", () => {
  it("没有任何事件写死人名；同伴与美人一律走游走冒险者的人物槽，美人槽要求亲密设定", () => {
    for (const e of ROAD_EVENTS) {
      expect(e.cast.split(":").length, `写死了人名：${e.id}`).toBeLessThan(5);
      const codes = allCodes(e);
      if (codes.includes("ally") || codes.includes("mate")) expect(parseCast(e.cast)?.kind, e.id).toBe("oc");
      if (codes.includes("mate")) expect(parseCast(e.cast).romance, e.id).toBe(true);
    }
  });

  it("美人槽只抽得到带亲密设定、且生平里没有未满十八岁字样的冒险者", () => {
    const pool = WANDERING_OCS.filter(isRomanceEligible);
    expect(pool.length).toBeGreaterThan(0);
    for (const oc of pool) {
      expect(oc.intimacy && !oc.intimacy.forbidden, oc.name).toBeTruthy();
      expect(/十[一二三四五六七]岁|(?<!\d)1[0-7]岁/.test([oc.brief, oc.lifeHistory, oc.fullBio].join(" ")), oc.name).toBe(false);
    }
  });

  it("每个人物槽在它出没的地方至少有一处抽得到三个以上的人；已入队的人不会被抽到", () => {
    for (const e of ROAD_EVENTS) {
      const slot = parseCast(e.cast);
      if (slot?.kind !== "oc") continue;
      const nodes = Object.keys(PLACE_TAGS).filter((n) => e.where.some((w) => w === n || PLACE_TAGS[n].includes(w)));
      expect(Math.max(...nodes.map((n) => ocCandidates(slot, day(), n).length)), e.id).toBeGreaterThanOrEqual(slot.romance ? 1 : 3);
    }
    const slot = parseCast("oc:任");
    const someone = ocCandidates(slot, day(), "天都镇")[0].oc.name;
    const recruited = day(10, { companionState: { k: { unlocked: true, label: someone } } });
    expect(ocCandidates(slot, recruited, "天都镇").some((c) => c.oc.name === someone)).toBe(false);
  });

  it("游走册显示此刻就在本节点的冒险者更容易被抽到，结算后同步游走册位置", () => {
    const slot = parseCast("oc:任");
    const name = ocCandidates(slot, day(), "雅江")[0].oc.name;
    const here = withWorld({ 游走册: { [name]: { at: "雅江" } } });
    expect(ocCandidates(slot, here, "雅江").find((c) => c.oc.name === name).weight).toBeGreaterThan(1);
    const roll = rollRoadEvent(day(), "天都镇", { rng: seededRand(3, "oc") });
    const w = roadEventWrites(roll, { optionKey: "main", success: true, facts: [] });
    if (roll.cast?.kind === "oc") expect(w.rosterSync).toEqual({ name: roll.cast.name, at: "天都镇" });
  });
});

describe("对接活世界蓝图", () => {
  it("谓词：交情门槛、交恶门槛、六维门槛、传闻在册", () => {
    expect(isEligible(byId("J05"), withWorld({ 势力声誉: { 黑风寨: 19 } }), "黑风寨")).toBe(false);
    expect(isEligible(byId("J05"), withWorld({ 势力声誉: { 黑风寨: 20 } }), "黑风寨")).toBe(true);
    expect(isEligible(byId("S05"), day(), "黑风寨")).toBe(false);
    expect(isEligible(byId("S05"), withWorld({ 势力声誉: { 黑风寨: -30 } }), "黑风寨")).toBe(true);
    expect(isEligible(byId("F09"), day(), "山洞")).toBe(false);
    expect(isEligible(byId("F09"), day(10, { char: { special: { 悟性: 7 } } }), "山洞")).toBe(true);
    expect(isEligible(byId("T01"), day(), "打箭炉")).toBe(false);
    expect(isEligible(byId("T01"), withWorld({ 传闻人物: { 沙里飞: {} } }), "打箭炉")).toBe(true);
    expect(evalWhen({ type: "factionTensionGte", a: "青城派", b: "天龙教", value: 101 }, day())).toBe(false);
    expect(evalWhen({ type: "factionTensionGte", faction: "青城派", b: "天龙教", value: 60 }, day())).toBe(true);
    expect(evalWhen({ type: "factionTensionGte", faction: "青城派", value: 60 }, day())).toBe(true);
    expect(evalWhen({ type: "situationActive", id: "sit_herb_shortage", district: "天都镇" },
      withWorld({ 据点局势: { 天都镇: [{ id: "sit_herb_shortage", expireDay: 35 }] } }))).toBe(true);
    expect(evalWhen({ type: "flag", flag: "test_flag" }, withWorld({ 旗号: { test_flag: true } }))).toBe(true);
    expect(evalWhen({ type: "questDone", quest: "q_main" }, withWorld({ 任务册: { q_main: { done: true } } }))).toBe(true);
    expect(() => evalWhen({ type: "无此谓词" }, day())).toThrow();
  });

  it("夜里才有的事白天不出", () => {
    expect(isNight(day(10).time)).toBe(false);
    expect(isEligible(byId("R02"), day(10), "大草甸")).toBe(false);
    expect(isEligible(byId("R02"), day(22), "大草甸")).toBe(true);
  });

  it("局势卡生效时相应类别更容易出：山道封锁让黑风敲诈变多", () => {
    const count = (st) => { let n = 0; for (let i = 0; i < 300; i++) if (rollRoadEvent(st, "黑风寨", { rng: seededRand(i, "j") })?.eventId.startsWith("J")) n++; return n; };
    const blocked = withWorld({ 据点局势: { 黑风寨: [{ id: "sit_road_blockade", sinceDay: 29, expireDay: 33 }] } });
    expect(count(blocked)).toBeGreaterThan(count(day()));
  });

  it("编队停在本节点时，来人取编队的势力", () => {
    const st = withWorld({ 离线编队: { sq_chama_caravan: { at: "打箭炉", role: "caravan", faction: "玉泉寨" } } });
    let hit = null;
    for (let i = 0; i < 200 && !hit; i++) { const r = rollRoadEvent(st, "打箭炉", { rng: seededRand(i, "sq") }); if (r.eventId.startsWith("A") && r.cast?.kind === "role") hit = r; }
    expect(hit.cast.faction).toBe("玉泉寨");
    expect(hit.cast.squadId).toBe("sq_chama_caravan");
  });

  it("只遇一次记在 flags；冷却从事件录里的路遇条目推算", () => {
    const st = day();
    const roll = { eventId: "D07", destNode: "焚风渡", day: 30, turn: st.time, cast: null, options: [] };
    const w = roadEventWrites(roll, { optionKey: "main", success: true, facts: [] });
    expect(w.flagsAdd).toEqual(["road_once_D07"]);
    expect(isEligible(byId("D07"), { ...st, flags: w.flagsAdd }, "焚风渡")).toBe(false);
    // 冷却：同一件事十日、同一类事一日（用两件同属茶马商队、来人走身份池的事，避免混进人物槽的因素）
    const a01 = { eventId: "A01", destNode: "天都镇", day: 30, turn: st.time, cast: null, options: [] };
    const logged = withWorld({ 事件录: [roadEventWrites(a01, { optionKey: "main", success: true, facts: [] }).worldEvent] });
    expect(isEligible(byId("A02"), logged, "大草甸")).toBe(false);
    expect(isEligible(byId("A02"), { ...logged, time: logged.time + 48 }, "大草甸")).toBe(true);
    expect(isEligible(byId("A01"), { ...logged, time: logged.time + 24 * 5 }, "天都镇")).toBe(false);
    expect(isEligible(byId("A01"), { ...logged, time: logged.time + 24 * 10 }, "天都镇")).toBe(true);
  });

  it("每次路遇产出一条 WorldEvent，首扩散点是本据点，且含 kind/actors/witnesses", () => {
    const roll = rollRoadEvent(day(), "打箭炉", { rng: seededRand(9, "we") });
    const w = roadEventWrites(roll, resolveRoadEvent(roll, "main", day(), { rng: () => 0 }));
    expect(w.worldEvent).toMatchObject({ kind: "road", type: "road", eventId: roll.eventId, district: "打箭炉", knownDistricts: ["打箭炉"], day: 30 });
    expect(Array.isArray(w.worldEvent.actors)).toBe(true);
    expect(w.worldEvent.witnesses).toContain("主角");
  });

  it("人物动态存在时，游走冒险者照面附带此刻状态（#691 对接）", () => {
    let roll = null;
    let state = day();
    for (let i = 0; i < 200 && !roll; i++) {
      const candidate = rollRoadEvent(state, "天都镇", { rng: seededRand(i, "life") });
      if (candidate?.cast?.kind === "oc") {
        state = withWorld({ 人物动态: { [candidate.cast.name]: { hpRatio: 0.55, purse: "宽裕", mood: "微醺" } } });
        roll = rollRoadEvent(state, "天都镇", { rng: seededRand(i, "life") });
      }
    }
    expect(roll.cast.lifeHint).toBe("带伤在身、银囊宽裕、心境微醺");
    expect(buildRoadEventNote(roll)).toContain("此刻状态：带伤在身、银囊宽裕、心境微醺");
  });

  it("势力摩擦：调停成功两家张力回落，失败或暗中相助则上升", () => {
    const roll = { eventId: "N01", destNode: "雅江", day: 30, turn: 0, cast: null, options: [] };
    const tension = (o) => o.facts.find((f) => f.op === "FACTION_TENSION");
    expect(tension(resolveRoadEvent(roll, "main", day(), { rng: () => 0 })).delta).toBeLessThan(0);
    expect(tension(resolveRoadEvent(roll, "main", day(), { rng: () => 0.999 })).delta).toBeGreaterThan(0);
    expect(tension(resolveRoadEvent(roll, "alt", day())).delta).toBeGreaterThan(0);
    expect(tension(resolveRoadEvent(roll, "main", day(), { rng: () => 0 }))).toMatchObject({ a: "青城派", b: "天龙教" });
  });
});

describe("提示词", () => {
  it("第一段停在抉择前、带情节核与可行之事；冒险者来人照档案写", () => {
    let roll = null;
    for (let i = 0; i < 200 && !roll; i++) { const r = rollRoadEvent(day(), "天都镇", { rng: seededRand(i, "p") }); if (r.cast?.kind === "oc") roll = r; }
    const note = buildRoadEventNote(roll);
    expect(note).toContain(byId(roll.eventId).seed);
    expect(note).toContain("照此人档案写");
    expect(note).toContain(roll.cast.name);
    for (const o of roll.options) expect(note).toContain(o.label);
  });

  it("第二段带已定事实与天机券填空", () => {
    const roll = rollRoadEvent(day(), "打箭炉", { rng: seededRand(7, "n") });
    const res = { optionKey: "main", success: true, facts: parseRewardCodes("item:武器:蓝|silver:+20|situation:-sit_road_blockade", { cast: roll.cast, destNode: "打箭炉", rng: () => 0.5 }) };
    const r2 = buildResolutionNote(roll, res);
    expect(r2).toContain("蓝品兵刃");
    expect(r2).toContain("得以化解");
    expect(r2).toContain("天机券填空");
  });
});

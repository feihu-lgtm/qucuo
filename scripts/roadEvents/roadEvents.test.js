// 路遇随机事件：数据完整性（400 件的每个引用都真实存在）与掷骰、结算、提示词的行为。
import { describe, expect, it } from "vitest";
import { ROAD_EVENTS, ROAD_EVENT_CATEGORIES, CATEGORY_KEYS, PLACE_TAGS, ALL_TAGS } from "./index.js";
import {
  SIX_STATS, ITEM_CATEGORY_CODE, parseCast, parseRewardCodes, isEligible, eligibleEvents,
  rollRoadEvent, resolveRoadEvent, nextRoadLedger, buildRoadEventNote, buildResolutionNote, isNight,
} from "./roadEvents.js";
import { SKILL_CATALOG } from "../../src/domain/data/kungfu/qucuoKungfu.js";
import { QUALITY } from "../../src/domain/rules/economy/equipment.js";
import { QUCUO_MAP } from "../../src/domain/data/map/qucuoMap.js";
import { passerRolesOf } from "../../src/domain/data/npc/randomPassers.js";
import { NPC_ART } from "../../src/domain/data/art/artManifest.js";
import { seededRand } from "../../src/utils/seededRandom.js";
import { FACTIONS as REP_FACTIONS } from "../../src/domain/data/map/factions.js";
import { readFileSync } from "node:fs";
import { DOC_PATH, buildDoc } from "./buildRoadEventsDoc.mjs";

const FACTIONS = ["鱼定土司府", "鱼定村", "喇嘛庙", "雪山派", "玉泉寨", "黑风寨", "百花门", "欢喜教", "锦官城", "青城派",
  "峨眉派", "唐门", "丐帮三星分舵", "五仙教", "天龙教", "三星派", "萨迦世家", "噶举山人", "古象雄苯门", "散人"];
const SCHOOLS = new Set([...Object.keys(SKILL_CATALOG), "any"]);
const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnAge(s) {
  const m = /^([一二三四五六七八九]?)十([一二三四五六七八九]?)/.exec(s || "");
  if (!m) return CN[s?.[0]] ?? NaN;
  return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
}
const allCodes = (e) => [e.win, e.lose, e.alt].join("|").split("|").filter(Boolean);
const day = (h = 10) => ({ time: 24 * 30 + h, varTree: {}, flags: [], char: { special: { 气运: 5, 悟性: 5 } } });

describe("路遇事件数据", () => {
  it("20 类各 20 件，共 400 件，编号连续且唯一", () => {
    expect(CATEGORY_KEYS).toHaveLength(20);
    expect(ROAD_EVENTS).toHaveLength(400);
    expect(new Set(ROAD_EVENTS.map((e) => e.id)).size).toBe(400);
    for (const k of CATEGORY_KEYS) {
      const ids = ROAD_EVENTS.filter((e) => e.cat === k).map((e) => e.id);
      expect(ids, k).toEqual(Array.from({ length: 20 }, (_, i) => `${k}${String(i + 1).padStart(2, "0")}`));
    }
  });

  it("地标签覆盖全部地图节点（特殊节点除外），事件的地点都真实存在", () => {
    for (const n of Object.keys(QUCUO_MAP)) if (!["心灵之海", "第三新东京市"].includes(n)) expect(PLACE_TAGS[n], n).toBeTruthy();
    for (const e of ROAD_EVENTS) for (const w of e.where) expect(Boolean(PLACE_TAGS[w]) || ALL_TAGS.includes(w), `${e.id} ${w}`).toBe(true);
    for (const c of Object.values(ROAD_EVENT_CATEGORIES)) for (const w of c.where) expect(ALL_TAGS.includes(w), w).toBe(true);
  });

  it("来人的势力、检定属性、难度、稀有度合法", () => {
    for (const e of ROAD_EVENTS) {
      const cast = parseCast(e.cast);
      if (cast && !cast.rumor) {
        expect(FACTIONS.includes(cast.faction), `${e.id} ${cast.faction}`).toBe(true);
        expect(["男", "女"].includes(cast.gender), e.id).toBe(true);
        expect(cast.role, e.id).toBeTruthy();
      }
      if (e.check) expect(SIX_STATS.includes(e.check), `${e.id} ${e.check}`).toBe(true);
      expect(e.dc).toBeGreaterThanOrEqual(4);
      expect(e.dc).toBeLessThanOrEqual(10);
      expect([1, 2, 3].includes(e.tier), e.id).toBe(true);
      expect(e.seed.length, e.id).toBeGreaterThan(20);
    }
    for (const f of FACTIONS) expect(passerRolesOf(f).length, f).toBeGreaterThan(0);
  });

  it("每个奖励码都能解析，引用的门派、品阶、类别、六维、势力都真实存在", () => {
    for (const e of ROAD_EVENTS) {
      const facts = parseRewardCodes(allCodes(e).join("|"), { cast: parseCast(e.cast), destNode: "大草甸", rng: () => 0.5 });
      for (const f of facts) {
        if (f.op === "GRANT_ITEM") { expect(Object.values(ITEM_CATEGORY_CODE).includes(f.category), e.id).toBe(true); expect(QUALITY.includes(f.quality), e.id).toBe(true); }
        if (f.op === "BESTOW_SKILL") { expect(SCHOOLS.has(f.school), `${e.id} ${f.school}`).toBe(true); expect(QUALITY.includes(f.quality), e.id).toBe(true); expect(["成长", "独门"].includes(f.growthMode), e.id).toBe(true); }
        if (f.op === "SHIFT_SPECIAL_STAT") { expect(SIX_STATS.includes(f.attr), `${e.id} ${f.attr}`).toBe(true); expect(f.delta).toBe(1); }
        if (f.op === "FACTION_REP") expect(REP_FACTIONS.some((x) => x.name === f.faction), `声誉系统里没有：${e.id} ${f.faction}`).toBe(true);
        if (f.op === "APPLY_CONDITION") { expect(f.flag, e.id).toBeTruthy(); expect(f.durationTurns, e.id).toBeGreaterThan(0); }
        if (f.op === "SPAWN_COMPANION_CANDIDATE" && f.beast) expect(["坐骑", "兽伴"].includes(f.role), e.id).toBe(true);
      }
    }
  });

  it("美人与同伴：都写明成年年纪、只遇一次、有固定姓名或兽名，且不与已有人物撞名", () => {
    const known = new Set(NPC_ART);
    const names = [];
    for (const e of ROAD_EVENTS) {
      const codes = allCodes(e);
      const recruits = codes.some((c) => c === "ally" || c === "mate");
      if (codes.includes("mate")) {
        const cast = parseCast(e.cast);
        if (!cast.rumor) expect(cnAge(cast.age), `${e.id} ${cast.age}`).toBeGreaterThanOrEqual(18);
      }
      if (recruits || codes.some((c) => c.startsWith("beast:"))) expect(e.once, e.id).toBe(true);
      const cast = parseCast(e.cast);
      if (cast?.name) names.push(cast.name);
    }
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(known.has(n), `与已有立绘人物撞名：${n}`).toBe(false);
  });

  it("主行动给永久六维、武学、同伴、美人、兽伴的事件都只遇一次，冷却后刷不出第二份", () => {
    for (const e of ROAD_EVENTS) {
      if (/(^|\|)(stat:|skill:|beast:|ally(\||$)|mate(\||$))/.test(e.win)) expect(e.once, e.id).toBe(true);
    }
  });

  it("每个地图节点白天都有足够多的事件可抽（至少 25 件）", () => {
    for (const node of Object.keys(PLACE_TAGS)) {
      const n = eligibleEvents({ ...day(), varTree: { 世界: { 传闻人物: { 某人: {} } } } }, node).length;
      expect(n, node).toBeGreaterThanOrEqual(25);
    }
  });
});

describe("路遇掷骰与结算", () => {
  it("只抽本地事件；同一种子结果可重放", () => {
    const a = rollRoadEvent(day(), "焚风渡", { rng: seededRand(1, "x") });
    const b = rollRoadEvent(day(), "焚风渡", { rng: seededRand(1, "x") });
    expect(a).toEqual(b);
    const ev = ROAD_EVENTS.find((e) => e.id === a.eventId);
    expect(ev.where.some((w) => w === "焚风渡" || PLACE_TAGS.焚风渡.includes(w))).toBe(true);
    expect(a.options.map((o) => o.key)).toEqual(["main", "alt", "leave"]);
  });

  it("夜里才有的事白天不出；需要交情的事交情不够不出；需要传闻的事没有传闻不出", () => {
    const nightOnly = ROAD_EVENTS.find((e) => e.id === "R02");
    expect(isNight(day(10).time)).toBe(false);
    expect(isEligible(nightOnly, day(10), "大草甸")).toBe(false);
    expect(isEligible(nightOnly, day(22), "大草甸")).toBe(true);
    const friendly = ROAD_EVENTS.find((e) => e.id === "J05");
    expect(isEligible(friendly, day(), "黑风寨")).toBe(false);
    expect(isEligible(friendly, { ...day(), varTree: { 世界: { 势力声誉: { 黑风寨: 19 } } } }, "黑风寨")).toBe(false);
    expect(isEligible(friendly, { ...day(), varTree: { 世界: { 势力声誉: { 黑风寨: 20 } } } }, "黑风寨")).toBe(true);
    const grudge = ROAD_EVENTS.find((e) => e.id === "S05");
    expect(isEligible(grudge, day(), "黑风寨")).toBe(false);
    expect(isEligible(grudge, { ...day(), varTree: { 世界: { 势力声誉: { 黑风寨: -30 } } } }, "黑风寨")).toBe(true);
    const rumor = ROAD_EVENTS.find((e) => e.id === "T01");
    expect(isEligible(rumor, day(), "打箭炉")).toBe(false);
    expect(isEligible(rumor, { ...day(), varTree: { 世界: { 传闻人物: { 沙里飞: {} } } } }, "打箭炉")).toBe(true);
  });

  it("只遇一次的事记账后不再出现；同类事一日内不重复", () => {
    const st = day();
    const roll = { eventId: "D07", destNode: "焚风渡", day: 30, cast: parseCast(ROAD_EVENTS.find((e) => e.id === "D07").cast) };
    const ledger = nextRoadLedger(st, roll);
    const after = { ...st, varTree: { 世界: { 路遇: ledger } } };
    expect(isEligible(ROAD_EVENTS.find((e) => e.id === "D07"), after, "焚风渡")).toBe(false);
    expect(isEligible(ROAD_EVENTS.find((e) => e.id === "D09"), after, "雅江")).toBe(false);
    const nextWeek = { ...after, time: after.time + 24 * 2 };
    expect(isEligible(ROAD_EVENTS.find((e) => e.id === "D09"), nextWeek, "雅江")).toBe(true);
  });

  it("主行动按检定定成败；次行动必成；离开无事", () => {
    const roll = { eventId: "C05", destNode: "雅江", day: 30, cast: parseCast(ROAD_EVENTS.find((e) => e.id === "C05").cast), options: [] };
    const win = resolveRoadEvent(roll, "main", day(), { rng: () => 0 });
    expect(win.success).toBe(true);
    expect(win.facts.some((f) => f.op === "SPAWN_COMPANION_CANDIDATE" && f.npc === "静姝")).toBe(true);
    const lose = resolveRoadEvent(roll, "main", day(), { rng: () => 0.999 });
    expect(lose.success).toBe(false);
    expect(lose.facts.some((f) => f.op === "SPAWN_COMPANION_CANDIDATE")).toBe(false);
    expect(resolveRoadEvent(roll, "alt", day()).facts.map((f) => f.op)).toEqual(["RUMOR_HOOK"]);
    expect(resolveRoadEvent(roll, "leave", day()).facts).toEqual([]);
  });

  it("第一段提示词停在抉择前、带情节核与三个可行之事；第二段带已定事实与天机券填空", () => {
    const roll = rollRoadEvent(day(), "打箭炉", { rng: seededRand(7, "n") });
    const note = buildRoadEventNote(roll);
    const ev = ROAD_EVENTS.find((e) => e.id === roll.eventId);
    expect(note).toContain(ev.seed);
    expect(note).toContain("路遇铁律");
    for (const o of roll.options) expect(note).toContain(o.label);
    const res = { optionKey: "main", success: true, facts: parseRewardCodes("item:武器:蓝|silver:+20", { cast: roll.cast, rng: () => 0.5 }) };
    const r2 = buildResolutionNote(roll, res);
    expect(r2).toContain("蓝品兵刃");
    expect(r2).toContain("银两 +20");
    expect(r2).toContain("天机券填空");
  });
});

describe("全集文档", () => {
  it("仓库里的全集文档与数据源一致（改了数据要重新生成）", () => {
    expect(readFileSync(DOC_PATH, "utf8")).toBe(buildDoc());
  });
});

import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { settleNpcDuel } from "../npc/settleDuel.js";

const find = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);
const resident = (district, name) => ({ ...getResidentNpcs(district).find((npc) => npc.name === name), imported: false });
const pooled = (npc) => ({ ...npc, id: `pool_${npc.id}` });
const apply = (state, result) => ({ ...state, ...Object.fromEntries(Object.entries(result.changes || {}).map(
  ([key, value]) => [key, typeof value === "function" ? value(state[key]) : value],
)) });
const base = (reps = {}, extra = {}) => ({
  char: { money: 0, special: { 悟性: 5, 根骨: 5 } },
  inv: [], skills: [], flags: [], time: 1,
  questProgress: {},
  varTree: { 世界: { 势力声誉: reps, 威望: 0 } },
  ...extra,
});
const at = (state, district, inner, npcs = []) => ({ ...state, room: { name: district, npcs: npcs.map(pooled) }, innerRoomName: inner });
const advance = (state, id, choice = "") => apply(state, parseLocalCommand(`推进任务 ${id} ${choice}`.trim(), state, { surface: "cli" }).result);
const win = (state, id, flag) => {
  const npc = { id: "foe", name: "对手", questBranchFlag: flag };
  return apply(state, settleNpcDuel(state, npc, { pendingQuestBranch: { questId: id, flag, mode: "combat" }, rng: () => 1, outcome: "win" }));
};
const names = (state) => state.inv.map((item) => item.name);

describe("峨2·佛道之辩", () => {
  const id = "emei_2_fodaoshilian";
  const quest = find(id);
  const zhaowei = resident("锦官城", "照微");
  const done1 = { emei_1_xichengshiyao: { status: "completed" } };
  const start = (reps = { 峨眉派: 15 }, extra = {}) => at(base(reps, { questProgress: done1, ...extra }), "锦官城", "练剑坪", [zhaowei]);
  const toVerdict = (extra) => {
    let s = advance(start(undefined, extra), id);
    s = advance(at(s, "锦官城", "城南贫民棚"), id);
    s = win(at(s, "锦官城", "练剑坪", [zhaowei]), id, "quest_emei2_spar");
    return at(s, "锦官城", "峨眉剑庐");
  };

  it("needs 峨1 done, 峨眉 ≥ 15 and 威望 ≥ 0", () => {
    expect(getLocalQuestStage(quest, start())?.id).toBe("brief");
    expect(getLocalQuestStage(quest, { ...start(), questProgress: {} })).toBeNull();
    expect(getLocalQuestStage(quest, start({ 峨眉派: 14 }))).toBeNull();
    expect(getLocalQuestStage(quest, { ...start(), varTree: { 世界: { 势力声誉: { 峨眉派: 15 }, 威望: -1 } } })).toBeNull();
  });

  it("mercy branch pays out the full 合稿 reward", () => {
    const s = advance(toVerdict(), id, "慈悲为先");
    expect(s.questProgress[id].status).toBe("completed");
    expect(s.char.money).toBe(150);
    expect(names(s)).toContain("《清心普善咒》入门手抄");
    expect(s.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 40, 青城派: 5, 丐帮三星分舵: 5, 五仙教: -8, 天龙教: -13 });
    expect(s.varTree.角色.了因师太.好感度).toBe(25);
  });

  it("both-paths branch needs 悟性 or 根骨 ≥ 8 and opens 藏剑阁", () => {
    const blocked = toVerdict();
    expect(advance(blocked, id, "慈悲带锋").questProgress[id].status).toBe("active");
    const s = advance(toVerdict({ char: { money: 0, special: { 悟性: 8 } } }), id, "慈悲带锋");
    expect(s.questProgress[id].status).toBe("completed");
    expect(s.flags).toContain("flag_emei_cangjian_open");
  });
});

describe("峨3·岷江旧簪", () => {
  const id = "emei_3_minjiangjiuyue";
  const quest = find(id);
  const xuanchen = resident("锦官城", "玄尘师太");
  const start = (known = ["何雨谢"]) => at(base({ 峨眉派: 40 }, {
    questProgress: { emei_2_fodaoshilian: { status: "completed" } },
    varTree: { 世界: { 势力声誉: { 峨眉派: 40 }, 已认识人物: known } },
  }), "锦官城", "峨眉剑庐", [xuanchen]);

  it("needs to have met 何雨谢", () => {
    expect(getLocalQuestStage(quest, start())?.id).toBe("letter");
    expect(getLocalQuestStage(quest, start([]))).toBeNull();
  });

  it("delivers the letter, brings back the half hairpin and rejoins it", () => {
    let s = advance(start(), id);
    expect(names(s)).toEqual(expect.arrayContaining(["金顶净心露", "玄尘亲笔密函"]));
    s = win(at(s, "雅江", "西城门"), id, "quest_emei3_ambush");
    s = advance(at(s, "雪山派", "内堂"), id);
    expect(names(s)).toEqual(["半支青铜旧簪"]);
    s = advance(at(s, "锦官城", "峨眉剑庐", [xuanchen]), id);
    expect(s.questProgress[id].status).toBe("completed");
    expect(names(s)).toEqual(["合璧青铜古簪"]);
    expect(s.flags).toContain("flag_emei_xueshan_reunited");
    expect(s.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 75, 雪山派: 20, 天龙教: -18, 鱼定土司府: -10 });
  });
});

describe("峨眉支线", () => {
  it("峨支1 rewards 峨眉 +10 without hitting its foes", () => {
    const id = "emei_sub1_chaojingbashiba";
    let s = advance(at(base(), "锦官城", "抄经堂", [resident("锦官城", "陈九")]), id);
    s = win(at(s, "锦官城", "暗巷入口"), id, "quest_emeisub1_alley");
    s = advance(at(s, "锦官城", "慈济佛堂"), id, "据理力争求破格");
    expect(s.questProgress[id].status).toBe("completed");
    expect(s.char.money).toBe(50);
    expect(names(s)).toContain("旧玉镇纸");
    expect(s.varTree.世界.势力声誉).toEqual({ 峨眉派: 10 });
  });

  it("峨支2 trades the pine branch for the bracers", () => {
    const id = "emei_sub2_baiyuanshiyuan";
    const situ = resident("锦官城", "司徒瑛");
    expect(getLocalQuestStage(find(id), at(base({ 峨眉派: 14 }), "锦官城", "白猿台", [situ]))).toBeNull();
    let s = advance(at(base({ 峨眉派: 15 }), "锦官城", "白猿台", [situ]), id);
    s = advance(at(s, "顶峰", "绝顶"), id);
    expect(names(s)).toEqual(["雪松劲枝"]);
    s = win(at(s, "锦官城", "白猿台", [situ]), id, "quest_emeisub2_spar");
    expect(s.questProgress[id].status).toBe("completed");
    expect(names(s)).toEqual(["白猿劲松护腕"]);
    expect(s.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 30, 青城派: 3 });
  });

  it("峨支3 quiet ledger branch only touches 唐门, then reforges the hairpin dagger", () => {
    const id = "emei_sub3_duanzanzhuihen";
    const zan = resident("锦官城", "簪娘");
    let s = advance(at(base({ 峨眉派: 40 }), "锦官城", "锻簪坊", [zan]), id);
    s = advance(at(s, "锦官城", "唐门暗巷"), id, "与唐三少暗中查账");
    expect(s.varTree.世界.势力声誉).toEqual({ 峨眉派: 40, 唐门: 5 });
    s = advance(at(s, "锦官城", "铸剑坊"), id);
    s = advance(at(s, "锦官城", "锻簪坊", [zan]), id);
    expect(s.questProgress[id].status).toBe("completed");
    expect(names(s)).toEqual(["唐伯渊私账副本", "素影银簪刺"]);
    expect(s.varTree.世界.势力声誉).toMatchObject({ 峨眉派: 60, 唐门: 5, 五仙教: -6 });
  });
});

import { describe, expect, it } from "vitest";
import {
  recruitOC, applyRecruit, npcBusyInQuest, hirePriceFor,
  OC_FAVOR_THRESHOLD, OC_QUEST_DONE_PREFIX, OC_CHILDHOOD_PREFIX,
} from "./ocRecruit.js";
import {
  unlockImportedCompanion, stationCompanion, unstationCompanion,
  stationedCompanions, stationedNpcsFor, activeCompanionKey,
} from "../../domain/rules/companion/companion.js";
import { inviteCompanion } from "./inviteCompanion.js";

const ADVENTURER = {
  id: "adv_xiaoyuer",
  name: "小鱼儿",
  title: "恶人谷少侠",
  levelCap: 3,
  brief: "鬼点子一箩筐",
  tradeStyle: "唯利是图，擅长讨价还价",
  kungfu: { school: "恶人谷", moves: [{ name: "移花接木", desc: "借力打力" }] },
};

const makeState = (overrides = {}) => ({
  char: { money: 500 },
  flags: [],
  varTree: { 角色: {}, 世界: {} },
  questProgress: {},
  companionState: {},
  room: { name: "雅江", npcs: [{ name: "小鱼儿", adventurer: true }] },
  ...overrides,
});

describe("recruitOC · hire 雇佣路", () => {
  it("出价够档价即过闸，扣钱入队", () => {
    const r = recruitOC(makeState(), ADVENTURER, "hire", { offer: hirePriceFor(ADVENTURER) });
    expect(r.ok).toBe(true);
    expect(r.effect.moneyDelta).toBe(-240); // 3 档 × 80
    expect(r.effect.companionState["imported_小鱼儿"]?.unlocked).toBe(true);
  });

  it("出价不足/袋中无钱/不收金银的 OC 拒闸", () => {
    expect(recruitOC(makeState(), ADVENTURER, "hire", { offer: 10 }).ok).toBe(false);
    expect(recruitOC(makeState({ char: { money: 5 } }), ADVENTURER, "hire", { offer: 240 }).ok).toBe(false);
    const noMoney = { ...ADVENTURER, tradeStyle: "不收金银，只收人情债" };
    const r = recruitOC(makeState(), noMoney, "hire", { offer: 9999 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("不收金银");
  });

  it("「不要寻常金银，只收罕见金属」这类变相拒银也雇不动（沈弄枢式）", () => {
    const barter = { ...ADVENTURER, tradeStyle: "不要寻常金银，只收罕见金属齿轮、异兽骨骼或活体试药人。" };
    expect(recruitOC(makeState(), barter, "hire", { offer: 9999 }).ok).toBe(false);
  });
});

describe("recruitOC · quest 前置任务路", () => {
  it("完成旗未落拒闸，落了过闸", () => {
    expect(recruitOC(makeState(), ADVENTURER, "quest").ok).toBe(false);
    const st = makeState({ flags: [`${OC_QUEST_DONE_PREFIX}${ADVENTURER.id}`] });
    expect(recruitOC(st, ADVENTURER, "quest").ok).toBe(true);
  });
});

describe("recruitOC · favor 好感度路", () => {
  it("好感低于阈值拒闸，够则过", () => {
    const low = makeState({ varTree: { 角色: { 小鱼儿: { 好感度: OC_FAVOR_THRESHOLD - 1 } }, 世界: {} } });
    expect(recruitOC(low, ADVENTURER, "favor").ok).toBe(false);
    const high = makeState({ varTree: { 角色: { 小鱼儿: { 好感度: OC_FAVOR_THRESHOLD } }, 世界: {} } });
    expect(recruitOC(high, ADVENTURER, "favor").ok).toBe(true);
  });
});

describe("recruitOC · childhood 青梅竹马路", () => {
  it("开局旗在则零门槛过闸，不在则拒", () => {
    expect(recruitOC(makeState(), ADVENTURER, "childhood").ok).toBe(false);
    const st = makeState({ flags: [`${OC_CHILDHOOD_PREFIX}${ADVENTURER.id}`] });
    expect(recruitOC(st, ADVENTURER, "childhood").ok).toBe(true);
  });
});

describe("撞车守卫 · npcBusyInQuest", () => {
  const state = makeState({ questProgress: { qingcheng_1_taogongdao: { status: "active" } } });
  it("进行中任务的 giver 被拦，OC 散人天然通过", () => {
    expect(npcBusyInQuest(state, "松鹤道长")).toBeTruthy();
    expect(npcBusyInQuest(state, "小鱼儿")).toBe(null);
    const blocked = inviteCompanion(state, { name: "松鹤道长", imported: true });
    expect(blocked.logs?.[0]?.text).toContain("有事缠身");
    expect(blocked.changes).toBeUndefined();
  });
  it("任务完成后不再拦", () => {
    const done = makeState({ questProgress: { qingcheng_1_taogongdao: { status: "completed" } } });
    expect(npcBusyInQuest(done, "松鹤道长")).toBe(null);
  });
});

describe("留守 stationed", () => {
  it("非 active 队友落房、唤回；active 不能留守", () => {
    let cs = unlockImportedCompanion({}, { name: "小鱼儿", levelCap: 3 });
    cs = unlockImportedCompanion(cs, { name: "花无缺", levelCap: 4 });
    // 新入队的花无缺顶上 active，小鱼儿自动退位
    expect(activeCompanionKey(cs)).toBe("imported_花无缺");

    // active 不能留守
    const still = stationCompanion(cs, "imported_花无缺", { district: "雅江", roomId: "room_jianping", roomName: "剑坪" });
    expect(still).toBe(cs);

    // 小鱼儿留守剑坪
    cs = stationCompanion(cs, "imported_小鱼儿", { district: "雅江", roomId: "room_jianping", roomName: "剑坪" });
    expect(cs["imported_小鱼儿"].stationed.roomName).toBe("剑坪");

    // 留守清单与落房 npcs
    expect(stationedCompanions(cs).map(c => c.label)).toEqual(["小鱼儿"]);
    const npcs = stationedNpcsFor(cs, { district: "雅江", roomId: "room_jianping" });
    expect(npcs).toHaveLength(1);
    expect(npcs[0]).toMatchObject({ name: "小鱼儿", companion: true, stationed: true });
    expect(stationedNpcsFor(cs, { district: "雅江", roomId: "room_other" })).toHaveLength(0);

    // 唤回：stationed 清掉，可对话带走
    cs = unstationCompanion(cs, "imported_小鱼儿");
    expect(cs["imported_小鱼儿"].stationed).toBeUndefined();
    expect(stationedCompanions(cs)).toHaveLength(0);
  });
});

describe("applyRecruit 落盘", () => {
  it("扣钱、标已认识、把人从房间带走", () => {
    const st = makeState();
    const r = recruitOC(st, ADVENTURER, "hire", { offer: 240 });
    const out = applyRecruit(st, ADVENTURER, r.effect);
    const npcs = out.changes.room(st.room).npcs;
    expect(npcs).toHaveLength(0);
    expect(out.changes.char(st.char).money).toBe(260);
    expect(out.changes.varTree(st.varTree).世界.已认识人物).toContain("小鱼儿");
    expect(out.changes.companionState["imported_小鱼儿"].data.moveset.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ocMenuRoutes 菜单出现条件", () => {
  it("默认只给 雇佣+邀请入队；quest/childhood 按旗出现", async () => {
    const { ocMenuRoutes } = await import("./ocRecruit.js");
    const base = makeState();
    // 默认：雇佣 + 邀请入队
    expect(ocMenuRoutes(base, ADVENTURER).map(r => r.route)).toEqual(["hire", "favor"]);
    // 挂过人情（完成旗或待办旗）才出 quest
    const withPending = makeState({ flags: ["oc_favor_pending_adv_xiaoyuer"] });
    expect(ocMenuRoutes(withPending, ADVENTURER).map(r => r.route)).toContain("quest");
    const withDone = makeState({ flags: [`${OC_QUEST_DONE_PREFIX}adv_xiaoyuer`] });
    expect(ocMenuRoutes(withDone, ADVENTURER).map(r => r.route)).toContain("quest");
    // 童年线旗出 childhood
    const childhood = makeState({ flags: [`${OC_CHILDHOOD_PREFIX}adv_xiaoyuer`] });
    expect(ocMenuRoutes(childhood, ADVENTURER).map(r => r.route)).toContain("childhood");
    // 已入队不再给菜单
    const cs = unlockImportedCompanion({}, { name: "小鱼儿", levelCap: 3 });
    expect(ocMenuRoutes(makeState({ companionState: cs }), ADVENTURER)).toEqual([]);
    // 不收金银的不给雇佣
    const noMoney = { ...ADVENTURER, tradeStyle: "分文不取" };
    expect(ocMenuRoutes(base, noMoney).map(r => r.route)).toEqual(["favor"]);
  });

  it("favor 拒词走 recruitOC 原有门槛（好感不足拒闸）", () => {
    const r = recruitOC(makeState(), ADVENTURER, "favor");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("好感");
  });
});

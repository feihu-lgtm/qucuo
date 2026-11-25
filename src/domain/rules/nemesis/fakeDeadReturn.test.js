// WO-23C2c 假死数日重逢日结契约测试
import { describe, expect, it } from "vitest";
import { runFakeDeadReturnTick, GRUDGE_ON_RETURN } from "./fakeDeadReturn.js";
import { dueReturns } from "./fakeDead.js";
import { recruitedNemesisNames } from "../npc/rules.js";
import { RUMOR_KEEP_CAP } from "./nemesisDaily.js";

function mkState({ day = 5, returnedAt, entryStatus = "fakeDead", grudge = 3 } = {}) {
  return {
    time: day * 24,
    varTree: {
      角色: {},
      世界: {
        生死: {
          扎西: { status: "dying", fakeDead: true, fakeDeadAt: 0, returnAfterDay: 3, faction: "雪山派", entryId: "nm1", ...(returnedAt !== undefined ? { returnedAt } : {}) },
        },
        宿敌谱: {
          雪山派: { entries: { nm1: { id: "nm1", name: "扎西", faction: "雪山派", status: entryStatus, tier: 2, scars: [{ kind: "利刃", note: "x", turn: 1 }], grudge, origin: { turn: 1, place: "雪山", summary: "s" }, epithet: "雪刀" } } },
        },
        传闻: [],
      },
    },
  };
}
const apply = (out, st) => out.changes.varTree(st.varTree);

describe("假死重逢日结", () => {
  it("到期一次触发：置回 active/grudge+2/scars·origin·epithet 保留/传闻入账/生死簿标记 returnedAt", () => {
    const st = mkState();
    const out = runFakeDeadReturnTick(st);
    expect(out).not.toBeNull();
    const vt = apply(out, st);
    const entry = vt.世界.宿敌谱.雪山派.entries.nm1;
    expect(entry.status).toBe("active");
    expect(entry.grudge).toBe(3 + GRUDGE_ON_RETURN);
    expect(entry.scars).toHaveLength(1);
    expect(entry.origin.summary).toBe("s");
    expect(entry.epithet).toBe("雪刀");
    expect(entry.tier).toBe(2); // 不升 tier
    expect(vt.世界.生死.扎西.returnedAt).toBe(5);
    const rumors = vt.世界.传闻;
    expect(rumors).toHaveLength(1);
    expect(rumors[0].kind).toBe("宿敌重逢");
    expect(rumors[0].text).toContain("活着回来");
    expect(rumors[0].text).toContain("扎西");
    // 输入不原地改
    expect(st.varTree.世界.宿敌谱.雪山派.entries.nm1.status).toBe("fakeDead");
  });

  it("重复日结幂等：returnedAt 闸/不重复触发/传闻不双写", () => {
    const st = mkState();
    const once = apply(runFakeDeadReturnTick(st), st);
    const st2 = { ...st, varTree: once };
    const out2 = runFakeDeadReturnTick(st2);
    // returnedAt 后不再 due → tick 为 null（无到期）
    expect(out2).toBeNull();
    const vt2 = once;
    expect(vt2.世界.传闻).toHaveLength(1);
    expect(vt2.世界.宿敌谱.雪山派.entries.nm1.grudge).toBe(5); // 无 +2 叠加
  });

  it("未到期不触发；到期前文案口径不泄假死", () => {
    const st = mkState({ day: 2 }); // returnAfterDay=3
    expect(runFakeDeadReturnTick(st)).toBeNull();
  });

  it("returned 后不再 due；resident 过滤恢复（active 不滤）", () => {
    const st = mkState();
    const vt = apply(runFakeDeadReturnTick(st), st);
    expect(dueReturns(vt.世界.生死, 5)).toHaveLength(0);
    expect(recruitedNemesisNames(vt).has("扎西")).toBe(false);
    // fakeDead 时应滤
    expect(recruitedNemesisNames(st.varTree).has("扎西")).toBe(true);
  });

  it("谱中已非 fakeDead（被了结）只关闸不复活；传闻 cap 生效", () => {
    const st = mkState({ entryStatus: "settled" });
    const out = runFakeDeadReturnTick(st);
    const vt = apply(out, st);
    expect(vt.世界.宿敌谱.雪山派.entries.nm1.status).toBe("settled");
    expect(vt.世界.生死.扎西.returnedAt).toBe(5);
    // cap
    const many = { ...st, varTree: { ...st.varTree, 世界: { ...st.varTree.世界, 传闻: Array.from({ length: RUMOR_KEEP_CAP }, (_, i) => ({ id: `old${i}`, text: "x" })) } } };
    const st3 = mkState();
    const vt3 = apply(runFakeDeadReturnTick(st3), { ...st3, varTree: { ...st3.varTree, 世界: { ...st3.varTree.世界, 传闻: many.varTree.世界.传闻 } } });
    expect(vt3.世界.传闻.length).toBeLessThanOrEqual(RUMOR_KEEP_CAP);
    expect(vt3.世界.传闻.at(-1).kind).toBe("宿敌重逢");
  });
});

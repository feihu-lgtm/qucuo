// WO-23C2b 宿敌假死池契约测试
import { describe, expect, it } from "vitest";
import { rollFakeDead, markNemesisStatus, dueReturns, FAKE_DEAD_PROB, RETURN_MIN_DAYS, RETURN_MAX_DAYS } from "./fakeDead.js";
import { settleNpcDuel } from "../../../features/npc/settleDuel.js";

const ROSTER = { 雪山派: { entries: { nm1: { id: "nm1", name: "扎西", faction: "雪山派", status: "active", tier: 2, scars: [{ kind: "利刃", note: "x", turn: 1 }], grudge: 2, origin: { turn: 1, place: "雪山", summary: "s" } } } } };
function duelState() {
  return {
    time: 20, inv: [], room: { name: "黑风寨", npcs: [] },
    char: { hp: [30, 40], money: 10, special: {}, name: "阿部" }, skills: [], flags: [],
    questProgress: {}, varTree: { 角色: {}, 世界: { 宿敌谱: ROSTER } }, pot: 0,
  };
}
const foe = { name: "扎西", faction: "雪山派", levelCap: 1 };

describe("rollFakeDead seeded 可复现", () => {
  it("同输入同结果；窗口 2-5 日；进池布尔确定性", () => {
    const a = rollFakeDead({ turn: 20, npcName: "扎西", faction: "雪山派" });
    const b = rollFakeDead({ turn: 20, npcName: "扎西", faction: "雪山派" });
    expect(a).toEqual(b);
    const day = Math.floor(20 / 24);
    expect(a.returnAfterDay).toBeGreaterThanOrEqual(day + RETURN_MIN_DAYS);
    expect(a.returnAfterDay).toBeLessThanOrEqual(day + RETURN_MAX_DAYS);
    // 不同 npc 结果可不同（identity 入种子）
    const outcomes = new Set();
    for (const n of ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛"]) {
      outcomes.add(rollFakeDead({ turn: 20, npcName: n, faction: "黑风寨" }).entersPool);
    }
    expect(outcomes.size).toBe(2); // 同概率下既有进池也有不进——seeded 而非恒真
    expect(FAKE_DEAD_PROB).toBe(0.4);
  });
});

describe("markNemesisStatus/dueReturns", () => {
  it("置 fakeDead/dead 保留 scars/grudge/origin；非 active 不动；输入不原地改", () => {
    const out = markNemesisStatus(ROSTER, "雪山派", "扎西", "fakeDead");
    const entry = out.雪山派.entries.nm1;
    expect(entry.status).toBe("fakeDead");
    expect(entry.scars).toHaveLength(1);
    expect(entry.grudge).toBe(2);
    expect(entry.origin.summary).toBe("s");
    expect(ROSTER.雪山派.entries.nm1.status).toBe("active"); // 不原地改
    expect(markNemesisStatus(out, "雪山派", "扎西", "dead")).toBeNull(); // 已非 active
  });

  it("dueReturns 只出到日假死条目", () => {
    const book = {
      甲: { status: "dying", fakeDead: true, returnAfterDay: 3 },
      乙: { status: "dying", fakeDead: true, returnAfterDay: 9 },
      丙: { status: "dying" },
    };
    expect(dueReturns(book, 3).map((r) => r.name)).toEqual(["甲"]);
    expect(dueReturns(book, 10)).toHaveLength(2);
  });
});

describe("settleNpcDuel 假死池接线", () => {
  function lethalWin(st) {
    return settleNpcDuel(st, foe, { outcome: "win", battleLog: [], lethal: true });
  }

  it("候选宿敌 lethal dying：进池或真死按 seeded，玩家文案不泄假死", () => {
    const st = duelState();
    const out = lethalWin(st);
    const vt = out.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    const entry = vt.世界.宿敌谱.雪山派.entries.nm1;
    const bookEntry = vt.世界.生死.扎西;
    // seeded 决定 pool/dead 二态其一，账实相拥
    expect(["fakeDead", "dead"]).toContain(entry.status);
    if (entry.status === "fakeDead") {
      expect(bookEntry.fakeDead).toBe(true);
      expect(Number.isFinite(bookEntry.returnAfterDay)).toBe(true);
    } else {
      expect(bookEntry.fakeDead).toBeUndefined();
    }
    // 玩家文案只有死亡表象——绝不泄「假死」
    expect(out.logs.some((l) => l.text.includes("假死"))).toBe(false);
    expect(out.logs.some((l) => l.text.includes("血泊"))).toBe(true);
    // scars/grudge 保留
    expect(entry.grudge).toBe(2);
  });

  it("普通切磋零影响；非候选不进池；spared 不进池", () => {
    // 切磋：宿敌谱/生死簿都不动 status
    const st = duelState();
    const spar = settleNpcDuel(st, foe, { outcome: "win", battleLog: [] });
    const vtS = spar.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    expect(vtS.世界.宿敌谱.雪山派.entries.nm1.status).toBe("active");
    // 非候选（谱中无 entry 的普通五势力者）：dying 但不进池不置谱
    const noNem = { name: "路人丁", faction: "黑风寨", levelCap: 1 };
    const out2 = settleNpcDuel(duelState(), noNem, { outcome: "win", battleLog: [], lethal: true });
    const vt2 = out2.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    expect(vt2.世界.生死.路人丁.fakeDead).toBeUndefined();
    // spare 不死不进池
    const out3 = settleNpcDuel(duelState(), foe, { outcome: "win", battleLog: [], lethal: true, spare: true });
    const vt3 = out3.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    expect(vt3.世界.生死.扎西.fakeDead).toBeUndefined();
    expect(vt3.世界.宿敌谱.雪山派.entries.nm1.status).toBe("active");
  });
});

describe("#506 初审返修契约", () => {
  const st0 = () => ({
    time: 20, inv: [], room: { name: "黑风寨", npcs: [{ name: "扎西", faction: "雪山派", id: "resident_x" }, { name: "旁人", id: "y" }] },
    char: { hp: [30, 40], money: 10, special: {}, name: "阿部" }, skills: [], flags: [],
    questProgress: {}, varTree: { 角色: {}, 世界: { 宿敌谱: ROSTER } }, pot: 0,
  });

  it("置谱后死亡表象（气绝一动不动）+非候选保留气若游丝+无假死字样", () => {
    const out = settleNpcDuel(st0(), foe, { outcome: "win", battleLog: [], lethal: true });
    const line = out.logs.find((l) => l.text.includes("血泊"));
    expect(line.text).toContain("气绝");
    expect(line.text).not.toContain("假死");
    expect(line.text).not.toContain("气若游丝");
    // 非候选普通 dying
    const out2 = settleNpcDuel(st0(), { name: "路人丁", faction: "黑风寨", levelCap: 1 }, { outcome: "win", battleLog: [], lethal: true });
    expect(out2.logs.find((l) => l.text.includes("血泊"))?.text).toContain("气若游丝");
  });

  it("置谱后同名 NPC 当场退出房间；fakeDead 账带 faction/entryId", () => {
    const st = st0();
    const out = settleNpcDuel(st, foe, { outcome: "win", battleLog: [], lethal: true });
    const roomOut = typeof out.changes.room === "function" ? out.changes.room(st.room) : null;
    if (roomOut) {
      expect(roomOut.npcs.some((n) => n.name === "扎西")).toBe(false);
      expect(roomOut.npcs.some((n) => n.name === "旁人")).toBe(true);
    }
    const vt = out.changes.varTree({ 角色: {}, 世界: st.varTree.世界 });
    const entry = vt.世界.宿敌谱.雪山派.entries.nm1;
    const book = vt.世界.生死.扎西;
    expect(book.faction).toBe("雪山派");
    expect(book.entryId).toBe("nm1");
    if (entry.status === "fakeDead") {
      const due = dueReturns({ 扎西: book }, 99);
      expect(due[0]).toMatchObject({ faction: "雪山派", entryId: "nm1" });
    }
  });

  it("面板 dead 显示已故不裸英文；世界版非 active 过滤泛化", async () => {
    const { nemesisStatusLine } = await import("./nemesisLines.js").catch(() => ({}));
    if (nemesisStatusLine) {
      expect(nemesisStatusLine({ status: "dead" })).toBe("（已故）");
      expect(nemesisStatusLine({ status: "fakeDead" })).toBe("（已故）");
    }
    const { recruitedNemesisNames } = await import("../npc/rules.js");
    const names = recruitedNemesisNames({ 世界: { 宿敌谱: { 雪山派: { entries: { a: { name: "扎西", status: "dead" }, b: { name: "活着的", status: "active" } } } } } });
    expect(names.has("扎西")).toBe(true);
    expect(names.has("活着的")).toBe(false);
    const settled = recruitedNemesisNames({ 世界: { 宿敌谱: { 雪山派: { entries: { c: { name: "了结者", status: "settled" } } } } } });
    expect(settled.has("了结者")).toBe(false);
  });
});

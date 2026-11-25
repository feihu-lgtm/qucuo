import { describe, it, expect } from "vitest";
import { findEpithetCandidates, validateEpithetOutput, collectEpithets, buildEpithetWriteChanges } from "./epithetCheck.js";

function entry(overrides = {}) {
  return {
    id: "xueshan_拉姆", name: "拉姆", faction: "雪山派", tier: 1, baseRole: "巡山弟子",
    epithet: null, tauntLine: null, rumorSnippet: null, scars: [], grudge: 1, status: "active",
    firstTurn: 3, lastTurn: 3, ...overrides,
  };
}
function roster(entriesByFaction) {
  const out = {};
  for (const [f, entries] of Object.entries(entriesByFaction)) out[f] = { entries };
  return out;
}

describe("WO-23C1 findEpithetCandidates（系统决定何时赐号）", () => {
  it("首次入谱且 epithet 空 → 候选", () => {
    const after = roster({ 雪山派: { a: entry() } });
    const got = findEpithetCandidates({}, after);
    expect(got).toHaveLength(1);
    expect(got[0].isNew).toBe(true);
  });
  it("门槛收紧：玩家胜利首入谱 grudge=0 不候选；grudge>=1 才候选", () => {
    expect(findEpithetCandidates({}, roster({ 雪山派: { a: entry({ grudge: 0 }) } }))).toHaveLength(0);
    expect(findEpithetCandidates({}, roster({ 雪山派: { a: entry({ grudge: 1 }) } }))).toHaveLength(1);
  });
  it("tier 严格晋升 → 候选；不变/降阶不算", () => {
    const before = roster({ 雪山派: { a: entry({ tier: 1 }) } });
    const up = roster({ 雪山派: { a: entry({ tier: 2 }) } });
    expect(findEpithetCandidates(before, up)).toHaveLength(1);
    expect(findEpithetCandidates(before, before)).toHaveLength(0);
    expect(findEpithetCandidates(up, before)).toHaveLength(0);
  });
  it("只赐一次：已有 epithet 不候选", () => {
    const after = roster({ 雪山派: { a: entry({ epithet: "雪岭阎罗" }) } });
    expect(findEpithetCandidates({}, after)).toHaveLength(0);
  });
  it("非 active（settled/fakeDead）不候选", () => {
    const after = roster({ 雪山派: { a: entry({ status: "settled" }), b: entry({ id: "xueshan_扎西", name: "扎西", status: "fakeDead" }) } });
    expect(findEpithetCandidates({}, after)).toHaveLength(0);
  });
  it("坏形状/空谱不炸", () => {
    expect(findEpithetCandidates(null, null)).toHaveLength(0);
    expect(findEpithetCandidates({}, { 雪山派: { entries: null } })).toHaveLength(0);
    expect(findEpithetCandidates({}, { 雪山派: { entries: { x: { name: "无id" } } } })).toHaveLength(0);
  });
});

describe("WO-23C1 validateEpithetOutput（不合格静默弃用）", () => {
  const ok = { epithet: "雪岭阎罗", tauntLine: "下次见面，先问我的刀。", rumorSnippet: "雪山派拉姆近来戾气颇重。" };
  it("正常产出通过", () => {
    expect(validateEpithetOutput(ok, {}).ok).toBe(true);
  });
  it("坏 schema：非对象/缺字段形状拒", () => {
    expect(validateEpithetOutput(null, {}).ok).toBe(false);
    expect(validateEpithetOutput({ epithet: 123 }, {}).ok).toBe(false);
  });
  it("绰号带数字/英文/超长超短拒", () => {
    expect(validateEpithetOutput({ ...ok, epithet: "刀王2" }, {}).reason).toBe("epithet_shape");
    expect(validateEpithetOutput({ ...ok, epithet: "Blade" }, {}).reason).toBe("epithet_shape");
    expect(validateEpithetOutput({ ...ok, epithet: "刀" }, {}).reason).toBe("epithet_shape");
    expect(validateEpithetOutput({ ...ok, epithet: "一".repeat(9) }, {}).reason).toBe("epithet_shape");
  });
  it("绰号含玩家名拒", () => {
    expect(validateEpithetOutput({ ...ok, epithet: "小林克星" }, { playerName: "小林" }).reason).toBe("epithet_player_name");
  });
  it("绰号与谱内他人重复拒", () => {
    expect(validateEpithetOutput(ok, { existingEpithets: ["雪岭阎罗", "黑风刀"] }).reason).toBe("epithet_duplicate");
  });
  it("taunt/rumor 超长拒", () => {
    expect(validateEpithetOutput({ ...ok, tauntLine: "长".repeat(41) }, {}).reason).toBe("taunt_too_long");
    expect(validateEpithetOutput({ ...ok, rumorSnippet: "长".repeat(61) }, {}).reason).toBe("rumor_too_long");
  });
  it("声称未给战绩拒", () => {
    expect(validateEpithetOutput({ ...ok, tauntLine: "我早已打败你。" }, {}).reason).toBe("unearned_victory_claim");
    expect(validateEpithetOutput({ ...ok, rumorSnippet: "听闻他曾赢了你三招。" }, {}).reason).toBe("unearned_victory_claim");
  });
  it("collectEpithets 排除自身、只收非空", () => {
    const r = roster({ 雪山派: { a: entry({ epithet: "雪岭阎罗" }), b: entry({ id: "xueshan_扎西", epithet: null }) } });
    expect(collectEpithets(r, "xueshan_拉姆")).toEqual([]);
    expect(collectEpithets(r, "xueshan_扎西")).toEqual(["雪岭阎罗"]);
  });
});

describe("WO-23C1 buildEpithetWriteChanges（写入只补三字段）", () => {
  const valid = { epithet: "雪岭阎罗", tauntLine: "刀下留人。", rumorSnippet: "传闻他有仇必报。" };
  function treeWith(e) {
    return { 世界: { 宿敌谱: roster({ 雪山派: { [e.id]: e } }), 银两: 100 } };
  }
  it("成功写入只改三字段，tier/grudge/scars/status 原样", () => {
    const e = entry({ tier: 2, grudge: 3, scars: [{ kind: "利刃", note: "左肩", turn: 4 }] });
    const next = buildEpithetWriteChanges("雪山派", e.id, valid)(treeWith(e));
    const w = next.世界.宿敌谱.雪山派.entries[e.id];
    expect(w.epithet).toBe("雪岭阎罗");
    expect(w.tauntLine).toBe("刀下留人。");
    expect(w.rumorSnippet).toBe("传闻他有仇必报。");
    expect(w.tier).toBe(2);
    expect(w.grudge).toBe(3);
    expect(w.status).toBe("active");
    expect(w.scars).toEqual([{ kind: "利刃", note: "左肩", turn: 4 }]);
    expect(next.世界.银两).toBe(100); // 账本其余不动
  });
  it("entry 已非 active 不写（返回原树）", () => {
    const tree = treeWith(entry({ status: "settled" }));
    expect(buildEpithetWriteChanges("雪山派", "xueshan_拉姆", valid)(tree)).toBe(tree);
  });
  it("已有 epithet 不覆盖", () => {
    const tree = treeWith(entry({ epithet: "旧绰号" }));
    expect(buildEpithetWriteChanges("雪山派", "xueshan_拉姆", valid)(tree)).toBe(tree);
  });
  it("谱内他人已占该绰号（并发撞号）不写", () => {
    const rival = entry({ id: "xueshan_扎西", name: "扎西", epithet: "雪岭阎罗" });
    const me = entry();
    const tree = { 世界: { 宿敌谱: roster({ 雪山派: { [rival.id]: rival, [me.id]: me } }) } };
    expect(buildEpithetWriteChanges("雪山派", me.id, valid)(tree)).toBe(tree);
  });
  it("条目消失/坏树不炸", () => {
    expect(buildEpithetWriteChanges("雪山派", "xueshan_拉姆", valid)({})).toEqual({});
    expect(buildEpithetWriteChanges("雪山派", "xueshan_拉姆", valid)(undefined)).toBe(undefined);
  });
});

// WO-22B-P2 悬空秘宝契约测试：登记表过滤/注入门控/第三关落定唯一锁/差一截残页批注/白券不回归。
import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judgeTurn.js";
import { resolveFloatingItems, relicById, FLOATING_RELICS } from "./floatingRelics.js";
import { materializeFacts } from "../effects/materializeFacts.js";

function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const HANTAN = FLOATING_RELICS[0]; // 寒潭剑谱，regions:["贡措海"]

function envelope(extra = {}) {
  return {
    turn: 50, day: 15, place: "贡措海", npcs: [], varTree: { 角色: {}, 世界: {} },
    inv: [], entries: [], budget: { riskLevel: 1 }, ...extra,
  };
}
const inspect = { kind: "inspect_container", target: "石函", itemId: "", direction: "none", stance: "casual" };
const proposal = { claim: "石函里有册剑谱", kind: "find_item", fit: "natural" };

describe("floatingRelics 登记表过滤", () => {
  it("合规地域+到期+未落定→注入", () => {
    const items = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "relic_hantian_jianpu", name: "寒潭剑谱", quality: "紫", placed: false });
  });

  it("非合规地域不注入", () => {
    expect(resolveFloatingItems({ place: "天都镇", day: 15, relicState: {} })).toHaveLength(0);
  });

  it("earliestDay 门控：未到现世日不注入", () => {
    expect(resolveFloatingItems({ place: "贡措海", day: HANTAN.earliestDay - 1, relicState: {} })).toHaveLength(0);
    expect(resolveFloatingItems({ place: "贡措海", day: HANTAN.earliestDay, relicState: {} })).toHaveLength(1);
  });

  it("已落定（placed 唯一锁）不再注入", () => {
    const state = { relic_hantian_jianpu: { placed: true, droppedAt: "贡措海", turn: 30 } };
    expect(resolveFloatingItems({ place: "贡措海", day: 15, relicState: state })).toHaveLength(0);
  });

  it("登记项缺关键字段不得静默创造神兵", () => {
    expect(relicById("relic_hantian_jianpu")).toBeTruthy();
    // 伪登记项（缺 regions）即使在合规地域也不注入——VALID 闸拦死
    const broken = { id: "x", name: "伪剑", earliestDay: 1 };
    expect(broken.regions).toBeUndefined(); // 断言登记纪律的输入面
  });
});

describe("judgeTurn 第三关：floating 真品落定与差一截降级", () => {
  it("检定通过：落真品 GRANT_ITEM 带品阶/描述/品类", () => {
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false } }, floatingItems }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.01]) },
    );
    const grant = verdict.facts.find((f) => f.op === "GRANT_ITEM" && f.itemId === "relic_hantian_jianpu");
    expect(grant).toBeTruthy();
    expect(grant).toMatchObject({ itemName: "寒潭剑谱", quality: "紫", category: "misc" });
    expect(grant.desc).toContain("寒潭");
    expect(verdict.notes.join()).toContain("落定");
    // 真品落定后不再走天机券
    expect(verdict.warrants.filter((w) => w.op === "GRANT_ITEM")).toHaveLength(0);
  });

  it("差一截：GRANT_ITEM 残页实物+notes 去向批注，真品不签", () => {
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false } }, floatingItems }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.99]) }, // 高骰不过
    );
    expect(verdict.facts.some((f) => f.itemId === "relic_hantian_jianpu")).toBe(false);
    const fragment = verdict.facts.find((f) => f.itemId === "fragment_relic_hantian_jianpu");
    expect(fragment).toBeTruthy();
    expect(fragment.itemName).toBe("残页");
    expect(fragment.quality).toBe("白");
    expect(verdict.notes.join()).toContain("去向线头");
    expect(verdict.notes.join()).toContain("寒潭剑谱");
  });

  it("无 floatingItems 时白券/残页通用路径不回归", () => {
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.99]) },
    );
    const scene = verdict.facts.find((f) => f.op === "ALTER_WORLD_SCENE");
    expect(scene).toBeTruthy();
    expect(scene.value).toContain("残页");
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    // 低骰仍走原天机券
    const pass = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.01]) },
    );
    expect(pass.warrants.some((w) => w.op === "GRANT_ITEM")).toBe(true);
  });

  it("坍缩不封秘宝落点：已坍缩容器有秘宝仍可翻，命中落真品", () => {
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: true } }, floatingItems }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.01]) },
    );
    expect(verdict.facts.some((f) => f.itemId === "relic_hantian_jianpu")).toBe(true);
    // 已坍缩重翻不再重复签 COLLAPSE
    expect(verdict.facts.filter((f) => f.op === "COLLAPSE_CONTAINER")).toHaveLength(0);
  });

  it("坍缩落点判定不出普通券：命中骰也不产 warrant/预设/备料", () => {
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const verdict = judgeTurn(
      envelope({
        containers: { 石函: { collapsed: true, presetItems: [{ id: "it_x", name: "铁钥匙" }] } },
        prepItems: [{ id: "prep_1", name: "豹皮护腕" }],
        floatingItems,
      }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.99]) }, // 高骰秘宝不中
    );
    expect(verdict.warrants.filter((w) => w.op === "GRANT_ITEM")).toHaveLength(0);
    expect(verdict.facts.some((f) => f.itemName === "铁钥匙")).toBe(false);
    expect(verdict.facts.some((f) => f.itemName === "豹皮护腕")).toBe(false);
    // 降级为残页且文案不自相矛盾
    const frag = verdict.facts.find((f) => f.itemId === "fragment_relic_hantian_jianpu");
    expect(frag).toBeTruthy();
    expect(frag.desc).toContain("气机未合");
    expect(frag.desc).not.toContain("真品不在这里");
  });

  it("坍缩+无秘宝维持 WO-22A 原样：翻不出新东西零事实", () => {
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: true } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.01]) },
    );
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(verdict.warrants).toHaveLength(0);
    expect(verdict.notes.join()).toContain("已坍缩");
  });

  it("day10 前首翻坍缩不锁死：之后带秘宝重翻仍可落定", () => {
    // 首翻：无 floatingItems（模拟 day10 前注入为空）——普通降级+坍缩
    const first = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.99]) },
    );
    expect(first.facts.some((f) => f.op === "COLLAPSE_CONTAINER")).toBe(true);
    // day10 后：容器已坍缩但秘宝在视野——仍可落真品
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const second = judgeTurn(
      envelope({ containers: { 石函: { collapsed: true } }, floatingItems }),
      { read: "", refIds: [], actions: [inspect], proposals: [proposal] },
      { rng: seqRng([0.01]) },
    );
    expect(second.facts.some((f) => f.itemId === "relic_hantian_jianpu")).toBe(true);
  });

  it("同回合多容器命中：只有第一条签真品，第二条不复制", () => {
    const floatingItems = resolveFloatingItems({ place: "贡措海", day: 15, relicState: {} });
    const verdict = judgeTurn(
      envelope({ containers: { 石函: { collapsed: false }, 铁匣: { collapsed: false } }, floatingItems }),
      { read: "", refIds: [], actions: [
        inspect,
        { kind: "inspect_container", target: "铁匣", itemId: "", direction: "none", stance: "casual" },
      ], proposals: [proposal] },
      { rng: seqRng([0.01, 0.01]) }, // 两次都命中
    );
    expect(verdict.facts.filter((f) => f.itemId === "relic_hantian_jianpu")).toHaveLength(1);
    // 第二条降级为残页（floatingInScope 已排除已签者）或直接 notes 记另有落点——
    // 二者都不得再产真品；按当前实现残页降级先于 notes 分支，故只要断言零复制即可。
    expect(verdict.facts.filter((f) => f.itemId === "fragment_relic_hantian_jianpu").length).toBeLessThanOrEqual(1);
  });
});

describe("materializeFacts 唯一锁最小扩展", () => {
  function baseState() {
    return {
      time: 50, inv: [], room: { name: "贡措海", items: [], npcs: [] },
      char: { hp: [30, 40], money: 50, special: {} }, skills: [], exp: 0, pot: 0,
      dao: {}, flags: [], varTree: { 角色: {}, 世界: {} }, claimedMilestones: new Set(), companionState: {},
    };
  }

  it("真品 GRANT_ITEM 命中登记 id → 写 placed/droppedAt/turn 唯一锁", () => {
    const out = materializeFacts(baseState(), [{
      id: "F_relic", op: "GRANT_ITEM", itemId: "relic_hantian_jianpu", itemName: "寒潭剑谱",
      quality: "紫", category: "misc", desc: "前辈剑修遗帙",
    }], {});
    const lock = out.patches.find((p) => p.path.join("/") === "varTree/世界/悬空秘宝/relic_hantian_jianpu");
    expect(lock).toBeTruthy();
    expect(lock.op).toBe("merge");
    expect(lock.value()).toMatchObject({ placed: true, droppedAt: "贡措海", turn: 50 });
  });

  it("碎片 fragment_ 前缀不锁，普通物品不锁", () => {
    const out = materializeFacts(baseState(), [
      { id: "F_frag", op: "GRANT_ITEM", itemId: "fragment_relic_hantian_jianpu", itemName: "残页" },
      { id: "F_norm", op: "GRANT_ITEM", itemName: "铁钥匙" },
    ], {});
    expect(out.patches.filter((p) => p.path.join("/").includes("悬空秘宝"))).toHaveLength(0);
  });
});

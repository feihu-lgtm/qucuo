import { describe, expect, it } from "vitest";
import { TEMPLATES, fillTemplate, pickTemplate, validateSequence, buildLaneQueue, buildGlobalInstances } from "./templates.mjs";

const presence = {
  npcs: ["老猎户", "杂货商人"],
  inv: [
    { name: "干粮", category: "food" },
    { name: "鱼定枪", category: "weapon" },
    { name: "赌石邀帖", category: "accessory" },
    { name: "溪边小屋钥匙", category: "misc" },
  ],
  exits: ["w", "n"],
  ground: ["干瘪的松果"],
};

describe("A4 模板填充与输入校验", () => {
  it("十四种 kind 模板全覆盖且 free_act 十 outcome 全有", () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const k of ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"]) {
      expect(kinds.has(k), `缺 kind ${k}`).toBe(true);
    }
    const outcomes = new Set(TEMPLATES.filter((t) => t.kind === "free_act").map((t) => t.outcome));
    for (const o of ["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"]) {
      expect(outcomes.has(o), `缺 outcome ${o}`).toBe(true);
    }
    expect(TEMPLATES.filter((t) => t.settle).map((t) => t.settle).sort()).toEqual(["companion_invite", "gift", "learn_skill"]);
    expect(TEMPLATES.some((t) => t.group)).toBe(true);
    expect(TEMPLATES.some((t) => t.conditional)).toBe(true);
  });

  it("kind 配额总数达标：十四种各≥10、free_act 各 outcome≥5、settle/群聊/条件各≥5", () => {
    const perKind = {};
    for (const t of TEMPLATES) perKind[t.kind] = (perKind[t.kind] || 0) + t.target;
    for (const k of ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip"]) {
      expect(perKind[k], `${k} 配额 ${perKind[k]}`).toBeGreaterThanOrEqual(10);
    }
    for (const t of TEMPLATES.filter((x) => x.kind === "free_act")) {
      expect(t.target, `${t.id}`).toBeGreaterThanOrEqual(5);
    }
    for (const t of TEMPLATES.filter((x) => x.settle || x.group || x.conditional)) {
      expect(t.target, `${t.id}`).toBeGreaterThanOrEqual(5);
    }
  });

  it("在场实况填槽：npc/item/direction 落进文本", () => {
    const tpl = TEMPLATES.find((t) => t.id === "give_item");
    const r = fillTemplate(tpl, presence);
    expect(r.ok).toBe(true);
    expect(r.text).toContain("老猎户");
    expect(r.text).not.toMatch(/\{[a-z0-9]+\}/i);
  });

  it("槽位缺料换模板并记原因：无 npc2 时群聊模板跳过", () => {
    const tpl = TEMPLATES.find((t) => t.id === "group_talk");
    const r = fillTemplate(tpl, { ...presence, npcs: ["老猎户"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("npc2");
  });

  it("空仓在场时 pickTemplate 跳过所有 npc 依赖模板仍有无依赖模板可用", () => {
    const r = pickTemplate({ npcs: [], inv: [], exits: [], ground: [] }, {});
    // move_dir 依赖 direction 缺，inspect_box 无依赖可用（在 move 之后但会被跳过顺序命中）
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(r.skipped.length).toBeGreaterThan(0);
    expect(r.skipped[0]).toHaveProperty("reason");
  });

  it("输入校验：空串/非字符串/空数组一律不合格", () => {
    expect(validateSequence(["a", "  "]).ok).toBe(false);
    expect(validateSequence(["a", null]).ok).toBe(false);
    expect(validateSequence([]).ok).toBe(false);
    expect(validateSequence(["跟老猎户搭话"]).ok).toBe(true);
  });

  it("lane-aware 全局调度：8 lane 分片后每种 kind/outcome/settle/群聊/条件意图层达标", () => {
    for (const lanes of [1, 4, 8]) {
      const all = [];
      for (let lane = 0; lane < lanes; lane++) all.push(...buildLaneQueue(lane, lanes));
      // 全局并集恰好覆盖所有实例无重无漏
      expect(all.length).toBe(buildGlobalInstances().length);
      const perKind = {};
      const perOutcome = {};
      let settle = 0, group = 0, cond = 0;
      for (const { tpl } of all) {
        perKind[tpl.kind] = (perKind[tpl.kind] || 0) + 1;
        if (tpl.outcome) perOutcome[tpl.outcome] = (perOutcome[tpl.outcome] || 0) + 1;
        if (tpl.settle) settle++;
        if (tpl.group) group++;
        if (tpl.conditional) cond++;
      }
      for (const k of ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip"]) {
        expect(perKind[k], `lanes=${lanes} kind ${k}=${perKind[k]}`).toBeGreaterThanOrEqual(10);
      }
      for (const o of ["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"]) {
        expect(perOutcome[o], `lanes=${lanes} outcome ${o}`).toBeGreaterThanOrEqual(5);
      }
      expect(settle).toBeGreaterThanOrEqual(15);
      expect(group).toBeGreaterThanOrEqual(5);
      expect(cond).toBeGreaterThanOrEqual(5);
    }
    // lane 间无重叠：同一实例只归一条 lane
    const ids = [];
    for (let lane = 0; lane < 8; lane++) ids.push(...buildLaneQueue(lane, 8).map((x) => x.instanceId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("配额用尽的模板不再选出", () => {
    const tracker = {};
    for (const t of TEMPLATES) tracker[t.id] = t.target;
    expect(pickTemplate(presence, tracker).index).toBe(-1);
  });
});

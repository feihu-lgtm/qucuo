import { describe, expect, it } from "vitest";
import { judgeTurn, renderJudgeVerdict, renderCausalBudget } from "./judgeTurn.js";
import { createClapboardEntry } from "../clapboard/clapboard.js";

// 可重复 rng：按给定序列循环出牌
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const NPCS = [
  { name: "才旦", personality: "爽朗直率", brief: "猎户" },
  { name: "八云", personality: "冷傲孤高", brief: "雪山弟子" },
];

const VAR_TREE = { 角色: { 才旦: { 好感度: 70 } } };

const INV = [{ id: "it_8f3a", name: "霜牙短刀", category: "weapon", quality: "蓝" }];

function baseEnvelope(extra = {}) {
  return { turn: 42, day: 2, place: "鱼定村·茶馆", npcs: NPCS, varTree: VAR_TREE, inv: INV, entries: [], budget: { riskLevel: 1 }, ...extra };
}

describe("judgeTurn 第一步：refIds 知情权核验", () => {
  const entries = [
    createClapboardEntry({ kind: "raw_memory", turn: 18, seq: 2, witnesses: ["主角", "呼延雪"], publicText: "呼延雪拍剑", rawText: "呼延雪拍剑*心理*" }),
    createClapboardEntry({ kind: "fact_index", turn: 18, seq: 3, witnesses: [], publicText: "村口贴了告示" }),
  ];

  it("不知情 NPC 拆独立反应导引，公共条目人人知情", () => {
    const verdict = judgeTurn(baseEnvelope({ entries }), { read: "", refIds: ["P18_2", "F18_3"], actions: [], proposals: [] }, { rng: seqRng([0.9]) });
    const caidan = verdict.reactionGuides.find((g) => g.npc === "才旦");
    // P18_2 见证者只含主角与呼延雪——才旦不知情，拆独立导引
    expect(caidan.unknownRefIds).toContain("P18_2");
    expect(caidan.guidance).toContain("不知晓");
    // F18_3 witnesses 空 = 公共常识
    expect(caidan.knownRefIds).toContain("F18_3");
  });

  it("查无此条目的引用记入 notes 不崩", () => {
    const verdict = judgeTurn(baseEnvelope({ entries }), { read: "", refIds: ["P99_9"], actions: [], proposals: [] }, { rng: seqRng([0.5]) });
    expect(verdict.notes.join()).toContain("查无此条目");
  });
});

describe("judgeTurn 第二步：赠礼/赔罪/求教收拒", () => {
  it("豪爽高好感 + 偏爱命中（猎户爱 weapon）低骰收礼：TRANSFER_ITEM + MUTATE_SOCIAL", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.1]) });
    const transfer = verdict.facts.find((f) => f.op === "TRANSFER_ITEM");
    expect(transfer).toBeTruthy();
    expect(transfer.itemName).toBe("霜牙短刀");
    expect(transfer.from).toBe("player");
    expect(transfer.to).toBe("才旦");
    expect(transfer.id).toBe("F42_1");
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.affectionDelta).toBeGreaterThan(0);
    expect(verdict.allowSpontaneousPact).toBe(true);
  });

  it("冷傲零好感高骰拒收：不产扣物事实，物件未易主", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "八云", itemId: "it_8f3a", direction: "none", stance: "casual" }],
      proposals: [],
    }, { rng: seqRng([0.99]) });
    expect(verdict.facts.filter((f) => f.op === "TRANSFER_ITEM")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("拒收");
    expect(verdict.notes.join()).toContain("未易主");
  });

  it("求教：tier 不足授技降级点拨；T2 以上签发 BESTOW_SKILL 空白天机券", () => {
    const low = judgeTurn(baseEnvelope({ budget: {} }), {
      read: "", refIds: [],
      actions: [{ kind: "learn", target: "才旦", itemId: "", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.05]) });
    // 无涉险无代价 → 恒 T0 → 降级点拨
    const tipoff = low.facts.find((f) => f.op === "PROGRESS_CULTIVATION");
    expect(tipoff).toBeTruthy();
    // WO-11 落盘可消费：potDelta/expDelta/neigongDelta/stageDelta 至少一项非空
    expect(tipoff.potDelta).toBeGreaterThan(0);
    expect(low.warrants).toHaveLength(0);
    expect(low.notes.join()).toContain("降为点拨");

    const high = judgeTurn(baseEnvelope({ budget: { riskLevel: 3, costPaid: 10, tension: 80 } }), {
      read: "", refIds: [],
      actions: [{ kind: "learn", target: "才旦", itemId: "", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.05]) });
    expect(high.warrants.some((w) => w.op === "BESTOW_SKILL")).toBe(true);
  });
});

describe("judgeTurn 第三步：inspect_container 三关", () => {
  const inspect = { kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual" };

  it("已坍缩容器无所得", () => {
    const verdict = judgeTurn(baseEnvelope({ containers: { 木箱: { collapsed: true } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [] }, { rng: seqRng([0]) });
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("已坍缩");
  });

  it("第一关：预设物必中", () => {
    const verdict = judgeTurn(baseEnvelope({ containers: { 木箱: { collapsed: false, presetItems: [{ id: "it_pre", name: "铁钥匙" }] } } }),
      { read: "", refIds: [], actions: [inspect], proposals: [] }, { rng: seqRng([0.9]) });
    expect(verdict.facts.some((f) => f.itemName === "铁钥匙")).toBe(true);
  });

  it("第二关：无预设物时备料物直取", () => {
    const verdict = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false, presetItems: [] } },
      prepItems: [{ id: "prep_5_1", name: "豹皮护腕", containerId: "木箱" }], // WO-24E 裁决：exact containerId 匹配才发
    }), { read: "", refIds: [], actions: [inspect], proposals: [] }, { rng: seqRng([0.9]) });
    expect(verdict.facts.some((f) => f.itemName === "豹皮护腕")).toBe(true);
  });

  it("第三关：natural fit 低骰中签空白天机券，affixes 随 pointBudget 圈定", () => {
    const verdict = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false } },
      budget: { riskLevel: 2, costPaid: 10, tension: 60 },  // T2 → pointBudget 2
    }), {
      read: "", refIds: [], actions: [inspect],
      proposals: [{ claim: "箱底有把匕首", kind: "find_item", fit: "natural" }],
    }, { rng: seqRng([0.1]) });
    const warrant = verdict.warrants.find((w) => w.op === "GRANT_ITEM");
    expect(warrant).toBeTruthy();
    expect(warrant.pointBudget).toBe(2);
    expect(warrant.allowedAffixes.length).toBeGreaterThan(0);
    expect(warrant.origin.turn).toBe(42);
  });

  it("第三关：absurd fit 高骰不达标降级残页线索", () => {
    const verdict = judgeTurn(baseEnvelope({ containers: { 木箱: { collapsed: false } } }), {
      read: "", refIds: [], actions: [inspect],
      proposals: [{ claim: "箱底藏着屠龙刀", kind: "find_item", fit: "absurd" }],
    }, { rng: seqRng([0.9]) });
    expect(verdict.warrants.filter((w) => w.op === "GRANT_ITEM")).toHaveLength(0);
    const scene = verdict.facts.find((f) => f.op === "ALTER_WORLD_SCENE");
    expect(scene.detail).toContain("残页");
    // WO-11 可消费形状：sceneKey + key/value（materializeFacts 只认 updates/key-value/note）
    expect(scene.sceneKey).toBeTruthy();
    expect(scene.key).toBe("clue");
    expect(scene.value).toContain("残页");
    expect(verdict.notes.join()).toContain("降级为残页线索");
  });

  it("悬空道具落点优先：有悬空道具时直接落它不发券", () => {
    const verdict = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false } },
      floatingItems: [{ id: "it_float", name: "无名剑谱", placed: false }],
    }), {
      read: "", refIds: [], actions: [inspect],
      proposals: [{ claim: "箱底有本剑谱", kind: "find_item", fit: "natural" }],
    }, { rng: seqRng([0.1]) });
    expect(verdict.facts.some((f) => f.itemName === "无名剑谱")).toBe(true);
    expect(verdict.warrants.filter((w) => w.op === "GRANT_ITEM")).toHaveLength(0);
  });
});

describe("judgeTurn 第四步：签发形状与渲染", () => {
  it("facts id 连续编号 F<turn>_<seq>，verdict 含 tier/pacingWords/warrants/allowSpontaneousPact", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.1]) });
    expect(verdict.facts[0].id).toBe("F42_1");
    expect(verdict.facts[1].id).toBe("F42_2");
    expect(verdict.causalTier).toBeTruthy();
    expect(verdict.pacingWords).toBe(320);
  });

  it("同 rng 序列同输入恒同输出（纯函数）", () => {
    const intake = { read: "", refIds: [], actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "sincere" }], proposals: [] };
    const a = judgeTurn(baseEnvelope(), intake, { rng: seqRng([0.3, 0.7]) });
    const b = judgeTurn(baseEnvelope(), intake, { rng: seqRng([0.3, 0.7]) });
    expect(a).toEqual(b);
  });

  it("renderJudgeVerdict/renderCausalBudget 渲染非空；空输入返回空串", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.1]) });
    const text = renderJudgeVerdict(verdict);
    expect(text).toContain("⟦F42_1⟧");
    expect(text).toContain("TRANSFER_ITEM");
    expect(renderJudgeVerdict(null)).toBe("");
    expect(renderCausalBudget(verdict.budget)).toContain("品阶上限");
    expect(renderCausalBudget(null)).toBe("");
  });

  it("talkOnly 真白名单：appease 在纯搭话回合不触发随机社交", () => {
    const verdict = judgeTurn(
      { turn: 5, day: 1, place: "鱼定村", npcs: [{ name: "八云" }], varTree: { 角色: {} }, inv: [], talkOnly: true },
      { read: "", refIds: [], actions: [
        { kind: "appease", target: "八云", itemId: "", direction: "none", stance: "sincere" },
      ], proposals: [] },
      { rng: () => 0 },
    );
    // appease 被白名单拦截：零社交事实，notes 留痕
    expect(verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
    expect(verdict.notes.some((n) => n.includes("appease"))).toBe(true);
  });

  it("无好感轨道对象判官不产社交事实（第一道防线）", () => {
    for (const npc of [{ name: "雪豹", beast: true }, { name: "石佛", intimacy: { forbidden: true } }]) {
      const verdict = judgeTurn(
        { turn: 5, day: 1, place: "鱼定村", npcs: [npc], varTree: { 角色: {} }, inv: [], talkOnly: true },
        { read: "", refIds: [], actions: [
          { kind: "talk", target: npc.name, itemId: "", direction: "none", stance: "sincere" },
        ], proposals: [] },
        { rng: () => 0.5 },
      );
      expect(verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
    }
    // 对照：cannotSpeak 不是无轨道，正常产事实
    const verdict = judgeTurn(
      { turn: 5, day: 1, place: "鱼定村", npcs: [{ name: "哑仆", cannotSpeak: true }], varTree: { 角色: {} }, inv: [], talkOnly: true },
      { read: "", refIds: [], actions: [
        { kind: "talk", target: "哑仆", itemId: "", direction: "none", stance: "sincere" },
      ], proposals: [] },
      { rng: () => 0.5 },
    );
    expect(verdict.facts.some((f) => f.op === "MUTATE_SOCIAL")).toBe(true);
  });

  it("WO-16C 移动拾取条件券：pickupJudgment 只签 warrant 不进 facts，数值锁定", () => {
    const verdict = judgeTurn(
      { turn: 7, day: 1, place: "野径", npcs: [], varTree: { 角色: {} }, inv: [],
        pickupJudgment: { quality: "蓝", category: "accessory" } },
      { read: "", refIds: [], actions: [], proposals: [] },
      { rng: () => 0.5 },
    );
    // facts 里不得有该 GRANT_ITEM（条件券不先发事实）
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    const w = verdict.warrants.find((x) => x.conditional);
    expect(w).toBeTruthy();
    expect(w.quality).toBe("蓝");
    expect(w.category).toBe("accessory");
    expect(w.pointBudget).toBe(0);
    expect(w.allowedAffixes).toEqual([]);
    expect(w.factId).toBeTruthy();
  });

  it("WO-16C 无 pickupJudgment 或 talkOnly 不签条件券", () => {
    const noJudgment = judgeTurn(
      { turn: 7, day: 1, place: "野径", npcs: [], varTree: { 角色: {} }, inv: [] },
      { read: "", refIds: [], actions: [], proposals: [] },
      { rng: () => 0.5 },
    );
    expect(noJudgment.warrants.filter((x) => x.conditional)).toHaveLength(0);
    const talkOnly = judgeTurn(
      { turn: 7, day: 1, place: "野径", npcs: [], varTree: { 角色: {} }, inv: [], talkOnly: true,
        pickupJudgment: { quality: "蓝", category: "misc" } },
      { read: "", refIds: [], actions: [], proposals: [] },
      { rng: () => 0.5 },
    );
    expect(talkOnly.warrants.filter((x) => x.conditional)).toHaveLength(0);
  });

  it("renderJudgeVerdict 条件券显示品质类别与双证据语义", async () => {
    const { renderJudgeVerdict } = await import("./judgeTurn.js");
    const text = renderJudgeVerdict({
      causalTier: "T1", pacingWords: 320, facts: [],
      warrants: [{ warrantId: "W7_1", factId: "F7_1", op: "GRANT_ITEM", conditional: true, category: "misc", quality: "蓝", pointBudget: 0, allowedAffixes: [] }],
    });
    expect(text).toContain("条件拾取券");
    expect(text).toContain("蓝");
    expect(text).toContain("⟦F7_1⟧");
    expect(text).toContain("⟦W7_1⟧");
  });
});

describe("WO-21B 判官签发类目迁移：谊→恩、隙→怨、和→见", () => {
  it("搭话投机签「恩」不签谊；言语冲撞签「怨」不签隙", () => {
    const warm = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.5]) });
    const pos = warm.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(pos.ledgerKind).toBe("恩");

    const cold = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "forceful" }],
      proposals: [],
    }, { rng: seqRng([0.5]) });
    const neg = cold.facts.find((f) => f.op === "MUTATE_SOCIAL");
    if (neg) expect(neg.ledgerKind).toBe("怨"); // forceful 负映射存在时才签，签了就必须是怨
  });

  it("appease 收下签「见」不签和", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "appease", target: "才旦", itemId: "", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.01]) });
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social).toBeTruthy();
    expect(social.ledgerKind).toBe("见");
    // 全链不再出现旧类目
    expect(JSON.stringify(verdict.facts)).not.toMatch(/"ledgerKind":"[谊隙和]"/);
  });
});

describe("WO-16G interim：带前提动作不结算", () => {
  const condInspect = {
    kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual",
    condition: "其他", condition_text: "要是没人看见",
  };
  it("条件翻箱：不坍缩、不给物、只留前提未裁 note", () => {
    const verdict = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false, presetItems: [{ id: "it_pre", name: "铁钥匙" }] } },
    }), { read: "", refIds: [], actions: [condInspect], proposals: [] }, { rng: seqRng([0.9]) });
    expect(verdict.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("前提未裁");
    expect(verdict.notes.join()).not.toContain("已坍缩");
    // 容器不被消费——verdict 里无坍缩产物（collapse 相关的容器写不出现）
    expect(JSON.stringify(verdict)).not.toContain("铁钥匙");
  });
  it("condition 为「无」或缺省照旧结算", () => {
    const plain = { ...condInspect, condition: "无", condition_text: "" };
    const verdict = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false, presetItems: [{ id: "it_pre", name: "铁钥匙" }] } },
    }), { read: "", refIds: [], actions: [plain], proposals: [] }, { rng: seqRng([0.9]) });
    expect(verdict.facts.some((f) => f.itemName === "铁钥匙")).toBe(true);
    // 缺省（无 condition 键）旧形状也照常
    const legacy = { kind: "inspect_container", target: "木箱", itemId: "", direction: "none", stance: "casual" };
    const v2 = judgeTurn(baseEnvelope({
      containers: { 木箱: { collapsed: false, presetItems: [{ id: "it_pre", name: "铁钥匙" }] } },
    }), { read: "", refIds: [], actions: [legacy], proposals: [] }, { rng: seqRng([0.9]) });
    expect(v2.facts.some((f) => f.itemName === "铁钥匙")).toBe(true);
  });
});

describe("S2 hostile 敌意档：辱骂签负好感+怨，暴烈性情置生气", () => {
  const HOSTILE_NPCS = [
    { name: "铁掌柜", personality: "暴烈如火", brief: "客栈掌柜" },
    { name: "温伙计", personality: "温善和气", brief: "伙计" },
  ];
  function hostileEnv() {
    return { turn: 42, day: 2, place: "天都镇·客栈", npcs: HOSTILE_NPCS, varTree: { 角色: {} }, inv: [], entries: [], budget: { riskLevel: 1 } };
  }
  function hostileIntake(target, text) {
    return { read: "", refIds: [], actions: [{ kind: "talk", target, item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "hostile", outcome: "无", risk: "无", confidence: 0.9, text }], proposals: [] };
  }

  it("骂掌柜（hostile）：签 -3 负好感，ledgerKind 为怨", () => {
    const verdict = judgeTurn(hostileEnv(), hostileIntake("铁掌柜", "当众羞辱你这黑心掌柜"), { rng: seqRng([0.5]) });
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social).toBeTruthy();
    expect(social.affectionDelta).toBe(-3);
    expect(social.ledgerKind).toBe("怨");
  });

  it("暴烈性情 + hostile：同时置生气，缘由为玩家原话前 20 字", () => {
    const text = "你这黑心无赖掌柜又奸又猾今日非要当众揭穿你的丑恶嘴脸不可";
    const verdict = judgeTurn(hostileEnv(), hostileIntake("铁掌柜", text), { rng: seqRng([0.5]) });
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.anger).toBeTruthy();
    expect(social.anger.active).toBe(true);
    expect(social.anger.reason).toBe(text.slice(0, 20));
  });

  it("温善性情 + hostile：签负好感但不置生气", () => {
    const verdict = judgeTurn(hostileEnv(), hostileIntake("温伙计", "当众羞辱你这窝囊伙计"), { rng: seqRng([0.5]) });
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.affectionDelta).toBe(-3);
    expect(social.anger).toBeUndefined();
  });

  it("casual 不回归：仍 +1 恩、无生气", () => {
    const casual = hostileIntake("铁掌柜", "掌柜的近来可好");
    casual.actions[0].stance = "casual";
    const verdict = judgeTurn(hostileEnv(), casual, { rng: seqRng([0.5]) });
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.affectionDelta).toBe(1);
    expect(social.ledgerKind).toBe("恩");
    expect(social.anger).toBeUndefined();
  });
});

describe("S2 Review 补洞：赠物必须实有/敌意不跳前哨", () => {
  it("银两赠予改走送银桥（S7）：签 CHANGE_VITALS_SILVER 不走 TRANSFER_ITEM", () => {
    // S2 时代银两因不在背包不签发；S7 送银桥接入后，明确数额的送银正常签发——
    // baseEnvelope 无 char.money 字段按 0 计，超囊中仍不签，此处仅验不串器物通道。
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", item: "银两", itemId: "", direction: "none", stance: "sincere", text: "把5两银子送给才旦" }],
      proposals: [],
    }, { rng: seqRng([0.01]) });
    expect(verdict.facts.filter((f) => f.op === "TRANSFER_ITEM")).toHaveLength(0);
    // baseEnvelope 未给 char.money（视为 0）→ 超囊中所签为空，但不再落「不在囊中」器物口径
    expect(verdict.notes.join()).not.toContain("不在囊中");
  });

  it("幻影礼物（背包没有的倚天剑）：不签发，零假账", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", item: "倚天剑", itemId: "倚天剑", direction: "none", stance: "sincere", text: "把倚天剑送给才旦" }],
      proposals: [],
    }, { rng: seqRng([0.01]) });
    expect(verdict.facts.filter((f) => f.op === "TRANSFER_ITEM")).toHaveLength(0);
    expect(verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });

  it("实有礼物不回归：霜牙短刀低骰仍收", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", item: "霜牙短刀", itemId: "it_8f3a", direction: "none", stance: "sincere" }],
      proposals: [],
    }, { rng: seqRng([0.1]) });
    expect(verdict.facts.find((f) => f.op === "TRANSFER_ITEM")).toBeTruthy();
  });
});

describe("S7 送银判官桥：give 银两走 CHANGE_VITALS_SILVER", () => {
  function silverIntake(text, item = "银两") {
    return { read: "", refIds: [], actions: [{ kind: "give", target: "才旦", item, itemId: item, direction: "none", condition: "无", condition_text: "", stance: "sincere", outcome: "无", risk: "无", confidence: 0.9, text }], proposals: [] };
  }
  function silverEnv(money = 100, extra = {}) {
    return { turn: 42, day: 2, place: "鱼定村·茶馆", npcs: NPCS, varTree: { 角色: { 才旦: { 好感度: 30 } } }, inv: [], entries: [], budget: { riskLevel: 1 }, char: { money, special: { 魅力: 5 } }, playerInput: "", ...extra };
  }

  it("把5两银子送给才旦：签 -5 银两 + 恩好感（分量区间中值），不走 TRANSFER_ITEM", () => {
    const verdict = judgeTurn(silverEnv(100, { playerInput: "把5两银子送给才旦" }), silverIntake("把5两银子送给才旦"), { rng: seqRng([0.5]) });
    const silver = verdict.facts.find((f) => f.op === "CHANGE_VITALS_SILVER");
    expect(silver).toBeTruthy();
    expect(silver.moneyDelta).toBe(-5);
    const social = verdict.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social).toBeTruthy();
    expect(social.ledgerKind).toBe("恩");
    expect(social.affectionDelta).toBeGreaterThan(0);
    expect(verdict.facts.filter((f) => f.op === "TRANSFER_ITEM")).toHaveLength(0);
  });

  it("中文数字「二十两」同样解析", () => {
    const verdict = judgeTurn(silverEnv(100, { playerInput: "送二十两银子给才旦" }), silverIntake("送二十两银子给才旦"), { rng: seqRng([0.5]) });
    expect(verdict.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-20);
  });

  it("未写数额不签发", () => {
    const verdict = judgeTurn(silverEnv(100, { playerInput: "送些银子给才旦" }), silverIntake("送些银子给才旦"), { rng: seqRng([0.5]) });
    expect(verdict.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
    expect(verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("未写明数额");
  });

  it("超囊中不签发（只带 3 两送 50 两）", () => {
    const verdict = judgeTurn(silverEnv(3, { playerInput: "把50两银子送给才旦" }), silverIntake("把50两银子送给才旦"), { rng: seqRng([0.5]) });
    expect(verdict.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("不足");
  });

  it("对象不在场不签发", () => {
    const intake = silverIntake("把5两银子送给王五");
    intake.actions[0].target = "王五";
    const verdict = judgeTurn(silverEnv(100, { playerInput: "把5两银子送给王五" }), intake, { rng: seqRng([0.5]) });
    expect(verdict.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
  });

  it("对方气头上：扣银但不涨好感（镜像 giftSilver）", () => {
    const env = silverEnv();
    env.varTree.角色.才旦.生气状态 = { active: true, reason: "先前结怨", turnsLeft: 2 };
    env.playerInput = "把5两银子送给才旦";
    const verdict = judgeTurn(env, silverIntake("把5两银子送给才旦"), { rng: seqRng([0.5]) });
    expect(verdict.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-5);
    expect(verdict.facts.filter((f) => f.op === "MUTATE_SOCIAL")).toHaveLength(0);
  });

  it("器物赠礼不回归：霜牙短刀仍走 TRANSFER_ITEM", () => {
    const verdict = judgeTurn(baseEnvelope(), {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "才旦", item: "霜牙短刀", itemId: "it_8f3a", direction: "none", stance: "sincere", text: "把霜牙短刀送给才旦" }],
      proposals: [],
    }, { rng: seqRng([0.1]) });
    expect(verdict.facts.find((f) => f.op === "TRANSFER_ITEM")).toBeTruthy();
    expect(verdict.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
  });
});

describe("S7 送银桥 Review 加固：金额只认玩家原文", () => {
  function env2(playerInput, money = 100) {
    return { turn: 42, day: 2, place: "鱼定村·茶馆", npcs: NPCS, varTree: { 角色: { 才旦: { 好感度: 30 } } }, inv: [], entries: [], budget: { riskLevel: 1 }, char: { money, special: { 魅力: 5 } }, playerInput };
  }
  function act(text) {
    return { read: "", refIds: [], actions: [{ kind: "give", target: "才旦", item: "银两", itemId: "银两", direction: "none", condition: "无", condition_text: "", stance: "sincere", outcome: "无", risk: "无", confidence: 0.9, text }], proposals: [] };
  }

  it("模型篡改数额无效：玩家说5两、action.text 写9999两 → 仍按5两签", () => {
    const verdict = judgeTurn(env2("把5两银子送给才旦"), act("把9999两银子送给才旦"), { rng: seqRng([0.5]) });
    expect(verdict.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-5);
  });

  it("余额礼金并列歧义不签：「我有50两给你5两」两个数额不猜", () => {
    const verdict = judgeTurn(env2("我有50两，给你5两吧"), act("给你5两"), { rng: seqRng([0.5]) });
    expect(verdict.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
    expect(verdict.notes.join()).toContain("歧义");
  });

  it("小数/半截数额不签：1.5两、一百二十两完整解析", () => {
    const v1 = judgeTurn(env2("给你1.5两"), act("给你1.5两"), { rng: seqRng([0.5]) });
    expect(v1.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
    const v2 = judgeTurn(env2("孝敬一百二十两", 200), act("孝敬一百二十两"), { rng: seqRng([0.5]) });
    expect(v2.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-120);
  });

  it("一千二百两完整解析（千位不丢）；万级拒签", () => {
    const v = judgeTurn(env2("孝敬一千二百两", 2000), act("孝敬一千二百两"), { rng: seqRng([0.5]) });
    expect(v.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-1200);
    const v2 = judgeTurn(env2("送一万两"), act("送一万两"), { rng: seqRng([0.5]) });
    expect(v2.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
  });

  it("「一万零五两」零字段拒签不半截错扣", () => {
    const v = judgeTurn(env2("送一万零五两", 20000), act("送一万零五两"), { rng: seqRng([0.5]) });
    expect(v.facts.filter((f) => f.op === "CHANGE_VITALS_SILVER")).toHaveLength(0);
  });

  it("「千万收下」副词不误伤：5 两照签", () => {
    const v = judgeTurn(env2("温掌柜千万收下这5两银子"), act("温掌柜千万收下这5两银子"), { rng: seqRng([0.5]) });
    expect(v.facts.find((f) => f.op === "CHANGE_VITALS_SILVER")?.moneyDelta).toBe(-5);
  });
});

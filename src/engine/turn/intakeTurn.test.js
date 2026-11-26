import { describe, expect, it } from "vitest";
import { hasHostileHint, buildIntakeUserContent, normalizeIntakeResult, synthesizeTalkIntake, shouldSkipIntakeForTalk } from "./intakeTurn.js";
import { getPromptDef } from "../../domain/rules/prompt/registry.js";
import { INTAKE_JSON_SCHEMA } from "../../domain/rules/judge/intakeSchema.js";

describe("turn.intake 注册", () => {
  it("call 定义存在：light 路由、1024 maxTokens（roadmap 口径）、关思考、挂契约 B schema", () => {
    const call = getPromptDef("call", "turn.intake");
    expect(call).toBeTruthy();
    expect(call.route).toBe("light");
    expect(call.defaultMaxTokens).toBe(1024);
    expect(call.schema).toBe(INTAKE_JSON_SCHEMA);
    expect(call.cfg(null, { cfg: { thinkingMode: "auto" } }).thinkingMode).toBe("off");
  });
});

describe("buildIntakeUserContent 现场喂料", () => {
  it("含玩家原话、最近两轮、在场角色随身物 ID、场记板条目头", () => {
    const text = buildIntakeUserContent({
      playerInput: "把那把刀送给才旦",
      recentTurns: [
        { user: "更早前", engine: "不应出现这条" },
        { user: "环顾四周", engine: "茶馆里坐着才旦。" },
        { user: "坐下", engine: "你坐了下来。" },
      ],
      npcs: [{ name: "才旦", carriedItems: [{ id: "it_8f3a", name: "霜牙短刀" }, { id: "it_x", name: "已偷", stolen: true }] }],
      entries: [{ id: "P18_2", publicText: "呼延雪将断念剑拍在石桌上" }],
    });
    expect(text).toContain("把那把刀送给才旦");
    expect(text).toContain("坐下");
    expect(text).not.toContain("更早前");
    expect(text).toContain("才旦");
    expect(text).toContain("霜牙短刀(it_8f3a)");
    expect(text).not.toContain("已偷");
    expect(text).toContain("【P18_2】");
    expect(text).toContain("呼延雪将断念剑拍在石桌上");
  });

  it("空输入不崩，占位段落不硬塞", () => {
    const text = buildIntakeUserContent({ playerInput: "看看" });
    expect(text).toContain("看看");
    expect(text).not.toContain("最近两轮");
    expect(text).not.toContain("在场角色");
  });
});

describe("normalizeIntakeResult 本地复核", () => {
  const fullAction = {
    kind: "give", target: "才旦", item: "霜牙短刀", itemId: "it_8f3a", direction: "none",
    condition: "无", condition_text: "", stance: "casual",
    outcome: "无", risk: "无", confidence: 0.9, text: "送刀", useKind: "",
  };
  const valid = {
    read: "送刀", refIds: [],
    actions: [{ ...fullAction }],
    proposals: [],
  };

  it("合形制的逐字透传（内容深相等）", () => {
    expect(normalizeIntakeResult(valid)).toEqual(valid);
  });

  it("WO-16G 修复式复核：多填字段剥掉、缺省键补默认值，不整单报废", () => {
    // 多填未声明键——剥掉后不失败
    const extra = JSON.parse(JSON.stringify(valid));
    extra.actions[0].speed = "fast";
    extra.noise = 1;
    const out1 = normalizeIntakeResult(extra);
    expect(out1.degraded).toBeUndefined();
    expect(out1.actions[0].speed).toBeUndefined();
    expect(out1.noise).toBeUndefined();
    // 漏填新字段——补缺省值后通过
    const sparse = { read: "x", refIds: [], actions: [{ kind: "give", target: "才旦" }], proposals: [] };
    const out2 = normalizeIntakeResult(sparse);
    expect(out2.degraded).toBeUndefined();
    expect(out2.actions[0].outcome).toBe("无");
    expect(out2.actions[0].risk).toBe("无");
    expect(out2.actions[0].confidence).toBe(0);
    expect(out2.actions[0].item).toBe("无");
  });

  it("proposals 残缺/非法整条丢弃，不补默认 kind/fit/claim", () => {
    const mk = (patch) => ({ read: "x", refIds: [], actions: [], proposals: [{ claim: "桌上有剑谱", kind: "find_item", fit: "natural", questId: "", flag: "", ...patch }] });
    // 缺 kind/fit/claim 或非法枚举——整条丢弃，绝不被伪造成合法寻宝提议
    for (const bad of [
      mk({ kind: undefined }),
      mk({ fit: undefined }),
      mk({ claim: "" }),
      mk({ kind: "fly" }),
      mk({ fit: "perfect" }),
    ]) {
      const out = normalizeIntakeResult(bad);
      expect(out.proposals).toEqual([]);
    }
    // 完整合法的保留；questId/flag 缺失可补缺省空串
    const good = normalizeIntakeResult(mk({}));
    expect(good.proposals).toHaveLength(1);
    const noQf = normalizeIntakeResult({ read: "x", refIds: [], actions: [], proposals: [{ claim: "桌上有剑谱", kind: "find_item", fit: "natural" }] });
    expect(noQf.proposals).toHaveLength(1);
    expect(noQf.proposals[0].questId).toBe("");
  });

  it("confidence 超界动作逐条丢弃，合法动作留存（WO-16G-G2）", () => {
    const mk = (c) => ({
      read: "x", refIds: [], proposals: [],
      actions: [{ kind: "talk", target: "才旦", item: "无", itemId: "", direction: "none", condition: "无", condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: c, text: "x" }],
    });
    // 单条超界——该条丢弃，听意单本身不报废
    expect(normalizeIntakeResult(mk(1.5)).actions).toEqual([]);
    expect(normalizeIntakeResult(mk(1.5)).degraded).toBeUndefined();
    expect(normalizeIntakeResult(mk(-0.1)).actions).toEqual([]);
    for (const c of [0.5, 0, 1]) {
      expect(normalizeIntakeResult(mk(c)).actions).toHaveLength(1);
    }
  });

  it("WO-16G-G2：复合句里单条 enum 非法只丢坏动作，合法动作照常进判官", () => {
    const mixed = {
      read: "送刀再闲聊", refIds: [], proposals: [],
      actions: [
        { kind: "give", target: "才旦", item: "霜牙短刀", text: "送刀" },
        { kind: "fly", target: "无", text: "飞天" },          // enum 非法——只丢这条
        { kind: "talk", target: "才旦", text: "闲聊" },
      ],
    };
    const out = normalizeIntakeResult(mixed);
    expect(out.degraded).toBeUndefined();
    expect(out.actions).toHaveLength(2);
    expect(out.actions.map((a) => a.kind)).toEqual(["give", "talk"]);
  });

  it("整张数据非法才降级为空听意单（degraded 标记）", () => {
    const bad = { read: "x", refIds: [], actions: [{ kind: "fly" }], proposals: [] };
    const out = normalizeIntakeResult(bad);
    expect(out.degraded).toBeUndefined();           // 坏动作丢弃后仍是合法空actions单
    expect(out.actions).toEqual([]);
    expect(normalizeIntakeResult(null).degraded).toBe(true);
    expect(normalizeIntakeResult("junk").degraded).toBe(true);
  });
});

describe("WO-16G-G2 三级分流闸门与本地合成", () => {
  it("shouldSkipIntakeForTalk：纯搭话无候选才跳过，有候选/非搭话不跳", () => {
    expect(shouldSkipIntakeForTalk(true, [])).toBe(true);
    expect(shouldSkipIntakeForTalk(true, null)).toBe(true);
    expect(shouldSkipIntakeForTalk(true, undefined)).toBe(true);
    expect(shouldSkipIntakeForTalk(true, [{ questId: "q", flag: "f" }])).toBe(false);
    expect(shouldSkipIntakeForTalk(false, [])).toBe(false);
  });

  it("synthesizeTalkIntake 形状与 normalize 输出一致，target 缺省填「无」", () => {
    const out = synthesizeTalkIntake("才旦，最近可好？", "才旦");
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0].kind).toBe("talk");
    expect(out.actions[0].target).toBe("才旦");
    expect(out.actions[0].text).toBe("才旦，最近可好？");
    // 12 字段全在（required 不缺键）
    for (const key of ["kind", "target", "item", "itemId", "direction", "condition", "condition_text", "stance", "outcome", "risk", "confidence", "text"]) {
      expect(out.actions[0]).toHaveProperty(key);
    }
    expect(out.proposals).toEqual([]);
    expect(synthesizeTalkIntake("喂", null).actions[0].target).toBe("无");
    expect(synthesizeTalkIntake("喂", null, "才旦").actions[0].target).toBe("才旦");
    expect(synthesizeTalkIntake("喂", "阿岚", "才旦").actions[0].target).toBe("阿岚");
  });
});

describe("hasHostileHint", () => {
  it("常见辱骂词命中，不直接定 stance 只决定是否多听一遍前哨", () => {
    for (const text of ["你这个蠢货", "笨蛋", "废物", "滚开"]) {
      expect(hasHostileHint(text)).toBe(true);
    }
    expect(hasHostileHint("最近可好？")).toBe(false);
  });
});

describe("buildIntakeUserContent WO-16G 喂料", () => {
  it("拆句 hints/可用出口/四张物件清单统一 名字(编号)，不喂银两", () => {
    const text = buildIntakeUserContent({
      playerInput: "先看看四周，然后把刀送给才旦",
      npcs: [],
      inv: [
        { id: "it_g1", name: "青稞酒", category: "misc", consumable: { energyRestore: 1 } },
        { id: "it_g2", name: "霜牙短刀", category: "weapon" },
        { id: "it_g3", name: "铁护甲", category: "armor", equipped: true },
      ],
      room: { name: "鱼定村", items: [{ id: "it_p1", name: "遗落的皮靴" }] },
      innerRoomName: null,
    });
    // 拆句 hints：复合句切段
    expect(text).toContain("[拆句提示]");
    expect(text).toContain("「先看看四周」");
    // 物件清单
    expect(text).toContain("· 赠予：");
    expect(text).toContain("霜牙短刀(it_g2)");
    expect(text).toContain("· 服用：");
    expect(text).toContain("· 把玩或出示：");
    expect(text).toContain("青稞酒(it_g1)");
    expect(text).toContain("· 拾取：");
    expect(text).toContain("遗落的皮靴(it_p1)");
    expect(text).toContain("· 穿戴卸下：");
    expect(text).toContain("铁护甲(it_g3)〔已装备〕");
    // 已装备物件不进赠予清单
    expect(text.split("· 赠予：")[1].split("\n")[0]).not.toContain("铁护甲");
    // 不喂银两
    expect(text).not.toContain("银两");
  });

  it("外层据点按 QUCUO_MAP 出口列，锁节点按解锁口径过滤", () => {
    // 鱼定村外层四出口全开放
    const open_ = buildIntakeUserContent({
      playerInput: "走",
      room: { name: "鱼定村", items: [] },
      innerRoomName: null,
      questProgress: {}, flags: [], inv: [], char: {}, varTree: {},
    });
    expect(open_).toContain("w(西→鱼定土司)");
    expect(open_).toContain("n(北→喇嘛庙)");
    // 锁节点：心灵之海/第三新东京市带 unlockCondition——站在有连锁出口处时未解锁不出现；
    // 直接构造验证：给一个有锁出口的假据点名不存在则空，真实锁定节点不会从别处列出
    const locked = buildIntakeUserContent({
      playerInput: "走",
      room: { name: "心灵之海", items: [] },
      innerRoomName: null,
      questProgress: {}, flags: [], inv: [], char: {}, varTree: {},
    });
    // 心灵之海本身 exits 为空——出口栏恒无
    expect(locked).toContain("[可用出口] 无");
  });

  it("WO-16G-G2：外层出口解锁与 outerMove 同走 isNodeUnlocked（questCompleted 口径）", () => {
    // 玉泉寨 w→黑风寨；黑风寨 unlockCondition questCompleted heifengzhai_2_meimeidexiaoxi
    const base = {
      playerInput: "走",
      room: { name: "玉泉寨", items: [] },
      innerRoomName: null,
      flags: [], inv: [], char: {}, varTree: {},
    };
    const lockedOut = buildIntakeUserContent({ ...base, questProgress: {} });
    expect(lockedOut).not.toContain("黑风寨");
    const unlockedOut = buildIntakeUserContent({
      ...base,
      questProgress: { heifengzhai_2_meimeidexiaoxi: { status: "completed" } },
    });
    expect(unlockedOut).toContain("w(西→黑风寨)");
  });
});

describe("S2 hasHostileHint 敌意提示", () => {
  it("辱骂/羞辱/威胁类文本命中", () => {
    expect(hasHostileHint("当众羞辱你这黑心掌柜")).toBe(true);
    expect(hasHostileHint("你这个混蛋")).toBe(true);
    expect(hasHostileHint("再啰嗦就宰了你")).toBe(true);
  });
  it("平常搭话不误报", () => {
    expect(hasHostileHint("掌柜的近来可好")).toBe(false);
    expect(hasHostileHint("请问去雪山怎么走")).toBe(false);
  });
});

describe("F6-T17 复数称呼脱绑", () => {
  const base = { read: "x", refIds: [], proposals: [] };
  const act = (target, text) => ({
    kind: "talk", target, item: "无", itemId: "", direction: "none", condition: "无",
    condition_text: "", stance: "casual", outcome: "无", risk: "无", confidence: 0.9, text,
  });
  it("「众人/各位」原文未点名 → target 脱绑回无", () => {
    const r = normalizeIntakeResult({ ...base, actions: [act("老孙", "冲在场的众人拱手笑道，各位今日气色不错")] });
    expect(r.actions[0].target).toBe("无");
  });
  it("原文点名 + 复数词并存 → target 保留", () => {
    const r = normalizeIntakeResult({ ...base, actions: [act("老孙", "冲老孙和大伙儿问好")] });
    expect(r.actions[0].target).toBe("老孙");
  });
  it("无复数称呼 → 不受影响", () => {
    const r = normalizeIntakeResult({ ...base, actions: [act("老孙", "老孙你近来可好")] });
    expect(r.actions[0].target).toBe("老孙");
  });
  it("Review 二轮：appease 属社交称呼类——「向大伙儿赔不是」脱绑不落单人", () => {
    const ap = { ...act("老孙", "向大伙儿赔不是"), kind: "appease" };
    const r = normalizeIntakeResult({ ...base, actions: [ap] });
    expect(r.actions[0].target).toBe("无");
  });
  it("Review：交易/赠物动作不脱绑——「给大伙儿买」的掌柜 target 保留", () => {
    const trade = { ...act("老孙", "掌柜的，给大伙儿来几碗面"), kind: "trade" };
    const r = normalizeIntakeResult({ ...base, actions: [trade] });
    expect(r.actions[0].target).toBe("老孙");
  });
});

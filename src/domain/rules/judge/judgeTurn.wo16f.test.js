import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judgeTurn.js";

const base = (over = {}) => ({
  turn: 5, day: 1, place: "鱼定村",
  npcs: [{ name: "才旦", personality: "精明", carriedItems: [{ id: "i1", name: "钱袋" }] }],
  varTree: { 角色: {} }, inv: [], entries: [],
  char: { hp: [80, 100], money: 50, special: { 身法: 6, 智谋: 6, 体魄: 5 } },
  ...over,
});
const act = (a) => ({ read: "", refIds: [], actions: [a], proposals: [] });
const fa = (outcome, risk = "无", text = "") => ({ kind: "free_act", target: "无", outcome, risk, text, stance: "casual" });

describe("WO-16F-F1 free_act 按表签发", () => {
  it("伤损：高风险 -25%maxHp，检定成功减半", () => {
    const v1 = judgeTurn(base(), act(fa("伤损", "高")), { rng: () => 0.99 });
    const f1 = v1.facts.find((f) => f.op === "CHANGE_VITALS_SILVER");
    // rng 0.99：身法 6+5.94≥6 减半 → -25/2=-13（round）
    expect(f1.hpDelta).toBe(-13);
    const weak = base(); weak.char.special = { 身法: 0, 智谋: 0, 体魄: 0 };
    const v2 = judgeTurn(weak, act(fa("伤损", "高")), { rng: () => 0 });
    expect(v2.facts.find((f) => f.op === "CHANGE_VITALS_SILVER").hpDelta).toBe(-25);
    const v3 = judgeTurn(weak, act(fa("伤损", "低")), { rng: () => 0 });
    expect(v3.facts[0].hpDelta).toBe(-5);
  });
  it("S3 得财：无 proposal 也签 tier 区间；natural 上半；absurd 不签；同时辰第二次不签", () => {
    // 无 proposal 也签（S3 放宽——不再要求 fit 合格 proposal）
    const v0 = judgeTurn(base(), act(fa("得财")), { rng: () => 0 });
    const f0 = v0.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(f0.moneyDelta).toBeGreaterThanOrEqual(2); // T0 2-10
    expect(f0.moneyDelta).toBeLessThanOrEqual(10);
    // natural 取上半区间（T0 上半 6-10）
    const withProp = { read: "", refIds: [], actions: [fa("得财")], proposals: [{ kind: "free_act", fit: "natural" }] };
    const v = judgeTurn(base(), withProp, { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(f.moneyDelta).toBeGreaterThanOrEqual(6);
    expect(f.moneyDelta).toBeLessThanOrEqual(10);
    // absurd 不签
    const absurd = { read: "", refIds: [], actions: [fa("得财")], proposals: [{ kind: "free_act", fit: "absurd" }] };
    expect(judgeTurn(base(), absurd, { rng: () => 0 }).facts.find((x) => x.moneyDelta > 0)).toBeUndefined();
    // 同一游戏时辰第二次不签（账本 freeActGain 或同 verdict 幂等）——turn5 → freeActGain_2
    const ledger = { 角色: {}, 世界: { 每日搜刮: { day: 1, count: 0, freeActGain: ["freeActGain_2"] } } };
    const again = judgeTurn(base({ varTree: ledger }), act(fa("得财")), { rng: () => 0 });
    expect(again.facts.find((x) => x.moneyDelta > 0)).toBeUndefined();
    // fact 带 gainKey 供 materialize 落账
    expect(f0.gainKey).toBe("freeActGain_2");
  });
  it("S3 破费：原话数额照扣；没写查货架/物件志/白档；超囊中扣到零写囊中不足", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "掏出 30 两请客")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-30);
    // 超囊中只扣到零+notes 囊中不足
    const over = judgeTurn(base(), act(fa("破费", "无", "豪掷 999 两")), { rng: () => 0.5 });
    expect(over.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-50);
    expect(over.notes.some((n) => n.includes("囊中不足"))).toBe(true);
    // 没写数额：在场商户货架同名价（跑马集市 烤羊腿 10 两）
    const shop = base({ npcs: [{ name: "跑马集市", personality: "", carriedItems: [] }] });
    const buy = judgeTurn(shop, act(fa("破费", "无", "要了一只烤羊腿")), { rng: () => 0.5 });
    const bf = buy.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(bf.moneyDelta).toBe(-10);
    expect(buy.notes.some((n) => n.includes("货架同名"))).toBe(true);
    // 无目标物（服务/请客/打点）：不套 misc 白档，直落 risk 默认（初审口径：无=2/中=10）
    const noAmt = judgeTurn(base(), act(fa("破费", "无", "随便花点")), { rng: () => 0.5 });
    expect(noAmt.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-2);
    expect(noAmt.notes.some((n) => n.includes("risk默认"))).toBe(true);
    const midRisk = judgeTurn(base(), act(fa("破费", "中", "夜间悄悄打点")), { rng: () => 0.5 });
    const mf = midRisk.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(mf.moneyDelta).toBe(-10);
    // 囊中原已空：不签
    const broke = base(); broke.char.money = 0;
    expect(judgeTurn(broke, act(fa("破费", "无", "掏出 5 两")), { rng: () => 0.5 }).facts.find((x) => x.op === "CHANGE_VITALS_SILVER")).toBeUndefined();
  });
  it("调息：hp+10%maxHp 且 pot+1；同时辰幂等", () => {
    const v = judgeTurn(base(), act(fa("调息")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").hpDelta).toBe(10);
    expect(v.facts.find((x) => x.op === "PROGRESS_CULTIVATION").potDelta).toBe(1);
    // turn5 watch=2：rest_2 已记账则跳过
    const again = judgeTurn(base({ varTree: { 角色: {}, 世界: { 调息账: ["rest_2"] } } }), act(fa("调息")), { rng: () => 0.5 });
    expect(again.facts.length).toBe(0);
  });
  it("修习：按 tier 签 potDelta", () => {
    const v = judgeTurn(base(), act(fa("修习")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "PROGRESS_CULTIVATION").potDelta).toBe(1); // T0=1
  });
  it("受寒中毒：按文本分流寒/毒/并列/不明四种", () => {
    const cold = judgeTurn(base(), act(fa("受寒中毒", "无", "夜里受了风寒")), { rng: () => 0.5 });
    expect(cold.facts.filter((x) => x.op === "APPLY_CONDITION").map((x) => x.attr)).toEqual(["身法"]);
    const poison = judgeTurn(base(), act(fa("受寒中毒", "无", "误食毒蘑菇")), { rng: () => 0.5 });
    expect(poison.facts.filter((x) => x.op === "APPLY_CONDITION").map((x) => x.attr)).toEqual(["体魄"]);
    const both = judgeTurn(base(), act(fa("受寒中毒", "无", "寒毒入体")), { rng: () => 0.5 });
    expect(both.facts.filter((x) => x.op === "APPLY_CONDITION").length).toBe(2);
    const unclear = judgeTurn(base(), act(fa("受寒中毒")), { rng: () => 0.5 });
    expect(unclear.facts.length).toBe(0);
    expect(unclear.notes.join()).toContain("寒热毒型不明");
  });
  it("醉酒：智谋-1×6", () => {
    const v = judgeTurn(base(), act(fa("醉酒")), { rng: () => 0.5 });
    const f = v.facts.find((x) => x.op === "APPLY_CONDITION");
    expect(f.attr).toBe("智谋"); expect(f.durationTurns).toBe(6); expect(f.negative).toBe(true);
  });
  it("服用/无/其他不签；talkOnly 不签", () => {
    expect(judgeTurn(base(), act(fa("服用")), { rng: () => 0.5 }).facts.length).toBe(0);
    expect(judgeTurn(base(), act(fa("无")), { rng: () => 0.5 }).facts.length).toBe(0);
    const tk = judgeTurn(base({ talkOnly: true }), act(fa("修习")), { rng: () => 0.5 });
    expect(tk.facts.length).toBe(0);
  });
});

describe("WO-16F-F1 steal 按表裁定", () => {
  const steal = { kind: "steal", target: "才旦", stance: "casual" };
  it("成功且目标有物：TRANSFER_ITEM npc→player", () => {
    // 身法6+智谋6+rng×6 ≥ 4+精明2+0=6：rng 0 时 12≥6 必成
    const v = judgeTurn(base(), act(steal), { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "TRANSFER_ITEM");
    expect(f.from).toBe("才旦"); expect(f.to).toBe("player"); expect(f.itemName).toBe("钱袋");
  });
  it("失败：MUTATE_SOCIAL 怨 -6 + 生气标记", () => {
    // 低属性+多人警觉：身法0智谋0 rng0 → 0 < 4+2+2
    const hard = base({ npcs: [
      { name: "才旦", personality: "精明多疑", carriedItems: [{ name: "钱袋" }] },
      { name: "八云" }, { name: "路人" },
    ] });
    hard.char.special = { 身法: 0, 智谋: 0 };
    const v = judgeTurn(hard, act(steal), { rng: () => 0 });
    const f = v.facts.find((x) => x.op === "MUTATE_SOCIAL");
    expect(f.affectionDelta).toBe(-6); expect(f.ledgerKind).toBe("怨");
    expect(f.anger.active).toBe(true);
  });
  it("目标无物/不在场不签；talkOnly 不签", () => {
    const noCarry = base({ npcs: [{ name: "才旦", personality: "" }] });
    const v = judgeTurn(noCarry, act(steal), { rng: () => 0.99 });
    expect(v.facts.find((x) => x.op === "TRANSFER_ITEM")).toBeUndefined();
    const absent = judgeTurn(base(), act({ ...steal, target: "不在场" }), { rng: () => 0.99 });
    expect(absent.facts.length).toBe(0);
    const tk = judgeTurn(base({ talkOnly: true }), act(steal), { rng: () => 0.99 });
    expect(tk.facts.length).toBe(0);
  });
});

describe("S3 Review 三单回归", () => {
  it("中文数字原话数额照扣：三两/十五两/一百二十两", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "花三两请客")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-3);
    const v2 = judgeTurn(base(), act(fa("破费", "无", "掏出十五两")), { rng: () => 0.5 });
    expect(v2.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-15);
  });
  it("item 为无但原文点具名货：查物件志价不落白档", async () => {
    const { CATALOG_INDEX } = await import("../../data/items/catalog.js");
    const named = Object.keys(CATALOG_INDEX).find((n) => n.length >= 2);
    expect(named).toBeTruthy();
    const v = judgeTurn(base(), act(fa("破费", "无", `买下${named}防身`)), { rng: () => 0.5 });
    expect(v.notes.some((n) => n.includes("物件志"))).toBe(true);
  });
  it("同回合先赚后花：破费按流水余额不卡开场", () => {
    // money=50：先得财 T0 2-10（rng 0.999→上限 10），再破费 60 两——原口径卡 50，现按 60 流水全额签
    const two = { read: "", refIds: [], actions: [fa("得财"), fa("破费", "无", "掏出六十两打赏")], proposals: [] };
    const v = judgeTurn(base(), two, { rng: () => 0.999 });
    const debits = v.facts.filter((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(debits.length).toBe(2);
    expect(debits[0].moneyDelta).toBeGreaterThan(0);
    expect(debits[1].moneyDelta).toBe(-60); // 50+10 流水够 60，不卡开场 50
    // 反过来：先花后赚仍按花时点的流水扣
    const spendFirst = { read: "", refIds: [], actions: [fa("破费", "无", "掏出六十两打赏"), fa("得财")], proposals: [] };
    const v2 = judgeTurn(base(), spendFirst, { rng: () => 0.999 });
    expect(v2.facts[0].moneyDelta).toBe(-50); // 开场 50 不够 60，扣到零
  });
});

describe("S3 Review 二轮两单回归", () => {
  it("货量不误当价：买一两茶叶付5两银子 → -5", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "买一两茶叶，付5两银子")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-5);
  });
  it("具名最长优先：柳青鸢的菊花茶不按短名青鸢武器价", async () => {
    const { CATALOG_INDEX } = await import("../../data/items/catalog.js");
    // 若目录无此二名则跳过断言（防目录演进脆断）
    if (!CATALOG_INDEX["柳青鸢的菊花茶"] || !CATALOG_INDEX["青鸢"]) return;
    const v = judgeTurn(base(), act(fa("破费", "无", "买了一盏柳青鸢的菊花茶")), { rng: () => 0.5 });
    const f = v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(Math.abs(f.moneyDelta)).toBeLessThan(100); // 茶价量级，绝非武器 330
    expect(v.notes.some((n) => n.includes("柳青鸢的菊花茶"))).toBe(true);
  });
});

describe("S3 调度初审口径回归", () => {
  it("买一两茶叶（纯货量无钱文）不认价，走查价/默认", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "买一两茶叶")), { rng: () => 0.5 });
    const f = v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(f.moneyDelta).not.toBe(-1); // 绝不把货量 1 当价
    expect(v.notes.some((n) => n.includes("risk默认") || n.includes("货架") || n.includes("物件志"))).toBe(true);
  });
  it("明确钱文无动词也认：收了二十两银子", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "递上二十两银子")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-20);
  });
  it("席面/薄饼双具名同现=歧义，不落价走默认", async () => {
    const { CATALOG_INDEX } = await import("../../data/items/catalog.js");
    const names = Object.keys(CATALOG_INDEX).filter((n) => n.length >= 2);
    if (names.length < 2) return;
    const [a, b] = names;
    const v = judgeTurn(base(), act(fa("破费", "无", `买了${a}又订了${b}`)), { rng: () => 0.5 });
    if (!a.includes(b) && !b.includes(a)) {
      expect(v.notes.some((n) => n.includes("risk默认"))).toBe(true);
    }
  });
  it("item 为无（服务类）不套 misc 白档：打点中risk=10", () => {
    const v = judgeTurn(base(), act(fa("破费", "中", "夜间悄悄打点")), { rng: () => 0.5 });
    expect(v.notes.some((n) => n.includes("risk默认(中)"))).toBe(true);
  });
});

describe("S3 三轮回归：物件志倍率价+余额不当价", () => {
  it("具名武器按 atkMul 倍率价非裸基准", async () => {
    const { CATALOG_INDEX, catalogBuyPrice } = await import("../../data/items/catalog.js");
    const { priceForQuality } = await import("../economy/equipment.js");
    const wname = Object.keys(CATALOG_INDEX).find((n) => (CATALOG_INDEX[n].atkMul ?? 1) > 1);
    expect(wname).toBeTruthy();
    const entry = CATALOG_INDEX[wname];
    const expectPrice = catalogBuyPrice(entry);
    expect(expectPrice).toBeGreaterThan(priceForQuality(entry.category, entry.quality).buyPrice);
    const rich = base(); rich.char.money = 99999;
    const v = judgeTurn(rich, act(fa("破费", "无", `买下${wname}`)), { rng: () => 0.5 });
    const f = v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER");
    expect(f.moneyDelta).toBe(-expectPrice);
    expect(v.notes.some((n) => n.includes("物件志"))).toBe(true);
  });
  it("杂物具名仍按基准价（无倍率）", async () => {
    const { CATALOG_INDEX, catalogBuyPrice } = await import("../../data/items/catalog.js");
    const { priceForQuality } = await import("../economy/equipment.js");
    const gname = Object.keys(CATALOG_INDEX).find((n) => {
      const e = CATALOG_INDEX[n];
      return n.length >= 2 && !(e.atkMul > 1) && !(e.defMul > 1) && (e.category === "misc" || e.category === "accessory");
    });
    if (!gname) return;
    expect(catalogBuyPrice(CATALOG_INDEX[gname])).toBe(priceForQuality(CATALOG_INDEX[gname].category, CATALOG_INDEX[gname].quality).buyPrice);
  });
  it("囊中余额不误当价：身上有50两银子付5两房钱 → -5", () => {
    const v = judgeTurn(base(), act(fa("破费", "无", "身上有50两银子，付5两房钱")), { rng: () => 0.5 });
    expect(v.facts.find((x) => x.op === "CHANGE_VITALS_SILVER").moneyDelta).toBe(-5);
  });
});

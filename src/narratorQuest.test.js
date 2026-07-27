import { describe, it, expect } from "vitest";
import {
  COMFORT_ACTIONS, KNOTS, CORE_KNOT, emptyComfort,
  comfortScore, defenseLevelOf, canComfort, describeComfortReject, comfortResponse,
  availableKnot, canResolve, looksLikePromise, seaDialoguePrompt,
  SCENE_ARRIVE, SCENE_VILLA, SCENE_RESOLVE,
} from "./narratorQuest.js";
import { NNPC_STAGE, isInSea, narratorVoicePrompt, TONE_KEYS } from "./narrator.js";
import { initialNarratorVars } from "./mvu.js";

const C = (over = {}) => ({ ...emptyComfort(), ...over });

describe("心防由 comfort 派生（不存第二份）", () => {
  it("空 comfort → level 5", () => {
    expect(defenseLevelOf(emptyComfort())).toBe(5);
  });
  it("分数阈值 2/5/10/16/24 对应 4/3/2/1/0", () => {
    expect(defenseLevelOf(C({ verbal: 2 }))).toBe(4);   // 2
    expect(defenseLevelOf(C({ verbal: 5 }))).toBe(3);   // 5
    expect(defenseLevelOf(C({ verbal: 4, hug: 2 }))).toBe(2);  // 10
    expect(defenseLevelOf(C({ verbal: 4, hug: 4 }))).toBe(1);  // 16
    expect(defenseLevelOf(C({ verbal: 6, hug: 3, kiss: 3 }))).toBe(0); // 24
  });
  it("权重按 COMFORT_ACTIONS 算，抱/亲最重", () => {
    expect(comfortScore(C({ hug: 1 }))).toBe(3);
    expect(comfortScore(C({ kiss: 1 }))).toBe(3);
    expect(comfortScore(C({ medication: 1 }))).toBe(2);
    expect(comfortScore(C({ verbal: 1 }))).toBe(1);
  });
  it("脏数据不炸", () => {
    expect(defenseLevelOf(null)).toBe(5);
    expect(defenseLevelOf({})).toBe(5);
    expect(defenseLevelOf({ verbal: "abc" })).toBe(5);
  });
  it("单调不减：分数越高心防越低", () => {
    let last = 5;
    for (let v = 0; v <= 30; v++) {
      const lv = defenseLevelOf(C({ verbal: v }));
      expect(lv).toBeLessThanOrEqual(last);
      last = lv;
    }
  });
});

describe("minLevel 是门槛：越级被拒且不计分", () => {
  it("level 5 只能说话", () => {
    const c = emptyComfort();
    expect(canComfort("verbal", c).ok).toBe(true);
    for (const k of ["food", "medication", "hug", "kiss"]) {
      expect(canComfort(k, c, ["蛋糕", "抗焦虑药"]).ok, `${k} 在 level5 竟然可做`).toBe(false);
    }
  });
  it("抱要 level≤2、亲要 level≤1", () => {
    const lv2 = C({ verbal: 4, hug: 0, medication: 3 }); // 4+6=10 → lv2
    expect(defenseLevelOf(lv2)).toBe(2);
    expect(canComfort("hug", lv2).ok).toBe(true);
    expect(canComfort("kiss", lv2).ok).toBe(false);
    const lv1 = C({ verbal: 4, hug: 4 }); // 16 → lv1
    expect(canComfort("kiss", lv1).ok).toBe(true);
  });
  it("需要道具的动作缺物则不可做", () => {
    const lv3 = C({ verbal: 5 });
    expect(canComfort("medication", lv3, []).reason).toBe("noItem");
    expect(canComfort("medication", lv3, ["抗焦虑药"]).ok).toBe(true);
  });
  it("被拒的话是她的反应，不报数值（不把机制摊开）", () => {
    const msg = describeComfortReject("hug", "tooEarly");
    expect(msg).toContain("别碰我");
    expect(msg).not.toMatch(/\d/);           // 不出现任何数字
    expect(msg).not.toContain("心防");
  });
  it("五个动作在五个级别都有对应反应文本", () => {
    for (const k of Object.keys(COMFORT_ACTIONS)) {
      for (let lv = 5; lv >= 0; lv--) {
        expect(typeof comfortResponse(k, lv)).toBe("string");
      }
    }
  });
});

describe("三个心结 + 一个内核", () => {
  it("三条心结，母亲那条排最后（最亲近的伤最后碰）", () => {
    expect(KNOTS.map(k => k.key)).toEqual(["hebe", "corner", "doll"]);
    expect(KNOTS[2].title).toContain("布偶");
  });
  it("门槛依次收紧 4 → 3 → 2", () => {
    expect(KNOTS.map(k => k.maxLevel)).toEqual([4, 3, 2]);
  });
  it("内核不在三条里，且注明须玩家点破", () => {
    expect(KNOTS.find(k => k.key === "core")).toBeUndefined();
    expect(CORE_KNOT.guide).toContain("她自己说不出");
    expect(CORE_KNOT.guide).toContain("玩家");
  });

  it("顺序不可跳：心防再低也得按序来", () => {
    // 注意 comfort 要把三条心结各自的 needs 都满足（verbal/soothing/hug），
    // 否则卡在方式不对上——那是另一条测试的事，这条只验顺序。
    const deep = C({ verbal: 6, food: 2, hug: 3, kiss: 3 }); // level 0 且 needs 全满
    expect(availableKnot(deep, []).key).toBe("hebe");
    expect(availableKnot(deep, ["hebe"]).key).toBe("corner");
    expect(availableKnot(deep, ["hebe", "corner"]).key).toBe("doll");
    expect(availableKnot(deep, ["hebe", "corner", "doll"])).toBeNull();
  });

  it("心防不够则当前这条也不开（返回 null 而不是跳到下一条）", () => {
    const lv5 = emptyComfort();
    expect(availableKnot(lv5, [])).toBeNull();          // hebe 要 ≤4
    const lv4 = C({ verbal: 2 });
    expect(availableKnot(lv4, []).key).toBe("hebe");    // 刚够
    expect(availableKnot(lv4, ["hebe"])).toBeNull();    // corner 要 ≤3，还不够
  });

  it("收束要求：三条说尽 且 心防≤1", () => {
    const all = ["hebe", "corner", "doll"];
    expect(canResolve(C({ verbal: 4, hug: 2 }), all)).toBe(false);  // lv2
    expect(canResolve(C({ verbal: 4, hug: 4 }), all)).toBe(true);   // lv1
    expect(canResolve(C({ verbal: 4, hug: 4 }), ["hebe"])).toBe(false);
  });
});

describe("承诺判定：宁可放宽也不卡住玩家", () => {
  it.each([
    "你不用最厉害，我也看着你",
    "我不走",
    "你已经够好了",
    "不用证明给谁看",
    "我会一直在",
  ])("认得出：%s", (t) => expect(looksLikePromise(t)).toBe(true));

  it("无关的话不误判", () => {
    expect(looksLikePromise("这海真好看")).toBe(false);
    expect(looksLikePromise("")).toBe(false);
    expect(looksLikePromise(null)).toBe(false);
  });
});

describe("海内对话 prompt 按阶段与进度组装", () => {
  const S = NNPC_STAGE;
  it("SPIRIT：明确尚能克制、不许主动提往事", () => {
    const p = seaDialoguePrompt({ stage: S.SPIRIT, comfort: emptyComfort(), spokenKeys: [], STAGES: S });
    expect(p).toContain("尚能克制");
    expect(p).toContain("不会主动提起任何具体的往事");
  });
  it("SEA_CRASHED level5：几乎不回应、不许被碰", () => {
    const p = seaDialoguePrompt({ stage: S.SEA_CRASHED, comfort: emptyComfort(), spokenKeys: [], STAGES: S });
    expect(p).toContain("几乎不回应");
    expect(p).toContain("绝不允许他碰你");
  });
  it("只注入当前那一条心结的 guide，不泄露后面的", () => {
    const c = C({ verbal: 2 });
    const p = seaDialoguePrompt({ stage: S.SEA_CRASHED, comfort: c, spokenKeys: [], STAGES: S });
    expect(p).toContain("他没有回头");
    expect(p).not.toContain("布偶");       // 第三条不该提前出现
  });
  it("已说出的不再重复讲", () => {
    const c = C({ verbal: 4, hug: 2 });
    const p = seaDialoguePrompt({ stage: S.SEA_CRASHED, comfort: c, spokenKeys: ["hebe"], STAGES: S });
    expect(p).toContain("不要重复讲一遍");
  });
  it("三条说尽 → 转成等玩家点破内核", () => {
    const c = C({ verbal: 4, hug: 4 });
    const p = seaDialoguePrompt({ stage: S.SEA_CRASHED, comfort: c, spokenKeys: ["hebe", "corner", "doll"], STAGES: S });
    expect(p).toContain("三条都说尽了");
    expect(p).toContain("你自己说不出口的那句");
  });
  it("全程铁律：三条说尽前不许出现和解/想通", () => {
    const p = seaDialoguePrompt({ stage: S.SEA_CRASHED, comfort: C({ verbal: 2 }), spokenKeys: [], STAGES: S });
    expect(p).toContain("绝不出现任何和解、想通、放下");
  });
  it("统一禁用心理学词汇（她是说书人，没这套词）", () => {
    for (const st of [S.SPIRIT, S.SEA_CRASHED]) {
      const p = seaDialoguePrompt({ stage: st, comfort: emptyComfort(), spokenKeys: [], STAGES: S });
      expect(p).toContain("你没有这套词汇");
    }
  });
});

describe("主叙事文风随 stage 短路（这条线的支点）", () => {
  it("入海后无条件退回第一档，且明令不许替她说话", () => {
    for (const st of [NNPC_STAGE.SPIRIT, NNPC_STAGE.SEA_CRASHED]) {
      const v = narratorVoicePrompt({ affection: 95, stage: st });
      expect(v).toContain("不在旁白的位子上");
      expect(v).toContain("不要替她说话");
      expect(v).not.toContain("不要看我");   // 第五档的话不该出现
    }
  });
  it("好感 95 但人在海里 → 仍是冷的（不看好感度）", () => {
    const inSea = narratorVoicePrompt({ affection: 95, stage: NNPC_STAGE.SPIRIT });
    const normal = narratorVoicePrompt({ affection: 95, stage: NNPC_STAGE.FLIRTING });
    expect(inSea).not.toBe(normal);
    expect(normal).toContain("不要看我");
  });
  it("哄好后解锁第六档「合写的日记」——体裁变了，不只是语气变了", () => {
    const v = narratorVoicePrompt({ affection: 95, stage: NNPC_STAGE.RESOLVED });
    expect(v).toContain("你们两个人合写的一本日记");
    expect(v).toContain("本女侠");
    expect(v).toContain("这笨蛋");
    expect(v).toContain("撒娇不是防御");
    // 日记也得把事记清楚——不能因为体裁松了就漏掉该交代的
    expect(v).toContain("一样不能少");
  });
  it("isInSea 只认那两个阶段", () => {
    expect(isInSea(NNPC_STAGE.SPIRIT)).toBe(true);
    expect(isInSea(NNPC_STAGE.SEA_CRASHED)).toBe(true);
    for (const st of [NNPC_STAGE.FLIRTING, NNPC_STAGE.RESOLVED, NNPC_STAGE.CRASHED, NNPC_STAGE.NORMAL]) {
      expect(isInSea(st)).toBe(false);
    }
  });
});

describe("手工剧情三段", () => {
  it("抵达：她背对着你、不回头，且给出去别墅的指路", () => {
    const all = SCENE_ARRIVE.map(l => l.text).join("\n");
    expect(all).toContain("没有回头");
    expect(all).toContain("白房子");
  });
  it("别墅：四条创伤意象都埋了，收在「不要看我」", () => {
    const all = SCENE_VILLA.map(l => l.text).join("\n");
    expect(all).toContain("他没有回头");
    expect(all).toContain("布偶");
    expect(all).toContain("墙角");
    expect(all).toContain("我是最厉害的");
    expect(SCENE_VILLA[SCENE_VILLA.length - 3].text).toContain("不要看我");
  });
  it("别墅：告诉玩家药和吃的在哪（否则那两个按钮永远缺物）", () => {
    const all = SCENE_VILLA.map(l => l.text).join("\n");
    expect(all).toContain("药柜");
    expect(all).toContain("厨房");
  });
  it("收束：她自己说出那层意思 + 旧疤 + Wunderbar", () => {
    const all = SCENE_RESOLVE.map(l => l.text).join("\n");
    expect(all).toContain("我不用最厉害");
    expect(all).toContain("旧疤");
    expect(all).toContain("Wunderbar");
  });
  it("三段都用 narrator 类型给她的台词上色", () => {
    for (const sc of [SCENE_ARRIVE, SCENE_VILLA, SCENE_RESOLVE]) {
      expect(sc.some(l => l.t === "narrator")).toBe(true);
    }
  });
});

describe("MVU 变量", () => {
  it("新档带 comfort/knots/traumaResolved/villaEntered", () => {
    const v = initialNarratorVars();
    expect(v.comfort).toEqual(emptyComfort());
    expect(v.knots).toEqual([]);
    expect(v.traumaResolved).toBe(false);
    expect(v.villaEntered).toBe(false);
  });
});

// ── 终章 ────────────────────────────────────────────────────────────────
import { SCENE_PORTAL_OPEN, SCENE_TOKYO, SCENE_RETURN } from "./narratorQuest.js";
import {
  createAsuka, unlockAsuka, initCompanionState, unlockSnowLeopard,
  activeCompanionKey, setActiveCompanion, unlockedCompanions,
  isSnowLeopardAvailable, isAsukaAvailable, COMPANION_SLOTS,
} from "./companion.js";

describe("终章·三段剧情", () => {
  it("传送门：她不想一个人看", () => {
    const all = SCENE_PORTAL_OPEN.map(l => l.text).join("\n");
    expect(all).toContain("裂缝");
    expect(all).toContain("不太想一个人看");
  });
  it("东京：见证「有人在住」，收在おめでとう与気持ち悪い", () => {
    const all = SCENE_TOKYO.map(l => l.text).join("\n");
    expect(all).toContain("有人在住");
    expect(all).toContain("おめでとう");
    expect(all).toContain("気持ち悪い");
    expect(all).toContain("没有雪");          // 与曲措乡的雪域对照
    expect(all).toContain("笨蛋");            // 收尾那句为第六档的口吻埋线
  });
  it("回屋：带上真实屋名，且告知可换队友", () => {
    const all = SCENE_RETURN("溪边小屋").map(l => l.text).join("\n");
    expect(all).toContain("溪边小屋");
    expect(all).toContain("换");
    expect(all).toContain("合写");
  });
});

describe("明日香入队 · 单槽互斥", () => {
  it("红档、四招齐、带 carry", () => {
    const a = createAsuka();
    expect(a.levelCap).toBe(5);
    expect(a.moveset).toHaveLength(4);
    expect(a.moveset.map(m => m.name)).toContain("朗基努斯之枪·贯穿");
    expect(a.moveset.map(m => m.name)).toContain("A.T.フィールド·心之壁");
    expect(a.carry.length).toBeGreaterThan(0);
    expect(a.carry.map(i => i.name)).toContain("朗基努斯");
    expect(a.beast).toBe(false);
  });

  it("四槽各司其职（攻/防/两个状态），不是四个攻击", () => {
    const types = createAsuka().moveset.map(m => m.type);
    expect(types).toContain("攻击");
    expect(types).toContain("防御");
  });

  it("入队即顶出战位，雪豹自动留守", () => {
    let cs = unlockSnowLeopard(initCompanionState());
    expect(activeCompanionKey(cs)).toBe("snowLeopard");
    cs = unlockAsuka(cs);
    expect(activeCompanionKey(cs)).toBe("asuka");
    expect(cs.snowLeopard.active).toBe(false);
  });

  it("同时只能一个出战（这是 2v2 引擎的硬约束）", () => {
    let cs = unlockAsuka(unlockSnowLeopard(initCompanionState()));
    for (const key of ["snowLeopard", "asuka", null]) {
      cs = setActiveCompanion(cs, key);
      expect(activeCompanionKey(cs)).toBe(key);
      const both = isSnowLeopardAvailable(cs) && isAsukaAvailable(cs);
      expect(both, "两个队友同时可用会让战斗行为未定义").toBe(false);
    }
  });

  it("换来换去不丢数据（unlocked 与 data 恒在）", () => {
    let cs = unlockAsuka(unlockSnowLeopard(initCompanionState()));
    cs = setActiveCompanion(cs, "snowLeopard");
    cs = setActiveCompanion(cs, "asuka");
    // 只断言这场解锁过的两个槽位（珍珠未解锁，不在此列）——切来切去 unlocked/data 不丢。
    for (const key of ["snowLeopard", "asuka"]) {
      expect(cs[key].unlocked).toBe(true);
      expect(cs[key].data).toBeTruthy();
    }
    expect(unlockedCompanions(cs).map(s => s.label)).toEqual(["雪豹", "明日香"]);
  });

  it("解锁幂等：重复调用不重新随机数值", () => {
    const cs1 = unlockAsuka(initCompanionState());
    const cs2 = unlockAsuka(cs1);
    expect(cs2.asuka.data).toBe(cs1.asuka.data);
  });

  it("只解锁了雪豹时 unlockedCompanions 不含明日香", () => {
    const cs = unlockSnowLeopard(initCompanionState());
    expect(unlockedCompanions(cs).map(s => s.key)).toEqual(["snowLeopard"]);
  });
});

// ── 0728 bug 修复的回归 ────────────────────────────────────────────────
import { needsMet } from "./narratorQuest.js";
import { migrateNarratorState } from "./narrator.js";
import { describeTallyForWhisper } from "./memory/tally.js";
import { emptyTally, tallyAdd } from "./memory/tally.js";

describe("修：光靠说话不能走完全程（否则五个安抚动作形同虚设）", () => {
  const C = (o) => ({ ...emptyComfort(), ...o });

  it("说话刷到 level0 也只开得了第一条", () => {
    const only = C({ verbal: 30 });
    expect(defenseLevelOf(only)).toBe(0);              // 心防确实到底了
    expect(availableKnot(only, []).key).toBe("hebe");  // 第一条开
    expect(availableKnot(only, ["hebe"])).toBeNull();  // 第二条不开——方式不对
  });

  it("第二条要她吃过东西或吃过药（药/食通算 soothing）", () => {
    const base = C({ verbal: 30 });
    expect(availableKnot({ ...base, food: 1 }, ["hebe"]).key).toBe("corner");
    expect(availableKnot({ ...base, medication: 1 }, ["hebe"]).key).toBe("corner");
  });

  it("第三条（母亲）必须抱过她——她凭什么跟你说这个", () => {
    const fed = C({ verbal: 30, food: 1 });
    expect(availableKnot(fed, ["hebe", "corner"])).toBeNull();
    expect(availableKnot({ ...fed, hug: 1 }, ["hebe", "corner"]).key).toBe("doll");
  });

  it("needs 只要最低限，不逼玩家凑数", () => {
    expect(needsMet({ verbal: 2 }, C({ verbal: 2 }))).toBe(true);
    expect(needsMet({ verbal: 2 }, C({ verbal: 1 }))).toBe(false);
    expect(needsMet(null, C({}))).toBe(true);
  });

  it("整条线仍然走得通（没把自己锁死）", () => {
    let c = C({}), knots = [], guard = 0;
    const inv = ["蛋糕", "抗焦虑药"];
    while (!canResolve(c, knots) && guard++ < 80) {
      const doable = Object.entries(COMFORT_ACTIONS)
        .filter(([k]) => canComfort(k, c, inv).ok)
        .sort((a, b) => b[1].weight - a[1].weight);
      const [key] = doable[0];
      c = { ...c, [key]: c[key] + 1 };
      const k = availableKnot(c, knots);
      if (k) knots.push(k.key);
    }
    expect(canResolve(c, knots)).toBe(true);
    expect(knots).toEqual(["hebe", "corner", "doll"]);
    expect(guard).toBeLessThan(80);
  });
});

describe("修：老档的旧 CRASHED 阶段会把文风永久锁在空壳里", () => {
  const S = NNPC_STAGE;
  it("未告白的归 FLIRTING，让好感度重新驱动文风", () => {
    expect(migrateNarratorState({ stage: S.CRASHED, affection: 95 }).stage).toBe(S.FLIRTING);
  });
  it("已告白的归 CHEAT 而不是死在 CRASHED", () => {
    expect(migrateNarratorState({ stage: S.CRASHED, affection: 95, confessed: true }).stage).toBe(S.CHEAT);
  });
  it("创伤线中的档一律不动", () => {
    for (const st of [S.SPIRIT, S.SEA_CRASHED, S.RESOLVED]) {
      expect(migrateNarratorState({ stage: st, affection: 95 }).stage).toBe(st);
    }
  });
  it("空/脏档给初始态不炸", () => {
    expect(migrateNarratorState(null).stage).toBe(S.NORMAL);
    expect(migrateNarratorState("abc").stage).toBe(S.NORMAL);
  });
  it("归一后第五档文风回来了（此前会被 CRASHED 分支截住）", () => {
    const m = migrateNarratorState({ stage: S.CRASHED, affection: 95 });
    expect(narratorVoicePrompt(m)).toContain("不要看我");
  });
});

describe("起居注进私聊", () => {
  const t = (() => {
    let x = emptyTally();
    for (let i = 0; i < 4; i++) x = tallyAdd(x, "innerMove", 5);
    return x;
  })();
  it("默认只给今日，不给累计", () => {
    const s = describeTallyForWhisper(t, 5);
    expect(s).toContain("今日行迹");
    expect(s).not.toContain("累计行迹");
  });
  it("第六档才给累计（那时账本是她在记）", () => {
    expect(describeTallyForWhisper(t, 5, { includeLifetime: true })).toContain("累计行迹");
  });
  it("交代用法：可自然提起但不要生硬报数", () => {
    expect(describeTallyForWhisper(t, 5)).toContain("不要生硬报数");
  });
  it("什么都没干时给空串，不注入噪音", () => {
    expect(describeTallyForWhisper(emptyTally(), 5)).toBe("");
  });
});

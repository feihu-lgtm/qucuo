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
    const deep = C({ verbal: 6, hug: 3, kiss: 3 }); // level 0
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
  it("哄好后解锁第六档「不装了」", () => {
    const v = narratorVoicePrompt({ affection: 95, stage: NNPC_STAGE.RESOLVED });
    expect(v).toContain("她不再装了");
    expect(v).toContain("撒娇，不是防御");
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

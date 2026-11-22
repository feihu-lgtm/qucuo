import { describe, expect, it } from "vitest";
import { breakthroughSkill, meditate, trainCost, trainNeigong, trainWaigong } from "./logic.js";

const makeState = (overrides = {}) => ({
  char: {
    name: "少侠",
    neigong: 5,
    waigong: 5,
    special: { 体魄: 5 },
    hp: [50, 116],
    ...(overrides.char || {}),
  },
  skills: [],
  pot: 10,
  time: 6,
  ...overrides,
});

describe("cultivation logic", () => {
  it("calculates increasing training costs", () => {
    expect([trainCost(0), trainCost(9), trainCost(10)]).toEqual([4, 4, 5]);
  });

  it("meditates and restores health up to the effective cap", () => {
    expect(meditate(makeState())).toEqual({
      changes: { char: { ...makeState().char, hp: [67, 116] }, time: 7 },
      logs: [
        { t: "cmd", text: "> 打坐运功" },
        { t: "desc", text: "  你盘膝调息，气血回转了些。" },
        { t: "stat", text: "  气血 50→67" },
      ],
      note: { text: "打坐调息一回，气血回转了些。", source: "dumb" },
    });
  });

  it("does not meditate beyond the effective health cap", () => {
    const state = makeState({ char: { hp: [116, 116] } });
    expect(meditate(state).changes.char.hp).toEqual([116, 116]);
  });

  it("trains neigong, increases the health cap, and records its fact", () => {
    const result = trainNeigong(makeState());
    expect(result.changes).toEqual({
      pot: 6,
      char: { ...makeState().char, neigong: 6, hp: [54, 120] },
      time: 8,
    });
    expect(result.logs.map((entry) => entry.text)).toEqual([
      "> 运气打坐（练内功）",
      "  你盘膝运气，内息缓缓精进了一分。",
      "  内功 5→6（花费4潜能）· 气血上限 116→120",
    ]);
    expect(result.fact).toEqual({
      id: "train_neigong_6_6",
      摘要: "少侠运气打坐，内功精进一分（5→6）。",
      标签: "修炼",
      知晓者: [],
      currentTurn: 6,
    });
    expect(result.note).toEqual({ text: "运气打坐，内功精进一分。", source: "dumb" });
  });

  it("refuses capped and underfunded neigong training without changes", () => {
    expect(trainNeigong(makeState({ char: { neigong: 100 } }))).toEqual({
      logs: [{ t: "sys", text: "  内功已至大成，再无寸进之地（100/100）" }],
    });
    expect(trainNeigong(makeState({ pot: 3 }))).toEqual({
      logs: [{ t: "err", text: "  潜能不足，运气尚需4点潜能（现有3）" }],
    });
  });

  it("trains waigong and records its fact", () => {
    const result = trainWaigong(makeState());
    expect(result.changes).toEqual({
      pot: 6,
      char: { ...makeState().char, waigong: 6 },
      time: 8,
    });
    expect(result.logs.map((entry) => entry.text)).toEqual([
      "> 拆招练武（练外功）",
      "  你反复拆解招式，外家功夫扎实了一分。",
      "  外功 5→6（花费4潜能）",
    ]);
    expect(result.fact).toEqual({
      id: "train_waigong_6_6",
      摘要: "少侠拆招练武，外功扎实一分（5→6）。",
      标签: "修炼",
      知晓者: [],
      currentTurn: 6,
    });
  });

  it("refuses capped and underfunded waigong training without changes", () => {
    expect(trainWaigong(makeState({ char: { waigong: 100 } }))).toEqual({
      logs: [{ t: "sys", text: "  外功已至大成，再无寸进之地（100/100）" }],
    });
    expect(trainWaigong(makeState({ pot: 3 }))).toEqual({
      logs: [{ t: "err", text: "  潜能不足，拆招尚需4点潜能（现有3）" }],
    });
  });

  it("breaks a skill through to the next stage", () => {
    const state = makeState({
      pot: 20,
      skills: [{ id: "starter", name: "三脚猫拳法", stage: "入门" }],
    });
    const result = breakthroughSkill(state, "starter");
    expect(result.changes).toEqual({
      pot: 8,
      skills: [{ id: "starter", name: "三脚猫拳法", stage: "小成" }],
      time: 8,
    });
    expect(result.logs.map((entry) => entry.text)).toEqual([
      "> 潜心修炼「三脚猫拳法」",
      "  日夜揣摩，三脚猫拳法的火候更进一层。",
      "  三脚猫拳法 入门→小成（花费12潜能）· 招式威力、品阶随之精进",
    ]);
    expect(result.note).toEqual({ text: "潜心修炼三脚猫拳法，突破至小成。", source: "dumb" });
  });

  it("resolves id-less skills by name without upgrading another id-less skill", () => {
    const state = makeState({
      pot: 20,
      skills: [
        { name: "甲拳", stage: "入门" },
        { name: "乙拳", stage: "入门" },
      ],
    });
    expect(breakthroughSkill(state, "乙拳").changes).toEqual({
      pot: 8,
      skills: [
        { name: "甲拳", stage: "入门" },
        { name: "乙拳", stage: "小成" },
      ],
      time: 8,
    });
  });

  it("refuses unknown, fixed, maxed, and underfunded skill breakthroughs", () => {
    expect(breakthroughSkill(makeState(), "missing")).toEqual({ logs: [] });
    expect(breakthroughSkill(makeState({
      skills: [{ id: "fixed", name: "绝学", fixed: true, stage: "入门" }],
    }), "fixed")).toEqual({ logs: [{ t: "sys", text: "  绝学是授业绝学，学即完整，无需修炼。" }] });
    expect(breakthroughSkill(makeState({
      skills: [{ id: "maxed", name: "拳法", stage: "登峰造极" }],
    }), "maxed")).toEqual({ logs: [{ t: "sys", text: "  拳法已臻登峰造极，登峰造极，再无寸进。" }] });
    expect(breakthroughSkill(makeState({
      skills: [{ id: "invalid", name: "拳法", stage: "失传" }],
    }), "invalid")).toEqual({ logs: [{ t: "sys", text: "  拳法已臻失传，登峰造极，再无寸进。" }] });
    expect(breakthroughSkill(makeState({
      pot: 11,
      skills: [{ id: "starter", name: "三脚猫拳法", stage: "入门" }],
    }), "starter")).toEqual({
      logs: [{ t: "err", text: "  潜能不足，三脚猫拳法突破小成需12点潜能（现有11）" }],
    });
  });

  it("blocks breakthrough of high-tier sect skills after defection while keeping low-tier skills open", () => {
    const locked = breakthroughSkill(makeState({
      pot: 30,
      flags: ["叛出:青城派"],
      skills: [{ id: "kf_ziyang", name: "紫阳神功", stage: "入门" }],
    }), "kf_ziyang");
    expect(locked.changes).toBeUndefined();
    expect(locked.logs[0].text).toContain("叛出青城派");

    const allowed = breakthroughSkill(makeState({
      pot: 30,
      flags: ["叛出:青城派"],
      skills: [{ id: "kf_qingchengjian", name: "青城剑法", stage: "入门" }],
    }), "kf_qingchengjian");
    expect(allowed.changes.skills[0].stage).toBe("小成");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildJudgeRuleBlock, buildGroupTalkRuleBlock, parseGroupTalkSeal,
  renderReactionGuides, renderWarrantAffixWhitelists,
} from "./judgeRuleBlock.js";

const verdict = {
  causalTier: "T1", pacingWords: 300,
  facts: [{ id: "F5_1", op: "MOOD_SHIFT", npc: "才旦", detail: "不悦" }],
  warrants: [
    { factId: "F5_2", warrantId: "W5_1", op: "GRANT_ITEM", quality: "绿", category: "misc", conditional: true, pointBudget: 2, allowedAffixes: ["锋利", "淬毒"] },
  ],
  notes: [],
  budget: { maxQuality: "蓝", maxPointBudget: 3, remainingDailyQuota: 2 },
  reactionGuides: [
    { npc: "才旦", knownRefIds: [], unknownRefIds: ["E1"], guidance: "才旦不知晓E1内情，只能按话语表面反应，禁写出知情暗示" },
    { npc: "八云", knownRefIds: ["E1"], unknownRefIds: [], guidance: "" },
  ],
};

describe("WO-16H-H1 判官铁律块（roadmap 精确关键句）", () => {
  const block = buildJudgeRuleBlock({ judgeVerdict: verdict, playerName: "少侠" });

  it("含锚点/分寸/条件券/尾章四节与判官定案首句", () => {
    expect(block).toContain("【判官定案】系统已经裁定了本轮发生的事。你只管把它讲出来，并在尾章替空白券填上名字。");
    expect(block).toContain("一、锚点。正文每写实一条事实，就在写实的那一句末尾紧跟它的锚点，比如 ⟦F12_1⟧");
    expect(block).toContain("二、分寸。判官没有签发的东西，不许写成真的");
    expect(block).toContain("三、条件券。标着「条件拾取券」的东西");
    expect(block).toContain("四、尾章。正文写完，另起一行写 ---SEAL---，再起一行写一行 JSON，不加代码围栏：");
  });

  it("SEAL 五行 JSON 全键契约原样", () => {
    expect(block).toContain('{"fills":{},"respondedNpcs":[],"spontaneousPact":null,"mentionedNewNpcs":[],"emergedNpc":null}');
    expect(block).toContain("mentionedNewNpcs：正文里新提到、此前没出现过的具名人物");
    expect(block).toContain("emergedNpc：玩家明确在找的传闻人物");
  });

  it("渲染定案单/授信/反应导引与玩家名", () => {
    expect(block).toContain("⟦F5_1⟧MOOD_SHIFT");
    expect(block).toContain("本拍授信：品阶上限蓝");
    expect(block).toContain("才旦不知晓E1内情");
    expect(block).not.toContain("八云不知晓");
    expect(block).toContain("回应 少侠 的在场者");
  });

  it("天机券词条白名单逐券渲染", () => {
    expect(block).toContain("⟦W5_1⟧ 允许词条：锋利、淬毒");
  });

  it("空词条渲染无（0 点白板）", () => {
    expect(renderWarrantAffixWhitelists([{ warrantId: "W9_9", allowedAffixes: [] }])).toBe("  ⟦W9_9⟧ 允许词条：无（0 点白板）");
  });

  it("默认禁止自发立约；verdict 允许时给出 pact 形状", () => {
    expect(block).toContain("本轮不允许自发立约，填 null。");
    const allowed = buildJudgeRuleBlock({ judgeVerdict: { ...verdict, allowSpontaneousPact: true }, playerName: "少侠" });
    expect(allowed).toContain("本轮允许自发立约");
    expect(allowed).toContain('"deadlineHours":24');
  });

  it("空 verdict 返空串不崩", () => {
    expect(buildJudgeRuleBlock({ judgeVerdict: null })).toBe("");
  });
});

describe("WO-16H-H1 群聊尾章块", () => {
  it("roadmap 原文关键句", () => {
    const block = buildGroupTalkRuleBlock("少侠");
    expect(block).toContain("【群聊回响】这一轮是好几个人同在场的对话。你不改变任何游戏状态，只写对白、神态和心思。");
    expect(block).toContain('{"respondedNpcs":["本轮真正开口或直接回应 少侠 的在场者"]}');
    expect(block).toContain("旁观、路过、只被提到的不列；没人回应就给 []");
  });
});

describe("parseGroupTalkSeal 在场白名单过滤", () => {
  const present = ["才旦", "八云", "雪豹"];

  it("在场者保留、越界名字丢弃进 dropped", () => {
    const r = parseGroupTalkSeal('{"respondedNpcs":["才旦","路人甲","八云"]}', present);
    expect(r.respondedNpcs).toEqual(["才旦", "八云"]);
    expect(r.dropped).toEqual(["路人甲"]);
  });

  it("空数组/缺键/空串均安全", () => {
    expect(parseGroupTalkSeal('{"respondedNpcs":[]}', present).respondedNpcs).toEqual([]);
    expect(parseGroupTalkSeal("{}", present).respondedNpcs).toEqual([]);
    expect(parseGroupTalkSeal("", present).respondedNpcs).toEqual([]);
    expect(parseGroupTalkSeal(null, present).respondedNpcs).toEqual([]);
  });

  it("malformed JSON 不崩；夹杂废话时抠第一段 JSON", () => {
    expect(parseGroupTalkSeal("not json at all", present).respondedNpcs).toEqual([]);
    const r = parseGroupTalkSeal('尾注 {"respondedNpcs":["雪豹"]} 完', present);
    expect(r.respondedNpcs).toEqual(["雪豹"]);
  });

  it("非字符串项与空名忽略；兽类在场白名单内算数", () => {
    const r = parseGroupTalkSeal('{"respondedNpcs":["雪豹",42,"","才旦"]}', present);
    expect(r.respondedNpcs).toEqual(["雪豹", "才旦"]);
  });

  it("白名单为空时全部丢弃", () => {
    const r = parseGroupTalkSeal('{"respondedNpcs":["才旦"]}', []);
    expect(r.respondedNpcs).toEqual([]);
    expect(r.dropped).toEqual(["才旦"]);
  });
});

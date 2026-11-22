import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";

const find = (id) => QUCUO_QUESTS.find((quest) => quest.id === id);
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));
const favor = (v) => ({ 角色: { 柳青鸢: { 好感度: v } }, 世界: { 势力声誉: { 锦官城: 50 } } });

// 官1 五段全走完 + 官2 选了 A 线后，官1 各段完成旗 + 两个 lore 旗 + 玉佩旗都该齐。
const GUAN1_FLAGS = ["quest_guan1_s1", "quest_guan1_s2", "quest_guan1_s3", "quest_guan1_s4", "quest_guan1_s5_expose", "lore_dushi_anxixiang_caigou", "promise_liu_qingyuan_wenquan", "guan_cases_cleared"];

describe("锦官城官 2-A/2-B 前置门槛", () => {
  const guan2a = find("jinguancheng_guan2a_toukao");
  const guan2b = find("jinguancheng_guan2b_zhongli");
  const progress = done("jinguancheng_guan1_xinren", "jinguancheng_guan2_guitu");

  it("官 2-A 要官 2 选了 A 线 + 有利旗 ≥2 + 柳青鸢好感 ≥50", () => {
    expect(isQuestGateOpen(guan2a, progress, [...GUAN1_FLAGS], favor(60))).toBe(false); // 没选 A 线
    expect(isQuestGateOpen(guan2a, progress, [...GUAN1_FLAGS, "quest_guan2_a"], favor(60))).toBe(true);
    expect(isQuestGateOpen(guan2a, progress, [...GUAN1_FLAGS, "quest_guan2_a"], favor(49))).toBe(false); // 好感不足
    expect(isQuestGateOpen(guan2a, progress, ["quest_guan1_s1", "quest_guan2_a"], favor(60))).toBe(false); // 有利旗不足两项
    expect(isQuestGateOpen(guan2a, progress, ["quest_guan1_s1", "quest_guan1_s3", "quest_guan2_a"], favor(60))).toBe(true);
  });

  it("官 2-B 要官 2 选了 B 线 + 熊曲温泉之物 + 证物 ≥2", () => {
    expect(isQuestGateOpen(guan2b, progress, [...GUAN1_FLAGS, "quest_guan2_b"], favor(60))).toBe(false); // 缺温泉线索
    expect(isQuestGateOpen(guan2b, progress, [...GUAN1_FLAGS, "quest_guan2_b", "clue_xionggu_wenquan_zhiwu"], favor(60))).toBe(true);
    // 证物只持一项也不开
    const oneEvidence = ["quest_guan1_s2", "quest_guan1_s4", "quest_guan1_s5_report", "quest_guan2_b", "clue_xionggu_wenquan_zhiwu"];
    expect(isQuestGateOpen(guan2b, progress, ["lore_dushi_anxixiang_caigou", ...oneEvidence], favor(60))).toBe(false);
    expect(isQuestGateOpen(guan2b, progress, ["lore_dushi_anxixiang_caigou", "quest_guan1_s3", ...oneEvidence], favor(60))).toBe(true);
  });

  it("一边走完另一边锁死", () => {
    expect(isQuestGateOpen(guan2a, progress, [...GUAN1_FLAGS, "quest_guan2_a", "quest_guan2b_s1"], favor(60))).toBe(false);
    expect(isQuestGateOpen(guan2b, progress, [...GUAN1_FLAGS, "quest_guan2_b", "clue_xionggu_wenquan_zhiwu", "quest_guan2a_s1"], favor(60))).toBe(false);
  });

  it("村 5 末段发放「熊曲温泉之物」旗", () => {
    const v5 = find("village5_laolieshu_chuanren");
    const s3 = v5.stages.find((s) => s.id === "s3_report");
    expect(s3.onReach.flags).toContain("clue_xionggu_wenquan_zhiwu");
  });
});

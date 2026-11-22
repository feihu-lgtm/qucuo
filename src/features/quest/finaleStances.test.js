import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { isQuestChoiceOpen } from "../../domain/rules/quests/questEngine.js";
import { FINALE_ENDINGS, resolveEnding } from "../../domain/rules/quests/endingResolver.js";
import { FINALE_HOSTS, finaleHostFlags, resolveFinaleStances } from "../../domain/rules/quests/finaleStances.js";
import { questFlagRule } from "../../domain/rules/quests/rules.js";

const stanceOf = (flags) => Object.fromEntries(resolveFinaleStances(flags).map((s) => [s.key, s.stance]));
const quest = (id) => QUCUO_QUESTS.find((q) => q.id === id);
const emitted = new Set();
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "flags" && Array.isArray(x)) x.forEach((f) => emitted.add(f));
      if ((k === "flag" || k === "completionFlag") && typeof x === "string") emitted.add(x);
      if (k === "completionFlag" && Array.isArray(x)) x.forEach((f) => emitted.add(f));
      walk(x);
    }
  }
};
walk(QUCUO_QUESTS);

describe("终局八主立场", () => {
  it("立场表读的 flag 都有任务真的写", () => {
    for (const host of FINALE_HOSTS) for (const f of finaleHostFlags(host)) expect(emitted.has(f), `${host.faction}:${f}`).toBe(true);
  });

  it("没处理：鱼定村/玉泉寨/黑风寨/雪山派按合稿中立，其余按总纲倒向土司", () => {
    expect(stanceOf([])).toEqual({ yuding: "neutral", yuquan: "neutral", heifeng: "neutral", xueshan: "neutral", lama: "enemy", baihua: "enemy", huanxi: "enemy", jinguan: "enemy" });
  });

  it("最终任务 flag 拉拢，守中分支或说服中立记中立，管家线记敌对", () => {
    const s = stanceOf(["lama_endgame_ally", "finale_neutral_baihua", "ending_huanxi_guanjia", "faction_jinguancheng_neutral", "xueshan_endgame_lone"]);
    expect(s).toMatchObject({ lama: "ally", baihua: "neutral", huanxi: "enemy", jinguan: "neutral", xueshan: "neutral" });
  });
});

describe("终局结局集", () => {
  const won = (...f) => ({ flags: ["tusi_finale_won", ...f], char: {} });
  it("府5 没打完不判", () => {
    expect(resolveEnding({ flags: ["tusi_meiduo_regency"] }, FINALE_ENDINGS)).toBeNull();
  });
  it("黑旗 > 新税网 > 梅朵代管 > 格桑暂守", () => {
    expect(resolveEnding(won("tusi_black_flag_rule", "quest_guan2a_s1"), FINALE_ENDINGS)).toBe("黑旗入曲措");
    expect(resolveEnding(won("quest_guan2a_s1", "tusi_meiduo_regency"), FINALE_ENDINGS)).toBe("落入新税网");
    expect(resolveEnding(won("tusi_meiduo_regency"), FINALE_ENDINGS)).toBe("梅朵代管");
    expect(resolveEnding(won("quest_ts5_settle"), FINALE_ENDINGS)).toBe("格桑暂守");
  });
  it("府5 胜后一次性写结局与各家立场 flag", () => {
    const flags = ["tusi_finale_won", "tusi_meiduo_regency", "finale_baihua_joined"];
    const out = questFlagRule.run({ flags, questProgress: {} }, { getNow: () => 0 });
    const next = out.changes.flags(flags);
    expect(next).toEqual(expect.arrayContaining(["story_ending_梅朵代管", "finale_stance_baihua_ally", "finale_stance_lama_enemy", "finale_stance_yuding_neutral"]));
    expect(out.logs.some((l) => l.text.includes("梅朵代管"))).toBe(true);
    const again = questFlagRule.run({ flags: next, questProgress: {} }, { getNow: () => 0 });
    expect(again?.logs?.some((l) => l.text.includes("结局已判定")) ?? false).toBe(false);
  });
});

describe("终局说服中立", () => {
  const ids = { xueshan: "雪山派", lama: "喇嘛庙", baihua: "百花门", huanxi: "欢喜教" };
  it("四家：府4 后、声誉 15 开，该家已有终局结果或府5 打完就不开", () => {
    for (const [key, faction] of Object.entries(ids)) {
      const q = quest(`finale_neutral_${key}`);
      const host = FINALE_HOSTS.find((h) => h.key === key);
      expect(q.requiresQuestCompleted).toBe("yudingtusi_4_gushu_wenxin");
      expect(q.requiresFactionRep).toEqual({ [faction]: 15 });
      expect(q.blockedByFlags).toContain("tusi_finale_won");
      for (const f of finaleHostFlags(host).filter((f) => f !== `finale_neutral_${key}`)) expect(q.blockedByFlags).toContain(f);
      const choice = q.stages[0].choices[0];
      expect(choice.resolve).toBe("talk");
      expect(choice.persuade.keys.length).toBeGreaterThan(0);
      expect(host.neutral).toContain(choice.flag);
    }
  });
});

describe("府5 百花门反噬", () => {
  const stage = quest("yudingtusi_5_dou_dizhu").stages.find((s) => s.id === "baihua");
  const open = (flags) => stage.choices.filter((c) => isQuestChoiceOpen(c, { flags, varTree: {} })).map((c) => c.flag);
  it("没拉拢也没说服中立就要打迷烟毒阵，档位 4", () => {
    expect(open([])).toEqual(["quest_ts5_baihua"]);
    expect(stage.choices[1].combatNpc.levelCap).toBe(4);
  });
  it("拉拢、退银守中、说服中立都免掉", () => {
    for (const f of ["finale_baihua_joined", "bh5_neutral", "finale_neutral_baihua"]) expect(open([f])).toEqual(["quest_ts5_baihua_none"]);
  });
});

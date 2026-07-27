import { describe, it, expect } from "vitest";
import { AFFECTION_TIERS, affectionTier, affectionLabel, narratorVoicePrompt, DEFAULT_WHISPER_WORDS, NNPC_STAGE } from "./narrator.js";
import { narratorPortraitUrl, narratorPortraitLabel } from "./portraits.js";

// 旁白的好感度五档现在是一条梯子驱动五样东西：文风、隐喻立绘、私聊字数、
// 分档攻略、UI 标签。此前分界线在两处各写了一遍（AFFECTION_TIERS 一份、
// narratorVoicePrompt 里的 if(affection<20/45/70/90) 又一份），改一处漏一处，
// 正是 AFFECTION_TIERS 自己注释里警告过的事。这套测试钉死"只有一条梯子"。

const BOUNDARIES = [0, 20, 45, 70, 90];

describe("五档梯子本身", () => {
  it("分界线就是 0/20/45/70/90，五档不多不少", () => {
    expect(AFFECTION_TIERS.map(t => t.min)).toEqual(BOUNDARIES);
  });

  it("每档都配齐了 立绘/字数/标签", () => {
    for (const t of AFFECTION_TIERS) {
      expect(t.portrait, `${t.key} 缺 portrait`).toBeTruthy();
      expect(t.portraitLabel, `${t.key} 缺 portraitLabel`).toBeTruthy();
      expect(t.words).toBeGreaterThan(0);
      expect(t.label).toBeTruthy();
    }
  });

  it("五张立绘文件名互不重复", () => {
    const files = AFFECTION_TIERS.map(t => t.portrait);
    expect(new Set(files).size).toBe(5);
  });

  it("字数随好感递增（越熟越愿意多说）", () => {
    const w = AFFECTION_TIERS.map(t => t.words);
    expect(w).toEqual([...w].sort((a, b) => a - b));
  });
});

describe("边界值：每个分界点上下各落对档", () => {
  it.each([
    [0, "cold"], [19, "cold"],
    [20, "faint"], [44, "faint"],
    [45, "chat"], [69, "chat"],
    [70, "flirt"], [89, "flirt"],
    [90, "awake"], [100, "awake"],
  ])("好感 %i → %s 档", (aff, key) => {
    expect(affectionTier(aff).key).toBe(key);
  });

  it("脏数据不炸，一律落回最低档", () => {
    for (const bad of [null, undefined, NaN, "abc", -50]) {
      expect(affectionTier(bad).key).toBe("cold");
    }
  });
});

describe("立绘跟着同一条梯子切", () => {
  it.each([
    [0, "tier1.png"], [19, "tier1.png"],
    [20, "tier2.png"], [44, "tier2.png"],
    [45, "tier3.png"], [69, "tier3.png"],
    [70, "tier4.png"], [89, "tier4.png"],
    [90, "true.png"], [100, "true.png"],
  ])("好感 %i → %s", (aff, file) => {
    expect(narratorPortraitUrl(aff)).toContain(`portraits/narrator/${file}`);
  });

  it("真容锁在 90，89 时还看不到", () => {
    expect(narratorPortraitUrl(89)).not.toContain("true.png");
    expect(narratorPortraitUrl(90)).toContain("true.png");
  });

  it("形态名跟着切", () => {
    expect(narratorPortraitLabel(0)).toBe("声之涟漪");
    expect(narratorPortraitLabel(90)).toBe("真容");
  });
});

describe("文风跟着同一条梯子切", () => {
  it("每档吐出的文风互不相同", () => {
    const tones = BOUNDARIES.map(a => narratorVoicePrompt({ affection: a, stage: NNPC_STAGE.FLIRTING }));
    expect(new Set(tones).size).toBe(5);
  });

  it("第一档保留「该不该打断」的行为规则（这是游戏逻辑不是文风修辞）", () => {
    const v = narratorVoicePrompt({ affection: 0, stage: NNPC_STAGE.FLIRTING });
    expect(v).toContain("该打断");
    expect(v).toContain("不该打断");
    expect(v).toContain("刷新一个npc");
  });

  it("弧光递进：松动档冒德语、将醒档困惑于机甲、临界档说梦", () => {
    expect(narratorVoicePrompt({ affection: 45, stage: NNPC_STAGE.FLIRTING })).toContain("Wunderbar");
    expect(narratorVoicePrompt({ affection: 70, stage: NNPC_STAGE.FLIRTING })).toContain("第三新东京市");
    expect(narratorVoicePrompt({ affection: 90, stage: NNPC_STAGE.FLIRTING })).toContain("不要看我");
  });

  it("低档不该提前泄露高档的伏笔", () => {
    const cold = narratorVoicePrompt({ affection: 0, stage: NNPC_STAGE.FLIRTING });
    expect(cold).not.toContain("Wunderbar");
    expect(cold).not.toContain("第三新东京市");
  });

  it("CRASHED/CHEAT 阶段走各自分支，不受好感度档位影响", () => {
    const crashed = narratorVoicePrompt({ affection: 90, stage: NNPC_STAGE.CRASHED });
    expect(crashed).toContain("宕机");
    expect(crashed).not.toContain("不要看我");
  });
});

describe("字数表与标签仍从同一张表派生", () => {
  it("DEFAULT_WHISPER_WORDS 键与档位一一对应", () => {
    expect(Object.keys(DEFAULT_WHISPER_WORDS).sort()).toEqual(AFFECTION_TIERS.map(t => t.key).sort());
  });
  it("affectionLabel 走同一条梯子", () => {
    expect(affectionLabel(0)).toBe("冷漠疏离");
    expect(affectionLabel(90)).toBe("濒临觉醒");
  });
});

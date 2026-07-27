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
    [0, "tier1.webp"], [19, "tier1.webp"],
    [20, "tier2.webp"], [44, "tier2.webp"],
    [45, "tier3.webp"], [69, "tier3.webp"],
    [70, "tier4.webp"], [89, "tier4.webp"],
    [90, "true.webp"], [100, "true.webp"],
  ])("好感 %i → %s", (aff, file) => {
    expect(narratorPortraitUrl(aff)).toContain(`portraits/narrator/${file}`);
  });

  it("真容锁在 90，89 时还看不到", () => {
    expect(narratorPortraitUrl(89)).not.toContain("true.webp");
    expect(narratorPortraitUrl(90)).toContain("true.webp");
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

// ── 内置默认立绘的读取通路 ────────────────────────────────────────────
// 这一组钉的是一个曾经半途而废的重构：默认立绘从"异步写进 localStorage"改成
// "静态 import 打包"时，初始化的 useEffect 删掉了，但**读取侧一直没接上**——
// LeftPanel 与 PortraitManager 读的都是 portraits[name]（只含玩家上传的 state），
// DEFAULT_PORTRAITS 除注释外无人读取，getPortrait() 写好了却从未被调用。
// 结果内置的九张立绘全都打进产物、却一张都没显示过。
import { DEFAULT_PORTRAITS, resolvePortrait, hasBuiltinPortrait } from "./portraits.js";

describe("内置立绘必须真的能被读到", () => {
  it("玄女已进内置立绘表", () => {
    expect(DEFAULT_PORTRAITS["玄女"]).toBeTruthy();
    expect(hasBuiltinPortrait("玄女")).toBe(true);
  });

  it("原有几位仍在表里（别把人挤掉了）", () => {
    for (const n of ["梅朵", "呼延雪", "何雨谢", "才旦", "李若由", "卓玛", "兰姐", "罗琦", "嘎则"]) {
      expect(DEFAULT_PORTRAITS[n], `${n} 的内置立绘丢了`).toBeTruthy();
    }
  });

  it("玩家没传过 → 落到内置图", () => {
    expect(resolvePortrait({}, "玄女")).toBe(DEFAULT_PORTRAITS["玄女"]);
  });

  it("玩家传过 → 用玩家自己的，内置让位", () => {
    const mine = "data:image/png;base64,AAAA";
    expect(resolvePortrait({ 玄女: mine }, "玄女")).toBe(mine);
  });

  it("没有内置图又没传过 → null（UI 显示「点击上传」）", () => {
    expect(resolvePortrait({}, "路人甲")).toBeNull();
    expect(hasBuiltinPortrait("路人甲")).toBe(false);
  });

  it("脏输入不炸", () => {
    expect(resolvePortrait(null, "玄女")).toBe(DEFAULT_PORTRAITS["玄女"]);
    expect(resolvePortrait({}, "")).toBeNull();
    expect(resolvePortrait({}, undefined)).toBeNull();
  });
});

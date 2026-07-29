import { describe, it, expect } from "vitest";
import { sanitizeLore, LORE_MAX, buildStage2 } from "./scanPrompts.js";
import { matchNpcLore, buildNpcLoreBlock } from "../worldbook.js";

// 【这批守卫在防什么】入册的人设正文原本是把卡的原始正文整段沿用（stage2 的 schema
// 里压根没有 entry 这一项，AI 只换算了数值，正文没换算）。实测一张普通卡注入后长这样：
//   - 柳青梧（寻访旧案的青衫剑客）：## 基本信息
//   姓名：柳青梧　年龄：二十三
//   【外貌】身形清瘦…
//   【与{{user}}的关系】你替她挡了一句难听的话…
//   【NSFW】略。
//     外貌锚点：…
// markdown 标题、方括号小标题、未替换的占位符、第二人称、与外貌锚点重复的外貌描写
// 全都进了 prompt，且首行内部六个换行把「首行 + 缩进子行」这个结构冲散。
// 另一处：世界观条目（地理／势力）跟人物混在同一个注入块里，说书人会读到
// 「锦官城 是一个被提及但不在场的人物，不能让他开口说话」。

describe("人设正文清洗", () => {
  const opt = { playerName: "少侠", charName: "柳青梧" };

  it("占位符换成名字而不是删掉", () => {
    // 删掉会让句子缺主语，换名字句子仍然通顺
    expect(sanitizeLore("{{user}}替她挡了一句", opt)).toBe("少侠替她挡了一句");
    expect(sanitizeLore("<user>替她挡了一句", opt)).toBe("少侠替她挡了一句");
    expect(sanitizeLore("{{char}}沉默不语", opt)).toBe("柳青梧沉默不语");
    // 大小写与内部空格都要认
    expect(sanitizeLore("{{ USER }}来了", opt)).toBe("少侠来了");
  });

  it("剥掉行首的 markdown 标题与方括号小标题", () => {
    expect(sanitizeLore("## 基本信息\n【性格】固执", opt)).toBe("基本信息 固执");
  });

  it("正文中间的方括号不动（书名、招式名会用到）", () => {
    const t = sanitizeLore("他练的是【无名剑法】第三式", opt);
    expect(t).toContain("【无名剑法】");
  });

  it("压成单行——多行会把「首行 + 缩进子行」的结构冲散", () => {
    const t = sanitizeLore("第一行\n第二行\n\n第三行", opt);
    expect(t).not.toContain("\n");
    expect(t).toBe("第一行 第二行 第三行");
  });

  it("截到 LORE_MAX，且这个上限容得下原生最长那条", () => {
    // 原生 preset.npcLore 里最长的是梅朵 236 字
    expect(LORE_MAX).toBeGreaterThanOrEqual(236);
    expect(sanitizeLore("字".repeat(1000), opt).length).toBe(LORE_MAX);
  });

  it("空输入不抛错", () => {
    for (const v of ["", "   ", null, undefined, 0]) expect(sanitizeLore(v, opt)).toBe("");
  });
});

describe("stage2 必须要求 AI 重写人设，不能沿用原文", () => {
  const { system } = buildStage2([{ name: "甲", aliases: [], entry: "正文" }], { playerName: "少侠" });

  it("schema 里有「人设」输出字段", () => {
    expect(system, "没有这一项，AI 就只换算数值、正文照抄原卡").toContain('"人设"');
  });

  it("重写规范把四件事说清楚了", () => {
    expect(system).toContain("重写");
    expect(system).toContain("第三人称");
    expect(system).toMatch(/不保留.*占位符|占位符/);
    // 外貌/关系/例句各有专门字段，不该在人设里重复
    expect(system).toContain("外貌锚点那项管");
  });
});

describe("世界观条目不能被声明成人物", () => {
  const world = { name: "锦官城", aliases: [], entry: "- 锦官城：西南第一大城。", isWorld: true };
  const person = { name: "柳青梧", aliases: [], entry: "- 柳青梧（剑客）：固执。" };

  it("被提及的地理条目落进「相关地理与势力」，不落进人物段", () => {
    const block = buildNpcLoreBlock(matchNpcLore([person, world], {
      roomNpcNames: ["柳青梧"], userInput: "去锦官城", lastReply: "",
    }));
    expect(block).toContain("【相关地理与势力】");
    expect(block).toContain("不是人");
    // 关键：地理条目不能出现在那两个"人物设定"段里
    const peopleSection = block.slice(0, block.indexOf("【相关地理与势力】"));
    expect(peopleSection, "地理条目跑进人物段了——说书人会被告知它是个不能开口说话的人")
      .not.toContain("锦官城");
  });

  it("在场的人物照旧进「此刻在场人物设定」", () => {
    const block = buildNpcLoreBlock(matchNpcLore([person], {
      roomNpcNames: ["柳青梧"], userInput: "", lastReply: "",
    }));
    expect(block).toContain("【此刻在场人物设定】");
    expect(block).toContain("柳青梧");
  });

  it("原生 preset 条目没有 isWorld，行为不变（一律当人）", () => {
    const block = buildNpcLoreBlock(matchNpcLore([person], {
      roomNpcNames: [], userInput: "听说柳青梧来了", lastReply: "",
    }));
    expect(block).toContain("【仅被提及、并不在场的人物设定】");
    expect(block).not.toContain("【相关地理与势力】");
  });

  it("只有地理命中时不生出空的人物段", () => {
    const block = buildNpcLoreBlock(matchNpcLore([world], {
      roomNpcNames: [], userInput: "去锦官城", lastReply: "",
    }));
    expect(block).not.toContain("人物设定");
    expect(block).toContain("锦官城");
  });
});

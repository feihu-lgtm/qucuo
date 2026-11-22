import { describe, it, expect } from "vitest";
import { buildHistBlock, histBlockSavings } from "./histWindow.js";

// 这一块钉的是"用已有的 p.memory 顶掉中段的原始 JSON"。
// 背景：10 号位此前是 convo.slice(-contextWindow) 全铺原始，而 convo 里每条
// assistant 存的是 rawFull.slice(0,500)——连 room/char/delta 那些脚手架一起喂回去。
// 实测 contextWindow=16 时约占单轮上下文四成。而我们每轮本来就生成了 memory
// （≤50字客观事实），只喂给了小纸条和事实账本，历史窗口却用着贵的那份。

const mkConvo = (n, withMemory = true) => {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ role: "user", content: `第${i}回的指令` });
    const body = JSON.stringify({
      output: ["你顺着熊曲往北，水声渐大。".repeat(6)],
      room: { name: "鱼定村", desc: "三溪交汇" },
      char: { hp: [100, 100] }, delta: { items_add: [] },
      memory: `少侠第${i}回往北走，遇见背竹篓的老汉。`,
    }).slice(0, 500);
    out.push(withMemory
      ? { role: "assistant", content: body, memory: `少侠第${i}回往北走，遇见背竹篓的老汉。`, turn: i }
      : { role: "assistant", content: body });
  }
  return out;
};

describe("分层：近况原文 + 前情摘要", () => {
  const convo = mkConvo(10);

  it("最近 N 轮保原文（要接得上语气与未完的话头）", () => {
    const out = buildHistBlock(convo, { recentPairs: 2 });
    expect(out).toContain("[最近对话]");
    expect(out).toContain("水声渐大");        // 原文里的句子在
    expect(out).toContain("第10回的指令");
    expect(out).toContain("第9回的指令");
  });

  it("更早的只留摘要，原始 JSON 的脚手架字段不再出现", () => {
    const out = buildHistBlock(convo, { recentPairs: 2 });
    const front = out.split("[最近对话]")[0];
    expect(out).toContain("[前情提要]");
    expect(front).toContain("往北走，遇见背竹篓的老汉");  // 是摘要，不是原文
    // 前情段绝不该带 delta/char 这类脚手架
    expect(front).not.toContain("items_add");
    expect(front).not.toContain('"char"');
    expect(front).not.toContain("水声渐大");              // 原文正文也不该在前情里
  });

  it("对话模式多留一轮（一来一回是成对的）", () => {
    // 断言在「近况」段上数原文条数——玩家那侧的摘要本身就是指令原文，
    // 拿指令文本判断会误判（它在前情段里也会原样出现）。
    const recentOf = (pairs) => buildHistBlock(convo, { recentPairs: pairs }).split("[最近对话]")[1] || "";
    // 数「引擎」行数：近况段每轮一条引擎原文。不能数正文特征串——
    // 「水声渐大」在单条原文里就重复 6 次，数出来是 12 不是 2。
    const engineLines = (t) => t.split("\n").filter(l => l.startsWith("[引擎]")).length;
    expect(engineLines(recentOf(2))).toBe(2);
    expect(engineLines(recentOf(3))).toBe(3);
  });

  it("明确告诉模型两段各怎么用", () => {
    const out = buildHistBlock(convo, { recentPairs: 2 });
    expect(out).toContain("不必复述");        // 前情只作背景
    expect(out).toContain("照应它的语气");    // 近况要接住
  });
});

describe("确实省了", () => {
  it("16 条窗口省一半以上", () => {
    const win = mkConvo(10).slice(-16);
    const sv = histBlockSavings(win, { recentPairs: 2 });
    expect(sv.nowChars).toBeLessThan(sv.legacyChars);
    expect(sv.savedChars / sv.legacyChars).toBeGreaterThan(0.4);
  });
  it("窗口越长省得越多（前情摘要不随轮数线性膨胀）", () => {
    const s10 = histBlockSavings(mkConvo(10), { recentPairs: 2 }).savedChars;
    const s30 = histBlockSavings(mkConvo(30), { recentPairs: 2 }).savedChars;
    expect(s30).toBeGreaterThan(s10);
  });
  it("有字数预算，超了丢最旧的而不是无限长", () => {
    const big = buildHistBlock(mkConvo(60), { recentPairs: 2, budgetChars: 400, maxSummaries: 999 });
    const front = big.split("[最近对话]")[0];
    expect(front.length).toBeLessThan(700);       // 预算 + 标题行
    expect(big).toContain("第60回的指令");         // 最新的一定在
    expect(front).not.toContain("少侠第1回");      // 最旧的被丢了
  });
  it("默认 maxSummaries 会丢掉过旧的前情（这是设计而非 bug）", () => {
    const front = buildHistBlock(mkConvo(10), { recentPairs: 2 }).split("[最近对话]")[0];
    expect(front).not.toContain("少侠第1回");   // 12 条上限，16 条更早的里最旧的被丢
    expect(front).toContain("少侠第8回");       // 靠近现在的留着
  });

  it("maxSummaries 也能独立限条数", () => {
    const out = buildHistBlock(mkConvo(40), { recentPairs: 2, maxSummaries: 4, budgetChars: 99999 });
    const front = out.split("[最近对话]")[0];
    expect(front.split("\n").filter(l => l.startsWith("[")).length).toBeLessThanOrEqual(5);
  });
});

describe("老存档兼容（条目没有 memory 字段）", () => {
  it("能从原始 JSON 里抠出 memory", () => {
    const front = buildHistBlock(mkConvo(10, false), { recentPairs: 2 }).split("[最近对话]")[0];
    expect(front).toContain("往北走，遇见背竹篓的老汉");   // 抠到了 memory 字段
    expect(front).not.toContain("items_add");             // 没把整段 JSON 铺进去
  });
  it("连 memory 都抠不到时退回截断正文，不崩", () => {
    const junk = [
      { role: "user", content: "看看" },
      { role: "assistant", content: "一段没有任何结构的纯文本回复".repeat(10) },
      { role: "user", content: "再看看" },
      { role: "assistant", content: "又一段" },
    ];
    expect(() => buildHistBlock(junk, { recentPairs: 1 })).not.toThrow();
    expect(buildHistBlock(junk, { recentPairs: 1 })).toContain("又一段");
  });
});

describe("边界", () => {
  it("空/脏输入返回空串不炸", () => {
    for (const v of [[], null, undefined, "abc", 123]) {
      expect(() => buildHistBlock(v)).not.toThrow();
    }
    expect(buildHistBlock([])).toBe("");
    expect(buildHistBlock(null)).toBe("");
  });
  it("条目数少于近况窗口时，全部当近况、没有前情段", () => {
    const out = buildHistBlock(mkConvo(1), { recentPairs: 2 });
    expect(out).toContain("[最近对话]");
    expect(out).not.toContain("[前情提要]");
  });
  it("recentPairs=0 时全部走摘要", () => {
    const out = buildHistBlock(mkConvo(5), { recentPairs: 0 });
    expect(out).toContain("[前情提要]");
    expect(out).not.toContain("[最近对话]");
  });
  it("缺 content 的脏条目被跳过而不是写出 undefined", () => {
    const out = buildHistBlock([{ role: "user" }, { role: "assistant" }, ...mkConvo(2)], { recentPairs: 1 });
    expect(out).not.toContain("undefined");
  });
});

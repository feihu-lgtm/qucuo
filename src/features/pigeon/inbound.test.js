import { describe, expect, it } from "vitest";
import {
  applyInboundLetter, dueInboundLetters, inboundFallbackLine, markAllLettersRead,
  npcLetterRule, pickLetterSender, queueInboundLetter, unreadLetterCount, LETTER_TUNE,
} from "./inbound.js";

const base = (over = {}) => ({
  time: 100,
  room: { name: "锦官城", npcs: [] },
  char: { name: "主角", pigeons: 2 },
  varTree: {
    世界: { 已认识人物: ["元朵朵", "铁伯"], 来信待发: [], 来信箱: [] },
    角色: {
      元朵朵: { 好感度: 80, 所在地: "鱼定村" },
      铁伯: { 好感度: 10, 所在地: "锦官城" },
    },
  },
  npcState: {},
  ...over,
});

const applyVarTree = (state, res) => res.changes.varTree(state.varTree);

describe("queueInboundLetter · 抽签入队", () => {
  it("命中概率 → 信件入队带到达时刻", () => {
    const res = queueInboundLetter(base(), () => 0.1);
    const next = applyVarTree(base(), res);
    const pending = next.世界.来信待发;
    expect(pending).toHaveLength(1);
    expect(["元朵朵", "铁伯"]).toContain(pending[0].npcName);
    expect(pending[0].arriveTime).toBeGreaterThan(100);
  });

  it("掷签落空 / 已有在途信 / 全局冷却 → 不入队", () => {
    expect(queueInboundLetter(base(), () => 0.9)).toBeNull();
    const pending = base(); pending.varTree.世界.来信待发 = [{ id: "x", npcName: "元朵朵", arriveTime: 200 }];
    expect(queueInboundLetter(pending, () => 0.1)).toBeNull();
    const recent = base(); recent.varTree.世界.来信箱 = [{ id: "a", npcName: "铁伯", turn: 90, read: true }];
    expect(queueInboundLetter(recent, () => 0.1)).toBeNull();
  });

  it("写信人冷却：刚来过信的人不再写", () => {
    const s = base();
    s.varTree.世界.来信箱 = [{ id: "a", npcName: "元朵朵", turn: 100 - LETTER_TUNE.senderCooldown + 1, read: true }];
    // 好感加权后只剩铁伯可选
    const res = queueInboundLetter(s, () => 0.1);
    const next = applyVarTree(s, res);
    expect(next.世界.来信待发[0].npcName).toBe("铁伯");
  });

  it("好感加权：rng 打在高好感区间挑中元朵朵", () => {
    const s = base();
    s.varTree.世界.已认识人物 = ["铁伯", "元朵朵"]; // 顺序无关，权重说话
    const rolls = [0.1, 0.6]; let i = 0; // 第一掷过概率，第二掷挑人
    const res = queueInboundLetter(s, () => rolls[i++ % rolls.length]); // 铁伯 w=1.4, 朵朵 w=4.2 → 0.6*5.6=3.36 落朵朵
    const next = applyVarTree(s, res);
    expect(next.世界.来信待发[0].npcName).toBe("元朵朵");
  });
});

describe("pickLetterSender · 兽类不写", () => {
  it("beast 被滤掉", () => {
    const s = base();
    s.varTree.世界.已认识人物 = ["元朵朵", "大灰狼"];
    s.room.npcs = [{ name: "大灰狼", beast: true }];
    const picked = pickLetterSender(s, () => 0.99);
    expect(picked.name).toBe("元朵朵");
  });
});

describe("npcLetterRule · 按时辰抽签", () => {
  it("deps 按时间窗滚动", () => {
    expect(npcLetterRule.deps({ time: 0 })).toEqual([0]);
    expect(npcLetterRule.deps({ time: LETTER_TUNE.everyTurns })).toEqual([1]);
  });
  it("首轮 backfill 不发；确定性掷签——同一 seed 结果可复现", () => {
    expect(npcLetterRule.run(base(), { firstRun: true })).toBeNull();
    let hitAt = -1;
    for (let t = 0; t < 2000 && hitAt < 0; t++) {
      const s = base({ time: t });
      if (npcLetterRule.run(s, { firstRun: false })) hitAt = t;
    }
    expect(hitAt).toBeGreaterThanOrEqual(0); // 45%/窗，2000 窗内必有命中
    const res1 = npcLetterRule.run(base({ time: hitAt }), { firstRun: false });
    const res2 = npcLetterRule.run(base({ time: hitAt }), { firstRun: false });
    const n1 = res1.changes.varTree(base().varTree).世界.来信待发[0].npcName;
    const n2 = res2.changes.varTree(base().varTree).世界.来信待发[0].npcName;
    expect(n1).toBe(n2);
  });
});

describe("applyInboundLetter · 落地成信", () => {
  const letter = { id: "letter_in_元朵朵_100", npcName: "元朵朵", arriveTime: 110 };

  it("来信箱入未读条目 + 飞鸽往来 dir=recv + 鸽子+1 + 待发清除", () => {
    const s = base();
    s.varTree.世界.来信待发 = [letter];
    const res = applyInboundLetter(s, letter, "见字如面，近来可好？");
    const next = applyVarTree(s, res);
    const box = next.世界.来信箱;
    expect(box[0]).toMatchObject({ npcName: "元朵朵", content: "见字如面，近来可好？", read: false });
    expect(next.角色.元朵朵.飞鸽[0]).toMatchObject({ dir: "recv", content: "见字如面，近来可好？" });
    expect(next.世界.来信待发).toHaveLength(0);
    expect(res.changes.char({ pigeons: 2 }).pigeons).toBe(3);
    expect(res.logs.map((l) => l.text).join("")).toContain("元朵朵");
    expect(res.logs.some((l) => l.t === "narrator")).toBe(true);
    expect(res.factSummary.cue).toContain("元朵朵");
  });

  it("隐藏标记被剥掉、空文兜底", () => {
    const s = base();
    const res = applyInboundLetter(s, letter, "正文⟦好感5⟧⟦回礼:玉|misc⟧");
    const next = applyVarTree(s, res);
    expect(next.世界.来信箱[0].content).toBe("正文");
    const empty = applyInboundLetter(s, letter, "   ");
    expect(applyVarTree(s, empty).世界.来信箱[0].content).toContain("字迹潦草");
  });
});

describe("markAllLettersRead / unreadLetterCount", () => {
  it("点开即全部已读", () => {
    const s = base();
    s.varTree.世界.来信箱 = [
      { id: "a", npcName: "元朵朵", read: false, turn: 1 },
      { id: "b", npcName: "铁伯", read: true, turn: 2 },
    ];
    expect(unreadLetterCount(s)).toBe(1);
    const res = markAllLettersRead(s);
    expect(res.changes.varTree(s.varTree).世界.来信箱.every((l) => l.read)).toBe(true);
    expect(unreadLetterCount({ ...s, varTree: res.changes.varTree(s.varTree) })).toBe(0);
    expect(markAllLettersRead({ ...s, varTree: res.changes.varTree(s.varTree) })).toEqual({});
  });
});

describe("dueInboundLetters · 到点过滤", () => {
  it("只发 arriveTime 到点的", () => {
    const s = base();
    s.varTree.世界.来信待发 = [
      { id: "x", npcName: "元朵朵", arriveTime: 90 },
      { id: "y", npcName: "铁伯", arriveTime: 200 },
    ];
    expect(dueInboundLetters(s).map((l) => l.id)).toEqual(["x"]);
  });
});

describe("inboundFallbackLine · 人设成色兜底", () => {
  const letter = { npcName: "元朵朵" };
  it("生气状态 → 埋怨档", () => {
    const s = base();
    s.varTree.角色.元朵朵.生气状态 = { reason: "被偷" };
    expect(inboundFallbackLine(s, letter, () => 0)).toContain("忘");
  });
  it("好感 ≥60 → 温言档", () => {
    expect(inboundFallbackLine(base(), letter, () => 0)).toContain("茶");
  });
  it("好感 <30 → 冷淡档", () => {
    const s = base();
    s.varTree.角色.元朵朵.好感度 = 5;
    expect(inboundFallbackLine(s, letter, () => 0)).toContain("江湖再见");
  });
});

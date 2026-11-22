import { describe, expect, it } from "vitest";
import { FESTIVAL_CONTESTS, FESTIVAL_COMPANIONS } from "../../data/festival/festivalData.js";
import {
  companionCandidates,
  contestScore,
  isContestOpen,
  isMidnightHour,
  isNightTalkHour,
  pickMidnightEvent,
  resolveBet,
} from "./rules.js";

describe("跑马大会规则", () => {
  it("赛事窗口：跑马上午开、射箭午后开、比武傍晚开", () => {
    expect(isContestOpen(FESTIVAL_CONTESTS.saima, 8)).toBe(true);
    expect(isContestOpen(FESTIVAL_CONTESTS.saima, 12)).toBe(false);
    expect(isContestOpen(FESTIVAL_CONTESTS.shejian, 14)).toBe(true);
    expect(isContestOpen(FESTIVAL_CONTESTS.shejian, 6)).toBe(false);
    expect(isContestOpen(FESTIVAL_CONTESTS.wubi, 18)).toBe(true);
    expect(isContestOpen(FESTIVAL_CONTESTS.wubi, 21)).toBe(false);
  });

  it("比分门槛不超 100：满分七维也压不进 100 以上", () => {
    const maxChar = { special: { 身法: 10, 体魄: 10, 气运: 10, 智谋: 10 } };
    for (let i = 0; i < 30; i++) {
      expect(contestScore(maxChar, FESTIVAL_CONTESTS.saima)).toBeLessThanOrEqual(100);
      expect(contestScore(maxChar, FESTIVAL_CONTESTS.shejian)).toBeLessThanOrEqual(100);
    }
    const weak = { special: {} };
    expect(contestScore(weak, FESTIVAL_CONTESTS.saima)).toBeLessThan(FESTIVAL_CONTESTS.saima.champion.score);
  });

  it("下注：冠军线、赔率、胜负都在表内", () => {
    for (const c of Object.values(FESTIVAL_CONTESTS)) {
      expect(c.champion?.score ?? 0).toBeLessThanOrEqual(100);
      for (const b of c.bettors) expect(b.odds).toBeGreaterThan(1);
      const r = resolveBet(c, c.bettors[0].name, 10);
      expect(c.bettors.map((b) => b.name)).toContain(r.winner);
      if (r.win) expect(r.payout).toBe(Math.round(10 * c.bettors[0].odds));
      else expect(r.payout).toBe(0);
    }
  });

  it("女伴门槛：好感 ≥60 才可邀", () => {
    const cands = companionCandidates({ 角色: { 梅朵: { 好感度: 70 }, 才旦: { 好感度: 59 } } });
    expect(cands.find((c) => c.name === "梅朵").ok).toBe(true);
    expect(cands.find((c) => c.name === "才旦").ok).toBe(false);
    expect(cands).toHaveLength(FESTIVAL_COMPANIONS.length);
    expect(cands.find((c) => c.name === "何雨谢").masked).toBe(true);
    expect(cands.find((c) => c.name === "兰姐").masked).toBe(true);
  });

  it("时辰窗：夜话 19–22，子夜只在 23", () => {
    expect(isNightTalkHour(19)).toBe(true);
    expect(isNightTalkHour(22)).toBe(true);
    expect(isNightTalkHour(23)).toBe(false);
    expect(isMidnightHour(23)).toBe(true);
    expect(isMidnightHour(0)).toBe(false);
  });

  it("子夜之变：三选一，事件与选项齐备", () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(pickMidnightEvent().id);
    expect([...seen].sort()).toEqual(["guan", "xie", "zei"]);
    for (const id of seen) {
      const ev = pickMidnightEvent();
      expect(ev.choices.length).toBeGreaterThan(0);
      expect(ev.choices.some((c) => c.kind === "combat")).toBe(true);
      expect(ev.choices.some((c) => c.kind === "yield")).toBe(true);
    }
  });
});

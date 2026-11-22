import { describe, it, expect } from "vitest";
import {
  AUCTION_CONFIG, AUCTION_PHASE, initAuction, openAuction,
  playerBid, abandonAuction, nextBidAmount,
} from "./auction.js";

const RICH = 9999;
const opened = () => openAuction(initAuction());

describe("开槌", () => {
  it("初始是 IDLE，开槌后托儿先叫起拍价", () => {
    const s0 = initAuction();
    expect(s0.phase).toBe(AUCTION_PHASE.IDLE);
    const s = openAuction(s0);
    expect(s.phase).toBe(AUCTION_PHASE.BIDDING);
    expect(s.currentBid).toBe(AUCTION_CONFIG.startingBid);
    expect(s.leader).toBe("shill");
  });
  it("重复开槌不生效", () => {
    const s = opened();
    expect(openAuction(s)).toBe(s);
  });
});

describe("托儿跟价与退出线", () => {
  it("低于退出线时托儿必跟，且反超玩家", () => {
    const { state } = playerBid(opened(), RICH); // 250
    expect(state.leader).toBe("shill");
    expect(state.currentBid).toBeGreaterThan(250);
    expect(state.phase).toBe(AUCTION_PHASE.BIDDING);
  });

  it("托儿叫价永不超过退出线", () => {
    let s = opened();
    for (let i = 0; i < 20 && s.phase === AUCTION_PHASE.BIDDING; i++) {
      s = playerBid(s, RICH).state;
      expect(s.currentBid).toBeLessThanOrEqual(AUCTION_CONFIG.buyoutPrice);
      if (s.leader === "shill") expect(s.currentBid).toBeLessThanOrEqual(AUCTION_CONFIG.shillCeiling);
    }
  });

  it("出到退出线及以上，托儿收手、玩家拿下", () => {
    const { state } = playerBid(opened(), RICH, AUCTION_CONFIG.shillCeiling);
    expect(state.phase).toBe(AUCTION_PHASE.WON);
    expect(state.leader).toBe("player");
    expect(state.shillOut).toBe(true);
    expect(state.currentBid).toBe(AUCTION_CONFIG.shillCeiling);
  });

  it("一路加价最终必定能拿下（不会无限拉锯）", () => {
    let s = opened(), guard = 0;
    while (s.phase === AUCTION_PHASE.BIDDING && guard++ < 50) s = playerBid(s, RICH).state;
    expect(s.phase).toBe(AUCTION_PHASE.WON);
    expect(guard).toBeLessThan(50);
  });
});

describe("一口价", () => {
  it("直接出封顶价当场落槌", () => {
    const { state } = playerBid(opened(), RICH, AUCTION_CONFIG.buyoutPrice);
    expect(state.phase).toBe(AUCTION_PHASE.WON);
    expect(state.currentBid).toBe(AUCTION_CONFIG.buyoutPrice);
  });
  it("设计承诺：500 两一定拿得到", () => {
    const { state, error } = playerBid(opened(), AUCTION_CONFIG.buyoutPrice, AUCTION_CONFIG.buyoutPrice);
    expect(error).toBeNull();
    expect(state.phase).toBe(AUCTION_PHASE.WON);
  });
});

describe("出价合法性", () => {
  it("钱不够则拒绝，状态不变", () => {
    const s = opened();
    const { state, error } = playerBid(s, 10);
    expect(state).toBe(s);
    expect(error).toContain("出不起");
  });
  it("不得低于或等于当前价", () => {
    const s = opened();
    const { state, error } = playerBid(s, RICH, AUCTION_CONFIG.startingBid);
    expect(state).toBe(s);
    expect(error).toContain("必须高于");
  });
  it("已成交后不能再出价", () => {
    const won = playerBid(opened(), RICH, AUCTION_CONFIG.buyoutPrice).state;
    const { error } = playerBid(won, RICH);
    expect(error).toBeTruthy();
  });
  it("nextBidAmount 按步长走", () => {
    expect(nextBidAmount(opened())).toBe(AUCTION_CONFIG.startingBid + AUCTION_CONFIG.increment);
  });
});

describe("放弃", () => {
  it("放弃后流拍，可再来", () => {
    const s = abandonAuction(opened());
    expect(s.phase).toBe(AUCTION_PHASE.LOST);
  });
  it("非竞价阶段放弃无效", () => {
    const won = playerBid(opened(), RICH, AUCTION_CONFIG.buyoutPrice).state;
    expect(abandonAuction(won)).toBe(won);
  });
});

describe("纯函数：不修改传入的 state", () => {
  it("playerBid 不就地改", () => {
    const s = opened();
    const snapshot = JSON.stringify(s);
    playerBid(s, RICH);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

// 宝丰拍卖行 · 竞价状态机（纯函数，不碰 React 状态、不调 AI）
// ============================================================================
// 锦官城拍卖行的一场拍卖只有两个买家：玩家，和一个托儿。
// 托儿是拍卖行自己安插的（跟赌石坊温掌柜那套托儿局是同一路数），职责是把价往上抬，
// 但抬到一个上限就"退出"——真把玩家挤走了，行里一分钱赚不到。
//
// 【为什么托儿要有明确退出线】
// 如果托儿无限跟价，这场拍卖就变成纯粹的耐心比拼，玩家只会觉得被耍。
// 定死一条线（shillCeiling）之后，这场拍卖对玩家来说是一道很清楚的算术题：
// 出到 400 以上就一定拿得下——代价是你为一件死当品多付了多少。这才是拍卖该有的
// 张力：不是"能不能赢"，是"值不值这个价"。
//
// 【与赌石谈价的分工】
// 赌石那边是 AI 驱动的自由砍价（settleNegotiation 收敛 AI 给的倍率）；这边是
// 确定性状态机，一次点击一次加价，结果完全可预测。拍卖的乐趣在算账不在嘴皮子，
// 不需要每加一次价都烧一次 AI 调用。

export const AUCTION_CONFIG = {
  startingBid: 200,   // 起拍价
  increment: 50,      // 每次加价步长
  shillCeiling: 400,  // 托儿的退出线：叫到这个价还被超，他就不跟了
  buyoutPrice: 500,   // 一口价：直接落槌，不必跟托儿磨
};

// 拍品：衔尾蛇门环（蜀王庄的钥匙）
export const AUCTION_LOT = {
  name: "衔尾蛇门环",
  category: "misc",
  quality: "紫",
  desc: "锦官城拍卖所得。两条首尾相衔的蛇盘成一个环，蛇眼嵌着两粒红石。旋开蛇口，环身竟能拆成一把钥匙。",
  blurb: "前朝蜀王旧邸的门环，抄家时流出来的。铜胎错银，两条衔尾蛇盘成一个环，蛇眼是两粒红石。识货的说这不止是个门环——旋得开。",
};

export const AUCTION_PHASE = {
  IDLE: "idle",         // 还没开槌
  BIDDING: "bidding",   // 竞价中
  WON: "won",           // 玩家拿下
  LOST: "lost",         // 玩家中途放弃
};

export function initAuction() {
  return {
    phase: AUCTION_PHASE.IDLE,
    currentBid: 0,
    leader: null,          // "player" | "shill"
    shillOut: false,       // 托儿是否已退出
    log: [],
  };
}

// 开槌：托儿先叫起拍价（拍卖行不会让场子冷着开局）。
export function openAuction(state) {
  if (state.phase !== AUCTION_PHASE.IDLE) return state;
  return {
    ...state,
    phase: AUCTION_PHASE.BIDDING,
    currentBid: AUCTION_CONFIG.startingBid,
    leader: "shill",
    log: [
      { who: "auctioneer", text: `「衔尾蛇门环一件——起拍二百两。」槌子轻轻一磕。` },
      { who: "shill", text: `后排一个穿灰绸的胖子懒洋洋抬了抬手：「二百。」` },
    ],
  };
}

// 玩家出价。amount 不传则按步长加一档。
// 返回 { state, error }：钱不够/时机不对时 state 原样返回，error 说明原因。
export function playerBid(state, money, amount) {
  if (state.phase !== AUCTION_PHASE.BIDDING) return { state, error: "此刻不能出价。" };
  const bid = amount ?? state.currentBid + AUCTION_CONFIG.increment;
  if (bid <= state.currentBid) return { state, error: "出价必须高于当前价。" };
  if (bid > money) return { state, error: `你只有 ${money} 两，出不起 ${bid} 两。` };

  const log = [...state.log, { who: "player", text: `你抬手：「${bid}。」` }];

  // 一口价：直接落槌，托儿没机会跟。
  if (bid >= AUCTION_CONFIG.buyoutPrice) {
    return {
      state: {
        ...state, phase: AUCTION_PHASE.WON, currentBid: bid, leader: "player", shillOut: true,
        log: [...log,
          { who: "auctioneer", text: `「${bid}两——一口价。」槌子重重落下。「成交！」` },
          { who: "shill", text: `灰绸胖子撇撇嘴，把手揣回袖子里，看都不看你一眼。` },
        ],
      },
      error: null,
    };
  }

  // 托儿还在场且这个价没越过他的线：他继续跟。
  if (!state.shillOut && bid < AUCTION_CONFIG.shillCeiling) {
    const counter = Math.min(bid + AUCTION_CONFIG.increment, AUCTION_CONFIG.shillCeiling);
    return {
      state: {
        ...state, currentBid: counter, leader: "shill",
        log: [...log, { who: "shill", text: `灰绸胖子眼皮都没抬：「${counter}。」跟得毫不犹豫，像是根本不在乎这钱。` }],
      },
      error: null,
    };
  }

  // 越过退出线：托儿收手，玩家拿下。
  return {
    state: {
      ...state, phase: AUCTION_PHASE.WON, currentBid: bid, leader: "player", shillOut: true,
      log: [...log,
        { who: "shill", text: `灰绸胖子张了张嘴，又把手放下了。他扭头跟旁边的人低声说了句什么，没再举手。` },
        { who: "auctioneer", text: `「${bid}两一次，两次——」槌子落下。「成交！」` },
      ],
    },
    error: null,
  };
}

// 玩家放弃。拍品流拍（托儿是自己人，不会真买走），下次还能再来。
export function abandonAuction(state) {
  if (state.phase !== AUCTION_PHASE.BIDDING) return state;
  return {
    ...state, phase: AUCTION_PHASE.LOST,
    log: [...state.log,
      { who: "player", text: `你摇摇头，退了出去。` },
      { who: "auctioneer", text: `「${state.currentBid}两一次，两次——流拍。」槌子有气无力地一磕。灰绸胖子起身走了，一副本来也没打算买的样子。` },
    ],
  };
}

// 下一档要出多少（UI 按钮显示用）。
export function nextBidAmount(state) {
  return state.currentBid + AUCTION_CONFIG.increment;
}

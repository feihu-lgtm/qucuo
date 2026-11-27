// 元朵朵·金鸟金蛋每日签到——开奖的状态读写。
// 触发钩子在 NpcActionMenu 的「金鸟金蛋」钮（只对她出现）。分三步：
//   openGoldenEgg   当天可否领、记签到日、掷定品阶、落开场两行（同步，点下即落）；
//   settleAiEggPrize  AI 自由开出的奖品落成真物件入行囊（异步回包后由钩子调用）；
//   settlePoolEggPrize 无 API 或 AI 失败时退回加权奖池（银两/具名物件/空蛋）。
// claimGoldenEgg = open + 奖池结算，供无 API 路径一步开完。
// prompt/兜底句/回包裁剪在 domain/rules/npc/goldenEgg.js。

import { makeNamedItem, makeItemSmart } from "../../domain/data/items/catalog.js";
import { makeItem, rollQuality } from "../../domain/rules/economy/equipment.js";
import {
  GOLDEN_EGG_STATE_KEY, eggAlreadyClaimed, eggGameDay, eggTier, rollGoldenEgg,
} from "../../domain/rules/npc/goldenEgg.js";
import { updateField, add, set, applyWrite } from "../../domain/rules/state/applyWrite.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";

export const DUODUO_NAME = "元朵朵";

export function isDuoduo(npc) {
  return npc?.name === DUODUO_NAME;
}

const OPEN_LINES = [
  { t: "sys", text: "  檐外忽地掠过一道金光——一只金鸟扑棱棱落在元朵朵肩头，尾羽一抖，竟当真落下一颗滴溜溜的金蛋。" },
  { t: "sys", text: "  她先把蛋捂在怀里掂了掂，才不情不愿递过来：开吧开吧，开出什么都是你的。" },
];

/**
 * 开蛋第一步：判门、记签到日、掷品阶。
 * @returns {{claimed?:true, quality?:string, logs:Array, changes?:object}}
 *   不是朵朵返回 err 行；已领过返回 {claimed:true, logs}；可开返回 {quality, logs, changes}。
 *   quality 按玩家气运掷（rollQuality，与锻造同一条分布），给 AI 定分量、给 makeItem 定数值。
 */
export function openGoldenEgg(state, npc, { quality } = {}) {
  if (!isDuoduo(npc)) {
    return { logs: [{ t: "err", text: "  金鸟只认元朵朵。" }] };
  }
  if (eggAlreadyClaimed(state?.npcState, state?.time)) {
    return {
      claimed: true,
      logs: [
        { t: "sys", text: "  你刚凑近，元朵朵就把荷包往身后一藏：金鸟一天只来一趟，明儿请早——想要彩头也不能薅秃它呀。" },
      ],
    };
  }
  const luck = state?.char?.special?.气运 ?? 5;
  return {
    quality: quality || rollQuality(luck),
    logs: OPEN_LINES.map((line) => ({ ...line })),
    changes: {},
  };
}

// 签到日记账（lastDay）——Review 修：不在 open 时写。open 到 AI 回包之间存档会记下
// 「已领」却没奖品，读档后奖品永丢；改在奖品落账的同一帧写入（AI/奖池两路同），
// 存档无论截在哪一刻都自洽：要么连奖带账都有，要么都没有（可重领）。
export function eggSignInChange(state) {
  return (prev) => ({
    ...(prev || {}),
    [GOLDEN_EGG_STATE_KEY]: { lastDay: eggGameDay(state?.time) },
  });
}

/**
 * AI 自由开出的奖品落账：现成物件名照抄的按物件志实例化（数值以物件志为准），
 * 其余按系统掷定的品阶 makeItem——名字/类别/描述来自 AI，攻防与价格全由系统算。
 * 行囊用函数式写入：回包是异步到的，要叠在此刻最新的行囊上。
 */
export function settleAiEggPrize(prize, quality) {
  const item = makeItemSmart({ name: prize.name, category: prize.category, quality, desc: prize.desc }, makeItem);
  item.goldenEgg = true; // 来历标记，叙事/排查可认
  // 两条账目连写，主栏会并成一行「账」；描述与朵朵反应跟在账目后面。
  const logs = [
    { t: "item", text: `  金蛋「咔」地裂开——里头滚出「${item.name}」（${item.quality}）！` },
    { t: "item", text: `  「${item.name}」已入行囊。` },
  ];
  if (prize.desc) logs.push({ t: "desc", text: `  ${prize.desc}` });
  if (prize.reaction) logs.push({ t: "sys", text: `  ${prize.reaction}` });
  return {
    item,
    logs,
    changes: { inv: (prev) => [...(prev || []), item] },
  };
}

/**
 * 加权奖池结算（无 API / AI 失败兜底）。
 * @returns {{prize:object, tier:string, logs:Array, changes:object}}
 */
export function settlePoolEggPrize(state, { rng = Math.random } = {}) {
  const prize = rollGoldenEgg(rng);
  const tier = eggTier(prize);
  const logs = [
    { t: "item", text: `  金蛋「咔」地裂开——${prize.kind === "empty" ? "里头空空如也，连点响儿都没有。" : `里头滚出「${prize.label}」！`}` },
  ];
  const changes = {};
  if (prize.kind === "money") {
    changes.char = updateField("char", add("char.money", prize.amount));
    logs.push({ t: "item", text: `  银两 +${prize.amount}。` });
  } else if (prize.kind === "item") {
    // makeNamedItem 实例自带 buyPrice/sellPrice——蛋里开出的东西是真物件，
    // 能在朵朵店里卖、进随身交易经济，不是日志里一句空话。
    const item = makeNamedItem(prize.itemName);
    if (!item) {
      // 词条被改名的兜底：不落空蛋，折成中档银两（奖池条目对不上 catalog 是数据事故，别整玩家）。
      changes.char = updateField("char", add("char.money", 10));
      logs.push({ t: "item", text: "  蛋壳里滚出一小锭银（奖池物件没寻着，折银十两）。" });
    } else {
      item.goldenEgg = true; // 来历标记，叙事/排查可认
      // Review 修：行囊必须函数式写入——异步回包落账时玩家可能已捡物/用物，
      // 按开奖时刻快照整体替换会把期间的行囊变动吞掉（与 settleAiEggPrize 同口径）。
      changes.inv = (prev) => [...(prev || []), item];
      logs.push({ t: "item", text: `  「${item.name}」已入行囊。` });
    }
  } else {
    logs.push({ t: "sys", text: "  空蛋。元朵朵比你先一步笑出了声。" });
  }
  return { prize, tier, logs, changes };
}


// 用户定案：开奖不走回合叙事，结果必须系统侧落账留痕——银两/物品由 changes 硬落账；
// 记忆链走 features/run 的 result.fact 通道（与切磋同一 registerFact 路径）：
// 朵朵在场目击必然知情，开出情趣物/卡券这类有后效的物件，她日后对话/判官上下文该能提起。
export function eggFact(state, label) {
  return {
    id: `goldenegg_d${eggGameDay(state?.time)}`,
    摘要: `主角开元朵朵的金鸟金蛋，开出「${label}」`,
    标签: "金蛋",
    知晓者: [
      { name: DUODUO_NAME, 途径: "目击" },
      ...(state?.room?.npcs || [])
        // V4 同口径：据点内层房间收窄——别屋 NPC 不算目击（知情隔离）。
        .filter((entry) => entry?.name && entry.name !== DUODUO_NAME
          && isNpcVisibleInInnerRoom(state?.room?.name, state?.innerRoomName, entry))
        .map((entry) => ({ name: entry.name, 途径: "目击" })),
    ],
    currentTurn: state?.time ?? 0,
  };
}

/**
 * 一步开完（无 API 路径）：openGoldenEgg + 奖池结算。
 * @returns {{claimed?:true, prize?:object, tier?:string, logs:Array, changes?:object}}
 */
export function claimGoldenEgg(state, npc, { rng = Math.random } = {}) {
  const opened = openGoldenEgg(state, npc, { quality: "白" });
  if (!opened.changes) return { claimed: opened.claimed, logs: opened.logs };
  const pool = settlePoolEggPrize(state, { rng });
  return {
    prize: pool.prize,
    tier: pool.tier,
    logs: [...opened.logs, ...pool.logs],
    changes: { ...opened.changes, ...pool.changes, npcState: eggSignInChange(state) },
  };
}

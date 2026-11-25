// 元朵朵·金鸟金蛋每日签到——开奖一步的状态读写。
// 触发钩子在 NpcActionMenu 的「金鸟金蛋」钮（只对她出现）；本函数判定
// 当天可否领、抽什么奖、把奖落账，朵朵的临场反应由钩子走 AI 后台补写
// （prompt/兜底句在 domain/rules/npc/goldenEgg.js）。

import { makeNamedItem } from "../../domain/data/items/catalog.js";
import {
  GOLDEN_EGG_STATE_KEY, eggAlreadyClaimed, eggGameDay, eggTier, rollGoldenEgg,
} from "../../domain/rules/npc/goldenEgg.js";
import { updateField, add, set, applyWrite } from "../../domain/rules/state/applyWrite.js";

export const DUODUO_NAME = "元朵朵";

export function isDuoduo(npc) {
  return npc?.name === DUODUO_NAME;
}

/**
 * 开蛋。
 * @returns {{prize?:object, tier?:string, logs:Array, changes?:object}}
 *   已领过返回 {claimed:true, logs}；开奖返回 {prize, tier, logs, changes}——
 *   prize/tier 供钩子拼 AI 反应 prompt。
 */
export function claimGoldenEgg(state, npc, { rng = Math.random } = {}) {
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

  const prize = rollGoldenEgg(rng);
  const tier = eggTier(prize);
  const logs = [
    { t: "sys", text: "  檐外忽地掠过一道金光——一只金鸟扑棱棱落在元朵朵肩头，尾羽一抖，竟当真落下一颗滴溜溜的金蛋。" },
    { t: "sys", text: "  她先把蛋捂在怀里掂了掂，才不情不愿递过来：开吧开吧，开出什么都是你的。" },
    { t: "item", text: `  金蛋「咔」地裂开——${prize.kind === "empty" ? "里头空空如也，连点响儿都没有。" : `里头滚出「${prize.label}」！`}` },
  ];

  const changes = {
    npcState: (prev) => ({
      ...(prev || {}),
      [GOLDEN_EGG_STATE_KEY]: { lastDay: eggGameDay(state?.time) },
    }),
  };
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
      changes.inv = applyWrite(state, set("inv", [...(state.inv || []), item])).state.inv;
      logs.push({ t: "item", text: `  「${item.name}」已入行囊。` });
    }
  } else {
    logs.push({ t: "sys", text: "  空蛋。元朵朵比你先一步笑出了声。" });
  }

  return { prize, tier, logs, changes };
}

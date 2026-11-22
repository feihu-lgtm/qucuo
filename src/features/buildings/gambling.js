// 赌坊：押钱 / 押物抽奖。
// 从 logic.js 按动作分组拆出。
import { random } from "../../utils/rng.js";
import { ITEM_CATEGORY } from "../../domain/rules/economy/equipment.js";
import { invalidAmountResult, noOpResult, isPositiveAmount, makeGameItem } from "./helpers.js";

export function gamble(state, { mode, bet, luck, dayIdx, maxBet = 200 } = {}, now = Date.now()) {
  if (!isPositiveAmount(bet)) return invalidAmountResult();
  if (mode !== "money" && mode !== "item") return noOpResult();
  const day = dayIdx ?? Math.floor(state.time / 24);
  const currentLuck = Number.isFinite(luck) ? luck : (state.char.special?.气运 ?? 5);
  if (!Number.isInteger(day) || !isPositiveAmount(maxBet)) return noOpResult();
  if (mode === "money" && bet > maxBet) return invalidAmountResult();
  if ((state.flags || []).includes(`gambled_day_${day}`)) return noOpResult();
  if ((state.char.money || 0) < bet) return noOpResult();

  let narrateLine;
  const changes = {
    flags: [`gambled_day_${day}`, ...(state.flags || []).filter((flag) => !flag.startsWith("gambled_day_"))],
  };

  if (mode === "item") {
    const qualities = ["白", "绿", "蓝", "紫", "橙"];
    const quality = qualities[Math.min(qualities.length - 1, Math.floor(currentLuck / 2.5))];
    const categories = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
    const category = categories[Math.floor(random() * categories.length)];
    const names = {
      [ITEM_CATEGORY.WEAPON]: ["彩头刀", "幸运剑", "财神棍"],
      [ITEM_CATEGORY.ARMOR]: ["福气甲", "招财护臂", "吉祥软甲"],
      [ITEM_CATEGORY.ACCESSORY]: ["运气链", "财运玉佩", "好运吊坠"],
    };
    const name = names[category][Math.floor(random() * 3)];
    const item = makeGameItem({ name, category, quality });
    changes.char = { ...state.char, money: (state.char.money || 0) - bet };
    changes.inv = [...(state.inv || []), { ...item, id: `gamble_${now}`, equipped: false }];
    narrateLine = `在赌坊押了${bet}两玩物品抽奖，抽中了「${name}」（${quality}）`;
  } else {
    const roll = random() * 100;
    const loseChance = 60 - 30 * (currentLuck / 10);
    const tieChance = 30;
    let result;
    if (roll < loseChance) {
      result = "赔";
      changes.char = { ...state.char, money: (state.char.money || 0) - bet };
    } else if (roll < loseChance + tieChance) {
      result = "平";
    } else {
      result = "赢";
      changes.char = { ...state.char, money: (state.char.money || 0) + bet };
    }
    const text = { 赔: `亏了${bet}两`, 平: "保本", 赢: `赢了${bet}两` }[result];
    narrateLine = `在赌坊押注${bet}两，骰子一落，${text}`;
  }

  return { changes, logs: [], settle: narrateLine };
}

// 车马行：目的地定价 / 乘马车出行。
// 从 logic.js 按动作分组拆出。
import { getMapNode, isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";

const TRANSPORT_PRICES = {
  鱼定村: 5, 鱼定土司: 5, 喇嘛庙: 5, 白塔: 8, 后山平台: 8, 玉泉寨: 5, 大草甸: 5, 贡措海: 8,
  天都镇: 5, 锦官城: 15, 雪山派: 12,
  打箭炉: 8, 丹霞城: 8, 焚风渡: 10, 琼隆古墟: 10,
};

export const getPriceForDest = (dest) => TRANSPORT_PRICES[dest] || 10;

export function canTravelByCarriage({ mapData, flags, questProgress }, dest) {
  if (!getMapNode(dest) || !mapData?.[dest]) return false;
  const completedQuests = Object.entries(questProgress || {})
    .filter(([, progress]) => progress?.status === "completed" || progress?.done)
    .map(([id]) => id);
  return isNodeUnlocked(dest, { completedQuests, flags });
}

export function travelByCarriage(state, dest, price, { roomMap } = {}) {
  if (!isPositiveAmount(price)) return invalidAmountResult();
  if (!canTravelByCarriage(state, dest)) return noOpResult();
  const destNode = getMapNode(dest);
  if ((state.char.money || 0) < price) return noOpResult();

  const cached = roomMap?.[dest];
  const changes = {
    char: { ...state.char, money: (state.char.money || 0) - price },
    room: {
      name: dest,
      desc: destNode.desc,
      exits: Object.keys(destNode.exits),
      npcs: [...(cached?.npcs || [])],
      items: [...(cached?.items || [])],
    },
    time: state.time + 5,
  };
  return {
    changes,
    logs: [
      { t: "room", text: "" },
      { t: "room", text: `    ${dest}（马车）` },
      { t: "room", text: "" },
      { t: "sys", text: `  你乘马车前往${dest}，花费${price}两，平安抵达。` },
    ],
  };
}

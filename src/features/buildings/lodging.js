// 住店与疗伤：客栈安睡 / 医馆回血。
// 从 logic.js 按动作分组拆出。
import { effectiveMaxHp } from "../../domain/kungfu/qucuoKungfu.js";
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";

export function restAtInn(state, { cost, roomType, buildingName }) {
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();

  return {
    changes: {
      char: {
        ...state.char,
        money: state.char.money - cost,
        hp: [effectiveMaxHp(state.char.hp[1], state.skills), state.char.hp[1]],
      },
      time: state.time + 23,
    },
    logs: [{ t: "stat", text: "  气血回满 · 安睡一日" }],
    settle: `在${buildingName}住下${roomType}，花费${cost}两`,
  };
}

export function healAtHospital(state, { cost, healAmt, buildingName }) {
  if (!isPositiveAmount(cost) || !isPositiveAmount(healAmt)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();

  return {
    changes: {
      char: {
        ...state.char,
        money: state.char.money - cost,
        hp: [Math.min(state.char.hp[0] + healAmt, effectiveMaxHp(state.char.hp[1], state.skills)), state.char.hp[1]],
      },
    },
    logs: [],
    settle: `在${buildingName}求医问药，花费${cost}两，恢复了${healAmt}点气血`,
  };
}

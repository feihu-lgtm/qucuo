// 住店与疗伤：客栈安睡 / 医馆回血。
// 从 logic.js 按动作分组拆出。
import { effectiveMaxHp } from "../../domain/data/kungfu/qucuoKungfu.js";
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";
import { fotangCare } from "./emeiFotang.js";

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

// 医馆报价按有效气血上限（含内功被动）算，界面和结算共用。
export function hospitalQuote(state, healPerLiang = 3) {
  const maxHp = effectiveMaxHp(state.char.hp[1], state.skills);
  const missing = Math.max(0, maxHp - state.char.hp[0]);
  return { maxHp, missing, cost: Math.ceil(missing / healPerLiang) };
}

export function healAtHospital(state, { cost: quoted, healAmt, buildingName, buildingId }) {
  const care = fotangCare(state.varTree, buildingId);
  if (care === "refuse") return noOpResult();
  const cost = care === "free" ? 0 : quoted;
  if ((care !== "free" && !isPositiveAmount(cost)) || !isPositiveAmount(healAmt)) return invalidAmountResult();
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
    settle: `在${buildingName}求医问药，${cost ? `花费${cost}两` : "免收诊金"}，恢复了${healAmt}点气血`,
  };
}

import { add, applyWrite, set } from "../../domain/state/applyWrite.js";
import { renderPromptTemplate } from "../../domain/prompt/promptRefs.js";

export function withdrawalSummary(state) {
  const elapsed = state.depositedAt != null
    ? Math.floor((state.time - state.depositedAt) / 24)
    : 0;
  const interest = state.deposit > 0
    ? Math.floor(state.deposit * (Math.pow(1.02, elapsed) - 1))
    : 0;
  return { elapsed, interest, total: state.deposit + interest };
}

function invalidAmountResult() {
  return { logs: [{ t: "err", text: "  数额无效" }] };
}

export function deposit(state, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return invalidAmountResult();
  if ((state.char.money || 0) < amount) return { logs: [] };
  const changes = {
    char: applyWrite(state, add("char.money", -amount)).state.char,
    deposit: state.deposit + amount,
    depositedAt: state.time,
  };
  return {
    changes,
    logs: [],
    settle: renderPromptTemplate(
      "钱庄存款已完成：本次存入@amount两，已从随身银两扣除并入账，存款余额@deposit两，随身银两剩余@char.money两。利息由系统按每24时间单位2%自动计算，无需选择存期或利率。只描写掌柜收讫入账后的反应，不得再询问存期、利率或要求确认存款，也不得重复扣款或入账。",
      { ...changes, amount },
    ).text,
  };
}

export function withdraw(state) {
  const { total } = withdrawalSummary(state);
  return {
    changes: {
      deposit: 0,
      depositedAt: null,
      char: applyWrite(state, add("char.money", total)).state.char,
    },
    logs: [],
    settle: `在钱庄取出银两${total}两（含利息）`,
  };
}

export function pledge(state, itemId, pledgeValue) {
  if (!Number.isFinite(pledgeValue) || pledgeValue <= 0) return invalidAmountResult();
  const item = (state.inv || []).find((entry) => (
    typeof entry === "object" && entry?.id === itemId
  ));
  if (!item) return { logs: [] };

  return {
    changes: {
      inv: applyWrite(state, set("inv", state.inv.filter((entry) => (typeof entry === "object" ? entry.id : entry) !== item.id))).state.inv,
      pledgedItems: [...(state.pledgedItems || []), { item, pledgeValue }],
      char: applyWrite(state, add("char.money", pledgeValue)).state.char,
    },
    logs: [],
    settle: `把「${item.name}」质押给当铺，得${pledgeValue}两`,
  };
}

export function redeem(state, index, redeemCost) {
  if (!Number.isFinite(redeemCost) || redeemCost <= 0) return invalidAmountResult();
  if ((state.char.money || 0) < redeemCost) return { logs: [] };
  const pledged = state.pledgedItems?.[index];
  if (!pledged) return { logs: [] };

  return {
    changes: {
      char: applyWrite(state, add("char.money", -redeemCost)).state.char,
      pledgedItems: state.pledgedItems.filter((_, entryIndex) => entryIndex !== index),
      inv: applyWrite(state, set("inv", [...state.inv, { ...pledged.item, equipped: false }])).state.inv,
    },
    logs: [],
    settle: `从当铺赎回「${pledged.item?.name}」，花费${redeemCost}两`,
  };
}

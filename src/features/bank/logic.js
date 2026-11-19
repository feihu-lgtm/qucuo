export function withdrawalSummary(state) {
  const elapsed = state.depositedAt != null
    ? Math.floor((state.time - state.depositedAt) / 24)
    : 0;
  const interest = state.deposit > 0
    ? Math.floor(state.deposit * (Math.pow(1.02, elapsed) - 1))
    : 0;
  return { elapsed, interest, total: state.deposit + interest };
}

export function deposit(state, amount) {
  if ((state.char.money || 0) < amount) return { logs: [] };
  return {
    changes: {
      char: { ...state.char, money: (state.char.money || 0) - amount },
      deposit: state.deposit + amount,
      depositedAt: state.time,
    },
    logs: [],
    settle: `在钱庄存入${amount}两`,
  };
}

export function withdraw(state) {
  const { total } = withdrawalSummary(state);
  return {
    changes: {
      deposit: 0,
      depositedAt: null,
      char: { ...state.char, money: (state.char.money || 0) + total },
    },
    logs: [],
    settle: `在钱庄取出银两${total}两（含利息）`,
  };
}

export function pledge(state, itemId, pledgeValue) {
  const item = (state.inv || []).find((entry) => (
    typeof entry === "object" && entry?.id === itemId
  ));
  if (!item) return { logs: [] };

  return {
    changes: {
      inv: state.inv.filter((entry) => (typeof entry === "object" ? entry.id : entry) !== item.id),
      pledgedItems: [...(state.pledgedItems || []), { item, pledgeValue }],
      char: { ...state.char, money: (state.char.money || 0) + pledgeValue },
    },
    logs: [],
    settle: `把「${item.name}」质押给当铺，得${pledgeValue}两`,
  };
}

export function redeem(state, index, redeemCost) {
  if ((state.char.money || 0) < redeemCost) return { logs: [] };
  const pledged = state.pledgedItems?.[index];
  if (!pledged) return { logs: [] };

  return {
    changes: {
      char: { ...state.char, money: state.char.money - redeemCost },
      pledgedItems: state.pledgedItems.filter((_, entryIndex) => entryIndex !== index),
      inv: [...state.inv, { ...pledged.item, equipped: false }],
    },
    logs: [],
    settle: `从当铺赎回「${pledged.item?.name}」，花费${redeemCost}两`,
  };
}

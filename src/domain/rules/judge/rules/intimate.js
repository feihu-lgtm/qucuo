// ── V8 亲密回合社交结算：门禁放行回合按态度档位签发 MUTATE_SOCIAL 好感事实 ──
// 缺口背景：判官社交结算原只有 talk/give/appease/learn 四条目，亲密互动零好感通道。
// 档位确定性裁定不掷骰（与 talk 同哲学——亲密不该有随机社交风险）：
// 好感余量=好感度-亲密门槛，门槛低反衬情愿度；凭卡强开=被迫档（无从推拒不是情愿）。
// 判意/门禁在 judgePhase（D8），判官只读 envelope.intimateCtx 透传结果，不重判。

// 档位表（余量=好感度-门槛）：
//   凭卡强开        → 被迫 -3（ledgerKind 怨，reason 闺房被迫）
//   余量<0 非凭卡   → 勉强 -2（兜底边缘——门禁理论上不放行，凭卡除外，别漏判）
//   余量 0-9        → 半推半就 +1
//   余量 10-24      → 温存 +2
//   余量 ≥25        → 你情我愿 +3
export function intimateTier({ ticket, margin }) {
  if (ticket) return { delta: -3, ledgerKind: "怨", reason: "闺房被迫" };
  if (margin < 0) return { delta: -2, ledgerKind: "怨", reason: "闺房勉强" };
  if (margin >= 25) return { delta: 3, ledgerKind: "恩", reason: "闺房温存" };
  if (margin >= 10) return { delta: 2, ledgerKind: "恩", reason: "闺房温存" };
  return { delta: 1, ledgerKind: "恩", reason: "闺房温存" };
}

// 每回合至多签发一条亲密好感事实——门禁放行即「发生了」，与同回合动作条数无关。
export function handleIntimate(J) {
  const ictx = J.envelope?.intimateCtx;
  if (!ictx?.npc) return; // 非亲密回合/门禁未放行——判官不补闸
  const npc = (J.npcs || []).find((n) => n?.name === ictx.npc);
  if (!npc) return;
  // 无好感轨道对象（兽类/intimacy.forbidden）不产社交事实——与 handleTalk 第一道
  // 防线同口径。凭卡可撬开 forbidden 门槛，但不通人情的对象依旧不涨不跌。
  if (npc.intimacy?.forbidden || npc.beast) return;
  const margin = (Number(ictx.affection) || 0) - (Number(ictx.threshold) || 0);
  const tier = intimateTier({ ticket: !!ictx.ticket, margin });
  if (!tier.delta) return;
  J.facts.push({
    id: J.nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
    affectionDelta: tier.delta, ledgerKind: tier.ledgerKind,
    reason: tier.reason,
    // 闺房密事不该全村目击——witnesses 收窄只主角+对象（与 talk 同口径）。
    witnesses: ["主角", npc.name],
  });
}

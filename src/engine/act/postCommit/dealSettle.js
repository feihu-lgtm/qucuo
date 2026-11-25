// ── 赌石谈价结算（postCommit 处理器，原 commitRound 内嵌块迁出，逻辑逐字保留）──
// 路线甲纯函数化：返回 { logs, changes, refWrites } 由 commitRound 统一落盘。
import { settleNegotiation as gambleSettleNegotiation } from "../../../domain/rules/economy/gambleStone.js";

export function settleDeal({ dealResult, gambleTalkCtx }) {
  // ── 赌石谈价结算（轻量勾连）──
  // 若这轮在谈价语境、且 AI 回了 <deal> 标签：系统 clamp 倍率 + 校验赠物，
  // 把调整后报价写进 gambleNegotiation[stoneId][bidderName]，赌桌读它更新报价、按新价结算。
  // 数值全由系统裁决（settleNegotiation clamp[0.8,1.5]），AI 越权无效。
  const ctx = gambleTalkCtx;
  const out = {};
  if (dealResult && ctx) {
    const baseOffer = ctx.baseOffer || 0;
    const settled = gambleSettleNegotiation(
      { offer: baseOffer, cash: ctx.cash || Infinity },
      dealResult,
      ctx.carry || []
    );
    if (ctx.stoneId && ctx.bidderName && settled.finalOffer !== baseOffer) {
      out.changes = {
        gambleNegotiation: (prev) => ({
          ...prev,
          [ctx.stoneId]: { ...(prev[ctx.stoneId] || {}), [ctx.bidderName]: settled.finalOffer },
        }),
      };
      const diff = settled.finalOffer - baseOffer;
      out.logs = [{ t: "affection", text: `  🤝 谈妥了：${ctx.bidderName} 的出价 ${diff > 0 ? "抬到" : "变为"} ${settled.finalOffer} 两${settled.addItem ? `，另搭「${settled.addItem.name || settled.addItem}」` : ""}。回赌桌可按此价结算。` }];
    }
  }
  // 谈价这轮处理完就清标记（下一句普通对话不再当谈价）
  if (ctx) out.changes = { ...out.changes, gambleSession: null };
  return Object.keys(out).length ? out : null;
}

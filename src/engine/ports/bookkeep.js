// 记账调用口：提示词注册与解析留在 domain（memory/bookkeep.js + calls/bookkeep.js），
// AI 调用上移到 engine/ports。
import { withAI } from "./withAI.js";

/**
 * 跑一轮记账。AI 关/调用失败/回复不可用时都返回 { ledger:{} }。
 * @param {{ai: object, apiCfg: object, ctx: {narration: string, settleSummary: string, presentNames: string[], ledgers: Object<string,string[]>, turn: number}}} args
 * @returns {Promise<{ledger: Object<string,string[]>}>}
 */
export async function runBookkeep({ ai, apiCfg, ctx }) {
  try {
    const res = await withAI("bookkeep.turn", ctx || {}, { ai, apiCfg, throwOnError: false });
    if (!res?.ok || !res.data) return { ledger: {} };
    return res.data;
  } catch {
    return { ledger: {} };
  }
}

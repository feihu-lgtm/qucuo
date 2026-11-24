// ── 「女眷一次卡·不可拒绝」焚卡：resolveIntent 判凭卡强开后记 plan.intimateTicket，
// 回合成功落盘才消耗（失败/回滚不进本链，卡不会被吞）。亮卡提示也挂在这里——
// 焚卡与提示同生死，不留「亮了卡却没烧」的对不上账。
import { INTIMATE_TICKET_NAME } from "../../../domain/rules/npc/goldenEgg.js";
import { updateField, set, applyWrite } from "../../../domain/rules/state/applyWrite.js";

export function burnIntimateTicket({ intimateTicket }) {
  if (!intimateTicket) return null;
  return {
    logs: [{ t: "sys", text: `  你亮出「${INTIMATE_TICKET_NAME}」，卡片在你指尖燃成一缕金线——这一次，无人能拒。` }],
    changes: {
      // 焚卡 + 亲密烙印（resolveIntent 里凭卡强开没即时标）：同一步落盘，回合才作数。
      inv: updateField("inv", (prev) => {
        const items = prev || [];
        const idx = items.findIndex((i) => (typeof i === "object" && i ? i.name : i) === INTIMATE_TICKET_NAME);
        return set("inv", idx === -1 ? items : [...items.slice(0, idx), ...items.slice(idx + 1)]);
      }),
      varTree: (prev) => applyWrite({ varTree: prev }, set(["角色", intimateTicket, "已亲密"], true)).state.varTree,
      room: (r) => ({ ...r, npcs: (r.npcs || []).map((n) => (n.name === intimateTicket ? { ...n, intimate: true } : n)) }),
    },
  };
}

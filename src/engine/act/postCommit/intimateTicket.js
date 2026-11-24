// ── 「女眷一次卡·不可拒绝」焚卡：resolveIntent 判凭卡强开后记 plan.intimateTicket，
// 回合成功落盘才消耗（失败/回滚不进本链，卡不会被吞）。亮卡提示也挂在这里——
// 焚卡与提示同生死，不留「亮了卡却没烧」的对不上账。
import { INTIMATE_TICKET_NAME } from "../../../domain/rules/npc/goldenEgg.js";
import { updateField, set } from "../../../domain/rules/state/applyWrite.js";

export function burnIntimateTicket({ intimateTicket }) {
  if (!intimateTicket) return null;
  return {
    logs: [{ t: "sys", text: `  你亮出「${INTIMATE_TICKET_NAME}」，卡片在你指尖燃成一缕金线——这一次，无人能拒。` }],
    changes: {
      inv: updateField("inv", (prev) => {
        const items = prev || [];
        const idx = items.findIndex((i) => (typeof i === "object" && i ? i.name : i) === INTIMATE_TICKET_NAME);
        return set("inv", idx === -1 ? items : [...items.slice(0, idx), ...items.slice(idx + 1)]);
      }),
    },
  };
}

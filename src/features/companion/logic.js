import { setActiveCompanion, companionMeta } from "../../domain/rules/companion/companion.js";

// 换出战位。留守在别处的队友不能隔空上场：先去那个房间把人接回来（接回时有重逢那一幕），
// 再换上出战位——拒绝时只给一行系统提示、不改状态（调用方据此不占撤销点）。
export function switchCompanion(state, key) {
  const target = key ? state?.companionState?.[key] : null;
  const label = key ? companionMeta(state?.companionState, key).label : null;
  if (target?.stationed) {
    const where = target.stationed.roomName || target.stationed.district || "别处";
    return { logs: [{ t: "sys", text: `  ${label}还留守在${where}，先去把人接回来才能上场。` }] };
  }
  return {
    changes: { companionState: cs => setActiveCompanion(cs, key) },
    logs: [{ t: "sys", text: label ? `  （${label}换上了出战位。）` : "  （换下了出战位，队友照常随行。）" }],
  };
}

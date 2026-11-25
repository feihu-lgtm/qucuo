import { setActiveCompanion, companionMeta, unstationCompanion } from "../../domain/rules/companion/companion.js";

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

// 当面接回留守的队友：人得在玩家当前所在的据点/房间才行，接回后归随行队列，之后才能换上出战位。
// 重逢那一句由调用方按需另写（浏览器端走 AI 补写；CLI 只落状态）。
export function recallCompanion(state, key) {
  const cs = state?.companionState;
  const target = cs?.[key];
  const label = companionMeta(cs, key).label;
  if (!target?.stationed) return { logs: [{ t: "sys", text: `  ${label}没有留守，就在身边。` }] };
  const here = state.innerRoomName || state.room?.name;
  const spot = target.stationed;
  if (spot.district !== state.room?.name || (spot.roomId !== here && spot.roomName !== here)) {
    return { logs: [{ t: "sys", text: `  ${label}留守在${spot.roomName || spot.district}，不在这里。` }] };
  }
  return {
    changes: { companionState: (prev) => unstationCompanion(prev, key) },
    logs: [{ t: "sys", text: `  ${label}收拾行装，跟上了你的脚步。` }],
  };
}

import {
  setActiveCompanion, companionMeta, unstationCompanion,
  companionKeyByName, setCompanionFormState,
} from "../../domain/rules/companion/companion.js";
import { setCompanionDescForm } from "../../domain/rules/companion/companionForms.js";
import { writePath } from "../../domain/rules/state/applyWrite.js";

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

// 切换化形灵兽同伴的当前形态（"human" | "beast"），同步 companionState、varTree 与本地立绘/文案选择。
export function switchCompanionForm(state, keyOrName, form) {
  const cs = state?.companionState;
  const key = cs?.[keyOrName] ? keyOrName : companionKeyByName(keyOrName);
  const slot = key ? cs?.[key] : null;
  if (!slot?.unlocked || !slot?.data) {
    return { logs: [{ t: "sys", text: "  尚未与该同伴结伴同行。" }] };
  }
  const normalized = form === "beast" ? "beast" : "human";
  const meta = companionMeta(cs, key);
  if (!meta.humanName) {
    return { logs: [{ t: "sys", text: `  ${meta.label}没有化形形态切换。` }] };
  }
  const nextCs = setCompanionFormState(cs, key, normalized);
  if (nextCs === cs) {
    const curLabel = normalized === "human" ? `人形「${meta.humanName}」` : `兽形「${meta.beastName}」`;
    return { logs: [{ t: "sys", text: `  ${meta.humanName}眼下已是${curLabel}。` }] };
  }
  setCompanionDescForm(key, normalized);
  const formText = normalized === "human" ? "人形" : "兽形";
  return {
    changes: {
      companionState: (prev) => setCompanionFormState(prev, key, normalized),
      varTree: (prev) => {
        let tree = writePath(prev || {}, ["角色", meta.label, "形态"], formText);
        tree = writePath(tree, ["角色", meta.label, "化形人名"], meta.humanName);
        tree = writePath(tree, ["角色", meta.label, "已化形"], true);
        return tree;
      },
    },
    logs: [{
      t: "sys",
      text: normalized === "human"
        ? `  灵息一转，${meta.beastName}化回人形女子「${meta.humanName}」同行。`
        : `  ${meta.humanName}收起人形，化回${meta.beastName}真身随行在侧。`,
    }],
  };
}

// 旧行动识别链的 MOVE 槽位补齐（#670）：分类模型只会从「北/南/东/西」里挑方向，
// 玩家说「进断鞍古驿」「去大草甸」时方向槽是空的，闸门会拒成「没说清往哪走」。
// 这里在闸门前按原话片段确定性补齐：点名本地建筑→进门（必要时先走一步到门前），
// 点名相邻据点→填方向并标明出村；点名了却去不了→给出具体原因。
import { ACTION_KINDS, NONE } from "./actionKinds.js";
import { resolveBuildingIntent, resolveOuterPlaceIntent } from "../map/placeIntent.js";

const DIR_LABEL = { n: "北", s: "南", e: "东", w: "西" };

function fillOne(state, action) {
  if (action?.kind !== ACTION_KINDS.MOVE) return action;
  if (action.direction && action.direction !== NONE) return action;
  const text = action.text || "";
  const building = resolveBuildingIntent(state, text);
  if (building) {
    const enterBuilding = { ...building.building, district: building.district };
    if (building.type === "enter") return { ...action, enterBuilding };
    if (building.type === "approach" && !building.wantsEnter) return { ...action, direction: DIR_LABEL[building.dir], innerDest: building.innerRoom };
    if (building.type === "approach") return { ...action, enterBuilding, innerDir: building.dir };
    const where = building.innerRoom ? `${building.district}的「${building.innerRoom}」` : building.district;
    return { ...action, moveHint: `「${building.building.name}」在${where}，离这里还隔着几间房，先往那边走` };
  }
  const outer = resolveOuterPlaceIntent(state, text);
  if (outer?.type === "outer") return { ...action, direction: DIR_LABEL[outer.dir], outerDest: outer.dest };
  if (outer?.type === "locked") return { ...action, moveHint: `去「${outer.dest}」的路尚未开启` };
  if (outer?.type === "unreachable") return { ...action, moveHint: `从「${outer.from}」没有直通「${outer.dest}」的路，须先经相邻地点分段赶路` };
  return action;
}

export function fillMoveSlots(state, actions) {
  return (actions || []).map((action) => fillOne(state, action));
}

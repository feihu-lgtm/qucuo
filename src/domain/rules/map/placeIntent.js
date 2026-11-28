// 文字指令里的地名/建筑名解析（#670）：玩家说「进断鞍古驿」「去大草甸」时，
// 用闭合候选表（本地建筑、内层房、相邻据点）确定性认出去处，不交给模型猜。
// 两条回合链共用：旧行动识别链在系统闸门前补齐 MOVE 槽位，判官链在 judgeRoutes 里用。
import { getBuildingsForLocation } from "../../data/buildings/qucuoBuildings.js";
import { QUCUO_MAP, isNodeUnlocked } from "../../data/map/qucuoMap.js";
import { getBuildingIdForInnerRoom, getInnerRoomNames, hasInnerMap, visibleInnerExits } from "./innerMap.js";

// 原话点名判定：子串命中且后一个字不是建物后缀——「大草甸营地」里的「大草甸」
// 不算点名（整词是另一地名），incidental 提及不误当目的地。
const PLACE_SUFFIX_RE = /[营寨馆楼村庄镇城山谷甸滩口坪院宅府棚帐行店铺栈]/;
export function mentionsPlaceName(text, name) {
  const idx = String(text || "").indexOf(name);
  if (idx < 0) return false;
  const nextCh = String(text)[idx + name.length] || "";
  return !(nextCh && PLACE_SUFFIX_RE.test(nextCh));
}

// 地名匹配：先精确，再唯一子串——只认「短名含于全名」（饭馆⊂老孙饭馆、草甸⊂大草甸），
// 不认反向；子串命中多个候选时宁可不认也不猜。
export function matchPlaceName(target, candidates, { exactOnly = false } = {}) {
  if (!target) return "";
  const list = [...candidates].filter(Boolean);
  if (list.includes(target)) return target;
  if (exactOnly) return "";
  if (target.length < 2) return "";
  const hits = list.filter((name) => name !== target && name.includes(target));
  return hits.length === 1 ? hits[0] : "";
}

// 已完成任务集合——与 features/map 同口径，供据点解锁判定。
export function completedQuestIdSet(questProgress) {
  const out = new Set();
  for (const [id, q] of Object.entries(questProgress || {})) {
    if (q?.status === "completed") out.add(id);
  }
  return out;
}

// 此地可见建筑：有内层地图的据点只显示当前内层房挂着的那一座（与左栏「此地建筑」同源）。
export function visibleBuildingsAt(roomName, innerRoomName) {
  const all = getBuildingsForLocation(roomName);
  if (!hasInnerMap(roomName) || !innerRoomName) return all;
  const bid = getBuildingIdForInnerRoom(roomName, innerRoomName);
  return bid ? all.filter((b) => b.id === bid) : [];
}

// 进门/前往类动词；单说建筑名（「断鞍古驿」）也算要进。
const ENTER_VERB_RE = /进入|进去|走进|踏进|迈进|进到|入内|进|去|到|前往|赶往|拜访|逛/;

function innerRoomOfBuilding(roomName, buildingId) {
  if (!hasInnerMap(roomName)) return "";
  return getInnerRoomNames(roomName).find((r) => getBuildingIdForInnerRoom(roomName, r) === buildingId) || "";
}

/**
 * 原话点名本据点的某座建筑时，给出进门方案：
 *   enter    建筑就在眼前（左栏可见）→ 直接进门
 *   approach 建筑所在内层房与当前房相邻 → 先走一步到门前（dir 为 n/s/e/w）
 *   far      建筑在本据点但隔着几间房 → 告知所在位置
 * wantsEnter：原话有「进/入」类进门动词或只说了建筑名——只说「去/到」的，调用方只走到门前不开门。
 * 未点名建筑、或只是顺口提到（无进门动词且不止建筑名本身）时返回 null。
 */
export function resolveBuildingIntent(state, text) {
  const raw = String(text || "").trim();
  const roomName = state?.room?.name || "";
  if (!raw || !roomName) return null;
  const buildings = [...getBuildingsForLocation(roomName)].sort((a, b) => b.name.length - a.name.length);
  const building = buildings.find((b) => raw.includes(b.name));
  if (!building) return null;
  const idx = raw.indexOf(building.name);
  // 建筑是出发点（「从铁匠铺出来去村口」「离开饭馆」）就不是要进门。
  const before = raw.slice(Math.max(0, idx - 2), idx);
  const after = raw.slice(idx + building.name.length, idx + building.name.length + 2);
  if (/从|离开|出了|走出|出$/.test(before) || /^出[来去门]/.test(after)) return null;
  const rest = raw.split(building.name).join("").replace(/[\s，。！!？?、]/g, "");
  if (!ENTER_VERB_RE.test(rest) && rest.length > 2) return null;
  const wantsEnter = /进|入/.test(rest) || rest === "";

  const innerNow = state?.innerRoomName ?? null;
  if (visibleBuildingsAt(roomName, innerNow).some((b) => b.id === building.id)) {
    return { type: "enter", building, district: roomName, wantsEnter };
  }
  const hostRoom = innerRoomOfBuilding(roomName, building.id);
  if (hostRoom && innerNow) {
    const exits = visibleInnerExits(roomName, innerNow, {
      questProgress: state?.questProgress, flags: state?.flags || [],
      inv: state?.inv || [], char: state?.char || {}, varTree: state?.varTree || {},
    });
    const dir = Object.entries(exits).find(([, dest]) => dest === hostRoom)?.[0];
    if (dir) return { type: "approach", building, district: roomName, dir, innerRoom: hostRoom, wantsEnter };
  }
  return { type: "far", building, district: roomName, innerRoom: hostRoom, wantsEnter };
}

/**
 * 原话点名某个外层据点时，按当前据点的出口给出赶路方案：
 *   outer       相邻且已开启 → dir/dest
 *   locked      相邻但前路未开
 *   unreachable 不相邻（须分段赶路）
 * 原话没点名任何外层据点（或点的是当前据点）时返回 null。最长名优先，带建物后缀的整词不算点名。
 */
export function resolveOuterPlaceIntent(state, text) {
  const roomName = state?.room?.name || "";
  const dest = Object.keys(QUCUO_MAP)
    .filter((name) => name !== roomName)
    .sort((a, b) => b.length - a.length)
    .find((name) => mentionsPlaceName(text, name));
  if (!dest) return null;
  const exits = QUCUO_MAP[roomName]?.exits || {};
  const dir = Object.entries(exits).find(([, d]) => d === dest)?.[0] || "";
  if (!dir) return { type: "unreachable", dest, from: roomName };
  const unlockCtx = { completedQuests: completedQuestIdSet(state?.questProgress), flags: state?.flags || [] };
  if (!isNodeUnlocked(dest, unlockCtx)) return { type: "locked", dest, dir };
  return { type: "outer", dest, dir };
}

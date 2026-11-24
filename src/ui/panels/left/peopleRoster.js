import { isNpcVisibleInInnerRoom } from "../../../domain/rules/map/innerMap.js";
import {
  unlockedCompanions, stationedNpcsFor, activeCompanionKey,
} from "../../../domain/rules/companion/companion.js";

// 随行队友（已解锁且没留守）折成 room.npcs 条目形状。
// 【为什么单拎】随行队友形影不离（见 roundNotes.buildPresence），"坐标"恒等于玩家坐标，
// 不会写进任何房间的 room.npcs；左栏若只看 room.npcs，玩家走到哪都会把他们当成
// "不在此地"。判定口径与 buildPartyListBlock（喂给 AI 的随行清单）一致：
// 已解锁 + 非留守，即不止出战位那一个。
function partyNpcs(companionState) {
  const activeKey = activeCompanionKey(companionState);
  return unlockedCompanions(companionState)
    .filter(slot => !companionState[slot.key]?.stationed)
    .map(slot => {
      const d = companionState[slot.key].data;
      return {
        name: slot.label, id: slot.key, companion: true, party: true, active: slot.key === activeKey,
        beast: !!slot.beast, brief: d?.brief || slot.label, levelCap: d?.levelCap,
      };
    });
}

// 左栏「此地」「不在此地」两段名单的划分（纯函数）。
// present = 本房间（按内层房间过滤）的本地人 + 随行队友 + 留守在此房的队友；
// absent  = 曾遇人物里既不在此据点、也不随行/留守在此的人（留守在别处的队友自然落这里）。
export function partitionPeople({ room, innerRoomName, companionState, everSeen = [] }) {
  const party = partyNpcs(companionState);
  const stationedHere = stationedNpcsFor(companionState, {
    district: room.name, roomId: innerRoomName || room.name, roomName: innerRoomName || room.name,
  });
  const companionNames = new Set([...party, ...stationedHere].map(n => n.name));
  // 队友若同名挂在 room.npcs 里（导入前的本地 NPC 条目），以队友条目为准，避免重复一行。
  const local = (room.npcs || [])
    .filter(n => !companionNames.has(n.name) && isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
  const present = [...local, ...party, ...stationedHere];
  const roomNames = new Set([...(room.npcs || []).map(n => n.name), ...companionNames]);
  const absent = everSeen.filter(name => !roomNames.has(name));
  return { present, absent };
}

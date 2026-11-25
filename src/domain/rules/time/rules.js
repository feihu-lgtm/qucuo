import { random } from "../../../utils/rng.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { mapDescriptionToGenParams } from "../../data/npc/npcDescriptionMapping.js";
import { NPC_POOL, toRoomNpc } from "../../data/npc/npcPool.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { tickAngryState } from "../combat/stealSystem.js";
import { makeItem } from "../economy/equipment.js";
import { makeItemSmart } from "../../data/items/catalog.js";
import { hasInnerMap, isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { cleanExpiredBuffs } from "../../../utils/buffSystem.js";
import { buildRoomNpcWithCombat } from "../npc/rules.js";
import { npcTradeOf } from "../npc/npcTrade.js";

const QUALITIES = ["白", "绿", "蓝", "紫", "橙", "红"];
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

function makeEscalationNpc(record, state, { pool = false } = {}) {
  const base = pool
    ? { ...toRoomNpc(record), ...record, id: toRoomNpc(record).id }
    : { ...record, id: record.id || `npc_${record.name}` };
  const inferred = mapDescriptionToGenParams(`${base.name || ""} ${base.brief || ""} ${base.personality || ""}`);
  return ensureNpcCombatData(base, {
    luck: state.char?.special?.气运 ?? 5,
    levelCap: base.levelCap ?? inferred.levelCap,
    trade: npcTradeOf(state.npcState, base),
  });
}

function findEscalationNpc(name, state, roomMap, importedRegistry) {
  const present = (state.room?.npcs || []).find((npc) => npc.name === name);
  if (present) return present;
  for (const cachedRoom of Object.values(roomMap || {})) {
    const cachedNpc = (cachedRoom?.npcs || []).find((npc) => npc.name === name);
    if (cachedNpc) return ensureNpcCombatData(cachedNpc, { luck: state.char?.special?.气运 ?? 5, trade: npcTradeOf(state.npcState, cachedNpc) });
  }
  const imported = importedRegistry?.getImportedNpc?.(name, { asPoolNpc: true });
  if (imported) return buildRoomNpcWithCombat(imported, { luck: state.char?.special?.气运 ?? 5, trade: npcTradeOf(state.npcState, imported) });
  const resident = Object.values(RESIDENT_NPCS).flat().find((npc) => npc.name === name);
  if (resident) return makeEscalationNpc(resident, state);
  const poolNpc = NPC_POOL.find((npc) => npc.name === name);
  return poolNpc ? makeEscalationNpc(poolNpc, state, { pool: true }) : null;
}

function moveNpcRoomCache(roomMap, room, npcs) {
  const names = new Set(npcs.map((npc) => npc.name));
  const next = Object.fromEntries(Object.entries(roomMap).map(([roomName, cached]) => {
    if (!Array.isArray(cached?.npcs)) return [roomName, cached];
    const filtered = cached.npcs.filter((npc) => !names.has(npc.name));
    return [roomName, filtered.length === cached.npcs.length ? cached : { ...cached, npcs: filtered }];
  }));
  if (room?.name) {
    const cached = next[room.name] || {};
    next[room.name] = {
      ...cached,
      items: [...(room.items || cached.items || [])],
      npcs: [...(room.npcs || []).filter((npc) => !names.has(npc.name)), ...npcs],
    };
  }
  return next;
}

function moveNpcToInnerRoom(npc, districtName, innerRoomName) {
  const moved = {
    ...npc,
    pursuitInnerRoom: hasInnerMap(districtName) ? (innerRoomName || null) : null,
  };
  if (innerRoomName) moved.innerRoom = innerRoomName;
  else delete moved.innerRoom;
  return moved;
}

function parseForgeOrder(flag) {
  const parts = flag.split("_");
  const n = Number(parts[3]);
  const luck = Number.isFinite(n) ? n : 5;
  let quality = QUALITIES[Math.min(4, Math.floor(luck / 2.5))];
  let spec = null;
  if (parts[4] && parts[4] !== "-") {
    try {
      spec = JSON.parse(decodeURIComponent(parts[4]));
    } catch {
      spec = null;
    }
  }

  let name;
  let category;
  let effect;
  let sixDim;
  let isJade = false;
  if (spec?.name) {
    name = spec.name;
    category = ["weapon", "armor", "accessory"].includes(spec.category) ? spec.category : "weapon";
    effect = spec.effect && typeof spec.effect === "object" && Object.keys(spec.effect).length
      ? spec.effect
      : undefined;
    sixDim = spec.sixDim && typeof spec.sixDim === "object" && Object.keys(spec.sixDim).length
      ? spec.sixDim
      : undefined;
    if (spec.jade && spec.qualityCap) {
      isJade = true;
      const capIdx = QUALITIES.indexOf(spec.qualityCap);
      if (capIdx >= 0 && capIdx < QUALITIES.indexOf(quality)) quality = spec.qualityCap;
    }
  } else {
    let material = "";
    if (parts[4] && parts[4] !== "-") {
      try {
        material = decodeURIComponent(parts[4]);
      } catch {
        material = parts[4];
      }
    }
    name = material ? `${material}剑` : "定制长剑";
    category = "weapon";
  }

  if (QUALITIES.indexOf(quality) < 2) {
    effect = undefined;
    sixDim = undefined;
  }
  const item = makeGameItem({ name, category, quality, ...(effect ? { effect } : {}), ...(sixDim ? { sixDim } : {}) });
  return {
    item: {
      ...item,
      id: `forge_${parts[2]}_${random().toString(36).slice(2, 6)}`,
      equipped: false,
    },
    deliveredName: { text: `${name}（${quality}）`, jade: isJade },
  };
}

export const timeAdvanceRule = {
  id: "time.advance",
  deps: (state) => [state.time, state.room?.npcs],
  run(state, { firstRun, previousDeps, roomMap, importedRegistry }) {
    if (firstRun || Object.is(state.time, previousDeps?.[0])) return null;

    const time = state.time;
    const currentFlags = state.flags || [];
    const filteredFlags = cleanExpiredBuffs(currentFlags, time);
    const cleanedFlags = filteredFlags.length === currentFlags.length ? currentFlags : filteredFlags;
    const matured = cleanedFlags.filter((flag) => {
      if (!flag.startsWith("forge_pending_")) return false;
      const orderedAt = Number(flag.split("_")[2]);
      return Number.isFinite(orderedAt) && time - orderedAt >= 24;
    });
    const maturedSet = new Set(matured);
    const nextFlags = matured.length
      ? cleanedFlags.filter((flag) => !maturedSet.has(flag))
      : cleanedFlags;
    const changes = {};
    const logs = [];

    if (nextFlags !== currentFlags) {
      changes.flags = (previous) => {
        const filtered = cleanExpiredBuffs(previous, time);
        const latest = filtered.length === previous.length ? previous : filtered;
        return matured.length ? latest.filter((flag) => !maturedSet.has(flag)) : latest;
      };
    }

    if (matured.length) {
      const items = [];
      const deliveredNames = [];
      for (const flag of matured) {
        const { item, deliveredName } = parseForgeOrder(flag);
        items.push(item);
        deliveredNames.push(deliveredName);
      }
      const anyJade = deliveredNames.some((entry) => entry.jade);
      const names = deliveredNames.map((entry) => entry.text).join("」「");
      changes.inv = (previous) => [...(previous || []), ...items];
      logs.push({
        t: "item",
        text: anyJade
          ? `  💎 金玉行的伙计寻来，将雕琢好的「${names}」奉到你手上，已收入行囊。`
          : `  🔨 铁匠铺的伙计寻来，将打造好的「${names}」送到你手上，已收入行囊。`,
      });
    }

    const angerUpdates = [];
    const pursuedNpcs = [];
    // roomMap 由调用方以纯值注入（WO-06 前为 roomMapRef 跨层 ref）
    let nextRoomMap;
    let forcedDuelNpc;
    for (const [name, attrs] of Object.entries(state.varTree?.角色 || {})) {
      if (!attrs.生气状态?.active) continue;
      const anger = tickAngryState(attrs.生气状态);
      angerUpdates.push([name, anger]);
      if (!anger.escalated) continue;
      const npc = (state.room?.npcs || []).find((entry) => entry.name === name);
      if (npc && isNpcVisibleInInnerRoom(state.room?.name, state.innerRoomName, npc)) {
        logs.push({ t: "err", text: `  ${name}积怒难平，终于按捺不住，径直朝你逼了过来——这场恶斗，躲不掉了！` });
        forcedDuelNpc = npc;
        continue;
      }
      const foundNpc = findEscalationNpc(name, state, roomMap, importedRegistry);
      if (!foundNpc) {
        logs.push({ t: "sys", text: `  ${name}已不知所踪，积怒也随时间不了了之。` });
        continue;
      }
      const pursuer = moveNpcToInnerRoom(foundNpc, state.room?.name, state.innerRoomName);
      pursuedNpcs.push(pursuer);
      forcedDuelNpc = pursuer;
      logs.push({ t: "err", text: `  ${name}一路寻来，堵在你面前——积怒难平，这场恶斗躲不掉了！` });
    }

    if (angerUpdates.length) {
      changes.varTree = (previous) => {
        const characters = { ...(previous?.角色 || {}) };
        for (const [name, anger] of angerUpdates) {
          characters[name] = { ...(characters[name] || {}), 生气状态: anger };
        }
        return { ...previous, 角色: characters };
      };
    }
    if (pursuedNpcs.length) {
      const pursuersByName = new Map(pursuedNpcs.map((npc) => [npc.name, npc]));
      changes.room = (previous) => {
        const updatedNames = new Set();
        const npcs = (previous.npcs || []).map((npc) => {
          const pursuer = pursuersByName.get(npc.name);
          if (!pursuer) return npc;
          updatedNames.add(npc.name);
          return pursuer;
        });
        return {
          ...previous,
          npcs: [...npcs, ...pursuedNpcs.filter((npc) => !updatedNames.has(npc.name))],
        };
      };
      if (roomMap) nextRoomMap = moveNpcRoomCache(roomMap, state.room, pursuedNpcs);
    }

    if (!Object.keys(changes).length && !logs.length) return null;
    return {
      changes,
      logs,
      ...(nextRoomMap ? { roomMap: nextRoomMap } : {}),
      ...(forcedDuelNpc ? { forcedDuelNpc } : {}),
    };
  },
};

import { isCompanionUnlockedByName, companionKeyByName } from "../companion/companion.js";
import { hasInnerMap, getInnerRoomNames, getPublicInnerRoomNames } from "../map/innerMap.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { mapDescriptionToGenParams } from "../../data/npc/npcDescriptionMapping.js";
import { NPC_POOL, getScheduledNpcs, toRoomNpc } from "../../data/npc/npcPool.js";
import { getCrowd, getRandomPassers } from "../../data/npc/randomPassers.js";
import { injectNpcs } from "../npc/roomNpcs.js";
import { getResidentNpcs, RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { ESCORT_QUESTS } from "../../data/quests/escortQuests.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { parseQuestPlace, questPlaceDistrict } from "../quests/questPlace.js";

const NPC_FIELDS = [
  "levelCap", "special", "beast", "unlearnable", "cannotSpeak", "affectionable",
  "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder",
  "lockInnerRoom", "bidderKind", "companionCandidate", "guaranteedDrop",
  "portrait", "neigong", "waigong", "imported", "hostile", "faction", "gender", "randomPasser",
];

export function buildRoomNpcWithCombat(poolNpc, { existingNpc, luck = 5 } = {}) {
  if (existingNpc?.moveset && existingNpc?.carriedItems && existingNpc?.special && existingNpc?.combatStats) {
    return { ...existingNpc };
  }
  const base = toRoomNpc(poolNpc);
  for (const key of NPC_FIELDS) {
    if (poolNpc[key] !== undefined) base[key] = poolNpc[key];
  }
  const inferred = mapDescriptionToGenParams(
    `${poolNpc.name || ""} ${poolNpc.brief || ""} ${poolNpc.personality || ""}`,
  );
  const levelCap = poolNpc.levelCap ?? inferred.levelCap;
  return ensureNpcCombatData(base, { luck, levelCap });
}

// 迁过据点的常驻 → 原据点。旧存档还把人缓存在原据点：进新据点照样请到，回原据点把人清掉
const RELOCATED_RESIDENTS = { 唐老太: "锦官城", 说书人陈七: "天都镇" };

export const residentNpcRule = {
  id: "npc.residents",
  deps: (state) => [
    state.room?.name,
    Math.floor(state.time / 24),
    state.questProgress,
    state.flags,
    state.importedVer,
  ],
  run(state, { importedRegistry, roomMapRef, companionState = state.companionState }) {
    const { room, time, questProgress = {}, flags = [], char } = state;
    if (!room?.name) return null;
    const dayIdx = Math.floor(time / 24);
    const luck = char?.special?.气运 ?? 5;
    const existingByName = new Map((room.npcs || []).map((npc) => [npc.name, npc]));
    const currentNpcNames = new Set(existingByName.keys());
    const cachedNpcNames = new Set(
      Object.entries(roomMapRef?.current || {})
        .filter(([roomName]) => roomName !== room.name)
        .flatMap(([roomName, cached]) => (cached?.npcs || [])
          .filter((npc) => RELOCATED_RESIDENTS[npc.name] !== roomName)
          .map((npc) => npc.name)),
    );
    // 常驻写了 goneFlags（被处决、囚禁等），任一 flag 已立就不再出现，旧缓存里的也清掉
    const isGoneResident = (npc) => (npc.goneFlags || []).some((flag) => flags.includes(flag));
    const goneResidentNames = new Set(getResidentNpcs(room.name).filter(isGoneResident).map((npc) => npc.name));
    const staleNames = new Set((room.npcs || [])
      .filter((npc) => !npc.imported && (RELOCATED_RESIDENTS[npc.name] === room.name || goneResidentNames.has(npc.name)))
      .map((npc) => npc.name));
    const toRoomNpcWithCombat = (poolNpc) => buildRoomNpcWithCombat(poolNpc, {
      existingNpc: existingByName.get(poolNpc.name),
      luck,
    });

    const poolNpcs = getScheduledNpcs(room.name, time).map(toRoomNpcWithCombat);
    const companionJoined = (name) => {
      const key = companionKeyByName(name);
      return !!(key && companionState?.[key]?.unlocked);
    };
    const residentNpcs = getResidentNpcs(room.name)
      .filter((npc) => !(npc.companionCandidate && companionJoined(npc.name)))
      .filter((npc) => !isGoneResident(npc))
      .filter((npc) => currentNpcNames.has(npc.name) || !cachedNpcNames.has(npc.name))
      .map(toRoomNpcWithCombat);
    const activeEscortTargets = ESCORT_QUESTS
      .filter((quest) => (
        questProgress[quest.id]?.active
        && questPlaceDistrict(quest.targetLocation) === room.name
        && !flags.includes(`quest_done_${quest.id}`)
      ))
      // 收货人可能是游走池的人，也可能是常驻（李掌柜）；常驻的那位若被旧存档缓存在别处，
      // residentNpcs 会滤掉他，这里照样把人请到，免得镖送到了没人收
      .map((quest) => NPC_POOL.find((npc) => npc.name === quest.targetNpc)
        // 收货人若是常驻且住在别的据点（卓玛住玉泉寨、镖送到贡措海），只查本据点常驻永远找不到人。
        || Object.values(RESIDENT_NPCS).flat().find((npc) => npc.name === quest.targetNpc))
      .filter(Boolean)
      .map(toRoomNpcWithCombat)
      .map((npc) => {
        // 收货人站在护送目的地写明的那间内层房间（驻场的人按其驻场绑定）
        const quest = ESCORT_QUESTS.find((q) => q.targetNpc === npc.name && questPlaceDistrict(q.targetLocation) === room.name);
        const inner = quest && parseQuestPlace(quest.targetLocation)?.inner;
        return inner ? { ...npc, innerRoom: inner } : npc;
      });
    const hourNow = ((time % 24) + 24) % 24;
    const gambleBidders = hasInnerMap(room.name) && getInnerRoomNames(room.name).includes("玉石料场")
      ? [
          ...NPC_POOL
            .filter((npc) => npc.gambleBidder && npc.lockInnerRoom === "玉石料场")
            .map(toRoomNpcWithCombat),
          ...NPC_POOL
            .filter((npc) => Array.isArray(npc.schedule)
              && npc.schedule.some((slot) => (
                hourNow >= slot.slot[0]
                && hourNow < slot.slot[1]
                && slot.lockInnerRoom === "玉石料场"
              )))
            .map((npc) => {
              const resident = toRoomNpcWithCombat(npc);
              resident.lockInnerRoom = "玉石料场";
              return resident;
            }),
        ]
      : [];
    const importedNpcs = importedRegistry.getImportedForDistrict(
      room.name,
      time,
      (name) => seededRand(dayIdx, `imported_${room.name}_${name}`),
    )
      .filter((npc) => !isCompanionUnlockedByName(companionState, npc.name))
      .map(toRoomNpcWithCombat);
    // 名字避开玩家认识的人和导入角色卡；认识的人里，今天已经刷出来的那批（本地或别处缓存里）不算撞名，保证同日重进结果不变。
    const todaysPassers = new Set([room.npcs || [], ...Object.values(roomMapRef?.current || {}).map((cached) => cached?.npcs || [])]
      .flat()
      .filter((npc) => npc?.randomPasser === dayIdx)
      .map((npc) => npc.name));
    const varTree = state.varTree || {};
    const passerReserved = new Set([
      ...[...(varTree.世界?.已认识人物 || []), ...Object.keys(varTree.角色 || {})]
        .filter((name) => !todaysPassers.has(name)),
      ...importedRegistry.getImportedResidentNames(),
      ...importedNpcs.map((npc) => npc.name),
    ]);
    const passers = getRandomPassers(room.name, time, passerReserved)
      .map((passer) => {
        const existing = existingByName.get(passer.name);
        return buildRoomNpcWithCombat(passer, { existingNpc: existing?.randomPasser === dayIdx ? existing : undefined, luck });
      });
    // 不在今天这份名单里的过路人一律清掉：隔天的，或名额被新导入角色卡顶替、重抽后换下的
    const rosterNames = new Set(passers.map((npc) => npc.name));
    const isStalePasser = (npc) => npc?.randomPasser != null && (npc.randomPasser !== dayIdx || !rosterNames.has(npc.name));
    const hasStalePassers = (room.npcs || []).some(isStalePasser);
    const toInject = [...poolNpcs, ...residentNpcs, ...activeEscortTargets, ...gambleBidders, ...importedNpcs, ...passers];
    // 不具名群众：按天固定，有内层地图的分散到各公共房间
    const crowdRooms = hasInnerMap(room.name) ? getPublicInnerRoomNames(room.name) : [];
    const crowd = getCrowd(room.name, time).map((label) => {
      if (!crowdRooms.length) return { label };
      const rng = seededRand(dayIdx, `crowd|${room.name}|${label}`);
      return { label, innerRoom: crowdRooms[Math.floor(rng() * crowdRooms.length)] };
    });
    const crowdChanged = JSON.stringify(room.crowd || []) !== JSON.stringify(crowd);
    if (!toInject.length && !staleNames.size && !hasStalePassers && !crowdChanged) return null;

    if (hasInnerMap(room.name)) {
      const rooms = getPublicInnerRoomNames(room.name);
      const residentNames = new Set([
        ...residentNpcs.map((npc) => npc.name),
        ...importedRegistry.getImportedResidentNames(),
      ]);
      for (const npc of toInject) {
        if (residentNames.has(npc.name)) continue;
        if (npc.innerRoom) continue;
        if (npc.lockInnerRoom) {
          npc.innerRoom = npc.lockInnerRoom;
          continue;
        }
        if (!rooms.length) continue;
        const rng = seededRand(dayIdx, `${room.name}|${npc.name}`);
        npc.innerRoom = rooms[Math.floor(rng() * rooms.length)];
      }
    }

    return {
      changes: {
        room: (previous) => ({
          ...previous,
          npcs: injectNpcs((previous.npcs || []).filter((npc) => !isStalePasser(npc) && (npc.imported || !staleNames.has(npc.name))), toInject),
          crowd,
        }),
      },
    };
  },
};

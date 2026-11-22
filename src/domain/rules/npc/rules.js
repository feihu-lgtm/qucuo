import { isCompanionUnlockedByName, companionKeyByName } from "../companion/companion.js";
import { hasInnerMap, getInnerRoomNames, getPublicInnerRoomNames } from "../map/innerMap.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { mapDescriptionToGenParams } from "../../data/npc/npcDescriptionMapping.js";
import { NPC_POOL, getScheduledNpcs, toRoomNpc } from "../../data/npc/npcPool.js";
import { injectNpcs } from "../npc/roomNpcs.js";
import { getResidentNpcs } from "../../data/npc/residentNpcs.js";
import { ESCORT_QUESTS } from "../../data/quests/escortQuests.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { parseQuestPlace, questPlaceDistrict } from "../quests/questPlace.js";

const NPC_FIELDS = [
  "levelCap", "special", "beast", "unlearnable", "cannotSpeak", "affectionable",
  "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder",
  "lockInnerRoom", "bidderKind", "companionCandidate", "guaranteedDrop",
  "portrait", "neigong", "waigong", "imported", "hostile",
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
const RELOCATED_RESIDENTS = { 唐老太: "锦官城" };

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
    const staleNames = new Set((room.npcs || [])
      .filter((npc) => !npc.imported && RELOCATED_RESIDENTS[npc.name] === room.name)
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
        || getResidentNpcs(room.name).find((npc) => npc.name === quest.targetNpc))
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
    const toInject = [...poolNpcs, ...residentNpcs, ...activeEscortTargets, ...gambleBidders, ...importedNpcs];
    if (!toInject.length && !staleNames.size) return null;

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
          npcs: injectNpcs((previous.npcs || []).filter((npc) => npc.imported || !staleNames.has(npc.name)), toInject),
        }),
      },
    };
  },
};

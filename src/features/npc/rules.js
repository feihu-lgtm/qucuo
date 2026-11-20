import { isCompanionUnlockedByName, companionKeyByName } from "../../domain/companion/companion.js";
import { hasInnerMap, getInnerRoomNames, getPublicInnerRoomNames } from "../../domain/map/innerMap.js";
import { ensureNpcCombatData } from "../../domain/npc/npcGeneration.js";
import { mapDescriptionToGenParams } from "../../domain/npc/npcDescriptionMapping.js";
import { NPC_POOL, getScheduledNpcs, toRoomNpc } from "../../domain/npc/npcPool.js";
import { injectNpcs } from "../../domain/npc/roomNpcs.js";
import { getResidentNpcs } from "../../domain/npc/residentNpcs.js";
import { ESCORT_QUESTS } from "../../domain/quests/escortQuests.js";
import { seededRand } from "../../utils/seededRandom.js";

const NPC_FIELDS = [
  "levelCap", "special", "beast", "unlearnable", "cannotSpeak", "affectionable",
  "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder",
  "lockInnerRoom", "bidderKind", "companionCandidate", "guaranteedDrop",
  "portrait", "neigong", "waigong", "imported",
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
        .flatMap(([, cached]) => (cached?.npcs || []).map((npc) => npc.name)),
    );
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
        && quest.targetLocation === room.name
        && !flags.includes(`quest_done_${quest.id}`)
      ))
      .map((quest) => NPC_POOL.find((npc) => npc.name === quest.targetNpc))
      .filter(Boolean)
      .map(toRoomNpcWithCombat);
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
    if (!toInject.length) return null;

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
        room: (previous) => ({ ...previous, npcs: injectNpcs(previous.npcs, toInject) }),
      },
    };
  },
};

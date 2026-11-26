import { isCompanionUnlockedByName, companionKeyByName } from "../companion/companion.js";
import { OC_BY_NAME } from "./npcCarry.js";
import { hasInnerMap, getInnerRoomNames, getPublicInnerRoomNames } from "../map/innerMap.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { npcTradeOf } from "../npc/npcTrade.js";
import { mapDescriptionToGenParams } from "../../data/npc/npcDescriptionMapping.js";
import { NPC_POOL, getScheduledNpcs, toRoomNpc } from "../../data/npc/npcPool.js";
import { getCrowd, getRandomPassers } from "../../data/npc/randomPassers.js";
import { getWorldAdventurers } from "../../data/dungeon/adventurers.js";
import { injectNpcs } from "../npc/roomNpcs.js";
import { getResidentNpcs, RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { ESCORT_QUESTS } from "../../data/quests/escortQuests.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { parseQuestPlace, questPlaceDistrict } from "../quests/questPlace.js";

// 已入队的驻场人不再重复注入房间：companionCandidate（雪豹）、OC 驻场（homeDistrict 出身，
// 如元朵朵）、与 OC 同名的驻场条目（姬无双/樊未离——数据里同一人被收编后驻场壳也要撤）都算。
// WO-23C4：已被招抚的宿敌（谱中 status==="recruited"）世界版不再注入——
// 人已是 companion，驻场/游走池再刷会分身。按名字唯一惯例匹配，与 removeNpc 同口径。
// WO-23C2b 泛化：recruited/fakeDead/dead 不刷世界版（招抚分身/假死复活前活人站位都防）。
// settled（恩怨已了结）不在过滤之列——了结后回归常人，驻场/游走池照常。
export function recruitedNemesisNames(varTree) {
  const out = new Set();
  for (const group of Object.values(varTree?.世界?.宿敌谱 || {})) {
    for (const e of Object.values(group?.entries || {})) {
      if (e && e.name && ["recruited", "fakeDead", "dead"].includes(e.status)) out.add(e.name);
    }
  }
  return out;
}

export function isResidentJoinedCompanion(npc, companionState) {
  if (!(npc?.companionCandidate || npc?.homeDistrict || OC_BY_NAME[npc?.name])) return false;
  return isCompanionUnlockedByName(companionState, npc.name);
}

const NPC_FIELDS = [
  "levelCap", "special", "beast", "unlearnable", "cannotSpeak", "affectionable",
  "fullBio", "personality", "burdenMoveIds", "carry", "gambleBidder",
  "lockInnerRoom", "bidderKind", "companionCandidate", "guaranteedDrop",
  "portrait", "neigong", "waigong", "imported", "hostile", "faction", "gender", "randomPasser",
  "adventurer", "adventurerDay", "rainbow", "rainbowStyle", "archetype", "archetypeLabel", "title",
  "ocAdventurer", "npcRef", "tradeStyle",
  // 时段表跟人走：npc.roam 要靠它判断"此刻该去哪"，innerMap 的可见性也认它（见 isNpcVisibleInInnerRoom）
  "schedule",
  // W-ROAM 最小步距节流时间戳：驻场重刷时不能丢，丢了等于每刻都重新计步距
  "lastRoamTurn",
];

export function buildRoomNpcWithCombat(poolNpc, { existingNpc, luck = 5, trade } = {}) {
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
  return ensureNpcCombatData(base, { luck, levelCap, trade });
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
    // 过滤所读状态必须进 deps：companion 解锁/宿敌招抚后不重刷就滤不掉
    state.companionState,
    state.varTree?.世界?.宿敌谱,
    // W-ROAM：驻足锁本身也是名单过滤输入——锁过期后下一次重建（任何交互写锁都会
    // 触发 deps 变化）把身份到期的昨日过客清走，不会赖到子夜。
    state.varTree?.世界?.驻足锁,
  ],
  run(state, { importedRegistry, roomMap, companionState = state.companionState }) {
    const { room, time, questProgress = {}, flags = [], char } = state;
    if (!room?.name) return null;
    const dayIdx = Math.floor(time / 24);
    const luck = char?.special?.气运 ?? 5;
    const existingByName = new Map((room.npcs || []).map((npc) => [npc.name, npc]));
    const currentNpcNames = new Set(existingByName.keys());
    const cachedNpcNames = new Set(
      Object.entries(roomMap || {})
        .filter(([roomName]) => roomName !== room.name)
        .flatMap(([roomName, cached]) => (cached?.npcs || [])
          .filter((npc) => RELOCATED_RESIDENTS[npc.name] !== roomName)
          .map((npc) => npc.name)),
    );
    // 常驻写了 goneFlags（被处决、囚禁等），任一 flag 已立就不再出现，旧缓存里的也清掉
    const isGoneResident = (npc) => (npc.goneFlags || []).some((flag) => flags.includes(flag));
    const goneResidentNames = new Set(getResidentNpcs(room.name).filter(isGoneResident).map((npc) => npc.name));
    const recruitedInRoom = recruitedNemesisNames(state.varTree);
    const staleNames = new Set((room.npcs || [])
      .filter((npc) => !npc.imported && (RELOCATED_RESIDENTS[npc.name] === room.name || goneResidentNames.has(npc.name) || recruitedInRoom.has(npc.name)))
      .map((npc) => npc.name));
    const toRoomNpcWithCombat = (poolNpc) => buildRoomNpcWithCombat(poolNpc, {
      existingNpc: existingByName.get(poolNpc.name),
      luck,
      trade: npcTradeOf(state.npcState, poolNpc),
    });

    const recruitedNames = recruitedNemesisNames(state.varTree);
    const notRecruited = (npc) => !recruitedNames.has(npc?.name);
    const poolNpcs = getScheduledNpcs(room.name, time).filter(notRecruited).map(toRoomNpcWithCombat);
    const residentNpcs = getResidentNpcs(room.name)
      .filter(notRecruited)
      .filter((npc) => !isResidentJoinedCompanion(npc, companionState))
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
      .filter(notRecruited)
      .map(toRoomNpcWithCombat)
      .map((npc) => {
        // 收货人站在护送目的地写明的那间内层房间（驻场的人按其驻场绑定）
        const quest = ESCORT_QUESTS.find((q) => q.targetNpc === npc.name && questPlaceDistrict(q.targetLocation) === room.name);
        const inner = quest && parseQuestPlace(quest.targetLocation)?.inner;
        return inner ? { ...npc, innerRoom: inner } : npc;
      });
    const hourNow = ((time % 24) + 24) % 24;
    // WO-23C7：竞价/游走/护送/导入/过路所有真实世界 NPC 投放入口统一过滤宿敌谱
    // inactive（fakeDead/dead/recruited——notRecruited 即此口径），死人不进竞价池。
    const gambleBidders = hasInnerMap(room.name) && getInnerRoomNames(room.name).includes("玉石料场")
      ? [
          ...NPC_POOL
            .filter((npc) => npc.gambleBidder && npc.lockInnerRoom === "玉石料场")
            .filter(notRecruited)
            .map(toRoomNpcWithCombat),
          ...NPC_POOL
            .filter(notRecruited)
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
      .filter(notRecruited)
      .map(toRoomNpcWithCombat);
    // 名字避开玩家认识的人和导入角色卡；认识的人里，今天已经刷出来的那批（本地或别处缓存里）不算撞名，保证同日重进结果不变。
    const todaysPassers = new Set([room.npcs || [], ...Object.values(roomMap || {}).map((cached) => cached?.npcs || [])]
      .flat()
      .filter((npc) => npc?.randomPasser === dayIdx)
      .map((npc) => npc.name));
    const varTree = state.varTree || {};
    // 已入队/留守的冒险者不再刷世界版（跟 importedNpcs 同一道闸）：
    // 招募后房间里会同时存在"世界版陌生人"和"留守队友"两个同名身。
    const worldAdventurers = getWorldAdventurers(room.name, time)
      .filter(notRecruited)
      .filter((adv) => !isCompanionUnlockedByName(companionState, adv.name))
      .map((adv) => {
        const existing = existingByName.get(adv.name);
        return buildRoomNpcWithCombat(adv, { existingNpc: existing?.adventurerDay === dayIdx ? existing : undefined, luck, trade: npcTradeOf(state.npcState, adv) });
      });
    const advRosterNames = new Set(worldAdventurers.map((npc) => npc.name));
    const isStaleAdventurer = (npc) => npc?.adventurerDay != null && (npc.adventurerDay !== dayIdx || !advRosterNames.has(npc.name));
    const hasStaleAdventurers = (room.npcs || []).some(isStaleAdventurer);

    const passerReserved = new Set([
      ...[...(varTree.世界?.已认识人物 || []), ...Object.keys(varTree.角色 || {})]
        .filter((name) => !todaysPassers.has(name)),
      ...importedRegistry.getImportedResidentNames(),
      ...importedNpcs.map((npc) => npc.name),
      ...advRosterNames,
    ]);
    const passers = getRandomPassers(room.name, time, passerReserved).filter(notRecruited)
      .map((passer) => {
        const existing = existingByName.get(passer.name);
        return buildRoomNpcWithCombat(passer, { existingNpc: existing?.randomPasser === dayIdx ? existing : undefined, luck, trade: npcTradeOf(state.npcState, passer) });
      });
    // 不在今天这份名单里的过路人一律清掉：隔天的，或名额被新导入角色卡顶替、重抽后换下的
    const rosterNames = new Set(passers.map((npc) => npc.name));
    const isStalePasser = (npc) => npc?.randomPasser != null && (npc.randomPasser !== dayIdx || !rosterNames.has(npc.name));
    const hasStalePassers = (room.npcs || []).some(isStalePasser);
    const toInject = [...poolNpcs, ...residentNpcs, ...activeEscortTargets, ...gambleBidders, ...importedNpcs, ...worldAdventurers, ...passers];
    const injectNameSet = new Set(toInject.map((npc) => npc.name));
    // 不具名群众：按天固定，有内层地图的分散到各公共房间
    const crowdRooms = hasInnerMap(room.name) ? getPublicInnerRoomNames(room.name) : [];
    const crowd = getCrowd(room.name, time).map((label) => {
      if (!crowdRooms.length) return { label };
      const rng = seededRand(dayIdx, `crowd|${room.name}|${label}`);
      return { label, innerRoom: crowdRooms[Math.floor(rng() * crowdRooms.length)] };
    });
    const crowdChanged = JSON.stringify(room.crowd || []) !== JSON.stringify(crowd);
    if (!toInject.length && !staleNames.size && !hasStalePassers && !hasStaleAdventurers && !crowdChanged) return null;

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
          // W-ROAM Review 修：子夜换名单不清驻足锁未过期的过路人——玩家正找着他办事说话，
          // 身份到期也留到锁过期后的下一次重建再离场。冒险者不保：他们按日在据点间
          // 换防，保留旧 copy 会与新驻地的当日新身撞出同名双身——换人比锁更硬。
          // Review 三轮修：游走池按时辰抽样——已不在当前时辰样本里的池客（非时段表
          // 走班的）同样算离场，不然名单只进不出、越聊越膨胀；锁未过期者同例保留。
          npcs: injectNpcs((previous.npcs || []).filter((npc) => {
            if (!(npc.imported || !staleNames.has(npc.name))) return false;
            const injectedNames = injectNameSet;
            const isStalePool = npc.isPoolNpc && !Array.isArray(npc.schedule)
              && typeof npc.pursuitInnerRoom !== "string" && !injectedNames.has(npc.name);
            if (!isStalePasser(npc) && !isStaleAdventurer(npc) && !isStalePool) return true;
            return npc.adventurerDay == null && (state.varTree?.世界?.驻足锁?.[npc.name] ?? -1) > time;
          }), toInject),
          crowd,
        }),
      },
    };
  },
};

// 路线甲纯函数化：返回 { logs, changes } 由 commitRound 统一落盘。
import { filterSnowModelFlags } from "../../domain/rules/quests/snowLeopardQuest.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { set, updateField } from "../../domain/rules/state/applyWrite.js";
import { isLocalQuestFlag } from "../../domain/rules/quests/localStages.js";

const BAITA_CRYPT_ASK_RE = /(白塔)?地宫|塔底(密道|暗门|入口|石门)|地宫(门道|入口|线索|怎么进)/;
const BAITA_LOC_ASK_RE = /(白塔|塔底).{0,6}(门道|入口|暗门|怎么进|线索)/;

const CLUE_GIVER_FLAGS = {
  行脚僧: ["quest_budong_s1_xingjiaoseng", "white_pagoda_crypt_clue"],
  洛桑: ["quest_budong_s1_xingjiaoseng", "white_pagoda_crypt_clue"],
  达摩药堂师父: ["quest_budong_s1_yaotang", "white_pagoda_crypt_clue"],
  喇嘛庙住持: ["quest_budong_s1_zhuchi", "white_pagoda_crypt_clue"],
  罗布桑: ["white_pagoda_crypt_clue"],
};

/**
 * 系统确定性发线索 flag：当玩家向喇嘛庙/白塔相关人物打听白塔地宫门道时，
 * 无论模型是否吐出 flags_add，系统直接补齐任务线索旗与开门旗。
 */
export function resolveSystemClueFlags({ cmd, talkTarget, activeTarget, p, room, innerRoomName }) {
  const text = String(cmd || "").trim();
  if (!text) return [];
  const inBaitaOrLama = room?.name === "喇嘛庙" || room?.name === "白塔";
  if (!BAITA_CRYPT_ASK_RE.test(text) && !(inBaitaOrLama && BAITA_LOC_ASK_RE.test(text))) {
    return [];
  }
  const visibleNpcs = (room?.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(room?.name, innerRoomName, npc));
  const visibleNames = new Set(visibleNpcs.map((n) => n.name));
  const candidates = new Set();
  for (const name of [talkTarget, activeTarget, ...(Array.isArray(p?.respondedNpcs) ? p.respondedNpcs : [])]) {
    if (name && (!visibleNames.size || visibleNames.has(name))) candidates.add(name);
  }
  if (!candidates.size && visibleNames.size) {
    for (const name of visibleNames) candidates.add(name);
  }
  const out = [];
  for (const name of candidates) {
    const flags = CLUE_GIVER_FLAGS[name];
    if (flags) out.push(...flags);
  }
  return [...new Set(out)];
}

export function commitModelFlags({ p, room, innerRoomName, questProgress, cmd, talkTarget, activeTarget }) {
  const modelFlags = p?.delta?.flags_add
    ? filterSnowModelFlags(p.delta.flags_add, {
        room: { ...room, npcs: (room?.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(room?.name, innerRoomName, npc)) },
        innerRoomName,
        questProgress,
      }).filter((flag) => !isLocalQuestFlag(flag))
    : [];
  if (p?.delta?.flags_add) p.delta.flags_add = modelFlags;

  const systemFlags = resolveSystemClueFlags({ cmd, talkTarget, activeTarget, p, room, innerRoomName });
  const mergedFlags = [...new Set([...modelFlags, ...systemFlags])];
  if (!mergedFlags.length) return null;

  const logs = [];
  if (systemFlags.includes("white_pagoda_crypt_clue")) {
    logs.push({ t: "sys", text: "  ★ 已打听到白塔地宫的门道，白塔塔基南侧暗门现可进入。" });
  }

  return {
    ...(logs.length ? { logs } : {}),
    changes: {
      flags: updateField("flags", (flags) => set("flags", [...new Set([...flags, ...mergedFlags])])),
    },
  };
}

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

const EXTRA_DUNGEON_CLUE_RULES = [
  {
    flag: "duanan_post_clue",
    label: "断鞍古驿",
    npcs: new Set(["厉天行", "杂货商人", "血刀门徒·初七", "血刀门徒·十三"]),
    askRe: /断鞍|古驿|草甸.{0,6}(地宫|藏宝|军饷|暗道|门道|线索|怎么进)/,
    districts: new Set(["大草甸", "血刀营地", "断鞍古驿"]),
  },
  {
    flag: "chensha_dock_clue",
    label: "沉沙古坞",
    npcs: new Set(["老道士", "一清道长", "挂单道人", "青衣楼老板娘", "松鹤道长"]),
    askRe: /沉沙|古坞|沉船|水闸|(雅江|离堆).{0,6}(地宫|门道|线索|怎么进)/,
    districts: new Set(["雅江", "沉沙古坞"]),
  },
  {
    flag: "jingguan_ghost_market_clue",
    label: "锦官鬼市",
    npcs: new Set(["侯敢", "柳青鸢", "唐三少", "陈九"]),
    askRe: /鬼市|暗坊|销赃|地下黑市|(锦官|暗巷).{0,6}(地宫|门道|线索|怎么进)/,
    districts: new Set(["锦官城", "锦官鬼市入口"]),
  },
  {
    flag: "guixu_bronze_clue",
    label: "归墟青铜宫",
    npcs: new Set(["樊枯", "姜泠", "严九斤", "胡三爷"]),
    askRe: /归墟|青铜宫|守宫|神树井|(广汉|三星).{0,6}(地宫|门道|线索|怎么进)/,
    districts: new Set(["广汉", "三星堆"]),
  },
  {
    flag: "tusi_inner_vault_clue",
    label: "鱼定土司内府禁库",
    npcs: new Set(["洛桑平措", "格桑顿珠", "梅朵", "桑杰朵杰"]),
    askRe: /禁库|暗仓|三十载密契|老土司秘库|(鱼定土司|土司府).{0,6}(地宫|禁库|门道|线索|怎么进)/,
    districts: new Set(["鱼定土司", "内府禁库"]),
  },
  {
    flag: "wuxian_valley_clue",
    label: "五仙百毒禁谷",
    npcs: new Set(["乌婆婆", "龙汐月", "阿萝", "麻九娘"]),
    askRe: /百毒|禁谷|五仙药谷|毒瘴禁地|(雾隐寨|五仙).{0,6}(地宫|门道|线索|怎么进)/,
    districts: new Set(["雾隐寨"]),
  },
  {
    flag: "tianlong_serpent_clue",
    label: "摩呼罗迦蛇窟",
    npcs: new Set(["厉苍龙", "贺兰昭", "姬无双", "樊未离"]),
    askRe: /蛇窟|摩呼罗迦|死斗擂台|(天龙营|西风).{0,6}(地宫|门道|线索|怎么进)/,
    districts: new Set(["天龙营"]),
  },
];

/**
 * 系统确定性发线索 flag：覆盖全部 8 座地宫的知情 NPC 与问讯触发，
 * 无论模型是否吐出 flags_add，系统直接补齐对应地宫门道线索与任务推进旗。
 */
export function resolveSystemClueFlags({ cmd, talkTarget, activeTarget, p, room, innerRoomName }) {
  const text = String(cmd || "").trim();
  if (!text) return [];

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
  const inBaitaOrLama = room?.name === "喇嘛庙" || room?.name === "白塔";
  if (BAITA_CRYPT_ASK_RE.test(text) || (inBaitaOrLama && BAITA_LOC_ASK_RE.test(text))) {
    for (const name of candidates) {
      const flags = CLUE_GIVER_FLAGS[name];
      if (flags) out.push(...flags);
    }
  }

  for (const rule of EXTRA_DUNGEON_CLUE_RULES) {
    const inLoc = rule.districts.has(room?.name) || rule.districts.has(innerRoomName);
    const matchesText = rule.askRe.test(text) || (inLoc && /门道|怎么进|入口|暗门|线索/.test(text));
    if (!matchesText) continue;
    for (const name of candidates) {
      if (rule.npcs.has(name)) out.push(rule.flag);
    }
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
  for (const rule of EXTRA_DUNGEON_CLUE_RULES) {
    if (systemFlags.includes(rule.flag)) {
      logs.push({ t: "sys", text: `  ★ 已打听到「${rule.label}」的门道，深入主匣时神兵线索可现形。` });
    }
  }

  return {
    ...(logs.length ? { logs } : {}),
    changes: {
      flags: updateField("flags", (flags) => set("flags", [...new Set([...flags, ...mergedFlags])])),
    },
  };
}

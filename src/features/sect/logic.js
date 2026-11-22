import { add, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { SECT_ENTRY, checkSectEntry } from "../../domain/rules/character/sectEntry.js";
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { formatRepChanges, grantFactionRep } from "../../domain/rules/economy/factionRep.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import {
  DEFECT_REP, SECT_MEMBER_FLAGS, checkFactionEntry, currentSectOf, defectedFlag, factionEntryForBuilding, hasDefected, sectMasterOf, sectTokenOf,
} from "../../domain/rules/character/factionEntry.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";

function joinFactionSect(state, entry, now = Date.now()) {
  const status = checkFactionEntry(entry, { varTree: state.varTree, flags: state.flags, char: state.char });
  if (!status.eligible) return { logs: [{ t: "sys", text: `  你还不够格拜入${entry.sect}。` }] };
  const items = [entry.token, ...entry.gifts]
    .map((name, i) => ({ ...makeNamedItem(name), id: `sect_join_${now}_${i}`, equipped: false }));
  const { master, sect } = entry;
  const { applied } = grantFactionRep(state.varTree, { [sect]: entry.repBonus });
  return {
    changes: {
      inv: (inv = []) => [...inv, ...items],
      flags: (flags = []) => (flags.includes(entry.flag) ? flags : [...flags, entry.flag]),
      varTree: (prev) => markNpcAsKnown(grantFactionRep(prev, { [sect]: entry.repBonus }).varTree, master),
    },
    logs: [
      { t: "sys", text: `  （${master}收你入${sect}门下，${formatRepChanges(applied)}）` },
      ...items.map((item) => ({ t: "loot", text: `✦ 得「${item.name}」`, item, source: "sect" })),
    ],
    note: { text: `拜入${sect}，${master}授${entry.token}。`, owner: [{ name: master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE },
    settle: `经${master}点头，正式拜入${sect}，领了${items.map((item) => item.name).join("、")}`,
    settleOptions: {
      settleNpc: master, settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: `${sect}门规与弟子身份`, totalPrice: 0, beast: false },
    },
  };
}

export function joinSect(state) {
  const entry = factionEntryForBuilding(getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName));
  if (entry) return joinFactionSect(state, entry);
  if (hasDefected(state.flags, SECT_ENTRY.sect)) return { logs: [{ t: "sys", text: `  你曾叛出${SECT_ENTRY.sect}，门墙永闭，不再收留。` }] };
  const otherSect = Object.entries(SECT_MEMBER_FLAGS).find(([sect, flag]) => sect !== SECT_ENTRY.sect && (state.flags || []).includes(flag))?.[0] ?? null;
  const status = checkSectEntry({
    affection: state.varTree.角色?.[SECT_ENTRY.master]?.好感度 ?? 0,
    neigong: state.char.neigong ?? 0, money: state.char.money ?? 0, flags: state.flags, otherSect,
  });
  if (!status.eligible) return { logs: [{ t: "sys", text: "  你还不够格拜入雪山派。" }] };
  const token = makeItemSmart({
    name: SECT_ENTRY.keyName, category: "misc", quality: "绿",
    desc: "雪山派正式弟子的令牌，青铜铸就，正面一座雪峰，背面刻着一个小小的「贰」。兼作弟子别院的门锁钥匙。",
  }, makeItem);
  return {
    changes: {
      char: updateField("char", add("char.money", -SECT_ENTRY.tuition)),
      inv: updateField("inv", (inv) => set("inv", [...inv, token])),
      flags: updateField("flags", (flags) => set("flags", flags.includes(SECT_ENTRY.flag) ? flags : [...flags, SECT_ENTRY.flag])),
      varTree: prev => markNpcAsKnown(prev, SECT_ENTRY.master),
    },
    logs: [
      { t: "sys", text: `  （奉上束脩银${SECT_ENTRY.tuition}两，得雪山派弟子令牌 · 内堂之后的弟子别院已开）` },
      { t: "loot", text: `✦ 得「${SECT_ENTRY.keyName}」`, item: token, source: "sect" },
    ],
    note: { text: `拜入雪山派，${SECT_ENTRY.master}收下束脩，授弟子令牌。`, owner: [{ name: SECT_ENTRY.master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE },
    settle: `向${SECT_ENTRY.master}奉上束脩，正式拜入雪山派门下，接过那枚刻着「贰」字的弟子令牌`,
    settleOptions: {
      settleNpc: SECT_ENTRY.master, settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "雪山派门规与弟子身份", totalPrice: SECT_ENTRY.tuition, beast: false },
    },
  };
}

// 主动叛出（mode "defect"，声誉重置 -40）或犯门规被逐（mode "expel"，-70）：收回信物、去掉弟子身份、记下叛出，
// 已学招式保留，但本门高阶武学不再突破（skillUnlock.isSkillBreakthroughLocked），此派门墙永闭。
export function leaveSect(state, sectName, { mode = "defect" } = {}) {
  const sect = sectName || currentSectOf(state.flags);
  const flag = SECT_MEMBER_FLAGS[sect];
  if (!sect || !flag || !(state.flags || []).includes(flag)) return { logs: [{ t: "sys", text: "  你并非本门正式弟子，无派可退。" }] };
  const expel = mode === "expel";
  const rep = expel ? DEFECT_REP.expel : DEFECT_REP.defect;
  const token = sectTokenOf(sect);
  const master = sectMasterOf(sect);
  const verb = expel ? "逐出" : "叛出";
  return {
    changes: {
      inv: (inv = []) => inv.filter((item) => (typeof item === "string" ? item : item?.name) !== token),
      flags: (flags = []) => [...flags.filter((entry) => entry !== flag && entry !== defectedFlag(sect)), defectedFlag(sect)],
      varTree: (prev) => markNpcAsKnown({
        ...prev, 世界: { ...prev?.世界, 势力声誉: { ...prev?.世界?.势力声誉, [sect]: rep } },
      }, master),
    },
    logs: [{ t: "sys", text: `  （${verb}${sect} · ${sect}声誉重置为 ${rep} · 收回「${token}」 · 已学招式保留，本门高阶武学不再突破）` }],
    note: {
      text: expel ? `犯门规被${master}逐出${sect}，收回${token}。` : `向${master}交还${token}，叛出${sect}。`,
      owner: [{ name: master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE,
    },
    settle: expel ? `因触犯门规被${master}当场收回${token}，革出${sect}门墙` : `向${master}缴还${token}，叛出${sect}门墙，从此门墙永闭`,
    settleOptions: { settleNpc: master },
  };
}

import { add, set, updateField } from "../../domain/rules/state/applyWrite.js";
import {
  NON_JOINABLE_FACTIONS,
  checkSectEntry,
  computeDefectRep,
  defectedFlag,
  getPlayerSect,
  getSectEntry,
  isPlayerInSect,
} from "../../domain/rules/character/sectEntry.js";
import { factionRepOf } from "../../domain/rules/economy/factionRep.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";

function itemName(item) {
  return typeof item === "string" ? item : item?.name;
}

function resolveTargetSect(state, sectName) {
  if (sectName) return sectName;
  const buildingId = getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName);
  const byRoom = buildingId ? getSectEntry(buildingId) : null;
  return byRoom ? byRoom.sect : "雪山派";
}

function buildJoinSettle(state, entry, status) {
  const base = status.usesLegacyPath && entry.legacyJoinAction ? entry.legacyJoinAction : entry.joinAction;
  const extras = [];
  if (entry.maleCeremonyNote && state.char?.gender === "男") {
    extras.push(entry.maleCeremonyNote);
  }
  const prestige = Number(state.varTree?.世界?.威望) || 0;
  if (entry.highPrestigeNote && entry.highPrestigeThreshold != null && prestige >= entry.highPrestigeThreshold) {
    extras.push(entry.highPrestigeNote);
  }
  return extras.length ? `${base}；${extras.join("；")}` : base;
}

export function joinSect(state, sectName) {
  const target = resolveTargetSect(state, sectName);
  if (NON_JOINABLE_FACTIONS.includes(target)) {
    return { logs: [{ t: "sys", text: `  ${target}不设拜师堂，不占主门派名额，可通过声誉线成为客卿。` }] };
  }
  const entry = getSectEntry(target);
  if (!entry) return { logs: [{ t: "sys", text: "  此势力不设拜师入门。" }] };
  const status = checkSectEntry(state, entry.sect);
  if (!status.eligible) {
    if (status.currentSect && status.currentSect !== entry.sect) {
      return { logs: [{ t: "sys", text: `  你已隶属${status.currentSect}，须先退派方可拜入${entry.sect}。` }] };
    }
    if (status.defected) {
      return { logs: [{ t: "sys", text: `  你曾叛出${entry.sect}，门墙永闭，不再收留。` }] };
    }
    return { logs: [{ t: "sys", text: `  你还不够格拜入${entry.sect}。` }] };
  }

  const token = makeItemSmart({
    name: entry.keyName,
    category: entry.keyCategory || "misc",
    quality: entry.keyQuality || "绿",
    desc: entry.keyDesc,
  }, makeItem);

  const existingNames = new Set((state.inv || []).map(itemName));
  const grantedBonus = (entry.bonusItems || [])
    .filter((spec) => !existingNames.has(spec.name))
    .map((spec) => makeItemSmart(spec, makeItem));
  const granted = [token, ...grantedBonus];

  const currentRep = factionRepOf(state.varTree, entry.sect);
  const nextRep = currentRep + (entry.repBonus || 20);
  const applyRep = updateField("varTree", set(["世界", "势力声誉", entry.sect], nextRep));

  const changes = {
    inv: updateField("inv", (inv) => set("inv", [...inv, ...granted])),
    flags: updateField("flags", (flags) => set("flags", flags.includes(entry.flag) ? flags : [...flags, entry.flag])),
    varTree: (prev) => applyRep(markNpcAsKnown(prev, entry.master)),
  };
  if (status.tuitionDue > 0) {
    changes.char = updateField("char", add("char.money", -status.tuitionDue));
  }

  const summaryParts = [];
  if (status.tuitionDue > 0) summaryParts.push(`奉上束脩银${status.tuitionDue}两`);
  summaryParts.push(`正式拜入${entry.sect}，声誉 +${entry.repBonus || 20}`);
  if (entry.sect === "雪山派") summaryParts.push("内堂之后的弟子别院已开");

  const logs = [
    { t: "sys", text: `  （${summaryParts.join(" · ")}）` },
    ...granted.map((item) => ({ t: "loot", text: `✦ 得「${item.name}」`, item, source: "sect" })),
  ];

  const noteText = status.tuitionDue > 0
    ? `拜入${entry.sect}，${entry.master}收下束脩，授${entry.keyName}。`
    : `拜入${entry.sect}，${entry.master}授${entry.keyName}，正式列入本门。`;

  return {
    changes,
    logs,
    note: { text: noteText, owner: [{ name: entry.master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE },
    settle: buildJoinSettle(state, entry, status),
    settleOptions: {
      settleNpc: entry.master,
      settleKind: "learn_skill",
      learnInfo: {
        isMaster: true,
        moveBrief: entry.moveBrief,
        totalPrice: status.tuitionDue,
        beast: false,
      },
    },
  };
}

export function leaveSect(state, sectName, { mode = "defect" } = {}) {
  const targetSect = sectName || getPlayerSect(state.flags);
  const entry = targetSect ? getSectEntry(targetSect) : null;
  if (!entry || !isPlayerInSect(state.flags, entry.sect)) {
    return { logs: [{ t: "sys", text: "  你当前并非本门正式弟子，无派可退。" }] };
  }

  const expel = mode === "expel";
  const currentRep = factionRepOf(state.varTree, entry.sect);
  const nextRep = computeDefectRep(currentRep, mode);
  const mark = defectedFlag(entry.sect);
  const applyRep = updateField("varTree", set(["世界", "势力声誉", entry.sect], nextRep));

  const verb = expel ? "逐出" : "叛出";
  const logs = [
    {
      t: "sys",
      text: `  （${verb}${entry.sect} · ${entry.sect}声誉重置为 ${nextRep} · 收回「${entry.keyName}」 · 已学招式保留但高阶武学突破已锁死）`,
    },
  ];

  return {
    changes: {
      inv: updateField("inv", (inv) => set("inv", (inv || []).filter((item) => itemName(item) !== entry.keyName))),
      flags: updateField("flags", (flags) => {
        const stripped = (flags || []).filter((flag) => flag !== entry.flag);
        return set("flags", stripped.includes(mark) ? stripped : [...stripped, mark]);
      }),
      varTree: (prev) => applyRep(markNpcAsKnown(prev, entry.master)),
    },
    logs,
    note: {
      text: expel
        ? `因犯门规被${entry.master}逐出${entry.sect}，收回${entry.keyName}。`
        : `向${entry.master}交还${entry.keyName}，主动退出${entry.sect}。`,
      owner: [{ name: entry.master, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.NARRATIVE,
    },
    settle: expel
      ? `因触犯门规被${entry.master}当场收回${entry.keyName}，革出${entry.sect}门墙`
      : `向${entry.master}缴还${entry.keyName}，正式退出${entry.sect}门墙`,
    settleOptions: {
      settleNpc: entry.master,
    },
  };
}

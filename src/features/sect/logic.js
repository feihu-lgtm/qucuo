import { add, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { SECT_ENTRY, checkSectEntry } from "../../domain/rules/character/sectEntry.js";
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { QINGCHENG_ENTRY, checkQingchengEntry } from "../../domain/rules/character/qingchengEntry.js";
import { makeNamedItem } from "../../domain/data/items/catalog.js";

function joinQingcheng(state, now = Date.now()) {
  const status = checkQingchengEntry({ varTree: state.varTree, flags: state.flags });
  if (!status.eligible) return { logs: [{ t: "sys", text: "  你还不够格拜入青城派。" }] };
  const items = [QINGCHENG_ENTRY.token, ...QINGCHENG_ENTRY.gifts]
    .map((name, i) => ({ ...makeNamedItem(name), id: `qingcheng_join_${now}_${i}`, equipped: false }));
  const rep = Math.min(100, status.rep + QINGCHENG_ENTRY.repBonus);
  const master = QINGCHENG_ENTRY.master;
  return {
    changes: {
      inv: (inv = []) => [...inv, ...items],
      flags: (flags = []) => (flags.includes(QINGCHENG_ENTRY.flag) ? flags : [...flags, QINGCHENG_ENTRY.flag]),
      varTree: (prev) => markNpcAsKnown({
        ...prev, 世界: { ...prev?.世界, 势力声誉: { ...prev?.世界?.势力声誉, 青城派: rep } },
      }, master),
    },
    logs: [
      { t: "sys", text: `  （${master}收你入青城门下，青城派声誉 +${rep - status.rep}）` },
      ...items.map((item) => ({ t: "loot", text: `✦ 得「${item.name}」`, item, source: "sect" })),
    ],
    note: { text: `拜入青城派，${master}授青城玄门竹牌。`, owner: [{ name: master, via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE },
    settle: `在青城山山门前明志试心，经${master}点头，正式拜入青城派，领了青城玄门竹牌、三清松风铁剑与青城道袍`,
    settleOptions: {
      settleNpc: master, settleKind: "learn_skill",
      learnInfo: { isMaster: true, moveBrief: "青城派门规与弟子身份", totalPrice: 0, beast: false },
    },
  };
}

export function joinSect(state) {
  if (getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName) === QINGCHENG_ENTRY.buildingId) return joinQingcheng(state);
  if ((state.flags || []).includes(QINGCHENG_ENTRY.flag)) return { logs: [{ t: "sys", text: "  你已是青城派弟子，不能再拜入雪山派。" }] };
  const status = checkSectEntry({
    affection: state.varTree.角色?.[SECT_ENTRY.master]?.好感度 ?? 0,
    neigong: state.char.neigong ?? 0, money: state.char.money ?? 0, flags: state.flags,
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

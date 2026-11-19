import { SECT_ENTRY, checkSectEntry } from "../../domain/character/sectEntry.js";
import { makeItem } from "../../domain/economy/equipment.js";
import { makeItemSmart } from "../../domain/items/catalog.js";
import { markNpcAsKnown } from "../../domain/npc/npcAwareness.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";

export function joinSect(state) {
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
      char: c => ({ ...c, money: (c.money || 0) - SECT_ENTRY.tuition }),
      inv: prev => [...prev, token],
      flags: f => f.includes(SECT_ENTRY.flag) ? f : [...f, SECT_ENTRY.flag],
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

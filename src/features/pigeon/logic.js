import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { random } from "../../utils/rng.js";
import { AFFECTION_RULES } from "../../domain/rules/state/fields.js";
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { registerFact } from "../../domain/rules/prompt/knowledge.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export function pigeonDelayShichen(state, npcName) {
  const here = QUCUO_MAP[state.room?.name] || { x: 0, y: 0 };
  const loc = state.varTree?.角色?.[npcName]?.所在地 || state.room?.name;
  const there = QUCUO_MAP[loc] || here;
  const dist = Math.hypot((there.x ?? 0) - (here.x ?? 0), (there.y ?? 0) - (here.y ?? 0));
  return { delay: Math.max(1, Math.min(12, Math.round(dist * 1.5) || 1)), loc };
}

export function recordPigeonNpcLocations(state) {
  const npcs = state.room?.npcs || [];
  if (!npcs.length) return {};
  if (!npcs.some((npc) => state.varTree?.角色?.[npc.name]?.所在地 !== state.room.name)) return {};

  return {
    changes: {
      varTree: (previous) => {
        const chars = { ...(previous?.角色 || {}) };
        let changed = false;
        for (const npc of npcs) {
          const current = chars[npc.name] || {};
          if (current.所在地 !== state.room.name) {
            chars[npc.name] = { ...current, 所在地: state.room.name };
            changed = true;
          }
        }
        return changed ? { ...previous, 角色: chars } : previous;
      },
    },
  };
}

export function sendPigeonLetter(state, npcName, content, opts = {}) {
  const channel = opts.channel || "pigeon";
  const giftName = opts.gift || null;
  const text = (content || "").trim();
  if (!npcName) return { logs: [{ t: "sys", text: "  未指定收信之人。" }] };
  if (!text) return { logs: [{ t: "sys", text: "  信笺空空，无从落笔。" }] };
  if (channel === "pigeon" && (state.char?.pigeons || 0) <= 0) {
    return { logs: [{ t: "sys", text: "  你手头没有信鸽——去驿站买鸽子，或直接到驿站寄信。" }] };
  }

  const { delay, loc } = pigeonDelayShichen(state, npcName);
  const shichen = channel === "pigeon" ? delay : Math.max(1, Math.min(12, Math.round(delay * 1.5)));
  const arriveTime = state.time + shichen * 2;
  const factId = `letter_send_${npcName}_${state.time}`;
  const chLabel = channel === "pigeon" ? "飞鸽传书" : channel === "postgift" ? "驿站送礼" : "驿站寄书";
  const fact = {
    id: factId,
    摘要: `${state.char?.name || "主角"}${chLabel}致信${npcName}${giftName ? `并附礼「${giftName}」` : ""}（往${loc}）。`,
    标签: "飞鸽传书",
    知晓者: [{ name: npcName, 途径: "亲历" }],
  };

  return {
    sent: true,
    factSummary: {
      id: factId,
      cue: `主角${chLabel}修书给${npcName}${giftName ? `，随信附礼「${giftName}」` : ""}，信中大意：${text.slice(0, 50)}`,
    },
    changes: {
      ...(channel === "pigeon" ? {
        char: updateField("char", add("char.pigeons", -1)),
      } : {}),
      ...(channel === "postgift" && giftName ? {
        inv: updateField("inv", (previous) => {
          const items = previous || [];
          const index = items.findIndex((item) => (typeof item === "object" ? item.name : item) === giftName);
          return set("inv", index === -1 ? items : [...items.slice(0, index), ...items.slice(index + 1)]);
        }),
      } : {}),
      time: state.time + 1,
      varTree: (previous) => {
        const chars = { ...(previous?.角色 || {}) };
        const current = chars[npcName] || {};
        chars[npcName] = {
          ...current,
          飞鸽: [...(current.飞鸽 || []), { dir: "send", content: text, turn: state.time, gift: giftName || undefined }],
        };
        const 世界 = { ...(previous?.世界 || {}) };
        世界.飞鸽待回 = [
          ...(世界.飞鸽待回 || []),
          { id: factId, npcName, sentContent: text, arriveTime, npcLoc: loc, channel, giftName: giftName || null },
        ];
        return registerFact({ ...previous, 角色: chars, 世界 }, fact, state.time);
      },
    },
    logs: [
      { t: "cmd", text: `> ${chLabel} 致「${npcName}」 ${text}${giftName ? `（附礼 ${giftName}）` : ""}` },
      { t: "item", text: `  🕊 ${channel === "pigeon" ? "信鸽已放飞" : "书信已托驿卒送出"}，往「${loc}」，约 ${shichen} 个时辰后当有回音。` },
    ],
    note: {
      text: `修书致${npcName}${giftName ? `并附礼「${giftName}」` : ""}：${text.slice(0, 24)}${text.length > 24 ? "…" : ""}`,
      owner: [{ name: npcName, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.PIGEON,
    },
  };
}

export function buyPigeon(state, qty, price) {
  const cost = qty * price;
  if ((state.char?.money || 0) < cost) {
    return { logs: [{ t: "sys", text: "  银两不够，买不起这些鸽子。" }] };
  }
  return {
    changes: {
      char: updateField("char", [add("char.money", -cost), add("char.pigeons", qty)]),
    },
    logs: [{ t: "item", text: `  🕊 买下 ${qty} 只信鸽（-${cost} 两），现有 ${(state.char?.pigeons || 0) + qty} 只。` }],
  };
}

export function collectPigeons(state, { qty, dayIdx }) {
  if ((state.flags || []).includes(`pigeon_collected_day_${dayIdx}`)) return {};
  return {
    changes: {
      flags: updateField("flags", (previous) => set("flags", [
        `pigeon_collected_day_${dayIdx}`,
        ...(previous || []).filter((flag) => !flag.startsWith("pigeon_collected_day_")),
      ])),
      char: updateField("char", add("char.pigeons", qty)),
    },
    logs: [{ t: "item", text: `  🕊 从鸽子笼领了 ${qty} 只信鸽，现有 ${(state.char?.pigeons || 0) + qty} 只。` }],
  };
}

export function processPigeons(state) {
  return (state.varTree?.世界?.飞鸽待回 || [])
    .filter((letter) => state.time >= letter.arriveTime);
}

export function applyPigeonReply(state, letter, responseText) {
  const { npcName, id, arriveTime, channel, giftName } = letter;
  const attrs = state.varTree?.角色?.[npcName] || {};
  const curAff = typeof attrs.好感度 === "number" ? attrs.好感度 : 0;
  let reply = (responseText || "").trim() || "（信纸空落落的，对方似乎无话可说。）";
  let affDelta = 1;
  const affectionMatch = reply.match(/⟦好感\s*([+-]?\d+)\s*⟧/);
  if (affectionMatch) affDelta = Math.max(AFFECTION_RULES.pigeon.min, Math.min(AFFECTION_RULES.pigeon.max, parseInt(affectionMatch[1], 10) || 0));
  const giftMatch = reply.match(/⟦回礼[:：]\s*([^|｜⟧]+)[|｜]\s*(weapon|armor|accessory|misc)\s*⟧/);
  const giftBack = giftMatch
    ? { name: giftMatch[1].trim(), category: giftMatch[2].trim() }
    : null;
  reply = reply.replace(/⟦好感\s*[+-]?\d+\s*⟧/g, "").replace(/⟦回礼[:：][^⟧]*⟧/g, "").trim();

  const affectionPath = ["角色", npcName, "好感度"];
  const newAff = applyWrite(state, add(affectionPath, affDelta)).finalValue;
  const canReturnGift = channel === "postgift" && giftName;
  const doReturnGift = canReturnGift && giftBack && newAff >= 50;
  let giftItem = null;
  if (doReturnGift) {
    const pool = newAff >= 90 ? ["蓝", "紫"] : newAff >= 70 ? ["绿", "蓝"] : ["白", "绿"];
    const quality = pool[Math.floor(random() * pool.length)];
    giftItem = makeGameItem({ name: giftBack.name, category: giftBack.category, quality });
  }

  const replyFactId = `letter_reply_${npcName}_${arriveTime}`;
  const fact = {
    id: replyFactId,
    摘要: `${npcName}回信${state.char?.name || "主角"}${doReturnGift ? `并回赠「${giftBack.name}」` : ""}。`,
    标签: "飞鸽传书",
    知晓者: [{ name: npcName, 途径: "亲历" }],
  };
  const logs = [
    { t: "item", text: `  🕊 一只信鸽落下，${npcName}的回信到了。`, standalone: true },
    { t: "narrator", text: `  「${npcName}来信」${reply}`, standalone: true, letterFrom: npcName, letterBody: reply },
  ];
  if (affDelta !== 0) logs.push({ t: "affection", text: `  💗 ${npcName} 好感度 ${affDelta > 0 ? "+" : ""}${affDelta}（${curAff} → ${newAff}）` });
  if (doReturnGift) logs.push({ t: "item", text: `  🎁 随信附回礼一件：「${giftItem.name}」（${giftItem.quality}）。` });
  else if (canReturnGift && giftBack && newAff < 50) logs.push({ t: "sys", text: `  （${npcName}收下了礼，情谊尚浅，未便回赠。）` });

  return {
    factSummary: {
      id: replyFactId,
      cue: `${npcName}回信${state.char?.name || "主角"}${doReturnGift ? `，并回赠「${giftBack.name}」` : ""}，信中大意：${reply.slice(0, 50)}`,
    },
    changes: {
      varTree: (previous) => {
        const { state: { varTree } } = applyWrite({ varTree: previous }, set(affectionPath, newAff));
        const chars = { ...varTree.角色 };
        const current = chars[npcName];
        chars[npcName] = {
          ...current,
          飞鸽: [...(current.飞鸽 || []), { dir: "reply", content: reply, turn: arriveTime, gift: doReturnGift ? giftBack.name : undefined }],
        };
        const 世界 = { ...(previous?.世界 || {}) };
        世界.飞鸽待回 = (世界.飞鸽待回 || []).filter((pending) => pending.id !== id);
        return registerFact({ ...previous, 角色: chars, 世界 }, fact, arriveTime);
      },
      ...(giftItem ? { inv: updateField("inv", (previous) => set("inv", [...(previous || []), giftItem])) } : {}),
    },
    logs,
    note: {
      text: `收到${npcName}的回信${doReturnGift ? `并得回礼「${giftItem.name}」` : ""}：${reply.slice(0, 24)}${reply.length > 24 ? "…" : ""}`,
      owner: [{ name: npcName, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.PIGEON,
    },
  };
}

export function failPigeonReply(_state, letter) {
  const { npcName, id } = letter;
  return {
    changes: {
      varTree: (previous) => {
        const 世界 = { ...(previous?.世界 || {}) };
        世界.飞鸽待回 = (世界.飞鸽待回 || []).filter((pending) => pending.id !== id);
        return { ...previous, 世界 };
      },
    },
    logs: [{ t: "sys", text: `  （寄往${npcName}的信鸽半途迷了路，这封回信终未送达。）` }],
  };
}

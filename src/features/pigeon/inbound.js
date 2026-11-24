// ── 主动来信：认识的人不定期飞鸽捎信来——npcLetterRule 按时辰抽签把信入队，
// 到点由 useNpcLetters 生成正文（AI 现写 / 人设兜底）落盘成来信；玩家从「信」
// 面板翻阅历史并直接回信（回信走现有 sendPigeonLetter，鸽子 -1）。
// 存档键全在 varTree.世界：来信待发（在途）/来信箱（历史）。
import { add, updateField } from "../../domain/rules/state/applyWrite.js";
import { registerFact } from "../../domain/rules/prompt/knowledge.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { pigeonDelayShichen } from "./logic.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { ADVENTURER_BY_NAME } from "../../domain/data/dungeon/adventurers.js";
import { ADVENTURER_IP_BY_NAME } from "../../domain/data/dungeon/adventurersIP.js";

// 可调参数：每 12 个时辰格（~6 时辰）抽一次；45% 中；同一写信人 96 格（2 日）冷却；
// 任一封落地后 24 格（12 时辰）内不再来新信；来信箱存最近 60 封。
// 世界规则不给 rng 参数：用时间窗做种子的确定性伪随机——同 seed 结果可复现，测试也稳。
export function seedRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LETTER_TUNE = {
  everyTurns: 12,
  chance: 0.45,
  senderCooldown: 96,
  globalCooldown: 24,
  maxInbox: 60,
};

const 世界信箱 = (previous) => previous?.世界 || {};

// 名字 → 数据条目：在场名单 → 常驻人物表 → 地宫冒险者池；查不到给 {name} 裸壳。
export function findNpcObject(state, npcName) {
  return (state.room?.npcs || []).find((npc) => npc.name === npcName)
    || Object.values(RESIDENT_NPCS).flat().find((npc) => npc.name === npcName)
    || ADVENTURER_BY_NAME[npcName]
    || ADVENTURER_IP_BY_NAME[npcName]
    || { name: npcName };
}

// 送信人名单：已认识人物，滤掉兽类（不会写信）；好感越高权重越大。
export function pickLetterSender(state, rng = Math.random) {
  const known = state.varTree?.世界?.已认识人物 || [];
  const inbox = state.varTree?.世界?.来信箱 || [];
  const candidates = known
    .map((name) => ({ name, npc: findNpcObject(state, name), aff: Number(state.varTree?.角色?.[name]?.好感度) || 0 }))
    .filter(({ name, npc }) => !npc.beast
      && !inbox.some((letter) => letter.npcName === name && state.time - letter.turn < LETTER_TUNE.senderCooldown));
  if (!candidates.length) return null;
  const weighted = candidates.map((c) => ({ ...c, w: 1 + c.aff / 25 }));
  const total = weighted.reduce((sum, c) => sum + c.w, 0);
  let roll = rng() * total;
  for (const c of weighted) { roll -= c.w; if (roll <= 0) return c; }
  return weighted[weighted.length - 1];
}

// 抽签入队：到点掷一次；中了挑一个写信人按距离排到达时刻，鸽子正在路上。
export function queueInboundLetter(state, rng = Math.random) {
  const 世界 = 世界信箱(state.varTree);
  if ((世界.来信待发 || []).length) return null; // 一封信路上时不再发第二封
  const inbox = 世界.来信箱 || [];
  const lastArrival = inbox.length ? Math.max(...inbox.map((l) => l.turn)) : -Infinity;
  if (state.time - lastArrival < LETTER_TUNE.globalCooldown) return null;
  if (rng() >= LETTER_TUNE.chance) return null;
  const picked = pickLetterSender(state, rng);
  if (!picked) return null;
  const { delay } = pigeonDelayShichen(state, picked.name);
  const letter = {
    id: `letter_in_${picked.name}_${state.time}`,
    npcName: picked.name,
    arriveTime: state.time + delay * 2,
    sentAt: state.time,
  };
  return {
    changes: {
      varTree: (previous) => {
        const 世界 = { ...(previous?.世界 || {}) };
        世界.来信待发 = [...(世界.来信待发 || []), letter];
        return { ...previous, 世界 };
      },
    },
  };
}

export function dueInboundLetters(state) {
  return (state.varTree?.世界?.来信待发 || []).filter((letter) => state.time >= letter.arriveTime);
}

// ── 无 API 兜底：按人物成色（生气/媚骨/好感档）挑手写句，{name}=写信人自称。
const FALLBACK = {
  grudge: [
    "上回的事我还记着。这信不为和好，只想叫你知道——我可没忘。",
    "笔落成字，气还没消。你自己心里有数。",
  ],
  flirty: [
    "昨夜睡不着，枕畔翻来覆去想的尽是你。什么时候来看我？别叫我等得太久。",
    "鸽子比人乖，叫它来它就来了。你呢？什么时候才肯来？",
  ],
  warm: [
    "别来无恙？这几日总想起你，托这只鸽子捎句话——得空来寻我，煮茶等你。",
    "前几日说到的事有了眉目，你来了我细讲。近来可还顺遂？",
  ],
  poor: [
    "手头近来紧了些……你若宽裕，能不能看交情借我几两？来日必还。",
    "今年光景不好，揭锅都难。你若得空来一趟，我有事相求。",
  ],
  plain: [
    "一别多日，近来可还顺遂？乡里闲话多，念起旧交便写一笔，勿怪打扰。",
    "许久未通音讯。外头风紧，凡事多留个心眼。",
    "见字如面。你在那头闯荡，消息传回来时听一耳朵，便想写信问问近况。",
  ],
  cold: [
    "许久未有音讯。各忙各的也好——这封信只当留个记号，他日江湖再见。",
  ],
};

export function inboundFallbackLine(state, letter, rng = Math.random) {
  const name = letter.npcName;
  const attrs = state.varTree?.角色?.[name] || {};
  const npc = findNpcObject(state, name);
  const aff = Number(attrs.好感度) || 0;
  const flirty = /媚|浪|婊|撩|妖/.test(`${npc.personality || ""}${npc.archetypeLabel || ""}${npc.brief || ""}`);
  const poor = /穷|破|落魄|乞|债|穷酸/.test(`${npc.brief || ""}${npc.personality || ""}`);
  const pool = attrs.生气状态 ? FALLBACK.grudge
    : flirty && aff >= 30 ? FALLBACK.flirty
    : poor ? FALLBACK.poor
    : aff >= 60 ? FALLBACK.warm
    : aff >= 30 ? FALLBACK.plain
    : FALLBACK.cold;
  return pool[Math.floor(rng() * pool.length)];
}

// 落地成信：鸽子落下+信纸卡+入来信箱（未读）+回信鸽 +1 + 事实登记。
export function applyInboundLetter(state, letter, content, opts = {}) {
  const text = String(content || "").replace(/⟦[^⟧]*⟧/g, "").trim()
    || "（信纸上字迹潦草，辨不出写了什么。）";
  const { npcName, id } = letter;
  const fact = {
    id,
    摘要: `${npcName}来信问候${state.char?.name || "主角"}。`,
    标签: "飞鸽传书",
    知晓者: [{ name: npcName, 途径: "亲历" }],
  };
  return {
    factSummary: { id, cue: `${npcName}主动来信问候主角，信中大意：${text.slice(0, 50)}` },
    changes: {
      char: updateField("char", add("char.pigeons", 1)), // 来信的鸽子留了下来，回信可用
      varTree: (previous) => {
        const chars = { ...(previous?.角色 || {}) };
        const cur = chars[npcName] || {};
        chars[npcName] = { ...cur, 飞鸽: [...(cur.飞鸽 || []), { dir: "recv", content: text, turn: letter.arriveTime }] };
        const 世界 = { ...(previous?.世界 || {}) };
        世界.来信待发 = (世界.来信待发 || []).filter((pending) => pending.id !== id);
        世界.来信箱 = [
          { id, npcName, content: text, turn: letter.arriveTime, read: false },
          ...(世界.来信箱 || []),
        ].slice(0, LETTER_TUNE.maxInbox);
        return registerFact({ ...previous, 角色: chars, 世界 }, fact, letter.arriveTime);
      },
    },
    logs: [
      { t: "item", text: `  🕊 一只信鸽落下——${npcName}捎来一封信。` },
      { t: "narrator", text: `  「${npcName}来信」${text}` },
    ],
    note: opts.note === false ? undefined : {
      text: `${npcName}来信：${text.slice(0, 24)}${text.length > 24 ? "…" : ""}`,
      owner: [{ name: npcName, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.PIGEON,
    },
  };
}

export const unreadLetterCount = (state) =>
  (state.varTree?.世界?.来信箱 || []).filter((l) => !l.read).length;

// 点开「信」即全部已读（顶栏计数清零）。
export function markAllLettersRead(state) {
  if (!unreadLetterCount(state)) return {};
  return {
    changes: {
      varTree: (previous) => {
        const 世界 = { ...(previous?.世界 || {}) };
        世界.来信箱 = (世界.来信箱 || []).map((l) => (l.read ? l : { ...l, read: true }));
        return { ...previous, 世界 };
      },
    },
  };
}

// 世界规则：每 everyTurns 个时辰格掷一次签——克制，不刷屏。
export const npcLetterRule = {
  id: "npc.inbound-letter",
  deps: (state) => [Math.floor((state.time || 0) / LETTER_TUNE.everyTurns)],
  run(state, { firstRun } = {}) {
    if (firstRun) return null;
    return queueInboundLetter(state, seedRng((state.time || 0) * 2654435761));
  },
};

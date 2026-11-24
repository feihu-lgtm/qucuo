// 查看 NPC 不再整轮 act：系统卡片立刻落日志，时辰 +1，外貌描写在后台补到卡片下面。
// 没配 API 或 AI 出错时只留卡片。
import { gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { buildNpcLookPrompt, npcLookCard } from "../../domain/rules/npc/npcLookBrief.js";
import { npcTradeOf } from "../../domain/rules/npc/npcTrade.js";
import { parseSettleNarration } from "../../domain/rules/settle/settleBrief.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";
import { backfillInBackground, newBackfillKey } from "../../engine/ports/backfill.js";
import { askStoryteller, hasApiKey } from "../../engine/ports/storyteller.js";
import { getLedger } from "../../domain/rules/memory/npcLedger.js";
import { noteVisibleTo } from "../../domain/rules/memory/note.js";
import { getAllMemories } from "../../infra/memoryStore.js";
import { embeddingReady } from "../../engine/ports/embeddingService.js";
import { sessionUiStore } from "../../store/sessionUiStore.js";

const trim60 = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60);

// 「你和他的过往」之记忆库半层：实体索引里点了名的、或正文里提到他的纸条，
// 取最新几条。记忆开关关着（embeddingEnabled=false/没配）这层不出——关的是
// "读"不是"删库"，旧纸条还在 IndexedDB，召回通路同样得认这道闸。私有/共同
// 目击的纸条走 owner 门（presentNames 只有他）：旁白私聊提到他，不等于他知情。
async function recallNpcMemoryTexts(name, { cfg, flags } = {}, limit = 3) {
  if (!embeddingReady(cfg)) return [];
  try {
    const all = await getAllMemories();
    return (all || [])
      .filter((m) => (Array.isArray(m?.entities) ? m.entities.includes(name) : (m?.text || "").includes(name))
        && noteVisibleTo(m, { presentNames: [name], unlockedFlags: flags }))
      .sort((a, b) => (b?.turn ?? 0) - (a?.turn ?? 0))
      .slice(0, limit)
      .map((m) => m.text)
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 三层「熟人感」上下文，全从 getState 收集（纯读，无副作用）：
// 旧账(角色.旧账) + 记忆库实体召回 → 共同记忆；convo 提到他的最近几条 → 近期对话；
// 角色.飞鸽 → 书信往来。各层限量防爆 token，没记录的层在 prompt 里整层不写。
// convo 里不算"跟他的交谈"的条目：kind:"look"（看/环顾写进的系统卡片与事实行，
// 新档标记）——不然回头再看他一次，上次的卡片就挤掉真对话、还凭空造出交谈史；
// 旧档没标记，靠指令头/卡片行样式认；旁白私聊前缀同样不是"跟他说的"。
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isNotNpcDialogue = (m, name) =>
  m?.kind === "look"
  || /^（私聊）|^（旁白私聊回应）/.test(m?.content || "")
  // 系统回写的看指令精确是「看 名字」——玩家真说出口的「看 你今天气色好」
  // 是搭话不是看卡，得留着。
  || new RegExp(`^看[\\s　]+${escapeRe(name)}$`).test(m?.content || "")
  || (m?.role === "assistant"
    && (/装束：|在场：|出口：/.test(m.content || "")
      || String(m.content || "").trim() === name
      || m.content.startsWith(`${name}：`)));

function collectNpcContext(state, npc) {
  const name = npc?.name || "";
  const ledgerLines = getLedger(state?.varTree, name).lines.slice(-3);
  const convoLines = (state?.convo || [])
    .filter((m) => typeof m?.content === "string" && m.content.includes(name) && !isNotNpcDialogue(m, name))
    .slice(-3)
    .map((m) => trim60(m.content))
    .filter(Boolean);
  const letters = (state?.varTree?.角色?.[name]?.飞鸽 || [])
    .slice(-2)
    .map((m) => `${m.dir === "send" ? "你去信" : "他的回信"}：${trim60(m.content)}${m.gift ? `（附：${m.gift}）` : ""}`);
  return { ledgerLines, convoLines, letters };
}

export function lookNpcInBackground(npc, extraReplies = [], {
  addLog, setTime, setConvo, setLog, noteAction,
  getState = () => gameStore.getState(), ask = askStoryteller, canAsk = hasApiKey,
  advanceTime = true, getApiCfg = () => sessionUiStore.getState().apiCfg,
}) {
  const epoch = getGameEpoch();
  const isStale = () => isGameEpochStale(epoch);
  const state = getState();
  const cmd = `看 ${npc.name}`;
  // 台账里有「被买走的甲刃」快照——甲刃被买空的 NPC 光靠 carriedItems
  // 看不出被扒过，attireExposure 要台账作证。
  const trade = npcTradeOf(state.npcState, npc);
  const card = [...npcLookCard(npc, { trade }), ...extraReplies];
  const key = newBackfillKey("npcLook");

  // 描写跟在整张卡片下面：只给最后一行打 key。
  addLog([{ t: "cmd", text: `> ${cmd}` }, ...card.slice(0, -1), ...tagBackfill(card.slice(-1), key)]);
  if (advanceTime) setTime((t) => t + 1);
  setConvo?.((prev) => [...(prev || []),
    { role: "user", content: cmd, kind: "look" },
    { role: "assistant", content: card.map((row) => row.text.trim()).join("；"), kind: "look" },
  ]);
  noteAction?.("action");

  const { ledgerLines, convoLines, letters } = collectNpcContext(state, npc);
  // prompt 到真正发问那一刻才组装：记忆库读取是异步的，塞在 ask 闭包里不挡主线程。
  return backfillInBackground(key, {
    canAsk,
    isStale,
    setLog,
    ask: async () => {
      const memoryTexts = await recallNpcMemoryTexts(npc.name, { cfg: getApiCfg(), flags: state.flags });
      if (isStale()) return null;
      const { sys, user } = buildNpcLookPrompt(npc, {
        place: state.room?.name || "", trade, state,
        history: [...ledgerLines, ...memoryTexts], convoLines, letters,
      });
      return ask(sys, user, { callLabel: "端详描写", maxTokens: 400 });
    },
    parse: parseSettleNarration,
  });
}

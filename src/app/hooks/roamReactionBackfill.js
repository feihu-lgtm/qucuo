// W-ROAM 增量：NPC 进出玩家视野房的即时反应后台补写。
// 走位与占位：roam.js 世界规则判定进出 playerSpot 后，useWorldRulesRunner 先把
// 极简动向占位行带 tagBackfill 落公屏（离线/无 Key 时的保底），再调本模块——
// 异步 withAI("roam.reaction") 拿回 60-110 字白描，原位替换占位行（V6 起不再追加双行）。
// 三个防呆护栏（图纸规格）：
//   1. 同拍多人进出合并单次调用——movements 整组打包进一次 roam.reaction；
//   2. 回调落屏前核对 room.name/innerRoomName 仍是触发房间，已换房静默丢弃；
//   3. isGameEpochStale 常规读档护栏。
// 写入边界：trim 后只经 backfill 插公屏 desc，不写 convo、不改 varTree。
import { gameStore, getGameEpoch, isGameEpochStale, gameActions } from "../../store/gameStore.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import { hasApiKey } from "../../engine/ports/storyteller.js";
import { replaceWhenIdle } from "../../engine/ports/backfill.js";
import { renderDiegeticState } from "../../domain/rules/clapboard/diegeticState.js";
import { npcAffectionLabel } from "../../domain/rules/prompt/mvu.js";
import { normalizeLedgerEntries } from "../../domain/rules/memory/npcLedger.js";
import { isNpcVisibleInInnerRoom, getDistrictAnchor, getInnerRoom } from "../../domain/rules/map/innerMap.js";
import { unlockedCompanions } from "../../domain/rules/companion/companion.js";
import { DIRS } from "../../utils/mudHelpers.js";
import { sessionUiStore } from "../../store/sessionUiStore.js";
import "../calls/registerAllPrompts.js";

const webAi = createWebAi();

// 声口限制标签：灵兽/机关/哑者不出人言（图纸「扣住声口限制」条的喂入）。
function voiceTagOf(npc) {
  if (!npc) return "";
  if (npc.beast) return "灵兽不出人言，只有鼻息耳尾动作与兽鸣";
  if (npc.cannotSpeak) return "哑者不出人言，只用手势神情";
  if (npc.voice === "mechanical" || npc.mute) return "机关人偶不出人言，只有机括声响";
  return "";
}

// 剥内部标记取正文末尾 70 字：隐藏标记 ⟦…⟧、SEAL 尾章、Json 残渣都不进喂料。
function lastBeatEchoOf(convo) {
  const last = [...(convo || [])].reverse().find((m) => m?.role === "assistant" && typeof m.content === "string");
  if (!last) return "";
  let prose = last.content;
  // Review 修：单调用旧路 convo 存的是 rawFull 原包（appendConvo 不解析）——
  // JSON 外壳绝不许当「屋内余波」喂给白描说书人，剥出 output 正文，剥不动整段丢弃。
  if (/^\s*[{[]/.test(prose)) {
    try {
      const parsed = JSON.parse(prose);
      prose = typeof parsed?.output === "string" ? parsed.output : "";
    } catch {
      // 截断的 rawFull（slice 500）多半 parse 不动——试着截 output 字段裸文本
      const m = prose.match(/"output"\s*:\s*"((?:[^"\\]|\\.)*)/);
      prose = m ? m[1].replace(/\\n/g, "").replace(/\\"/g, '"') : "";
    }
    if (!prose.trim()) return "";
  }
  const clean = prose
    .split("---SEAL---")[0]
    .replace(/⟦[^⟧]*⟧/g, "")
    .replace(/\s+/g, "")
    .trim();
  return clean.slice(-70);
}

function enrichmentFor(state, name) {
  const npc = (state.room?.npcs || []).find((n) => n?.name === name) || null;
  const chr = state.varTree?.角色?.[name];
  const bits = [];
  if (chr) {
    const aff = chr.好感度;
    bits.push(`${npcAffectionLabel(typeof aff === "number" ? aff : null)}${typeof aff === "number" ? `（好感${aff}）` : ""}`);
    if (chr.生气状态?.active) bits.push("怒气未消");
  }
  const ledger = normalizeLedgerEntries(state.varTree?.角色?.[name]?.心账);
  const latest = ledger.length ? `${ledger[ledger.length - 1].tag}·${ledger[ledger.length - 1].summary}`.slice(0, 40) : "";
  return {
    brief: npc?.brief || "",
    voiceTag: voiceTagOf(npc),
    relationBrief: bits.join("，"),
    latestLedger: latest,
    carryBrief: "",
    scheduled: Array.isArray(npc?.schedule),
  };
}

export function roamReactionBackfill(movements, {
  key,
  triggerRoomName,
  triggerInnerRoomName,
  getState = () => gameStore.getState(),
  setLog = gameActions.setLog,
  canAsk = hasApiKey,
  getApiCfg = () => sessionUiStore.getState().apiCfg,
  ask = null, // 测试注入桩；(ctx) => Promise<{text}>
} = {}) {
  if (!Array.isArray(movements) || !movements.length || !key) return false;
  const epoch = getGameEpoch();
  const isStale = () => isGameEpochStale(epoch);
  // 换房作废锁：触发那一刻的房间名/内层房与落屏那一刻不一致，静默丢弃
  const roomGone = () => {
    const cur = getState();
    return (cur.room?.name || "") !== triggerRoomName || (cur.innerRoomName ?? null) !== (triggerInnerRoomName ?? null);
  };
  const stale = () => isStale() || roomGone();

  const state = getState();
  const playerSpot = triggerInnerRoomName || getDistrictAnchor(triggerRoomName);
  const playerName = state.char?.name || "少侠";
  const enriched = movements.map((m) => ({
    ...m,
    dirLabel: DIRS[m.dir] || m.dir,
    ...enrichmentFor(state, m.name),
  }));
  const moverNames = new Set(movements.map((m) => m.name));
  const bystanders = (state.room?.npcs || [])
    .filter((n) => n?.name && !moverNames.has(n.name) && isNpcVisibleInInnerRoom(triggerRoomName, triggerInnerRoomName, n))
    .slice(0, 6)
    .map((n) => `${n.name}${n.brief ? `（${n.brief}）` : ""}`);
  // Review 修：随行同伴不入 room.npcs（buildPresence 单并）——旁观者漏了他们，
  // 玩家明明带着人，喂料却说「空无旁人」。按 D6 同口径补上非留守随行。
  for (const slot of unlockedCompanions(state.companionState).filter((c) => !state.companionState?.[c.key]?.stationed)) {
    const label = slot.label || slot.data?.name;
    if (label && !moverNames.has(label) && !bystanders.some((b) => b.startsWith(label))) {
      bystanders.push(`${label}（随行同伴）`);
    }
  }
  const ctx = {
    placeLabel: triggerInnerRoomName && triggerInnerRoomName !== triggerRoomName
      ? `${triggerRoomName}·${triggerInnerRoomName}` : (playerSpot || triggerRoomName),
    // Review 修：room.desc 是据点级描写——内层房得取 INNER_MAP 自己的房间描写，
    // 不然「老孙饭馆」的进出配着村口泥地的景。
    roomDescBrief: String(
      (triggerInnerRoomName && getInnerRoom(triggerRoomName, triggerInnerRoomName)?.desc)
      || state.room?.desc || "",
    ).replace(/\s+/g, "").slice(0, 40),
    diegeticLine: renderDiegeticState({ char: state.char, inv: state.inv, time: state.time }),
    lastBeatEcho: lastBeatEchoOf(state.convo),
    movements: enriched,
    bystanders,
    playerName,
    cfg: getApiCfg(),
  };

  (async () => {
    try {
      if (stale() || !canAsk()) return false;
      const { text } = ask
        ? await ask(ctx)
        : await withAI("roam.reaction", ctx, {
          ai: webAi,
          apiCfg: ctx.cfg,
          modelOptions: { disableThinking: true },
        });
      if (stale()) return false;
      const line = String(text || "").trim();
      if (!line) return false;
      // V6：原位替换占位行（不再追加在其下方）——公屏条数不变，杜绝双行重复。
      return await replaceWhenIdle(key, line, { setLog, isStale: stale });
    } catch {
      return false;
    }
  })();
  return true;
}

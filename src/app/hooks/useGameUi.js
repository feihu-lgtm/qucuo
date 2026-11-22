import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PRESETS } from "../../engine/newGame.js";
import { canBypassExclusive, getCurrentStage, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getZoneTheme, ink } from "../../ui/theme.js";
import { loadConfig } from "../../infra/apiConfig.js";
import { getActivePreset } from "../../ui/screens/PresetManager.jsx";
import { describeCatalogForAI } from "../../domain/data/items/catalog.js";
import { buildBudgetInstruction, INTENT } from "../../domain/rules/prompt/inputIntent.js";
import { buildNarratorWhisperContext, gateQuestTopic, narratorVoicePrompt, narratorWhisperLengthNote } from "../../domain/rules/narrator/narrator.js";
import { gateBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import { matchNpcLore, buildNpcLoreBlock, gateScenario } from "../../domain/rules/prompt/worldbook.js";
import { QUCUO_MAP } from "../../domain/data/map/qucuoMap.js";
import { isNpcVisibleInInnerRoom as isVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { loadPortraits, getSnowLeopardForm, getPearlForm } from "../../domain/rules/companion/portraits.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import { readMobileColumn, writeMobileColumn } from "../../utils/mobileColumn.js";
import { buildMainStatePrompt, buildWhisperStatePrompt, getPresentNpcs, renderPromptTemplate } from "../../domain/rules/prompt/promptRefs.js";
import { gameStore } from "../../store/gameStore.js";

export function useGameUi({
  room, innerRoomName, char, inv, log, time, narrator, preset,
  flags, questProgress, varTree, varTreeRef,
}) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(loading);
  const [waitSecs, setWaitSecs] = useState(0);
  const waitTimerRef = useRef(null);
  const [pendingTalks, setPendingTalks] = useState(0);
  const pendingTalksRef = useRef(0);
  const changePendingTalks = useCallback((delta) => {
    const next = Math.max(0, pendingTalksRef.current + delta);
    pendingTalksRef.current = next;
    setPendingTalks(next);
  }, []);
  const [queueCount, setQueueCount] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [mapBig, setMapBig] = useState(false);
  const mapBigCloseGuard = useOverlayCloseGuard(() => setMapBig(false));
  const [mapView, setMapView] = useState("outer");
  const [peoplePanel, setPeoplePanel] = useState({ present: true, absent: true });
  const [gm, setGm] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileColumn, setMobileColumn] = useState(() => readMobileColumn());
  useEffect(() => { writeMobileColumn(undefined, mobileColumn); }, [mobileColumn]);
  const [mobileTopMenu, setMobileTopMenu] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null);
  const [interactMode, setInteractMode] = useState("action");
  const [talkTarget, setTalkTarget] = useState(null);
  const [activeTarget, setActiveTarget] = useState(null);
  const [activeGroundItem, setActiveGroundItem] = useState(null);
  const activeGroundItemContextRef = useRef({ roomName: room.name, innerRoomName });
  useEffect(() => {
    const previous = activeGroundItemContextRef.current;
    const contextChanged = previous.roomName !== room.name || previous.innerRoomName !== innerRoomName;
    activeGroundItemContextRef.current = { roomName: room.name, innerRoomName };
    const stillGrounded = (room.items || []).some(item =>
      (typeof item === "string" ? item : item?.name) === activeGroundItem);
    if (activeGroundItem && (contextChanged || !stillGrounded)) setActiveGroundItem(null);
  }, [activeGroundItem, room.name, innerRoomName, room.items]);
  const [nsfwOn, setNsfwOn] = useState(true);
  const [outfitState, setOutfitState] = useState({ loading: false, picks: [], error: "" });
  const [pigeonTarget, setPigeonTarget] = useState(null);
  const [activeNpcMenu, setActiveNpcMenu] = useState(null);
  const [activeItemMenu, setActiveItemMenu] = useState(null);
  const [playerAvatarCustom, setPlayerAvatarCustom] = useState(() => {
    try { return localStorage.getItem("qucuo_player_avatar") || ""; } catch { return ""; }
  });
  const [characterPageTarget, setCharacterPageTarget] = useState(null);
  const [portraits, setPortraits] = useState(loadPortraits());
  const [slForm, setSlFormState] = useState(getSnowLeopardForm());
  const [slImgErr, setSlImgErr] = useState(false);
  const [pearlForm, setPearlFormState] = useState(getPearlForm());
  const [pearlImgErr, setPearlImgErr] = useState(false);
  const [narratorImgErr, setNarratorImgErr] = useState(false);
  const [portraitTarget, setPortraitTarget] = useState(null);
  const [apiCfg, setApiCfg] = useState(loadConfig());
  const [uiScale, setUiScale] = useState(() => {
    const saved = localStorage.getItem("wuxia_mud_ui_scale");
    return saved ? parseFloat(saved) : 1;
  });
  const [font, setFont] = useState(() =>
    localStorage.getItem("wuxia_mud_ui_font") === "song" ? "song" : "pixel");
  useEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);
  const [isDayMode, setIsDayMode] = useState(() =>
    localStorage.getItem("wuxia_mud_day_mode") === "1");
  useEffect(() => {
    document.documentElement.dataset.theme = isDayMode ? "day" : "night";
  }, [isDayMode]);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [forcedDuelNpc, setForcedDuelNpc] = useState(null);
  const [duelingNpc, setDuelingNpc] = useState(null);
  const [duelPending, setDuelPending] = useState(null);
  const [pendingQuestBranch, setPendingQuestBranch] = useState(null);
  const [activePersuasion, setActivePersuasion] = useState(null);
  const [activeBuilding, setActiveBuilding] = useState(null);
  const [gambleNegotiation, setGambleNegotiation] = useState({});
  const [buildingPanelMinimized, setBuildingPanelMinimized] = useState(false);
  const [justMeditated, setJustMeditated] = useState(false);
  const [tradingShop, setTradingShop] = useState(null);
  const inputRef = useRef(null);
  const logEnd = useRef(null);
  const composingRef = useRef(false);

  const availableQuestsHere = useMemo(() => {
    const result = [];
    for (const quest of QUCUO_QUESTS) {
      if (!quest.stages?.length) continue;
      const prog = questProgress[quest.id];
      if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
      if (!isQuestGateOpen(quest, questProgress, flags)) continue;
      if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
      const isNewlyGiven = !prog;
      const stage = isNewlyGiven ? quest.stages[0] : (prog.status === "active" ? getCurrentStage(quest, prog) : null);
      if (!stage) continue;
      const giverNpc = quest.giver ? room.npcs?.find(n => n.name === quest.giver) : null;
      const here = quest.giver
        ? !!(giverNpc && isVisibleInInnerRoom(room.name, innerRoomName, giverNpc))
        : stage.at === room.name;
      if (!here) continue;
      if (stage.requireLocation) {
        const rl = stage.requireLocation;
        if (rl.district && rl.district !== room.name) continue;
        if (rl.inner && rl.inner !== innerRoomName) continue;
      }
      result.push({ quest, stage, isNewlyGiven });
    }
    return result;
  }, [room, questProgress, flags, char, innerRoomName]);

  const liveNpcMenu = activeNpcMenu
    ? (room.npcs.find(n => n.name === activeNpcMenu.name) || activeNpcMenu)
    : null;
  const AV_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/player/";
  const genderAvatar = { "男": AV_BASE + "male.webp", "女": AV_BASE + "female.webp" };
  const playerAvatar = playerAvatarCustom || genderAvatar[char.gender] || (AV_BASE + "other.webp");
  const zoneTheme = getZoneTheme(room.name, isDayMode);
  const clrNight = { sys: "var(--good)", cmd: "var(--warn)", desc: "var(--text)", room: "var(--accent)", item: "#c4a040", stat: "#8ab4d4", skill: "#b48adf", err: "#c45044", choice: "#6aaa8a", narrator: "#d68a8a", crash: "#c45044", confess: "#c8663a", affection: "#f0a0c0", quest: "#c8663a" };
  const clrDay = { sys: "var(--good)", cmd: "var(--warn)", desc: "#3d3626", room: "#1e5a6a", item: "#7a5410", stat: "var(--info)", skill: "#5a3a7a", err: "var(--accent)", choice: "#2e6a4a", narrator: "#8a2a6a", crash: "var(--accent)", confess: "#8a5a0a", affection: "#a0305a", quest: "#8a5a0a" };
  const clr = isDayMode ? clrDay : clrNight;
  const uiPink = ink("pink", isDayMode);
  const uiGreen = ink("green", isDayMode);
  const uiTurquoise = ink("turquoise", isDayMode);
  const uiGold = ink("gold", isDayMode);
  const uiCrimson = ink("crimson", isDayMode);
  const inkDivider = `linear-gradient(90deg, transparent, ${zoneTheme.border}, transparent)`;
  const S = {
    panel: { display: "flex", flexDirection: "column", borderRight: `1px solid ${zoneTheme.border}`, minWidth: 0, overflow: "hidden" },
    label: {
      padding: isMobile ? "6px 14px" : "0 14px", minHeight: 38, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 6,
      color: zoneTheme.accentDim, fontSize: "11px", letterSpacing: "2px",
      borderBottom: "none", backgroundImage: `linear-gradient(180deg, transparent, transparent calc(100% - 1px), ${zoneTheme.border} calc(100% - 1px))`,
      flexShrink: 0,
    },
    scroll: { flex: 1, padding: "10px 16px", overflowY: "auto", overflowX: "hidden", fontSize: "12.5px", lineHeight: 1.8, wordBreak: "break-word" },
  };

  const buildBugReportTurns = useCallback(() => {
    const groups = [];
    let current = null;
    for (const entry of log) {
      const isStandalone = entry.t === "room" || entry.standalone;
      if (isStandalone) {
        if (current) { groups.push(current); current = null; }
        groups.push({ entries: [entry] });
      } else if (entry.t === "cmd") {
        if (current) groups.push(current);
        current = { entries: [entry] };
      } else {
        if (!current) current = { entries: [] };
        current.entries.push(entry);
      }
    }
    if (current) groups.push(current);
    return groups.map((g, i) => {
      const cmdEntry = g.entries.find(e => e.t === "cmd");
      const firstText = (cmdEntry?.text || g.entries[0]?.text || "").replace(/^[>\s]+/, "").trim();
      const label = `#${i + 1} ${firstText.slice(0, 20) || "（场景/系统）"}`;
      const preview = g.entries.map(e => (e.text || "").trim()).filter(Boolean).join("\n");
      return { label, preview, entries: g.entries };
    });
  }, [log]);

  const getLiveBlockText = useCallback((view) => {
    const out = {};
    const put = (k, v) => { if (v != null && String(v).trim()) out[k] = String(v); };
    try {
      const scope = view?.scope || "full";
      const activePreset = getActivePreset();
      const state = gameStore.getState();

      if (scope === "whisper") {
        put("whisper_ctx", buildNarratorWhisperContext(narrator.affection));
        put("voice", narratorVoicePrompt(narrator));
        put("world_state", buildWhisperStatePrompt(state, { preview: true }));
        put("facts", renderPromptTemplate("@事实摘要", {
          varTree: varTreeRef.current, promptRefOptions: { factLimit: 8 },
        }).text || "（事实账本当前为空）");
        put("narrator_lore", (apiCfg.narratorLorebook || "").trim() || "（未填写，本块一个字都不发）");
        const bg = gateBodyProfile(char.bodyProfile, { whisper: true, nsfw: nsfwOn, scanText: "" });
        put("body_gate", bg.text || `（当前灭灯：${bg.dark.join("、") || "体貌未填写"}）`);
        put("topic_gate", "（默认不给。命中身世/赌石邀帖等关键词才点亮——这里没有输入，故灭灯）");
        const qg = gateQuestTopic("任务", narrator.affection, QUCUO_QUESTS, questProgress);
        put("quest_gate", qg.text || "（本轮没聊到任务）");
        put("whisper_scenario", gateScenario(activePreset.scenario, { scope: "whisper", userInput: "", lastReply: "" }).text);
        put("whisper_length", narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords));
        return out;
      }

      put("voice", narratorVoicePrompt(narrator));
      const intentCode = view?.intent || "UNKNOWN";
      const fakeIntent = INTENT[intentCode] || INTENT.UNKNOWN;
      put("length", buildBudgetInstruction(fakeIntent, "", apiCfg.targetWordCount, apiCfg.intentBudgets));
      put("preset_scenario", gateScenario(activePreset.scenario, { scope, userInput: "", lastReply: "" }).text);
      for (const [blockId, promptId] of [["preset_genrules", "generalRules"], ["preset_wenfeng", "styleRules"]]) {
        const found = (preset.prompts || []).find(x => x.id === promptId || (x.name || "").includes(blockId === "preset_genrules" ? "通用规则" : "文体"));
        if (found?.content) put(blockId, found.content);
      }
      const visible = getPresentNpcs(state);
      put("npc_lore", buildNpcLoreBlock(matchNpcLore(
        [...(preset.npcLore || []), ...importedRegistry.getImportedNpcLore()],
        { roomNpcNames: visible.map(n => n.name), userInput: "", lastReply: "", includeLastReply: false }
      )) || "（本轮无在场者需注入人设）");
      if (scope === "full") put("catalog", describeCatalogForAI());
      const bg2 = gateBodyProfile(char.bodyProfile, { scope, nsfw: nsfwOn, scanText: "" });
      put("body_gate", bg2.text || `（当前灭灯：${bg2.dark.join("、") || "体貌未填写"}）`);
      put("user_ctx", buildMainStatePrompt({ ...state, visibleNpcs: visible }, { preview: true }));
    } catch (e) {
      out.__error = `拉取时出错：${e.message || e}`;
    }
    return out;
  }, [narrator, inv, char, time, room, innerRoomName, varTree, apiCfg, nsfwOn, questProgress]);

  return {
    presets, setPresets,
    input, setInput, loading, setLoading, loadingRef, waitSecs, setWaitSecs, waitTimerRef,
    pendingTalks, setPendingTalks, pendingTalksRef, changePendingTalks, queueCount, setQueueCount,
    collapsedGroups, setCollapsedGroups, mapBig, setMapBig, mapBigCloseGuard, mapView, setMapView,
    peoplePanel, setPeoplePanel, gm, setGm, isMobile, setIsMobile, mobileColumn, setMobileColumn,
    mobileTopMenu, setMobileTopMenu, settingsInitialTab, setSettingsInitialTab,
    interactMode, setInteractMode, talkTarget, setTalkTarget, activeTarget, setActiveTarget,
    activeGroundItem, setActiveGroundItem,
    nsfwOn, setNsfwOn, outfitState, setOutfitState, pigeonTarget, setPigeonTarget,
    activeNpcMenu, setActiveNpcMenu, activeItemMenu, setActiveItemMenu,
    playerAvatarCustom, setPlayerAvatarCustom, characterPageTarget, setCharacterPageTarget,
    portraits, setPortraits, slForm, setSlFormState, slImgErr, setSlImgErr,
    pearlForm, setPearlFormState, pearlImgErr, setPearlImgErr,
    narratorImgErr, setNarratorImgErr, portraitTarget, setPortraitTarget,
    apiCfg, setApiCfg, uiScale, setUiScale, font, setFont, isDayMode, setIsDayMode, cmdHistory, setCmdHistory,
    histIdx, setHistIdx, forcedDuelNpc, setForcedDuelNpc, duelingNpc, setDuelingNpc,
    duelPending, setDuelPending, pendingQuestBranch, setPendingQuestBranch,
    activePersuasion, setActivePersuasion, activeBuilding, setActiveBuilding,
    gambleNegotiation, setGambleNegotiation, buildingPanelMinimized, setBuildingPanelMinimized,
    justMeditated, setJustMeditated, tradingShop, setTradingShop, inputRef, logEnd, composingRef,
    availableQuestsHere, liveNpcMenu, AV_BASE, genderAvatar, playerAvatar, zoneTheme,
    clr, uiPink, uiGreen, uiTurquoise, uiGold, uiCrimson, inkDivider, S,
    buildBugReportTurns, getLiveBlockText,
  };
}

export function usePresetImport({ loadPreset, setPresets, setLog }) {
  return useCallback(() => {
    const el = document.createElement("input"); el.type = "file"; el.accept = ".json";
    el.onchange = (e) => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = (ev) => {
        try {
          const p = JSON.parse(ev.target.result);
          if (!p.name || !p.scenario || !p.room) throw new Error("缺少必要字段");
          const np = { ...DEFAULT_PRESETS[0], ...p, id: p.id || Date.now().toString() };
          setPresets(ps => [...ps.filter(x => x.id !== np.id), np]);
          loadPreset(np);
        } catch (err) { setLog(l => [...l, { t: "err", text: `  导入失败：${err.message}` }]); }
      };
      r.readAsText(f);
    };
    el.click();
  }, [loadPreset]);
}

export function createInputKeyHandler({
  composingRef, interactMode, sendPigeonLetter, pigeonTarget, input, act,
  cmdHistory, histIdx, setHistIdx, setInput,
}) {
  return (e) => {
    if (e.key === "Enter") {
      if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return;
      if (interactMode === "pigeon") { sendPigeonLetter(pigeonTarget, input, { channel: "pigeon" }); return; }
      act(input); return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); if (cmdHistory.length) { const ni = Math.min(histIdx + 1, cmdHistory.length - 1); setHistIdx(ni); setInput(cmdHistory[ni]); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(cmdHistory[histIdx - 1]); } else { setHistIdx(-1); setInput(""); } return; }
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PRESETS } from "../../engine/newGame.js";
import { canBypassExclusive, getCurrentStage, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getZoneTheme, ink } from "../../utils/theme.js";
import { loadConfig } from "../../engine/ports/ai.js";
import { isNpcVisibleInInnerRoom as isVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { loadPortraits, getSnowLeopardForm, getPearlForm } from "../../domain/rules/companion/portraits.js";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import { readMobileColumn, writeMobileColumn } from "../../utils/mobileColumn.js";
import { usePromptInspector } from "./ui/usePromptInspector.js";

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
  const clrNight = { sys: "var(--ink-good)", cmd: "var(--ink-warn)", desc: "var(--ink-text)", room: "var(--ink-accent)", item: "var(--gold)", stat: "#8ab4d4", skill: "var(--violet)", err: "var(--red-soft)", choice: "#6aaa8a", narrator: "var(--pink)", crash: "var(--red-soft)", confess: "var(--ember)", affection: "#f0a0c0", quest: "var(--ember)" };
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

  const { buildBugReportTurns, getLiveBlockText } = usePromptInspector({
    log, narrator, inv, char, time, room, innerRoomName, varTree, varTreeRef, preset, apiCfg, nsfwOn, questProgress,
  });

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
  // 回车和输入栏的「发送」按钮走同一个提交入口：按钮调用 handler.submit()。
  const submit = () => {
    if (composingRef.current) return;
    if (interactMode === "pigeon") { sendPigeonLetter(pigeonTarget, input, { channel: "pigeon" }); return; }
    act(input);
  };
  const handler = (e) => {
    if (e.key === "Enter") {
      if (composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229) return;
      submit(); return;
    }
    if (e.key === "ArrowUp") { e.preventDefault(); if (cmdHistory.length) { const ni = Math.min(histIdx + 1, cmdHistory.length - 1); setHistIdx(ni); setInput(cmdHistory[ni]); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(cmdHistory[histIdx - 1]); } else { setHistIdx(-1); setInput(""); } return; }
  };
  handler.submit = submit;
  return handler;
}

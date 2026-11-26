import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PRESETS } from "../../engine/newGame.js";
import { canBypassExclusive, getCurrentStage, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { getZoneName } from "../../utils/theme.js";

import { isNpcVisibleInInnerRoom as isVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { loadPortraits, getSnowLeopardForm, getPearlForm } from "../../domain/rules/companion/portraits.js";
import { usePromptInspector } from "./ui/usePromptInspector.js";
import {
  useSessionUi, sessionUiStore, setInput, setLoading, setWaitSecs, setPendingTalks,
  setQueueCount, setInteractMode, setTalkTarget, setActiveTarget, setActiveGroundItem,
  setPigeonTarget, setCmdHistory, setHistIdx,
  setForcedDuelNpc, setDuelingNpc, setDuelPending, setPendingQuestBranch,
  setActivePersuasion, setActiveBuilding, setGambleNegotiation,
  setBuildingPanelMinimized, setJustMeditated, setTradingShop,
  setApiCfg, setUiScale, setFont, setIsDayMode, setNsfwOn, setGm, setIsMobile,
  setMobileColumn, setMobileTopMenu, setSettingsInitialTab,
  setActiveNpcMenu, setActiveItemMenu, setCharacterPageTarget, setPortraitTarget,
  refreshApiCfg,
} from "../../store/sessionUiStore.js";
import { getGroundItems } from "../../domain/rules/map/groundScope.js";
import { isAtQuestPlace } from "../../domain/rules/quests/questPlace.js";
import { stampLogEntries } from "../../domain/rules/log/logTypes.js";
import { gameStore } from "../../store/gameStore.js";

const AVATAR_GENDER_DEFAULT = "__gender_default__";

export function useGameUi({
  room, innerRoomName, char, inv, log, time, narrator, preset,
  flags, questProgress, varTree, varTreeRef,
}) {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  // 交互/输入态已迁 sessionUiStore（路线二）：这里订阅后按原样透给 hook 参数，
  // 面板则直接 useSessionUi 订阅，不再走 ui 透传。
  const input = useSessionUi(s => s.input);
  const loading = useSessionUi(s => s.loading);
  const loadingRef = useRef(loading);
  const waitSecs = useSessionUi(s => s.waitSecs);
  const waitTimerRef = useRef(null);
  const pendingTalks = useSessionUi(s => s.pendingTalks);
  const pendingTalksRef = useRef(0);
  const changePendingTalks = useCallback((delta) => {
    const next = Math.max(0, sessionUiStore.getState().pendingTalks + delta);
    pendingTalksRef.current = next;
    setPendingTalks(next);
  }, []);
  const queueCount = useSessionUi(s => s.queueCount);
  // 偏好设置/面板态已迁 sessionUiStore（PR-2C），持久化与 DOM 副作用在 store 内
  const gm = useSessionUi(s => s.gm);
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileColumn = useSessionUi(s => s.mobileColumn);
  const mobileTopMenu = useSessionUi(s => s.mobileTopMenu);
  const settingsInitialTab = useSessionUi(s => s.settingsInitialTab);
  const interactMode = useSessionUi(s => s.interactMode);
  const talkTarget = useSessionUi(s => s.talkTarget);
  const activeTarget = useSessionUi(s => s.activeTarget);
  const activeGroundItem = useSessionUi(s => s.activeGroundItem);
  const activeGroundItemContextRef = useRef({ roomName: room.name, innerRoomName });
  useEffect(() => {
    const previous = activeGroundItemContextRef.current;
    const contextChanged = previous.roomName !== room.name || previous.innerRoomName !== innerRoomName;
    activeGroundItemContextRef.current = { roomName: room.name, innerRoomName };
    const stillGrounded = getGroundItems({ room, innerRoomName }).some(item =>
      (typeof item === "string" ? item : item?.name) === activeGroundItem);
    if (activeGroundItem && (contextChanged || !stillGrounded)) setActiveGroundItem(null);
  }, [activeGroundItem, room.name, innerRoomName, room.items]);
  const nsfwOn = useSessionUi(s => s.nsfwOn);
  // 会话外的写入与卸载残影在开局时对齐一次：
  // - apiCfg：模块初始化早于主菜单设置页，那上面改的凭据要回读进来；
  // - settingsInitialTab：store 跨卸载保活，复位避免从主菜单重开设置跳过上次的子页；
  // - isMobile：建仓到挂载之间的旋转不受 resize 监听覆盖，挂载时补一次测量。
  useEffect(() => {
    refreshApiCfg();
    setSettingsInitialTab(null);
    setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
  }, []);
  const [outfitState, setOutfitState] = useState({ loading: false, picks: [], error: "" });
  const pigeonTarget = useSessionUi(s => s.pigeonTarget);
  const activeNpcMenu = useSessionUi(s => s.activeNpcMenu);
  const activeItemMenu = useSessionUi(s => s.activeItemMenu);
  // 头像按存档分键存在浏览器里，不写进存档本身：换头像不算"开玩"、不触发自动存档，
  // 大图也不会撑爆存档。新建角色带 avatarId，各存各的；旧存档没有 avatarId，沿用原来那份共用偏好。
  const avatarKey = char?.avatarId ? `qucuo_player_avatar:${char.avatarId}` : "qucuo_player_avatar";
  const [avatarRev, setAvatarRev] = useState(0);
  const playerAvatarCustom = useMemo(() => {
    void avatarRev;
    let stored = "";
    try { stored = localStorage.getItem(avatarKey) || ""; } catch { /* ignore */ }
    // 「恢复默认（按性别）」记成 AVATAR_GENDER_DEFAULT：不再回落到开局立绘，直接按性别默认图显示。
    if (stored === AVATAR_GENDER_DEFAULT) return "";
    return stored || (char?.avatarId ? char?.portrait || "" : "");
  }, [avatarKey, avatarRev, char?.avatarId, char?.portrait]);
  const setPlayerAvatarCustom = useCallback((src) => {
    try {
      if (src) localStorage.setItem(avatarKey, src);
      else if (char?.avatarId) localStorage.setItem(avatarKey, AVATAR_GENDER_DEFAULT);
      else localStorage.removeItem(avatarKey);
    } catch {
      if (src) alert("图片太大，无法存入本地存储，请换小一点的图。");
    }
    setAvatarRev((v) => v + 1);
  }, [avatarKey, char?.avatarId]);
  const characterPageTarget = useSessionUi(s => s.characterPageTarget);
  const [portraits, setPortraits] = useState(loadPortraits());
  const [slForm, setSlFormState] = useState(getSnowLeopardForm());
  const [slImgErr, setSlImgErr] = useState(false);
  const [pearlForm, setPearlFormState] = useState(getPearlForm());
  const [pearlImgErr, setPearlImgErr] = useState(false);
  const [narratorImgErr, setNarratorImgErr] = useState(false);
  const portraitTarget = useSessionUi(s => s.portraitTarget);
  const apiCfg = useSessionUi(s => s.apiCfg);
  const uiScale = useSessionUi(s => s.uiScale);
  const font = useSessionUi(s => s.font);
  const isDayMode = useSessionUi(s => s.isDayMode);
  const cmdHistory = useSessionUi(s => s.cmdHistory);
  const histIdx = useSessionUi(s => s.histIdx);
  // 模态/战斗/建筑态已迁 sessionUiStore（PR-2B）
  const forcedDuelNpc = useSessionUi(s => s.forcedDuelNpc);
  const duelingNpc = useSessionUi(s => s.duelingNpc);
  const duelPending = useSessionUi(s => s.duelPending);
  const pendingQuestBranch = useSessionUi(s => s.pendingQuestBranch);
  const activePersuasion = useSessionUi(s => s.activePersuasion);
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const gambleNegotiation = useSessionUi(s => s.gambleNegotiation);
  const buildingPanelMinimized = useSessionUi(s => s.buildingPanelMinimized);
  const justMeditated = useSessionUi(s => s.justMeditated);
  const tradingShop = useSessionUi(s => s.tradingShop);
  const inputRef = useRef(null);
  const logEnd = useRef(null);
  const composingRef = useRef(false);

  const availableQuestsHere = useMemo(() => {
    const result = [];
    for (const quest of QUCUO_QUESTS) {
      if (!quest.stages?.length) continue;
      const prog = questProgress[quest.id];
      if (quest.localOnly) {
        const stage = getLocalQuestStage(quest, { room, innerRoomName, char, inv, flags, questProgress, varTree });
        if (stage) result.push({ quest, stage, isNewlyGiven: !prog });
        continue;
      }
      if (prog?.status === "locked_by_exclusive" || prog?.status === "completed") continue;
      if (!isQuestGateOpen(quest, questProgress, flags, varTree)) continue;
      if (quest.id === "hidden_all_collect_line" && !canBypassExclusive({ char, flags })) continue;
      const isNewlyGiven = !prog;
      const stage = isNewlyGiven ? quest.stages[0] : (prog.status === "active" ? getCurrentStage(quest, prog) : null);
      if (!stage) continue;
      const giverNpc = quest.giver ? room.npcs?.find(n => n.name === quest.giver) : null;
      // stage.requireLocation：这一步必须玩家真的走到指定地点才展开（village1
      // 熊山口三选一、小牧童大草甸救牛）。此时入口只看地点、不看 giver——giver
      // 不在场，玩家也要能在这里撞上该撞的事；没到地点前 giver 在旁也不展开。
      // deliver 阶段收件人在场也算「这里」——不然 ❢ 只在发布人身边出现，
      // 真正该交付的地方（村2 老孙饭馆）反而没按钮，只能绕送礼菜单。
      const deliverNpc = stage.deliver?.to ? room.npcs?.find((n) => n.name === stage.deliver.to) : null;
      const rl = stage.requireLocation;
      const here = rl
        ? (!rl.district || rl.district === room.name) && (!rl.inner || rl.inner === innerRoomName)
        : quest.giver
          ? !!(giverNpc && isVisibleInInnerRoom(room.name, innerRoomName, giverNpc))
            || !!(deliverNpc && isVisibleInInnerRoom(room.name, innerRoomName, deliverNpc))
          : isAtQuestPlace(stage.at, room.name, innerRoomName)
            || !!(deliverNpc && isVisibleInInnerRoom(room.name, innerRoomName, deliverNpc));
      if (!here) continue;
      result.push({ quest, stage, isNewlyGiven });
    }
    return result;
  }, [room, questProgress, flags, char, inv, innerRoomName, varTree]);

  const AV_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/player/";
  const genderAvatar = { "男": AV_BASE + "male.webp", "女": AV_BASE + "female.webp" };
  const playerAvatar = playerAvatarCustom || genderAvatar[char.gender] || (AV_BASE + "other.webp");
  const clrNight = { sys: "var(--ink-good)", cmd: "var(--ink-warn)", desc: "var(--ink-text)", room: "var(--ink-accent)", item: "var(--gold)", stat: "var(--log-stat)", skill: "var(--violet)", err: "var(--red-soft)", choice: "var(--log-choice)", narrator: "var(--pink)", crash: "var(--red-soft)", confess: "var(--ember)", affection: "var(--log-affection)", quest: "var(--ember)" };
  const clrDay = { sys: "var(--good)", cmd: "var(--warn)", desc: "var(--log-desc)", room: "var(--log-room)", item: "var(--log-item)", stat: "var(--info)", skill: "var(--log-skill)", err: "var(--accent)", choice: "var(--log-choice)", narrator: "var(--log-narrator)", crash: "var(--accent)", confess: "var(--log-quest)", affection: "var(--log-affection)", quest: "var(--log-quest)" };
  const clr = isDayMode ? clrDay : clrNight;
  // NPC 名与好感的语义色，取值在 tokens.css，随日夜切换。
  const uiPink = "var(--npc-affection)";
  const uiGreen = "var(--npc-name)";
  const inkDivider = `linear-gradient(90deg, transparent, var(--border), transparent)`;
  const S = {
    panel: { display: "flex", flexDirection: "column", borderRight: `1px solid var(--border)`, minWidth: 0, overflow: "hidden" },
    label: {
      padding: isMobile ? "6px 14px" : "0 14px", minHeight: 38, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 6,
      color: "var(--accent-dim)", fontSize: "11px", letterSpacing: "2px",
      borderBottom: "none", backgroundImage: `linear-gradient(180deg, transparent, transparent calc(100% - 1px), var(--border) calc(100% - 1px))`,
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
    gm, setGm, isMobile, setIsMobile, mobileColumn, setMobileColumn,
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
    availableQuestsHere, AV_BASE, genderAvatar, playerAvatar,
    // 分区名是文案数据（如「人间烟火·昼」），与颜色分开提供；颜色一律走 CSS 变量。
    zoneName: getZoneName(room.name, isDayMode),
    clr, uiPink, uiGreen, inkDivider, S,
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
        } catch (err) { setLog(l => [...l, ...stampLogEntries([{ t: "err", text: `  导入失败：${err.message}` }], gameStore.getState().time)]); }
      };
      r.readAsText(f);
    };
    el.click();
  }, [loadPreset]);
}

export function createInputKeyHandler({
  composingRef, interactMode, sendPigeonLetter, pigeonTarget, input, act,
  cmdHistory, histIdx, setHistIdx, setInput,
  inputCapsule = null, clearCapsule = () => {}, narratorName = "旁白",
  clearTargets = () => {},
}) {
  // 回车和输入栏的「发送」按钮走同一个提交入口：按钮调用 handler.submit()。
  // W-INPUT 提交分流铁律（发完即焚——所有胶囊单条发送后立即清空）：
  //   飞鸽胶囊 → 直调 sendPigeonLetter；私语胶囊或 //、((、（（、@旁白、@narrator 前缀
  //   → 剥前缀直调 whisper 旁路（不进 runTurn 不扣回合）；@人名胶囊 → 仅限本条 targetHint。
  const submit = () => {
    if (composingRef.current) return;
    const capsule = inputCapsule;
    if (capsule?.kind === "pigeon") {
      clearCapsule();
      sendPigeonLetter(capsule.name, input, { channel: "pigeon" });
      return;
    }
    const prefixes = ["//", "((", "（（", `@旁白 `, `@${narratorName} `].filter((p) => p.trim().length > 1);
    let whisperText = null;
    if (capsule?.kind === "whisper") whisperText = input;
    else {
      for (const p of prefixes) {
        if (input.startsWith(p)) {
          whisperText = input.slice(p.length);
          // V1：(( / （（ 前缀私语成对剥除尾部 )) / ）），消除尾括号残留进私聊正文
          if ((p === "((" && whisperText.trimEnd().endsWith("))")) || (p === "（（" && whisperText.trimEnd().endsWith("））"))) {
            whisperText = whisperText.trimEnd().slice(0, -2);
          }
          break;
        }
      }
    }
    if (whisperText != null) {
      clearCapsule();
      act(whisperText, [], { whisper: true });
      return;
    }
    if (capsule?.kind === "target") {
      const name = capsule.name;
      clearCapsule();
      clearTargets();
      act(input, [], { targetHint: name });
      return;
    }
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

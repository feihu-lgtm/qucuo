import { useCallback, useEffect, useRef, useState } from "react";
import { createAutosaveScheduler } from "../../core/autosaveScheduler.js";
import { snapshotFromStore } from "../../store/persist.js";
import { setRngState } from "../../core/rng.js";
import { DEFAULT_PRESETS } from "../../core/newGame.js";
import { gameStore, markGameReplaced, useGameStore } from "../../store/gameStore.js";
import { OVERLAY, closeOverlay } from "../../store/uiStore.js";
import { buildSnapshot, autoSave, tryRestoreSave, flushLocalBackup, isCompatibleCharShape, isCompatibleRoomShape } from "../../infra/saves.js";
import { initialNarratorState, migrateNarratorState } from "../../domain/rules/narrator/narrator.js";
import { backfillInventoryFromCatalog } from "../../domain/data/items/catalog.js";
import { generateNpcMoveset } from "../../domain/rules/npc/npcGeneration.js";
import { seedKnowledge } from "../../domain/rules/prompt/knowledge.js";
import { initCompanionState } from "../../domain/rules/companion/companion.js";
import { CURRENT_VERSION } from "../../infra/version.js";
import { getMapNode } from "../../domain/data/map/qucuoMap.js";
import { getDistrictAnchor, getInnerRoomNames, hasInnerMap } from "../../domain/rules/map/innerMap.js";
import { initialVarTree } from "../../domain/rules/prompt/mvu.js";
import {
  rollSkeleton, parseSquareBatch, applySquareBatch,
  pendingNodes, serializeSquares, loadSquares,
} from "../../domain/rules/map/mapSquares.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../calls/hookCalls.js";

const webAi = createWebAi();

export function restorePersuasionProgress(snap, setPersuasionProgress) {
  setPersuasionProgress(snap.persuasionProgress || {});
}

export function useInitialRestore({ initialLoadSlotId }) {
  const restored = initialLoadSlotId === "new" ? null : tryRestoreSave(DEFAULT_PRESETS, initialLoadSlotId);
  if (restored?.snap?.squares) loadSquares(restored.snap.squares);
  return restored;
}

export function useAutosave({
  apiCfg, preset, room, char, dao, skills, inv, log, convo, exp, pot, flags,
  mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit,
  depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState,
  loadingRef, pendingTalksRef, roomMapRef, restoredInnerRef, presets,
  setGm, setPreset, setRoom, setChar, setDao, setSkills, setInv, setLog,
  setConvo, setExp, setPot, setFlags, setMapData, setTime, setNarrator,
  setVarTree, setQuestProgress, setPersuasionProgress, setClaimedMilestones, setDeposit, setDepositedAt,
  setPledgedItems, setCompanionState, setInnerRoomName,
}) {
  // ── 自动存档：玩家操作后防抖，AI 回合与关页兜底保留原逻辑 ──
  // 首次输入前的挂载初始化与后台预跑不算游玩，避免新开局状态覆盖旧自动档；
  // 首次输入后的游戏状态变化会写档，关页仍同步补存。
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const roundsSinceLastSaveRef = useRef(0);   // 距离上次自动存档过了几个回合
  const playedThisSessionRef = useRef(false); // 本次会话玩家是否真的行动过
  const userArmedRef = useRef(false);
  const schedulerRef = useRef(null);
  // 默认立绘已改为硬加载（静态 import，见 portraits.js 顶部的
  // DEFAULT_PORTRAITS），构建时直接打包进产物，getPortrait() 里自动
  // 合并查询，不再需要任何异步初始化步骤——之前这里有一个
  // initDefaultPortraits() 的 useEffect，现在完全不需要了。

  useEffect(() => {
    const arm = () => {
      userArmedRef.current = true;
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
    };
    window.addEventListener("pointerdown", arm, true);
    window.addEventListener("keydown", arm, true);
    const scheduler = createAutosaveScheduler({
      subscribe: gameStore.subscribe,
      isArmed: () => userArmedRef.current,
      isBusy: () => loadingRef.current || pendingTalksRef.current > 0,
      onPlayed: () => { playedThisSessionRef.current = true; },
      onReset: () => {
        playedThisSessionRef.current = false;
        roundsSinceLastSaveRef.current = 0;
      },
      save: () => {
        const result = autoSave(snapshotFromStore({
          squares: serializeSquares(),
          roomMap: roomMapRef.current,
        }));
        if (result.ok) {
          roundsSinceLastSaveRef.current = 0;
          setLastAutoSave(Date.now());
          setAutoSaveError(null);
        } else {
          setAutoSaveError(result.error);
        }
      },
    });
    schedulerRef.current = scheduler;
    return () => {
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!playedThisSessionRef.current) return; // 还没玩过：绝不覆盖旧档
    // 必须确有回合完成过。roundsSinceLastSaveRef 只在 commitRound（真走完一轮）自增、
    // 存档后归零；varTree 等状态被别的东西碰一下不算一轮。
    // 【为什么补这条】起居注上线后，不走 AI 的动作（内层移动等）也会写 varTree，
    // 而 varTree 在本 effect 的 deps 里。autoSaveEvery=0（每回合都存）时下面那道
    // 区间守卫因 every>0 为假而整个跳过，于是每走一步内层都触发一次全量快照+落盘。
    if (roundsSinceLastSaveRef.current <= 0) return;
    const every = Math.max(0, Number(apiCfg.autoSaveEvery ?? 5));
    if (every > 0 && roundsSinceLastSaveRef.current < every) return; // 间隔未到
    const snapshot = buildSnapshot({ preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, deposit, depositedAt, pledgedItems, persuasionProgress, innerRoomName, companionState, squares: serializeSquares(), roomMap: roomMapRef.current });
    const result = autoSave(snapshot); // 同步返回（写内存必成；IDB 异步落盘、LS 尽力兜底）
    if (result.ok) {
      roundsSinceLastSaveRef.current = 0;
      setLastAutoSave(Date.now());
      setAutoSaveError(null);
    } else {
      setAutoSaveError(result.error);
    }
  }, [preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, apiCfg.autoSaveEvery, companionState]);

  // 从存档槽位读取后，整体覆盖当前状态
  const applySnapshot = useCallback((snap) => {
    const restoreSnapshot = () => {
      const matchedPreset = presets.find(p => p.id === snap.preset?.id) || preset;
      const restoredRoom = isCompatibleRoomShape(snap.room) ? snap.room : matchedPreset.room;
      const roomChanged = restoredRoom.name !== useGameStore.getState().room?.name;
      setPreset(matchedPreset);
      setRoom(restoredRoom);
      // 老存档可能没有 moveset/special 字段（切磋系统上线之前存的档），
      // 兼容判定通过后还要单独补全这两个字段，不能直接假设它们存在——
      // 之前这里漏了这一步，导致老存档读进来后 char.moveset 是 undefined，
      // 后续任何读取它的地方（比如打开切磋界面）都可能因此出问题。
      const restoredChar = isCompatibleCharShape(snap.char) ? snap.char : matchedPreset.char;
      setChar(restoredChar.moveset ? restoredChar : {
        ...restoredChar,
        moveset: generateNpcMoveset({ id: "player" }, { luck: restoredChar.special?.气运 ?? 5, levelCap: 5 }),
      });
      setDao(snap.dao);
      setSkills(snap.skills); setInv(backfillInventoryFromCatalog(snap.inv));
      setLog(snap.log); setConvo(snap.convo); setExp(snap.exp); setPot(snap.pot);
      setFlags(snap.flags); setMapData(snap.mapData); setTime(snap.time);
      // 老档迁移：旧 CRASHED 阶段（告白→宕机那条已废链路）会把文风永久锁在
      // "干瘪空壳"上，好感度再高也不变、旁白线也走不出来。归一到当前阶段定义。
      setNarrator(migrateNarratorState(snap.narrator));
      setVarTree(snap.varTree || initialVarTree());
      setQuestProgress(snap.questProgress || {});
      restorePersuasionProgress(snap, setPersuasionProgress);
      setClaimedMilestones(new Set(snap.claimedMilestones || []));
      setDeposit(snap.deposit || 0);
      setDepositedAt(snap.depositedAt ?? null);
      setPledgedItems(snap.pledgedItems || []);
      setCompanionState(snap.companionState || initCompanionState());
      if (snap.roomMap) roomMapRef.current = snap.roomMap;
      if (snap.squares) loadSquares(snap.squares);
      if (snap.rngState != null) setRngState(snap.rngState);
      // 内层箱庭位置：老存档没这个字段、或存的房间已不在该据点内景里（改过地图数据），
      // 都退回锚点，绝不让玩家落在一个不存在的房间里。
      {
        const rm = restoredRoom;
        const ok = snap.innerRoomName && hasInnerMap(rm.name) && getInnerRoomNames(rm.name).includes(snap.innerRoomName);
        const restoredInnerRoomName = ok ? snap.innerRoomName : (hasInnerMap(rm.name) ? getDistrictAnchor(rm.name) : null);
        if (roomChanged) restoredInnerRef.current = restoredInnerRoomName;
        setInnerRoomName(restoredInnerRoomName);
      }
      markGameReplaced();
      closeOverlay(OVERLAY.SETTINGS);
    };
    const scheduler = schedulerRef.current;
    if (scheduler) scheduler.runSilently(restoreSnapshot);
    else restoreSnapshot();
  }, [presets, preset, setPersuasionProgress]);

  const buildCurrentSnapshot = useCallback(() => snapshotFromStore({
    squares: serializeSquares(), roomMap: roomMapRef.current,
  }), [preset, room, char, dao, skills, inv, log, convo, exp, pot, flags, mapData, time, narrator, varTree, claimedMilestones, questProgress, persuasionProgress, innerRoomName, companionState]); // deposit/depositedAt/pledgedItems captured via closure

  // ── 地图格子·后台预跑（扫雷式预埋，见 mapSquares.js）──
  // 全据点批量预跑（14 节点，3 个一 call）：系统先掷骰埋拾取/路遇，小模型一次写完全套
  // 到达素材。fire-and-forget，单批失败静默，下个触发点自愈（开局/日更/每次格子移动后）。
  const prerunBusyRef = useRef(false);
  const prerunSquares = useCallback(() => {
    if (prerunBusyRef.current) return;
    const day = Math.floor(time / 24);
    const pending = pendingNodes(day);
    if (!pending.length) return;
    prerunBusyRef.current = true;
    (async () => {
      try {
        const luck = char.special?.气运 ?? 5;
        for (let i = 0; i < pending.length; i += 3) {
          const skeletons = {};
          const batch = pending.slice(i, i + 3).map(name => {
            const node = getMapNode(name);
            const sk = rollSkeleton(name, luck);
            skeletons[name] = sk;
            return { name, base: node.desc, exits: Object.keys(node.exits).join(","), item: sk.item, encounter: sk.encounter };
          });
          try {
            const r = await withAI("map.prerun", { batch }, { ai: webAi, apiCfg });
            applySquareBatch(day, parseSquareBatch(r.text), skeletons);
          } catch (_) { /* 单批失败静默，余格下个触发点重试 */ }
        }
      } finally { prerunBusyRef.current = false; }
    })();
  }, [time, apiCfg, char]);
  const prerunBootedRef = useRef(false);
  useEffect(() => {
    if (prerunBootedRef.current) return;
    prerunBootedRef.current = true;
    prerunSquares();
  }, [prerunSquares]);

  // 关页/刷新兜底：IDB 写是异步、关页来不及落盘，故这里改用同步的 flushLocalBackup
  // 把最新快照写一份到 localStorage（尽力而为）；下次开局 loadAutoSave 会取 IDB 与它的较新者。
  // 同样受"本次会话行动过"保护——刚挂载就关页不会把旧档覆盖成新开局。
  useEffect(() => {
    const flush = () => {
      if (!playedThisSessionRef.current) return;
      flushLocalBackup(buildCurrentSnapshot());
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [buildCurrentSnapshot]);

  const loadPreset = useCallback((p) => {
    const startPreset = () => {
      setPreset(p); setRoom(p.room); setChar(p.char); setDao(p.dao);
      setSkills(p.skills.map(s => ({ ...s }))); setInv([...p.inv]);
      setLog([{ t: "sys", text: `MUD引擎 · 「${CURRENT_VERSION.codename}」${CURRENT_VERSION.time} · ${p.name}` }, ...p.opening]);
      setConvo([]); setExp(0); setPot(0); setFlags([]); setTime(6);
      setMapData({ [p.room.name]: { x: 0, y: 0 } });
      setNarrator(initialNarratorState());
      setVarTree(prev => seedKnowledge(prev, p.知识基底, 0)); // 换预设开新局也灌基底（registerFact 幂等）
      setCompanionState(initCompanionState()); // 新开局重置雪豹解锁/出战状态，不带上一局的伙伴进度
      roomMapRef.current = { [p.room.name]: { items: [...p.room.items], npcs: [...p.room.npcs] } };
      markGameReplaced();
    };
    const scheduler = schedulerRef.current;
    if (scheduler) scheduler.runSilently(startPreset);
    else startPreset();
    scheduler?.resetPlayed();
    setGm(false);
    closeOverlay(OVERLAY.PRESETS);
  }, []);

  return {
    lastAutoSave, autoSaveError, roundsSinceLastSaveRef, playedThisSessionRef,
    schedulerRef, applySnapshot, buildCurrentSnapshot, loadPreset, prerunSquares,
  };
}

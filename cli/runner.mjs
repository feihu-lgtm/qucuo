import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { gameActions, GAME_KEYS, gameStore, initGameStore } from "../src/core/gameStore.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../src/core/newGame.js";
import { snapshotFromStore } from "../src/core/persist.js";
import { setSeed } from "../src/core/rng.js";
import { resetForDay, loadSquares, serializeSquares, consumeArrival, burnSquare } from "../src/mapSquares.js";
import { tryRestoreSnapshot } from "../src/saves.js";
import { getTimeStr, parseDir } from "../src/utils/mudHelpers.js";
import { resolveExit } from "../src/qucuoMap.js";
import { QUALITY } from "../src/equipment.js";
import { defaultConfig } from "../src/apiConfig.js";
import { classifyIntent, buildBudgetInstruction } from "../src/inputIntent.js";
import { emptyBodyProfile } from "../src/bodyProfile.js";
import { getActivePreset } from "../src/presetSystem.js";
import { startTrace } from "../src/actionTrace.js";
import { playTurn } from "../src/engine/playTurn.js";
import { createWorldRules } from "../src/engine/worldRules.js";
import { derivedMovesetRule } from "../src/features/skills/rules.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "../src/features/quest/rules.js";
import {
  finishTokyoReturn,
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "../src/features/narrator/rules.js";
import { applyResult } from "../src/features/run.js";
import { meditate, trainNeigong, trainWaigong, breakthroughSkill } from "../src/features/cultivation/logic.js";
import { deposit, withdraw, pledge, redeem } from "../src/features/bank/logic.js";
import { innerMove, outerArrival } from "../src/features/map/logic.js";
import {
  giftNpc,
  inviteCompanion,
  learnNpcSkill,
  lookNpc,
  stealFromNpc,
  talkToNpc,
} from "../src/features/npc/logic.js";
import {
  processPigeons,
  recordPigeonNpcLocations,
  sendPigeonLetter,
} from "../src/features/pigeon/logic.js";
import { getDistrictAnchor, hasInnerMap, isNpcVisibleInInnerRoom } from "../src/innerMap.js";
import * as importedRegistry from "../src/cards/importedRegistry.js";
import { timeAdvanceRule } from "../src/features/time/rules.js";
import { residentNpcRule } from "../src/features/npc/rules.js";
import { innerGroundItemsRule } from "../src/features/map/rules.js";

const defaultOutput = (text) => process.stdout.write(`${text}\n`);

export function parseSeed(value) {
  const seed = Number(value);
  if (!/^[+-]?\d+$/.test(value ?? "") || !Number.isSafeInteger(seed)) {
    throw new Error("Seed must be a safe decimal integer");
  }
  return seed;
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function getNestedValue(value, path) {
  return path.reduce((current, key) => current == null ? undefined : current[key], value);
}

function setNestedValue(value, path, nextValue) {
  if (!path.length) return nextValue;
  const [key, ...rest] = path;
  const copy = Array.isArray(value)
    ? [...value]
    : value && typeof value === "object" ? { ...value } : {};
  copy[key] = setNestedValue(value?.[key], rest, nextValue);
  return copy;
}

function parseAssignment(text, parseBareString = false) {
  const equals = text.indexOf("=");
  if (equals < 1) throw new Error("Expected <path>=<value>");
  const path = text.slice(0, equals).trim().split(".");
  const rawValue = text.slice(equals + 1).trim();
  if (path.some((part) => !part)) throw new Error("Expected a dotted state path");
  let value;
  try {
    value = JSON.parse(rawValue);
  } catch (error) {
    if (!parseBareString) throw error;
    value = rawValue;
  }
  return { path, value };
}

function renderState(state) {
  const timeLabel = typeof state.time === "number" ? ` (${getTimeStr(state.time)})` : "";
  const logs = (Array.isArray(state.log) ? state.log : [])
    .slice(-5)
    .map((entry) => typeof entry === "string" ? entry : entry?.text ?? formatValue(entry));
  return [
    `room.name: ${state.room?.name ?? "undefined"}`,
    `innerRoomName: ${state.innerRoomName === null ? "null" : state.innerRoomName ?? "undefined"}`,
    `time: ${formatValue(state.time)}${timeLabel}`,
    `char.hp: ${formatValue(state.char?.hp)}`,
    `exp: ${formatValue(state.exp)}`,
    `pot: ${formatValue(state.pot)}`,
    `deposit: ${formatValue(state.deposit)}`,
    `inv count: ${Array.isArray(state.inv) ? state.inv.length : 0}`,
    "last 5 log lines:",
    ...logs,
  ].join("\n");
}

function actionForKey(key) {
  const actionName = key === "varTree"
    ? "setVarTreeState"
    : `set${key[0].toUpperCase()}${key.slice(1)}`;
  return gameActions[actionName];
}

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function createSession({ out = defaultOutput, cwd = process.cwd(), seed, ai, apiCfg: apiCfgOverrides } = {}) {
  const emit = typeof out === "function" ? out : (text) => out.write(`${text}\n`);
  let pendingTurn = Promise.resolve(0);
  let tokyoReturnTimer = null;
  const cancelTokyoReturn = () => {
    if (tokyoReturnTimer) clearTimeout(tokyoReturnTimer);
    tokyoReturnTimer = null;
  };
  const scheduleTokyoReturn = ({ back, label }) => {
    cancelTokyoReturn();
    tokyoReturnTimer = setTimeout(() => {
      tokyoReturnTimer = null;
      if (gameStore.getState().room?.name !== "第三新东京市") return;
      const { result, innerRoomName } = finishTokyoReturn(back, label);
      applyResult(featureCtx, result);
      if (innerRoomName !== undefined) setTimeout(() => gameActions.setInnerRoomName(innerRoomName), 0);
    }, 3500);
  };
  const featureCtx = {
    addLog: (lines) => gameActions.setLog((previous) => [...(previous || []), ...lines]),
    jotNote: () => {},
    setVarTree: gameActions.setVarTreeState,
    applySquareOps: (ops) => {
      for (const { op, key, day } of ops) {
        if (op === "consume") consumeArrival(key, day);
        else if (op === "burn") burnSquare(key);
      }
    },
    act: (text, extraReplies, opts) => {
      pendingTurn = pendingTurn.then(() => (
        runFreeText(text, { ...(opts || {}), extraReplies: extraReplies || [] })
      ));
      return pendingTurn;
    },
  };
  let session;
  let worldRules;

  function observePigeonArrivals() {
    const arrivals = processPigeons(gameStore.getState());
    const knownIds = new Set(session.pigeonArrivals.map((letter) => letter.id));
    session.pigeonArrivals.push(...arrivals.filter((letter) => !knownIds.has(letter.id)));
  }

  function recordPigeonLocations() {
    applyResult(featureCtx, recordPigeonNpcLocations(gameStore.getState()));
  }

  function runFreeText(cmd, opts = {}) {
    return (async () => {
      if (!ai) {
        emit("请使用 --ai mock、--ai replay 或 --ai deepseek 配置 AI。");
        return 1;
      }
      const varTreeRef = { current: gameStore.getState().varTree };
      const setVarTree = (next) => {
        const value = typeof next === "function" ? next(gameStore.getState().varTree) : next;
        gameActions.setVarTreeState(value);
        varTreeRef.current = value;
      };
      const state = gameStore.getState();
      const isTalk = !!opts.isTalk;
      const activeTarget = opts.activeTarget || null;
      const talkTarget = opts.talkTarget || null;
      const config = {
        ...defaultConfig(),
        ...apiCfgOverrides,
        apiType: apiCfgOverrides?.apiType || "openai",
        maxTokens: apiCfgOverrides?.maxTokens || 4000,
        extractionEnabled: apiCfgOverrides?.extractionEnabled ?? false,
        streamEnabled: false,
      };
      const intent = classifyIntent(cmd);
      const preset = state.preset || DEFAULT_PRESETS[0];
      const trace = startTrace("cli-turn");
      const visibleNpcs = (state.room?.npcs || []).filter((npc) => (
        isNpcVisibleInInnerRoom(state.room?.name, state.innerRoomName, npc)
      ));
      const visibleNpcsForAI = visibleNpcs;
      const lastAiText = [...(state.convo || [])].reverse().find((message) => message.role === "assistant")?.content || "";
      const invText = (state.inv || []).map((item) => (
        typeof item === "string" ? item : `${item.name}(${item.quality}${item.equipped ? "·已装备" : ""})`
      )).join(",");
      const stateContext = `[状态] 时间:${getTimeStr(state.time)} 主角:${state.char?.name || "无名少侠"} 房间:${state.room?.name || ""}${state.innerRoomName ? `·${state.innerRoomName}` : ""} 出口:${(state.room?.exits || []).join(",")} NPCs:${visibleNpcsForAI.map((npc) => npc.name).join(",") || "无"} 物品:${(state.room?.items || []).map((item) => item.name).join(",") || "无"} HP:${(state.char?.hp || []).join("/")} 内功:${state.char?.neigong ?? 0} 外功:${state.char?.waigong ?? 0} 背包:${invText}`;
      const apiConfig = { ...config, model: apiCfgOverrides?.model || config.model };
      const recallInput = {
        apiCfg: apiConfig,
        cmd,
        lastAiText,
        room: state.room,
        varTreeLatest: state.varTree,
        flags: state.flags || [],
        activeTarget,
        isTalk,
        talkTarget,
      };
      const callDeps = (memory = {}, prepared = {}) => ({
        varTree: memory.varTree ?? state.varTree,
        gm: false,
        isSettle: !!opts.settle,
        isTalk,
        activeTarget,
        talkTarget,
        intent,
        apiCfg: apiConfig,
        narrator: state.narrator,
        scenario: preset.scenario || getActivePreset().scenario,
        budgetInstruction: buildBudgetInstruction(intent, cmd, apiConfig.targetWordCount, apiConfig.intentBudgets),
        npcLoreBlockWithQuest: "",
        visibleNpcsCount: visibleNpcs.length,
        charName: state.char?.name,
        charBodyProfile: state.char?.bodyProfile || emptyBodyProfile(),
        pickupJudgment: null,
        cmd,
        convo: state.convo || [],
        nsfwOn: false,
        ctx: stateContext,
        recallBlock: memory.recallBlock || "",
        reunionBlock: "",
        infoDomainBlock: memory.infoDomainBlock || "",
        hist: prepared.hist,
        mainConvo: prepared.mainConvo,
        gambleTalkCtx: null,
        recallInfo: memory.recallInfo,
        inSeaOfMind: false,
        settleNpc: opts.settleNpc,
        settleKind: opts.settleKind,
        giftInfo: opts.giftInfo,
        learnInfo: opts.learnInfo,
        settleBeast: !!opts.settleBeast,
        _trace: trace,
        ai,
        addLog: (lines) => gameActions.setLog((previous) => [...(previous || []), ...lines]),
        setLog: gameActions.setLog,
      });

      const roomMapRef = { current: session.roomMap };
      const pickupJudgmentRef = { current: null };
      const pickupExtractionFailedRef = { current: false };
      const collectGrantedRef = { current: [] };
      const outerDepartRef = { current: null };
      const pendDirRef = { current: null };
      const gambleTalkCtx = { current: null };
      const dayMaterialRef = { current: [] };
      const playedThisSessionRef = { current: false };
      const roundsSinceLastSaveRef = { current: 0 };
      const addLog = (lines) => gameActions.setLog((previous) => [...(previous || []), ...lines]);
      if (opts.echoCommand || opts.extraReplies?.length) {
        addLog([{ t: "cmd", text: `> ${opts.displayCmd || cmd}` }, ...(opts.extraReplies || [])]);
      }
      const result = await playTurn({
        apiCfg: apiConfig,
        ai,
        callDeps,
        convo: state.convo || [],
        isTalk,
        isSettle: !!opts.settle,
        prompt: {
          room: state.room || {},
          char: state.char || {},
          inv: state.inv || [],
          skills: state.skills || [],
          dao: state.dao || {},
          flags: state.flags || [],
          questProgress: state.questProgress || {},
          pendingQuestBranch: null,
          varTree: state.varTree || {},
          time: state.time,
          preset,
          companionState: state.companionState || {},
          nsfwOn: false,
          activeTarget,
          talkTarget,
          isTalk,
          gm: false,
          innerRoomName: state.innerRoomName,
          apiCfg: apiConfig,
          visibleNpcs,
          buildBudgetInstruction,
          intent,
          getTimeStr,
          hasInnerMap,
          quality: QUALITY,
        },
        _trace: trace,
        state,
        memory: {
          varTreeLatest: state.varTree,
          roomNpcNames: (state.room?.npcs || []).map((npc) => npc.name),
          time: state.time,
          apiCfg: apiConfig,
          flags: state.flags || [],
          recall: recallInput,
        },
        refs: {
          varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
          pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
          roundsSinceLastSaveRef, playedThisSessionRef,
        },
        commitDeps: (turn) => {
          pickupExtractionFailedRef.current = turn.pickupExtractionFailed;
          return {
            ...turn,
            isTalk,
            gm: false,
            lockedDestName: null,
            room: state.room,
            innerRoomName: state.innerRoomName,
            time: state.time,
            mapData: state.mapData || {},
            pendingQuestBranch: null,
            apiCfg: apiConfig,
            activeTarget,
            talkTarget,
            effectiveSpecialNow: state.char?.special || {},
            newConvo: turn.newConvo,
            questProgress: state.questProgress || {},
            char: state.char,
            preserveHp: false,
            _trace: trace,
            addLog,
            setVarTree,
            setRoom: gameActions.setRoom,
            setGambleNegotiation: () => {},
            setInv: gameActions.setInv,
            setChar: gameActions.setChar,
            setDao: gameActions.setDao,
            setExp: gameActions.setExp,
            setPot: gameActions.setPot,
            setSkills: gameActions.setSkills,
            setFlags: gameActions.setFlags,
            setMapData: gameActions.setMapData,
            setTime: gameActions.setTime,
            setPendingQuestBranch: () => {},
            setConvo: gameActions.setConvo,
            varTreeRef,
            roomMapRef,
            gambleTalkCtx,
            outerDepartRef,
            pendDirRef,
            pickupJudgmentRef,
            pickupExtractionFailedRef,
            collectGrantedRef,
            dayMaterialRef,
            roundsSinceLastSaveRef,
            playedThisSessionRef,
          };
        },
      }, cmd, opts);
      if (result.ok) {
        session.roomMap = roomMapRef.current;
        if (opts.squareOps?.length) featureCtx.applySquareOps(opts.squareOps);
        const nextState = gameStore.getState();
        recordPigeonLocations();
        if (nextState.time > state.time) observePigeonArrivals();
        return 0;
      }
      emit(result.error?.message || String(result.error));
      return 1;
    })();
  }

  async function applyFeature(result) {
    const previousTime = gameStore.getState().time;
    applyResult(featureCtx, result);
    const status = await pendingTurn;
    pendingTurn = Promise.resolve(0);
    const nextState = gameStore.getState();
    if (nextState.time > previousTime) {
      recordPigeonLocations();
      observePigeonArrivals();
    }
    return status;
  }

  async function runLineCommand(rawLine) {
    const line = String(rawLine).trim();
    if (!line || line.startsWith("#")) return 0;

    pendingTurn = Promise.resolve(0);

    if (/^:seed(?:\s|$)/.test(line)) {
      seed = parseSeed(line.slice(5).trim());
      setSeed(seed);
      return 0;
    }

    if (line === ":new") {
      session.roomMap = {};
      session.pigeonArrivals = [];
      resetForDay();
      initGameStore(buildInitialGameState(null, seed));
      recordPigeonLocations();
      worldRules?.reset();
      return 0;
    }

    if (line === ":state") {
      emit(renderState(gameStore.getState()));
      return 0;
    }

    if (line.startsWith(":save ")) {
      const file = line.slice(6).trim();
      if (!file) throw new Error(":save requires a file path");
      const snapshot = snapshotFromStore({ squares: serializeSquares(), roomMap: session.roomMap });
      await writeFile(resolve(cwd, file), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      emit(`已保存：${file}`);
      return 0;
    }

    if (line.startsWith(":load ")) {
      const file = line.slice(6).trim();
      if (!file) throw new Error(":load requires a file path");
      const data = JSON.parse(await readFile(resolve(cwd, file), "utf8"));
      const snapshot = data?.kind === "qucuo-save-export" ? data.snapshot : data;
      const restored = tryRestoreSnapshot(DEFAULT_PRESETS, snapshot);
      if (restored) {
        session.roomMap = snapshot?.roomMap || {};
        loadSquares(snapshot?.squares || {});
      } else {
        session.roomMap = {};
        resetForDay();
      }
      initGameStore(buildInitialGameState(restored, seed));
      session.pigeonArrivals = [];
      recordPigeonLocations();
      observePigeonArrivals();
      worldRules?.reset();
      emit(restored ? `已读取：${file}` : "存档不可用，已开始新局");
      return 0;
    }

    if (line.startsWith(":mapcache ")) {
      const cache = JSON.parse(line.slice(":mapcache".length).trim());
      if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
        throw new Error(":mapcache expects a JSON object");
      }
      session.roomMap = cache.roomMap && typeof cache.roomMap === "object" && !Array.isArray(cache.roomMap)
        ? cache.roomMap
        : {};
      loadSquares(cache.squares && typeof cache.squares === "object" ? cache.squares : {});
      return 0;
    }

    if (line.startsWith(":set ")) {
      const { path, value } = parseAssignment(line.slice(5));
      const [key, ...nestedPath] = path;
      if (!GAME_KEYS.includes(key)) throw new Error(`Unknown game state path: ${path.join(".")}`);
      const previousTime = gameStore.getState().time;
      const action = actionForKey(key);
      action(nestedPath.length
        ? (current) => setNestedValue(current, nestedPath, value)
        : value);
      if (key === "time" && gameStore.getState().time > previousTime) observePigeonArrivals();
      return 0;
    }

    if (line.startsWith(":expect ")) {
      const { path, value: expected } = parseAssignment(line.slice(8), true);
      const actual = getNestedValue(gameStore.getState(), path);
      if (isDeepStrictEqual(actual, expected)) {
        emit(`✓ ${path.join(".")}`);
        return 0;
      }
      emit(`期望失败：${path.join(".")}\n  expected: ${formatValue(expected)}\n  actual: ${formatValue(actual)}`);
      return 1;
    }

    const state = gameStore.getState();
    if (!state?.room?.name) {
      emit("尚未开始游戏，请先执行 :new 或 :load 初始化游戏。");
      return 1;
    }
    const visibleNpcs = (state.room?.npcs || []).filter((npc) => (
      isNpcVisibleInInnerRoom(state.room?.name, state.innerRoomName, npc)
    ));
    const currentNpcNames = new Set((state.room?.npcs || []).map((npc) => npc.name));
    const pigeonTargets = [...new Set([
      ...visibleNpcs.map((npc) => npc.name),
      ...(state.varTree?.世界?.曾经出现人物 || []).filter((name) => !currentNpcNames.has(name)),
    ])].filter(Boolean).sort((a, b) => b.length - a.length);
    const missingNpc = (name) => applyFeature({
      logs: [{ t: "err", text: `  此处没有 ${name}。` }],
    });
    const movementMatch = /^(走|去)\s+(.+)$/.exec(line);
    if (movementMatch) {
      const isWalk = movementMatch[1] === "走";
      const result = innerMove(state, {
        target: movementMatch[2],
        command: line,
        targetKind: movementMatch[1] === "去" ? "room" : "direction",
        forceLayer: isWalk ? null : "inner",
      });
      if (result) {
        return await applyFeature(result);
      }
      if (isWalk) {
        const direction = parseDir(movementMatch[2]);
        const destName = direction ? resolveExit(state.room?.name, direction) : null;
        if (destName) {
          const arrival = outerArrival(state, {
            direction,
            destName,
            roomMap: session.roomMap,
            squares: serializeSquares(),
            command: line,
          });
          if (arrival?.cached) {
            featureCtx.addLog([{ t: "cmd", text: `> ${line}` }]);
            const status = await applyFeature(arrival);
            gameActions.setInnerRoomName(hasInnerMap(destName) ? getDistrictAnchor(destName) : null);
            return status;
          }
          if (arrival) return runFreeText(line, { squareOps: arrival.squareOps });
        }
      }
    }

    const pigeonMatch = /^飞鸽(?:\s+(.+))?$/.exec(line);
    if (pigeonMatch) {
      const tail = (pigeonMatch[1] || "").trim();
      const npcName = pigeonTargets.find((name) => tail === name || tail.startsWith(`${name} `));
      if (!npcName) {
        return await applyFeature(tail
          ? { logs: [{ t: "sys", text: "  此人未在曾遇名册中，无法飞鸽传书。" }] }
          : sendPigeonLetter(state, null, ""));
      }
      return await applyFeature(sendPigeonLetter(
        state,
        npcName,
        tail.slice(npcName.length).trim(),
      ));
    }

    const lookMatch = /^看\s+(.+)$/.exec(line);
    if (lookMatch) {
      const npc = visibleNpcs.find((entry) => entry?.name === lookMatch[1]);
      if (!npc) return await missingNpc(lookMatch[1]);
      const result = lookNpc(state, npc);
      applyResult(featureCtx, result);
      return await featureCtx.act(`look ${npc.id}`, result.extraReplies, {
        echoCommand: true,
        displayCmd: `look ${npc.id}`,
      });
    }

    const giftCommand = /^送\s+(.+)$/.exec(line);
    if (giftCommand) {
      const tail = giftCommand[1];
      const npc = [...visibleNpcs]
        .sort((a, b) => (b?.name?.length || 0) - (a?.name?.length || 0))
        .find((entry) => tail.endsWith(` ${entry.name}`));
      if (!npc) {
        const fallbackName = tail.split(/\s+/).at(-1);
        return await missingNpc(fallbackName);
      }
      const itemName = tail.slice(0, -(npc.name.length)).trim();
      const item = (state.inv || []).find((entry) => (
        (typeof entry === "string" ? entry : entry?.name) === itemName
      ));
      return await applyFeature(giftNpc(state, npc, item || null));
    }

    const stealMatch = /^偷\s+(.+)$/.exec(line);
    if (stealMatch) {
      const npc = visibleNpcs.find((entry) => entry?.name === stealMatch[1]);
      if (!npc) return await missingNpc(stealMatch[1]);
      return await applyFeature(stealFromNpc(state, npc));
    }

    const inviteMatch = /^邀\s+(.+)$/.exec(line);
    if (inviteMatch) {
      const npc = visibleNpcs.find((entry) => entry?.name === inviteMatch[1]);
      if (!npc) return await missingNpc(inviteMatch[1]);
      return await applyFeature(inviteCompanion(state, npc));
    }

    const talkCommand = /^交谈\s+(.+)$/.exec(line);
    if (talkCommand) {
      const tail = talkCommand[1];
      const npc = [...visibleNpcs]
        .sort((a, b) => (b?.name?.length || 0) - (a?.name?.length || 0))
        .find((entry) => tail.startsWith(`${entry.name} `));
      if (!npc) {
        const fallbackName = tail.split(/\s+/)[0];
        return await missingNpc(fallbackName);
      }
      const utterance = tail.slice(npc.name.length).trim();
      const result = talkToNpc(state, npc);
      applyResult(featureCtx, result);
      if (result.completedEscort || npc.cannotSpeak) return await pendingTurn;
      return await runFreeText(utterance, {
        isTalk: true,
        activeTarget: npc.name,
        talkTarget: npc.name,
      });
    }

    const learnNpcMatch = /^拜师\s+(.+)$/.exec(line);
    if (learnNpcMatch) {
      const npc = visibleNpcs.find((entry) => entry?.name === learnNpcMatch[1]);
      if (!npc) {
        return await applyFeature({
          logs: [{ t: "err", text: `  此处没有 ${learnNpcMatch[1]}。` }],
        });
      }
      return await applyFeature(learnNpcSkill(state, npc));
    }

    if (line === "打坐") {
      return await applyFeature(meditate(state));
    }
    if (line === "练内功") {
      return await applyFeature(trainNeigong(state));
    }
    if (line === "练外功") {
      return await applyFeature(trainWaigong(state));
    }

    const skillMatch = /^修炼\s+(.+)$/.exec(line);
    if (skillMatch) {
      return await applyFeature(breakthroughSkill(state, skillMatch[1]));
    }

    const depositMatch = /^存钱\s+(\S+)$/.exec(line);
    if (depositMatch) {
      const amount = parsePositiveInteger(depositMatch[1]);
      return await applyFeature(amount === null
        ? { logs: [{ t: "err", text: "  数额无效" }] }
        : deposit(state, amount));
    }
    if (line === "取钱") {
      return await applyFeature(withdraw(state));
    }

    const pledgeMatch = /^质押\s+(.+)\s+(\S+)$/.exec(line);
    if (pledgeMatch) {
      const pledgeValue = parsePositiveInteger(pledgeMatch[2]);
      if (pledgeValue === null) {
        return await applyFeature({ logs: [{ t: "err", text: "  数额无效" }] });
      }
      const item = (state.inv || []).find((entry) => typeof entry === "object" && entry?.name === pledgeMatch[1]);
      return await applyFeature(pledge(state, item?.id, pledgeValue));
    }
    const redeemMatch = /^赎回\s+(\S+)\s+(\S+)$/.exec(line);
    if (redeemMatch) {
      const index = parsePositiveInteger(redeemMatch[1]);
      const redeemCost = parsePositiveInteger(redeemMatch[2]);
      if (index === null || redeemCost === null) {
        return await applyFeature({ logs: [{ t: "err", text: "  数额无效" }] });
      }
      return await applyFeature(redeem(state, index - 1, redeemCost));
    }

    if (line.startsWith(":")) {
      emit(`暂不支持：${line}（PR C 起接入）`);
      return 0;
    }
    return runFreeText(line);
  }

  async function runLine(rawLine) {
    let status = 0;
    try {
      status = await runLineCommand(rawLine);
    } finally {
      worldRules?.check();
      const ruleTurn = pendingTurn;
      pendingTurn = Promise.resolve(0);
      const ruleStatus = await ruleTurn;
      if (status === 0 && ruleStatus) status = ruleStatus;
    }
    return status;
  }

  session = {
    store: gameStore,
    roomMap: {},
    pigeonArrivals: [],
    forcedDuelNpc: null,
    runLine,
    renderState: () => renderState(gameStore.getState()),
  };
  worldRules = createWorldRules([
    timeAdvanceRule,
    residentNpcRule,
    collectGroundItemsRule,
    innerGroundItemsRule,
    derivedMovesetRule,
    alreadySatisfiedCollectRule,
    escortArrivalRule,
    questFlagRule,
    estateStartRule,
    estateAnnouncementRule,
    estateProgressRule,
    xuannuTriggerRule,
    villaArrivalRule,
    portalOpenedRule,
    scheduleTokyoReturnRule,
  ], {
    getState: () => ({
      ...gameStore.getState(),
      importedVer: importedRegistry.getImportedRevision(),
    }),
    ctx: {
      importedRegistry,
      get companionState() {
        return gameStore.getState().companionState;
      },
      getSeaReturn: () => null,
      cancelTokyoReturn,
      scheduleTokyoReturn,
      getNow: () => Date.now(),
    },
    applyResult: (result) => {
      if (result.forcedDuelNpc) session.forcedDuelNpc = result.forcedDuelNpc;
      applyResult(featureCtx, result);
    },
  });
  return session;
}

export async function runScript(lines, options) {
  const session = createSession(options);
  const scriptLines = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
  let failures = 0;
  for (const line of scriptLines) {
    failures += await session.runLine(line);
  }
  return failures;
}

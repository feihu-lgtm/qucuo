import { snowLeopardRule } from "../src/features/quest/snowLeopard.js";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { gameActions, GAME_KEYS, gameStore, initGameStore, subscribeGameReplaced } from "../src/store/gameStore.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../src/engine/newGame.js";
import { snapshotFromStore } from "../src/store/persist.js";
import { setSeed } from "../src/utils/rng.js";
import { resetForDay, loadSquares, serializeSquares, consumeArrival, burnSquare } from "../src/domain/rules/map/mapSquares.js";
import { tryRestoreSnapshot } from "../src/infra/saves.js";
import { statsForQuality } from "../src/domain/rules/economy/equipment.js";
import { migrateLegacySnapshot } from "../src/domain/rules/npc/legacyContent.js";
import { getTimeStr } from "../src/utils/mudHelpers.js";
import { defaultConfig, migrateProvider, providerApiType, PROVIDERS } from "../src/infra/apiConfig.js";
import { classifyIntent } from "../src/domain/rules/prompt/inputIntent.js";
import { emptyBodyProfile } from "../src/domain/rules/character/bodyProfile.js";
import { getActivePreset } from "../src/domain/rules/prompt/presetSystem.js";
import { decide } from "../src/engine/commands/commandScheduler.js";
import { classifyCliCommand, dispatchCommand } from "../src/engine/commands/index.js";
import { formatTrace } from "../src/infra/actionTrace.js";
import { formatTurnStatus, getTurnContext, PHASE, turnMonitor, withTurnContext } from "../src/infra/turnMonitor.js";
import { stampLogEntries } from "../src/domain/rules/log/logTypes.js";
import { playTurn } from "../src/engine/playTurn.js";
import { createPromptContext } from "../src/engine/prompt/index.js";
import { createWorldRules } from "../src/engine/worldRules.js";
import { parseLocalCommand } from "../src/engine/localCommands.js";
import { derivedMovesetRule } from "../src/domain/rules/skills/rules.js";
import {
  alreadySatisfiedCollectRule,
  collectGroundItemsRule,
  estateAnnouncementRule,
  estateProgressRule,
  estateStartRule,
  escortArrivalRule,
  questFlagRule,
} from "../src/domain/rules/quests/rules.js";
import {
  finishTokyoReturn,
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "../src/domain/rules/narrator/rules.js";
import { applyResult } from "../src/features/run.js";
import { createCliIntentRouter } from "./intentRoute.mjs";
import {
  processPigeons,
  recordPigeonNpcLocations,
} from "../src/features/pigeon/logic.js";
import * as importedRegistry from "../src/domain/rules/cards/importedRegistry.js";
import { timeAdvanceRule } from "../src/domain/rules/time/rules.js";
import { residentNpcRule } from "../src/domain/rules/npc/rules.js";
import { innerGroundItemsRule } from "../src/domain/rules/map/rules.js";

const defaultOutput = (text) => process.stdout.write(`${text}\n`);

export function createCliPromptContext(state, args = {}) {
  return createPromptContext(state, { gm: false, nsfwOn: false, ...args });
}

export function parseSeed(value) {
  const seed = Number(value);
  if (!/^[+-]?\d+$/.test(value ?? "") || !Number.isSafeInteger(seed)) {
    throw new Error("Seed must be a safe decimal integer");
  }
  return seed;
}

export function buildCliApiConfig(overrides = {}) {
  const requestedProvider = overrides.provider;
  const apiType = overrides.apiType || (requestedProvider ? providerApiType(requestedProvider) : "openai");
  const provider = requestedProvider || (["anthropic", "gemini", "vertex", "qwen"].includes(apiType) ? apiType : "");
  const config = {
    ...defaultConfig(),
    ...overrides,
    apiType,
    endpoint: overrides.endpoint || PROVIDERS[provider || "openai"].endpoint,
    maxTokens: overrides.maxTokens || 4000,
    extractionEnabled: overrides.extractionEnabled ?? false,
    bookkeepEnabled: overrides.bookkeepEnabled ?? false,
    streamEnabled: false,
    // WO-13：CLI 老录制回放对比走旧链路——判官管线默认关（web 端默认开），需对比时显式开。
    judgePipelineEnabled: overrides.judgePipelineEnabled ?? false,
  };
  if (provider) config.provider = provider;
  else delete config.provider;
  return migrateProvider(config);
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

export { classifyCliCommand };

export function createSession({ out = defaultOutput, cwd = process.cwd(), seed, ai, apiCfg: apiCfgOverrides, getNow = () => Date.now() } = {}) {
  turnMonitor.setGameClockReader(() => gameStore.getState().time);
  const emit = typeof out === "function" ? out : (text) => out.write(`${text}\n`);
  let pendingTurn = Promise.resolve(0);
  let pendingTurnCount = 0;
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
    addLog: (lines) => gameActions.setLog((previous) => [...(previous || []), ...stampLogEntries(lines, gameStore.getState().time, getNow())]),
    jotNote: () => {},
    gameActions,
    setVarTree: gameActions.setVarTreeState,
    applySquareOps: (ops) => {
      for (const { op, key, day } of ops) {
        if (op === "consume") consumeArrival(key, day);
        else if (op === "burn") burnSquare(key);
      }
    },
    act: (text, extraReplies, opts) => {
      const turn = getTurnContext();
      pendingTurnCount += 1;
      pendingTurn = pendingTurn.then(() => (
        runFreeText(text, { ...(opts || {}), turn, extraReplies: extraReplies || [] })
      ));
      return pendingTurn;
    },
  };
  let session;
  let worldRules;
  let lineTurn;

  function observePigeonArrivals() {
    const arrivals = processPigeons(gameStore.getState());
    const knownIds = new Set(session.pigeonArrivals.map((letter) => letter.id));
    session.pigeonArrivals.push(...arrivals.filter((letter) => !knownIds.has(letter.id)));
  }

  function recordPigeonLocations() {
    applyResult(featureCtx, recordPigeonNpcLocations(gameStore.getState()), { turn: lineTurn, feature: "pigeon.recordLocations" });
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
      const config = buildCliApiConfig(apiCfgOverrides);
      const intent = classifyIntent(cmd);
      const preset = state.preset || DEFAULT_PRESETS[0];
      const parent = opts.turn || lineTurn;
      const trace = parent?.phase === PHASE.MACHINE
        ? parent : turnMonitor.start(cmd, { source: "cli", parentId: parent?.id, commandId: "cliFallback" });
      const lastAiText = [...(state.convo || [])].reverse().find((message) => message.role === "assistant")?.content || "";
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
        budgetInstruction: prepared.budgetInstruction,
        npcLoreBlockWithQuest: prepared.npcLoreBlockWithQuest || "",
        visibleNpcsCount: prepared.visibleNpcsCount || 0,
        charName: state.char?.name,
        charBodyProfile: state.char?.bodyProfile || emptyBodyProfile(),
        pickupJudgment: null,
        cmd,
        convo: state.convo || [],
        nsfwOn: false,
        ctx: prepared.ctx,
        recallBlock: memory.recallBlock || "",
        reunionBlock: prepared.reunionBlock || "",
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
        intentPlan: opts.intentPlan,
        addLog: (lines) => gameActions.setLog((previous) => [...(previous || []), ...stampLogEntries(lines, gameStore.getState().time, getNow())]),
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
      const addLog = (lines) => gameActions.setLog((previous) => [...(previous || []), ...stampLogEntries(lines, gameStore.getState().time, getNow())]);
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
        prompt: createCliPromptContext({
          room: state.room || {},
          char: state.char || {},
          inv: state.inv || [],
          skills: state.skills || [],
          collectNote: opts.intentPlanNote || "",
          dao: state.dao || {},
          flags: state.flags || [],
          questProgress: state.questProgress || {},
          pendingQuestBranch: null,
          varTree: state.varTree || {},
          npcState: state.npcState || {},
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
          intent,
        }, { importedNpcLore: importedRegistry.getImportedNpcLore() }),
        _trace: trace,
        deferMonitorFinish: trace === lineTurn,
        setVarTree,
        getGameState: () => gameStore.getState(),
        gameActions,
        subscribeGameReplaced,
        effectiveSpecialNow: state.char?.special || {},
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
          // ref 读写出入口与 turnContext 同契约：engine/act 只经 refGet/refSet 碰 ref。
          const refs = {
            varTreeRef, roomMapRef, gambleTalkCtx, outerDepartRef, pendDirRef,
            pickupJudgmentRef, pickupExtractionFailedRef, collectGrantedRef, dayMaterialRef,
            roundsSinceLastSaveRef, playedThisSessionRef,
          };
          return {
            ...turn,
            refGet: (name) => refs[name]?.current,
            refSet: (name, value) => { refs[name].current = value; },
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
        if (result.duelRequest?.name && !isTalk && !opts.settle) {
          emit(`AI 判定：向${result.duelRequest.name}发起切磋`);
        }
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
    pendingTurnCount = 0;
    const nextState = gameStore.getState();
    if (nextState.time > previousTime) {
      recordPigeonLocations();
      observePigeonArrivals();
    }
    return status;
  }

  async function runLineCommand(line, command) {
    if (decide(command, null) !== "run") throw new Error(`CLI command cannot run sequentially: ${command.id}`);

    pendingTurn = Promise.resolve(0);
    pendingTurnCount = 0;

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
      const restored = tryRestoreSnapshot(DEFAULT_PRESETS, snapshot, { statsForQuality, migrateSnapshot: migrateLegacySnapshot });
      if (restored) {
        session.roomMap = restored.snap.roomMap || {};
        loadSquares(restored.snap.squares || {});
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
      let actual = getNestedValue(gameStore.getState(), path);
      if (path[0] === "log" && Array.isArray(actual) && Array.isArray(expected)) {
        const metaKeys = ["turn", "day", "realTs"];
        const wantMeta = expected.some((item) => item && typeof item === "object" && metaKeys.some((k) => k in item));
        if (!wantMeta) {
          actual = actual.map((item) => {
            if (!item || typeof item !== "object") return item;
            const trimmed = { ...item };
            for (const k of metaKeys) delete trimmed[k];
            return trimmed;
          });
        }
      }
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
    const localCommand = parseLocalCommand(line, state, { surface: "cli" });
    if (localCommand) {
      const result = localCommand.kind === "lines"
        ? { logs: [{ t: "cmd", text: `> ${line}` }, ...localCommand.lines] }
        : localCommand.result;
      const status = await applyFeature(result);
      if (result.logs?.length) emit(result.logs.map((entry) => entry.text).join("\n"));
      return status;
    }
    const dispatched = await dispatchCommand(line, {
      state,
      emit,
      session,
      getNow,
      getState: () => gameStore.getState(),
      featureCtx,
      applyFeature,
      applyResult: (result) => applyResult(featureCtx, result),
      runFreeText,
      pendingTurn: () => pendingTurn,
      setInnerRoomName: gameActions.setInnerRoomName,
    });
    if (dispatched !== undefined) return dispatched;
    const routed = await intentRouter?.(line);
    if (routed != null) return routed;
    return runFreeText(line);
  }

  async function runLine(rawLine) {
    const line = String(rawLine).trim();
    if (!line || (line.startsWith("#") && !line.startsWith("#testscript"))) return 0;
    if (line === ":status") {
      const snapshot = turnMonitor.getSnapshot();
      const { label, backgroundCount } = formatTurnStatus(snapshot);
      emit(`${snapshot.current?.phase || "IDLE"} · ${label} · 后台 AI ×${backgroundCount}`);
      return 0;
    }
    if (/^:tree(?:\s|$)/.test(line)) {
      const count = Number(line.slice(5).trim() || "5");
      if (!Number.isSafeInteger(count) || count < 1) {
        emit("用法：:tree [n]");
        return 1;
      }
      turnMonitor.getTrees().slice(0, count).forEach((turn) => emit(formatTrace(turn, { full: false })));
      return 0;
    }
    const command = classifyCliCommand(line);
    const trace = turnMonitor.start(line, { source: "cli", commandId: command.id });
    lineTurn = trace;
    let status = 0;
    try {
      status = await withTurnContext(trace, () => runLineCommand(line, command));
      for (let pass = 0; pass < 5; pass += 1) {
        worldRules?.check(trace);
        if (!pendingTurnCount) break;
        const ruleStatus = await pendingTurn;
        pendingTurn = Promise.resolve(0);
        pendingTurnCount = 0;
        if (status === 0 && ruleStatus) status = ruleStatus;
        if (pass === 4) console.warn("CLI world-rule settle loop reached five passes.");
      }
      if (status && trace.totalMs == null) turnMonitor.transition(trace, PHASE.ERROR, "命令未完成");
      else turnMonitor.finish(trace);
    } catch (error) {
      if (trace.totalMs == null) turnMonitor.transition(trace, PHASE.ERROR, String(error));
      throw error;
    } finally {
      lineTurn = undefined;
    }
    return status;
  }

  const intentRouter = apiCfgOverrides?.intentRecognitionEnabled !== false ? createCliIntentRouter({
    ai, apiCfg: buildCliApiConfig(apiCfgOverrides), emit, getState: () => gameStore.getState(), getTurn: () => lineTurn,
    applyFeature, runFreeText, runCommand: (text) => runLineCommand(text, classifyCliCommand(text)),
  }) : null;

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
    snowLeopardRule,
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
      roomMapRef: {
        get current() { return session.roomMap; },
        set current(next) { session.roomMap = next; },
      },
      get companionState() {
        return gameStore.getState().companionState;
      },
      getSeaReturn: () => null,
      cancelTokyoReturn,
      scheduleTokyoReturn,
      getNow,
    },
    applyResult: (result) => {
      if (result.roomMap) session.roomMap = result.roomMap;
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

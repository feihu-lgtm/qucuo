import { snowLeopardRule } from "../src/features/quest/snowLeopard.js";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { gameActions, GAME_KEYS, gameStore, initGameStore } from "../src/core/gameStore.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../src/core/newGame.js";
import { snapshotFromStore } from "../src/core/persist.js";
import { setSeed } from "../src/core/rng.js";
import { resetForDay, loadSquares, serializeSquares, consumeArrival, burnSquare } from "../src/domain/map/mapSquares.js";
import { tryRestoreSnapshot } from "../src/infra/saves.js";
import { getTimeStr, parseDir } from "../src/utils/mudHelpers.js";
import { resolveExit } from "../src/domain/map/qucuoMap.js";
import { defaultConfig, migrateProvider, providerApiType, PROVIDERS } from "../src/infra/apiConfig.js";
import { classifyIntent } from "../src/domain/prompt/inputIntent.js";
import { emptyBodyProfile } from "../src/domain/character/bodyProfile.js";
import { getActivePreset } from "../src/domain/prompt/presetSystem.js";
import { getCommand } from "../src/core/commands.js";
import { decide } from "../src/core/commandScheduler.js";
import { formatTrace } from "../src/infra/actionTrace.js";
import { formatTurnStatus, getTurnContext, PHASE, turnMonitor, withTurnContext } from "../src/core/turnMonitor.js";
import { playTurn } from "../src/engine/playTurn.js";
import { createPromptContext } from "../src/engine/prompt/index.js";
import { createWorldRules } from "../src/engine/worldRules.js";
import { parseLocalCommand } from "../src/engine/localCommands.js";
import { pickGroundItem, consumeItem } from "../src/features/items/logic.js";
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
import { createCliIntentRouter } from "./intentRoute.mjs";
import { comfort, resolveTrauma, confessToNarrator } from "../src/features/narrator/logic.js";
import { switchCompanion } from "../src/features/companion/logic.js";
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
  tradeWithNpc,
} from "../src/features/npc/logic.js";
import {
  processPigeons,
  recordPigeonNpcLocations,
  sendPigeonLetter,
} from "../src/features/pigeon/logic.js";
import { getDistrictAnchor, hasInnerMap, isNpcVisibleInInnerRoom } from "../src/domain/map/innerMap.js";
import * as importedRegistry from "../src/domain/cards/importedRegistry.js";
import { timeAdvanceRule } from "../src/features/time/rules.js";
import { residentNpcRule } from "../src/features/npc/rules.js";
import { innerGroundItemsRule } from "../src/features/map/rules.js";
import {
  buyBook,
  getPriceForDest,
  pray,
  restAtInn,
  travelByCarriage,
} from "../src/features/buildings/logic.js";
import { LIBRARY_BOOKS_JINGGUAN } from "../src/domain/buildings/libraryData.js";
import { getBuildingsForLocation, BUILDING_TYPE } from "../src/domain/buildings/qucuoBuildings.js";

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
    streamEnabled: false,
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

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function classifyCliCommand(line) {
  const text = String(line).trim();
  const id = text.startsWith(":") ? "cliSystem"
    : /^(?:用|服|捡)\s/.test(text) ? "cliItemUse"
      : /^坐车\s/.test(text) ? "cliCarriage"
        : /^(?:走|去)\s/.test(text) ? "cliMovement"
          : /^(?:住店|求医)$/.test(text) ? "cliInn"
            : /^买书\s/.test(text) ? "cliBook"
              : text === "祈福" ? "cliPrayer"
                : /(?:飞鸽|寄信)/.test(text) ? "cliPigeon"
                  : /^(?:安抚|收束创伤|向旁白告白|换队友)/.test(text) ? "cliNarratorCompanion"
                    : /^(?:看|查看)\s/.test(text) ? "cliNpcLook"
                      : /^送\s/.test(text) ? "cliNpcGift"
                        : /^交易\s/.test(text) ? "cliNpcTrade"
                          : /^偷\s/.test(text) ? "cliNpcSteal"
                            : /^邀请\s/.test(text) ? "cliNpcInvite"
                              : /^(?:对话|说话)\s/.test(text) ? "cliNpcTalk"
                                : /^学艺\s/.test(text) ? "cliNpcLearn"
                                  : /^(?:打坐|修炼|突破)/.test(text) ? "cliMeditateTrain"
                                    : /^(?:存钱|取钱|当|赎)/.test(text) ? "cliBankPawn"
                                      : /^:?(?:help|帮助|背包|状态|看地图)/i.test(text) ? "cliLookHelp"
                                        : "cliRunner";
  return getCommand(id);
}

export function createSession({ out = defaultOutput, cwd = process.cwd(), seed, ai, apiCfg: apiCfgOverrides, getNow = () => Date.now() } = {}) {
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
    const localCommand = parseLocalCommand(line, state, { surface: "cli" });
    if (localCommand) {
      const result = localCommand.kind === "lines"
        ? { logs: [{ t: "cmd", text: `> ${line}` }, ...localCommand.lines] }
        : localCommand.result;
      const status = await applyFeature(result);
      if (result.logs?.length) emit(result.logs.map((entry) => entry.text).join("\n"));
      return status;
    }
    const useMatch = line.match(/^(?:用|服)\s+(.+)$/);
    if (useMatch) {
      const itemName = useMatch[1].trim();
      const item = (state.inv || []).find((entry) => (
        (typeof entry === "object" ? entry?.name : entry) === itemName
      ));
      if (!item) return await applyFeature({ logs: [{ t: "sys", text: `  背包里没有「${itemName}」。` }] });
      return await applyFeature(consumeItem(state, item));
    }
    const pickMatch = line.match(/^捡\s+(.+)$/);
    if (pickMatch) {
      const itemName = pickMatch[1].trim();
      const item = (state.room.items || []).find((entry) => (
        (typeof entry === "object" ? entry?.name : entry) === itemName
      ));
      if (!item) return await applyFeature({ logs: [{ t: "sys", text: `  地上没有「${itemName}」。` }] });
      const status = await applyFeature(pickGroundItem(state, item));
      const room = gameStore.getState().room;
      session.roomMap[room.name] = { items: [...room.items], npcs: [...room.npcs] };
      return status;
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
    if (line === ":help narrator") {
      emit("安抚 <verbal|food|medication|hug|kiss> · 收束创伤 · 向旁白告白 · 换队友 <snowLeopard|asuka|none>");
      return 0;
    }
    if (line.startsWith("安抚 ")) return await applyFeature(comfort(state, line.slice(3).trim()));
    if (line === "收束创伤") return await applyFeature(resolveTrauma(state));
    if (line === "向旁白告白") return await applyFeature(confessToNarrator(state));
    if (line.startsWith("换队友 ")) {
      const key = line.slice(4).trim();
      return await applyFeature(switchCompanion(state, key === "none" ? null : key));
    }
    if (line === "住店") {
      const inn = getBuildingsForLocation(state.room.name).find((building) => building.type === BUILDING_TYPE.INN);
      if (!inn) return await applyFeature({ logs: [{ t: "err", text: "  此处没有客栈。" }] });
      return await applyFeature(restAtInn(state, {
        cost: inn.innPrice || 10,
        roomType: "普通客房",
        buildingName: inn.name,
      }));
    }
    const carriageMatch = /^坐车\s+(.+)$/.exec(line);
    if (carriageMatch) {
      const hasCarriage = getBuildingsForLocation(state.room?.name)
        .some((building) => building.type === BUILDING_TYPE.TRANSPORT);
      if (!hasCarriage) return await applyFeature({ logs: [{ t: "err", text: "  此处没有驿站。" }] });
      const destName = carriageMatch[1];
      const roomMap = {
        ...session.roomMap,
        ...(state.room?.name ? {
          [state.room.name]: {
            items: [...(state.room.items || [])],
            npcs: [...(state.room.npcs || [])],
          },
        } : {}),
      };
      const result = travelByCarriage(state, destName, getPriceForDest(destName), { roomMap });
      if (result.changes?.room && state.room?.name) {
        session.roomMap[state.room.name] = roomMap[state.room.name];
      }
      const status = await applyFeature(result);
      if (result.changes?.room) {
        gameActions.setInnerRoomName(hasInnerMap(destName) ? getDistrictAnchor(destName) : null);
      }
      return status;
    }
    const bookMatch = /^买书\s+(.+)$/.exec(line);
    if (bookMatch) {
      const bookshop = getBuildingsForLocation(state.room?.name)
        .some((building) => building.type === BUILDING_TYPE.LIBRARY && building.id?.includes("jingguan"));
      if (!bookshop) return await applyFeature({ logs: [{ t: "err", text: "  此处没有书肆。" }] });
      const book = LIBRARY_BOOKS_JINGGUAN
        .find((entry) => entry.name === bookMatch[1] || entry.name.replace(/[《》]/g, "") === bookMatch[1]);
      return await applyFeature(book
        ? buyBook(state, book)
        : { logs: [{ t: "err", text: `  没有这本书：${bookMatch[1]}` }] });
    }
    if (line === "祈福") {
      const temple = getBuildingsForLocation(state.room?.name)
        .find((building) => building.type === BUILDING_TYPE.TEMPLE);
      if (!temple) return await applyFeature({ logs: [{ t: "err", text: "  此处没有寺庙。" }] });
      return await applyFeature(pray(state, temple.karmaPerPray || 10));
    }
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

    const tradeMatch = /^交易\s+(.+)$/.exec(line);
    if (tradeMatch) {
      const npc = visibleNpcs.find((entry) => entry?.name === tradeMatch[1]);
      if (!npc) return await missingNpc(tradeMatch[1]);
      const result = tradeWithNpc(state, npc);
      if (result.shop) {
        emit(`${result.shop.shopName || `${npc.name}的铺子`}已开张。`);
        return 0;
      }
      return await applyFeature(result);
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
      return await applyFeature(inviteCompanion(state, npc, { getNow }));
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

  const intentRouter = apiCfgOverrides?.intentRecognitionEnabled ? createCliIntentRouter({
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

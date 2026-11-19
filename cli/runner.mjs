import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { gameActions, GAME_KEYS, gameStore, initGameStore } from "../src/core/gameStore.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../src/core/newGame.js";
import { snapshotFromStore } from "../src/core/persist.js";
import { setSeed } from "../src/core/rng.js";
import { resetForDay, loadSquares, serializeSquares } from "../src/mapSquares.js";
import { tryRestoreSnapshot } from "../src/saves.js";
import { getTimeStr } from "../src/utils/mudHelpers.js";
import { applyResult } from "../src/features/run.js";
import { meditate, trainNeigong, trainWaigong, breakthroughSkill } from "../src/features/cultivation/logic.js";
import { deposit, withdraw, pledge, redeem } from "../src/features/bank/logic.js";
import { innerMove } from "../src/features/map/logic.js";
import { learnNpcSkill } from "../src/features/npc/logic.js";

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

export function createSession({ out = defaultOutput, cwd = process.cwd(), seed } = {}) {
  const emit = typeof out === "function" ? out : (text) => out.write(`${text}\n`);
  const featureCtx = {
    addLog: (lines) => gameActions.setLog((previous) => [...(previous || []), ...lines]),
    jotNote: () => {},
    setVarTree: gameActions.setVarTreeState,
    act: (text) => emit(`(结算回合需 AI，PR E 接入：${text})`),
  };

  async function runLine(rawLine) {
    const line = String(rawLine).trim();
    if (!line || line.startsWith("#")) return 0;

    if (/^:seed(?:\s|$)/.test(line)) {
      seed = parseSeed(line.slice(5).trim());
      setSeed(seed);
      return 0;
    }

    if (line === ":new") {
      session.roomMap = {};
      resetForDay();
      initGameStore(buildInitialGameState(null, seed));
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
      emit(restored ? `已读取：${file}` : "存档不可用，已开始新局");
      return 0;
    }

    if (line.startsWith(":set ")) {
      const { path, value } = parseAssignment(line.slice(5));
      const [key, ...nestedPath] = path;
      if (!GAME_KEYS.includes(key)) throw new Error(`Unknown game state path: ${path.join(".")}`);
      const action = actionForKey(key);
      action(nestedPath.length
        ? (current) => setNestedValue(current, nestedPath, value)
        : value);
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
    const movementMatch = /^(走|去)\s+(.+)$/.exec(line);
    if (movementMatch) {
      const result = innerMove(state, {
        target: movementMatch[2],
        command: line,
        targetKind: movementMatch[1] === "去" ? "room" : "direction",
        forceLayer: "inner",
      });
      if (result) {
        applyResult(featureCtx, result);
        return 0;
      }
    }

    const learnNpcMatch = /^拜师\s+(.+)$/.exec(line);
    if (learnNpcMatch) {
      const npc = (state.room?.npcs || []).find((entry) => entry?.name === learnNpcMatch[1]);
      applyResult(featureCtx, learnNpcSkill(state, npc));
      return 0;
    }

    if (line === "打坐") {
      applyResult(featureCtx, meditate(state));
      return 0;
    }
    if (line === "练内功") {
      applyResult(featureCtx, trainNeigong(state));
      return 0;
    }
    if (line === "练外功") {
      applyResult(featureCtx, trainWaigong(state));
      return 0;
    }

    const skillMatch = /^修炼\s+(.+)$/.exec(line);
    if (skillMatch) {
      applyResult(featureCtx, breakthroughSkill(state, skillMatch[1]));
      return 0;
    }

    const depositMatch = /^存钱\s+(\S+)$/.exec(line);
    if (depositMatch) {
      const amount = parsePositiveInteger(depositMatch[1]);
      applyResult(featureCtx, amount === null
        ? { logs: [{ t: "err", text: "  数额无效" }] }
        : deposit(state, amount));
      return 0;
    }
    if (line === "取钱") {
      applyResult(featureCtx, withdraw(state));
      return 0;
    }

    const pledgeMatch = /^质押\s+(.+)\s+(\S+)$/.exec(line);
    if (pledgeMatch) {
      const pledgeValue = parsePositiveInteger(pledgeMatch[2]);
      if (pledgeValue === null) {
        applyResult(featureCtx, { logs: [{ t: "err", text: "  数额无效" }] });
        return 0;
      }
      const item = (state.inv || []).find((entry) => typeof entry === "object" && entry?.name === pledgeMatch[1]);
      applyResult(featureCtx, pledge(state, item?.id, pledgeValue));
      return 0;
    }
    const redeemMatch = /^赎回\s+(\S+)\s+(\S+)$/.exec(line);
    if (redeemMatch) {
      const index = parsePositiveInteger(redeemMatch[1]);
      const redeemCost = parsePositiveInteger(redeemMatch[2]);
      if (index === null || redeemCost === null) {
        applyResult(featureCtx, { logs: [{ t: "err", text: "  数额无效" }] });
        return 0;
      }
      applyResult(featureCtx, redeem(state, index - 1, redeemCost));
      return 0;
    }

    emit(`暂不支持：${line}（PR C 起接入）`);
    return 0;
  }

  const session = {
    store: gameStore,
    roomMap: {},
    runLine,
    renderState: () => renderState(gameStore.getState()),
  };
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

import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { gameActions, GAME_KEYS, gameStore, initGameStore } from "../src/core/gameStore.js";
import { buildInitialGameState, DEFAULT_PRESETS } from "../src/core/newGame.js";
import { snapshotFromStore } from "../src/core/persist.js";
import { loadSquares, serializeSquares } from "../src/mapSquares.js";
import { tryRestoreSnapshot } from "../src/saves.js";
import { getTimeStr } from "../src/utils/mudHelpers.js";

const defaultOutput = (text) => process.stdout.write(`${text}\n`);

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

export function createSession({ out = defaultOutput, cwd = process.cwd() } = {}) {
  const emit = typeof out === "function" ? out : (text) => out.write(`${text}\n`);

  async function runLine(rawLine) {
    const line = String(rawLine).trim();
    if (!line || line.startsWith("#")) return 0;

    if (line === ":new") {
      initGameStore(buildInitialGameState(null));
      return 0;
    }

    if (line === ":state") {
      emit(renderState(gameStore.getState()));
      return 0;
    }

    if (line.startsWith(":save ")) {
      const file = line.slice(6).trim();
      if (!file) throw new Error(":save requires a file path");
      const snapshot = snapshotFromStore({ squares: serializeSquares(), roomMap: {} });
      await writeFile(resolve(cwd, file), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      emit(`已保存：${file}`);
      return 0;
    }

    if (line.startsWith(":load ")) {
      const file = line.slice(6).trim();
      if (!file) throw new Error(":load requires a file path");
      const snapshot = JSON.parse(await readFile(resolve(cwd, file), "utf8"));
      const restored = tryRestoreSnapshot(DEFAULT_PRESETS, snapshot);
      if (restored?.snap?.squares) loadSquares(restored.snap.squares);
      initGameStore(buildInitialGameState(restored));
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

    emit(`暂不支持：${line}（PR C 起接入）`);
    return 0;
  }

  return {
    store: gameStore,
    runLine,
    renderState: () => renderState(gameStore.getState()),
  };
}

export async function runScript(lines, { out = defaultOutput, cwd = process.cwd() } = {}) {
  const session = createSession({ out, cwd });
  const scriptLines = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
  let failures = 0;
  for (const line of scriptLines) {
    failures += await session.runLine(line);
  }
  return failures;
}

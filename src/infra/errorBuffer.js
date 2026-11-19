const ERROR_LIMIT = 50;
const STATE_KEY = Symbol.for("qucuo.errorBuffer");

function createState() {
  return {
    entries: [],
    installedWindows: new WeakSet(),
    installedConsoles: new WeakMap(),
    recordedErrors: new WeakMap(),
  };
}

const state = globalThis[STATE_KEY] || (globalThis[STATE_KEY] = createState());
state.recordedErrors ||= new WeakMap();

function serializeValue(value, seen = new WeakSet()) {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return String(value);
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack || "" };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => serializeValue(item, seen));
  const result = {};
  for (const key of Object.keys(value)) {
    try {
      result[key] = serializeValue(value[key], seen);
    } catch {
      result[key] = "[Unreadable]";
    }
  }
  return result;
}

function normalizeError(error) {
  try {
    if (error && typeof error === "object") {
      return {
        name: typeof error.name === "string" ? error.name : "Error",
        message: typeof error.message === "string" ? error.message : String(error),
        stack: typeof error.stack === "string" ? error.stack : "",
      };
    }
  } catch { /* fall through to string conversion */ }
  try {
    return { name: "Error", message: String(error), stack: "" };
  } catch {
    return { name: "Error", message: "Unknown error", stack: "" };
  }
}

export function recordError(error, info = null) {
  const canTrackError = error !== null && (typeof error === "object" || typeof error === "function");
  if (canTrackError && state.recordedErrors.has(error)) return state.recordedErrors.get(error);

  const entry = {
    timestamp: Date.now(),
    ...normalizeError(error),
    info: info == null ? null : serializeValue(info),
  };
  state.entries.push(entry);
  if (state.entries.length > ERROR_LIMIT) state.entries.shift();
  if (canTrackError) state.recordedErrors.set(error, entry);
  return entry;
}

export function getRecentErrors() {
  return state.entries.map(entry => serializeValue(entry));
}

export function clearErrorBuffer() {
  state.entries.length = 0;
  state.recordedErrors = new WeakMap();
}

function formatConsoleArguments(args) {
  return args.map(arg => {
    if (typeof arg === "string") return arg;
    const value = serializeValue(arg);
    return typeof value === "string" ? value : JSON.stringify(value);
  }).join(" ");
}

export function installErrorBuffer({
  windowRef = globalThis.window,
  consoleRef = globalThis.console,
} = {}) {
  if (windowRef && !state.installedWindows.has(windowRef)) {
    try {
      windowRef.addEventListener("error", event => {
        recordError(event.error || event.message, {
          source: "window.error",
          filename: event.filename || "",
          lineno: event.lineno || 0,
          colno: event.colno || 0,
        });
      });
      windowRef.addEventListener("unhandledrejection", event => {
        recordError(event.reason, { source: "unhandledrejection" });
      });
      state.installedWindows.add(windowRef);
    } catch { /* unavailable during shutdown or in restricted hosts */ }
  }

  if (!consoleRef || state.installedConsoles.has(consoleRef)) return;
  try {
    const originalError = consoleRef.error;
    if (typeof originalError !== "function") return;
    const wrappedError = function (...args) {
      const error = args.find(arg => arg instanceof Error)
        || args.find(arg => arg && typeof arg === "object" && typeof arg.message === "string");
      recordError(error || formatConsoleArguments(args), {
        source: "console.error",
        arguments: args,
      });
      return originalError.apply(this, args);
    };
    consoleRef.error = wrappedError;
    state.installedConsoles.set(consoleRef, { originalError, wrappedError });
  } catch { /* a read-only console should not prevent application startup */ }
}

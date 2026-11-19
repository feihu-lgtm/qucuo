import { getRngState } from "../core/rng.js";
import { getRecentErrors } from "./errorBuffer.js";
import { getTraceLog } from "./actionTrace.js";
import { getPipelineLog, loadConfig } from "./apiConfig.js";
import { loadAutoSave } from "./saves.js";
import { CURRENT_VERSION } from "./version.js";

export const MAX_DEBUG_BUNDLE_BYTES = 1.5 * 1024 * 1024;

const SECRET_KEY = /api[-_]?key|token|secret|password|authorization|cookie/i;
const CONFIG_VALUE_KEY = /key$|token|secret|password|authorization|cookie|endpoint|base[-_]?url|proxy/i;
const EMPTY_SOURCES = Object.freeze({});

function serialize(value, secrets, seen = new WeakSet()) {
  try {
    if (typeof value === "string") {
      let result = value
        .replace(/sk-[A-Za-z0-9]{16,}/g, "[REDACTED]")
        .replace(/Bearer\s+\S+/gi, "[REDACTED]");
      for (const secret of secrets) result = result.split(secret).join("[REDACTED]");
      return result;
    }
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return String(value);
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (value instanceof Error) return serialize({ name: value.name, message: value.message, stack: value.stack || "" }, secrets, seen);
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) {
      const result = value.map(item => serialize(item, secrets, seen));
      seen.delete(value);
      return result;
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (SECRET_KEY.test(key)) continue;
      try {
      result[key] = serialize(value[key], secrets, seen);
      } catch {
        result[key] = "[Unreadable]";
      }
    }
    seen.delete(value);
    return result;
  } catch {
    return "[Unreadable]";
  }
}

function collectConfigValues(config) {
  const values = [];
  const seen = new WeakSet();
  const visit = (value, key = "") => {
    if (typeof value === "string") {
      if (CONFIG_VALUE_KEY.test(key) && value) values.push(value);
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };
  try { visit(config); } catch { /* a hostile config object is simply not used for redaction */ }
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

export function redact(value, apiConfig = null) {
  return serialize(value, collectConfigValues(apiConfig));
}

function readSource(sources, name, fallback, sourceErrors) {
  let hasSource = false;
  let source = fallback;
  try {
    hasSource = Object.prototype.hasOwnProperty.call(sources, name);
    if (hasSource) source = sources[name];
    return typeof source === "function" ? source() : source;
  } catch (error) {
    sourceErrors.push({
      name: "SourceReadError",
      message: `${name}: ${error?.message || String(error)}`,
      info: { source: name },
    });
    if (hasSource) {
      try { return typeof fallback === "function" ? fallback() : fallback; } catch { /* use null below */ }
    }
    return null;
  }
}

function versionText(value) {
  if (typeof value === "string") return value;
  return [value?.codename, value?.time].filter(Boolean).join(" ") || "unknown";
}

function providerHost(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.trim()) return "";
  try {
    return new URL(endpoint, endpoint.startsWith("/") ? "https://local.invalid" : undefined).host;
  } catch {
    return endpoint.match(/^(?:https?:\/\/)?([^/]+)/i)?.[1] || "";
  }
}

function configString(config, keys) {
  for (const key of keys) {
    try {
      if (typeof config?.[key] === "string") return config[key];
    } catch { /* ignore unreadable config properties */ }
  }
  return "";
}

function safeConfigLabel(value) {
  return typeof value === "string"
    ? value.replace(/sk-[A-Za-z0-9]{16,}/g, "[REDACTED]").replace(/Bearer\s+\S+/gi, "[REDACTED]")
    : "";
}

function serializedSize(value) {
  const json = JSON.stringify(value);
  return typeof TextEncoder === "function"
    ? new TextEncoder().encode(json).length
    : json.length;
}

export function getDebugBundleSize(bundle) {
  try { return serializedSize(bundle); } catch { return 0; }
}

export function buildDebugBundle(sources = EMPTY_SOURCES) {
  const sourceErrors = [];
  const safeSources = sources && typeof sources === "object" ? sources : EMPTY_SOURCES;
  const save = readSource(safeSources, "save", loadAutoSave, sourceErrors);
  const apiConfig = readSource(safeSources, "apiConfig", loadConfig, sourceErrors) || {};
  const version = versionText(readSource(safeSources, "version", CURRENT_VERSION, sourceErrors));
  const createdAt = readSource(safeSources, "createdAt", () => new Date().toISOString(), sourceErrors);
  const userAgent = readSource(safeSources, "userAgent", () => globalThis.navigator?.userAgent || "", sourceErrors);
  const viewport = readSource(safeSources, "viewport", () => ({
    width: globalThis.window?.innerWidth ?? null,
    height: globalThis.window?.innerHeight ?? null,
  }), sourceErrors);
  const rngState = readSource(safeSources, "rngState", getRngState, sourceErrors);
  const recentLog = readSource(safeSources, "recentLog", () => save?.log || [], sourceErrors);
  const conversation = readSource(safeSources, "conversation", () => save?.convo || [], sourceErrors);
  const traces = readSource(safeSources, "traces", getTraceLog, sourceErrors);
  const pipelineCalls = readSource(safeSources, "pipelineCalls", getPipelineLog, sourceErrors);
  const errors = readSource(safeSources, "errors", getRecentErrors, sourceErrors);
  const bundle = {
    schema: 1,
    version,
    createdAt,
    userAgent,
    viewport,
    model: configString(apiConfig, ["model"]),
    providerHost: providerHost(configString(apiConfig, ["endpoint", "baseUrl", "baseURL"])),
    save,
    rngState,
    recentLog,
    conversation,
    traces,
    pipelineCalls,
    errors: [...(Array.isArray(errors) ? errors : []), ...sourceErrors],
    truncated: { traces: 0, pipelineCalls: 0, logEntries: 0 },
  };

  const configValues = collectConfigValues(apiConfig);
  const redacted = serialize(bundle, configValues);
  redacted.model = safeConfigLabel(bundle.model);
  redacted.providerHost = safeConfigLabel(bundle.providerHost);
  redacted.traces = Array.isArray(redacted.traces) ? redacted.traces.slice(0, 30) : [];
  redacted.pipelineCalls = Array.isArray(redacted.pipelineCalls) ? redacted.pipelineCalls.slice(0, 20) : [];
  redacted.recentLog = Array.isArray(redacted.recentLog) ? redacted.recentLog.slice(-200) : [];
  redacted.conversation = Array.isArray(redacted.conversation) ? redacted.conversation.slice(-40) : [];

  const withinLimit = () => getDebugBundleSize(redacted) <= MAX_DEBUG_BUNDLE_BYTES;
  while (!withinLimit() && redacted.traces.length) {
    redacted.traces.pop();
    redacted.truncated.traces++;
  }
  while (!withinLimit() && redacted.pipelineCalls.length) {
    redacted.pipelineCalls.pop();
    redacted.truncated.pipelineCalls++;
  }
  while (!withinLimit() && redacted.recentLog.length) {
    redacted.recentLog.shift();
    redacted.truncated.logEntries++;
  }
  if (!withinLimit()) redacted.truncated.overLimit = true;
  return redacted;
}

function timestampForFilename(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function downloadDebugBundle(bundle) {
  const version = String(bundle?.version || "unknown").replace(/[^A-Za-z0-9._-]+/g, "_");
  const filename = `qucuo-debug-${version}-${timestampForFilename(new Date())}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

import { getPromptDef, getPromptOverrides, listPromptDefs } from "./registry.js";
import { renderPromptTemplate } from "./promptRefs.js";

const CJK_RE = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;

function countTextTokens(text) {
  if (!text) return 0;
  const cjk = (text.match(CJK_RE) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk * 1.5 + rest * 0.25);
}

// 统一 Token 估算：中文与全角标点按 1.5、其余字符按 0.25 向上取整；兼容 string 与 sysBlocks 数组。
export function estimatePromptTokens(system, messages = []) {
  const sysText = Array.isArray(system)
    ? system.map((b) => b?.content || "").join("\n")
    : String(system || "");
  let total = countTextTokens(sysText);
  for (const m of messages || []) {
    total += countTextTokens(typeof m === "string" ? m : (m?.content || ""));
  }
  return total;
}

function evalWhen(when, ctx) {
  if (when == null || when === true) return { lit: true, reason: "蓝灯常驻" };
  if (when === false) return { lit: false, reason: "已关闭" };
  if (typeof when === "function") {
    const res = when(ctx);
    return typeof res === "object" && res !== null
      ? { lit: Boolean(res.lit), reason: res.reason || "" }
      : { lit: Boolean(res), reason: res ? "条件命中" : "条件未命中" };
  }
  return { lit: Boolean(when), reason: when ? "条件命中" : "条件未命中" };
}

function mergeOverrides(stored, explicit) {
  const out = {};
  const keys = new Set([...Object.keys(stored || {}), ...Object.keys(explicit || {})]);
  for (const id of keys) {
    const base = stored?.[id];
    const patch = explicit?.[id];
    if (patch == null) {
      if (base) out[id] = base;
    } else if (typeof patch === "string") {
      out[id] = { ...(typeof base === "object" && base ? base : {}), text: patch };
    } else {
      out[id] = { ...(typeof base === "object" && base ? base : {}), ...patch };
    }
  }
  return out;
}

function applyOverride(block, overrides) {
  const ov = overrides?.[block.id];
  if (ov == null) return block;
  if (typeof ov === "string") return { ...block, text: ov };
  const next = { ...block };
  if ("text" in ov && ov.text !== undefined) next.text = ov.text;
  if ("mode" in ov && ov.mode !== undefined) next.mode = ov.mode;
  if ("enabled" in ov && ov.enabled !== undefined) next.enabled = ov.enabled;
  return next;
}

function resolveBlocks(blockIds, overrides) {
  const blocks = [];
  for (const id of blockIds || []) {
    if (id.endsWith(".*")) {
      const prefix = id.slice(0, -1);
      for (const b of listPromptDefs("block")) {
        if (b.id.startsWith(prefix)) blocks.push(applyOverride(b, overrides));
      }
      continue;
    }
    const base = getPromptDef("block", id);
    if (!base) throw new Error(`Unknown block spec: ${id}`);
    blocks.push(applyOverride(base, overrides));
  }
  return blocks;
}

// 按 call.blocks 声明顺序组装 6 槽位提示词，保持默认无覆盖下的精确字符等价
export function buildPrompt(callId, ctx = {}, { overrides = {} } = {}) {
  const call = getPromptDef("call", callId);
  if (!call) throw new Error(`Unknown call spec: ${callId}`);

  const mergedOverrides = mergeOverrides(getPromptOverrides(), overrides);
  const missingRefs = new Set();
  const traceMissing = (paths) => {
    for (const p of paths) missingRefs.add(p);
    if (typeof ctx.trace === "function") ctx.trace(paths);
  };
  const render = (tpl, extra, refOpts) => {
    const merged = extra ? { ...ctx, ...extra } : ctx;
    const scope = refOpts
      ? { ...merged, promptRefOptions: { ...merged.promptRefOptions, ...refOpts } }
      : merged;
    return renderPromptTemplate(tpl, scope, { trace: traceMissing }).text;
  };

  const buckets = {
    sys: [],
    authorsNote: [],
    history: [],
    inChat: [],
    user: [],
    prefill: [],
  };
  const report = [];

  for (const b of resolveBlocks(call.blocks, mergedOverrides)) {
    if (!buckets[b.slot]) throw new Error(`Unsupported block slot: ${b.slot}`);
    if (b.enabled === false) {
      report.push({ id: b.id, label: b.label, slot: b.slot, kind: b.kind, lit: false, reason: "已关闭", text: "" });
      continue;
    }
    const mode = b.editable === "engine" && b.mode === "off" ? undefined : b.mode;
    const gate = mode === "blue"
      ? { lit: true, reason: "总控台蓝灯" }
      : mode === "off"
        ? { lit: false, reason: "总控台关闭" }
        : evalWhen(b.when, ctx);
    if (!gate.lit) {
      report.push({ id: b.id, label: b.label, slot: b.slot, kind: b.kind, lit: false, reason: gate.reason, text: "" });
      continue;
    }
    const raw = typeof b.text === "function" ? b.text(ctx, render) : render(b.text || "");
    const body = raw ?? "";
    if (!body) {
      report.push({ id: b.id, label: b.label, slot: b.slot, kind: b.kind, lit: false, reason: "内容为空", text: "" });
      continue;
    }
    buckets[b.slot].push(body);
    report.push({ id: b.id, label: b.label, slot: b.slot, kind: b.kind, lit: true, reason: gate.reason, text: body });
  }

  const slotJoin = (slotName) => {
    if (typeof call.join === "object" && call.join !== null) {
      if (slotName in call.join && call.join[slotName] !== undefined) return call.join[slotName];
      if (slotName === "authorsNote" || slotName === "inChat" || slotName === "prefill") return "\n\n";
      return call.join.user ?? "";
    }
    if (typeof call.join === "string") return call.join;
    if (slotName === "authorsNote" || slotName === "inChat" || slotName === "prefill") return "\n\n";
    return "";
  };

  const sysText = buckets.sys.join(slotJoin("sys"));
  const notesText = buckets.authorsNote.join(slotJoin("authorsNote"));
  const system = sysText && notesText ? `${sysText}\n\n${notesText}` : (sysText || notesText);
  const inChatText = buckets.inChat.join(slotJoin("inChat"));
  const userText = buckets.user.join(slotJoin("user"));
  const prefillText = buckets.prefill.join(slotJoin("prefill"));
  const historyText = buckets.history
    .map((h) => (typeof h === "object" && h !== null ? h.content || "" : String(h || "")))
    .filter(Boolean)
    .join("\n\n");

  const messages = [...(call.history?.(ctx) || [])];
  for (const h of buckets.history) {
    if (typeof h === "object" && h !== null && h.role) messages.push(h);
    else if (h) messages.push({ role: "user", content: String(h) });
  }
  if (inChatText) messages.push({ role: "user", content: inChatText });
  if (userText) messages.push({ role: "user", content: userText });
  if (prefillText) messages.push({ role: "assistant", content: prefillText });

  const maxTokens = (call.tokenLimitKey ? ctx.apiCfg?.callTokenLimits?.[call.tokenLimitKey] : undefined)
    ?? call.defaultMaxTokens;
  const slots = {
    sys: sysText,
    authorsNote: notesText,
    history: historyText,
    inChat: inChatText,
    user: userText,
    prefill: prefillText,
  };
  const tokenEstimate = estimatePromptTokens(system, messages);

  return { system, messages, maxTokens, blocks: report, missingRefs: [...missingRefs], slots, tokenEstimate };
}

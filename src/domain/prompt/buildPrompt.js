import { getPromptDef, listPromptDefs } from "./registry.js";
import { renderPromptTemplate } from "./promptRefs.js";

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

function applyOverride(block, overrides) {
  const ov = overrides?.[block.id];
  if (ov == null) return block;
  return typeof ov === "string" ? { ...block, text: ov } : { ...block, ...ov };
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

// 按 call.blocks 声明顺序组装提示词，不做 trim 与额外拼接符注入
export function buildPrompt(callId, ctx = {}, { overrides = {} } = {}) {
  const call = getPromptDef("call", callId);
  if (!call) throw new Error(`Unknown call spec: ${callId}`);

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

  const buckets = { sys: [], user: [] };
  const report = [];

  for (const b of resolveBlocks(call.blocks, overrides)) {
    if (!buckets[b.slot]) throw new Error(`Unsupported block slot: ${b.slot}`);
    if (b.enabled === false) {
      report.push({ id: b.id, label: b.label, slot: b.slot, kind: b.kind, lit: false, reason: "已关闭", text: "" });
      continue;
    }
    const gate = evalWhen(b.when, ctx);
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

  const sysJoin = typeof call.join === "object" ? (call.join?.sys ?? "") : (call.join ?? "");
  const userJoin = typeof call.join === "object" ? (call.join?.user ?? "") : (call.join ?? "");
  const system = buckets.sys.join(sysJoin);
  const messages = [...(call.history?.(ctx) || [])];
  if (buckets.user.length) {
    messages.push({ role: "user", content: buckets.user.join(userJoin) });
  }
  const maxTokens = (call.tokenLimitKey ? ctx.apiCfg?.callTokenLimits?.[call.tokenLimitKey] : undefined)
    ?? call.defaultMaxTokens;

  return { system, messages, maxTokens, blocks: report, missingRefs: [...missingRefs] };
}

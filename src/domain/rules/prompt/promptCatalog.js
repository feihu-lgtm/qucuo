// 统一蓝绿灯总控目录（真源直读 registry + injectionBlocks）：
// 把前后台单调用/双调用/多调用/异步任务归入同一份可读可调的控制矩阵，按六大要素维度展示。
import { getPromptDef, getPromptOverrides, listPromptDefs } from "./registry.js";
import { estimatePromptTokens } from "./buildPrompt.js";
import {
  ACTION_VIEWS, INJECTION_PATHS, STATIC_TEXT_KEYS,
  blocksForAction, giftNarrativeLawExample, giftSettleLawExample, schemaKeyFor,
} from "./injectionBlocks.js";
import * as ENGINE from "./enginePrompts.js";
import { buildExtractionSpecExample } from "./extractionEngine.js";
import { NSFW_RULES } from "./modePrimer.js";
import { getActivePreset } from "./presetSystem.js";

const DEFAULT_PROSE_RULE = "【成文铁律·逐段自查（本条最优先，落笔前先过一遍）】每写完一段，先在心里核两样再往下写：其一，这一段每个句子都要是完整句——主谓宾齐全、该带的定状补都补上，不许出现半截话、掐头去尾、省略到看不明白的残句；其二，这一段凡涉及到的，时间、地点、人物、起因、经过、结果都要交代到实处（这一段确实用不上的那几样可以不写，但只要沾边就得写全，不许用『那人』『某处』『后来』这类含糊词一笔带过）。宁可句子写得实、写得满，也绝不为省字丢主语宾语或掐断句子。";

export const PROMPT_BLOCK_CATEGORIES = [
  { id: "world", label: "世界与此地情况", desc: "此地环境、出口地图、地上物件、世界观总纲、物件志" },
  { id: "player", label: "主角属性与行装", desc: "武力值与七维、内外功、装备、武学、行囊、外貌门控" },
  { id: "npc", label: "人物信息与隔离", desc: "在场人设与性格关系、NPC 认知隔离、旧账与书信近况" },
  { id: "memory", label: "上下文与记忆链", desc: "对话历史、远景日总结、向量记忆召回、事实账本、久别重逢" },
  { id: "style", label: "品德文风与模式", desc: "旁白好感语气、成文铁律、篇幅、NSFW、创造模式" },
  { id: "review", label: "产出格式与审阅", desc: "单双调用骨架、MVU 协议、结构化抽取与后置审阅规则" },
];

export const CALL_GROUP_META = {
  main: { label: "主回合行动", desc: "单调用或双调用主叙事（随命令切换作用域与约束）" },
  whisper: { label: "旁白私聊", desc: "常规与心灵之海双态前后台流式私聊" },
  sync: { label: "同步抽取与识别", desc: "状态提取、意图识别、仲裁、说服、铸剑与导卡扫描" },
  async: { label: "异步后台任务", desc: "日总结、回合记账、飞鸽传书、端详相石与说书润色" },
};

export const EXECUTION_LABELS = {
  foreground_stream: "前台流式",
  sync_pipeline: "回合/面板同步",
  async_background: "后台异步",
};

export const ROUTE_LABELS = {
  primary: "主模型",
  extraction: "提取模型",
  light: "轻量/副模型",
};

const BLOCK_CATALOG_META = {
  engine_identity: { name: "引擎身份声明", category: "style", slot: "sys", editable: "engine" },
  length: { name: "篇幅与节奏要求", category: "style", slot: "authorsNote", editable: "toggle" },
  voice: { name: "旁白语气（品德与好感文风）", category: "style", slot: "sys", editable: "static" },
  preset_scenario: { name: "世界观总纲（此地与地理蓝绿灯）", category: "world", slot: "sys", editable: "static" },
  preset_genrules: { name: "世界与行动通用铁律", category: "style", slot: "sys", editable: "static" },
  preset_wenfeng: { name: "文体铁律与禁用句式", category: "style", slot: "sys", editable: "static" },
  npc_lore: { name: "在场人物档案（性格/生平/关系）", category: "npc", slot: "sys", editable: "toggle" },
  catalog: { name: "曲措乡物件志（物品白名单）", category: "world", slot: "sys", editable: "toggle" },
  isolation: { name: "NPC 认知隔离硬规则", category: "npc", slot: "sys", editable: "engine" },
  map_law: { name: "地图与出口铁律", category: "world", slot: "sys", editable: "engine" },
  mode_note: { name: "对话模式动作锁定", category: "style", slot: "sys", editable: "engine" },
  schema: { name: "输出 JSON Schema 与 MVU 协议", category: "review", slot: "prefill", editable: "engine" },
  gift_settle_law: { name: "送礼结算铁律（单调用 MVU）", category: "review", slot: "inChat", editable: "engine" },
  gift_narrative_law: { name: "送礼叙事铁律（双调用）", category: "review", slot: "inChat", editable: "engine" },
  extraction_call: { name: "提取层独立调用（双调用第二刀）", category: "review", slot: "user", editable: "engine" },
  user_ctx: {
    name: "当前局势（此地情况/武力值/装备/武学/行囊）",
    category: "player",
    slot: "inChat",
    editable: "engine",
    summary: "包含房间出口、地上物、气血、内外功、武力值七维、穿戴装备、已学武学、背包行囊与 NPC 品阶。",
  },
  user_recall: { name: "远景日总结 + 向量召回 + 重逢 + 信息域", category: "memory", slot: "inChat", editable: "toggle" },
  target_ledger: { name: "当前对象旧账提醒", category: "npc", slot: "inChat", editable: "toggle", summary: "注入与交互对象的过往恩怨、人情与怒气缘由。" },
  reunion: { name: "久别重逢上下文", category: "memory", slot: "inChat", editable: "toggle", summary: "久别重逢时的首次照面提醒与情绪线索。" },
  user_prose: { name: "成文铁律（Depth 0 贴生成处）", category: "style", slot: "inChat", editable: "static", defaultMode: "blue" },
  nsfw_rules: { name: "NSFW 写作规则（■ 模式）", category: "style", slot: "inChat", editable: "toggle", defaultMode: "green" },
  gm_rule: { name: "创造模式规则（⚡ 模式）", category: "style", slot: "inChat", editable: "toggle", defaultMode: "green" },
  body_gate: { name: "外貌体貌门控（公开层/私密层）", category: "player", slot: "authorsNote", editable: "toggle", defaultMode: "green" },
  whisper_ctx: { name: "旁白身份与亲疏语境", category: "npc", slot: "sys", editable: "static" },
  world_state: { name: "精简世界状态（此地与背包）", category: "world", slot: "sys", editable: "toggle" },
  facts: { name: "全知事实账本", category: "memory", slot: "sys", editable: "toggle" },
  recall: { name: "向量召回往事", category: "memory", slot: "sys", editable: "toggle" },
  whisper_tally: { name: "当日与累计起居注", category: "memory", slot: "sys", editable: "toggle", summary: "同步玩家今日行动计数，防旁白与主线脱离。" },
  narrator_lore: { name: "旁白专属世界书", category: "style", slot: "sys", editable: "static" },
  topic_gate: { name: "私聊话题红绿灯（身世/邀帖）", category: "style", slot: "sys", editable: "toggle" },
  quest_gate: { name: "任务线红绿灯（全名+好感≥30）", category: "style", slot: "sys", editable: "toggle" },
  whisper_scenario: { name: "剧本背景设定（whisper 门控）", category: "world", slot: "sys", editable: "toggle" },
  whisper_length: { name: "私聊篇幅与语量指令", category: "style", slot: "sys", editable: "static" },
  whisper_output: { name: "私聊输出与软结算好感裁决", category: "review", slot: "user", editable: "engine" },
};

function inferCategory(id, slot) {
  if (BLOCK_CATALOG_META[id]?.category) return BLOCK_CATALOG_META[id].category;
  if (/map|world|scenario|catalog/i.test(id)) return "world";
  if (/body|outfit|char|equip|skill|inv/i.test(id)) return "player";
  if (/npc|pigeon|persuasion|isolation|ledger/i.test(id)) return "npc";
  if (/day\.summary|fact|recall|bookkeep|tally|reunion|history/i.test(id)) return "memory";
  if (/extraction|judge|classify|scan|forge|schema|review|vet/i.test(id) || slot === "prefill") return "review";
  return "style";
}

function editableFor(id, blockDef, legacyKind) {
  if (BLOCK_CATALOG_META[id]?.editable) return BLOCK_CATALOG_META[id].editable;
  if (blockDef?.editable === "engine" || legacyKind === "engine") return "engine";
  if (typeof blockDef?.text === "string" || legacyKind === "static" || legacyKind === "worldbook") return "static";
  return "toggle";
}

function resolveMainStaticText(id, actionView) {
  const key = STATIC_TEXT_KEYS[id];
  if (key && ENGINE[key]) return ENGINE[key];
  if (id === "schema" && actionView) return ENGINE[schemaKeyFor(actionView)];
  if (id === "catalog") return ENGINE.CATALOG_TAIL;
  if (id === "nsfw_rules") return NSFW_RULES;
  if (id === "user_prose") return DEFAULT_PROSE_RULE;
  if (id === "preset_genrules" || id === "preset_wenfeng") {
    const entryId = id === "preset_genrules" ? "genrules" : "wenfeng";
    return getActivePreset()?.prompts?.find((p) => p.id === entryId)?.content || null;
  }
  if (id === "gift_settle_law") return giftSettleLawExample();
  if (id === "gift_narrative_law") return giftNarrativeLawExample();
  if (id === "extraction_call" && actionView) {
    return buildExtractionSpecExample(actionView.intent || "UNKNOWN", actionView.settleKind || null);
  }
  return null;
}

function mergeMatrixItem({
  id, name, slot, kind, editable, defaultLit, defaultMode, reason, summary, staticText, overrides,
}) {
  const ov = overrides?.[id];
  const rawMode = ov?.mode;
  const overrideMode = editable === "engine" && rawMode === "off" ? null : (rawMode || null);
  const effectiveLit = overrideMode === "blue" ? true : overrideMode === "off" ? false : Boolean(defaultLit);
  const effectiveReason = overrideMode === "blue"
    ? "总控台蓝灯"
    : overrideMode === "off"
      ? "总控台关闭"
      : reason;
  const effectiveText = typeof ov?.text === "string" ? ov.text : staticText;

  return {
    id,
    name: name || BLOCK_CATALOG_META[id]?.name || id,
    category: inferCategory(id, slot),
    slot: slot || BLOCK_CATALOG_META[id]?.slot || "sys",
    kind: kind || (editable === "engine" ? "engine" : editable === "static" ? "static" : "gated"),
    editable,
    canToggleOff: editable !== "engine",
    canEditText: editable === "static" && staticText != null,
    defaultLit: Boolean(defaultLit),
    defaultMode: defaultMode || (defaultLit ? "blue" : "green"),
    overrideMode,
    effectiveLit,
    reason: effectiveReason || (effectiveLit ? "蓝灯常驻" : "按条件灭灯"),
    hasTextOverride: typeof ov?.text === "string",
    textOverride: typeof ov?.text === "string" ? ov.text : null,
    staticText,
    effectiveText,
    summary: summary || BLOCK_CATALOG_META[id]?.summary || "",
  };
}

export function listAllManagedCalls() {
  const mainCall = getPromptDef("call", "turn.main");
  const mainMeta = {
    execution: mainCall?.execution || "foreground_stream",
    route: mainCall?.route || "primary",
    reviewDesc: mainCall?.reviewDesc || "单调用校验 JSON+MVU，双调用输出散文交由提取层结算",
  };
  const items = ACTION_VIEWS.filter((v) => v.scope !== "whisper").map((view) => ({
    id: `main:${view.id}`,
    baseCallId: "turn.main",
    actionId: view.id,
    group: "main",
    label: view.label,
    execution: mainMeta.execution,
    route: mainMeta.route,
    reviewDesc: mainMeta.reviewDesc,
    desc: view.note,
    scope: view.scope,
    intent: view.intent,
    supportsDualToggle: true,
  }));

  const order = { whisper: 0, sync: 1, async: 2 };
  const registered = listPromptDefs("call")
    .filter((c) => c.id !== "turn.main")
    .map((c) => {
      const label = typeof c.label === "function" ? c.id : (c.label || c.id);
      return {
        id: c.id,
        baseCallId: c.id,
        group: c.group || "async",
        label,
        execution: c.execution || "async_background",
        route: c.route || "light",
        reviewDesc: c.reviewDesc || (c.vet ? "内置结构化校验与离线兜底" : "直接读取正文并检查截断/stale"),
        desc: c.desc || `注册调用 ${c.id}`,
        tokenLimitKey: c.tokenLimitKey || null,
        supportsDualToggle: false,
      };
    })
    .sort((a, b) => (order[a.group] ?? 9) - (order[b.group] ?? 9) || a.id.localeCompare(b.id));

  return [...items, ...registered];
}

export function getCallControlMatrix(managedId, { mode = "single", overrides = getPromptOverrides() } = {}) {
  const managed = listAllManagedCalls().find((c) => c.id === managedId) || listAllManagedCalls()[0];
  if (!managed) return { call: null, categories: PROMPT_BLOCK_CATEGORIES, items: [], litCount: 0, totalCount: 0, tokenEstimate: 0 };

  let rawItems = [];
  if (managed.baseCallId === "turn.main") {
    const view = ACTION_VIEWS.find((v) => v.id === managed.actionId) || ACTION_VIEWS[0];
    const baseList = blocksForAction(view.id, mode);
    const seen = new Set(baseList.map((b) => b.id));
    const extras = [
      { id: "target_ledger", lit: !view.gm, off: "创造模式可略过旧账", kind: "dynamic" },
      { id: "reunion", lit: view.scope !== "move", off: "纯移动不挂载久别重逢", kind: "gated" },
      { id: "body_gate", lit: view.scope === "full" || view.scope === "talk", off: "移动与普通结算外貌灭灯", kind: "gated" },
    ].filter((e) => !seen.has(e.id));

    rawItems = [...baseList, ...extras].map((b) => mergeMatrixItem({
      id: b.id,
      name: BLOCK_CATALOG_META[b.id]?.name || b.name,
      slot: BLOCK_CATALOG_META[b.id]?.slot,
      kind: b.kind,
      editable: editableFor(b.id, null, b.kind),
      defaultLit: b.lit,
      defaultMode: BLOCK_CATALOG_META[b.id]?.defaultMode || (b.kind === "gated" ? "green" : b.lit ? "blue" : "green"),
      reason: b.lit ? "当前命令默认点亮" : (b.off || "当前命令默认灭灯"),
      summary: BLOCK_CATALOG_META[b.id]?.summary || b.summary,
      staticText: resolveMainStaticText(b.id, view),
      overrides,
    }));
  } else if (managed.baseCallId === "narrator.whisper") {
    const baseList = [...INJECTION_PATHS.whisper.blocks, {
      id: "whisper_tally",
      name: BLOCK_CATALOG_META.whisper_tally.name,
      kind: "dynamic",
      summary: BLOCK_CATALOG_META.whisper_tally.summary,
    }];
    rawItems = baseList.map((b) => mergeMatrixItem({
      id: b.id,
      name: b.name,
      slot: BLOCK_CATALOG_META[b.id]?.slot || "sys",
      kind: b.kind,
      editable: editableFor(b.id, null, b.kind),
      defaultLit: true,
      defaultMode: b.kind === "gated" ? "green" : "blue",
      reason: b.kind === "gated" ? "私聊按关键词/阶段门控点亮" : "私聊默认注入",
      summary: b.summary,
      staticText: null,
      overrides,
    }));
  } else {
    const callDef = getPromptDef("call", managed.baseCallId);
    const blockIds = callDef?.blocks || callDef?.matrixBlocks || [];
    rawItems = blockIds.map((blockId) => {
      const def = getPromptDef("block", blockId);
      const staticText = typeof def?.text === "string" ? def.text : null;
      const defaultLit = def?.when == null ? true : typeof def.when === "boolean" ? def.when : true;
      return mergeMatrixItem({
        id: blockId,
        name: def?.label || BLOCK_CATALOG_META[blockId]?.name || blockId,
        slot: def?.slot || "sys",
        kind: def?.editable === "engine" ? "engine" : staticText != null ? "static" : "dynamic",
        editable: editableFor(blockId, def, null),
        defaultLit,
        defaultMode: def?.when ? "green" : "blue",
        reason: def?.when ? "按调用参数门控" : "本调用常驻",
        summary: def ? `注入槽位 ${def.slot}，来源 registry.js 真源块定义` : "",
        staticText,
        overrides,
      });
    });
  }

  const litTexts = rawItems
    .filter((item) => item.effectiveLit)
    .map((item) => ({ content: item.effectiveText || item.summary || item.name }));
  const tokenEstimate = estimatePromptTokens("", litTexts);

  return {
    call: managed,
    categories: PROMPT_BLOCK_CATEGORIES,
    items: rawItems,
    litCount: rawItems.filter((item) => item.effectiveLit).length,
    totalCount: rawItems.length,
    tokenEstimate,
  };
}

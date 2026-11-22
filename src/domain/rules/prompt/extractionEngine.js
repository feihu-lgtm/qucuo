// AI 调用（callExtraction/forgeDesign）已上移到 engine/ports/extraction.js，
// 本文件只留 spec 查表、cfg 构造、公共字段规整与面板示例。
// 提取层引擎（参数构造部分）：叙事/状态分离模式下，从大模型叙事文本中提取结构化状态变化。
// 大模型只管写故事，这一层（通常是小/快模型）只管把故事转成 JSON 命令。
//
// 每个意图类型的提取范围不同——look 只需要场景刷新，战斗需要 HP/掉落，
// 聊天只需要好感度。按意图精确提问可以大幅提升提取准确率（token 少、任务聚焦）。

import { apiModelField, getApiModel } from "../../../infra/apiModel.js";
import { EXTRACTION_SPECS, renderExtractionSpec } from "./extractionSpecs.js";
import { getPresentNpcs } from "./promptRefs.js";


// 公共字段规整（就地修改并返回同一个对象）。
// 提取模型通常是小/快模型，格式服从度不如主模型：memory 可能吐成对象或数字、
// mentionedNewNpcs 可能吐成单个字符串或"甲、乙"这样的逗号串。下游
// （writeNote / registerFact / recordRumoredNpcs）都假定 string 与 string[]，
// 这里一次性收拾干净——脏数据一旦写进事实账本，日后再查是谁写的就很麻烦。
// 空值直接删掉而不是留空串：下游一律用 if (p.memory) 判断，留空串等于多绕一圈。
export function normalizeDuelRequest(parsed, state = {}) {
  if (!parsed || typeof parsed !== "object" || parsed.duelRequest == null) return parsed;
  const raw = parsed.duelRequest;
  let name = "";
  if (typeof raw === "string") name = raw.trim();
  else if (typeof raw?.name === "string") name = raw.name.trim();
  const npc = getPresentNpcs(state).find((candidate) => candidate.name === name);
  if (npc) parsed.duelRequest = npc; else delete parsed.duelRequest;
  return parsed;
}

export function normalizeExtractedFields(parsed, state = {}) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (parsed.memory != null && typeof parsed.memory !== "string") {
    parsed.memory = String(parsed.memory);
  }
  if (parsed.memory != null && !parsed.memory.trim()) delete parsed.memory;

  if (parsed.mentionedNewNpcs != null) {
    const raw = parsed.mentionedNewNpcs;
    const list = Array.isArray(raw) ? raw
      : typeof raw === "string" ? raw.split(/[，,、\s]+/)
      : [];
    const cleaned = Array.from(new Set(list.map(x => String(x ?? "").trim()).filter(Boolean)));
    if (cleaned.length) parsed.mentionedNewNpcs = cleaned;
    else delete parsed.mentionedNewNpcs;
  }
  return normalizeDuelRequest(parsed, state);
}

// 从 apiCfg 解析出这个意图应该用哪个模型（intent-specific > 默认提取模型 > 主模型）。
export function buildExtractionCfg(intentCode, apiCfg) {
  const model =
    (apiCfg.extractionModels?.[intentCode]) ||
    apiCfg.extractionModel ||
    getApiModel(apiCfg);
  return {
    ...apiCfg,
    [apiModelField(apiCfg)]: model,
    thinkingMode: "off",  // 提取是结构化任务，不需要思考
    maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000,      // 提取结果很短，给足但不浪费（可在设置里调，上限 100000）
  };
}

// settleKind → 专属提取 spec 映射，新增结算类型只需注册映射。
export const SETTLE_KIND_SPECS = { gift: "GIFT", companion_invite: "COMPANION_INVITE", learn_skill: "LEARN_SKILL", appease: "APPEASE" };

export function getExtractionSpec(intentCode, settleOpts) {
  const settleSpecKey = settleOpts?.settleNpc ? SETTLE_KIND_SPECS[settleOpts.settleKind] : null;
  const key = settleSpecKey || intentCode;
  return { key, spec: Object.hasOwn(EXTRACTION_SPECS, key) ? EXTRACTION_SPECS[key] : EXTRACTION_SPECS.UNKNOWN };
}

// 调用提取层，返回 { p, mvuCommands, parseFailed }（p/mvuCommands 与 parseMainResponse 返回结构相同，可直接复用状态应用代码）。
// 如果这个意图不需要状态提取（META_QUERY），返回 null。
// settleOpts 携带目标NPC和结算类型所需的上下文；双调用模式的状态判定由专属提取 spec 约束。
// ============================================================================
// 双调用模式下"提取层调用"的 prompt 样例生成器
// 供 InjectionStructurePanel 在预设面板里直接展示第二次独立 AI 调用的 system/user。
// 用一份代表性示例快照 + 占位叙事去调 EXTRACTION_SPECS 的真实工厂，
// 保证面板看到的内容与 extractionEngine.js 实际调用同构，不另写一份示例防漂移。
// ============================================================================
const EXTRACTION_SAMPLE_SNAPSHOT = {
  room: {
    name: "鱼定村口",
    exits: ["e", "s", "w"],
    npcs: [{ name: "才旦", id: "caidan", brief: "背着猎弓的汉子" }],
    items: [{ name: "碎石", id: "stone" }],
  },
  char: { hp: [85, 100], name: "主角", money: 30 },
  inv: [],
  dao: 0,
  varTree: { 角色: { 才旦: { 好感度: 30 } } },
  lockedDestName: null,
  lockedExits: null,
  pickupJudgment: { quality: "绿", category: "misc" },
};

const EXTRACTION_SAMPLE_NARRATIVE = "（此处为主叙事这一步实际输出的散文正文。预设面板用示例占位，展示提取层会收到什么样的输入。）";

// 每条都必须带 settleKind——buildExtractionSpecExample 是拿 settleOpts.settleKind
// 去查 SETTLE_KIND_SPECS 的。此前这几条只有 settleNpc/giftInfo 没有 settleKind，
// 查表恒为 undefined，于是面板预览"送礼/认主"时显示的其实是 UNKNOWN 那份通用 spec，
// 而不是真正会被调用的 GIFT/COMPANION_INVITE——这块本来就是为"防止面板与实际调用
// 漂移"而写的，结果它自己先漂了。
const EXTRACTION_SAMPLE_SETTLE = {
  gift: {
    settleKind: "gift",
    settleNpc: "才旦",
    giftInfo: {
      itemName: "无主的青锋剑",
      quality: "绿",
      categoryLabel: "武器",
      desc: "村口土里半掩着的一把青锋剑，剑身还算齐整，不知是哪位过路侠客遗落的。",
      range: [4, 6],
      suggestedDelta: 5,
    },
  },
  companion_invite: { settleKind: "companion_invite", settleNpc: "雪豹", settleBeast: true },
  appease: { settleKind: "appease", settleNpc: "才旦" },
  learn_skill: {
    settleKind: "learn_skill",
    settleNpc: "雪豹",
    learnInfo: { isMaster: true, moveBrief: "雪隐三绝(兽性)", totalPrice: 0, beast: true },
  },
};

export function buildExtractionSpecExample(intentCode, settleKind = null) {
  const settleOpts = settleKind ? EXTRACTION_SAMPLE_SETTLE[settleKind] : null;
  const { spec } = getExtractionSpec(intentCode, settleOpts);
  if (!spec) return null;
  const system = typeof spec.system === "function"
    ? spec.system(EXTRACTION_SAMPLE_NARRATIVE, EXTRACTION_SAMPLE_SNAPSHOT, settleOpts)
    : spec.system;
  // 必须跟 callExtraction 一样补上 commonExtractTail——那段公共尾巴（memory /
  // mentionedNewNpcs / mvu 路径规矩）是每一次真实调用都会追加的，占了 user prompt
  // 相当一部分篇幅。此前这里只渲染 spec.user() 就返回，面板展示的 prompt 比实际
  // 发出去的少了一整段，而这块代码的注释恰恰写着"保证面板看到的内容与实际调用同构、
  // 不另写一份示例防漂移"——又漂了一次（前一次是示例缺 settleKind，见上方注释）。
  const user = renderExtractionSpec(spec, EXTRACTION_SAMPLE_NARRATIVE, EXTRACTION_SAMPLE_SNAPSHOT, settleOpts);
  return `【提取层 System Prompt】
${system}

【提取层 User Prompt】
${user}

（以上为 ${intentCode}${settleKind ? " + settleKind:" + settleKind : ""} 的真实提取模板，以示例快照/占位叙事渲染，实际调用会按当轮真值替换。）`;
}

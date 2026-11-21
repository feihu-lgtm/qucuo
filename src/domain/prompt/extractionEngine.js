// 提取层引擎：叙事/状态分离模式下，从大模型叙事文本中提取结构化状态变化。
// 大模型只管写故事，这一层（通常是小/快模型）只管把故事转成 JSON 命令。
//
// 每个意图类型的提取范围不同——look 只需要场景刷新，战斗需要 HP/掉落，
// 聊天只需要好感度。按意图精确提问可以大幅提升提取准确率（token 少、任务聚焦）。

import { snowLeopardNote } from "../quests/snowLeopardQuest.js";
import { callModel, cleanJsonString } from "../../infra/apiConfig.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { extractMvuBlock } from "./mvu.js";
import { apiModelField, getApiModel } from "../../core/apiModel.js";
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

function getExtractionSpec(intentCode, settleOpts) {
  const settleSpecKey = settleOpts?.settleNpc ? SETTLE_KIND_SPECS[settleOpts.settleKind] : null;
  const key = settleSpecKey || intentCode;
  return { key, spec: Object.hasOwn(EXTRACTION_SPECS, key) ? EXTRACTION_SPECS[key] : EXTRACTION_SPECS.UNKNOWN };
}

// 调用提取层，返回 { p, mvuCommands, parseFailed }（p/mvuCommands 与 parseMainResponse 返回结构相同，可直接复用状态应用代码）。
// 如果这个意图不需要状态提取（META_QUERY），返回 null。
// settleOpts 携带目标NPC和结算类型所需的上下文；双调用模式的状态判定由专属提取 spec 约束。
export async function callExtraction(intentCode, narrative, state, apiCfg, settleOpts = null, ai = createWebAi(), trace) {
  if (settleOpts?.settleKind === "duel_invite") return { p: {}, mvuCommands: [] };
  const { key, spec } = getExtractionSpec(intentCode, settleOpts);
  if (!spec) return null;

  const cfg = buildExtractionCfg(key, apiCfg);
  const systemPrompt = spec.system;
  // 公共字段统一拼在末尾，避免各意图的 schema 漂移。
  const userContent = renderExtractionSpec(spec, narrative, state, settleOpts, trace) + snowLeopardNote({ ...state, ...settleOpts });

  const { text } = await ai.chat(
    [{ role: "user", content: userContent }],
    {
      cfg,
      systemPrompt,
      modelOptions: { maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000, callLabel: `状态提取(${intentCode})` },
    },
  );

  // 解析 JSON
  let js = text.replace(/```json\s*|```\s*/g, "").trim();
  const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  js = cleanJsonString(js);

  let parsed = {};
  let parseFailed = false;
  try { parsed = JSON.parse(js); } catch { parsed = {}; parseFailed = true; }

  normalizeExtractedFields(parsed, state);

  // 从 JSON 的 "mvu" 字符串字段提取 MVU 指令（复用 extractMvuBlock 的正则解析）
  let mvuCommands = [];
  if (parsed.mvu && typeof parsed.mvu === "string") {
    const { commands } = extractMvuBlock(`<mvu>${parsed.mvu}</mvu>`);
    mvuCommands = commands;
    delete parsed.mvu;
  }

  // parseFailed：提取模型返回了无法解析的内容（被截断/没按格式输出），调用方
  // 据此提示"本轮状态未更新"——此前解析失败被静默吞掉，玩家毫无感知。
  return { p: parsed, mvuCommands, parseFailed };
}

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

// ── 铸剑坊/铁匠铺 定制设计：小模型据玩家三填空(材料/类别/要求)生成 3 个成品候选 ──
// 守铁律：AI 只出「名字 / 类别字段 / 词条(从全集白名单里选) / 说书人描述」，绝不碰品质
// (品质由系统 rollQuality 按气运定)和数值(倍率由品质公式算)。词条只能从下面 EFFECT 白名单
// 里挑——这批是 combat/resolveTurn.js 真正读取的字段，选别的是死字段。玩家"要求"栏(锋利/
// 幸运/护身…)是词条来源，模型据此语义匹配。返回 3 个不同演绎，供面板三选一。
const FORGE_EFFECT_WHITELIST = `
可选词条(effect，只能从这里选，按玩家"要求"语义匹配，白/绿档留空不给词条、蓝档起才给)：
· 攻击向：forceFirst(必先手,对应"快/先发") | ignoreDefense(无视防御,对应"锋利/破甲") | doubleVsStatus(克中招之敌翻倍) | lowHpBonus:0.15(残血增伤,对应"绝境/搏命") | afterStatusBonus(趁敌中招追击) | detonateMark:{perStackRatio:0.35}(引爆内伤)
· 控制向：enemyCostPenalty:{value:2,turns:2}(封穴抬高对方耗气) | freezeEnergyRecovery(封气,冻回气) | applyMark:{name:"内伤印",stacks:1}+applyMarkChance:0.3(附内伤印)
· 应对向：onCounterSuccessDamageRatio:0.3(应对成功追伤,对应"以守反攻") | onCounterSuccessEnergyGain:2(应对成功回气)
· 续航向：hpRestore:0.08(每回合回血,对应"养身/温养") | energyRestore:2(起手回气)
· 六维：sixDim:{气运:2}(对应"幸运") | sixDim:{身法:2}(轻便) | sixDim:{根骨:2}(坚固) | sixDim:{魅力:2} | sixDim:{智谋:1} | sixDim:{体魄:1} | sixDim:{悟性:1}
effect 与 sixDim 二选一为主(一件东西通常只挂其一，紫橙档可两者少量兼有)。`;

export async function forgeDesign({ material, category, requirement, craft }, apiCfg) {
  const cfg = buildExtractionCfg("FORGE_DESIGN", apiCfg);
  // craft 语境：默认铁匠铺(打兵器/护具/铁料)，金玉行传 { shop:"金玉行", maker:"玉匠", wares:"玉器" }
  // 让 prompt 贴合——玉匠雕的是玉器饰物，说书人味也不同。不传则走铁匠默认。
  const maker = craft?.maker || "铁匠";
  const wares = craft?.wares || "兵器/护具/饰物";
  const shop = craft?.shop || "铁匠铺";
  const system = `你是曲措乡这个澜湄雪域武侠世界里${shop}的"匠心"——玩家拿料来定制${wares}，你这位${maker}要据玩家给的【材料/类别/要求】设计出三个不同的成品方案供他挑选。守规矩：你只负责创意(名字、属于哪类装备、挂什么词条、说书人风味的介绍)，绝不决定品质高低(那由玩家气运和料子成色定)、绝不编数值。三个方案要有区别——同样的料和要求，可以往不同形制/侧重去做。`;
  const user = `玩家定制需求：
· 材料：${material || "(未指定，任你择料)"}
· 类别：${category || "(未指定，你据材料与要求判断最合适的类别)"}
· 要求：${requirement || "(未特别要求)"}
${FORGE_EFFECT_WHITELIST}

请设计 3 个不同的成品方案，只输出 JSON，不要任何解释或 markdown：
{"candidates":[
  {"name":"贴合材料与形制的成品名(不超过7字)","category":"weapon|armor|accessory 三选一","effect":{词条对象，按白名单选，可空对象{}},"sixDim":{六维对象，可空},"desc":"一两句说书人白话古文，讲这件东西的形制/来历/脾性，禁冒号破折号"}
  , {第二个方案，与第一个形制或侧重不同} 
  , {第三个方案，再不同}
]}
注意：category 必须是 weapon/armor/accessory 之一的英文；effect 和 sixDim 若不给就写空对象 {}；name 要贴合材料(玩家写了陨铁/某玉料，名字里就该见其质感)。`;

  const { text } = await callModel(cfg, system, [{ role: "user", content: user }], { maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000, callLabel: `${shop}定制设计` });
  let js = (text || "").replace(/\`\`\`json\s*|\`\`\`\s*/g, "").trim();
  const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  js = cleanJsonString(js);
  let parsed;
  try { parsed = JSON.parse(js); } catch { return { ok: false, candidates: [] }; }
  const cands = Array.isArray(parsed.candidates) ? parsed.candidates.slice(0, 3) : [];
  // 清洗：category 兜底 weapon，effect/sixDim 保证是对象
  const CATS = ["weapon", "armor", "accessory"];
  const clean = cands.map(c => ({
    name: String(c?.name || "定制之物").slice(0, 12),
    category: CATS.includes(c?.category) ? c.category : "weapon",
    effect: (c?.effect && typeof c.effect === "object") ? c.effect : {},
    sixDim: (c?.sixDim && typeof c.sixDim === "object") ? c.sixDim : {},
    desc: String(c?.desc || "").slice(0, 120),
  })).filter(c => c.name);
  return { ok: clean.length > 0, candidates: clean };
}

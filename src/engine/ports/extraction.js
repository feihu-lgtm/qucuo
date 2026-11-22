// 提取层调用口：spec/参数构造与字段规整留在 domain（extractionSpecs/extractionEngine），
// AI 调用上移到 engine/ports。callExtraction 从叙事文本提取结构化状态变化，
// forgeDesign 为铸剑坊/铁匠铺的定制设计调用。
import { snowLeopardNote } from "../../domain/rules/quests/snowLeopardQuest.js";
import { createWebAi, cleanJsonString } from "./ai.js";
import { withAI } from "./withAI.js";
import "../../domain/rules/prompt/calls/domainCalls.js";
import { extractMvuBlock } from "../../domain/rules/prompt/mvu.js";
import { renderExtractionSpec } from "../../domain/rules/prompt/extractionSpecs.js";
import {
  getExtractionSpec,
  buildExtractionCfg,
  normalizeExtractedFields,
} from "../../domain/rules/prompt/extractionEngine.js";

const webAi = createWebAi();

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

// ── 铸剑坊/铁匠铺 定制设计：小模型据玩家三填空(材料/类别/要求)生成 3 个成品候选 ──
// 守铁律：AI 只出「名字 / 类别字段 / 词条(从全集白名单里选) / 说书人描述」，绝不碰品质
// (品质由系统 rollQuality 按气运定)和数值(倍率由品质公式算)。词条只能从下面 EFFECT 白名单
// 里挑——这批是 combat/resolveTurn.js 真正读取的字段，选别的是死字段。玩家"要求"栏(锋利/
// 幸运/护身…)是词条来源，模型据此语义匹配。返回 3 个不同演绎，供面板三选一。
export async function forgeDesign({ material, category, requirement, craft }, apiCfg) {
  const { text } = await withAI(
    "forge.design",
    {
      material,
      category,
      requirement,
      craft,
      forgeCfg: buildExtractionCfg("FORGE_DESIGN", apiCfg),
    },
    { ai: webAi, apiCfg },
  );
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

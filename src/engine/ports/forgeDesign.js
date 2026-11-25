// WO-15：forgeDesign 自 extraction.js 迁入独立小文件保活。
// 铸剑坊/铁匠铺定制设计：小模型据玩家三填空(材料/类别/要求)生成 3 个成品候选。
// 守铁律：AI 只出「名字 / 类别字段 / 词条 / 说书人描述」，绝不碰品质和数值。
import { createWebAi, cleanJsonString } from "./ai.js";
import { withAI } from "./withAI.js";
import "../../domain/rules/prompt/calls/domainCalls.js";
import { apiModelField, getApiModel } from "../../content/apiModel.js";

const webAi = createWebAi();

// 定制设计是结构化任务：关思考、短输出，模型可用设置里的提取模型档位
function forgeModelCfg(apiCfg) {
  const model = apiCfg.extractionModels?.FORGE_DESIGN || apiCfg.extractionModel || getApiModel(apiCfg);
  return {
    ...apiCfg,
    [apiModelField(apiCfg)]: model,
    thinkingMode: "off",
    maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000,
  };
}

export async function forgeDesign({ material, category, requirement, craft }, apiCfg) {
  const res = await withAI(
    "forge.design",
    { material, category, requirement, craft, forgeCfg: forgeModelCfg(apiCfg) },
    { ai: webAi, apiCfg },
  );
  let parsed;
  if (Array.isArray(res.data?.candidates)) {
    parsed = res.data;
  } else {
    let js = (res.text || "").replace(/\`\`\`json\s*|\`\`\`\s*/g, "").trim();
    const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
    if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
    js = cleanJsonString(js);
    try { parsed = JSON.parse(js); } catch { return { ok: false, candidates: [] }; }
  }
  const cands = Array.isArray(parsed.candidates) ? parsed.candidates.slice(0, 3) : [];
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

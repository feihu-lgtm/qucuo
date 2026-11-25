// WO-15：buildExtractionCfg 自 extractionEngine.js 迁入并更名语义——它早已不是
// "提取层专属"，而是所有结构化小调用（记忆召回/前哨听意/锻器设计/广场预热等）
// 共用的 cfg 构造器：提取模型档位优先、关思考、短输出。
import { apiModelField, getApiModel } from "../../../content/apiModel.js";

// 从 apiCfg 解析出这个意图应该用哪个模型（intent-specific > 默认提取模型 > 主模型）。
export function buildExtractionCfg(intentCode, apiCfg) {
  const model =
    (apiCfg.extractionModels?.[intentCode]) ||
    apiCfg.extractionModel ||
    getApiModel(apiCfg);
  return {
    ...apiCfg,
    [apiModelField(apiCfg)]: model,
    thinkingMode: "off",  // 结构化任务不需要思考
    maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000,
  };
}

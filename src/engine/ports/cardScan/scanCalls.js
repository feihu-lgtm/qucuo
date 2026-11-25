// 单次调用封装（经 withAI 统一门禁）
// 取令牌 → 调模型 → 解析；失败按 code 决定是否重试。

import { definePrompt, getPromptDef } from "../../../domain/rules/prompt/registry.js";
import { acquire } from "../../../domain/rules/cards/rateLimiter.js";
import { parseJsonLoose } from "../../../domain/rules/cards/scanPrompts.js";
import { createWebAi } from "../ai.js";
import { withAI } from "../withAI.js";

const webAi = createWebAi();

function ensureCardScanPrompt() {
  if (getPromptDef("call", "card.scan")) return;
  definePrompt("block", "card.scan.sys", {
    label: "导卡扫描系统指令",
    slot: "sys",
    text: (ctx) => ctx.system || "你是角色卡解析助手。",
  });
  definePrompt("block", "card.scan.user", {
    label: "导卡扫描上下文",
    slot: "user",
    text: (ctx) => ctx.user || "",
  });
  definePrompt("call", "card.scan", {
    group: "sync",
    label: (ctx) => ctx.callLabel || "导卡扫描",
    execution: "sync_pipeline",
    route: "primary",
    reviewDesc: "parseJsonLoose 宽松解 JSON，按错误码重试或返回结构化校验错",
    defaultMaxTokens: (ctx) => ctx.maxTokens ?? 4000,
    modelOptions: (ctx) => ({
      ...(ctx.temperature != null ? { temperature: ctx.temperature } : {}),
      ...(ctx.jsonOnly ? { jsonOnly: true } : {}),
    }),
    join: "",
    blocks: ["card.scan.sys", "card.scan.user"],
  });
}

ensureCardScanPrompt();

export async function callCardModel(
  apiCfg,
  system,
  user,
  { maxTokens = 4000, temperature, jsonOnly = false, callLabel = "角色卡辅助" } = {},
  ai = webAi,
) {
  ensureCardScanPrompt();
  const res = await withAI(
    "card.scan",
    { system, user, maxTokens, temperature, jsonOnly, callLabel },
    { ai, apiCfg },
  );
  return { text: res.text || "", finishReason: res.finishReason };
}

// 每阶段的输出 token 上限。阶段 2 一批 4 人、每人含七维与四档里程碑，
// 实测约 900~1200 token，给 3000 留足余量；阶段 1 只出短字段但条目可能 36 条。
// 阶段 2 每人多了两档里程碑各两句正文（约 16 句/批），比只出短字段时长一截，
// 3000 会顶到截断，给 4500。
// 阶段 1 改成发条目正文后，输入变长、模型也更容易多话，输出上限跟着提。
// 36 条卡每条一行 kind+why 加上分组，实测约 1500~2500，给 6000 留足。
const STAGE_MAX_TOKENS = { 1: 6000, 2: 4500, 3: 1500, 4: 4000 };

/**
 * 取令牌 → 调模型 → 解析。失败按 code 决定是否重试。
 * 重试也要重新取令牌（重试同样消耗真实额度，不能白嫖）。
 */
async function callOnce(callModelFn, cfg, built, opts, ctx) {
  const { onWait, signal } = ctx;
  await acquire(onWait, signal);

  const ai = typeof callModelFn === "function"
    ? { chat: (messages, chatOpts) => callModelFn(chatOpts.cfg, chatOpts.systemPrompt, messages, chatOpts.modelOptions) }
    : webAi;
  const res = await callCardModel(
    cfg,
    built.system,
    built.user,
    {
      maxTokens: STAGE_MAX_TOKENS[built.stage] || 2000,
      temperature: opts.temperature ?? 0.3, // 抽取任务要稳，不要发散
      jsonOnly: !built.plainText,           // apiConfig 的 Gemini 分支据此加 responseMimeType
      callLabel: `导卡阶段${built.stage ?? ""}`,
    },
    ai,
  );

  if (built.plainText) return (res.text || "").trim();
  return parseJsonLoose(res.text);
}

/**
 * 带一次重试的调用。第二次会在提示词末尾追加一句纠正，专治"上次没输出合法 JSON"。
 * 只重试解析类失败；网络类错误交给上层降级——在 5 次/分钟下反复重试网络问题
 * 是在烧额度，不如直接走兜底。
 */
export async function callWithRetry(callModel, cfg, built, opts, ctx) {
  try {
    return await callOnce(callModel, cfg, built, opts, ctx);
  } catch (err) {
    if (err.code === "SCAN_ABORTED") throw err;
    // NOT_JSON 不重试：模型压根没在输出 JSON，再问一遍还是一样，纯烧额度。
    // 只有 TRUNCATED（在输出 JSON 但被截断）和 EMPTY（空回复）值得再试一次。
    if (err.code !== "TRUNCATED" && err.code !== "EMPTY") throw err;
    ctx.onProgress?.({ kind: "retry", stage: built.stage, msg: "上次输出不是合法 JSON，重试一次" });
    const fixed = {
      ...built,
      system: built.system + `\n\n【重要】上一次你的输出无法被解析。这一次务必只输出一个完整的 JSON 对象，`
        + `第一个字符是 {，最后一个字符是 }，中间不要有任何围栏、注释或说明文字。`,
    };
    return await callOnce(callModel, cfg, fixed, opts, ctx);
  }
}


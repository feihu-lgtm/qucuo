// 评测用 Vertex 调用：复用 src/infra/vertexAdc.js 的 ADC 解析、authorized_user 刷新令牌流程与 global 端点，
// 以及 src/infra/providers.js 的短调用设置（关思考、JSON 输出）。额外请求 logprobs；遇 400 逐级降级：
// 去掉 logprobs → 改用 reasoning_effort=none 关思考 → 去掉 response_format。
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import {
  buildVertexEndpoint, createVertexAuth, parseVertexAdc, prepareVertexMessages,
  vertexDefaultProject, vertexReasoningEffort, vertexResponseError,
} from "../../src/infra/vertexAdc.js";
import { applyShortCallOpenAI } from "../../src/infra/providers.js";

const VERTEX = { id: "vertex", thinking: "vertex" };

export function buildVertexEvalBody(modelId, messages, opts = {}) {
  const modelOptions = opts.modelOptions || {};
  const body = {
    model: modelId,
    messages: [...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []), ...prepareVertexMessages(messages)],
    temperature: modelOptions.temperature ?? 0,
    max_tokens: Math.max(1024, modelOptions.maxTokens ?? 1024),
    reasoning_effort: vertexReasoningEffort(modelId, "off"),
  };
  applyShortCallOpenAI(body, VERTEX, { disableThinking: modelOptions.disableThinking ?? true, jsonOnly: modelOptions.jsonOnly ?? true });
  return body;
}

export function vertexFallbacks(body, { logprobs = true, topLogprobs = 5 } = {}) {
  const { extra_body: _extra, ...noExtra } = body;
  const effortNone = body.extra_body ? { ...noExtra, reasoning_effort: "none" } : body;
  const { response_format: _format, ...plain } = effortNone;
  return [
    ...(logprobs ? [{ ...body, logprobs: true, top_logprobs: topLogprobs }] : []),
    body, effortNone, plain,
  ].filter((candidate, index, list) => list.findIndex((other) => JSON.stringify(other) === JSON.stringify(candidate)) === index);
}

export async function createVertexEvalAi({ adcPath, project, location = "global", model, timeoutMs = 60000, logprobs = true }) {
  if (!adcPath) throw new Error("缺少 ADC 文件：传 --adc 或设置 GOOGLE_APPLICATION_CREDENTIALS");
  if (!model) throw new Error("缺少模型：传 --model");
  const adc = parseVertexAdc(await readFile(adcPath, "utf8").catch(() => { throw new Error("无法读取 ADC JSON 文件"); }));
  const endpoint = buildVertexEndpoint(project || vertexDefaultProject(adc), location);
  const getHeaders = createVertexAuth(adc, {
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) }),
    crypto: webcrypto, now: Date.now,
  });
  const modelId = model.includes("/") ? model : `google/${model}`;
  let variant = 0; // 已知可用的最低降级档位，只在请求成功后前移，并发请求互不推进
  async function post(body) {
    const auth = await getHeaders();
    const res = await fetch(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(body),
    });
    return { res, auth };
  }
  return {
    async chat(messages, opts = {}) {
      const candidates = vertexFallbacks(buildVertexEvalBody(modelId, messages, opts), { logprobs, topLogprobs: opts.modelOptions?.topLogprobs });
      for (let current = Math.min(variant, candidates.length - 1); ; ) {
        const { res, auth } = await post(candidates[current]);
        if (res.status === 400 && current < candidates.length - 1) { current++; continue; }
        if (res.ok) variant = Math.max(variant, current);
        if (!res.ok) {
          const error = await vertexResponseError(res, auth.Authorization);
          const retryAfter = Number(res.headers.get("retry-after"));
          throw Object.assign(error, { status: res.status, ...(retryAfter > 0 ? { retryAfterMs: retryAfter * 1000 } : {}) });
        }
        const raw = await res.json();
        const choice = raw.choices?.[0];
        return { text: choice?.message?.content || "", finishReason: choice?.finish_reason ?? null, logprobs: choice?.logprobs || null, usage: raw.usage || null, raw };
      }
    },
  };
}

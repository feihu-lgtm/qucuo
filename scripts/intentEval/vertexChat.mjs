// 评测用 Vertex 调用：复用 src/infra/vertexAdc.js 的 ADC 解析、authorized_user 刷新令牌流程与 global 端点，
// 额外请求 logprobs（Provider 不支持时自动去掉重试，退回模型自报概率）。
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import {
  buildVertexEndpoint, createVertexAuth, parseVertexAdc, prepareVertexMessages,
  vertexDefaultProject, vertexReasoningEffort, vertexResponseError,
} from "../../src/infra/vertexAdc.js";

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
  let useLogprobs = logprobs;
  async function post(body) {
    const auth = await getHeaders();
    return fetch(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    }).then(async (res) => ({ res, auth }));
  }
  return {
    async chat(messages, opts = {}) {
      const modelOptions = opts.modelOptions || {};
      const body = {
        model: modelId,
        messages: [...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []), ...prepareVertexMessages(messages)],
        temperature: modelOptions.temperature ?? 0,
        max_tokens: modelOptions.maxTokens ?? 200,
        reasoning_effort: vertexReasoningEffort(modelId, "off"),
      };
      let { res, auth } = await post(useLogprobs ? { ...body, logprobs: true, top_logprobs: modelOptions.topLogprobs ?? 5 } : body);
      if (useLogprobs && res.status === 400) {
        useLogprobs = false;
        ({ res, auth } = await post(body));
      }
      if (!res.ok) throw await vertexResponseError(res, auth.Authorization);
      const raw = await res.json();
      return { text: raw.choices?.[0]?.message?.content || "", logprobs: raw.choices?.[0]?.logprobs || null, raw };
    },
  };
}

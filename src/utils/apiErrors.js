// 错误分类：把五花八门的原始错误翻成玩家看得懂的话 + 给出处理建议。
// 返回 { kind, icon, title, detail, hint }，供 UI 分级展示。
function redactErrorValue(value, apiKey = "") {
  let text = String(value || "");
  if (apiKey) text = text.split(apiKey).join("[REDACTED]");
  return text
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/(authorization\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/(x-api-key\s*[:=]\s*)[^\s,;"']+/gi, "$1[REDACTED]")
    .replace(/([?&](?:key|api[_-]?key|token)=)[^&\s]*/gi, "$1[REDACTED]");
}

function redactRequestUrl(value, apiKey) {
  if (!value) return "";
  try {
    const url = new URL(value);
    for (const key of ["key", "api_key", "apikey", "token", "access_token"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return redactErrorValue(url.toString(), apiKey);
  } catch {
    return redactErrorValue(value, apiKey);
  }
}

function connectionError(err, apiKey) {
  const msg = redactErrorValue(err?.message || err, apiKey);
  const status = Number(err?.httpStatus) || Number(msg.match(/\bHTTP\s+(\d{3})\b/i)?.[1]);
  const requestUrl = redactRequestUrl(err?.requestUrl, apiKey);
  const result = (code, cause, fix, kind) => ({ code, cause, fix, kind });
  if (err?.code === "html" || /网页而不是数据|text\/html|<!DOCTYPE|<html/i.test(msg)) {
    return result("HTML", "地址填成了网页", "检查接口地址", "endpoint");
  }
  if (status === 400) {
    const vendorMessage = redactErrorValue(err?.vendorMessage || msg, apiKey).slice(0, 80);
    return result("400", `参数被拒${vendorMessage ? `：${vendorMessage}` : ""}`, "检查模型名和请求参数", "parameter");
  }
  if (status === 401 || status === 403) return result(String(status), "Key 无效或没权限", "检查 API Key 与账号权限", "auth");
  if (status === 404) return result("404", "地址或模型名不对", `检查请求地址：${requestUrl || "确认接口地址和模型名"}`, "endpoint");
  if (status === 429) return result("429", "限流或余额不足", "稍后重试或检查账户额度", "quota");
  if (status >= 500 && status <= 599) return result(String(status), "厂商服务出错，稍后再试", "稍后重试", "server");
  if (err?.code === "timeout" || /超过|timeout|timed out/i.test(msg)) {
    const seconds = msg.match(/(?:超过|after)\s*(\d+)/i)?.[1] || "?";
    return result("超时", `${seconds}秒没响应`, "检查网络或延长超时设置", "timeout");
  }
  if (err?.code === "empty") return result("空响应", "接口没返回任何内容", "检查中转站和模型名", "empty");
  if (err?.code === "network" || err instanceof TypeError || /Failed to fetch|NetworkError|ERR_/i.test(msg)) {
    return result("网络", "网络或浏览器被拦", "可能需要 CORS 代理", "network");
  }
  return result("错误", msg.slice(0, 80) || "请求失败", "检查网络和接口配置", "unknown");
}

export function httpStatusOf(err) {
  const msg = String(err?.message || err || "");
  const status = Number(err?.httpStatus) || Number(err?.status) || Number(msg.match(/\bHTTP\s+(\d{3})\b/i)?.[1]);
  return status >= 100 && status <= 599 ? status : null;
}

function httpError(status, msg) {
  const out = (kind, icon, title, hint, retryable) => ({ kind, icon, title, detail: msg, hint, retryable });
  if (status === 400) return out("parameter", "🧾", "请求参数被拒（HTTP 400）", "接口不认这次的请求参数。检查设置里的模型名、最大输出长度等参数是否被该接口支持。", false);
  if (status === 401 || status === 403) return out("auth", "🔑", `密钥/鉴权有误（HTTP ${status}）`, "到设置里核对 API 密钥是否填对、有没有多余空格、是否过期，以及账号有没有这个模型的权限。", false);
  if (status === 404) return out("endpoint", "🧭", "接口地址或模型名不对（HTTP 404）", "接口找不到这个地址或模型。检查设置里的接口地址是否完整、类型是否选对，模型名是否拼写正确。", false);
  if (status === 408) return out("timeout", "⏱", "接口超时（HTTP 408）", "网络慢或模型太忙。可稍等重试，或在设置里换个更快的模型/中转站。", true);
  if (status === 429) {
    if (/insufficient|quota|billing|balance|余额|欠费|额度/i.test(msg)) return out("quota", "💳", "余额/额度不足（HTTP 429）", "账户余额或额度用完了，重试也不会好。去服务商充值/提额，或在设置里换个账号。", false);
    return out("rateLimit", "⏳", "接口限流（HTTP 429）", "请求太密被限流。已按接口要求等待并自动重试过；仍失败就稍等一会儿再试。", true);
  }
  if (status >= 500) return out("server", "🛠", `服务端出错（HTTP ${status}）`, "对方服务器临时故障或过载，稍后重试。", true);
  if (status >= 400) return out("request", "🚫", `请求被接口拒绝（HTTP ${status}）`, "检查设置里的接口地址、模型名和请求参数。", false);
  return null;
}

// retryable=false 的错误（地址/模型名/密钥/参数/额度）原样重发也不会好，不自动重试。
export function classifyError(err, options = {}) {
  const msg = String(err?.message || err || "");
  const code = err?.code;
  const has = (...ks) => ks.some(k => msg.includes(k));
  if (options.connection) {
    const connection = connectionError(err, options.apiKey);
    return { kind: connection.kind, connection };
  }

  if (code === "timeout" || has("超过", "timeout", "timed out")) {
    return { kind: "timeout", icon: "⏱", title: "接口超时", detail: msg, hint: "网络慢或模型太忙。可稍等重试，或在设置里换个更快的模型/中转站。", retryable: true };
  }
  if (code === "html" || has("网页而不是数据", "<!DOCTYPE", "<html")) {
    return { kind: "endpoint", icon: "🧭", title: "接口地址可能填错", detail: msg, hint: "接口返回的是网页不是数据。检查设置里的接口地址是否完整、类型是否选对。", retryable: false };
  }
  const status = httpStatusOf(err);
  const byStatus = status && httpError(status, msg);
  if (byStatus) return byStatus;
  if (code === "empty") {
    return { kind: "empty", icon: "∅", title: "接口返回空响应", detail: msg, hint: "连上了接口，但它没返回任何内容。多为中转站故障；反复出现请换中转站，或检查模型名是否被该接口支持。", retryable: true };
  }
  if (code === "network" || has("Failed to fetch", "NetworkError", "网络请求失败", "ERR_")) {
    return { kind: "network", icon: "🔌", title: "连不上接口", detail: msg, hint: "网络断开或接口不可达。检查网络；若用中转站，确认地址能访问、没被墙。", retryable: true };
  }
  if (has("invalid api key", "authentication", "unauthorized", "密钥", "api key")) {
    return { kind: "auth", icon: "🔑", title: "密钥/鉴权有误", detail: msg, hint: "到设置里核对 API 密钥是否填对、有没有多余空格、是否过期。", retryable: false };
  }
  if (has("rate limit", "Too Many Requests")) {
    return { kind: "rateLimit", icon: "⏳", title: "接口限流", detail: msg, hint: "请求太密被限流。稍等一会儿再试。", retryable: true };
  }
  if (has("quota", "insufficient", "余额", "额度", "billing", "exceeded")) {
    return { kind: "quota", icon: "💳", title: "额度/限流", detail: msg, hint: "触发限流或余额不足。等一会儿再试，或去服务商充值/提额。", retryable: false };
  }
  if (has("无法解析", "HTML")) {
    return { kind: "endpoint", icon: "🧭", title: "接口地址可能填错", detail: msg, hint: "接口返回的不是数据。检查设置里的接口地址是否完整、类型是否选对。", retryable: false };
  }
  if (has("JSON", "parse", "Unexpected token", "解析", "格式", "format is invalid")) {
    return { kind: "format", icon: "📦", title: "返回格式异常", detail: msg, hint: "模型没按要求返回结构化数据。重试一次；常发生可换模型或调低输出长度。", retryable: true };
  }
  if (has("overloaded", "server error", "服务")) {
    return { kind: "server", icon: "🛠", title: "服务端出错", detail: msg, hint: "对方服务器临时故障或过载，稍后重试。", retryable: true };
  }
  return { kind: "unknown", icon: "⚠", title: "出错了", detail: msg, hint: "可重试一次；反复出现请把这条错误发给作者。", retryable: true };
}

export function isRetryableError(err) {
  return classifyError(err).retryable !== false;
}

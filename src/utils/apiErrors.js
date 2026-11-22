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
  if (err?.code === "network" || err instanceof TypeError || /Failed to fetch|NetworkError|ERR_/i.test(msg)) {
    return result("网络", "网络或浏览器被拦", "可能需要 CORS 代理", "network");
  }
  return result("错误", msg.slice(0, 80) || "请求失败", "检查网络和接口配置", "unknown");
}

export function classifyError(err, options = {}) {
  const msg = String(err?.message || err || "");
  const code = err?.code;
  const has = (...ks) => ks.some(k => msg.includes(k));
  if (options.connection) {
    const connection = connectionError(err, options.apiKey);
    return { kind: connection.kind, connection };
  }

  if (code === "timeout" || has("超过", "timeout", "timed out")) {
    return { kind: "timeout", icon: "⏱", title: "接口超时", detail: msg, hint: "网络慢或模型太忙。可稍等重试，或在设置里换个更快的模型/中转站。" };
  }
  if (code === "network" || has("Failed to fetch", "NetworkError", "网络请求失败", "ERR_")) {
    return { kind: "network", icon: "🔌", title: "连不上接口", detail: msg, hint: "检查网络；若用中转站，确认地址能访问、没被墙。" };
  }
  if (has("401", "403", "invalid api key", "authentication", "unauthorized", "密钥", "api key")) {
    return { kind: "auth", icon: "🔑", title: "密钥/鉴权有误", detail: msg, hint: "到设置里核对 API 密钥是否填对、有没有多余空格、是否过期。" };
  }
  if (has("429", "rate limit", "quota", "insufficient", "余额", "额度", "billing", "exceeded")) {
    return { kind: "quota", icon: "💳", title: "额度/限流", detail: msg, hint: "触发限流或余额不足。等一会儿重试，或去服务商充值/提额。" };
  }
  if (has("网页而不是数据", "无法解析", "HTML", "<!DOCTYPE", "<html")) {
    return { kind: "endpoint", icon: "🧭", title: "接口地址可能填错", detail: msg, hint: "接口返回的是网页不是数据。检查设置里的接口地址是否完整、类型是否选对。" };
  }
  if (has("JSON", "parse", "Unexpected token", "解析", "格式")) {
    return { kind: "format", icon: "📦", title: "返回格式异常", detail: msg, hint: "模型没按要求返回结构化数据。重试一次；常发生可换模型或调低输出长度。" };
  }
  if (has("500", "502", "503", "504", "overloaded", "server error", "服务")) {
    return { kind: "server", icon: "🛠", title: "服务端出错", detail: msg, hint: "对方服务器临时故障或过载，稍后重试。" };
  }
  return { kind: "unknown", icon: "⚠", title: "出错了", detail: msg, hint: "可重试一次；反复出现请把这条错误发给作者。" };
}

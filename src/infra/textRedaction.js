const CONFIG_VALUE_KEY = /key$|token|secret|password|authorization|cookie|endpoint|base[-_]?url|proxy/i;

export const BLOCKED_CREDENTIAL = "[已拦截]";
export const ADC_SECRET_KEY = /^(?:private_key|refresh_token|client_secret)$/i;

const CREDENTIAL_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /(?:\\*["'])?\b(?:private_key|refresh_token|client_secret)\b(?:\\*["'])?(?:\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\+"[^"\s,}&]*"|[^\s,}&"']+))?/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(?:ya29\.[A-Za-z0-9._-]+|sk-[A-Za-z0-9._*-]*|1\/\/0[A-Za-z0-9_-]{20,})/g,
  // 上游报错里的密钥别名与截断残片：「Key=qucuo-admin (sk-...)」「x-api-key: …」
  /\b(?:x-api-key|(?:api[_-]?)?key(?:[_-]?(?:alias|name|id))?)\s*[:=]\s*[^\s,;"')]+/gi,
];

export function scrubCredentialPatterns(text, onMatch) {
  for (const pattern of CREDENTIAL_PATTERNS) {
    text = text.replace(pattern, () => {
      onMatch?.();
      return BLOCKED_CREDENTIAL;
    });
  }
  return text;
}

export function collectConfigValues(config) {
  const values = [];
  const seen = new WeakSet();
  const visit = (value, key = "") => {
    if (typeof value === "string") {
      if (CONFIG_VALUE_KEY.test(key) && value.length >= 8 && !/^https?:\/\/$/i.test(value)) values.push(value);
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };
  try { visit(config); } catch { /* a hostile config object is simply not used for redaction */ }
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

export function scrubString(value, configuredValues = []) {
  if (typeof value !== "string") return value;
  let result = value
    .replace(/\bsk-[A-Za-z0-9._*-]*/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "[REDACTED]");
  for (const secret of configuredValues) {
    if (secret) result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

export function setScrubbedProperty(target, key, value, configuredValues = [], scrubKey = scrubString) {
  const base = scrubKey(key, configuredValues);
  let safeKey = base;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(target, safeKey)) {
    safeKey = `${base}#${suffix}`;
    suffix++;
  }
  Object.defineProperty(target, safeKey, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

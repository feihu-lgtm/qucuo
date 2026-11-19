const CONFIG_VALUE_KEY = /key$|token|secret|password|authorization|cookie|endpoint|base[-_]?url|proxy/i;

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
    .replace(/sk-[A-Za-z0-9]{16,}/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "[REDACTED]");
  for (const secret of configuredValues) {
    if (secret) result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

export function setScrubbedProperty(target, key, value, configuredValues = []) {
  const base = scrubString(key, configuredValues);
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

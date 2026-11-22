// Retry-After 头：秒数或 HTTP 日期，换算成毫秒；缺省或无法解析返回 null。
export function parseRetryAfter(value, now = Date.now()) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  const at = Date.parse(text);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

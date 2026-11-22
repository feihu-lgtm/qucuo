// 脏值清洗（从 cardParse.js 拆出，纯搬运）
// keys 连写切分（F14）、宏展开（F15）、装饰器剥离（F18）、词表命中。

// keys 元素内部的分隔符（F14）
const KEY_SPLIT_RE = /[，,、;；\/／|｜]+/;

// keys/正文里的宏（F15）
export const MACRO_RE = /\{\{\s*(user|char)\s*\}\}|<\s*(user|char|bot)\s*>/gi;

// 装饰器行（F18）
const DECORATOR_RE = /^@{2,3}\s*(\S+)(?:\s+(.*))?$/;

/** F14：把 keys 里逗号连写的元素切开，去重去空。返回 {keys, dirty} */
export function splitKeys(rawKeys) {
  const out = [];
  const dirty = [];
  for (const k of (Array.isArray(rawKeys) ? rawKeys : [])) {
    if (typeof k !== "string") continue;
    const t = k.trim();
    if (!t) continue;
    if (KEY_SPLIT_RE.test(t)) {
      dirty.push(t);
      for (const part of t.split(KEY_SPLIT_RE)) {
        const p = part.trim();
        if (p) out.push(p);
      }
    } else {
      out.push(t);
    }
  }
  return { keys: Array.from(new Set(out)), dirty };
}

/** F15/CBS：展开 {{user}} {{char}} <user> <char> <bot>。names 缺省时原样保留。 */
export function expandMacros(text, names = {}) {
  if (typeof text !== "string" || !text) return text || "";
  const user = names.user || "";
  const char = names.char || "";
  return text.replace(MACRO_RE, (m, g1, g2) => {
    const which = (g1 || g2 || "").toLowerCase();
    if (which === "user") return user || m;
    if (which === "char" || which === "bot") return char || m;
    return m;
  });
}

/**
 * F18：剥离 content 开头的装饰器行，连同前后空行。
 * 规范说装饰器必须在进 prompt 前去掉；这里同时把解析出的装饰器回传，
 * 万一以后遇到真用装饰器的卡，@@position / @@role / @@depth 可以接上。
 */
export function stripDecorators(content) {
  if (typeof content !== "string" || !content) return { content: "", decorators: [] };
  const lines = content.split("\n");
  const decorators = [];
  const kept = [];
  let stillHeader = true;
  for (const line of lines) {
    const t = line.trim();
    if (stillHeader && t.startsWith("@@")) {
      const m = t.match(DECORATOR_RE);
      if (m) {
        decorators.push({
          name: m[1].replace(/^@+/, ""),
          value: (m[2] || "").trim(),
          fallback: t.startsWith("@@@"),
        });
        continue;
      }
    }
    if (stillHeader && !t) {
      // 装饰器区里的空行跟着一起吃掉，直到出现正文
      if (decorators.length && kept.length === 0) continue;
    }
    if (t) stillHeader = false;
    kept.push(line);
  }
  return { content: kept.join("\n").trim(), decorators };
}

export function hitAny(text, hints) {
  const low = (text || "").toLowerCase();
  return hints.find(h => low.includes(h.toLowerCase())) || null;
}

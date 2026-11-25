// 跨服务商原生结构化输出（schema）的纯函数底座。
// validateJsonSchema：覆盖扁平/浅嵌套结构的 type/required/enum/additionalProperties:false 校验，
// 供 withAI 在原生 schema 响应回来后过一遍——不合格走原 failOrFallback，不让坏结构漏进下游。
// toGeminiResponseSchema：Gemini v1beta 的 responseSchema 不接受 additionalProperties 键，递归剔除。
// 禁区：本文件严禁引用 infra/（纯函数，零副作用）。

const TYPE_CHECK = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

// 返回 { ok: true } 或 { ok: false, reason }——reason 供日志/兜底定位哪一层哪一键坏了。
export function validateJsonSchema(value, schema, path = "$") {
  if (!schema || typeof schema !== "object") return { ok: true };
  if (schema.enum && !schema.enum.includes(value)) {
    return { ok: false, reason: `${path} 值 ${JSON.stringify(value)} 不在枚举内` };
  }
  if (schema.type) {
    const check = TYPE_CHECK[schema.type];
    if (check && !check(value)) {
      return { ok: false, reason: `${path} 类型应为 ${schema.type}，实为 ${Array.isArray(value) ? "array" : typeof value}` };
    }
  }
  if (schema.type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const key of schema.required || []) {
      if (!(key in value)) return { ok: false, reason: `${path}.${key} 缺必填键` };
    }
    if (schema.additionalProperties === false) {
      const extra = Object.keys(value).filter((k) => !(k in props));
      if (extra.length) return { ok: false, reason: `${path} 多出未声明键 ${extra.join(",")}` };
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) {
        const r = validateJsonSchema(value[key], sub, `${path}.${key}`);
        if (!r.ok) return r;
      }
    }
  }
  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      const r = validateJsonSchema(value[i], schema.items, `${path}[${i}]`);
      if (!r.ok) return r;
    }
  }
  return { ok: true };
}

// Gemini v1beta responseSchema 不接受 additionalProperties 键（无论 true/false），递归剔除。
// 其余键原样保留；不改原对象，返回新对象。
export function toGeminiResponseSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiResponseSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, val] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    out[key] = toGeminiResponseSchema(val);
  }
  return out;
}

import { describe, expect, it } from "vitest";
import { toGeminiResponseSchema, validateJsonSchema } from "./schemaValidate.js";

const INTAKE = {
  type: "object",
  additionalProperties: false,
  required: ["read", "refIds", "actions"],
  properties: {
    read: { type: "string" },
    refIds: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "stance"],
        properties: {
          kind: { type: "string", enum: ["talk", "move", "take"] },
          stance: { type: "string", enum: ["sincere", "clever", "forceful", "casual", "perfunctory"] },
        },
      },
    },
  },
};

describe("validateJsonSchema", () => {
  it("合规值通过", () => {
    const v = { read: "他要买刀", refIds: [], actions: [{ kind: "talk", stance: "sincere" }] };
    expect(validateJsonSchema(v, INTAKE).ok).toBe(true);
  });

  it("缺必填键不通过", () => {
    const v = { read: "x", refIds: [], actions: [{ stance: "sincere" }] };
    const r = validateJsonSchema(v, INTAKE);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("kind");
  });

  it("枚举外值不通过", () => {
    const v = { read: "x", refIds: [], actions: [{ kind: "fly", stance: "sincere" }] };
    expect(validateJsonSchema(v, INTAKE).ok).toBe(false);
  });

  it("多出未声明键不通过（additionalProperties:false）", () => {
    const v = { read: "x", refIds: [], actions: [{ kind: "talk", stance: "sincere", hack: 1 }] };
    const r = validateJsonSchema(v, INTAKE);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("hack");
  });

  it("类型错误不通过", () => {
    const v = { read: 42, refIds: [], actions: [] };
    expect(validateJsonSchema(v, INTAKE).ok).toBe(false);
  });

  it("数组元素类型错误不通过", () => {
    const v = { read: "x", refIds: [1], actions: [] };
    expect(validateJsonSchema(v, INTAKE).ok).toBe(false);
  });

  it("顶层缺 required 不通过", () => {
    expect(validateJsonSchema({ read: "x" }, INTAKE).ok).toBe(false);
  });
});

describe("toGeminiResponseSchema", () => {
  it("递归剔除 additionalProperties，保留其余键", () => {
    const out = toGeminiResponseSchema(INTAKE);
    expect(out.additionalProperties).toBeUndefined();
    expect(out.type).toBe("object");
    expect(out.required).toEqual(["read", "refIds", "actions"]);
    expect(out.properties.actions.items.additionalProperties).toBeUndefined();
    expect(out.properties.actions.items.properties.kind.enum).toContain("talk");
  });

  it("不改原对象", () => {
    toGeminiResponseSchema(INTAKE);
    expect(INTAKE.additionalProperties).toBe(false);
  });
});

describe("validateJsonSchema union type（WO-03 补）", () => {
  it('type:["string","null"] 两种值都过，其他类型不过', () => {
    const schema = { type: ["string", "null"], enum: ["k1", null] };
    expect(validateJsonSchema("k1", schema).ok).toBe(true);
    expect(validateJsonSchema(null, schema).ok).toBe(true);
    expect(validateJsonSchema(42, schema).ok).toBe(false);
  });

  it("union 命中其一即过，枚举仍生效", () => {
    const schema = { type: ["string", "null"] };
    expect(validateJsonSchema("abc", schema).ok).toBe(true);
    expect(validateJsonSchema(null, schema).ok).toBe(true);
    expect(validateJsonSchema(false, schema).ok).toBe(false);
  });
});

describe("toGeminiResponseSchema union 转写", () => {
  it('type:["string","null"] 转 string + nullable:true', () => {
    const out = toGeminiResponseSchema({ type: ["string", "null"], enum: ["a", null] });
    expect(out.type).toBe("string");
    expect(out.nullable).toBe(true);
    expect(Array.isArray(out.type)).toBe(false);
  });

  it("不含 null 的 union 不误标 nullable", () => {
    const out = toGeminiResponseSchema({ type: ["string", "number"] });
    expect(out.type).toBe("string");
    expect(out.nullable).toBeUndefined();
  });

  it("普通 type 不受影响", () => {
    const out = toGeminiResponseSchema({ type: "object", properties: { x: { type: "number" } } });
    expect(out.type).toBe("object");
    expect(out.nullable).toBeUndefined();
    expect(out.properties.x.type).toBe("number");
  });
});

import { describe, expect, it } from "vitest";
import { INTAKE_JSON_SCHEMA } from "./intakeSchema.js";
import { validateJsonSchema } from "../../../utils/schemaValidate.js";

describe("INTAKE_JSON_SCHEMA（契约 B 冻结形状）", () => {
  const valid = {
    read: "玩家要把酒送给才旦",
    refIds: ["P18_2"],
    actions: [{
      kind: "give", target: "才旦", item: "霜牙短刀", itemId: "it_8f3a", direction: "none",
      condition: "无", condition_text: "", stance: "sincere",
      outcome: "无", risk: "无", confidence: 0.9, text: "把酒送给才旦",
    }],
    proposals: [{ claim: "桌上有本剑谱", kind: "find_item", fit: "stretch", questId: "", flag: "" }],
  };

  it("合法听意单通过本地校验", () => {
    expect(validateJsonSchema(valid, INTAKE_JSON_SCHEMA.schema).ok).toBe(true);
  });

  it("read 必须最前必填；缺 read 拒收", () => {
    const noRead = { ...valid };
    delete noRead.read;
    expect(validateJsonSchema(noRead, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
    expect(Object.keys(INTAKE_JSON_SCHEMA.schema.properties)[0]).toBe("read");
  });

  it("actions/proposals 为封闭对象：多键、错枚举、缺键都拒收", () => {
    const extra = JSON.parse(JSON.stringify(valid));
    extra.actions[0].speed = "fast";
    expect(validateJsonSchema(extra, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
    const badKind = JSON.parse(JSON.stringify(valid));
    badKind.actions[0].kind = "fly";
    expect(validateJsonSchema(badKind, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
    const badFit = JSON.parse(JSON.stringify(valid));
    badFit.proposals[0].fit = "perfect";
    expect(validateJsonSchema(badFit, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
    const missing = JSON.parse(JSON.stringify(valid));
    delete missing.actions[0].stance;
    expect(validateJsonSchema(missing, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
  });

  it("kind/direction/stance/fit 枚举与契约一字不差", () => {
    const actionProps = INTAKE_JSON_SCHEMA.schema.properties.actions.items.properties;
    expect(actionProps.kind.enum).toEqual(["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"]);
    expect(actionProps.direction.enum).toEqual(["n", "s", "e", "w", "none"]);
    expect(actionProps.stance.enum).toEqual(["sincere", "clever", "forceful", "casual", "perfunctory"]);
    expect(INTAKE_JSON_SCHEMA.schema.properties.proposals.items.properties.fit.enum).toEqual(["natural", "stretch", "absurd"]);
    // B1：kind 枚举经派工核准扩展 quest_advance（任务推进提议），并允许可选 questId/flag
    expect(INTAKE_JSON_SCHEMA.schema.properties.proposals.items.properties.kind.enum).toEqual(["find_item", "secret_clue", "social_deal", "environment_use", "quest_advance"]);
    // WO-16G：outcome/risk/condition 枚举与 roadmap 一字不差
    expect(actionProps.outcome.enum).toEqual(["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"]);
    expect(actionProps.risk.enum).toEqual(["无", "低", "中", "高"]);
    expect(actionProps.condition.enum).toEqual(["无", "遇敌", "到达", "被拒", "其他"]);
  });

  it("WO-16G：actions 12 字段全 required，禁联合类型", () => {
    const item = INTAKE_JSON_SCHEMA.schema.properties.actions.items;
    expect(item.required).toEqual(["kind", "target", "item", "itemId", "direction", "condition", "condition_text", "stance", "outcome", "risk", "confidence", "text"]);
    for (const key of item.required) expect(key in item.properties).toBe(true);
    for (const sub of Object.values(item.properties)) expect(Array.isArray(sub.type)).toBe(false);
    expect(item.properties.confidence.type).toBe("number");
  });

  it("B1 quest_advance：questId/flag 必填（strict 全 required）；空串合法，缺键/自编键拒收", () => {
    const qa = JSON.parse(JSON.stringify(valid));
    qa.proposals[0] = { claim: "说动了老孙", kind: "quest_advance", fit: "natural", questId: "q_test", flag: "q_test_open" };
    expect(validateJsonSchema(qa, INTAKE_JSON_SCHEMA.schema).ok).toBe(true);
    // 缺 questId/flag 违反 strict 全 required——OpenAI 通道会整 schema 拒收，本地同口径
    const missingQid = JSON.parse(JSON.stringify(valid));
    delete missingQid.proposals[0].questId;
    expect(validateJsonSchema(missingQid, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
    const bogus = JSON.parse(JSON.stringify(qa));
    bogus.proposals[0].stageIndex = 3;
    expect(validateJsonSchema(bogus, INTAKE_JSON_SCHEMA.schema).ok).toBe(false);
  });
});

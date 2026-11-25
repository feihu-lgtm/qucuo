import { describe, expect, it } from "vitest";
import { INTAKE_JSON_SCHEMA } from "./intakeSchema.js";
import { validateJsonSchema } from "../../../utils/schemaValidate.js";

describe("INTAKE_JSON_SCHEMA（契约 B 冻结形状）", () => {
  const valid = {
    read: "玩家要把酒送给才旦",
    refIds: ["P18_2"],
    actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "sincere" }],
    proposals: [{ claim: "桌上有本剑谱", kind: "find_item", fit: "stretch" }],
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
    expect(INTAKE_JSON_SCHEMA.schema.properties.proposals.items.properties.kind.enum).toEqual(["find_item", "secret_clue", "social_deal", "environment_use"]);
  });
});

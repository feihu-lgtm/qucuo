import { describe, expect, it } from "vitest";
import { buildIntakeUserContent, normalizeIntakeResult } from "./intakeTurn.js";
import { getPromptDef } from "../../domain/rules/prompt/registry.js";
import { INTAKE_JSON_SCHEMA } from "../../domain/rules/judge/intakeSchema.js";

describe("turn.intake 注册", () => {
  it("call 定义存在：light 路由、512 maxTokens、关思考、挂契约 B schema", () => {
    const call = getPromptDef("call", "turn.intake");
    expect(call).toBeTruthy();
    expect(call.route).toBe("light");
    expect(call.defaultMaxTokens).toBe(512);
    expect(call.schema).toBe(INTAKE_JSON_SCHEMA);
    expect(call.cfg(null, { cfg: { thinkingMode: "auto" } }).thinkingMode).toBe("off");
  });
});

describe("buildIntakeUserContent 现场喂料", () => {
  it("含玩家原话、最近两轮、在场角色随身物 ID、场记板条目头", () => {
    const text = buildIntakeUserContent({
      playerInput: "把那把刀送给才旦",
      recentTurns: [
        { user: "更早前", engine: "不应出现这条" },
        { user: "环顾四周", engine: "茶馆里坐着才旦。" },
        { user: "坐下", engine: "你坐了下来。" },
      ],
      npcs: [{ name: "才旦", carriedItems: [{ id: "it_8f3a", name: "霜牙短刀" }, { id: "it_x", name: "已偷", stolen: true }] }],
      entries: [{ id: "P18_2", publicText: "呼延雪将断念剑拍在石桌上" }],
    });
    expect(text).toContain("把那把刀送给才旦");
    expect(text).toContain("坐下");
    expect(text).not.toContain("更早前");
    expect(text).toContain("才旦");
    expect(text).toContain("霜牙短刀(it_8f3a)");
    expect(text).not.toContain("已偷");
    expect(text).toContain("【P18_2】");
    expect(text).toContain("呼延雪将断念剑拍在石桌上");
  });

  it("空输入不崩，占位段落不硬塞", () => {
    const text = buildIntakeUserContent({ playerInput: "看看" });
    expect(text).toContain("看看");
    expect(text).not.toContain("最近两轮");
    expect(text).not.toContain("在场角色");
  });
});

describe("normalizeIntakeResult 本地复核", () => {
  const valid = {
    read: "送刀", refIds: [],
    actions: [{ kind: "give", target: "才旦", itemId: "it_8f3a", direction: "none", stance: "casual" }],
    proposals: [],
  };

  it("合形制的原样返回", () => {
    expect(normalizeIntakeResult(valid)).toBe(valid);
  });

  it("不合形制降级为空听意单（degraded 标记）", () => {
    const bad = { read: "x", refIds: [], actions: [{ kind: "fly" }], proposals: [] };
    const out = normalizeIntakeResult(bad);
    expect(out.degraded).toBe(true);
    expect(out.actions).toEqual([]);
    expect(normalizeIntakeResult(null).degraded).toBe(true);
  });
});

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
  const fullAction = {
    kind: "give", target: "才旦", item: "霜牙短刀", itemId: "it_8f3a", direction: "none",
    condition: "无", condition_text: "", stance: "casual",
    outcome: "无", risk: "无", confidence: 0.9, text: "送刀",
  };
  const valid = {
    read: "送刀", refIds: [],
    actions: [{ ...fullAction }],
    proposals: [],
  };

  it("合形制的逐字透传（内容深相等）", () => {
    expect(normalizeIntakeResult(valid)).toEqual(valid);
  });

  it("WO-16G 修复式复核：多填字段剥掉、缺省键补默认值，不整单报废", () => {
    // 多填未声明键——剥掉后不失败
    const extra = JSON.parse(JSON.stringify(valid));
    extra.actions[0].speed = "fast";
    extra.noise = 1;
    const out1 = normalizeIntakeResult(extra);
    expect(out1.degraded).toBeUndefined();
    expect(out1.actions[0].speed).toBeUndefined();
    expect(out1.noise).toBeUndefined();
    // 漏填新字段——补缺省值后通过
    const sparse = { read: "x", refIds: [], actions: [{ kind: "give", target: "才旦" }], proposals: [] };
    const out2 = normalizeIntakeResult(sparse);
    expect(out2.degraded).toBeUndefined();
    expect(out2.actions[0].outcome).toBe("无");
    expect(out2.actions[0].risk).toBe("无");
    expect(out2.actions[0].confidence).toBe(0);
    expect(out2.actions[0].item).toBe("无");
  });

  it("枚举非法修不好才降级为空听意单（degraded 标记）", () => {
    const bad = { read: "x", refIds: [], actions: [{ kind: "fly" }], proposals: [] };
    const out = normalizeIntakeResult(bad);
    expect(out.degraded).toBe(true);
    expect(out.actions).toEqual([]);
    expect(normalizeIntakeResult(null).degraded).toBe(true);
  });
});

describe("buildIntakeUserContent WO-16G 喂料", () => {
  it("拆句 hints/可用出口/四张物件清单统一 名字(编号)，不喂银两", () => {
    const text = buildIntakeUserContent({
      playerInput: "先看看四周，然后把刀送给才旦",
      npcs: [],
      inv: [
        { id: "it_g1", name: "青稞酒", category: "misc", consumable: { energyRestore: 1 } },
        { id: "it_g2", name: "霜牙短刀", category: "weapon" },
        { id: "it_g3", name: "铁护甲", category: "armor", equipped: true },
      ],
      room: { name: "鱼定村", items: [{ id: "it_p1", name: "遗落的皮靴" }] },
      innerRoomName: null,
    });
    // 拆句 hints：复合句切段
    expect(text).toContain("[拆句提示]");
    expect(text).toContain("「先看看四周」");
    // 物件清单
    expect(text).toContain("· 赠予：");
    expect(text).toContain("霜牙短刀(it_g2)");
    expect(text).toContain("· 使用：");
    expect(text).toContain("青稞酒(it_g1)");
    expect(text).toContain("· 拾取：");
    expect(text).toContain("遗落的皮靴(it_p1)");
    expect(text).toContain("· 穿戴卸下：");
    expect(text).toContain("铁护甲(it_g3)〔已装备〕");
    // 已装备物件不进赠予清单
    expect(text.split("· 赠予：")[1].split("\n")[0]).not.toContain("铁护甲");
    // 不喂银两
    expect(text).not.toContain("银两");
  });

  it("可用出口经 visibleInnerExits 锁/内层过滤", () => {
    // 鱼定村真实内层地图——无内层时出口为空不崩
    const text = buildIntakeUserContent({
      playerInput: "走",
      room: { name: "鱼定村", items: [] },
      innerRoomName: "鱼定村广场",
      questProgress: {}, flags: [], inv: [], char: {}, varTree: {},
    });
    expect(text).toContain("[可用出口]");
  });
});

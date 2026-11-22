import { describe, it, expect } from "vitest";
import {
  ACTION_VIEWS, KIND_META,
  STATIC_TEXT_KEYS, blocksForAction, schemaKeyFor,
  giftSettleLawExample, giftNarrativeLawExample, giftExtractionSpecExample,
} from "./injectionBlocks.js";
import * as enginePrompts from "./enginePrompts.js";

// 本文件钉住 injectionBlocks.js（预设面板的"注入结构"数据源）与 buildSysBase
// 真实开关的一致性契约——面板的亮灭判据抄自装配层，两边漂移是最隐蔽的坏法。

const ids = (blocks) => blocks.map(b => b.id);
const byId = (blocks, id) => blocks.find(b => b.id === id);

describe("blocksForAction：单调用（single）各动作分类的亮灭", () => {
  it("combat 全量注入：物件志亮；explore/meta 无拾取判定灭灯", () => {
    // 契约：catalog 绿灯只对"本轮可能发物"亮——战斗常亮，探索/元问题灭。
    expect(byId(blocksForAction("combat"), "catalog").lit).toBe(true);
    for (const id of ["explore", "meta"]) {
      const cat = byId(blocksForAction(id), "catalog");
      expect(cat.lit).toBe(false);
      expect(cat.off).toContain("灭灯");
    }
  });

  it("move/settle：认知隔离与在场人设都灭灯", () => {
    // 契约：scope=move/settle 时 isolation、npc_lore 两块带原因灭灯。
    for (const view of ["move", "settle"]) {
      const blocks = blocksForAction(view);
      expect(byId(blocks, "isolation").lit).toBe(false);
      expect(byId(blocks, "npc_lore").lit).toBe(false);
    }
  });

  it("talk 分类用 talk 路块表（带 mode_note，不带物件志）", () => {
    // 契约：isTalk 的 view 走 INJECTION_PATHS.talk——有 modeNote 没有 catalog 块。
    const blocks = blocksForAction("talk");
    expect(byId(blocks, "mode_note")).toBeTruthy();
    expect(byId(blocks, "catalog")).toBeUndefined();
  });

  it("送礼场景：gift_settle_law 插到 schema 块之前", () => {
    // 契约：单调用送礼把铁律从 schema 里单独拆块展示，位置紧贴 schema 前。
    const blocks = blocksForAction("gift");
    const law = byId(blocks, "gift_settle_law");
    expect(law).toBeTruthy();
    expect(ids(blocks).indexOf("gift_settle_law")).toBe(ids(blocks).indexOf("schema") - 1);
  });

  it("创造模式：物件志强制亮（要能凭空发物）", () => {
    // 契约：gm 覆盖 catalog 灭灯规则。
    expect(byId(blocksForAction("gm"), "catalog").lit).toBe(true);
  });
});

describe("blocksForAction：双调用（dual）结构不同", () => {
  it("双调用砍掉 schema/isolation 两块，末尾追加提取层调用块", () => {
    // 契约：双调用主叙事不产 JSON/MVU——不是"灭灯"，是这两块结构上不存在。
    const blocks = blocksForAction("combat", "dual");
    expect(byId(blocks, "schema")).toBeUndefined();
    expect(byId(blocks, "isolation")).toBeUndefined();
    expect(blocks.at(-1).id).toBe("extraction_call");
    expect(byId(blocks, "catalog").lit).toBe(false);
  });

  it("双调用送礼：追加 gift_narrative_law + 提取层说明指向 GIFT 专属 spec", () => {
    // 契约：送礼在双调用下好感判定在提取层，面板要把这一步讲清楚。
    const blocks = blocksForAction("gift", "dual");
    expect(byId(blocks, "gift_narrative_law")).toBeTruthy();
    expect(byId(blocks, "extraction_call").summary).toContain('settleKind:"gift"');
  });

  it("whisper 分类：全部点亮，不走 act/talk 结构", () => {
    // 契约：旁白私聊是独立 sys，所有块 lit 且无灭灯原因。
    const blocks = blocksForAction("whisper");
    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks.every(b => b.lit && b.off === "")).toBe(true);
  });
});

describe("数据自洽", () => {
  it("所有 INJECTION_PATHS 块用到的 kind 都在 KIND_META 里有展示标签", () => {
    // 契约：kind → 颜色/标签的映射必须覆盖全部块，否则面板渲染空标签。
    // INJECTION_PATHS 未导出，经 blocksForAction 把所有视图+两种模式都走一遍。
    const kinds = new Set();
    for (const v of ACTION_VIEWS) {
      for (const b of blocksForAction(v.id)) kinds.add(b.kind);
      for (const b of blocksForAction(v.id, "dual")) kinds.add(b.kind);
    }
    for (const k of kinds) expect(KIND_META[k], `kind ${k} 缺 KIND_META`).toBeTruthy();
  });

  it("STATIC_TEXT_KEYS 指向的常量都在 enginePrompts 真实导出", () => {
    // 契约：静态块"看原文"按钮引用的键必须真实存在，否则面板拿到 undefined。
    for (const [blockId, key] of Object.entries(STATIC_TEXT_KEYS)) {
      expect(enginePrompts[key], `${blockId} → ${key} 不存在`).toBeTruthy();
    }
  });

  it("ACTION_VIEWS 的 id 不重名，blocksForAction 未知 id 回落到第一档", () => {
    // 契约：动作分类 id 唯一；非法 id 静默回退 look 视图。
    expect(new Set(ACTION_VIEWS.map(v => v.id)).size).toBe(ACTION_VIEWS.length);
    expect(ids(blocksForAction("不存在的动作"))).toEqual(ids(blocksForAction("look")));
  });

  it("schemaKeyFor：settle→SETTLE、move→MOVE、其余→FULL", () => {
    // 契约：schema 块原文按动作 scope 选三份之一。
    expect(schemaKeyFor(ACTION_VIEWS.find(v => v.id === "settle"))).toBe("SCHEMA_SETTLE");
    expect(schemaKeyFor(ACTION_VIEWS.find(v => v.id === "move"))).toBe("SCHEMA_MOVE");
    expect(schemaKeyFor(ACTION_VIEWS.find(v => v.id === "combat"))).toBe("SCHEMA_FULL");
  });
});

describe("送礼三段示例文本", () => {
  it("settle 版：演示 MVU 必须正向、幅度区间与示例指令", () => {
    // 契约：giftSettleLawExample 与 buildSysBase isSettle 分支同构（品阶/幅度/_.add）。
    const t = giftSettleLawExample();
    expect(t).toContain("必须是正向增量");
    expect(t).toContain("+4~+6");
    expect(t).toContain("_.add('角色.才旦.好感度', 5)");
  });

  it("叙事版：演示必写欣然收下，并声明不产 MVU", () => {
    // 契约：giftNarrativeLawExample 对应 narrativeOnly 分支，只管文风。
    const t = giftNarrativeLawExample();
    expect(t).toContain("欣然收下");
    expect(t).toContain("本身不产生MVU");
  });

  it("提取版：演示好感只能上升与 mvu JSON 形状", () => {
    // 契约：giftExtractionSpecExample 与 EXTRACTION_SPECS.GIFT 模板同构。
    const t = giftExtractionSpecExample();
    expect(t).toContain("只能上升、不得为 0 或负数");
    expect(t).toContain('"mvu":"_.add(');
  });
});

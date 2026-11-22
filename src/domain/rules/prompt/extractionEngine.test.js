import { describe, it, expect, vi } from "vitest";
import {
  buildExtractionCfg, normalizeExtractedFields,
} from "./extractionEngine.js";
import { callExtraction } from "../../../engine/ports/extraction.js";

// 本文件钉住提取层引擎的行为契约：spec 路由、模型选择优先级、字段规整、
// 解析失败兜底。黄金快照（modelPromptSnapshots）已覆盖各 spec 的 prompt 内容，
// 这里只补"路由与容错"这部分没被钉住的行为。

const apiCfg = {
  apiType: "openai",
  model: "main-model",
  extractionModel: "extract-model",
  extractionModels: { TALK_CASUAL: "talk-model" },
  callTokenLimits: { extraction: 1200 },
};
const state = { char: { name: "少侠", hp: [80, 100], money: 10 }, room: { name: "鱼定村", exits: ["n"], npcs: [] }, inv: [] };
const echoAi = (text) => ({ chat: vi.fn(async () => ({ text })) });
const lastCall = (ai) => ai.chat.mock.calls[0];

describe("normalizeExtractedFields 公共字段规整", () => {
  it("memory 非字符串强转 String，空串/空白直接删掉", () => {
    // 契约：下游一律 if(p.memory) 判断——对象数字转字符串，空值删除不留空串。
    expect(normalizeExtractedFields({ memory: 42 }).memory).toBe("42");
    expect(normalizeExtractedFields({ memory: { a: 1 } }).memory).toBe("[object Object]");
    expect(normalizeExtractedFields({ memory: "   " })).not.toHaveProperty("memory");
    expect(normalizeExtractedFields({ memory: "" })).not.toHaveProperty("memory");
  });

  it("mentionedNewNpcs：字符串按顿逗号拆开、去重去空，空结果删除字段", () => {
    // 契约：小模型可能吐 "甲、乙" 这种串——统一规整成干净的 string[]。
    expect(normalizeExtractedFields({ mentionedNewNpcs: "阿福、老猎户, 阿福" }).mentionedNewNpcs).toEqual(["阿福", "老猎户"]);
    expect(normalizeExtractedFields({ mentionedNewNpcs: ["阿福", "", "阿福"] }).mentionedNewNpcs).toEqual(["阿福"]);
    expect(normalizeExtractedFields({ mentionedNewNpcs: "  " })).not.toHaveProperty("mentionedNewNpcs");
    expect(normalizeExtractedFields({ mentionedNewNpcs: [] })).not.toHaveProperty("mentionedNewNpcs");
  });

  it("非对象输入原样透传，不炸", () => {
    // 契约：null/字符串等脏输入直接返回，规整只对对象生效。
    expect(normalizeExtractedFields(null)).toBeNull();
    expect(normalizeExtractedFields("junk")).toBe("junk");
  });
});

describe("buildExtractionCfg 模型选择优先级", () => {
  it("意图专属 > 默认提取模型 > 主模型；thinkingMode 关，maxTokens 取限额", () => {
    // 契约：extractionModels[code] 优先，其次 extractionModel，最后主模型。
    expect(buildExtractionCfg("TALK_CASUAL", apiCfg).model).toBe("talk-model");
    expect(buildExtractionCfg("LOOK", apiCfg).model).toBe("extract-model");
    expect(buildExtractionCfg("LOOK", { ...apiCfg, extractionModel: undefined }).model).toBe("main-model");
    const cfg = buildExtractionCfg("LOOK", apiCfg);
    expect(cfg.thinkingMode).toBe("off");
    expect(cfg.maxTokens).toBe(1200);
    expect(buildExtractionCfg("LOOK", { ...apiCfg, callTokenLimits: {} }).maxTokens).toBe(2000);
  });

  it("vertex 渠道写 vertexModel 字段而非 model", () => {
    // 契约：apiModelField 按 apiType 选字段名，vertex 配置不能写错字段。
    const cfg = buildExtractionCfg("LOOK", { apiType: "vertex", vertexModel: "v-main", extractionModel: "v-extract" });
    expect(cfg.vertexModel).toBe("v-extract");
    expect(cfg.model).toBeUndefined();
  });
});

describe("callExtraction 的 spec 路由与兜底", () => {
  it("未注册的 intentCode 回落到 UNKNOWN 通用 spec", () => {
    // 契约：EXTRACTION_SPECS 查不到 key 时用 UNKNOWN，不是报错或裸奔。
    const ai = echoAi("{}");
    return callExtraction("NOT_A_REAL_INTENT", "叙事", state, apiCfg, null, ai).then(() => {
      expect(lastCall(ai)[1].systemPrompt).toContain("从叙事中提取所有发生变化的游戏状态");
    });
  });

  it("settleKind 在映射表但没有 settleNpc → 不生效，仍走意图 spec", () => {
    // 契约：专属 spec 的前提是"这轮牵涉具体 NPC"；只给 kind 不给人，按意图走。
    const ai = echoAi("{}");
    return callExtraction("TALK_CASUAL", "叙事", state, apiCfg, { settleKind: "gift" }, ai).then(() => {
      expect(lastCall(ai)[1].systemPrompt).toContain("提取 NPC 互动产生的状态变化");
    });
  });

  it("settleNpc+未知 settleKind → 专属路由落空，回落意图 spec", () => {
    // 契约：SETTLE_KIND_SPECS 查不到的 kind 不硬切，回落当轮意图。
    const ai = echoAi("{}");
    return callExtraction("TALK_CASUAL", "叙事", state, apiCfg, { settleKind: "hire", settleNpc: "温掌柜" }, ai).then(() => {
      expect(lastCall(ai)[1].systemPrompt).toContain("提取 NPC 互动产生的状态变化");
    });
  });

  it("settleNpc+gift → 命中 GIFT 专属 spec", () => {
    // 契约：送礼带 NPC 时切到送礼专用提取（钉死好感只能上升那份）。
    const ai = echoAi("{}");
    return callExtraction("TALK_CASUAL", "叙事", state, apiCfg, {
      settleKind: "gift", settleNpc: "才旦", giftInfo: { itemName: "青布", quality: "白" },
    }, ai).then(() => {
      expect(lastCall(ai)[1].systemPrompt).toContain("专门处理送礼场景");
    });
  });

  it("META_QUERY 返回 null 且不发起调用（无状态可提）", async () => {
    // 契约：spec 为 null 的意图短路返回 null，不浪费一次 AI 调用。
    const ai = echoAi("{}");
    await expect(callExtraction("META_QUERY", "叙事", state, apiCfg, null, ai)).resolves.toBeNull();
    expect(ai.chat).not.toHaveBeenCalled();
  });
});

describe("callExtraction 的解析与兜底", () => {
  it("返回内容不是 JSON → parseFailed 亮，p 为空对象", async () => {
    // 契约：提取模型吐脏文本（截断/跑题）时如实上报，调用方据此提示"状态未更新"。
    const ai = echoAi("我完全没法按格式回答这个问题！");
    const r = await callExtraction("LOOK", "叙事", state, apiCfg, null, ai);
    expect(r.parseFailed).toBe(true);
    expect(r.p).toEqual({});
    expect(r.mvuCommands).toEqual([]);
  });

  it("```json 包裹与前后杂质会被剥掉再解析", async () => {
    // 契约：markdown 代码围栏和散文前缀不挡解析（取首个 { 到末个 }）。
    const ai = echoAi("好的，这是结果：\n```json\n{\"memory\":\"少侠在村口歇脚。\"}\n```\n以上。");
    const r = await callExtraction("LOOK", "叙事", state, apiCfg, null, ai);
    expect(r.parseFailed).toBeFalsy();
    expect(r.p.memory).toBe("少侠在村口歇脚。");
  });

  it("mvu 字符串字段被解析成指令数组并从 p 里摘除", async () => {
    // 契约：p.mvu 复用 extractMvuBlock 解析——进 mvuCommands，不留给状态应用层。
    const ai = echoAi('{"mvu":"_.add(\'角色.才旦.好感度\', 3);","delta":{"flags_add":[]}}');
    const r = await callExtraction("TALK_CASUAL", "叙事", state, apiCfg, null, ai);
    expect(r.mvuCommands).toEqual([{ op: "add", path: "角色.才旦.好感度", value: 3 }]);
    expect(r.p).not.toHaveProperty("mvu");
    expect(r.p.delta).toEqual({ flags_add: [] });
  });

  it("duel_invite 之外、settleNpc+settleKind 也会带 settleOpts 上下文进 user 模板", async () => {
    // 契约：user prompt 由 renderExtractionSpec 按 settleOpts 渲染（GIFT 要拿到 giftInfo）。
    const ai = echoAi("{}");
    await callExtraction("TALK_CASUAL", "叙事", state, apiCfg, {
      settleKind: "gift", settleNpc: "才旦",
      giftInfo: { itemName: "青布", quality: "白", range: [2, 4] },
    }, ai);
    const user = lastCall(ai)[0][0].content;
    expect(user).toContain("才旦刚收到玩家赠送的礼物：「青布」");
    expect(user).toContain("+2~+4");
  });
});

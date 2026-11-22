import { beforeEach, describe, expect, it, vi } from "vitest";
import { definePrompt, resetPromptRegistryForTest } from "../../domain/rules/prompt/registry.js";
import { registerSideCalls } from "../../domain/rules/prompt/calls/sideCalls.js";
import { createMockAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import { buildDaySummaryRequest } from "../../domain/rules/memory/daySummary.js";
import { factSummaryRequest } from "../../domain/rules/prompt/knowledge.js";
import { buildOutfitRequest } from "../../domain/rules/character/bodyProfile.js";
import { ITEM_CATEGORY } from "../../domain/rules/economy/equipment.js";
import { effectBrief } from "../../domain/rules/economy/itemEffectText.js";
import { buildSquarePrompt } from "../../domain/rules/map/mapSquares.js";
import { buildExtractionCfg } from "../../domain/rules/prompt/extractionEngine.js";
import { registerHookCalls } from "./hookCalls.js";

describe("hookCalls parity with legacy requests", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
    registerSideCalls();
    registerHookCalls();
  });

  it("day.summary matches buildDaySummaryRequest and legacy options", async () => {
    const dayLabel = "第3日";
    const materialLines = ["辰时在茶摊遇才旦。", "申时往雪岭采药未果。"];
    const expected = buildDaySummaryRequest(dayLabel, materialLines);

    for (const apiCfg of [{ model: "m1" }, { model: "m1", callTokenLimits: { daySummary: 3200 } }]) {
      const onRequest = vi.fn();
      const ai = createMockAi(["当日日志。"], { onRequest });

      const res = await withAI("day.summary", { dayLabel, materialLines }, { ai, apiCfg });

      expect(res.ok).toBe(true);
      expect(res.text).toBe("当日日志。");
      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expected.system);
      expect(messages).toEqual(expected.messages);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.daySummary ?? 2000,
        callLabel: "日总结",
      });
    }
  });

  it("fact.summary matches factSummaryRequest and legacy options", async () => {
    const cue = "切磋胜过扎西，得其赠银十两";
    const expected = factSummaryRequest(cue);

    for (const apiCfg of [{ model: "m1" }, { model: "m1", callTokenLimits: { knowledge: 256 } }]) {
      const onRequest = vi.fn();
      const ai = createMockAi(["切磋胜扎西得赠十两。"], { onRequest });

      await withAI("fact.summary", { cue }, { ai, apiCfg });

      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expected.system);
      expect(messages).toEqual(expected.messages);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.knowledge ?? expected.maxTokens,
        callLabel: "事实摘要",
      });
    }
  });

  it("outfit.advice matches buildOutfitRequest and legacy options", async () => {
    const profile = { height: "七尺出头", build: "精瘦灵便", clothing: "青布短打" };
    const pool = [
      { name: "青霜剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", desc: "剑身修长轻灵。" },
      { name: "牦牛皮甲", category: ITEM_CATEGORY.ARMOR, quality: "绿", desc: "高原熟皮所制，御寒护胸。" },
      { name: "松石念珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", desc: "色泽温润，常伴行脚之人。" },
    ];
    const expected = buildOutfitRequest(profile, pool);

    for (const apiCfg of [{ model: "m1" }, { model: "m1", callTokenLimits: { inspect: 2500 } }]) {
      const onRequest = vi.fn();
      const ai = createMockAi(['{"picks":[]}'], { onRequest });

      await withAI("outfit.advice", { profile, pool }, { ai, apiCfg });

      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expected.system);
      expect(messages).toEqual([{ role: "user", content: expected.user }]);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000,
        callLabel: "按体貌荐装",
      });
    }
  });

  it("inspect.describe matches legacy inspect prompt, stats and turn option", async () => {
    const KIND_LABEL = { skill: "武学", item: "物品", pigeon: "信鸽" };
    const KIND_NOUN = { skill: "武学功法", item: "随身物品", pigeon: "信鸽（用于飞鸽传书的鸟）" };
    const buildLegacyInspect = (kind, name, extra, itemObj) => {
      const kindLabel = KIND_LABEL[kind] || "物品";
      const kindNoun = KIND_NOUN[kind] || "随身物品";
      const sys = `你是曲措乡这个武侠世界的说书人，现在玩家想仔细端详一件${kindNoun}。
用 3-5 句话、章回说书人口吻描述这个${kindLabel}的来历、外观或效用，符合当前世界观（澜湄雪域、曲措乡）。不需要 JSON，不需要更新任何状态，纯文本即可。
如果给出了品质和数值信息，请在描述里自然地体现这个品阶应有的分量感（品质越高描述越有气势），但不要机械地报数字。`;
      let prompt = kind === "skill"
        ? `功法名称：${name}${extra ? `，当前修炼进度：${extra}` : ""}`
        : kind === "pigeon"
          ? `信鸽${extra ? `，${extra}` : ""}`
          : `物品名称：${name}`;
      if (itemObj && typeof itemObj === "object") {
        const statBits = [];
        if (itemObj.atk != null) statBits.push(`攻击力${itemObj.atk}`);
        if (itemObj.def != null) statBits.push(`防御力${itemObj.def}`);
        if (itemObj.sixDim) statBits.push(Object.entries(itemObj.sixDim).map(([k, v]) => `${k}+${v}`).join("，"));
        if (itemObj.effect) { const t = effectBrief(itemObj.effect, null); if (t) statBits.push(`特效：${t}`); }
        prompt += `，品质：${itemObj.quality}${statBits.length ? `，${statBits.join("，")}` : ""}${itemObj.desc ? `，已知描述：${itemObj.desc}` : ""}`;
      }
      return { sys, prompt };
    };

    const cases = [
      { kind: "skill", name: "雪域刀法", extra: "蓝品·小成", itemObj: null, turn: { id: "t1" } },
      { kind: "pigeon", name: "灰羽", extra: "通人性", itemObj: null, turn: { id: "t2" } },
      {
        kind: "item",
        name: "玉扳指",
        extra: null,
        itemObj: {
          quality: "紫",
          atk: 12,
          def: 4,
          sixDim: { 悟性: 2, 气运: 1 },
          effect: { critRate: 0.1 },
          desc: "传自旧朝宫中。",
        },
        turn: { id: "t3" },
      },
    ];
    const apiCfg = { model: "m1", callTokenLimits: { inspect: 3500 } };

    for (const c of cases) {
      const onRequest = vi.fn();
      const ai = createMockAi(["端详描述。"], { onRequest });
      const expected = buildLegacyInspect(c.kind, c.name, c.extra, c.itemObj);

      await withAI("inspect.describe", c, { ai, apiCfg });

      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expected.sys);
      expect(messages).toEqual([{ role: "user", content: expected.prompt }]);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000,
        callLabel: "查看端详",
        turn: c.turn,
      });
    }
  });

  it("crafting.appraise matches legacy gamble inspect prompt and options", async () => {
    const expectedSys = `你是曲措乡这个武侠世界的说书人。玩家在天都镇玉石料场端详一块未开的赌石，请一位老师傅的口吻看皮相石。用3-5句章回说书人口吻，把下面的看皮线索演成一段相石评语（可用"雾""砂""蟒带"等行话），只说表象与吉凶暗示，绝不断言内里种水成色，绝不编造线索之外的判断。纯文本，不要JSON。`;
    const clues = [
      { skinLabel: "黑乌砂", skinClue: "砂粒紧实带隐约松花", changKouHint: "似莫西沙老坑料", mistHint: "切口隐见白雾" },
      { skinLabel: "黄盐砂", skinClue: "皮厚微糙", changKouHint: "", mistHint: "" },
    ];
    const apiCfg = { model: "m1" };

    for (const clue of clues) {
      const expectedLines = [
        `皮壳：${clue.skinLabel}——${clue.skinClue}`,
        clue.changKouHint ? `场口眼力：${clue.changKouHint}` : "（认不出场口来历，悟性眼力未及）",
        clue.mistHint ? `雾象：${clue.mistHint}` : "",
      ].filter(Boolean).join("\n");

      const onRequest = vi.fn();
      const ai = createMockAi(["相石评语。"], { onRequest });

      await withAI("crafting.appraise", { stone: { id: "s1" }, clue }, { ai, apiCfg });

      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expectedSys);
      expect(messages).toEqual([{ role: "user", content: expectedLines }]);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000,
        callLabel: "赌石相石",
      });
    }
  });

  it("map.prerun matches buildSquarePrompt, buildExtractionCfg and hardcoded 1500 maxTokens", async () => {
    const batch = [
      {
        name: "曲措山口",
        base: "雪风呼啸的隘口。",
        exits: "南,东",
        item: { quality: "蓝", category: "accessory" },
        encounter: { label: "茶马商队", roamers: "马帮脚夫、掌柜" },
      },
      {
        name: "石桥村",
        base: "溪畔古石桥。",
        exits: "西",
        item: null,
        encounter: null,
      },
    ];
    const apiCfg = {
      apiType: "openai",
      model: "main-model",
      extractionModel: "ext-default",
      extractionModels: { SQUARE_PRERUN: "square-small" },
      callTokenLimits: { extraction: 2600, inspect: 5000 },
    };
    const expectedReq = buildSquarePrompt(batch);
    const expectedCfg = buildExtractionCfg("SQUARE_PRERUN", apiCfg);

    const onRequest = vi.fn();
    const ai = createMockAi(["[]"], { onRequest });

    await withAI("map.prerun", { batch }, { ai, apiCfg });

    const [messages, opts] = onRequest.mock.calls[0];
    expect(opts.cfg).toEqual(expectedCfg);
    expect(opts.systemPrompt).toBe(expectedReq.system);
    expect(messages).toEqual([{ role: "user", content: expectedReq.user }]);
    expect(opts.modelOptions).toEqual({
      maxTokens: 1500,
      callLabel: "地图预跑",
    });
  });
});

describe("withAI extensions", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
    definePrompt("block", "ext.sys", { slot: "sys", text: "sys" });
    definePrompt("block", "ext.user", { slot: "user", text: "user:@tag" });
  });

  it("supports function label, cfg transform using raw apiCfg for tokenLimitKey, and non-overriding modelOptions", async () => {
    const cfgSpy = vi.fn((rawCfg, ctx) => ({
      ...rawCfg,
      model: `derived-${ctx.tag}`,
      callTokenLimits: { extLimit: 9999 }, // 派生 cfg 的限制不应影响 maxTokens
    }));
    definePrompt("call", "ext.call", {
      label: (ctx) => `动态标签:${ctx.tag}`,
      tokenLimitKey: "extLimit",
      defaultMaxTokens: 300,
      cfg: cfgSpy,
      modelOptions: (ctx) => ({
        temperature: 0.7,
        turn: ctx.turn,
        recallInfo: { count: 2 },
        maxTokens: 88888,
        callLabel: "不应生效",
      }),
      join: "",
      blocks: ["ext.sys", "ext.user"],
    });

    const onRequest = vi.fn();
    const ai = createMockAi(["ok"], { onRequest });
    const rawApiCfg = { model: "raw", callTokenLimits: { extLimit: 1234 } };
    const ctx = { tag: "alpha", turn: { id: "t9" } };

    await withAI("ext.call", ctx, { ai, apiCfg: rawApiCfg });

    expect(cfgSpy).toHaveBeenCalledWith(rawApiCfg, ctx);
    const [, opts] = onRequest.mock.calls[0];
    expect(opts.cfg.model).toBe("derived-alpha");
    expect(opts.modelOptions).toEqual({
      temperature: 0.7,
      turn: { id: "t9" },
      recallInfo: { count: 2 },
      maxTokens: 1234,
      callLabel: "动态标签:alpha",
    });
  });
});

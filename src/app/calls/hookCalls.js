import { define } from "../../domain/prompt/registry.js";
import "../../domain/prompt/calls/sideCalls.js";
import { buildDaySummaryRequest } from "../../domain/memory/daySummary.js";
import { buildOutfitRequest } from "../../domain/character/bodyProfile.js";
import { effectBrief } from "../../domain/economy/itemEffectText.js";
import { buildSquarePrompt } from "../../domain/map/mapSquares.js";
import { buildExtractionCfg } from "../../domain/prompt/extractionEngine.js";

const INSPECT_KIND_LABEL = { skill: "武学", item: "物品", pigeon: "信鸽" };
const INSPECT_KIND_NOUN = { skill: "武学功法", item: "随身物品", pigeon: "信鸽（用于飞鸽传书的鸟）" };

// 注册 app 层 hooks 迁入 withAI 的提示词块与调用定义
export function registerHookCalls() {
  define("block", "day.summary.sys", {
    label: "日总结系统指令",
    slot: "sys",
    text: (ctx) => buildDaySummaryRequest(ctx.dayLabel, ctx.materialLines).system,
  });

  define("block", "day.summary.user", {
    label: "日总结事记原料",
    slot: "user",
    text: (ctx) => buildDaySummaryRequest(ctx.dayLabel, ctx.materialLines).messages[0].content,
  });

  define("call", "day.summary", {
    label: "日总结",
    tokenLimitKey: "daySummary",
    defaultMaxTokens: 2000,
    join: "",
    blocks: ["day.summary.sys", "day.summary.user"],
  });

  define("block", "outfit.advice.sys", {
    label: "按体貌荐装系统指令",
    slot: "sys",
    text: (ctx) => buildOutfitRequest(ctx.profile, ctx.pool).system,
  });

  define("block", "outfit.advice.user", {
    label: "按体貌荐装体貌与货架",
    slot: "user",
    text: (ctx) => buildOutfitRequest(ctx.profile, ctx.pool).user,
  });

  define("call", "outfit.advice", {
    label: "按体貌荐装",
    tokenLimitKey: "inspect",
    defaultMaxTokens: 4000,
    join: "",
    blocks: ["outfit.advice.sys", "outfit.advice.user"],
  });

  define("block", "inspect.describe.sys", {
    label: "查看端详系统指令",
    slot: "sys",
    text: (ctx) => {
      const kindLabel = INSPECT_KIND_LABEL[ctx.kind] || "物品";
      const kindNoun = INSPECT_KIND_NOUN[ctx.kind] || "随身物品";
      return `你是曲措乡这个武侠世界的说书人，现在玩家想仔细端详一件${kindNoun}。
用 3-5 句话、章回说书人口吻描述这个${kindLabel}的来历、外观或效用，符合当前世界观（澜湄雪域、曲措乡）。不需要 JSON，不需要更新任何状态，纯文本即可。
如果给出了品质和数值信息，请在描述里自然地体现这个品阶应有的分量感（品质越高描述越有气势），但不要机械地报数字。`;
    },
  });

  define("block", "inspect.describe.user", {
    label: "查看端详对象信息",
    slot: "user",
    text: (ctx) => {
      const { kind, name, extra, itemObj } = ctx;
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
      return prompt;
    },
  });

  define("call", "inspect.describe", {
    label: "查看端详",
    tokenLimitKey: "inspect",
    defaultMaxTokens: 4000,
    modelOptions: (ctx) => ({ turn: ctx.turn }),
    join: "",
    blocks: ["inspect.describe.sys", "inspect.describe.user"],
  });

  define("block", "crafting.appraise.sys", {
    label: "赌石相石系统指令",
    slot: "sys",
    text: `你是曲措乡这个武侠世界的说书人。玩家在天都镇玉石料场端详一块未开的赌石，请一位老师傅的口吻看皮相石。用3-5句章回说书人口吻，把下面的看皮线索演成一段相石评语（可用"雾""砂""蟒带"等行话），只说表象与吉凶暗示，绝不断言内里种水成色，绝不编造线索之外的判断。纯文本，不要JSON。`,
  });

  define("block", "crafting.appraise.user", {
    label: "赌石看皮线索",
    slot: "user",
    text: (ctx) => {
      const clue = ctx.clue || {};
      return [
        `皮壳：${clue.skinLabel}——${clue.skinClue}`,
        clue.changKouHint ? `场口眼力：${clue.changKouHint}` : "（认不出场口来历，悟性眼力未及）",
        clue.mistHint ? `雾象：${clue.mistHint}` : "",
      ].filter(Boolean).join("\n");
    },
  });

  define("call", "crafting.appraise", {
    label: "赌石相石",
    tokenLimitKey: "inspect",
    defaultMaxTokens: 4000,
    join: "",
    blocks: ["crafting.appraise.sys", "crafting.appraise.user"],
  });

  define("block", "map.prerun.sys", {
    label: "地图预跑系统指令",
    slot: "sys",
    text: (ctx) => buildSquarePrompt(ctx.batch).system,
  });

  define("block", "map.prerun.user", {
    label: "地图预跑据点批次",
    slot: "user",
    text: (ctx) => buildSquarePrompt(ctx.batch).user,
  });

  define("call", "map.prerun", {
    label: "地图预跑",
    defaultMaxTokens: 1500,
    cfg: (apiCfg) => buildExtractionCfg("SQUARE_PRERUN", apiCfg),
    join: "",
    blocks: ["map.prerun.sys", "map.prerun.user"],
  });
}

registerHookCalls();

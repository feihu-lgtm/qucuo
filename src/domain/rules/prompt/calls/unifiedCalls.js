import { definePrompt, getPromptDef } from "../registry.js";
import { estimatePromptTokens } from "../buildPrompt.js";
import { buildPrivateTalkPayload } from "../privateTalkPayload.js";

let mainTurnAssembler = null;

export function setMainTurnAssembler(fn) {
  mainTurnAssembler = typeof fn === "function" ? fn : null;
}

// 注册单/双/多调用与同步核心管线（turn.main / narrator.whisper / intent.classify），
// 让全仓全部模型请求在同一 registry + withAI 下可观测、可路由、可切换蓝绿灯。
export function registerUnifiedCalls() {
  definePrompt("call", "turn.main", {
    group: "main",
    label: "主叙事回合",
    execution: "foreground_stream",
    route: "primary",
    reviewDesc: "单调用校验 JSON 骨架 + MVU 变量与礼物/地图硬约束；双调用主叙事只产散文并剥除 <deal>",
    matrixBlocks: [
      "engine_identity", "length", "voice", "preset_scenario", "preset_genrules", "preset_wenfeng",
      "npc_lore", "catalog", "isolation", "map_law", "schema", "user_ctx", "user_recall",
      "reunion", "target_ledger", "user_prose", "nsfw_rules", "gm_rule",
    ],
    assemble: (ctx) => {
      const payload = ctx.payload || (mainTurnAssembler ? mainTurnAssembler(ctx) : null);
      if (!payload) throw new Error("turn.main assembler is not bound");
      return {
        cfg: payload.effectiveCfg,
        system: payload.sysBlocks,
        messages: payload.chatMessages,
        stream: ctx.stream ?? payload.stream,
        intent: payload.intent,
        recallInfo: payload.recallInfo,
        callLabel: payload.modelOptions?.callLabel || "主叙事",
        tokenEstimate: estimatePromptTokens(payload.sysBlocks, payload.chatMessages),
      };
    },
  });

  definePrompt("call", "narrator.whisper", {
    group: "whisper",
    label: "旁白私聊",
    execution: "foreground_stream",
    route: "primary",
    reviewDesc: "剥除复读「（旁白私聊回应）」前缀、检测 length 截断，并由 narrator_affinity 软结算裁定好感",
    matrixBlocks: [
      "whisper_ctx", "voice", "world_state", "facts", "recall", "whisper_tally",
      "narrator_lore", "body_gate", "topic_gate", "quest_gate", "whisper_scenario", "whisper_length",
    ],
    assemble: (ctx) => {
      const payload = buildPrivateTalkPayload(ctx);
      if (ctx.onPromptRefMissing) {
        for (const paths of payload.promptRefEvents || []) ctx.onPromptRefMissing(paths);
      }
      return {
        system: payload.systemPrompt,
        messages: payload.messages,
        maxTokens: payload.maxTokens,
        callLabel: "私聊",
        promptRefEvents: payload.promptRefEvents,
        tokenEstimate: estimatePromptTokens(payload.systemPrompt, payload.messages),
      };
    },
  });


  definePrompt("block", "intent.classify.sys", {
    label: "意图分类系统指令",
    slot: "sys",
    editable: "engine",
    text: (ctx) => ctx.systemPrompt || "",
  });

  definePrompt("block", "intent.classify.user", {
    label: "意图分类问题与候选项",
    slot: "user",
    editable: "engine",
    text: (ctx) => ctx.prompt || "",
  });

  definePrompt("call", "intent.classify", {
    group: "sync",
    label: (ctx) => ctx.callLabel || "行动识别",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "关思考 JSON 输出，整句一次识别全部行动并本地校验候选，检测长度截断（IntentTruncatedError）",
    defaultMaxTokens: (ctx) => ctx.maxTokens ?? 1024,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    join: "",
    matrixBlocks: ["intent.classify.sys", "intent.classify.user"],
    blocks: ["intent.classify.sys", "intent.classify.user"],
    // 原生结构化输出：kind/target/item/direction 的候选清单随轮次动态变化，schema 只锁形状与
    // condition 枚举，具体取值合法性仍由 recognizer 本地校验（选不出的写「无」）。
    schema: {
      name: "intent_classify",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["actions"],
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "kind", "target", "item", "direction", "condition", "condition_text", "confidence"],
              properties: {
                text: { type: "string" },
                kind: { type: "string" },
                target: { type: "string" },
                item: { type: "string" },
                direction: { type: "string" },
                condition: { type: "string", enum: ["遇敌", "到达", "被拒", "其他", "无"] },
                condition_text: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
        },
      },
    },
  });
}

export function ensureUnifiedCalls() {
  if (!getPromptDef("call", "turn.main")) registerUnifiedCalls();
}

registerUnifiedCalls();

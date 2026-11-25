// WO-12 前哨快调用 turn.intake：玩家一句话落定后、主叙事开庭前，
// 先用轻量小模型把这句话拆成契约 B 的扁平结构化听意单（read/refIds/actions/proposals）。
// 本模块只负责注册调用定义与组装喂料；判官裁决在 domain/rules/judge/judgeTurn.js，
// 主循环接线属 WO-13，此处不接。
import { definePrompt } from "../../domain/rules/prompt/registry.js";
import { INTAKE_JSON_SCHEMA } from "../../domain/rules/judge/intakeSchema.js";
import { validateJsonSchema } from "../../utils/schemaValidate.js";

// 组装喂给小模型的现场材料（纯函数）：
//   最近两轮对话 + 在场角色与随身物 ID + 可引用场记板条目头。
// 条目头只给【id】+ publicText 前 40 字，小模型只需选 ID 不需读全文。
export function buildIntakeUserContent({ playerInput, recentTurns = [], npcs = [], entries = [] } = {}) {
  const lines = [];
  lines.push(`玩家这句话：「${playerInput || ""}」`);
  if (recentTurns.length) {
    lines.push("最近两轮对话：");
    for (const turn of recentTurns.slice(-2)) {
      lines.push(`[玩家] ${turn?.user || ""}\n[引擎] ${turn?.engine || ""}`);
    }
  }
  if (npcs.length) {
    lines.push("在场角色与随身物：");
    for (const npc of npcs) {
      const carried = (npc.carriedItems || []).filter((it) => it && !it.stolen)
        .map((it) => `${it.name}(${it.id || "无ID"})`).join("、");
      lines.push(`· ${npc.name}${carried ? `〔身携:${carried}〕` : ""}`);
    }
  }
  if (entries.length) {
    lines.push("可引用场记板条目（只需选 ID）：");
    for (const entry of entries) {
      lines.push(`【${entry.id}】${String(entry.publicText || "").slice(0, 40)}`);
    }
  }
  lines.push('输出扁平 JSON：read（≤40字拆清代词与意图核心）、refIds、actions、proposals；无则空数组/空串，禁编造不在场的角色与物件。');
  return lines.join("\n");
}

const INTAKE_SYS = "你是游戏听意员。只做一件事：把玩家这句话拆成结构化听意单。不写剧情、不解释、不扩写，严格输出 schema 规定的扁平 JSON。";

export function registerIntakeCalls() {
  definePrompt("block", "turn.intake.sys", {
    label: "前哨听意系统指令",
    slot: "sys",
    editable: "engine",
    text: () => INTAKE_SYS,
  });

  definePrompt("block", "turn.intake.user", {
    label: "前哨听意现场材料",
    slot: "user",
    editable: "engine",
    text: (ctx) => ctx.userContent || "",
  });

  definePrompt("call", "turn.intake", {
    group: "sync",
    label: "前哨听意",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "契约 B 扁平听意单：关思考 maxTokens 512，原生 schema 通道，本地 validateJsonSchema 复核",
    defaultMaxTokens: 512,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    join: "",
    matrixBlocks: ["turn.intake.sys", "turn.intake.user"],
    blocks: ["turn.intake.sys", "turn.intake.user"],
    schema: INTAKE_JSON_SCHEMA,
  });
}

registerIntakeCalls();

// 本地复核：withAI 的原生 schema 校验之外，listen 结果再回验一遍形状，
// 不合形制的降级为空听意单（actions/proposals 空数组），判官按自由行动处理。
export function normalizeIntakeResult(data) {
  if (!data || typeof data !== "object" || !validateJsonSchema(data, INTAKE_JSON_SCHEMA.schema).ok) {
    return { read: "", refIds: [], actions: [], proposals: [], degraded: true };
  }
  return data;
}

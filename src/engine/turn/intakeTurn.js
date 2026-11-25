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
export function buildIntakeUserContent({ playerInput, recentTurns = [], npcs = [], entries = [], questCandidates = [], containers = [] } = {}) {
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
  if (containers.length) {
    lines.push("可翻找容器：" + containers.join("、"));
  }
  if (entries.length) {
    lines.push("可引用场记板条目（只需选 ID）：");
    for (const entry of entries) {
      lines.push(`【${entry.id}】${String(entry.publicText || "").slice(0, 40)}`);
    }
  }
  if (questCandidates.length) {
    lines.push("本回合可推进任务候选（quest_advance 只能从这里挑，禁自编 flag）：");
    for (const c of questCandidates) {
      lines.push(`· 《${c.title}》questId=${c.questId} flag=${c.flag}——${c.stageBrief}`);
    }
    lines.push("玩家这句话若真把某件事说动/做到了位，就在 proposals 里提 {kind:\"quest_advance\",questId,flag,claim,fit}；没到位就不提，宁可少提。");
  }
  lines.push('输出扁平 JSON：read（≤40字拆清代词与意图核心）、refIds、actions、proposals；无则空数组/空串，禁编造不在场的角色与物件。proposals 的 questId/flag 为必填键：非 quest_advance 提议一律填空串。');
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

// ── WO-15 窄过渡补洞：turn.appease 赔罪消气仲裁 ──
// 软结算通道删除后，appease 回合没有任何机制清愤怒（feature 层无前置硬结算）。
// 这不是软结算复活：AI 只做三选一分类，数值（生气解除/+3 好感中值）由系统侧钉死，
// 不可扩展、不注册其他 kind；单调用 JSON 模式不调它（主模型 MVU 尾巴仍能处理），WO-16 统一清。
const APPEASE_OPTIONS = ["奏效", "未奏效", "无法判断"];

export function registerAppeaseCall() {
  definePrompt("block", "turn.appease.sys", {
    label: "赔罪仲裁系统指令",
    slot: "sys",
    editable: "engine",
    text: () => "你是游戏结算仲裁，只回答一道选择题。不写剧情、不解释，严格只输出一行JSON。",
  });
  definePrompt("block", "turn.appease.user", {
    label: "赔罪消气选择题",
    slot: "user",
    editable: "engine",
    text: (ctx) => `${ctx.npc}还在气头上（缘由：${ctx.reason || "未记录"}）。${ctx.attemptText ? `玩家这次说/做的是：「${ctx.attemptText}」。` : `玩家这次尝试赔罪（${ctx.attemptKind || "求和"}）。`}对方性情：${ctx.personality || "寻常"}；当前好感 ${ctx.affection ?? "未知"}。这次言行是否真让他消了气？敷衍、空话、不得体都不算奏效。
选项：${APPEASE_OPTIONS.map((o) => `「${o}」`).join("、")}
输出JSON：{"choice":"选项原文之一"}`,
  });
  definePrompt("call", "turn.appease", {
    group: "sync",
    label: "赔罪消气仲裁",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "WO-15 窄过渡：三选一消气裁定，数值由系统钉死，WO-16 统一清",
    tokenLimitKey: "extraction",
    defaultMaxTokens: 256,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    join: "",
    matrixBlocks: ["turn.appease.sys", "turn.appease.user"],
    blocks: ["turn.appease.sys", "turn.appease.user"],
    schema: {
      name: "appease_judge",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["choice"],
        properties: { choice: { type: "string", enum: APPEASE_OPTIONS } },
      },
    },
  });
}

registerAppeaseCall();

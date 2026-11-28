// WO-25K · 市井生活白描 / 同屋微戏轻量调用（life.vignette）。
// 系统指令原文按蓝图 7.4 模版 B 逐字入库（src/copy/lifeVignette.sys.txt，copy-gate 单源）。
// 复用 roam.reaction 同款的异步原位替换渠道：route light、disableThinking、零状态写入、
// 绝不写 convo——只回一段 70-120 字白描替换公屏占位行。
import { definePrompt } from "../registry.js";
import { loadCopy } from "../../../../copy/loadCopy.js";

const LIFE_VIGNETTE_SYS = loadCopy("lifeVignette.sys.txt");

// 用户切片装配（蓝图 7.4 模版 B 的 user 模版）：
// 场所/天时/风物 + 一或两位人物的生活切片 + 系统已裁定的微互动走向。
export function buildLifeVignetteUserContent({
  placeLabel,
  buildingTypeLabel = "",
  venueVibe = "",
  shichen = "",
  dayNight = "",
  solarTerm = "",
  venueSignatureDetail = "",
  npcA = null,
  npcB = null,
  pairRelationTag = "",
  deterministicOutcome = "",
  playerPresenceHint = "在旁处做自己的事",
} = {}) {
  const lines = [
    `当前场所：${placeLabel}${buildingTypeLabel ? `（${buildingTypeLabel}${venueVibe ? `，此刻氛围：${venueVibe}` : ""}）` : ""}`,
    `天时节气：${shichen}时 · ${dayNight} · 节气近${solarTerm}`,
    venueSignatureDetail ? `场所风物：${venueSignatureDetail}` : "",
    "正在上演的生活片段：",
  ].filter(Boolean);
  if (npcA) {
    lines.push(`- 人物：${npcA.name}（${npcA.brief || "江湖人"}｜癖好：${npcA.quirks || "无甚特别"}｜银囊：${npcA.purse || "寻常"}｜心境：${npcA.mood || "平和"}）`);
    lines.push(`  正在做：${npcA.activityDetail || "做着自己的营生"}`);
  }
  if (npcB) {
    lines.push(`- 对手戏人物：${npcB.name}（${npcB.brief || "江湖人"}｜双方关系：${pairRelationTag || "点头之交"}）`);
    lines.push(`  正在做：${npcB.activityDetail || "做着自己的营生"}`);
    if (deterministicOutcome) lines.push(`- 系统已裁定的微互动走向：${deterministicOutcome}`);
  }
  lines.push(`主角外显位置：仅在旁处（${playerPresenceHint}，本段不代写主角任何反应）`);
  lines.push("请写出这一幕市井白描：");
  return lines.join("\n");
}

export function registerLifeCalls() {
  definePrompt("block", "life.vignette.sys", {
    label: "市井生活白描系统指令",
    slot: "sys",
    editable: "engine",
    text: () => LIFE_VIGNETTE_SYS,
  });

  definePrompt("block", "life.vignette.user", {
    label: "市井生活现场切片",
    slot: "user",
    editable: "engine",
    text: (ctx) => buildLifeVignetteUserContent(ctx),
  });

  definePrompt("call", "life.vignette", {
    group: "async",
    label: "市井生活白描/同屋微戏",
    execution: "async_background",
    route: "light",
    reviewDesc: "同屋非同伴 NPC 微互动的轻量白描，关思考纯散文，受 epoch 与房间一致性双门禁保护，零状态写入、绝不写 convo",
    tokenLimitKey: "inspect",
    defaultMaxTokens: 240,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    modelOptions: { disableThinking: true },
    join: "",
    matrixBlocks: ["life.vignette.sys", "life.vignette.user"],
    blocks: ["life.vignette.sys", "life.vignette.user"],
  });
}

registerLifeCalls();

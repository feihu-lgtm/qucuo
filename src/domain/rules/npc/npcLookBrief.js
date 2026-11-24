// 查看 NPC：系统卡片（来历、装束）立刻给出，外貌描写后台补写。
import { buildNpcContext, deriveAppearance, npcGear } from "./npcContext.js";

export { buildNpcContext, deriveAppearance, npcGear };

export function npcLookCard(npc, opts = {}) {
  if (!npc?.name) return [];
  const { gear, exposure } = deriveAppearance(npc, opts);
  return [
    { t: "sys", text: `  ${npc.name}${npc.brief ? `：${npc.brief}` : ""}` },
    gear.length ? { t: "sys", text: `  装束：${gear.join("、")}` } : null,
    exposure ? { t: "sys", text: `  ⚠ ${exposure}——浑身上下再找不出一件完整的行头。` } : null,
  ].filter(Boolean);
}

export function buildNpcLookPrompt(npc, {
  place = "", trade = null, state = {},
  // 三层「熟人感」上下文，由调用方从 getState 收集：共同记忆（旧账+记忆库）、
  // 近期对话摘要、书信往来。哪层没记录就不写哪层——别让模型对着空白编交情。
  history = [], convoLines = [], letters = [],
} = {}) {
  const sys = `你是曲措乡的说书人。玩家正在端详一个人，名字、来历、装束已由系统列出。
写一段两到四句的描写（不超过一百二十字），只写此人的容貌装束、气色伤势、当下神态举止。
给了「过往/交谈/书信」的，此人不是初见——描写里要带出几分熟稔，别写得像头回照面。
铁律：装束只写给定的，不添新物品；此人不开口说话、不出手、不推进任何事件；不写其他人；不替玩家做决定、不向玩家提问；
白话古文的说书人口吻，不用冒号破折号。只输出正文，不要任何前后缀。`;
  const ctx = buildNpcContext(npc, state, { trade, history, convoLines, letters });
  const section = (title, lines) => lines.length
    ? `${title}：\n${lines.map((l) => `· ${l}`).join("\n")}` : "";
  const user = [
    place ? `地点：${place}` : "",
    `人物：${ctx.name}`,
    ctx.brief ? `来历：${ctx.brief}` : "",
    ctx.persona ? `人设：${ctx.persona}` : "",
    ctx.favorability != null ? `好感度：${ctx.favorability}/100` : "",
    ctx.gear.length ? `装束：${ctx.gear.join("、")}` : "",
    ctx.exposure ? `衣着状态：${ctx.exposure}（被扒得几乎不剩行头，叙事要照实反映）` : "",
    Array.isArray(ctx.hp) && ctx.hp[1] > 0 && ctx.hp[0] < ctx.hp[1] ? `气血：${ctx.hp[0]}/${ctx.hp[1]}` : "",
    section("你和他的过往", ctx.history.slice(-4)),
    section("最近的交谈", ctx.convoLines.slice(-3)),
    section("书信往来", ctx.letters.slice(-2)),
  ].filter(Boolean).join("\n");
  return { sys, user };
}

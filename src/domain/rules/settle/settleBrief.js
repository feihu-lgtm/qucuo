// 系统已定结果的结算（钱庄、住店、买书……）改后台补写：事实行先落日志，描写由 AI 后台补。
// 走软结算（settleKind）或显式 settle:false 的仍要整轮 act，不在此列。

export function canBackfillSettle(opts = {}) {
  return !opts.settleKind && opts.settle !== false;
}

// 只取首句：结算文本尾部常带叙事指令（"请让…说道""只描写…"），不是事实。首句不够的由 settleOptions.settleFact 给出。
export function settleFactText(cmd) {
  const text = String(cmd || "").trim();
  return text.split(/[。！？]/).map((part) => part.trim()).filter(Boolean)[0] || text;
}

export function buildSettleNarrationPrompt(cmd, { place = "", npc = "" } = {}) {
  const sys = `你是曲措乡的说书人。玩家刚做完一件事，结果已由系统算定并入账。
写一段两到四句的描写（不超过一百二十字），写当时的情景和在场人的反应。
铁律：数额、物品、得失一律照给定事实，不改判、不添新物品新结果、不替玩家做新决定、不向玩家提问；
事实里若带「请让…」之类的要求，照着写进描写里；白话古文的说书人口吻，不用冒号破折号。只输出正文，不要任何前后缀。`;
  const user = [
    place ? `地点：${place}` : "",
    npc ? `相关人物：${npc}` : "",
    `事实：${String(cmd || "").trim()}`,
  ].filter(Boolean).join("\n");
  return { sys, user };
}

export function parseSettleNarration(text) {
  if (typeof text !== "string") return null;
  const line = text.replace(/^```\w*\s*|\s*```$/g, "").replace(/\s*\n+\s*/g, "").trim();
  // 模型跑偏时会吐英文元注释或半截括号注（"金叶子 (note: background info, don't mention…"），
  // 这类回包不像叙事正文：CJK 占比过低或带 meta 标记的一律判无效，静默只留系统事实行。
  if (!line) return null;
  if (/\(note|background info|note:/i.test(line)) return null;
  const body = line.replace(/\s/g, "");
  const cjk = (body.match(/[一-鿿]/g) || []).length;
  if (cjk < body.length * 0.4) return null;
  return [line];
}

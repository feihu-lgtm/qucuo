// 行动识别的冻结提示词：每个问题一个模板，模板文本变动必须同步提升 PROMPT_VERSION，
// 评测报告会记录版本号，保证不同模型/阈值的结果可比。
export const PROMPT_VERSION = "intent-v2";

export const SYSTEM_PROMPT = "你是武侠文字游戏的行动识别器，只做分类，不写剧情。严格只输出一行JSON，不要解释。";

const PROB_TAIL = "输出JSON：{\"choice\":\"选项原文之一\",\"probs\":{\"选项\":概率,...}}，probs覆盖全部选项、总和为1。";

export const TEMPLATES = Object.freeze({
  compound: "问题：玩家这句话是否包含两个或以上要依次执行的独立行动（例：「送他一壶酒，再跟他切磋」）？只是一个行动、闲聊、询问或拒绝都算「否」。\n玩家原话：「{text}」\n选项：{options}\n" + PROB_TAIL,
  split: "把玩家这句话按执行顺序拆成独立行动的原文片段。每段必须是原话里连续的一段，不改写、不补字。\n玩家原话：「{text}」\n输出JSON：{\"parts\":[\"片段1\",\"片段2\"]}",
  kind: "问题：玩家这句话想做哪一类行动？只看玩家本人此刻真正要做的事；否定或拒绝（如「我不想切磋」）、提问、闲聊都不是该行动本身，选「交谈」或「其他」。\n玩家原话：「{text}」\n选项：{options}\n" + PROB_TAIL,
  target: "问题：行动「{kind}」指向哪位在场人物？原话没点名、或点名的人不在选项里，选「无」。\n玩家原话：「{text}」\n选项：{options}\n" + PROB_TAIL,
  item: "问题：行动「{kind}」用到哪件东西？说的是钱（银子、银两、几两）选「银两」；背包里没有的选「无」。\n玩家原话：「{text}」\n选项：{options}\n" + PROB_TAIL,
  direction: "问题：玩家要往哪个方向走？原话没说方向选「无」。\n玩家原话：「{text}」\n选项：{options}\n" + PROB_TAIL,
  cond: "问题：玩家设的前提是哪种情形？碰到山贼、劫匪、野兽、追兵这类危险算「遇敌」；走到、抵达某个地方算「到达」；刚才拜托的事被对方回绝、不肯算「被拒」；其余情形（天气、时间、心情等）算「其他」。\n前提：「{text}」\n选项：{options}\n" + PROB_TAIL,
});

export function renderPrompt(question, vars) {
  const template = TEMPLATES[question];
  if (!template) throw new Error(`未知的识别问题：${question}`);
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return Array.isArray(value) ? value.map((option) => `「${option}」`).join("、") : String(value ?? "");
  });
}

export function extractJson(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function normalize(probs, options) {
  const total = options.reduce((sum, option) => sum + (probs[option] || 0), 0);
  if (!(total > 0)) return null;
  return Object.fromEntries(options.map((option) => [option, (probs[option] || 0) / total]));
}

export function argmax(probs) {
  let best = null;
  for (const [option, p] of Object.entries(probs || {})) if (best === null || p > probs[best]) best = option;
  return best;
}

// 模型自报概率：只保留选项内的键；缺概率时把全部质量给 choice；choice 不在选项里时取概率最大者。
export function parseChoice(text, options) {
  const json = extractJson(text);
  const stated = {};
  for (const [key, value] of Object.entries(json?.probs || {})) {
    const option = options.find((candidate) => candidate === String(key).replace(/[「」]/g, ""));
    const p = Number(value);
    if (option && Number.isFinite(p) && p >= 0) stated[option] = p;
  }
  const choice = options.includes(json?.choice) ? json.choice : null;
  const probs = normalize(stated, options) || (choice ? normalize({ [choice]: 1 }, options) : null);
  if (!probs) return { choice: options.includes("无") ? "无" : options[options.length - 1], probs: {}, parseFailed: true };
  return { choice: argmax(probs), probs, parseFailed: false };
}

// Provider 暴露 logprobs 时：找 choice 值开始的那个 token，用它的 top_logprobs 按首字映射回选项。
export function probsFromLogprobs(logprobs, options) {
  const tokens = Array.isArray(logprobs?.content) ? logprobs.content : null;
  if (!tokens) return null;
  let prefix = "";
  for (const entry of tokens) {
    if (/"choice"\s*:\s*"\s*$/.test(prefix)) {
      const mass = {};
      for (const alt of entry.top_logprobs || [entry]) {
        const token = String(alt.token || "").replace(/^「/, "");
        if (!token) continue;
        const matches = options.filter((option) => option.startsWith(token) || token.startsWith(option));
        for (const option of matches) mass[option] = (mass[option] || 0) + Math.exp(alt.logprob) / matches.length;
      }
      return normalize(mass, options);
    }
    prefix += entry.token || "";
  }
  return null;
}

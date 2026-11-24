// 行动识别的冻结提示词：整句只问一次，模板文本变动必须同步提升 PROMPT_VERSION，
// 评测报告会记录版本号，保证不同模型/阈值的结果可比。
export const PROMPT_VERSION = "intent-v3";

export const SYSTEM_PROMPT = "你是武侠文字游戏的行动识别器，只做分类，不写剧情。严格只输出一个JSON对象，不要解释。";

// 候选项一次性全部列出；模型只能从中选，选不出的写「无」。置信度是模型自评的 0~1 小数。
export const TEMPLATES = Object.freeze({
  recognize: [
    "任务：把玩家这句话拆成按执行顺序排列的行动列表，并逐个行动选类别与对象。",
    "规则：",
    "1. 每个行动的 text 必须是原话里连续的一段原文，不改写、不补字；只有一个行动就整句作为 text。",
    "2. 只看玩家本人此刻真正要做的事；否定或拒绝（如「我不想切磋」）、提问、闲聊、纯情绪表达，类别选「交谈」或「其他」。",
    "3. target 从「在场人物」里选；item 从该类别对应的物品清单里选；direction 从方向里选。原话没点名、或点名的不在清单里，一律写「无」。",
    "4. 说的是钱（银子、银两、几两）时，赠送的 item 写「银两」。",
    "5. 带前提的行动（要是…就…、到了…就…），condition 填前提类别：碰到山贼、劫匪、野兽、追兵这类危险写「遇敌」；走到、抵达某地写「到达」；刚才拜托的事被回绝写「被拒」；其余前提（天气、时间、心情等）写「其他」，此时 text 取含前提的整个从句；没有前提写「无」。condition_text 写前提原文。",
    "玩家原话：「{text}」",
    "{hints}",
    "行动类别：{kinds}",
    "在场人物：{targets}",
    "赠送可用物品：{giftItems}",
    "使用物品可用物品：{useItems}",
    "拾取可用物品：{pickupItems}",
    "装备/卸下可用物品：{equipItems}",
    "方向：{directions}",
    "输出JSON：{\"actions\":[{\"text\":\"原文片段\",\"kind\":\"类别\",\"target\":\"人物或无\",\"item\":\"物品或无\",\"direction\":\"方向或无\",\"condition\":\"遇敌|到达|被拒|其他|无\",\"condition_text\":\"前提原文或空\",\"confidence\":0.0到1.0}]}",
  ].join("\n"),
});

const list = (options) => (options?.length ? options.map((option) => `「${option}」`).join("、") : "（无）");

export function renderPrompt(question, vars) {
  const template = TEMPLATES[question];
  if (!template) throw new Error(`未知的识别问题：${question}`);
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return Array.isArray(value) ? list(value) : String(value ?? "");
  });
}

export function extractJson(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

// 规则版 mock 模型：读冻结提示词里的「玩家原话」和「选项」，按关键词给出 JSON 选择+概率。
// 只用来让评测框架与 CI 在无凭据时可跑通；它的分数是关键词基线，不代表真实模型。
const NEGATION = /不想|不要|不愿|不肯|别|算了|不打算|不必|不用|不和|不跟|不同/;
const KIND_RULES = [
  ["切磋", /切磋|比试|过招|较量|过两招|比划|讨教几招/],
  ["拜师/学艺", /拜.{0,4}为师|教我|学两手|拜师|学艺|学武|求教|拜入|学.{0,4}(功夫|武功|招|剑法|刀法|拳)/],
  ["购买", /买|购|采办|置办|捎一/],
  ["移动", /(往|向|朝)?[东南西北]边?(走|去|行)|^去[东南西北]|往[东南西北]/],
  ["使用物品", /吃|喝|服下|服用|用掉|敷上|饮/],
  ["赠送", /送|赠|递给|把.{1,8}给|给.{1,6}(银|两|酒|茶|药|饼)|塞给|打赏|孝敬/],
  ["交谈", /问|聊|说|打听|请教|谈|讲|告诉|你好|多谢|谢谢|闲话/],
];
const SEPARATORS = /然后|接着|随后|之后|顺便|再|，|,|；|;/;

function between(prompt, start, end) {
  const from = prompt.indexOf(start);
  if (from < 0) return "";
  const rest = prompt.slice(from + start.length);
  const to = rest.indexOf(end);
  return to < 0 ? rest : rest.slice(0, to);
}

function parseOptions(prompt) {
  const line = between(prompt, "选项：", "\n");
  return [...line.matchAll(/「([^」]*)」/g)].map((match) => match[1]);
}

function answer(choice, options, p) {
  const rest = options.filter((option) => option !== choice);
  const probs = Object.fromEntries(options.map((option) => [option, option === choice ? p : (1 - p) / Math.max(1, rest.length)]));
  return JSON.stringify({ choice, probs });
}

function ruleKind(text) {
  if (NEGATION.test(text)) return ["交谈", 0.8];
  const hits = KIND_RULES.filter(([, re]) => re.test(text));
  if (!hits.length) return ["其他", 0.7];
  return [hits[0][0], hits.length > 1 ? 0.8 : 0.95];
}

function actionParts(text) {
  return text.split(SEPARATORS).map((part) => part.trim()).filter((part) => part && ruleKind(part)[0] !== "其他");
}

export function mockRespond(prompt) {
  const text = between(prompt, "玩家原话：「", "」\n");
  const options = parseOptions(prompt);
  if (prompt.includes("\"parts\"")) {
    const raw = text.split(SEPARATORS).map((part) => part.trim()).filter(Boolean);
    return JSON.stringify({ parts: raw.filter((part) => ruleKind(part)[0] !== "其他") });
  }
  if (prompt.includes("两个或以上")) {
    const yes = !NEGATION.test(text) && actionParts(text).length >= 2;
    return answer(yes ? "是" : "否", options, 0.92);
  }
  if (prompt.includes("想做哪一类行动")) {
    const [kind, p] = ruleKind(text);
    return answer(kind, options, p);
  }
  if (prompt.includes("用到哪件东西")) {
    if (/\d+\s*两|[一二三四五六七八九十百千]+两|银子|银两/.test(text) && options.includes("银两")) return answer("银两", options, 0.95);
    const item = options.find((option) => option !== "无" && option !== "银两" && text.includes(option));
    return answer(item || "无", options, item ? 0.95 : 0.6);
  }
  if (prompt.includes("往哪个方向")) {
    const dir = options.find((option) => option !== "无" && text.includes(option));
    return answer(dir || "无", options, dir ? 0.95 : 0.7);
  }
  if (prompt.includes("指向哪位在场人物")) {
    const named = options.filter((option) => option !== "无" && text.includes(option));
    if (named.length === 1) return answer(named[0], options, 0.96);
    if (/他|她|对方|这位|那位/.test(text) && options.length === 2) return answer(options[0], options, 0.75);
    return answer("无", options, 0.6);
  }
  return JSON.stringify({ choice: options[0] || "无", probs: {} });
}

export function createRuleMockAi({ latencyMs = 0 } = {}) {
  return {
    async chat(messages) {
      if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      return { text: mockRespond(messages[messages.length - 1].content) };
    },
  };
}

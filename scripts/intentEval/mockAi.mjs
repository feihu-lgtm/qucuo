// 规则版 mock 模型：读冻结提示词里的「玩家原话」和各候选清单，按关键词一次给出整句的 actions JSON。
// 只用来让评测框架与 CI 在无凭据时可跑通；它的分数是关键词基线，不代表真实模型。
import { splitConditionClause } from "../../src/domain/rules/intent/conditions.js";

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
const KIND_ITEM_LABEL = { 赠送: "赠送可用物品：", 使用物品: "使用物品可用物品：", 拾取: "拾取可用物品：", "装备/卸下": "装备/卸下可用物品：" };
const SEPARATORS = /然后|接着|随后|之后|顺便|再|，|,|；|;/;
const COND_CLAUSE = /要是|如果|若|万一/;

function between(prompt, start, end) {
  const from = prompt.indexOf(start);
  if (from < 0) return "";
  const rest = prompt.slice(from + start.length);
  const to = rest.indexOf(end);
  return to < 0 ? rest : rest.slice(0, to);
}

function optionLine(prompt, label) {
  return [...between(prompt, label, "\n").matchAll(/「([^」]*)」/g)].map((match) => match[1]);
}

function ruleKind(text) {
  if (NEGATION.test(text)) return ["交谈", 0.8];
  const hits = KIND_RULES.filter(([, re]) => re.test(text));
  if (!hits.length) return ["其他", 0.7];
  return [hits[0][0], hits.length > 1 ? 0.8 : 0.95];
}

function actionParts(text) {
  return text.split(SEPARATORS).map((part) => part.trim()).filter((part) => part && (ruleKind(part)[0] !== "其他" || COND_CLAUSE.test(part)));
}

function conditionLabel(detail) {
  if (/贼|匪|强盗|劫|敌|野兽|袭|埋伏|追兵|拦路|恶霸|欺负/.test(detail)) return ["遇敌", 0.9];
  if (/到|抵达|到了|走进|来到|赶回/.test(detail)) return ["到达", 0.85];
  if (/拒|不肯|不愿|不答应|回绝|赶出来/.test(detail)) return ["被拒", 0.85];
  return ["其他", 0.8];
}

function slots(prompt, kind, text) {
  const targets = optionLine(prompt, "在场人物：");
  const items = optionLine(prompt, KIND_ITEM_LABEL[kind] || "\u0000");
  const directions = optionLine(prompt, "方向：");
  const out = { target: "无", item: "无", direction: "无" };
  let confidence = 1;
  if (["赠送", "购买", "切磋", "拜师/学艺", "邀同行", "偷窃", "平息/道歉", "交谈"].includes(kind)) {
    const named = targets.filter((name) => text.includes(name));
    if (named.length === 1) { out.target = named[0]; confidence *= 0.96; }
    else if (/他|她|对方|这位|那位/.test(text) && targets.length === 1) { out.target = targets[0]; confidence *= 0.75; }
    else confidence *= 0.6;
  }
  if (kind in KIND_ITEM_LABEL) {
    if (/\d+\s*两|[一二三四五六七八九十百千]+两|银子|银两/.test(text) && items.includes("银两")) { out.item = "银两"; confidence *= 0.95; }
    else {
      const item = items.find((name) => name !== "银两" && text.includes(name));
      if (item) { out.item = item; confidence *= 0.95; } else confidence *= 0.6;
    }
  }
  if (kind === "移动") {
    const dir = directions.find((name) => text.includes(name));
    if (dir) { out.direction = dir; confidence *= 0.95; } else confidence *= 0.7;
  }
  return { ...out, confidence };
}

function recognizeText(prompt, text) {
  const parts = !NEGATION.test(text) && actionParts(text).length >= 2 ? actionParts(text) : [text];
  return parts.map((part) => {
    const clause = splitConditionClause(part);
    if (clause) {
      const [label, p] = conditionLabel(clause.detail);
      if (label === "其他") return { text: part, kind: "其他", target: "无", item: "无", direction: "无", condition: "其他", condition_text: clause.detail, confidence: p };
      const [kind, kp] = ruleKind(clause.actionText);
      const slot = slots(prompt, kind, clause.actionText);
      return { text: clause.actionText, kind, ...slot, condition: label, condition_text: clause.detail, confidence: Number((kp * p * slot.confidence).toFixed(4)) };
    }
    const [kind, kp] = ruleKind(part);
    const slot = slots(prompt, kind, part);
    return { text: part, kind, ...slot, condition: "无", condition_text: "", confidence: Number((kp * slot.confidence).toFixed(4)) };
  });
}

export function mockRespond(prompt) {
  const text = between(prompt, "玩家原话：「", "」\n");
  return JSON.stringify({ actions: recognizeText(prompt, text) });
}

export function createRuleMockAi({ latencyMs = 0 } = {}) {
  return {
    async chat(messages) {
      if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      return { text: mockRespond(messages[messages.length - 1].content) };
    },
  };
}

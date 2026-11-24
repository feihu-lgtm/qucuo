// 单轨自动分流（docs 终版）：输入框只剩一个语义——玩家一句话，系统按内容路由。
// 整句纯「看X」走 lookNpcInBackground（免费）；整句纯搭话走 talk 路（不耗回合）；
// 其他一切（行动意图/复合句/UNKNOWN）整句进 act() 扣 1 回合——括号/断句只做
// 段标注透传给模型，不做物理分流、不按段多发调用。
import { classifyIntent } from "../prompt/inputIntent.js";

const PAREN_RE = /[（(]([^（）()]+)[）)]/g;
const SEG_SPLIT_RE = /[，,。.！!？?；;、\n]+/;

// 把一句输入按书写顺序切成子段：括号（…）/（...）各自成段，
// 段间按中英文逗号/句号/感叹/问号/分号/顿号/换行断句。
export function splitCompositeInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const segments = [];
  const push = (s) => { const t = s.trim(); if (t) segments.push(t); };
  let last = 0;
  for (const m of text.matchAll(PAREN_RE)) {
    for (const p of text.slice(last, m.index).split(SEG_SPLIT_RE)) push(p);
    push(m[1]);
    last = m.index + m[0].length;
  }
  for (const p of text.slice(last).split(SEG_SPLIT_RE)) push(p);
  return segments;
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOOK_WORDS = "(?:看|看看|打量|端详|观察|细看|查看)";

// 整句纯「看X」：一个看字加一个在场人物名、没有别的行动尾巴。
// 比 classifyIntent 的 LOOK 宽松——不要求"看"和名字之间有空格（"看铁伯"也算）。
export function matchWholeLook(raw, npcs = []) {
  const s = String(raw || "").trim();
  if (!s) return null;
  for (const npc of npcs) {
    if (!npc?.name) continue;
    const re = new RegExp(`^(?:${LOOK_WORDS}|look|l)\\s*${escapeRe(npc.name)}[，,。.！!？?]*$`, "i");
    if (re.test(s)) return npc;
  }
  return null;
}

// 句子里被"看/打量/端详"点到名的在场人物——行动回合里这些段照常触发
// 系统端详卡+后台补写（免费），和 lookNpcInBackground 同一条路径。
export function findLookTargetsInText(raw, npcs = []) {
  const text = String(raw || "");
  if (!text) return [];
  const found = [];
  for (const npc of npcs) {
    if (!npc?.name || found.includes(npc)) continue;
    const re = new RegExp(`${LOOK_WORDS}\\s*${escapeRe(npc.name)}`);
    if (re.test(text)) found.push(npc);
  }
  return found;
}

// 自动分流：整句纯看 → lookNpc；整句纯搭话 → talk；其余 → action。
export function routeAutoInput(raw, npcs = []) {
  const s = String(raw || "").trim();
  if (!s) return { kind: "none" };
  const lookedNpc = matchWholeLook(s, npcs);
  if (lookedNpc) return { kind: "lookNpc", npc: lookedNpc };
  if (classifyIntent(s).code === "TALK_CASUAL") return { kind: "talk" };
  return { kind: "action" };
}

// 复合句的段标注：只做提示词标注透传给模型，不物理分流。
// 硬行动配额也在这里写死——一句最多一个决定性硬行动，其余按对白/氛围处理。
export function buildCompositeNote(raw) {
  const segments = splitCompositeInput(raw);
  if (segments.length < 2) return "";
  const listed = segments.map((s) => `「${s}」`).join("、");
  return `\n[系统裁决：玩家此句为复合输入，共 ${segments.length} 段（${listed}），各段都要在本轮叙事里有所着落；但一句最多执行一个决定性硬行动（移动/战斗/交易/偷窃/索取等真正改状态的动作），其余段按对白、神情或氛围处理，不再产生第二处状态落账；被系统拒绝或未成功的行动按失败如实写，不得写成已经办成。]`;
}

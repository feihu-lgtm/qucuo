// WO-16H-H1 判官铁律块与群聊尾章块（纯函数，不碰网络/存储）
// ------------------------------------------------------------------
// 正文严格照 roadmap WO-16H 的 d.judgeRuleBlock / d.groupTalkRuleBlock——
// 替换 runTurn 原五行数组：锚点/分寸/条件券/SEAL 五行 JSON 全键契约、
// 天机券词条白名单逐券渲染、不知情者反应导引并块。
import { renderJudgeVerdict, renderCausalBudget } from "./judgeTurn.js";

// 不知情反应导引并块：有 guidance 的 NPC 逐行列出，都没有就给空串
export function renderReactionGuides(reactionGuides = []) {
  const lines = (reactionGuides || [])
    .filter((g) => g && typeof g.guidance === "string" && g.guidance.trim())
    .map((g) => g.guidance.trim());
  return lines.length ? `在场者知情边界：\n${lines.join("\n")}` : "";
}

// 条件券词条白名单逐券渲染：⟦W编号⟧ 允许词条：xxx、xxx｜无（0 点白板）
export function renderWarrantAffixWhitelists(warrants = []) {
  return (warrants || [])
    .filter((w) => w && w.warrantId)
    .map((w) => {
      const affixes = Array.isArray(w.allowedAffixes) && w.allowedAffixes.length
        ? w.allowedAffixes.join("、")
        : "无（0 点白板）";
      return `  ⟦${w.warrantId}⟧ 允许词条：${affixes}`;
    })
    .join("\n");
}

// 判官铁律块：判官激活回合的尾章指引（roadmap WO-16H d.judgeRuleBlock 原文）。
export function buildJudgeRuleBlock({ judgeVerdict, playerName = "主角" } = {}) {
  if (!judgeVerdict) return "";
  const verdictText = renderJudgeVerdict(judgeVerdict);
  const budgetText = renderCausalBudget(judgeVerdict.budget);
  const guidesText = renderReactionGuides(judgeVerdict.reactionGuides);
  const whitelistLines = renderWarrantAffixWhitelists(judgeVerdict.warrants);
  const allowPact = !!judgeVerdict.allowSpontaneousPact;
  return `【判官定案】系统已经裁定了本轮发生的事。你只管把它讲出来，并在尾章替空白券填上名字。

${verdictText}
${budgetText}
${guidesText}

一、锚点。正文每写实一条事实，就在写实的那一句末尾紧跟它的锚点，比如 ⟦F12_1⟧。锚点玩家看不见，系统会剥掉；漏写的，系统会替你补一句干巴巴的交代。

二、分寸。判官没有签发的东西，不许写成真的：新器物、新武学、银两进出、好感的大起大落，一概不许。已经易手的物件，不许再写原主拿出来用。上面列出的不知情者，只能按话语表面反应，不许露出知情的样子。

三、条件券。标着「条件拾取券」的东西，只有你在正文里写了拾取、埋了锚点，并在尾章填了名字，它才成立。此刻不宜去捡，就不写、不埋、不填，券自然作废，系统不会替你硬塞。

四、尾章。正文写完，另起一行写 ---SEAL---，再起一行写一行 JSON，不加代码围栏：
{"fills":{},"respondedNpcs":[],"spontaneousPact":null,"mentionedNewNpcs":[],"emergedNpc":null}
· fills：上面每有一张 ⟦W编号⟧ 空白券，就按编号填一项。
  物件券：{"name":"合乎此地与品阶的物名","chosenAffix":"从这张券允许的词条里选一个，没有就填空串","desc":"不超过 40 字，只写外观与手感"}
${whitelistLines}
  武学券：{"name":"招式或功法名","skillType":"招式、内功、轻功三选一","archetype":"硬攻、防守反击、趁虚、致乱、封穴、蓄势、施毒、回气、疗伤九选一","desc":"不超过 40 字，写它的路数"}
· respondedNpcs：本轮真正开口，或用动作直接回应 ${playerName} 的在场者。只被提到、只在一旁看着的不算；没有就给 []。
· spontaneousPact：${allowPact ? "本轮允许自发立约。只有双方当面说定了一件有期限的事，才填" : "本轮不允许自发立约，填 null。"}${allowPact ? ' {"npc":"在场者的名字","promise":"不超过 30 字","deadlineHours":24,"rewardHint":"不超过 20 字"}；deadlineHours 是正整数，单位是小时，一个时辰算两小时，至少 4 小时（不足 4 小时的约系统不收）。没有说定就填 null。' : ""}
· mentionedNewNpcs：正文里新提到、此前没出现过的具名人物，只写名字；没有就给 []。
· emergedNpc：玩家明确在找的传闻人物，如果在正文里真的现身，填 {"name":"名字","description":"一句话写身份与性情，不带任何数值"}；没有现身就填 null。`;
}

// 群聊尾章块（roadmap WO-16H d.groupTalkRuleBlock 原文）：多人群聊不改任何
// 游戏状态，只写对白/神态/心思；尾章只有 respondedNpcs 一个键。
export function buildGroupTalkRuleBlock(playerName = "主角") {
  return `【群聊回响】这一轮是好几个人同在场的对话。你不改变任何游戏状态，只写对白、神态和心思。
正文写完，另起一行写 ---SEAL---，再起一行写一行 JSON，不加代码围栏：
{"respondedNpcs":["本轮真正开口或直接回应 ${playerName} 的在场者"]}
只列真正搭了话的在场者，兽类用动作回应也算；旁观、路过、只被提到的不列；没人回应就给 []。`;
}

// 群聊尾章解析（roadmap 3.4.1）：按在场白名单过滤 respondedNpcs——越界名字
// 安静丢弃（调用方记 trace），JSON  malformed/缺键按空处理不崩。
export function parseGroupTalkSeal(sealText, presentNpcNames = []) {
  const whitelist = new Set((presentNpcNames || []).filter(Boolean));
  const out = { respondedNpcs: [], dropped: [] };
  const text = String(sealText || "").trim();
  if (!text) return out;
  let data = null;
  try { data = JSON.parse(text); } catch {
    // 容错：模型有时多写废话——抠第一个 {...} 段
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { data = JSON.parse(m[0]); } catch { data = null; } }
  }
  if (!data || typeof data !== "object") return out;
  const names = Array.isArray(data.respondedNpcs) ? data.respondedNpcs : [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) continue;
    if (whitelist.has(name)) out.respondedNpcs.push(name);
    else out.dropped.push(name);
  }
  return out;
}

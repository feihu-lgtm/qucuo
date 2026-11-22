// ── 任务线·红绿灯（按任务全名点灯）──
// 旁白是唯一看得见全盘的角色，理应能陪玩家聊任务。但全任务表有二十几条线、
// 每条四五个 stage，全量注入等于每次闲聊背一本攻略书，token 烧穿不说，
// 她还会顺嘴把玩家没接的线一起剧透了。
//
// 所以走"报全名才查"：玩家说出任务标题（或标题里够独特的一段），才把**那一条线**
// 的完整 stage 注入；只泛泛问"我该干嘛"就只给她一句话，让她反问是哪条线。
// 这也顺带解决了模糊匹配的老问题——不猜，让玩家自己说准。
//
// 好感度门槛 30：低于这个数她本来就是敷衍态度（<20 爱答不理、20-45 留一半），
// 陪你捋任务线属于实打实的帮忙，不该在冰点期白给。
export const QUEST_TALK_MIN_AFFECTION = 30;

// 泛泛问剧情的说法——命中这些但没报出任务名时，让她反问。
const QUEST_GENERIC_KEYS = [
  "任务", "剧情", "支线", "主线", "该干嘛", "该做什么", "接下来", "下一步",
  "怎么推", "怎么做", "卡住", "卡关", "攻略", "线索", "提示",
];

// 标题里够独特的一段：把「虎胆三重门·师母之情」这类带间隔号的标题拆开，
// 让玩家说「师母之情」也能命中，但仍要求是标题里真实存在的词，不做同义猜测。
function titleAliases(title) {
  const t = String(title || "").trim();
  if (!t) return [];
  const out = [t];
  for (const seg of t.split(/[·・\.\s]+/)) {
    if (seg.length >= 3) out.push(seg); // 太短的段（如"线四"）不收，避免误触
  }
  return Array.from(new Set(out));
}

/**
 * @param {string} scanText  玩家这句话 + 上一条回复
 * @param {number} affection 当前好感度
 * @param {Array}  quests    全任务表（外部传入，narrator.js 不直接依赖任务模块）
 * @param {object} progress  questProgress 映射，用来标注每条线走到哪了（可缺省）
 * @returns {{ text: string, lit: string[] }}
 */
export function gateQuestTopic(scanText, affection, quests, progress = {}) {
  const scan = String(scanText || "");
  const list = Array.isArray(quests) ? quests : [];

  // 先找有没有报出任务名
  let hitQuest = null, hitAlias = "";
  for (const q of list) {
    const alias = titleAliases(q.title).find(a => scan.includes(a));
    if (alias) { hitQuest = q; hitAlias = alias; break; }
  }
  const genericHit = QUEST_GENERIC_KEYS.find(k => scan.includes(k));
  if (!hitQuest && !genericHit) return { text: "", lit: [] };

  // 好感度不够：不给内容，只给一条"你现在不该白给"的口径。
  if ((Number(affection) || 0) < QUEST_TALK_MIN_AFFECTION) {
    return {
      lit: [`任务线⟨好感不足${affection}/${QUEST_TALK_MIN_AFFECTION}⟩`],
      text: `\n\n【任务线·未解锁】玩家在向你打听剧情/任务怎么推。你现在跟他还没熟到那个份上（好感度 ${affection}，需要 ${QUEST_TALK_MIN_AFFECTION}）——按你当前的档位敷衍过去就行：可以含糊两句、可以让他自己摸索、可以说"等你我熟一点再说"，但**不要给出任何具体的任务步骤、人名或地点**。别解释这是好感度门槛，那是系统的事，不是她会说的话。`,
    };
  }

  // 报了名：只注入这一条线
  if (hitQuest) {
    const prog = progress?.[hitQuest.id];
    const state = prog?.status === "completed" || prog?.done ? "已完成"
      : prog?.status === "active" ? "进行中"
      : prog?.status === "locked_by_exclusive" ? "已被互斥线锁死"
      : "尚未接取";
    const curIdx = typeof prog?.stageIndex === "number" ? prog.stageIndex : -1;

    const stages = Array.isArray(hitQuest.stages) && hitQuest.stages.length
      ? hitQuest.stages.map((s, i) => {
          const mark = i === curIdx ? "▶当前" : i < curIdx ? "✓已过" : "○未到";
          const hint = s.playerHint ? `\n     该做什么: ${s.playerHint}` : "";
          return `  ${mark} 第${i + 1}节: ${s.description}${hint}`;
        }).join("\n")
      : "  （这条线没有分节，接了直接办）";

    return {
      lit: [`任务线⟨${hitQuest.title}⟩⟨词:${hitAlias}⟩`],
      text: `\n\n【任务线·${hitQuest.title}】玩家报出了这条线的名字，你可以陪他聊这一条——**只聊这一条**，别顺嘴把别的线也抖出来。
  当前状态: ${state}${hitQuest.giver ? `\n  交托者: ${hitQuest.giver}` : ""}
  这条线是怎么回事: ${hitQuest.description || "（无）"}
${stages}
说的时候按你当前的好感度档位把握分寸：档位低就点到为止、留一半；档位高才把思路替他理顺。标着「○未到」的节点是后面的事，别当成现在就该做的一股脑倒出来。这些是你看得见的世界，不是越权的元能力，照常用你自己的语气讲。`,
    };
  }

  // 只泛泛问，没报名：让她反问
  return {
    lit: [`任务线⟨泛问:${genericHit}⟩`],
    text: `\n\n【任务线·请他报全名】玩家在打听剧情/任务，但没说是哪一条。你确实看得见全盘，但一次把所有线都倒给他既没意思也帮不上忙——按你自己的语气反问他想问的是哪条线，让他把**任务的全名**说出来（任务面板上写着的那个名字），你才好细说。可以顺口调侃他记不住名字，但别自己猜、别替他列一串任务名。`,
  };
}

// 武学规划 · AI 现编主角的初始武学
// ============================================================================
// 【为什么单独一个模块】carryPlan 管「身上有什么」、placementPlan 管「人待在哪」，
// 这个管「主角会什么功夫」。只给主角用——群像卡里选出来的那一位，多半在卡里写了
// 独门招式/战斗描写，让 AI 照着现编成本作的「武学(skills)」，能直接派生出参战招式。
//
// 【AI 在这里被允许做什么】读主角的人设/招式描写，编 1-3 门武学，每门给
// name/moveType/quality/desc 四项。武学不必对上曲措乡的图鉴——deriveMovesetFromSkills
// 只认 name+moveType+quality+active 就能派生出能打的招式，所以自由现编是安全的。
// 数值（气血/威力）永远由内外功与品阶的公式裁决，AI 碰不到。

const MOVE_TYPES = ["攻击", "防御", "状态"];
const QUALITIES = ["白", "绿", "蓝", "紫", "橙", "红"];
const TIER_ORDER = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };

// 输出 token 上限，量级对齐 carryPlan——带思考的模型思考与正文共用这份额度。
export const SKILL_PLAN_MAX_TOKENS = 5000;

/**
 * 构造武学规划请求。
 * @param {object} player 主角草案（用它的 persona / name / 招式线索）
 * @param {object} opts { tier: 0-5 品阶上限, moveHints: string 招式线索文本 }
 * @returns {{system:string, user:string}}
 */
export function buildSkillPlan(player, opts = {}) {
  const tier = Number.isFinite(opts.tier) ? Math.max(0, Math.min(5, opts.tier)) : 0;
  const tierLabel = QUALITIES[tier];
  const system = `你在给中文武侠文字游戏「曲措乡」的主角现编初始武学。读下面这个人物的人设与战斗描写，给他配 1 到 3 门贴合的武学（招式路数）。

【怎么编】
先看此人是什么路数——刀客配刀法，剑客配剑术，用毒的配毒功，医者可有回血护体的功夫，拳脚家配拳掌腿法……名字要像武侠里的武学名（如「踏雪无痕」「寒江独钓式」），别用「攻击技能1」这类游戏术语，也别照搬「降龙十八掌」这种他家名门绝学。品阶别超过给定上限——初出茅庐的人就是白绿档，别一上来就红档神功。
一门武学只归一种路数：攻击（主动出手伤敌）、防御（格挡反制护身）、状态（下毒/迷乱/回气/疗伤等非直接伤害）。三种路数各配一门最实用；此人若明显只擅长某一路，也可只给一两门。

【每门武学给四项】
- name：武学名，不超过 6 字
- moveType：攻击／防御／状态 三选一
- quality：白／绿／蓝／紫／橙／红 之一，不要超过品阶上限「${tierLabel}档」
- desc：一句话，二十字以内，白话古文，写这门功夫使出来什么样

【输出格式】只输出一个 JSON 数组，不要任何说明文字、不要 markdown 围栏：
[{"name":"武学名","moveType":"攻击","quality":"绿","desc":"描述"}]`;

  const bits = [
    player?.name ? `姓名：${player.name}` : "",
    `品阶上限：${tierLabel}档`,
    opts.moveHints ? `卡里的招式线索：${String(opts.moveHints).replace(/\s+/g, " ").slice(0, 200)}` : "",
    player?.persona ? `人设：${String(player.persona).replace(/\s+/g, "").slice(0, 400)}` : "",
  ].filter(Boolean);
  const user = `请为这位主角现编初始武学：\n\n${bits.join("\n")}`;
  return { system, user };
}

/**
 * 把武学草案净化成本作 skills 的形状：
 *   { name, quality, level, exp, maxExp, stage, active, moveType, desc }
 * 品阶超过上限的压回，路数非法的丢弃，同路数只保留第一门为 active（切磋按路数各取
 * 一门出招，见 deriveMovesetFromSkills）。
 * @param {any} raw parseJsonLoose 的产出
 * @param {object} opts { tierCap: 0-5 }
 * @returns {Array<object>}
 */
export function sanitizeSkillPlan(raw, opts = {}) {
  if (!Array.isArray(raw)) return [];
  const cap = Number.isFinite(opts.tierCap) ? Math.max(0, Math.min(5, opts.tierCap)) : 0;
  const out = [];
  const seenName = new Set();
  const activeType = new Set();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name || "").trim().slice(0, 10);
    if (!name || seenName.has(name)) continue;
    const moveType = MOVE_TYPES.includes(row.moveType) ? row.moveType : "攻击";
    let quality = QUALITIES.includes(row.quality) ? row.quality : "白";
    if ((TIER_ORDER[quality] ?? 0) > cap) quality = QUALITIES[cap];
    const desc = String(row.desc || "").replace(/\s+/g, " ").trim().slice(0, 30);
    seenName.add(name);
    // 同一路数只让第一门 active（多门 active 时 deriveMovesetFromSkills 也只取第一门，
    // 这里显式收敛，免得界面上两门"攻击"都亮着 active 让人以为都会出）
    const active = !activeType.has(moveType);
    activeType.add(moveType);
    out.push({
      name, quality, level: 1, exp: 0, maxExp: 100, stage: "入门",
      active, moveType, ...(desc ? { desc } : {}),
    });
    if (out.length >= 3) break;   // 最多三门
  }
  return out;
}

/** 内功值 → 品阶档（供武学/装备的品阶上限）。TIER_NEIGONG=[5,23,41,59,77,95] */
export function tierFromNeigong(neigong) {
  const anchors = [5, 23, 41, 59, 77, 95];
  let tier = 0;
  for (let i = 0; i < anchors.length; i++) if ((neigong ?? 5) >= anchors[i]) tier = i;
  return tier;
}

/**
 * 把 NPC 的招式槽（moves：{攻击/防御/状态/回气 → {name,archetype,desc}}）转成主角武学。
 * 群像卡里选出来的主角，扫描时已按 NPC 扫出了 moves；选他当主角时用这个把已有的招式
 * 直接落成武学草案，省一次 AI 调用，玩家仍可点「AI 现编」重生成或手改。
 * @param {object} moves NPC 的 moves
 * @param {number} levelCap 0-5，决定武学品阶
 * @returns {Array<object>}
 */
export function movesToSkills(moves, levelCap = 0) {
  if (!moves || typeof moves !== "object") return [];
  const quality = QUALITIES[Math.max(0, Math.min(5, levelCap))] || "白";
  const out = [];
  for (const slot of ["攻击", "防御", "状态"]) {
    const m = moves[slot];
    const name = String(m?.name || "").trim();
    if (!name) continue;
    out.push({
      name: name.slice(0, 10), quality, level: 1, exp: 0, maxExp: 100, stage: "入门",
      active: true, moveType: slot, ...(m?.desc ? { desc: String(m.desc).slice(0, 30) } : {}),
    });
  }
  return out;
}

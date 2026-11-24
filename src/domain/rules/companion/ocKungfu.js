// OC 冒险者 kungfu.moves → 战斗招式表（专属出招表的 slot 形）
// ============================================================================
// 为什么单拎一个文件：OC 数据卡写的是 kungfu:{school, moves:[{name,desc}]}，
// 但战斗引擎只认 deriveMovesetFromSig 的 slot 形 {攻击/防御/状态/疗伤:{name,desc,archetype?}}。
// 这份翻译同时被两条路用：
//   ① 入队伙伴（companion.createImportedCompanion → 团战/切磋队友）
//   ② 房间里的 OC 本人当对手（npcMovesets.deriveSignatureMoveset 的兜底）
// 之前只有①接了线、且按"第 N 招进第 N 槽"硬塞——抱头蹲防这种防御招被塞进状态槽；
// ②完全没接，朵朵当对手时用的是通用随机招（野球拳/铁布衫/连环腿）。
// 现在两条路共用这里：按招名+描述判断是攻/防/状态/疗伤，再落到对应槽。
// ============================================================================

import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

// 槽位优先序（同分时先来先占）：沿用旧约定「首招攻击，其次状态，再次防御」，
// 招名描述都判不出倾向的 OC（只有招名没有描述）行为与旧版一致。
const SLOT_ORDER = ["攻击", "状态", "防御", "疗伤"];

// 关键词（招名+描述合并匹配，每命中一次记一分）。刻意不含"乱""手"这类
// 在武侠招名里到处都是的单字——"漫天花雨撒金钱"的"乱扔"不能把攻击招判成状态招。
const KEYWORDS = {
  疗伤: /回春|疗伤|回血|治愈|恢复[^，。]{0,6}(气血|生命)/g,
  防御: /防|挡|盾|招架|格挡|护体|护盾|庇|守|免疫|蹲|反弹|反击|闪避|回锋|不动|垒|无敌|佑/g,
  状态: /迷|惑|致乱|混乱|眩晕|控制|封穴|点穴|降低|削弱|沉睡|睡眠|致盲|麻痹|减速|蛊|毒|缚|定身|冰封|幻|魇|恐惧|干扰|疲劳|提升|蓄|爆发|倍/g,
  攻击: /击|伤害|斩|打|刺|掌|拳|剑|刀|枪|踢|劈|砍|镖|针|钉|箭|鞭|镰|戟|棍|斧|杀|破|崩|噬|撕裂/g,
};

// 状态槽按描述挑更贴切的原型（同档位数值由原型×品阶决定，招名/描述由 OC 数据决定）
const STATUS_ARCHETYPES = [
  [/毒|蛊|淬/, "施毒"],
  [/封穴|点穴|禁招|缠|缚|降低/, "封穴"],
  [/提升|蓄|爆发|倍/, "蓄势"],
];

// 没有对应招式的槽位，给一个朴素的保底招（不用原型名当招名——"硬攻"不像招式名）
const DEFAULT_SLOT = {
  攻击: { name: "拼力一击", desc: "没有压箱的绝招，凭一身力气正面硬拼。" },
  防御: { name: "架招守御", desc: "收紧门户，见招拆招。" },
  状态: { name: "虚实相扰", desc: "虚晃一招，扰乱对手的节奏。" },
};

const scoreOf = (text, slot) => (text.match(KEYWORDS[slot]) || []).length;

// 每招对每个槽的得分；首招对攻击槽 +0.5（"首招作攻击"的老约定，描述含糊时仍偏攻击）
function slotScores(move, index) {
  const text = `${move.name || ""}${move.desc || ""}`;
  const scores = {};
  for (const slot of SLOT_ORDER) scores[slot] = scoreOf(text, slot);
  if (index === 0) scores.攻击 += 0.5;
  return scores;
}

/**
 * kungfu.moves [{name,desc}] → deriveMovesetFromSig 的 slot 形。
 * 先按得分从高到低给每招分槽（一招一槽、一槽一招），疗伤槽只收明确写了回血的招；
 * 没分到招的攻/状/防槽补保底招，保证 OC 本人的招组不会混进通用随机招。
 * @returns {object|null} 没写招式的 OC 返回 null（调用方回退品阶随机招）
 */
export function ocSignatureMoves(adv) {
  const moves = (Array.isArray(adv?.kungfu?.moves) ? adv.kungfu.moves : []).filter((m) => m?.name);
  if (!moves.length) return null;

  const candidates = [];
  moves.forEach((m, i) => {
    const scores = slotScores(m, i);
    SLOT_ORDER.forEach((slot, order) => {
      if (slot === "疗伤" && scores[slot] <= 0) return;
      candidates.push({ i, slot, score: scores[slot], order });
    });
  });
  candidates.sort((a, b) => b.score - a.score || a.i - b.i || a.order - b.order);

  const sig = {};
  const used = new Set();
  for (const { i, slot } of candidates) {
    if (used.has(i) || sig[slot]) continue;
    const m = moves[i];
    const entry = { name: m.name, desc: m.desc };
    if (slot === "状态") {
      const hit = STATUS_ARCHETYPES.find(([re]) => re.test(`${m.name}${m.desc || ""}`));
      if (hit) entry.archetype = hit[1];
    }
    sig[slot] = entry;
    used.add(i);
  }
  for (const slot of ["攻击", "防御", "状态"]) {
    if (!sig[slot]) sig[slot] = { ...DEFAULT_SLOT[slot] };
  }
  return sig;
}

const OC_BY_NAME = new Map([...ADVENTURER_POOL, ...ADVENTURER_POOL_IP].map((a) => [a.name, a]));

// 按名字查 OC 的专属出招表（房间里的 OC 本人当对手时用）。不是 OC 或没写招式 → null。
export function ocSignatureMovesByName(name) {
  const adv = OC_BY_NAME.get(name);
  return adv ? ocSignatureMoves(adv) : null;
}

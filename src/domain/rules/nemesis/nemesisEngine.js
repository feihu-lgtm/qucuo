// ── WO-23A 宿敌谱名册底座（纯函数，无 AI，无 UI）──────────────────────────
// 账本固定 varTree.世界.宿敌谱，顶层形状硬契约（听调/听宣并行件按此消费）：
//   varTree.世界.宿敌谱[faction].entries[entryId] = entry
// 只认五势力：鱼定土司府/黑风寨/雪山派/唐门/五仙教——散人与其他势力不入谱。
// entry 最小结构：{id,name,faction,tier,baseRole,epithet,tauntLine,rumorSnippet,
//   scars,grudge,status,firstTurn,lastTurn}——epithet/taunt/rumor 留 null 待
//   nemesis.epithet AI 起号工单；晋升/伤痕/grudge 全是确定性系统账，不许 AI 自证。
// 本单不做：假死重逢/每日争位/茶馆传闻/收服/UI/prompt 注入。

import { getNpcFaction } from "../../data/factions/npcFactions.js";

export const NEMESIS_FACTIONS = Object.freeze(["鱼定土司府", "黑风寨", "雪山派", "唐门", "五仙教"]);
export const NEMESIS_TIER_CAP = 4;

// entryId deterministic：faction+name+firstTurn 三段。同名撞键防护靠「按名扫描归并」
// ——同一势力同名者永远归并到已存在 entry（见 findNemesisEntry），新 id 只在谱中
// 无此名时生成，id 内嵌名字天然不与异名者相撞。
export function nemesisEntryId(faction, name, firstTurn) {
  const slug = (s) => String(s || "").replace(/\s+/g, "");
  return `nm_${slug(faction)}_${slug(name)}_${firstTurn | 0}`;
}

// 在势力册里按名扫描（不入谱势力/空册安全回 null）
export function findNemesisEntry(roster, faction, name) {
  const entries = roster?.[faction]?.entries;
  if (!entries || typeof entries !== "object" || !name) return null;
  return Object.values(entries).find((e) => e && e.name === name) || null;
}

// ── 伤痕五类映射（保守，宁可 false negative）─────────────────────────────
// 只从玩家最后一次有效伤害招式（damageToB>0）的招式字段推属性；
// 优先级：点穴 > 火毒 > 寒冰 > 利刃 > 钝击——多特征命中取最特异者。
// 关键词命中招式 name/applyStatus/desc 任一；全不中返回 null（不记，不强猜）。
const SCAR_RULES = [
  { attr: "点穴", re: /点穴|封穴|麻穴|昏厥|指穴/ },
  { attr: "火毒", re: /火|毒|灼|焰|蛊/ },
  { attr: "寒冰", re: /寒|冰|霜|冻|雪/ },
  { attr: "利刃", re: /剑|刀|刃|刺|斩|锋|匕|戟|枪尖/ },
  { attr: "钝击", re: /拳|掌|锤|棍|杖|砸|撞|肘|膝|腿|踢/ },
];
export function scarAttrOfMove(move) {
  if (!move || typeof move !== "object") return null;
  const text = `${move.name || ""}${typeof move.applyStatus === "string" ? move.applyStatus : (move.applyStatus?.name || "")}${move.desc || ""}`;
  for (const rule of SCAR_RULES) {
    if (rule.re.test(text)) return rule.attr;
  }
  return null;
}

// 从 battleLog 逆序找玩家最后一次有效伤害（damageToB>0）的招式推伤痕属性；
// 找不到/不可辨认返回 null。
// 读侧硬契约形状 scars:[{kind,note,turn}]——kind=五类属性，note deterministic 拼
// 「最后一击：招式名」（无招式名空串但字段存在），不用 move 字段替代 kind。
export function scarFromBattleLog(battleLog) {
  if (!Array.isArray(battleLog)) return null;
  for (let i = battleLog.length - 1; i >= 0; i--) {
    const row = battleLog[i];
    if (!row || !(row.result?.damageToB > 0)) continue;
    const attr = scarAttrOfMove(row.playerMove);
    if (!attr) return null;
    const moveName = row.playerMove?.name || "";
    return { kind: attr, note: moveName ? `最后一击：${moveName}` : "" };
  }
  return null;
}

// ── 名册记账（纯函数：输入 roster 不原地改，返回新 roster 或 null=无账）──────
// outcome "lose"（玩家落败）：入谱或晋升——tier+1 cap4，grudge+1；
//   幂等：entry.lastTurn === turn 视为同一场重复结算，不连升不重复记。
// outcome "win"（敌方落败）：scarAttr 非空才追加持久伤痕（同 turn 去重）。
// 五势力外/无 outcome 返回 null——调用方零账。
export function recordNemesisDuel(roster, npc, outcome, { turn = 0, scar = null, place = "" } = {}) {
  // 势力归属权威：getNpcFaction（覆盖驻地 NPC id 映射+random passer 特判），不裸读 npc.faction
  const faction = getNpcFaction(npc) || (typeof npc?.faction === "string" ? npc.faction : null);
  if (!npc?.name || !faction || !NEMESIS_FACTIONS.includes(faction)) return null;
  if (outcome !== "lose" && outcome !== "win") return null;
  const factionBook = roster?.[faction] || { entries: {} };
  const entries = { ...(factionBook.entries || {}) };
  const existing = findNemesisEntry(roster, faction, npc.name);
  let changed = false;

  if (existing) {
    if (existing.lastTurn === turn) return null; // 同一场幂等
    const next = { ...existing, lastTurn: turn };
    if (outcome === "lose") {
      next.tier = Math.min(NEMESIS_TIER_CAP, (existing.tier || 1) + 1);
      next.grudge = (existing.grudge || 0) + 1;
      changed = true;
    } else if (scar) {
      const scars = Array.isArray(existing.scars) ? existing.scars : [];
      if (!scars.some((s) => s && s.turn === turn)) {
        next.scars = [...scars, { kind: scar.kind, note: scar.note || "", turn }];
        changed = true;
      }
    }
    if (!changed) return null;
    entries[existing.id] = next;
  } else {
    if (outcome !== "lose") {
      // win 对未入谱者：五势力结仇起点——首胜不留 tier 晋升，但留册建档+伤痕（如有）
      if (!scar) return null; // 无可辨认伤痕不入谱（宁可 false negative）
    }
    const id = nemesisEntryId(faction, npc.name, turn);
    const entry = {
      id, name: npc.name, faction,
      tier: outcome === "lose" ? 1 : 1,
      baseRole: npc.baseRole || npc.role || npc.tag || "",
      epithet: null, tauntLine: null, rumorSnippet: null,
      // 结仇原委（硬契约）：系统 deterministic 拼句，首次入谱写定后永不覆盖——
      // 之后 deeper 结仇只加 grudge，origin 保持最初由来。
      origin: {
        turn, place,
        summary: `在${place || "江湖"}切磋${outcome === "lose" ? "落败" : "取胜"}结怨`,
      },
      scars: outcome === "win" && scar ? [{ kind: scar.kind, note: scar.note || "", turn }] : [],
      grudge: outcome === "lose" ? 1 : 0,
      status: "active", firstTurn: turn, lastTurn: turn,
    };
    entries[id] = entry;
  }
  return { ...(roster || {}), [faction]: { ...factionBook, entries } };
}

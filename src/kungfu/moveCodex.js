// 全图武学总录 · 三个招式数据源的唯一合并出口
// ============================================================================
// 【为什么需要这个文件】项目里的招式散在四处，形状各不相同，谁都没法一次看全：
//   ① 武馆  SKILL_CATALOG（qucuoKungfu.js）——武馆卖的、可修炼的，56 门
//   ② 特殊  NPC_SIGNATURE_MOVES（npcSignatureMoves.js）——具名人物的专属招，
//           40 人共 168 招，只写了 archetype+名字+描述，数值要过 resolveArchetype
//           按主人的档位现算
//   ③ 制式  MOVE_POOL（npcGeneration.js）——六品阶×三类的通用招池，18 个
//   ④ 博弈  BURDEN_MOVE_POOL（同上）——高风险高回报那批，16 个
// 合计两百五十多招。而图鉴此前只读 ①，还被一张硬编码的 SKILL_GROUP_LABEL
// 白名单卡住，只显示玉泉/雪山/锦官三家共 17 门——独孤/青城/峨眉/唐门/血刀/三星
// 那 39 门连同全部专属招、制式招、博弈招，玩家在图鉴里一个都看不到。
//
// 这里把四个源归一成同一种形状，让「想看全部招式」这件事只有一个入口。
// 归一后的条目形状（跟 move 对象兼容，直接喂得进 itemEffectText 的 MOVE_RULES）：
//   { key, name, source, group, owner?, type, quality, desc, ...效果标志位 }
//
// 【为什么不把四个源合并成一份数据】它们的生命周期不一样：武馆武学要能被购买与
// 修炼（有 stage/exp）、专属招属于具体人物且数值随主人档位浮动、制式招是按品阶
// 现取的模板。硬并成一张表会把这些差异抹平。所以合并的是**读取口**，不是存储。

import { SKILL_CATALOG, SKILL_TYPE } from "./qucuoKungfu.js";
import { NPC_SIGNATURE_MOVES, SIGNATURE_SLOT_KEYS } from "../npcSignatureMoves.js";
import { MOVE_POOL, BURDEN_MOVE_POOL } from "../npcGeneration.js";
import { resolveArchetype } from "../combat/moveArchetypes.js";
import { RESIDENT_NPCS } from "../residentNpcs.js";

// 专属招的数值要按主人的档位现算，而档位的真值源是 RESIDENT_NPCS 的 levelCap。
// 不在专属招表里另存一份 tier —— 存两份就会漂移（这个项目已经在别处栽过）。
const TIER_BY_NAME = (() => {
  const m = {};
  for (const arr of Object.values(RESIDENT_NPCS || {}))
    for (const n of arr || []) if (n && n.name) m[n.name] = n.levelCap;
  return m;
})();

// 专属招表里每个 NPC 的 tier 字段就是其品阶档位（0白…5红），
// 用来把 archetype 现算成这一档实际的数值。缺省按蓝档。
const QUALITY_BY_TIER = ["白", "绿", "蓝", "紫", "橙", "红"];

// 武馆武学的展示名。**注意这里只是「起个好听的名字」，不再当白名单用**——
// 查不到名字的分组照样收录，用 key 兜底显示。
// 图鉴那个 bug 就是把这张表当白名单：`.filter(([k]) => SKILL_GROUP_LABEL[k])`，
// 新加的六个门派全被静默丢掉，而且丢得毫无痕迹。
export const SKILL_GROUP_LABEL = {
  玉泉: "玉泉练武场", 雪山: "雪山派", 锦官: "锦官城武馆",
  独孤: "令狐冲墓·独孤遗篇", 青城: "青城派·三清殿", 峨眉: "峨眉剑庐",
  唐门: "唐门暗巷", 血刀: "血刀营地（掉落）", 三星: "青铜神树下（试炼）",
};

export const MOVE_SOURCE = {
  WUGUAN: "武馆",   // 可购买可修炼
  SIGNATURE: "专属", // 具名人物的看家本领
  STANDARD: "制式", // 通用招池，人人可能会
  BURDEN: "博弈",   // 高风险高回报
};

// ── ① 武馆武学 ────────────────────────────────────────────────────────────
function collectWuguan() {
  const out = [];
  for (const [k, arr] of Object.entries(SKILL_CATALOG)) {
    if (!Array.isArray(arr)) continue; // 突破价目表那类非数组 key 跳过
    for (const s of arr) {
      out.push({
        ...s,                                   // 特效标志位原样带出，图鉴才显示得出来
        key: `wuguan:${s.id || s.name}`,
        name: s.name,
        source: MOVE_SOURCE.WUGUAN,
        group: SKILL_GROUP_LABEL[k] || k,       // 查不到名字用 key 兜底，绝不丢条目
        skillType: s.type,                      // 招式/内功/轻功
        type: s.moveType,                       // 攻击/防御/状态（内功轻功也写了这个）
        quality: s.quality,
        price: s.price,
        desc: s.desc,
      });
    }
  }
  return out;
}

// ── ② 专属招 ──────────────────────────────────────────────────────────────
// 每条只写了 archetype + 名字 + 描述，数值要按主人的档位过 resolveArchetype 现算。
function collectSignature() {
  const out = [];
  for (const [owner, data] of Object.entries(NPC_SIGNATURE_MOVES)) {
    if (!data || typeof data !== "object") continue;
    const tier = typeof TIER_BY_NAME[owner] === "number" ? TIER_BY_NAME[owner] : 2;
    for (const slot of SIGNATURE_SLOT_KEYS) {
      const mv = data[slot];
      if (!mv || !mv.name) continue;
      let resolved = {};
      try {
        // 回气/疗伤槽有时不写 archetype（走保底原型），resolveArchetype 拿不到就返回空
        resolved = (mv.archetype ? resolveArchetype(mv.archetype, tier) : resolveArchetype(slot, tier)) || {};
      } catch { resolved = {}; }
      out.push({
        ...resolved,                             // 现算出来的数值与标志位
        ...(mv.effects || {}),                   // 条目上手写的覆盖项优先
        key: `sig:${owner}:${slot}`,
        name: mv.name,
        source: MOVE_SOURCE.SIGNATURE,
        group: owner,
        owner,
        slot,
        type: slot === "攻击" || slot === "防御" || slot === "状态" ? slot : "状态",
        quality: QUALITY_BY_TIER[Math.max(0, Math.min(5, tier))],
        archetype: mv.archetype || slot,
        unlearnable: data.unlearnable === true,
        desc: mv.desc,
      });
    }
  }
  return out;
}

// ── ③ 制式招池 ────────────────────────────────────────────────────────────
function collectStandard() {
  const out = [];
  for (const [quality, byType] of Object.entries(MOVE_POOL || {})) {
    for (const [type, mv] of Object.entries(byType || {})) {
      if (!mv || !mv.name) continue;
      out.push({
        ...mv,
        key: `std:${quality}:${type}`,
        name: mv.name,
        source: MOVE_SOURCE.STANDARD,
        group: `制式·${quality}档`,
        type,
        quality,
        desc: mv.desc || `${quality}档通用${type}招，江湖上人人可能会的一手。`,
      });
    }
  }
  return out;
}

// ── ④ 博弈层 ──────────────────────────────────────────────────────────────
function collectBurden() {
  const out = [];
  for (const [id, mv] of Object.entries(BURDEN_MOVE_POOL || {})) {
    if (!mv || !mv.name) continue;
    out.push({
      ...mv,
      key: `burden:${id}`,
      name: mv.name,
      source: MOVE_SOURCE.BURDEN,
      group: "博弈层·高风险高回报",
      type: mv.type,
      quality: mv.quality || "紫",
      desc: mv.desc || "以险搏胜的一手，赢面大，输了也疼。",
    });
  }
  return out;
}

// ── 唯一出口 ──────────────────────────────────────────────────────────────
// 返回全图所有招式的归一列表。纯函数、无副作用，图鉴/调试面板/统计都从这里取。
export function buildMoveCodex() {
  return [...collectWuguan(), ...collectSignature(), ...collectStandard(), ...collectBurden()];
}

// 按来源分桶，图鉴分页用。
export function moveCodexBySource() {
  const all = buildMoveCodex();
  const buckets = {};
  for (const s of Object.values(MOVE_SOURCE)) buckets[s] = [];
  for (const m of all) (buckets[m.source] = buckets[m.source] || []).push(m);
  return buckets;
}

// 同一来源内再按 group 分组，图鉴列表用。返回 [[组名, 条目[]], ...]
export function groupMoves(list) {
  const map = new Map();
  for (const m of list) {
    if (!map.has(m.group)) map.set(m.group, []);
    map.get(m.group).push(m);
  }
  return [...map.entries()];
}

// 统计，图鉴顶栏显示"共 N 招"用。
export function moveCodexStats() {
  const all = buildMoveCodex();
  const bySource = {};
  for (const m of all) bySource[m.source] = (bySource[m.source] || 0) + 1;
  return { total: all.length, bySource };
}

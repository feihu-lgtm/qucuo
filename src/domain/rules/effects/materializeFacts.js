// WO-11 十二律世界事实落盘引擎：把判官杀青的铁案 facts（契约 C 十二律事实码）
// 一次性编译成可落盘的状态写指令。纯函数——不碰 store、不碰 Date.now/Math.random，
// 同一 (state, facts, compiledWarrants) 输入必得同一输出，可重放可对账。
//
// 输入：
//   state             状态袋快照 { inv, room, char, skills, exp, pot, dao, flags, time, varTree, claimedMilestones, companionState, ... }
//   facts             JudgeVerdict.facts：[{ id, op, ... }]
//   compiledWarrants  WO-10 编译产物索引：factId/warrantId → 物品实例或武学记录
//                    （接受对象表或 Map；键按 factId 优先、warrantId 兜底）
// 输出 { changes, patches, receipts, logs }：
//   changes   状态切片直写（inv/room/char/skills/exp/pot/dao/flags/claimedMilestones），
//             由 commitRound 的统一 changes 写入口落盘
//   patches   标准 applyPatches 指令集（MUTATE_SOCIAL/BIND_OR_SETTLE_PACT/MUTATE_COMPANION/ALTER_WORLD_SCENE）
//   receipts  落账回执（装备/丹药/武学卡，WO-14 天机落账卡消费）
//   logs      事实短句日志行
//
// 保守原则：编译产物缺失或实体找不到时，绝不丢事实——能降格落地就降格落地
// （如 GRANT_ITEM 无编译产物时用事实字段拼白档兜底物），实在无法落地才进 logs 记异。

import { QUALITY, statsForQuality } from "../economy/equipment.js";
import { mintItemId } from "../clapboard/entityId.js";
import { hpFromNeigong } from "../npc/npcGeneration.js";
import { effectiveMaxHp } from "../../data/kungfu/qucuoKungfu.js";
import { makeBuffFlag, mergeCombatBuff } from "../../../utils/buffSystem.js";
import { STAGES } from "../../../utils/mudHelpers.js";

const PLAYER = "player";

function lookupCompiled(compiledWarrants, fact) {
  if (!compiledWarrants) return null;
  const keys = [fact?.id, fact?.warrantId, fact?.factId].filter(Boolean);
  if (compiledWarrants instanceof Map) {
    for (const k of keys) if (compiledWarrants.has(k)) return compiledWarrants.get(k);
    return null;
  }
  for (const k of keys) if (compiledWarrants[k]) return compiledWarrants[k];
  return null;
}

function qualityStepUp(quality) {
  const i = QUALITY.indexOf(quality);
  if (i === -1) return QUALITY[0];
  return QUALITY[Math.min(QUALITY.length - 1, i + 1)];
}

// 在 inv / room.items / room.npcs[].carriedItems 三个池里按 itemId（或名字兜底）定位
function locateItem(state, itemId, itemName) {
  // 留档条目（dropped/sold/stolen）只是外观账，不再持有实物——定位时必须跳过，
  // 否则第二人归还同名器物时会错配到前者的留档，复制出神兵
  const match = (e) => e && typeof e === "object" && !e.dropped && !e.sold && !e.stolen
    && ((itemId && e.id === itemId) || (!itemId && itemName && e.name === itemName) || (itemId && itemName && e.name === itemName && !e.id));
  const invIdx = (state.inv || []).findIndex(match);
  if (invIdx !== -1) return { pool: "inv", index: invIdx, item: state.inv[invIdx] };
  const groundIdx = (state.room?.items || []).findIndex(match);
  if (groundIdx !== -1) return { pool: "ground", index: groundIdx, item: state.room.items[groundIdx] };
  for (let n = 0; n < (state.room?.npcs || []).length; n += 1) {
    const idx = (state.room.npcs[n].carriedItems || []).findIndex(match);
    if (idx !== -1) return { pool: "npc", npcIndex: n, index: idx, item: state.room.npcs[n].carriedItems[idx] };
  }
  return null;
}

export function materializeFacts(state, facts, compiledWarrants) {
  const changes = {};
  const patches = [];
  const receipts = [];
  const logs = [];
  const turn = state.time ?? 0;

  // 工作副本：只在内存里演进，最终一次性写进 changes（纯函数，不改入参）
  let inv = (state.inv || []).map((e) => (e && typeof e === "object" ? { ...e } : e));
  let room = state.room ? { ...state.room, items: [...(state.room.items || [])], npcs: (state.room.npcs || []).map((n) => ({ ...n, carriedItems: (n.carriedItems || []).map((c) => ({ ...c })) })) } : state.room;
  let char = state.char ? { ...state.char, hp: [...(state.char.hp || [0, 0])], special: { ...(state.char.special || {}) } } : state.char;
  let skills = (state.skills || []).map((s) => ({ ...s }));
  let flags = [...(state.flags || [])];
  let exp = state.exp ?? 0;
  let pot = state.pot ?? 0;
  let dao = state.dao ? { ...state.dao } : state.dao;
  let claimed = state.claimedMilestones instanceof Set ? new Set(state.claimedMilestones) : new Set(state.claimedMilestones || []);
  let pendingCombatBuff = char?.pendingCombatBuff ? { ...char.pendingCombatBuff } : undefined;

  let invDirty = false; let roomDirty = false; let charDirty = false;
  let skillsDirty = false; let flagsDirty = false; let daoDirty = false; let claimedDirty = false;
  let expDirty = false; let potDirty = false;

  const syncWorkState = () => ({ ...state, inv, room, char, skills, flags, exp, pot, dao });

  for (const fact of facts || []) {
    if (!fact || !fact.op) continue;
    switch (fact.op) {
      // ── 1. GRANT_ITEM：入 inv + 装备/丹药回执 ──
      case "GRANT_ITEM": {
        let item = lookupCompiled(compiledWarrants, fact);
        if (!item) {
          // 保守不丢事实：编译缺失时按事实字段拼白档兜底物
          if (!fact.itemName) { logs.push({ t: "err", text: `  ⛔ 事实 ${fact.id} 无物可授（缺编译产物与物名）` }); break; }
          item = { id: (typeof fact.itemId === "string" && /^it_[0-9a-f]+/.test(fact.itemId)) ? fact.itemId : mintItemId(fact.itemName, turn, 0), name: fact.itemName, category: fact.category || "misc", quality: fact.quality || "白", desc: "来历成谜的物件（编译缺失兜底）" };
        }
        if (inv.some((e) => e && e.id && e.id === item.id)) break; // 幂等：同 id 不重复入袋
        inv.push({ ...item });
        invDirty = true;
        receipts.push({ kind: "grant_item", factId: fact.id || "", item: { ...item } });
        logs.push({ t: "item", text: `  获得 ${item.name}${item.quality ? `（${item.quality}）` : ""}` });
        break;
      }

      // ── 2. TRANSFER_ITEM：三池间原子增删 ──
      case "TRANSFER_ITEM": {
        const loc = locateItem({ ...state, inv, room }, fact.itemId, fact.itemName);
        if (!loc) { logs.push({ t: "err", text: `  ⛔ 事实 ${fact.id}：找不到器物 ${fact.itemName || fact.itemId}` }); break; }
        const moving = { ...loc.item };
        // 源头摘除：玩家给 NPC 的反向不管；NPC → 玩家时源头条目置 dropped:true
        // （装备外观同步刷新靠这个标记，条目留档不删）
        if (loc.pool === "inv") inv.splice(loc.index, 1);
        else if (loc.pool === "ground") room.items.splice(loc.index, 1);
        else if (fact.to === PLAYER) room.npcs[loc.npcIndex].carriedItems[loc.index] = { ...loc.item, dropped: true };
        else room.npcs[loc.npcIndex].carriedItems.splice(loc.index, 1);
        invDirty = true; roomDirty = true;
        // 目标入池
        if (fact.to === PLAYER) {
          if (!inv.some((e) => e && e.id && e.id === moving.id)) inv.push({ ...moving, dropped: undefined, equipped: false });
        } else if (fact.to === "ground" || fact.to === "room") {
          room.items.push({ ...moving, dropped: undefined, equipped: false });
        } else if (fact.to) {
          const target = room.npcs.find((n) => n.name === fact.to);
          if (target) target.carriedItems.push({ ...moving, dropped: undefined, equipped: false });
          else room.items.push({ ...moving, dropped: undefined, equipped: false }); // 目标不在场：落地上，不丢事实
        }
        const fromLabel = loc.pool === "inv" ? "你" : loc.pool === "ground" ? "地上" : room.npcs[loc.npcIndex]?.name || "某人";
        const toLabel = fact.to === PLAYER ? "你" : fact.to === "ground" || fact.to === "room" ? "地上" : fact.to;
        logs.push({ t: "sys", text: `  ${moving.name}：${fromLabel} → ${toLabel}` });
        break;
      }

      // ── 3. REFORGE_ITEM：原地升阶 + 重算数值 + 新词条 + 器史 ──
      case "REFORGE_ITEM": {
        const loc = locateItem({ ...state, inv, room }, fact.itemId, fact.itemName);
        if (!loc) { logs.push({ t: "err", text: `  ⛔ 事实 ${fact.id}：找不到可重铸之器 ${fact.itemName || fact.itemId}` }); break; }
        const pool = loc.pool === "inv" ? inv : loc.pool === "ground" ? room.items : room.npcs[loc.npcIndex].carriedItems;
        const old = pool[loc.index];
        const nextQuality = qualityStepUp(old.quality);
        const restatted = {
          ...old,
          quality: nextQuality,
          ...statsForQuality(old.category, nextQuality),
          affixes: [...(old.affixes || []), ...(fact.affix ? [fact.affix] : [])],
          history: [...(old.history || []), { turn, text: fact.note || `重铸升阶（${old.quality || "白"}→${nextQuality}）` }],
        };
        pool[loc.index] = restatted;
        invDirty = true; roomDirty = true;
        receipts.push({ kind: "reforge_item", factId: fact.id || "", item: { ...restatted } });
        logs.push({ t: "stat", text: `  ${old.name} 重铸升阶：${old.quality || "白"} → ${nextQuality}` });
        break;
      }

      // ── 4. BESTOW_SKILL：入 skills + 同路数 active 槽位 ──
      case "BESTOW_SKILL": {
        let skill = lookupCompiled(compiledWarrants, fact);
        if (!skill) {
          if (!fact.skillName) { logs.push({ t: "err", text: `  ⛔ 事实 ${fact.id} 无武学可授（缺编译产物与武学名）` }); break; }
          skill = { id: `kf_fallback_${fact.id || "x"}`, name: fact.skillName, type: "外功", quality: fact.quality || "白", level: 1, exp: 0, maxExp: 100, stage: "入门", active: false, source: "奇遇" };
        }
        if (skills.some((s) => s.id === skill.id || s.name === skill.name)) break; // 已习得：幂等跳过
        const entry = { ...skill };
        // 同路数 active 槽位：新武学带 active 上岗时，同 moveType/同类型的在役旧武学退槽
        if (entry.active) {
          const routeKey = entry.moveType || entry.type;
          skills = skills.map((s) => (s.active && (s.moveType || s.type) === routeKey ? { ...s, active: false } : s));
        }
        skills.push(entry);
        skillsDirty = true;
        receipts.push({ kind: "bestow_skill", factId: fact.id || "", skill: { ...entry } });
        logs.push({ t: "skill", text: `  习得武学 ${entry.name}${entry.quality ? `（${entry.quality}）` : ""}` });
        break;
      }

      // ── 5. PROGRESS_CULTIVATION：修为增减 / 武学 stage 推进 ──
      case "PROGRESS_CULTIVATION": {
        if (fact.expDelta) { exp = Math.max(0, exp + fact.expDelta); expDirty = true; }
        if (fact.potDelta) { pot = Math.max(0, pot + fact.potDelta); potDirty = true; }
        if (fact.neigongDelta && char) {
          const cur = char.neigong ?? 0;
          const next = Math.max(0, Math.min(100, cur + fact.neigongDelta));
          // 同步重算气血上限（复用 trainNeigong 的口径：hpFromNeigong(neigong, 体魄)）
          const tiPo = char.special?.体魄 ?? 5;
          const oldMax = char.hp?.[1] ?? hpFromNeigong(cur, tiPo);
          const newMax = hpFromNeigong(next, tiPo);
          const delta = Math.max(0, newMax - oldMax);
          char.neigong = next;
          char.hp = [Math.min(newMax, (char.hp?.[0] ?? newMax) + delta), newMax];
          charDirty = true;
          logs.push({ t: "stat", text: `  内功 ${cur}→${next} · 气血上限 ${oldMax}→${newMax}` });
        }
        if (fact.waigongDelta && char) {
          const prevWai = char.waigong ?? 0;
          char.waigong = Math.max(0, Math.min(100, prevWai + fact.waigongDelta));
          charDirty = true;
          logs.push({ t: "stat", text: `  外功 ${prevWai}→${char.waigong}` });
        }
        if (fact.skillId || fact.skillName) {
          const idx = skills.findIndex((s) => (fact.skillId && s.id === fact.skillId) || (fact.skillName && s.name === fact.skillName));
          if (idx !== -1) {
            const curStage = skills[idx].stage || STAGES[0];
            const si = STAGES.indexOf(curStage);
            const target = fact.stage && STAGES.includes(fact.stage)
              ? fact.stage
              : STAGES[Math.min(STAGES.length - 1, si + (fact.stageDelta ?? 1))];
            if (target !== curStage) {
              skills[idx] = { ...skills[idx], stage: target };
              skillsDirty = true;
              logs.push({ t: "stat", text: `  ${skills[idx].name} 境界精进：${curStage} → ${target}` });
            }
          }
        }
        break;
      }

      // ── 6. SHIFT_SPECIAL_STAT：七维 ±1 + 里程碑登记 ──
      case "SHIFT_SPECIAL_STAT": {
        if (!fact.attr || !char) break;
        if (fact.milestoneKey && claimed.has(fact.milestoneKey)) {
          logs.push({ t: "sys", text: `  里程碑 ${fact.milestoneKey} 已登记过，跳过重复增减` });
          break;
        }
        const delta = fact.delta ?? (fact.direction === "down" ? -1 : 1);
        const cur = char.special[fact.attr] ?? 5;
        const next = Math.max(0, Math.min(10, cur + delta));
        char.special[fact.attr] = next;
        charDirty = true;
        if (fact.milestoneKey) { claimed.add(fact.milestoneKey); claimedDirty = true; }
        logs.push({ t: "stat", text: `  ${fact.attr} ${cur}→${next}` });
        break;
      }

      // ── 7. CHANGE_VITALS_SILVER：气血/银两/因果/业障安全增减 ──
      case "CHANGE_VITALS_SILVER": {
        if (fact.hpDelta && char) {
          const cap = effectiveMaxHp(char.hp[1], skills);
          const prevHp = char.hp[0];
          const next = Math.max(0, Math.min(cap, prevHp + fact.hpDelta));
          char.hp = [next, char.hp[1]];
          charDirty = true;
          logs.push({ t: "stat", text: `  气血 ${prevHp}→${next}` });
        }
        if (fact.moneyDelta && char) {
          const next = Math.max(0, (char.money ?? 0) + fact.moneyDelta);
          logs.push({ t: "stat", text: `  银两 ${char.money ?? 0}→${next}` });
          char.money = next;
          charDirty = true;
        }
        if (fact.karmaDelta && dao) {
          dao.karma = (dao.karma ?? 0) + fact.karmaDelta;
          daoDirty = true;
        }
        if (fact.jieDelta && dao) {
          dao.jie = (dao.jie ?? 0) + fact.jieDelta;
          daoDirty = true;
        }
        break;
      }

      // ── 8. APPLY_CONDITION：正向 buff / 负向伤病 ──
      case "APPLY_CONDITION": {
        const duration = fact.durationTurns ?? fact.duration ?? 30;
        if (fact.combatBuff && typeof fact.combatBuff === "object") {
          // 战前餐类一次性战斗 buff：合并进 char.pendingCombatBuff
          pendingCombatBuff = mergeCombatBuff(pendingCombatBuff, fact.combatBuff);
          char.pendingCombatBuff = pendingCombatBuff;
          charDirty = true;
          logs.push({ t: "sys", text: `  战势加护已记下（下一场战斗生效）` });
          break;
        }
        if (!fact.attr) break;
        const val = Math.abs(fact.val ?? fact.value ?? 1);
        const negative = fact.negative === true || (fact.val ?? fact.value ?? 1) < 0;
        // 正向：buff_<attr>+<val>_untilturn_<T>；负向伤病：buff_<attr>-<val>_untilturn_<T>
        // （负号解析支持见 buffSystem.js 本工单补的一行）
        const flag = negative
          ? `buff_${fact.attr}-${val}_untilturn_${turn + duration}`
          : makeBuffFlag(fact.attr, val, turn, duration);
        if (!flags.includes(flag)) { flags.push(flag); flagsDirty = true; }
        logs.push({ t: "stat", text: `  ${fact.attr}${negative ? "-" : "+"}${val}（${duration} 回合）` });
        break;
      }

      // ── 9. MUTATE_SOCIAL：好感/人情账 → applyPatches 指令 ──
      case "MUTATE_SOCIAL": {
        if (!fact.npc) break;
        if (fact.affectionDelta) {
          patches.push({ op: "add", path: ["varTree", "角色", fact.npc, "好感度"], value: fact.affectionDelta, factId: fact.id });
        }
        if (fact.ledgerKind) {
          // 人情心账：保守落 varTree.角色.<npc>.心账 数组追加（merge 深写，不丢事实）
          patches.push({
            op: "merge",
            path: ["varTree", "角色", fact.npc, "心账"],
            value: (prev) => [...(Array.isArray(prev) ? prev : []), { turn, kind: fact.ledgerKind, reason: fact.reason || "", witnesses: fact.witnesses || [] }],
            factId: fact.id,
          });
        }
        break;
      }

      // ── 10. BIND_OR_SETTLE_PACT：契约缔结/了结 → applyPatches 指令 ──
      case "BIND_OR_SETTLE_PACT": {
        if (!fact.npc) break;
        // 契约按 pactKey（fact.pactId 或本条 factId）一人一约共存——同一 NPC 的
        // 多份约定互不覆盖，旧约原文永不丢（手册未定字段，保守取舍）
        const pactKey = fact.pactId || fact.id || `pact_${turn}`;
        if (fact.settle === true || fact.settleKey) {
          // 了结：在指定旧约上打 settled 标记（settleKey 可点名旧约），不删原文
          const key = fact.settleKey || pactKey;
          patches.push({
            op: "merge",
            path: ["varTree", "世界", "契约", fact.npc, key, "settled"],
            value: { turn, note: fact.note || "" },
            factId: fact.id,
          });
        } else {
          patches.push({
            op: "merge",
            path: ["varTree", "世界", "契约", fact.npc, pactKey],
            value: {
              npc: fact.npc,
              promise: fact.promise || "",
              deadlineHours: fact.deadlineHours ?? null,
              rewardHint: fact.rewardHint || "",
              bindTurn: turn,
              witnesses: fact.witnesses || [],
            },
            factId: fact.id,
          });
        }
        break;
      }

      // ── 11. MUTATE_COMPANION：伙伴状态 → applyPatches 指令 ──
      case "MUTATE_COMPANION": {
        // 保守深写：按事实给定字段原样 merge 进 companionState.<companionId>，
        // 未指名字段的取 fact.updates/fields 全集
        const id = fact.companionId || fact.id?.split("_")?.[0] || "companion";
        const updates = fact.updates || fact.fields || {};
        for (const [k, v] of Object.entries(updates)) {
          // 对象值浅并一层：applyMergePatch 是整体替换，直写会丢弃未提及的嵌套字段
          const merged = v && typeof v === "object" && !Array.isArray(v)
            ? (prev) => (prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev, ...v } : v)
            : v;
          patches.push({ op: "merge", path: ["companionState", id, k], value: merged, factId: fact.id });
        }
        if (!Object.keys(updates).length && fact.note) {
          patches.push({
            op: "merge",
            path: ["companionState", id, "notes"],
            value: (prev) => [...(Array.isArray(prev) ? prev : []), { turn, text: fact.note }],
            factId: fact.id,
          });
        }
        break;
      }

      // ── 12. ALTER_WORLD_SCENE：世界场景改写 → applyPatches 指令 ──
      case "ALTER_WORLD_SCENE": {
        const sceneKey = fact.sceneKey || fact.place || "佚名之地";
        const updates = { ...(fact.updates || (fact.key ? { [fact.key]: fact.value } : {})) }; // 拷贝：写 desc 不得突变入参 fact
        if (!Object.keys(updates).length && fact.note) updates.desc = fact.note;
        for (const [k, v] of Object.entries(updates)) {
          const merged = v && typeof v === "object" && !Array.isArray(v)
            ? (prev) => (prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev, ...v } : v)
            : v;
          patches.push({ op: "merge", path: ["varTree", "世界", "场景", sceneKey, k], value: merged, factId: fact.id });
        }
        if (!Object.keys(updates).length) {
          logs.push({ t: "err", text: `  ⛔ 事实 ${fact.id}：场景改写无内容` });
        }
        break;
      }

      default:
        logs.push({ t: "err", text: `  ⛔ 未知事实码 ${fact.op}（${fact.id || "无编号"}），未落盘` });
    }
  }

  if (invDirty) changes.inv = inv;
  if (roomDirty) changes.room = room;
  if (charDirty) changes.char = char;
  if (skillsDirty) changes.skills = skills;
  if (flagsDirty) changes.flags = flags;
  if (daoDirty) changes.dao = dao;
  // 保持 Set：序列化成数组是 infra/saves 的职责，domain 输出不降级类型
  if (claimedDirty) changes.claimedMilestones = new Set(claimed);
  if (expDirty) changes.exp = exp;
  if (potDirty) changes.pot = pot;

  void syncWorkState;
  return { changes, patches, receipts, logs };
}

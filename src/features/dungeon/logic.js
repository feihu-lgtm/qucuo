// 地宫探险 · 主状态结算桥（纯数据变换，只依赖 domain 与 utils）。
// 根据 run 终局（victory / retreated / defeated）把收益、消耗品扣除、
// 剩余气血（战败保底留 1 血）、时辰推进与首通 flag 打包成 { changes, logs, note }。

import { computeSettledLoot } from "../../domain/rules/dungeon/engine.js";
import { makeItem, ITEM_CATEGORY } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { LOG_T } from "../../domain/rules/log/logTypes.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";

function materializeItem(name, idx, now) {
  const item = makeItemSmart({ name, category: ITEM_CATEGORY.MISC, quality: "白" }, makeItem);
  return {
    ...item,
    id: `dungeon_${name}_${now}_${idx}`,
    equipped: false,
  };
}

export function settleDungeonRun(state, run, { now = Date.now() } = {}) {
  const char = state.char || {};
  const settled = computeSettledLoot(run);
  const nextInv = [...(state.inv || [])];

  // 战斗内嗑掉的消耗品按件扣除（无论胜负）
  for (const usedName of run.usedItems || []) {
    const idx = nextInv.findIndex((entry) => (typeof entry === "object" ? entry.name : entry) === usedName);
    if (idx !== -1) nextInv.splice(idx, 1);
  }

  // 实体化带出的战利品并赋予唯一 id
  settled.items.forEach((name, idx) => {
    nextInv.push(materializeItem(name, idx, now));
  });

  const maxHp = char.hp?.[1] ?? run.hp?.[1] ?? 100;
  const safeHp = Math.max(1, Math.min(maxHp, run.hp?.[0] ?? 1));
  const nextChar = {
    ...char,
    money: (char.money || 0) + settled.money,
    hp: [safeHp, maxHp],
  };

  const nextExp = (state.exp || 0) + settled.exp;
  const nextPot = (state.pot || 0) + settled.pot;
  const elapsed = Math.max(1, run.floor || 1);
  const nextTime = (state.time ?? 0) + elapsed;

  const prevFlags = state.flags || [];
  const shouldSetFlag = Boolean(run.bossDefeated && run.clearFlag && !prevFlags.includes(run.clearFlag));
  const nextFlags = shouldSetFlag ? [...prevFlags, run.clearFlag] : prevFlags;

  const outcomeLabel = run.status === "victory"
    ? "打通地宫"
    : run.status === "retreated"
      ? "安全撤出"
      : "负伤脱身（收益减半）";

  const logs = [
    { t: LOG_T.SYS, text: `  ── ${run.dungeonName} · ${outcomeLabel}（耗时 ${elapsed} 时辰）──` },
  ];
  if (settled.money > 0 || settled.exp > 0 || settled.pot > 0) {
    const parts = [];
    if (settled.money > 0) parts.push(`银两 +${settled.money}`);
    if (settled.exp > 0) parts.push(`江湖经验 +${settled.exp}`);
    if (settled.pot > 0) parts.push(`潜能 +${settled.pot}`);
    logs.push({ t: LOG_T.STAT, text: `  ⊙ 收获：${parts.join("，")}。` });
  }
  if (settled.items.length > 0) {
    logs.push({ t: LOG_T.ITEM, text: `  ⊙ 带出物事：${settled.items.join("、")}。` });
  }
  if (run.usedItems?.length) {
    logs.push({ t: LOG_T.ITEM, text: `  ⊙ 途中消耗：${run.usedItems.join("、")}。` });
  }
  if (shouldSetFlag) {
    logs.push({ t: LOG_T.SYS, text: `  ★ 首次击退「${run.dungeonName}」镇宫首领！` });
  }

  const itemNote = settled.items.length ? `，带出${settled.items.join("、")}` : "";
  const note = {
    text: `探访${run.dungeonName}（${outcomeLabel}），得银${settled.money}两、经验${settled.exp}、潜能${settled.pot}${itemNote}。`,
    source: NOTE_SOURCE.DUMB,
  };

  return {
    changes: {
      char: nextChar,
      inv: nextInv,
      exp: nextExp,
      pot: nextPot,
      time: nextTime,
      flags: nextFlags,
    },
    logs,
    note,
  };
}

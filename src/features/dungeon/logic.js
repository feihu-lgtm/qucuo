// 地宫探险 · 主状态结算桥（纯数据变换，只依赖 domain 与 utils）。
// 根据 run 终局（victory / retreated / defeated）把收益、消耗品扣除、
// 剩余气血（战败保底留 1 血）、时辰推进与首通 flag 打包成 { changes, logs, note }。

import { computeSettledLoot } from "../../domain/rules/dungeon/engine.js";
import { normalizeDungeonStore, syncDungeonWorld } from "../../domain/rules/dungeon/mapRun.js";
import { DUNGEON_DISTRICTS_ALL } from "../../domain/data/dungeon/districts.js";
import { getAdventurerById } from "../../domain/rules/dungeon/dungeonPool.js";
import { unlockImportedCompanion } from "../../domain/rules/companion/companion.js";
import { ocSignatureMoves } from "../../domain/rules/companion/ocKungfu.js";
import { makeItem, ITEM_CATEGORY } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { LOG_T } from "../../domain/data/log/logTypes.js";

const lootItemName = (entry) => (typeof entry === "string" ? entry : entry?.name);

function materializeItem(entry, idx, now) {
  // 字符串 = 只有名字的老数据；对象 = 带着品类/品阶/描述的战利品，
  // 字段优先、缺省再落白档杂物（名录真词条仍走 makeItemSmart 查表）。
  const obj = typeof entry === "object" && entry ? entry : {};
  const name = lootItemName(entry);
  const item = makeItemSmart({
    name,
    category: obj.category || ITEM_CATEGORY.MISC,
    quality: obj.quality || "白",
  }, makeItem);
  return {
    ...item,
    desc: obj.desc || item.desc,
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
  settled.items.forEach((entry, idx) => {
    nextInv.push(materializeItem(entry, idx, now));
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
    logs.push({ t: LOG_T.STAT, text: `  ⊙ 收获 ${parts.join("，")}` });
  }
  if (settled.items.length > 0) {
    logs.push({ t: LOG_T.ITEM, text: `  ⊙ 带出物事 ${settled.items.map(lootItemName).join("、")}` });
  }
  if (run.usedItems?.length) {
    logs.push({ t: LOG_T.ITEM, text: `  ⊙ 途中消耗 ${run.usedItems.join("、")}` });
  }
  if (shouldSetFlag) {
    logs.push({ t: LOG_T.SYS, text: `  ★ 首次击退「${run.dungeonName}」镇宫首领！` });
  }

  const itemNote = settled.items.length ? `，带出${settled.items.map(lootItemName).join("、")}` : "";
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

// 内层地图 run（mapRun.js 产出）→ 旧结算通路薄适配。
// mapRun.runState 字段名与旧 run 几乎同构：status/loot/hp/usedItems/bossDefeated，
// 缺的 floor/dungeonName/clearFlag 在这里补齐——耗时按步数四步折一时辰。
export function settleMapRun(state, mapRun, opts = {}) {
  // 只把 run 内真实掉的血写回 char：撤退不该吃掉入图前的超上限气血或中途回血
  const charHp = state.char?.hp || mapRun.hp || [1, 100];
  const inRunLoss = Math.max(0, (mapRun.entryHp ?? charHp[0]) - (mapRun.hp?.[0] ?? charHp[0]));
  const shim = {
    status: mapRun.status,
    loot: mapRun.loot,
    hp: mapRun.hp,
    usedItems: mapRun.usedItems || [],
    floor: Math.max(1, Math.ceil((mapRun.step || 0) / 4)),
    dungeonName: `${mapRun.displayName || mapRun.districtKey}·内层`,
    bossDefeated: mapRun.bossDefeated,
    clearFlag: mapRun.clearFlag,
  };
  const res = settleDungeonRun(state, shim, opts);
  // settleDungeonRun 会把 hp[0] 削到上限内——超上限/中途回血要保住，按差值直接回写
  if (res.changes?.char) {
    const spent = Math.max(0, Number(mapRun.spentMoney) || 0);
    res.changes = {
      ...res.changes,
      char: {
        ...res.changes.char,
        money: Math.max(0, (res.changes.char.money ?? 0) - spent),
        hp: [Math.max(1, charHp[0] - inRunLoss), charHp[1]],
      },
    };
  }

  // 合并色色卡 flag 与神兵唯一 flag
  const extraFlags = [
    ...(mapRun.unlockedCards || []),
    ...(mapRun.divineFlags || []),
  ];
  if (extraFlags.length) {
    const curFlags = res.changes.flags || state.flags || [];
    res.changes.flags = [...new Set([...curFlags, ...extraFlags])];
  }

  // #668：镇宫名器的去向写进出宫结算日志——拿到了就明说，只拿到线索就指明下一步。
  const divineArm = DUNGEON_DISTRICTS_ALL[mapRun.districtKey]?.divineArm;
  if (divineArm && res.logs) {
    const carried = (mapRun.loot?.items || []).map(lootItemName);
    if ((mapRun.divineFlags || []).includes(divineArm.flag)) {
      res.logs.push({ t: LOG_T.SYS, text: `  ★ 镇宫名器「${divineArm.itemName}」认主入囊！` });
    } else if (carried.includes(divineArm.clueItem)) {
      res.logs.push({ t: LOG_T.SYS, text: `  ☆ 名器线索：凭「${divineArm.clueItem}」再打通一回${mapRun.displayName || mapRun.districtKey}，首领宝匣便会交出「${divineArm.itemName}」。` });
    }
  }

  // 合并开箱领悟的武学（已拥有折算潜能）
  if (mapRun.learnedSkills?.length) {
    const nextSkills = [...(state.skills || [])];
    let bonusPot = 0;
    for (const sk of mapRun.learnedSkills) {
      if (nextSkills.some((s) => s.id === sk.id || s.name === sk.name)) {
        bonusPot += sk.dupPot || 25;
      } else {
        nextSkills.push({
          id: sk.id,
          name: sk.name,
          type: sk.type || "招式",
          quality: sk.quality || "蓝",
          stage: 1,
          desc: sk.desc || "",
          moveType: sk.moveType,
          ...(sk.passiveBonus ? { passiveBonus: sk.passiveBonus } : {}),
        });
        res.logs.push({ t: LOG_T.SYS, text: `  ★ 领悟武学《${sk.name}》！` });
      }
    }
    res.changes.skills = nextSkills;
    if (bonusPot > 0) res.changes.pot = (res.changes.pot ?? state.pot ?? 0) + bonusPot;
  }

  // 合并地宫内结伴成功的 OC 冒险者入队
  if (mapRun.recruitedAdvIds?.length) {
    let comp = state.companionState || {};
    for (const advId of mapRun.recruitedAdvIds) {
      const adv = getAdventurerById(advId);
      if (!adv) continue;
      const sig = ocSignatureMoves(adv);
      comp = unlockImportedCompanion(comp, { ...adv, ...(sig ? { signatureMoves: sig } : {}) });
      res.logs.push({ t: LOG_T.SYS, text: `  ★ 「${adv.name}」随你走出地宫，正式入队！` });
    }
    res.changes.companionState = comp;
  }

  // 持久化 7 天地宫世界状态（保留已解锁入口、已开箱、迷雾与冒险者）
  const store = normalizeDungeonStore(state.dungeonRun);
  if (store.worlds?.[mapRun.districtKey]) {
    const updatedWorld = syncDungeonWorld(store.worlds[mapRun.districtKey], mapRun, {
      time: res.changes.time ?? state.time ?? 0,
    });
    res.changes.dungeonRun = {
      active: null,
      worlds: { ...store.worlds, [mapRun.districtKey]: updatedWorld },
    };
  } else if (state.dungeonRun) {
    res.changes.dungeonRun = { ...store, active: null };
  }

  return res;
}

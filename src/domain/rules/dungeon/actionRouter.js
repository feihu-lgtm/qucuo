// 地宫内层地图 · 房间动作路由层。
// 把「点按钮/输文本」翻译成对 runState 的确定性推进：
//   routeRoomAction 处理结构化动作（拾取/存档/开箱/陷阱箱/商人/交易/出口/BOSS/冒险者/分支）；
//   routeRoomText   处理自由文本（挂着 activePuzzle 时先走 parseIntent→applyAction，
//                   否则原样退回 needsAI，让上层 AI 意图识别接管）。

import { resolveRoomEvent } from "./events.js";
import { mergeLoot, calcDungeonCheckRate, buildCombatNpc } from "./internal.js";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { getAdventurerById } from "./dungeonPool.js";
import { rollChestRewards } from "./mapRun.js";
import { random } from "../../../utils/rng.js";

const PICK_LABEL = /拾取|捡起|捡起来|拿走/;
const SAVE_LABEL = /记录存档|存档|歇脚|休整/;

const withRoom = (runState, room) => ({
  ...runState,
  map: { ...runState.map, rooms: { ...runState.map.rooms, [runState.current]: room } },
});
const roomOf = (runState) => runState.map?.rooms?.[runState.current] || null;

const markEvent = (runState, patch) => {
  const room = roomOf(runState);
  if (!room?.roomEvent) return runState;
  return withRoom(runState, { ...room, roomEvent: { ...room.roomEvent, ...patch } });
};

const takeCheckpoint = (runState) => ({
  room: runState.current,
  hp: [...runState.hp],
  loot: { ...runState.loot, items: [...runState.loot.items] },
  step: runState.step,
});

const availableSilver = (rs) =>
  Math.max(0, (rs.charMoney || 0) + (rs.loot?.money || 0) - (rs.spentMoney || 0));

function adjustEnvMeter(rs, config, delta) {
  const m = config?.envMeter;
  if (!m) return rs;
  const cur = rs.envTags?.[m.tagKey]?.[m.field] || 0;
  const nextVal = delta === 0 ? 0 : Math.max(0, Math.min(m.max ?? 3, cur + delta));
  return {
    ...rs,
    envTags: { ...(rs.envTags || {}), [m.tagKey]: { ...(rs.envTags?.[m.tagKey] || {}), [m.field]: nextVal } },
  };
}

function paySilver(rs, cost) {
  const lootMoney = rs.loot?.money || 0;
  const fromLoot = Math.min(lootMoney, cost);
  const fromChar = cost - fromLoot;
  return {
    ...rs,
    loot: { ...rs.loot, money: lootMoney - fromLoot },
    spentMoney: (rs.spentMoney || 0) + fromChar,
  };
}

function revealOneExit(runState) {
  const exits = runState.map?.exitRooms || [];
  const revealed = new Set([...(runState.revealedExits || []), ...(runState.unlockedExits || [])]);
  const nextExit = exits.find((name) => !revealed.has(name));
  if (!nextExit) return { runState, revealedName: null };
  const r = runState.map.rooms[nextExit];
  return {
    runState: { ...runState, revealedExits: [...(runState.revealedExits || []), nextExit] },
    revealedName: nextExit,
    coords: r ? `(${r.x},${r.y})` : "",
  };
}

function applyEffects(runState, res) {
  const next = { ...runState, hp: [...runState.hp], log: [...runState.log] };
  for (const e of res.effects || []) {
    if (e.type === "hp_loss") next.hp[0] = Math.max(0, next.hp[0] - (e.amount || 0));
    if (e.type === "checkpoint") next.checkpoint = takeCheckpoint(next);
  }
  const d = res.lootDelta || {};
  const delta = { ...d };
  if (d.supplies) { delta.pot = (delta.pot || 0) + d.supplies; delete delta.supplies; }
  if (delta.money || delta.exp || delta.pot || delta.items?.length) {
    next.loot = mergeLoot(next.loot, delta);
  }
  next.log.push(res.log);
  return next;
}

function chooseOption(runState, option, { attrs, rng }) {
  const eff = option.effect || {};
  if (eff.type === "leave") {
    const next = markEvent(runState, { options: undefined });
    next.log = [...next.log, `${option.label}，就此作罢。`];
    return { runState: next, log: next.log[next.log.length - 1] };
  }
  let success = true;
  let rate = null;
  if (option.check) {
    rate = calcDungeonCheckRate(Number(attrs?.[option.check]) || 5, option.dc ?? 5);
    success = rng() * 100 < rate;
  }
  const outcome = eff.outcome || "";
  const log = success
    ? `${option.label}——${outcome || "成了。"}`
    : `${option.label}——火候差了一线，${outcome || "没能如愿。"}`;
  let next = markEvent(runState, { resolved: true, options: undefined });
  next.log = [...next.log, log];
  // 成年向色色卡奇遇成功直接点亮对应收藏 flag
  const cardFlag = roomOf(runState)?.roomEvent?.cardFlag;
  if (success && cardFlag && eff.type === "nsfw_resolve") {
    next.unlockedCards = [...new Set([...(next.unlockedCards || []), cardFlag])];
  }
  return {
    runState: next,
    log,
    branchEffect: { type: eff.type, check: option.check || null, dc: option.dc ?? 0, rate, success },
  };
}

function handleGridOption(runState, room, ev, option, { attrs, rng }) {
  const config = DUNGEON_DISTRICTS_ALL[runState.districtKey] || {};
  const roomName = runState.current;

  if (option.isBossAction) {
    const b = config.boss;
    const npc = buildCombatNpc(b, `boss_${runState.districtKey}`);
    const next = {
      ...runState,
      status: "combat",
      activeBattle: { npc, isBoss: true, reward: b.reward || { money: 120, exp: 25, pot: 30 }, roomName },
      log: [...runState.log, `你踏步上前，直面镇宫首领「${b.name}」！`],
    };
    return { runState: next, log: next.log[next.log.length - 1], combatNpc: npc };
  }

  if (option.isExitUnlock) {
    const unlock = room.exitUnlock || { type: "check", stat: "身法", dc: 5 };
    if (unlock.type === "guard") {
      const tpl = (config.enemies || []).find((e) => e.id === unlock.enemyId) || config.enemies?.[0];
      const npc = buildCombatNpc(tpl, `exit_${roomName}`);
      const next = {
        ...runState,
        status: "combat",
        activeBattle: { npc, unlockExitRoom: roomName, reward: tpl?.reward || { money: 25, exp: 5, pot: 4 }, roomName },
        log: [...runState.log, `守在出口的「${npc.name}」拔刃拦路！`],
      };
      return { runState: next, log: next.log[next.log.length - 1], combatNpc: npc };
    }
    const hasBypass = unlock.bypassItem && (
      (runState.playerInv || []).some((i) => (i?.name || i) === unlock.bypassItem)
      || (runState.loot?.items || []).some((i) => (i?.name || i) === unlock.bypassItem)
    );
    const rate = hasBypass ? 100 : calcDungeonCheckRate(Number(attrs?.[unlock.stat]) || 5, unlock.dc ?? 5);
    const ok = hasBypass || rng() * 100 < rate;
    if (ok) {
      let next = withRoom(runState, {
        ...room,
        exitUnlocked: true,
        roomEvent: { ...ev, resolved: true, options: undefined },
      });
      next.unlockedExits = [...new Set([...(next.unlockedExits || []), roomName])];
      next.unlockedEntries = [...new Set([...(next.unlockedEntries || []), roomName])];
      const log = hasBypass
        ? `以「${unlock.bypassItem}」拨开暗扣，战术出口「${roomName}」已打通！`
        : `★ 检定通过，战术出口「${roomName}」已打通（下次下本可直接由此潜入）！`;
      next.log = [...next.log, log];
      return { runState: next, log };
    }
    const nextHp = [Math.max(1, runState.hp[0] - 8), runState.hp[1]];
    const next = { ...runState, hp: nextHp, log: [...runState.log, `尝试打通「${roomName}」失手，震伤手腕（气血 -8）。`] };
    return { runState: next, log: next.log[next.log.length - 1] };
  }

  if (option.label === "暂不动手") {
    const next = { ...runState, log: [...runState.log, "你暂且记下出口位置，未急着动手。"] };
    return { runState: next, log: next.log[next.log.length - 1] };
  }

  if (option.chestAction === "inspect") {
    const ok = rng() * 100 < calcDungeonCheckRate(Number(attrs?.智谋) || 5, 5);
    const bonus = ok ? 12 : 0;
    const nextOpts = ev.options.filter((o) => o.chestAction !== "inspect");
    let next = markEvent(runState, { options: nextOpts });
    if (bonus) next.loot = mergeLoot(next.loot, { money: bonus });
    const log = ok ? "你在箱底缝隙顺手摸出 12 两漏网散银。" : "箱身严丝合缝，没看出额外暗扣。";
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  if (option.chestAction === "open") {
    const res = rollChestRewards(ev.chestTier || room.chestTier || "wood", config, {
      seed: runState.seed,
      roomName,
      playerFlags: runState.playerFlags,
      playerSkills: runState.playerSkills,
      playerInv: runState.playerInv,
      unlockedCards: runState.unlockedCards,
      learnedSkills: runState.learnedSkills,
      lootItems: runState.loot?.items,
    });
    let next = markEvent(runState, { resolved: true, options: undefined });
    next.loot = mergeLoot(next.loot, { money: res.money, exp: res.exp, pot: res.pot, items: res.items });
    next.openedChests = [...new Set([...(next.openedChests || []), roomName])];
    if (res.learnedSkill) next.learnedSkills = [...(next.learnedSkills || []), res.learnedSkill];
    if (res.cardUnlocked) next.unlockedCards = [...new Set([...(next.unlockedCards || []), res.cardUnlocked.flag])];
    if (res.divineDrop) next.divineFlags = [...new Set([...(next.divineFlags || []), res.divineDrop.flag])];
    const itemText = res.items.map((i) => i.name || i).join("、");
    const log = `开启宝匣：得银 ${res.money} 两、经验 ${res.exp}、潜能 ${res.pot}${itemText ? `、${itemText}` : ""}。${res.notes?.length ? res.notes.join("；") : ""}`;
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  if (option.trapAction) {
    const tc = ev.trapConfig || {};
    let next = markEvent(runState, { resolved: true, options: undefined });
    next.openedChests = [...new Set([...(next.openedChests || []), roomName])];
    if (option.trapAction === "skip") {
      const log = "你看出了匣上暗簧不对劲，稳妥绕开不贪。";
      next.log = [...next.log, log];
      return { runState: next, log };
    }
    const rate = option.trapAction === "disarm"
      ? calcDungeonCheckRate(Number(attrs?.[tc.stat]) || 5, tc.dc ?? 6)
      : 35;
    if (rng() * 100 < rate) {
      const items = tc.successItem ? [tc.successItem] : [];
      next.loot = mergeLoot(next.loot, { money: tc.successMoney || 30, exp: 5, pot: 4, items });
      const log = `拆去陷阱暗簧！反倒从中摸出 ${tc.successMoney || 30} 两银子${items[0] ? `与「${items[0].name}」` : ""}。`;
      next.log = [...next.log, log];
      return { runState: next, log };
    }
    const loss = tc.hpLoss || 15;
    next.hp = [Math.max(1, next.hp[0] - loss), next.hp[1]];
    next = adjustEnvMeter(next, config, 1);
    const log = `触发${tc.title || "陷阱箱"}机关！毒针呛粉扑面（气血 -${loss}）。`;
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  if (option.merchantBuy) {
    const good = config.merchant?.goods?.find((g) => g.id === option.merchantBuy);
    if (!good) return { runState, log: null };
    const bought = runState.marketBought?.[good.id] || 0;
    if (bought >= (good.limit || 99)) {
      const next = { ...runState, log: [...runState.log, `${config.merchant?.npcName || "摊主"}摆摆手：「${good.name}」这批已经卖空了。`] };
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    if (availableSilver(runState) < good.price) {
      const next = { ...runState, log: [...runState.log, `银两不足（需 ${good.price} 两，当前可用 ${availableSilver(runState)} 两）。`] };
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    let next = paySilver(runState, good.price);
    next.marketBought = { ...(next.marketBought || {}), [good.id]: bought + 1 };
    let note = `花 ${good.price} 两买下「${good.name}」。`;
    if (good.effect?.resetAlarm) {
      next = adjustEnvMeter(next, config, 0);
      note += ` 燃起「${good.name}」，${config.envMeter?.label || "警戒"}已清零。`;
    } else if (good.effect?.revealExit) {
      const rev = revealOneExit(next);
      next = rev.runState;
      note += rev.revealedName ? ` 残图标出未探出口「${rev.revealedName}」位于 ${rev.coords}。` : " 塔内出口已尽数在握。";
    } else if (good.effect?.blindBox) {
      const boxPool = [...(config.chestPools?.iron?.items || []), ...(config.chestPools?.stone?.items || [])];
      const pick = boxPool[Math.floor(rng() * boxPool.length) % Math.max(1, boxPool.length)] || { name: "铁网僧袍", category: "armor", quality: "蓝" };
      next.loot = mergeLoot(next.loot, { items: [pick] });
      note += ` 当场拆封，开出「${pick.name}（${pick.quality}）」！`;
    } else {
      next.loot = mergeLoot(next.loot, { items: [{ name: good.name, category: good.category || "misc", quality: good.quality || "白", desc: good.desc }] });
    }
    next.log = [...next.log, note];
    return { runState: next, log: note };
  }

  if (option.merchantSell) {
    const keep = [];
    let gained = 0;
    let soldCount = 0;
    for (const item of runState.loot?.items || []) {
      const name = typeof item === "string" ? item : item?.name;
      const q = typeof item === "object" ? item?.quality : "白";
      const isKey = name === config.divineArm?.itemName || name === config.divineArm?.clueItem || q === "红" || q === "橙";
      if (isKey) {
        keep.push(item);
      } else {
        const val = q === "紫" ? 45 : q === "蓝" ? 28 : q === "绿" ? 16 : 10;
        gained += val;
        soldCount += 1;
      }
    }
    if (!soldCount) {
      const next = { ...runState, log: [...runState.log, "行囊里眼下没有可出手的普通货色。"] };
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    const next = {
      ...runState,
      loot: { ...runState.loot, money: (runState.loot?.money || 0) + gained, items: keep },
      log: [...runState.log, `在黑摊脱手 ${soldCount} 件杂货，换回银两 ${gained} 两。`],
    };
    return { runState: next, log: next.log[next.log.length - 1] };
  }

  if (option.tradeAction) {
    const tr = ev.tradeConfig;
    if (option.tradeAction === "decline" || !tr) {
      const next = markEvent({ ...runState, clearedRooms: [...new Set([...(runState.clearedRooms || []), roomName])] }, { resolved: true, options: undefined });
      next.log = [...next.log, "你抱拳谢绝，对方收起物事隐入暗处。"];
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    if (availableSilver(runState) < tr.cost) {
      const next = { ...runState, log: [...runState.log, `银两不够（需 ${tr.cost} 两）。`] };
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    let next = paySilver(runState, tr.cost);
    next = markEvent(next, { resolved: true, options: undefined });
    next.clearedRooms = [...new Set([...(next.clearedRooms || []), roomName])];
    let note = `付银 ${tr.cost} 两成交：`;
    if (tr.rewardType === "revealExit") {
      const rev = revealOneExit(next);
      next = rev.runState;
      note += rev.revealedName ? `对方指明了「${rev.revealedName}」方位 ${rev.coords}。` : "对方多塞给你 15 两作为回礼。";
      if (!rev.revealedName) next.loot = mergeLoot(next.loot, { money: 15 });
    } else {
      next.loot = mergeLoot(next.loot, { items: tr.item ? [tr.item] : [], pot: tr.potBonus || 0 });
      note += `换得「${tr.item?.name || "秘药"}」${tr.potBonus ? `与潜能 +${tr.potBonus}` : ""}。`;
    }
    next.log = [...next.log, note];
    return { runState: next, log: note };
  }

  if (option.supplyAction === "heal") {
    const ratio = room.isCheckpoint ? 0.35 : 0.25;
    const healAmt = Math.max(10, Math.round(runState.hp[1] * ratio));
    const nextHp = [Math.min(runState.hp[1], runState.hp[0] + healAmt), runState.hp[1]];
    let next = {
      ...runState,
      hp: nextHp,
      clearedRooms: [...new Set([...(runState.clearedRooms || []), roomName])],
    };
    if (room.isCheckpoint && config.envMeter) {
      next = adjustEnvMeter(next, config, 0);
    }
    next = markEvent(next, { resolved: true, options: room.isCheckpoint ? [{ label: "记录存档", supplyAction: "save" }] : undefined });
    const meterNote = (room.isCheckpoint && config.envMeter) ? `并稳住了${config.envMeter.label}` : "";
    const log = `在此歇息裹伤，恢复气血 ${nextHp[0] - runState.hp[0]} 点${meterNote}。`;
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  if (option.supplyAction === "save" && room.isCheckpoint) {
    const next = {
      ...runState,
      checkpoint: takeCheckpoint(runState),
      checkpointSnapshot: JSON.parse(JSON.stringify({
        seed: runState.seed,
        map: runState.map,
        current: runState.current,
        visited: runState.visited,
        envTags: runState.envTags || {},
        envState: runState.envState || {},
        hp: runState.hp,
        loot: runState.loot,
        step: runState.step,
      })),
      log: [...runState.log, "在检查点重新记录了当前进度。"],
    };
    return { runState: next, log: next.log[next.log.length - 1] };
  }

  if (option.advAction) {
    const advId = option.advId || ev.advId;
    const adv = getAdventurerById(advId);
    const markAdvMet = (rs, patch = {}) => ({
      ...rs,
      adventurers: (rs.adventurers || []).map((a) => (a.advId === advId ? { ...a, met: true, ...patch } : a)),
    });

    if (option.advAction === "leave") {
      let next = markAdvMet(runState);
      next = withRoom(next, { ...room, residentNpcName: undefined, roomEvent: { ...ev, resolved: true, options: undefined } });
      next.log = [...next.log, `你与「${adv?.name || "对方"}」抱拳错身而过。`];
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    if (option.advAction === "bribe") {
      if (availableSilver(runState) < 20) {
        const next = { ...runState, log: [...runState.log, "兜里银两不够 20 两，对方哼了一声没搭理。"] };
        return { runState: next, log: next.log[next.log.length - 1] };
      }
      let next = paySilver(markAdvMet(runState), 20);
      const rev = revealOneExit(next);
      next = rev.runState;
      next = withRoom(next, { ...room, residentNpcName: undefined, roomEvent: { ...ev, resolved: true, options: undefined } });
      const log = rev.revealedName
        ? `塞给「${adv?.name}」20 两银子，对方顺手点出了出口「${rev.revealedName}」方位 ${rev.coords}。`
        : `塞给「${adv?.name}」20 两银子，对方提醒你：「中心石室就在坐标 (${Math.floor((runState.map.gridSize || 13) / 2)},${Math.floor((runState.map.gridSize || 13) / 2)}) 一带。」`;
      next.log = [...next.log, log];
      return { runState: next, log };
    }
    if (option.advAction === "recruit") {
      const token = config.recruitToken;
      const hasToken = token && (runState.playerInv || []).concat(runState.loot?.items || []).some((i) => (i?.name || i) === token);
      const ok = hasToken || rng() * 100 < calcDungeonCheckRate(Number(attrs?.魅力 ?? attrs?.口才) || 5, 5);
      let next = markAdvMet(runState, { recruited: ok });
      next = withRoom(next, { ...room, residentNpcName: undefined, roomEvent: { ...ev, resolved: true, options: undefined } });
      if (ok) {
        next.recruitedAdvIds = [...new Set([...(next.recruitedAdvIds || []), advId])];
        next.log = [...next.log, `★ 「${adv?.name}」欣然应允结伴同行，出宫后可正式入队！`];
      } else {
        next.log = [...next.log, `「${adv?.name}」婉拒了同行之邀，拱手先一步隐入廊道。`];
      }
      return { runState: next, log: next.log[next.log.length - 1] };
    }
    if (option.advAction === "battle" && adv) {
      const npc = buildCombatNpc({ ...adv, ocAdventurer: true, npcRef: adv.id }, `adv_${adv.id}`);
      const next = {
        ...runState,
        status: "combat",
        activeBattle: { npc, advId, reward: { money: 42, exp: 8, pot: 6 }, roomName },
        log: [...runState.log, `与「${adv.name}」言不投机，当场亮兵刃拆招！`],
      };
      return { runState: next, log: next.log[next.log.length - 1], combatNpc: npc };
    }
  }

  return null;
}

export function routeRoomAction(runState, label, { attrs = {}, rng = random } = {}) {
  if (!runState || runState.status !== "exploring") {
    return { runState, log: null };
  }
  const room = roomOf(runState);
  const text = String(label || "").trim();

  // ① 地上之物：拾取入袋
  if (PICK_LABEL.test(text) && (room?.groundLoot || []).length) {
    const picked = room.groundLoot.map((g) => (typeof g === "string" ? g : g?.name)).filter(Boolean);
    const next = withRoom(runState, { ...room, groundLoot: [] });
    next.loot = mergeLoot(next.loot, { items: picked });
    const log = `拾取了${picked.join("、")}。`;
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  // ② 存档点：手动记录
  if (SAVE_LABEL.test(text) && room?.isCheckpoint) {
    const next = { ...runState, checkpoint: takeCheckpoint(runState) };
    const log = "在此歇脚避风，进度重新记下。";
    next.log = [...next.log, log];
    return { runState: next, log };
  }

  const ev = room?.roomEvent;

  // ③ 已挂分支选项：按 label 选一项（先检查 13×13 扩展选项，再检查传统 branch options）
  if (ev?.options?.length) {
    const option = ev.options.find((o) => o.label === text);
    if (option) {
      if (option.effect) return chooseOption(runState, option, { attrs, rng });
      const gridHandled = handleGridOption(runState, room, ev, option, { attrs, rng });
      if (gridHandled) return gridHandled;
    }
  }

  // ④ 未决房间事件：触发 resolver
  if (ev && !ev.resolved) {
    const res = resolveRoomEvent(ev.kind, ev, { attrs, loot: runState.loot, rng });
    let next = applyEffects(runState, res);
    if (res.combatNpc) {
      next = markEvent(next, { resolved: true, options: undefined });
      if (runState.map?.gridSize) {
        next.status = "combat";
        next.activeBattle = {
          npc: res.combatNpc,
          reward: ev.enemy?.reward || { money: 28, exp: 5, pot: 4 },
          roomName: runState.current,
        };
      }
      return { runState: next, log: res.log, combatNpc: res.combatNpc };
    }
    if (res.puzzleInstance || res.effects?.some((e) => e.type === "puzzle")) {
      const inst = res.puzzleInstance || res.effects.find((e) => e.type === "puzzle").instance;
      next.activePuzzle = { instance: inst, state: inst.state, room: runState.current };
      return { runState: next, log: res.log, puzzleInstance: inst };
    }
    if (res.nsfwBranch) {
      next = markEvent(next, { options: res.nsfwBranch.options });
      return { runState: next, log: res.log, nsfwBranch: res.nsfwBranch };
    }
    if (res.branch) {
      next = markEvent(next, { options: res.branch.options });
      return { runState: next, log: res.log, branch: res.branch };
    }
    next = markEvent(next, { resolved: true, options: undefined });
    return { runState: next, log: res.log };
  }

  // ⑤ 挂着谜题时，结构化按钮也当文本喂给 parseIntent
  if (runState.activePuzzle) {
    return routeRoomText(runState, text, { attrs });
  }

  return { runState, log: null, needsAI: true, text };
}

export function routeRoomText(runState, text, { attrs = {} } = {}) {
  const ap = runState?.activePuzzle;
  if (!ap?.instance) return { runState, log: null, needsAI: true, text };
  const input = ap.instance.parseIntent?.(text);
  if (!input) return { runState, log: null, needsAI: true, text };

  const r = ap.instance.applyAction(input, ap.state, attrs);
  const next = { ...runState, log: [...runState.log, r.log] };
  if (r.done) {
    delete next.activePuzzle;
    let doneNext = markEvent(next, { resolved: true, options: undefined });
    if (doneNext.map?.gridSize) {
      doneNext.solvedPuzzles = [...new Set([...(doneNext.solvedPuzzles || []), runState.current])];
      doneNext.loot = mergeLoot(doneNext.loot, { money: 20, exp: 5, pot: 8 });
    }
    return { runState: doneNext, log: r.log, done: true, fail: !!r.fail };
  }
  next.activePuzzle = { ...ap, state: r.state };
  return { runState: next, log: r.log, done: false, fail: !!r.fail };
}

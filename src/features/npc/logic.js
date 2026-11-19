import { QUALITY, CATEGORY_LABEL, makeItem } from "../../equipment.js";
import { makeItemSmart, CATALOG_INDEX } from "../../items/catalog.js";
import { markNpcAsKnown as markNpcKnown } from "../../npcAwareness.js";
import { removeNpc, markCarriedLost, respawnNpc } from "../../roomNpcs.js";
import { tryLearnFromMaster, tryStealFrom } from "../../kungfu/learnSkill.js";
import { stealSuccessRate } from "../../combat/stealSystem.js";
import { duelAffGain, duelDropChance, duelPotGain, TEAMWORK_GAIN } from "../../combat/duelSettleMath.js";
import { random } from "../../core/rng.js";
import { bar } from "../../utils/mudHelpers.js";
import { QUEST_TYPE } from "../../quests/questTypes.js";
import { QUCUO_QUESTS } from "../../quests/qucuoQuests.js";
import { createQuestProgress, getCurrentStage, advanceQuestStages, lockExclusiveSiblings } from "../../quests/questEngine.js";
import { applyStageRewards, resolveStageRewards } from "../../quests/questRewards.js";
import { ESCORT_QUESTS } from "../../quests/escortQuests.js";
import { activeCompanionKey, companionKeyByName, unlockImportedCompanion, unlockPearl, unlockSnowLeopard } from "../../companion.js";
import { NOTE_SOURCE, VIA } from "../../memory/note.js";
import { buildShopInventory, rollShopStock } from "../../shops/qucuoShops.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

function forceAdvanceQuest(state, quest, targetFlag, now) {
  const flags = state.flags || [];
  const addedFlag = flags.includes(targetFlag) ? flags : [...flags, targetFlag];
  let progress = state.questProgress?.[quest.id] || createQuestProgress(quest.id, now);
  const gameState = { flags: addedFlag, char: state.char || {} };
  const pendingRewards = [];

  while (progress.status === "active") {
    const result = advanceQuestStages(quest, progress, gameState, now);
    if (!result.advanced) break;
    progress = result.progress;
    if (result.completedStage) {
      const rewards = resolveStageRewards(result.completedStage, result.hitFlags);
      if (rewards) pendingRewards.push(rewards);
    }
    if (result.justCompleted) break;
  }

  let nextProgress = { ...(state.questProgress || {}), [quest.id]: progress };
  if (progress.status === "completed") {
    nextProgress = lockExclusiveSiblings(nextProgress, QUCUO_QUESTS, quest.id);
  }

  const flagUpdates = [(prev) => prev.includes(targetFlag) ? prev : [...prev, targetFlag]];
  const changedProgress = Object.fromEntries(
    Object.entries(nextProgress).filter(([id, value]) => state.questProgress?.[id] !== value),
  );
  const changes = {
    flags: (prev) => flagUpdates.reduce((value, update) => update(value), prev || []),
    questProgress: (prev) => ({ ...(prev || {}), ...changedProgress }),
  };
  const local = {
    inv: state.inv || [],
    char: state.char || {},
    varTree: state.varTree || {},
    flags: addedFlag,
  };
  const varTreeUpdates = [];
  const invUpdates = [];
  const charUpdates = [];
  const setters = {
    setInv: (update) => {
      invUpdates.push(update);
      local.inv = typeof update === "function" ? update(local.inv) : update;
    },
    setChar: (update) => {
      charUpdates.push(update);
      local.char = typeof update === "function" ? update(local.char) : update;
    },
    setVarTree: (update) => {
      varTreeUpdates.push(update);
      local.varTree = typeof update === "function" ? update(local.varTree) : update;
    },
    setFlags: (update) => {
      flagUpdates.push(update);
      local.flags = typeof update === "function" ? update(local.flags) : update;
    },
  };

  for (const rewards of pendingRewards) applyStageRewards(rewards, setters, now);
  if (invUpdates.length) {
    changes.inv = (prev) => invUpdates.reduce(
      (value, update) => typeof update === "function" ? update(value) : update,
      prev || [],
    );
  }
  if (charUpdates.length) {
    changes.char = (prev) => charUpdates.reduce(
      (value, update) => typeof update === "function" ? update(value) : update,
      prev || {},
    );
  }
  changes.flags = (prev) => flagUpdates.reduce(
    (value, update) => typeof update === "function" ? update(value) : update,
    prev || [],
  );
  if (varTreeUpdates.length) {
    changes.varTree = (prev) => varTreeUpdates.reduce(
      (tree, update) => typeof update === "function" ? update(tree) : update,
      prev || {},
    );
  }
  return changes;
}

function composeUpdates(first, second) {
  return (prev) => {
    const intermediate = typeof first === "function" ? first(prev) : first;
    return typeof second === "function" ? second(intermediate) : second;
  };
}

export function recognizeNpc(_state, npc) {
  if (!npc?.name) return {};
  return { changes: { varTree: (prev) => markNpcKnown(prev || {}, npc.name) } };
}

export function lookNpc(_state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const extraReplies = [];
  if (npc.combatStats?.hp) {
    const [hp, maxHp] = npc.combatStats.hp;
    extraReplies.push({ t: "stat", text: `  ${npc.name} 气血 ${bar(hp, maxHp, 10)} ${hp}/${maxHp}` });
  }
  if (typeof npc.levelCap === "number") {
    const tier = QUALITY[Math.max(0, Math.min(5, npc.levelCap))];
    extraReplies.push({ t: "stat", text: `  ${npc.name} 品阶 ${tier}袍` });
  }
  return {
    changes: { varTree: (prev) => markNpcKnown(prev || {}, npc.name) },
    extraReplies,
  };
}

export function talkToNpc(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const result = {
    changes: { varTree: (prev) => markNpcKnown(prev || {}, npc.name) },
  };
  const roomName = state.room?.name;
  const flags = state.flags || [];
  const activeEscort = ESCORT_QUESTS.find((quest) => (
    state.questProgress?.[quest.id]?.active
    && quest.targetNpc === npc.name
    && quest.targetLocation === roomName
    && !flags.includes(`quest_done_${quest.id}`)
  ));
  if (activeEscort) {
    const doneFlag = `quest_done_${activeEscort.id}`;
    result.changes = {
      ...result.changes,
      questProgress: (prev) => ({ ...prev, [activeEscort.id]: { active: false } }),
      flags: (prev) => [...prev, doneFlag],
      char: (prev) => ({ ...prev, money: (prev.money || 0) + activeEscort.reward }),
      pot: (prev) => prev + 10,
    };
    result.logs = [
      { t: "sys", text: `  你找到了${npc.name}，交出货物，护镖任务「${activeEscort.title}」圆满完成！` },
      { t: "item", text: `  💰 报酬：${activeEscort.reward} 两 · 潜能 +10` },
    ];
    result.completedEscort = true;
    return result;
  }
  if (npc.cannotSpeak) {
    result.logs = [{
      t: "sys",
      text: `  ${npc.name}歪着头看你，喉间发出低低的声响，却说不出半句人话——它听不懂你的言语，你也无从与它交谈。（它不能说话，但你可以投喂食物，日久或能与它亲近）`,
    }];
    return result;
  }
  result.logs = [{ t: "sys", text: `  你走向${npc.name}，看样子是想说些什么。` }];
  return result;
}

const GIFT_AFFECTION_RANGE = { 白: [2, 4], 绿: [4, 6], 蓝: [6, 9], 紫: [9, 12], 橙: [11, 14], 红: [13, 15] };

export function describeGiftForPrompt(item) {
  const itemName = typeof item === "string" ? item : item?.name;
  const catalogEntry = CATALOG_INDEX[itemName];
  const inventoryEntry = typeof item === "object" ? item : null;
  const quality = catalogEntry?.quality || inventoryEntry?.quality || "白";
  const desc = catalogEntry?.desc || inventoryEntry?.desc || "";
  const category = catalogEntry?.category || inventoryEntry?.category || null;
  const categoryLabel = category ? (CATEGORY_LABEL[category] || category) : null;
  const [lo, hi] = GIFT_AFFECTION_RANGE[quality] || GIFT_AFFECTION_RANGE.白;
  return { itemName, quality, desc, categoryLabel, range: [lo, hi], suggestedDelta: Math.round((lo + hi) / 2) };
}

export function giftNpc(state, npc, item, now = Date.now()) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (!item) return { logs: [{ t: "err", text: "  背包中没有这件物品。" }] };
  const itemName = typeof item === "string" ? item : item.name;
  const giftInfo = describeGiftForPrompt(item);
  const inv = state.inv || [];
  let nextInv = inv;
  if (typeof item === "object" && item.id != null) {
    nextInv = inv.filter((entry) => !(typeof entry === "object" && entry.id === item.id));
  } else {
    const index = inv.findIndex((entry) => (typeof entry === "string" ? entry : entry.name) === itemName);
    if (index !== -1) nextInv = [...inv.slice(0, index), ...inv.slice(index + 1)];
  }

  let deliveredQuest = null;
  for (const quest of QUCUO_QUESTS) {
    if (!quest.stages?.length) continue;
    const progress = state.questProgress?.[quest.id];
    if (progress?.status !== "active") continue;
    const stage = getCurrentStage(quest, progress);
    const delivery = stage?.deliver;
    if (!delivery) continue;
    const toMatches = delivery.to === npc.name;
    const itemMatches = itemName === delivery.item || itemName.includes(delivery.item) || delivery.item.includes(itemName);
    if (toMatches && itemMatches) {
      deliveredQuest = {
        quest,
        flag: Array.isArray(stage.completionFlag) ? stage.completionFlag[0] : stage.completionFlag,
      };
      break;
    }
  }

  const isAngry = !!state.varTree?.角色?.[npc.name]?.生气状态?.active;
  const command = isAngry
    ? `在${npc.name}气头上，将「${itemName}」赠予对方，试图以此赔罪示好`
    : (deliveredQuest ? `将「${itemName}」郑重交给${npc.name}——这正是${npc.name}等着的东西` : `将「${itemName}」赠予${npc.name}`);
  const changes = {
    varTree: (prev) => markNpcKnown(prev || {}, npc.name),
    inv: nextInv,
  };
  const logs = [];
  if (deliveredQuest) {
    const advancement = forceAdvanceQuest(state, deliveredQuest.quest, deliveredQuest.flag, now);
    for (const [key, update] of Object.entries(advancement)) {
      changes[key] = key === "varTree" && changes.varTree
        ? composeUpdates(changes.varTree, update)
        : update;
    }
    logs.push({
      t: "affection",
      text: `  ✓ 你把「${itemName}」交到${npc.name}手上，「${deliveredQuest.quest.title}」推进。`,
    });
  }
  return {
    changes,
    logs,
    settle: command,
    settleOptions: { settleNpc: npc.name, settleKind: isAngry ? null : "gift", giftInfo },
    deliveredQuest: deliveredQuest?.quest || null,
  };
}

export function tradeWithNpc(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const shopData = rollShopStock(npc.name, state.time) || buildShopInventory(npc.name);
  if (!shopData) {
    return { logs: [{ t: "sys", text: `  ${npc.name}摆摆手，「小店暂无货可卖。」` }] };
  }
  return { shop: { npcName: npc.name, ...shopData } };
}

export function inviteCompanion(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const key = companionKeyByName(npc.name);
  let companionState = state.companionState || {};
  if (key === "snowLeopard") companionState = unlockSnowLeopard(companionState);
  else if (key === "pearl") companionState = unlockPearl(companionState);
  else if (npc.imported) companionState = unlockImportedCompanion(companionState, npc);
  else return {};

  return {
    changes: {
      companionState,
      varTree: (prev) => markNpcKnown(prev || {}, npc.name),
      room: (prev) => ({
        ...prev,
        npcs: removeNpc(prev.npcs, (entry) => entry.name === npc.name && (entry.companionCandidate || entry.imported)),
      }),
    },
    settle: `向${npc.name}伸出手，郑重邀它同行`,
    settleOptions: { settleNpc: npc.name, settleKind: "companion_invite", settleBeast: !!npc.beast },
  };
}

export function stealFromNpc(state, npc, { now = Date.now() } = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }], kind: "blocked" };
  const agility = state.char?.special?.身法 ?? 0;
  const result = tryStealFrom(npc, state.varTree || {}, state.skills || [], state.char || {}, agility, now);
  if (!result.ok) {
    return { logs: [{ t: "sys", text: `  ${result.reason}` }], kind: "blocked", steal: result };
  }
  if (!result.success) {
    const favorability = state.varTree?.角色?.[npc.name]?.好感度 ?? 0;
    return {
      changes: {
        varTree: (prev) => {
          const known = markNpcKnown(prev || {}, npc.name);
          const current = known.角色?.[npc.name] || {};
          return {
            ...known,
            角色: {
              ...known.角色,
              [npc.name]: {
                ...current,
                好感度: Math.max(0, (current.好感度 || 0) - result.favorabilityLoss),
                生气状态: result.angryState,
              },
            },
          };
        },
      },
      logs: [
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你手法生涩，被${npc.name}当场察觉！他脸色一沉，显然动了真怒。` },
      ],
      note: {
        text: `对${npc.name}下手偷窃，被他当场察觉，好感掉了${result.favorabilityLoss}，他动了真怒。`,
        owner: [{ name: npc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      },
      noteAction: "stealFail",
      kind: "caught",
      steal: { ...result, favorability },
    };
  }

  if (result.outcome === null) {
    return {
      logs: [{ t: "sys", text: `  你想对${npc.name}下手，摸了半天，却发现他身上早已一无所有，只得悻悻作罢。` }],
      note: { text: `摸了${npc.name}的身，他身上已经一无所有。`, source: NOTE_SOURCE.DUMB },
      noteAction: "steal",
      kind: "empty",
      steal: result,
    };
  }

  if (result.outcome === "item") {
    const target = result.item;
    const fullItem = {
      ...makeGameItem({ name: target.name, category: target.category || "misc", quality: target.quality || "白" }),
      id: `stolen_${target.id}_${now}`,
    };
    return {
      changes: {
        inv: (prev) => [...prev, fullItem],
        room: (prev) => ({ ...prev, npcs: markCarriedLost(prev.npcs, npc.name, target, "stolen") }),
      },
      logs: [
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你运指如风，趁${npc.name}不备，将「${target.name}」（${target.quality}）神不知鬼不觉地顺入了自己怀中。` },
        { t: "loot", text: `🤫 妙手空空：「${target.name}」`, item: fullItem, source: "steal", fromNpc: npc.name },
      ],
      note: { text: `从${npc.name}身上顺走了「${target.name}」，他毫无察觉。`, source: NOTE_SOURCE.DUMB },
      noteAction: "steal",
      kind: "item",
      steal: result,
    };
  }

  return {
    changes: { skills: (prev) => prev.some((skill) => skill.id === result.skill.id) ? prev : [...prev, result.skill] },
    logs: [
      { t: "cmd", text: `> 偷窃 ${npc.name}` },
      { t: "desc", text: `  你悄然窥破${npc.name}出手的门道，趁其不备，竟将「${result.move.name}」这一手偷学了去！` },
      { t: "loot", text: `🤫 偷師得手：「${result.move.name}」`, skill: { name: result.move.name, quality: result.move.quality || result.skill?.quality || "白", moveType: result.move.type }, desc: result.move.desc, source: "steal", fromNpc: npc.name },
    ],
    note: { text: `偷看${npc.name}出手的门道，把「${result.move.name}」这一手学了去，他没有察觉。`, source: NOTE_SOURCE.DUMB },
    noteAction: "steal",
    kind: "move",
    steal: result,
  };
}

function addChange(changes, state, key, update) {
  const previous = changes[key];
  changes[key] = previous
    ? (value) => {
      const afterPrevious = previous(value);
      return typeof update === "function" ? update(afterPrevious) : update;
    }
    : (value) => typeof update === "function" ? update(value) : update;
  state[key] = typeof update === "function" ? update(state[key]) : update;
}

function appendQuestAdvancement(state, changes, quest, flag, now) {
  const advancement = forceAdvanceQuest(state, quest, flag, now);
  for (const [key, update] of Object.entries(advancement)) {
    addChange(changes, state, key, update);
  }
}

function invHasNamedItem(inv, name) {
  return (inv || []).some((item) => (typeof item === "string" ? item : item?.name) === name);
}

function recapBattleLog(battleLog) {
  return (battleLog || []).map((row) => {
    if (row.teamText) return `第${row.round}回合，${row.teamText}`;
    const bits = [`第${row.round}回合你使「${row.playerMove}」`];
    if (row.npcMove) bits.push(`对方使「${row.npcMove}」`);
    if (row.dmgToNpc > 0) bits.push(`对方受创${row.dmgToNpc}`);
    if (row.dmgToPlayer > 0) bits.push(`你受创${row.dmgToPlayer}`);
    if (row.narration) bits.push(`（说书：${row.narration}）`);
    return bits.join("，");
  }).join("；");
}

export function settleNpcDuel(state, npc, {
  outcome, loot, battleLog, grownMoveset, usedItems, remainingHp, pendingQuestBranch,
  now = Date.now(), rng = random, createRespawnNpc,
} = {}) {
  if (!npc) return {};
  const working = {
    ...state,
    char: state.char || {},
    room: state.room || {},
    inv: state.inv || [],
    skills: state.skills || [],
    flags: state.flags || [],
    questProgress: state.questProgress || {},
    varTree: state.varTree || {},
    pot: state.pot || 0,
  };
  const changes = {};
  const logs = [];

  if (Array.isArray(battleLog) && battleLog.length) {
    const foe = npc.name || "对手";
    const battleLogs = [{ t: "sys", text: `　── 与${foe}切磋 · 逐回合 ──` }];
    for (const entry of battleLog) {
      if (entry.round && entry.teamText) {
        battleLogs.push({ t: "desc", text: `  第${entry.round}回合 ${entry.teamText}` });
      } else if (entry.round && entry.playerMove) {
        battleLogs.push({ t: "desc", text: `  第${entry.round}回合 你「${entry.playerMove}」 对 ${foe}「${entry.npcMove}」${entry.dmgToNpc > 0 ? `　${foe}−${entry.dmgToNpc}` : ""}${entry.dmgToPlayer > 0 ? `　你−${entry.dmgToPlayer}` : ""}` });
      }
    }
    if (battleLogs.length > 1) logs.push(...battleLogs);
  }

  if (working.char.pendingCombatBuff) {
    addChange(changes, working, "char", (prev) => {
      const { pendingCombatBuff, ...rest } = prev;
      return rest;
    });
  }
  if (remainingHp) {
    addChange(changes, working, "char", (prev) => ({
      ...prev,
      hp: [Math.max(0, Math.min(remainingHp[0], prev.hp[1])), prev.hp[1]],
    }));
  }
  if (grownMoveset) addChange(changes, working, "char", (prev) => ({ ...prev, moveset: grownMoveset }));

  if (pendingQuestBranch?.mode === "combat" && npc.questBranchFlag === pendingQuestBranch.flag) {
    if (outcome === "win") {
      const quest = QUCUO_QUESTS.find((entry) => entry.id === pendingQuestBranch.questId);
      if (quest) {
        appendQuestAdvancement(working, changes, quest, pendingQuestBranch.flag, now);
        logs.push({ t: "affection", text: `  ✓ 你打退了他们，「${quest.title}」推进。` });
      }
    } else {
      logs.push({ t: "sys", text: `  你没能打赢——这条路没走通，可换个法子再试。` });
    }
  }

  if (usedItems?.length) {
    addChange(changes, working, "inv", (prev) => {
      const next = [...prev];
      for (const name of usedItems) {
        const index = next.findIndex((item) => (typeof item === "object" ? item.name : item) === name);
        if (index !== -1) next.splice(index, 1);
      }
      return next;
    });
    const tally = usedItems.reduce((counts, name) => (counts[name] = (counts[name] || 0) + 1, counts), {});
    logs.push({ t: "item", text: `  ⊙ 切磋中服用：${Object.entries(tally).map(([name, count]) => `${name}×${count}`).join("、")}` });
  }

  const { potGain, tierLabel } = duelPotGain(npc.levelCap, outcome);
  addChange(changes, working, "pot", (prev) => prev + potGain);
  logs.push({ t: "item", text: `  ✦ 与${tierLabel}高手切磋${outcome === "win" ? "获胜" : outcome === "lose" ? "落败" : "罢手"}，长了见识，潜能 +${potGain}` });

  if (npc.name && !npc.tag) {
    const affGain = duelAffGain(outcome);
    addChange(changes, working, "varTree", (prev) => {
      const tree = markNpcKnown(prev || {}, npc.name);
      const roles = { ...(tree.角色 || {}) };
      const current = roles[npc.name]?.好感度 ?? 0;
      roles[npc.name] = { ...(roles[npc.name] || {}), 好感度: Math.max(0, Math.min(100, current + affGain)) };
      return { ...tree, 角色: roles };
    });
    logs.push({ t: "affection", text: `  💗 与${npc.name}切磋一场，交情 +${affGain}` });
  }

  if (outcome === "win" && activeCompanionKey(state.companionState)) {
    addChange(changes, working, "varTree", (prev) => {
      const tree = markNpcKnown(prev || {}, "雪豹");
      const roles = { ...(tree.角色 || {}) };
      const current = roles.雪豹?.好感度 ?? 0;
      roles.雪豹 = { ...(roles.雪豹 || {}), 好感度: Math.max(0, Math.min(100, current + TEAMWORK_GAIN)) };
      return { ...tree, 角色: roles };
    });
    logs.push({ t: "affection", text: `  💗 与雪豹并肩破敌，默契渐深，好感 +${TEAMWORK_GAIN}` });
  }

  let note = null;
  if (outcome === "win" && npc.guaranteedDrop && !invHasNamedItem(working.inv, npc.guaranteedDrop.name)) {
    const drop = npc.guaranteedDrop;
    const item = makeGameItem({
      name: drop.name,
      category: drop.category || "misc",
      quality: drop.quality || "白",
      desc: drop.desc,
    });
    addChange(changes, working, "inv", (prev) => [...prev, item]);
    logs.push({ t: "loot", text: `✦ ${npc.name}倒地时，那件${drop.name}从他身上滑落——你捡了起来。`, item, source: "duel", fromNpc: npc.name });
    note = {
      text: `打赢${npc.name}，从他身上得了「${drop.name}」。`,
      owner: [{ name: npc.name, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.NARRATIVE,
    };
  }

  if (outcome === "win" && npc.name && !npc.tag) {
    const pool = (npc.carriedItems || []).filter((item) => !item.stolen && !item.dropped);
    if (pool.length) {
      const dropChance = duelDropChance(working.char.special?.气运 ?? 5);
      if (rng() < dropChance) {
        const dropped = pool[Math.floor(rng() * pool.length)];
        const item = makeGameItem({ name: dropped.name, category: dropped.category || "misc", quality: dropped.quality || "白" });
        addChange(changes, working, "inv", (prev) => [...prev, item]);
        addChange(changes, working, "room", (prev) => ({
          ...prev,
          npcs: markCarriedLost(prev.npcs, npc.name, dropped, "dropped"),
        }));
        logs.push({ t: "loot", text: `✦ 一番切磋，${npc.name}的「${dropped.name}」竟落入你手（福缘所致）`, item, source: "duel", fromNpc: npc.name });
      }
    }
  }

  if (outcome === "win" && npc.respawn) {
    const fresh = createRespawnNpc?.(
      {
        name: npc.name,
        id: npc.id,
        brief: npc.brief,
        beast: true,
        respawn: true,
        cannotSpeak: true,
        personality: npc.personality,
        carry: [{ name: "金蛋", category: "misc", quality: "绿" }],
      },
      { luck: working.char.special?.气运 ?? 5, levelCap: npc.levelCap ?? 0 },
    );
    if (fresh) {
      addChange(changes, working, "room", (prev) => ({ ...prev, npcs: respawnNpc(prev.npcs, fresh) }));
      logs.push({ t: "sys", text: `  那大公鸡扑棱着翅膀又蹦了回来，梗着脖子冲你叫，似乎还想再斗一场。` });
    }
  }

  if (outcome === "win" && npc.tag) {
    const quest = QUCUO_QUESTS.find((entry) => entry.type === QUEST_TYPE.KILL && entry.targetTag === npc.tag);
    if (quest) {
      const current = state.questProgress?.[quest.id]?.count || 0;
      const nextCount = current + 1;
      const done = nextCount >= quest.requiredCount;
      addChange(changes, working, "questProgress", (prev) => ({
        ...prev,
        [quest.id]: { count: (prev[quest.id]?.count || 0) + 1 },
      }));
      if (done && current < quest.requiredCount) {
        logs.push({ t: "affection", text: `  ✓ 任务「${quest.title}」达成：${quest.rewardText}` });
        addChange(changes, working, "flags", (prev) => prev.includes(`quest_done_${quest.id}`) ? prev : [...prev, `quest_done_${quest.id}`]);
      } else {
        logs.push({ t: "sys", text: `  任务「${quest.title}」进度：${nextCount}/${quest.requiredCount}` });
      }
    }
  }

  if (loot?.droppedItem) {
    const droppedItem = loot.droppedItem;
    const item = { ...droppedItem, equipped: false };
    addChange(changes, working, "inv", (prev) => [...prev, item]);
    logs.push({ t: "loot", text: `⚔ 战利品：获得「${droppedItem.name}」`, item: droppedItem, source: "duel", fromNpc: npc.name });
    addChange(changes, working, "room", (prev) => ({
      ...prev,
      npcs: markCarriedLost(prev.npcs, npc.name, droppedItem, "stolen"),
    }));
  }
  if (loot?.droppedMoney > 0) {
    addChange(changes, working, "char", (prev) => ({ ...prev, money: (prev.money || 0) + loot.droppedMoney }));
    logs.push({ t: "item", text: `  💰 战利品：获得银两 ${loot.droppedMoney} 两` });
  }
  if (loot?.guaranteedLoot?.length) {
    addChange(changes, working, "inv", (prev) => [...prev, ...loot.guaranteedLoot]);
    for (const item of loot.guaranteedLoot) {
      logs.push({ t: "item", text: `  ⚔ 战利品：取得「${item.name}」（${item.quality}）` });
    }
  }

  const recap = recapBattleLog(battleLog);
  const outcomeText = outcome === "win"
    ? `你技高一筹，${npc.name}抱拳认输`
    : outcome === "lose"
      ? `你技逊一筹，向${npc.name}抱拳致意`
      : `这场切磋不了了之，收招罢手`;
  const factId = outcome ? `duel_${npc.name}_${state.time}` : null;
  const cue = outcome
    ? `主角与${npc.name}切磋比武，结果主角${outcome === "win" ? "技高一筹取胜" : "落于下风告负"}`
    : null;
  const witnesses = [
    npc.name,
    ...(state.room?.npcs || []).filter((entry) => entry.name !== npc.name).map((entry) => entry.name),
  ].map((name) => ({ name, 途径: "目击" }));
  if (factId) {
    logs.push({ t: "affection", text: `　◈ ${state.char?.name || "你"} 切磋 ${npc.name} · 战斗结算` });
  }
  const recapNote = `在${state.room?.name}与${npc.name}切磋${recap ? `，${recap.replace(/；/g, "、")}，` : "，"}${outcome === "win" ? "终获胜" : outcome === "lose" ? "落败" : "未分胜负"}。`;

  return {
    changes,
    logs,
    ...(note ? { note } : {}),
    ...(factId ? { fact: { id: factId, 摘要: cue, 标签: "切磋", 知晓者: witnesses, currentTurn: state.time } } : {}),
    factId,
    cue,
    recap,
    outcomeText,
    recapNote: recapNote.slice(0, 60),
  };
}

export function learnNpcSkill(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };

  const char = state.char || {};
  const skills = state.skills || [];
  const decision = tryLearnFromMaster(npc, state.varTree || {}, skills, char);
  if (!decision.ok) {
    return { logs: [{ t: "sys", text: `  ${decision.reason}` }] };
  }

  const money = char.money || 0;
  if (money < decision.totalPrice) {
    return {
      logs: [{
        t: "sys",
        text: `  ${npc.name}愿意传授，但束脩需银${decision.totalPrice}两（现有${money}两），你银两不够，一时难以成行。`,
      }],
    };
  }

  const priceNote = decision.totalPrice > 0
    ? `，奉上束脩银${decision.totalPrice}两`
    : "（好感深厚，分文不取）";
  const label = decision.isMaster ? "授业绝学" : "江湖通行招";
  const verb = decision.isMaster ? "将平生所学" : "将几手江湖基本功";

  return {
    changes: {
      varTree: (prev) => markNpcKnown(prev || {}, npc.name),
      char: { ...char, money: money - decision.totalPrice },
      skills: [...skills, ...decision.freshSkills],
    },
    logs: [{
      t: "sys",
      text: `  （习得 ${decision.freshSkills.length} 招${priceNote}，已录入武学栏 · ${label}，学即完整）`,
    }],
    settle: `拜${npc.name}为师，${npc.name}${verb}「${decision.moveBrief}」倾囊相授，我凝神习得`,
    settleOptions: {
      settleNpc: npc.name,
      settleKind: "learn_skill",
      learnInfo: {
        isMaster: decision.isMaster,
        moveBrief: decision.moveBrief,
        totalPrice: decision.totalPrice,
        beast: !!npc.beast || !!npc.cannotSpeak,
      },
    },
  };
}

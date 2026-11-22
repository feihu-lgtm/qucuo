import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { markNpcAsKnown as markNpcKnown } from "../../domain/rules/npc/npcAwareness.js";
import { markCarriedLost, respawnNpc } from "../../domain/rules/npc/roomNpcs.js";
import { duelAffGain, duelDropChance, duelPotGain, TEAMWORK_GAIN } from "../../domain/rules/combat/duelSettleMath.js";
import { random } from "../../utils/rng.js";
import { buildDuelReportRounds } from "../../domain/rules/combat/duelReport.js";
import { QUEST_TYPE } from "../../domain/data/quests/questTypes.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { BOUNTY_QUESTS } from "../../domain/data/quests/bountyQuests.js";
import { createQuestProgress, getCurrentStage, advanceQuestStages, lockExclusiveSiblings } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { duelAlly } from "../../domain/rules/companion/companion.js";
import { snowQuestActive } from "../../domain/rules/quests/snowLeopardQuest.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { forceAdvanceQuest } from "../quest/logic.js";
import { sectSparRepGain } from "../../domain/rules/economy/sectSpar.js";
import { factionRepDeltas } from "../../domain/rules/economy/factionRep.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);
// 一场切磋占用的游戏时间（time 一格 = 一小时），由系统直接加，不经过 AI
export const DUEL_HOURS = 1;

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
  for (const [key, update] of Object.entries(advancement.changes)) {
    addChange(changes, state, key, update);
  }
}

// 连胜类战斗分支（choice.streakFrom 指向连胜起点阶段）：输一场，连胜作废，
// 任务退回起点阶段，期间各阶段的 completionFlag 一并收回，免得引擎又顺着 flag 推回去。
function breakQuestStreak(state, changes, logs, branch) {
  const quest = QUCUO_QUESTS.find((entry) => entry.id === branch.questId);
  const choice = quest?.stages?.flatMap((stage) => stage.choices || []).find((entry) => entry.flag === branch.flag);
  const from = choice?.streakFrom ? quest.stages.findIndex((stage) => stage.id === choice.streakFrom) : -1;
  const progress = state.questProgress?.[quest?.id];
  if (from < 0 || progress?.status !== "active" || (progress.currentStageIndex ?? 0) <= from) return;
  const dropped = quest.stages.slice(from, progress.currentStageIndex).flatMap((stage) => [].concat(stage.completionFlag));
  addChange(changes, state, "flags", (flags) => (flags || []).filter((flag) => !dropped.includes(flag)));
  addChange(changes, state, "questProgress", (all) => ({ ...all, [quest.id]: { ...all[quest.id], currentStageIndex: from } }));
  logs.push({ t: "sys", text: `  连胜断了，「${quest.title}」得从头再打起。` });
}

function invHasNamedItem(inv, name) {
  return (inv || []).some((item) => (typeof item === "string" ? item : item?.name) === name);
}

function recapBattleLog(battleLog) {
  return (battleLog || []).map((row) => {
    if (row.teamText) return `第${row.round}回合，${row.teamText}`;
    const result = row.result || {};
    const bits = [`第${row.round}回合你使「${row.playerMove?.name || "未明招式"}」`];
    if (row.npcMove) bits.push(`对方使「${row.npcMove.name}」`);
    if (result.damageToB > 0) bits.push(`对方受创${result.damageToB}`);
    if (result.damageToA > 0) bits.push(`你受创${result.damageToA}`);
    if (row.narration) bits.push(`（说书：${row.narration}）`);
    return bits.join("，");
  }).join("；");
}

export function settleNpcDuel(state, npc, {
  outcome, loot, battleLog, grownMoveset, usedItems, remainingHp, dodgeStolenItems, pendingQuestBranch,
  reportFollows = false, now = Date.now(), rng = random, createRespawnNpc,
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
  const reportRounds = buildDuelReportRounds(battleLog);

  if (outcome === "win" && (npc.hostile || npc.tag === "黑风寨山贼" || state.varTree?.角色?.[npc.name]?.生气状态?.escalated) && snowQuestActive(state)) {
    addChange(changes, working, "flags", updateField("flags", (f) => set("flags", [...new Set([...f, "snow_spirit_duel"])])));
  }
  if (Array.isArray(battleLog) && battleLog.length) {
    const foe = npc.name || "对手";
    const battleLogs = [{ t: "sys", text: `　── 与${foe}切磋 ──` }];
    if (!reportFollows) {
      battleLogs.push(...reportRounds.map((entry) => ({ t: "desc", text: `  第${entry.round}回合 ${entry.text}` })));
    }
    logs.push(...battleLogs);
  }

  if (working.char.pendingCombatBuff) {
    addChange(changes, working, "char", (prev) => {
      const { pendingCombatBuff, ...rest } = prev;
      return rest;
    });
  }
  if (remainingHp) {
    addChange(changes, working, "char", updateField("char", (prev) => set("char.hp", [Math.max(0, Math.min(remainingHp[0], prev.hp[1])), prev.hp[1]])));
  }
  if (grownMoveset) addChange(changes, working, "char", updateField("char", set("char.moveset", grownMoveset)));

  if (pendingQuestBranch?.mode === "combat" && npc.questBranchFlag === pendingQuestBranch.flag) {
    if (outcome === "win") {
      const quest = QUCUO_QUESTS.find((entry) => entry.id === pendingQuestBranch.questId);
      if (quest) {
        appendQuestAdvancement(working, changes, quest, pendingQuestBranch.flag, now);
        logs.push({ t: "affection", text: `  ✓ 你打退了他们，「${quest.title}」推进。` });
      }
    } else {
      logs.push({ t: "sys", text: `  你没能打赢——这条路没走通，可换个法子再试。` });
      breakQuestStreak(working, changes, logs, pendingQuestBranch);
    }
  }

  if (usedItems?.length) {
    addChange(changes, working, "inv", updateField("inv", (prev) => {
      const next = [...prev];
      for (const name of usedItems) {
        const index = next.findIndex((item) => (typeof item === "object" ? item.name : item) === name);
        if (index !== -1) next.splice(index, 1);
      }
      return set("inv", next);
    }));
    const tally = usedItems.reduce((counts, name) => (counts[name] = (counts[name] || 0) + 1, counts), {});
    logs.push({ t: "item", text: `  ⊙ 切磋中服用：${Object.entries(tally).map(([name, count]) => `${name}×${count}`).join("、")}` });
  }

  for (const stolen of dodgeStolenItems || []) {
    const item = {
      ...makeGameItem({ name: stolen.name, category: stolen.category || "misc", quality: stolen.quality || "白" }),
      id: `duel_stolen_${stolen.id || stolen.name}_${now}`,
    };
    addChange(changes, working, "inv", updateField("inv", (prev) => set("inv", [...prev, item])));
    addChange(changes, working, "room", (prev) => ({
      ...prev,
      npcs: markCarriedLost(prev.npcs, npc.name, stolen, "stolen"),
    }));
    logs.push({ t: "loot", text: `  🤫 顺手摸走了「${stolen.name}」`, item, source: "steal", fromNpc: npc.name });
  }

  const { potGain, tierLabel } = duelPotGain(npc.levelCap, outcome);
  addChange(changes, working, "pot", updateField("pot", add("pot", potGain)));
  logs.push({ t: "item", text: `  ✦ 与${tierLabel}高手切磋${outcome === "win" ? "获胜" : outcome === "lose" ? "落败" : "罢手"}，长了见识，潜能 +${potGain}` });

  if (npc.name && !npc.tag) {
    const affGain = duelAffGain(outcome);
    addChange(changes, working, "varTree", (prev) => applyWrite(
      { varTree: markNpcKnown(prev || {}, npc.name) }, add(["角色", npc.name, "好感度"], affGain),
    ).state.varTree);
    logs.push({ t: "affection", text: `  💗 与${npc.name}切磋一场，交情 +${affGain}` });
  }

  // 任务带动的切磋战不算日常切磋档：战报只有文本不带毒伤，也不该吃掉当日刷声誉额度。
  // 但胜的是门派切磋榜上的试剑对手时，首胜旗与首胜声誉照发——拜师试炼认的是
  // 「堂堂正正胜过此人」，不认入口；从任务选项赢下青玄的玩家不该卡在山门。
  let sparRep = sectSparRepGain(working, npc, { outcome, battleLog });
  if (sparRep && pendingQuestBranch?.mode === "combat") {
    const grantsFirstWin = (sparRep.flags || []).some((f) => f.endsWith("_first") && !working.flags.includes(f));
    if (!grantsFirstWin) sparRep = null;
  }
  if (sparRep?.poison) {
    logs.push({ t: "sys", text: `  ${npc.name}瞥了眼身上的毒伤：「赢是赢了，${sparRep.faction}不认这一场。」` });
  } else if (sparRep?.delta) {
    const repDeltas = factionRepDeltas({ [sparRep.faction]: sparRep.delta }, working.varTree);
    for (const [faction, delta] of Object.entries(repDeltas)) {
      addChange(changes, working, "varTree", (prev) => applyWrite(
        { varTree: prev || {} }, add(["世界", "势力声誉", faction], delta),
      ).state.varTree);
    }
    addChange(changes, working, "flags", updateField("flags", set("flags", sparRep.flags)));
    logs.push({ t: "affection", text: `  ✦ 堂堂正正赢了${npc.name}，${sparRep.faction}声誉 +${sparRep.delta}` });
    const foeLoss = Object.entries(repDeltas).filter(([faction, delta]) => faction !== sparRep.faction && delta < 0);
    if (foeLoss.length) {
      logs.push({ t: "sys", text: `  消息传开，${foeLoss.map(([faction, delta]) => `${faction}声誉 ${delta}`).join("，")}` });
    }
  }

  if (outcome === "win" && duelAlly(state.companionState, npc)) {
    addChange(changes, working, "varTree", (prev) => applyWrite(
      { varTree: markNpcKnown(prev || {}, "雪豹") }, add(["角色", "雪豹", "好感度"], TEAMWORK_GAIN),
    ).state.varTree);
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
    addChange(changes, working, "inv", updateField("inv", (prev) => set("inv", [...prev, item])));
    logs.push({ t: "loot", text: `✦ ${npc.name}倒地时，那件${drop.name}从他身上滑落——你捡了起来。`, item, source: "duel", fromNpc: npc.name });
    note = {
      text: `打赢${npc.name}，从他身上得了「${drop.name}」。`,
      owner: [{ name: npc.name, via: VIA.FIRSTHAND }],
      source: NOTE_SOURCE.NARRATIVE,
    };
  }

  if (outcome === "win" && npc.name && !npc.tag) {
    const pool = (npc.carriedItems || []).filter((item) => !item.stolen && !item.dropped && !(dodgeStolenItems || []).some((stolen) => stolen.id ? item.id === stolen.id || (!item.id && item.name === stolen.name) : item.name === stolen.name));
    if (pool.length) {
      const dropChance = duelDropChance(working.char.special?.气运 ?? 5);
      if (rng() < dropChance) {
        const dropped = pool[Math.floor(rng() * pool.length)];
        const item = makeGameItem({ name: dropped.name, category: dropped.category || "misc", quality: dropped.quality || "白" });
        addChange(changes, working, "inv", updateField("inv", (prev) => set("inv", [...prev, item])));
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
        addChange(changes, working, "flags", updateField("flags", (prev) => set("flags", prev.includes(`quest_done_${quest.id}`) ? prev : [...prev, `quest_done_${quest.id}`])));
      } else {
        logs.push({ t: "sys", text: `  任务「${quest.title}」进度：${nextCount}/${quest.requiredCount}` });
      }
    }
  }

  if (outcome === "win") {
    // 悬赏榜：击杀目标名（档案名或 tag 皆可）计入已接悬赏的进度，攒够回镖局领赏。
    for (const bounty of BOUNTY_QUESTS) {
      if (bounty.target !== npc.name && bounty.target !== npc.tag) continue;
      const progress = state.questProgress?.[bounty.id];
      if (!progress?.active) continue;
      const need = bounty.requiredCount || 1;
      const nextCount = Math.min((progress.count || 0) + 1, need);
      addChange(changes, working, "questProgress", (prev) => ({
        ...prev,
        [bounty.id]: { ...prev[bounty.id], count: nextCount },
      }));
      logs.push({ t: "sys", text: `  悬赏「${bounty.title}」进度：${nextCount}/${need}${nextCount >= need ? "，可回镖局领赏" : ""}` });
    }
  }

  if (loot?.droppedItem) {
    const droppedItem = loot.droppedItem;
    const item = { ...droppedItem, equipped: false };
    addChange(changes, working, "inv", updateField("inv", (prev) => set("inv", [...prev, item])));
    logs.push({ t: "loot", text: `⚔ 战利品：获得「${droppedItem.name}」`, item: droppedItem, source: "duel", fromNpc: npc.name });
    addChange(changes, working, "room", (prev) => ({
      ...prev,
      npcs: markCarriedLost(prev.npcs, npc.name, droppedItem, "stolen"),
    }));
  }
  if (loot?.droppedMoney > 0) {
    addChange(changes, working, "char", updateField("char", add("char.money", loot.droppedMoney)));
    logs.push({ t: "item", text: `  💰 战利品：获得银两 ${loot.droppedMoney} 两` });
  }
  if (loot?.guaranteedLoot?.length) {
    addChange(changes, working, "inv", updateField("inv", (prev) => set("inv", [...prev, ...loot.guaranteedLoot])));
    for (const item of loot.guaranteedLoot) {
      logs.push({ t: "item", text: `  ⚔ 战利品：取得「${item.name}」（${item.quality}）` });
    }
  }

  if (outcome) addChange(changes, working, "time", updateField("time", add("time", DUEL_HOURS)));

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
    reportRounds,
    outcomeText,
    recapNote: recapNote.slice(0, 60),
  };
}

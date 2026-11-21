import { QUALITY, CATEGORY_LABEL, makeItem } from "../../domain/economy/equipment.js";
import { makeItemSmart, CATALOG_INDEX } from "../../domain/items/catalog.js";
import { markNpcAsKnown as markNpcKnown } from "../../domain/npc/npcAwareness.js";
import { computeGiftWeight } from "../../domain/npc/giftWeight.js";
import { markCarriedLost } from "../../domain/npc/roomNpcs.js";
import { tryLearnFromMaster, tryStealFrom } from "../../domain/kungfu/learnSkill.js";
import { isNpcAngry, stealSuccessRate } from "../../domain/combat/stealSystem.js";
import { bar } from "../../utils/mudHelpers.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { getCurrentStage } from "../../domain/quests/questEngine.js";
import { ESCORT_QUESTS } from "../../domain/quests/escortQuests.js";
import { snowMedicineGift } from "../quest/snowLeopard.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";
import { buildShopInventory, rollShopStock } from "../../domain/shops/qucuoShops.js";
import { appeaseAngryNpc, recordNpcAttempt } from "./anger.js";
import { add, applyWrite, set, updateField } from "../../domain/state/applyWrite.js";
import { giftRange } from "../../domain/state/fields.js";
import { forceAdvanceQuest } from "./questAdvancement.js";

export { settleNpcDuel } from "./settleDuel.js";
export { appeaseAngryNpc };

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

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

export function talkToNpc(state, npc, { now = Date.now() } = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const result = { changes: { varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "talk", detail: "", time: now }) } };
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
      char: updateField("char", add("char.money", activeEscort.reward)),
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

export function describeGiftForPrompt(item) {
  const itemName = typeof item === "string" ? item : item?.name;
  const catalogEntry = CATALOG_INDEX[itemName];
  const inventoryEntry = typeof item === "object" ? item : null;
  const quality = catalogEntry?.quality || inventoryEntry?.quality || "白";
  const desc = catalogEntry?.desc || inventoryEntry?.desc || "";
  const category = catalogEntry?.category || inventoryEntry?.category || null;
  const categoryLabel = category ? (CATEGORY_LABEL[category] || category) : null;
  const [lo, hi] = giftRange(quality);
  return { itemName, quality, desc, categoryLabel, range: [lo, hi], suggestedDelta: Math.round((lo + hi) / 2) };
}

export function giftNpc(state, npc, item, now = Date.now()) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (!item) return { logs: [{ t: "err", text: "  背包中没有这件物品。" }] };
  const itemName = typeof item === "string" ? item : item.name;
  const giftInfo = describeGiftForPrompt(item);
  const weight = computeGiftWeight(npc, typeof item === "string" ? CATALOG_INDEX[item] || {} : item);
  giftInfo.weight = weight;
  const inv = state.inv || [];
  let nextInv = inv;
  if (typeof item === "object" && item.id != null) {
    nextInv = inv.filter((entry) => !(typeof entry === "object" && entry.id === item.id));
  } else {
    const index = inv.findIndex((entry) => (typeof entry === "string" ? entry : entry.name) === itemName);
    if (index !== -1) nextInv = [...inv.slice(0, index), ...inv.slice(index + 1)];
  }
  if (nextInv.length === inv.length) return { logs: [{ t: "err", text: "  背包中没有这件物品。" }] };

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

  const isAngry = isNpcAngry(state.varTree, npc.name);
  const command = isAngry ? `在${npc.name}气头上，将「${itemName}」赠予对方，试图以此赔罪示好` : (deliveredQuest ? `将「${itemName}」郑重交给${npc.name}——这正是${npc.name}等着的东西` : `将「${itemName}」赠予${npc.name}`);
  const changes = { varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now }), inv: applyWrite(state, set("inv", nextInv)).state.inv };
  const logs = [];
  if (snowMedicineGift(state, npc, item)) {
    changes.flags = updateField("flags", (flags) => set("flags", [...new Set([...flags, "snow_spirit_medicine"])]));
    logs.push({ t: "sys", text: "  你替雪豹敷药，前爪的陈年旧伤终于好了。" });
  }
  if (deliveredQuest) {
    const advancement = forceAdvanceQuest(state, deliveredQuest.quest, deliveredQuest.flag, now);
    for (const [key, update] of Object.entries(advancement)) {
      changes[key] = (key === "varTree" || key === "inv") && changes[key]
        ? composeUpdates(changes[key], update)
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
    settleOptions: { settleNpc: npc.name, settleKind: isAngry ? "appease" : "gift", giftInfo },
    deliveredQuest: deliveredQuest?.quest || null,
  };
}

export function giftSilver(state, npc, amount, now = Date.now()) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (!Number.isSafeInteger(amount) || amount <= 0) return { logs: [{ t: "err", text: "  礼金须为正整数两。" }] };
  if ((state.char?.money ?? 0) < amount) return { logs: [{ t: "err", text: "  随身银两不足，未送出。" }] };
  const angry = isNpcAngry(state.varTree, npc.name);
  const itemName = `${amount}两银子`;
  return {
    changes: {
      char: updateField("char", add("char.money", -amount)),
      varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now }),
    },
    settle: `将${itemName}赠予${npc.name}`,
    settleOptions: {
      settleNpc: npc.name,
      settleKind: angry ? "appease" : "gift",
      giftInfo: { itemName, amount, weight: computeGiftWeight(npc, { amount }) },
    },
  };
}

export function tradeWithNpc(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "trade" });
  const shopData = rollShopStock(npc.name, state.time) || buildShopInventory(npc.name);
  if (!shopData) {
    return { logs: [{ t: "sys", text: `  ${npc.name}摆摆手，「小店暂无货可卖。」` }] };
  }
  return { shop: { npcName: npc.name, ...shopData } };
}

export { inviteCompanion } from "./inviteCompanion.js";

export function stealFromNpc(state, npc, { now = Date.now() } = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }], kind: "blocked" };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "steal", detail: "偷窃", now });
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
          return updateField("varTree", [
            add(["角色", npc.name, "好感度"], -result.favorabilityLoss),
            set(["角色", npc.name, "生气状态"], result.angryState),
          ])(known);
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
        inv: updateField("inv", (prev) => set("inv", [...prev, fullItem])),
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

export function learnNpcSkill(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "learn" });

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
      char: applyWrite({ char }, add("char.money", -decision.totalPrice)).state.char,
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

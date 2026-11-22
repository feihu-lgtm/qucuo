// NPC 财物往来：赠礼 / 送银 / 交易。
// 从 logic.js 按动作分组拆出——这组只管"东西和银子的来往"。
import { CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { computeGiftWeight, giftPreferenceLabel } from "../../domain/rules/npc/giftWeight.js";
import { isNpcAngry } from "../../domain/rules/combat/stealSystem.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getCurrentStage } from "../../domain/rules/quests/questEngine.js";
import { snowMedicineGift, snowMeatGift } from "../quest/snowLeopard.js";
import { buildShopInventory, rollShopStock } from "../../domain/data/shops/qucuoShops.js";
import { appeaseAngryNpc, recordNpcAttempt } from "./anger.js";
import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { giftRange } from "../../domain/rules/state/fields.js";
import { forceAdvanceQuest } from "../quest/logic.js";
import { soupKitchenRepGain } from "../../domain/rules/economy/soupKitchen.js";
import { factionTurnInOf } from "../../domain/rules/economy/factionTurnIn.js";
import { isNpcKnown, INITIAL_FAVORABILITY } from "../../domain/rules/npc/npcAwareness.js";
import { herbDonationRepGain } from "../../domain/rules/economy/herbDonation.js";
import { applyFactionRep } from "../../domain/rules/economy/factionRep.js";

function composeUpdates(first, second) {
  return (prev) => {
    const intermediate = typeof first === "function" ? first(prev) : first;
    return typeof second === "function" ? second(intermediate) : second;
  };
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
  giftInfo.preferLabel = giftPreferenceLabel(npc);
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
  const snowFlags = [];
  if (snowMedicineGift(state, npc, item)) {
    snowFlags.push("snow_spirit_medicine");
    logs.push({ t: "sys", text: "  你替雪豹敷药，前爪的陈年旧伤终于好了。" });
  }
  if (snowMeatGift(state, npc, item)) {
    snowFlags.push("snow_spirit_meat");
    logs.push({ t: "sys", text: "  雪豹衔起肉来三两口吞下，金瞳里透出几分满足。" });
  }
  if (snowFlags.length) {
    changes.flags = updateField("flags", (flags) => set("flags", [...new Set([...flags, ...snowFlags])]));
  }
  const herb = herbDonationRepGain(state, npc, typeof item === "string" ? CATALOG_INDEX[item] : item);
  if (herb) {
    changes.varTree = composeUpdates(changes.varTree, (prev) => applyFactionRep(prev, { [herb.faction]: herb.delta }, { ripple: false }));
    changes.flags = changes.flags ? composeUpdates(changes.flags, herb.flags) : herb.flags;
    logs.push({ t: "affection", text: `  ✦ ${herb.text}，${herb.faction}声誉 +${herb.delta}` });
  }
  // 势力信物交还：血刀信物/流亡凭证/蜜蜡残珠这类交到指定人物手上，涨本派声誉（死对头扣分走联动）。
  const turnIn = factionTurnInOf(npc, itemName);
  if (turnIn) {
    changes.varTree = composeUpdates(changes.varTree, (prev) => {
      // 联动扣分只挂本派那笔；extra 的友派加分按合稿面值给，不二次联动。
      let next = applyFactionRep(prev, { [turnIn.faction]: turnIn.rep });
      if (turnIn.extra && Object.keys(turnIn.extra).length) {
        next = applyFactionRep(next, turnIn.extra, { ripple: false });
      }
      // favor 是合稿「大幅拉升好感」，写在实际收物人的档案名下（npc.name，
      // 比如嘉措的档案名是「喇嘛庙住持」）；没照过面的先按初始分起底再加。
      if (turnIn.favor) {
        const write = isNpcKnown(next, npc.name)
          ? add(["角色", npc.name, "好感度"], turnIn.favor)
          : set(["角色", npc.name, "好感度"], INITIAL_FAVORABILITY + turnIn.favor);
        next = applyWrite({ varTree: next }, write).state.varTree;
      }
      return next;
    });
    logs.push({ t: "affection", text: `  ✦ ${turnIn.log}（${turnIn.faction}声誉 +${turnIn.rep}）` });
  }
  if (deliveredQuest) {
    const advancement = forceAdvanceQuest(state, deliveredQuest.quest, deliveredQuest.flag, now);
    for (const [key, update] of Object.entries(advancement.changes)) {
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
  const alms = soupKitchenRepGain(state, npc, amount);
  return {
    changes: {
      char: updateField("char", add("char.money", -amount)),
      varTree: (prev) => {
        const tree = recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now });
        if (!alms) return tree;
        return applyFactionRep(tree, { [alms.faction]: alms.delta });
      },
      ...(alms ? { flags: alms.flags } : {}),
    },
    ...(alms ? { logs: [{ t: "affection", text: `  ✦ ${alms.log}，${alms.faction}声誉 +${alms.delta}` }] } : {}),
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
  return { shop: { npcName: npc.name, district: state.room?.name, ...shopData } };
}

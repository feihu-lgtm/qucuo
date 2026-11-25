// NPC 财物往来：赠礼 / 送银 / 交易。
// 从 logic.js 按动作分组拆出——这组只管"东西和银子的来往"。
import { CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { computeGiftWeight, giftPreferenceLabel } from "../../domain/rules/npc/giftWeight.js";
import { isNpcAngry } from "../../domain/rules/combat/stealSystem.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getCurrentStage, isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { snowMedicineGift, snowMeatGift } from "../quest/snowLeopard.js";
import { buildShopInventory, buildOcShopInventory, rollShopStock } from "../../domain/data/shops/qucuoShops.js";
import { affectionOf, buildCarryShelf, flattenShelf, sellCoefOf } from "../../domain/rules/npc/npcTradeFlow.js";
import { refreshDailyShop, dailyShopDayKey, promoForDay, isDailyShopNpc } from "../../domain/rules/npc/dailyShop.js";
import { appeaseAngryNpc, recordNpcAttempt } from "./anger.js";
import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { giftRange } from "../../domain/rules/state/fields.js";
import { systemAffectionDelta, hasNoAffectionTrack } from "../../domain/rules/state/affection.js";
import { selectEffectiveStats } from "../stats/logic.js";
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

// 进行中任务前面阶段发到手的道具（田契残页、密函这类），没对上当前阶段的 deliver 就不能当普通礼物送掉，
// 否则物品被扣、任务却不推进。fromCatalog 的是铁莲子这类普通货，照常能送——除非后面阶段点名要它。
const stageNeedsItem = (stage, itemName) => stage.requiresItems?.includes(itemName)
  || stage.onReach?.consumeItems?.includes(itemName)
  || stage.choices?.some((choice) => choice.requiresItems?.includes(itemName));

function questPropHolder(state, itemName) {
  for (const quest of QUCUO_QUESTS) {
    const progress = state.questProgress?.[quest.id];
    if (progress?.status !== "active" || !quest.stages?.length) continue;
    const index = progress.currentStageIndex ?? 0;
    const reached = quest.stages.slice(0, index);
    if (reached.some((stage) => (stage.onReach?.items || []).some((entry) => entry?.name === itemName && !entry.fromCatalog))) return quest;
    if (quest.stages.slice(index).some((stage) => stageNeedsItem(stage, itemName))) return quest;
  }
  return null;
}

export function giftNpc(state, npc, item, now = Date.now(), { deferToJudge = false } = {}) {
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
    // 交物任务还没「接」也能交到收件人手上：无发布人（山3·上山）和有发布人
    // （村2 替才旦送糌粑）都一样，门开着交到即开启并推进，不会被当普通礼物吞掉。
    const unstartedHandIn = !progress && isQuestGateOpen(quest, state.questProgress, state.flags, state.varTree);
    if (progress?.status !== "active" && !unstartedHandIn) continue;
    const stage = progress ? getCurrentStage(quest, progress) : quest.stages[0];
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

  if (!deliveredQuest) {
    const held = questPropHolder(state, itemName);
    if (held) {
      return { logs: [{ t: "sys", text: `  「${itemName}」是「${held.title}」还要用的东西，没有送出——到任务面板里推进那一步时再交。` }] };
    }
  }

  const isAngry = isNpcAngry(state.varTree, npc.name);
  const command = isAngry ? `在${npc.name}气头上，将「${itemName}」赠予对方，试图以此赔罪示好` : (deliveredQuest ? `将「${itemName}」郑重交给${npc.name}——这正是${npc.name}等着的东西` : `将「${itemName}」赠予${npc.name}`);

  // WO-16F-F4a 先裁后落：判官链激活时普通送礼不在叙事前扣物/写好感——只记尝试，
  // 扣物+好感收拒由 settle 回合本地合成 give 听意单 → judgeTurn 裁定 → materializeFacts
  // 落账（TRANSFER_ITEM 玩家→NPC + MUTATE_SOCIAL 恩），与自由文本 give 同口径。
  // 以下情形仍走 legacy 前置硬结算（各有独立确定性通道，非判官自由裁量）：
  //   · 任务交付（forceAdvanceQuest 统一扣件推进）
  //   · 雪豹药/肉（任务旗）、草药捐赠声誉、势力信物交还（声誉联动）
  //   · 生气送礼（settleKind=appease，归 WO-16F-F3 赔罪判官路）
  // 判定词与 runTurn 闸门必须同源（judgePipelineEnabled && extractionEnabled），
  // 由调用方按 sessionUiStore apiCfg 传入；谓词错位最多退化为 legacy，不会双结算。
  const specialChannel = deliveredQuest
    || snowMedicineGift(state, npc, item) || snowMeatGift(state, npc, item)
    || !!herbDonationRepGain(state, npc, typeof item === "string" ? CATALOG_INDEX[item] : item)
    || !!factionTurnInOf(npc, itemName);
  if (deferToJudge && !isAngry && !specialChannel) {
    return {
      changes: { varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now }) },
      logs: [],
      settle: command,
      settleOptions: {
        settleNpc: npc.name, settleKind: "gift", giftInfo,
        // 确定性寻址：对象条目优先 id（同名不混淆），字符串/目录条目退化为名字。
        giftRequest: {
          itemId: (typeof item === "object" && item?.id != null) ? item.id : itemName,
          itemName,
        },
      },
    };
  }

  // 命中任务交付时不在此预扣——交付物由 forceAdvanceQuest 统一扣，否则一件东西被扣两次。
  const changes = { varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now }) };
  // WO-16B：好感增量随 feature 硬结算确定性落账（不再等 AI 写 MVU）。
  // 生气时礼物只走 appease 仲裁，不双重加挂念；无好感轨道跳过。
  if (!isAngry && !hasNoAffectionTrack(npc)) {
    const range = weight?.range ?? giftRange(giftInfo.quality);
    const preferHit = giftInfo.preferLabel && giftInfo.categoryLabel === giftInfo.preferLabel;
    const baseDelta = preferHit ? range[1] : Math.round((range[0] + range[1]) / 2);
    const charm = selectEffectiveStats(state).effectiveSpecialNow?.魅力 ?? 5;
    changes.varTree = composeUpdates(changes.varTree, (prev) =>
      systemAffectionDelta(prev, npc.name, baseDelta, { charm, time: state.time ?? 0, range }).tree);
  }
  if (!deliveredQuest) changes.inv = applyWrite(state, set("inv", nextInv)).state.inv;
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
    if (Object.keys(advancement.changes).length) {
      for (const [key, update] of Object.entries(advancement.changes)) {
        changes[key] = (key === "varTree" || key === "inv") && changes[key]
          ? composeUpdates(changes[key], update)
          : update;
      }
      logs.push({
        t: "affection",
        text: `  ✓ 你把「${itemName}」交到${npc.name}手上，「${deliveredQuest.quest.title}」推进。`,
      });
    } else {
      // 闸口没放行（如任务被别的旗锁住）——退回普通赠予，物品自己扣，不落「推进」假日志。
      deliveredQuest = null;
      changes.inv = applyWrite(state, set("inv", nextInv)).state.inv;
    }
  }
  // 换装同步链④：玩家送出装备类条目 → NPC 当场穿上（记进他的随身装束，
  // deriveAppearance/npcGear 立即反映，prompt 外貌段跟着变）。
  const giftedEntry = typeof item === "object" ? item : CATALOG_INDEX[itemName];
  const giftedCategory = giftedEntry?.category;
  if (GIFT_GEAR_CATEGORIES.has(giftedCategory) && npc?.name) {
    // 保留礼物全量字段（attack/defense/effect/sixDim）——不然买回来是件空壳；
    // equipped/id 之类的玩家背包状态不带过去。
    const worn = {
      ...giftedEntry,
      name: itemName, category: giftedCategory, quality: giftedEntry.quality || "白",
      slot: "equipment", desc: giftedEntry.desc || "", equipped: false,
      id: `gift_${npc.name}_${itemName}_${Date.now()}`,
    };
    changes.room = (prev) => ({
      ...prev,
      npcs: (prev.npcs || []).map((n) => {
        if (n.name !== npc.name) return n;
        // carriedItems 是唯一 live 随身源（货架/偷池都读它）——礼物写进它，
        // 穿上能看、买回来也不是空壳。
        return { ...n, carriedItems: [...(n.carriedItems || []), worn] };
      }),
    });
    logs.push({ t: "sys", text: `  ${npc.name}换上了${itemName}。` });
  }
  return {
    changes,
    logs,
    settle: command,
    settleOptions: { settleNpc: npc.name, settleKind: isAngry ? "appease" : "gift", giftInfo },
    deliveredQuest: deliveredQuest?.quest || null,
  };
}

const GIFT_GEAR_CATEGORIES = new Set(["weapon", "armor", "accessory"]);

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
        let tree = recordNpcAttempt(prev, npc.name, { kind: "gift", detail: itemName, time: now });
        // WO-16B：送银好感确定性硬结算；生气只走 appease，无好感轨道跳过。
        if (!angry && !hasNoAffectionTrack(npc)) {
          const range = computeGiftWeight(npc, { amount })?.range;
          const baseDelta = range ? Math.round((range[0] + range[1]) / 2) : 2;
          const charm = selectEffectiveStats(state).effectiveSpecialNow?.魅力 ?? 5;
          tree = systemAffectionDelta(tree, npc.name, baseDelta, { charm, time: state.time ?? 0, range }).tree;
        }
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
  // 日更杂货摊：换日先刷新货架（changes{room,npcState}+吆喝 logs 由调用方落账）。
  const refreshed = refreshDailyShop(state, npc);
  if (refreshed) npc = refreshed.npc;
  // 货架换源（设计稿 §2.1）：不再出独立 goods 货架——货架=对方 carriedItems
  // 经 normalizeCarryEntry 后按 slot 分区；mount 只展示，sellable=false 标「不卖」，
  // 钟爱走 quoteBuy 价档（中钟爱 3×、挚爱拒售、好感≥60 割爱 2×）。
  const affection = affectionOf(state.varTree, npc.name);
  const sections = buildCarryShelf(npc, affection);
  const items = flattenShelf(sections);
  // 旧独立货架（OC 货单/店档）改作「店里陈列」：保留展示但不走随身清单成交。
  const displayData = buildOcShopInventory(npc.name) || rollShopStock(npc.name, state.time) || buildShopInventory(npc.name);
  const display = (displayData?.items || []).map(i => ({ ...i, displayOnly: true }));
  if (!items.length && !display.length) {
    return { logs: [{ t: "sys", text: `  ${npc.name}摆摆手，「身无长物，没什么好交易的。」` }] };
  }
  return {
    shop: {
      npcName: npc.name,
      npcId: npc.id ?? npc.name,
      district: state.room?.name,
      shopName: displayData?.shopName || `${npc.name}的随身货`,
      sections,
      sellCoef: sellCoefOf(npc, affection),
      // 节气日给 UI 一个「大促」标识——折扣已在生成时折进 price，不再二次减价。
      promo: refreshed ? refreshed.promo : (isDailyShopNpc(npc) ? promoForDay(dailyShopDayKey()) : null),
      items: [...items, ...display],
    },
    // 日更刷新落账：换货后的 room + 记了刷新日的 npcState + 吆喝日志。
    ...(refreshed ? { changes: { room: refreshed.room, npcState: refreshed.npcState }, logs: refreshed.logs } : {}),
  };
}

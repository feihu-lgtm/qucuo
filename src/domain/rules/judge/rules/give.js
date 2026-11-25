// ── give 赠礼收拒裁决（S4 纯搬家：原 judgeTurn.js give 分支原样移入）──
import { CATALOG_INDEX } from "../../../data/items/catalog.js";
import { giftPreference, computeGiftWeight } from "../../npc/giftWeight.js";
import { personaMod, affectionMod } from "./shared.js";

export function handleGive(J, action, npc, aff, stanceMod) {
  const { roll, facts, notes, nextFactId, inv, isDeliverGive } = J;
  // WO-16F-F4a：字符串背包条目（初始存档遗产形态，如「半袋青稞」）也要能找到——
  // 只认对象 id/name 会让按钮 defer 的礼物判官查无此物，重量/偏好全空。
  const item = inv.find((it) => (typeof it === "string"
    ? it === action.itemId
    : it?.id === action.itemId || it?.name === action.itemId));
  // 重量/偏好/交付判定读对象形状——字符串条目规范化（目录属性并入，无目录裸名兜底），
  // 不改写 item 本体（TRANSFER 寻址仍走 action.itemId/item.id 原口径）。
  const itemObj = typeof item === "string"
    ? { name: item, ...(CATALOG_INDEX[item] || {}) }
    : item;
  if (isDeliverGive(action, itemObj)) {
    notes.push(`${action.target}的${item?.name || "物件"}走任务交付通道结算，赠礼动作去重压制`);
    return;
  }
  // S2 补洞：所赠之物必须在玩家背包实有——查无此物时不得签发。
  // 否则「把5两银子送给X」（银两不是背包物件）或幻影礼物会空签 TRANSFER_ITEM
  // 落空 + MUTATE_SOCIAL 好感照涨，货未出手恩已入账。银两赠予的确定性路由
  // 属 WO-16F 级覆盖缺口，本闸先把假账封死。
  if (!item) {
    notes.push(`所赠之物「${action.item || action.itemId || "未名"}」不在囊中，赠礼不签发`);
    return;
  }
  const prefer = giftPreference(npc);
  const preferHit = prefer && itemObj?.category === prefer ? 0.15 : 0;
  const weight = itemObj ? computeGiftWeight(npc, itemObj) : null;
  const weightMod = weight?.ratio >= 2 ? 0.15 : weight?.ratio >= 1 ? 0.05 : -0.05;
  const score = 0.55 + personaMod(npc.personality) + affectionMod(aff) + preferHit + weightMod + stanceMod;
  if (roll() < Math.max(0.05, Math.min(0.95, score))) {
    J.accept.value = true;
    facts.push({
      id: nextFactId(), op: "TRANSFER_ITEM",
      itemId: (item && typeof item === "object" ? item.id : null) || action.itemId || "",
      itemName: itemObj?.name || action.itemId || "礼物",
      from: "player", to: npc.name, witnesses: ["主角", npc.name],
    });
    // WO-16F-F4a：无好感轨道对象（兽类/intimacy.forbidden）只收物不涨好感——
    // 与 legacy giftNpc 的 hasNoAffectionTrack 口径一致（谓词内联同 talk 分支，防循环依赖）。
    if (!(npc?.intimacy?.forbidden || npc?.beast)) {
      facts.push({
        id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
        affectionDelta: weight?.ratio >= 2 ? 6 : weight?.ratio >= 1 ? 4 : 2,
        ledgerKind: "恩", reason: `赠${itemObj?.name || "礼"}`, witnesses: ["主角", npc.name],
      });
    }
  } else {
    // 拒收不产扣物事实——物件还在玩家身上，彻底消灭错账
    notes.push(`${npc.name}拒收${itemObj?.name || "礼物"}，物件未易主`);
  }
}

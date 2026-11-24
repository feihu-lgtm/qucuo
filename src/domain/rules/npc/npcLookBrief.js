// 查看 NPC：系统卡片（来历、装束）立刻给出，外貌描写后台补写。
import { ITEM_CATEGORY } from "../economy/equipment.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { attireExposure } from "./npcCarry.js";

const GEAR = new Set([ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]);

export function npcGear(npc) {
  // carriedItems 是唯一 live 随身源（货架/偷池/送礼都写它）；类目未标的条目
  // 走 normalize 口径——OC 的 stealables 装备多数不写 category，名录也查得到。
  return [...new Set((npc?.carriedItems || [])
    .filter((item) => item?.name && !item.stolen && !item.dropped && !item.sold)
    .map((item) => {
      // 袋装货不是穿戴——玩家卖给他的装备躺在 bag 槽里，不算装束。
      if (item.slot === "bag" || item.slot === "mount") return null;
      const cat = item.category || CATALOG_INDEX[item.name]?.category;
      return cat && cat !== ITEM_CATEGORY.MISC && GEAR.has(cat) ? item.name : null;
    })
    .filter(Boolean))];
}

// 换装同步链的外观段：装备随买卖/偷窃/赠送变化时重算——sold/stolen 标记写进条目
// 那一刻，本函数读到就是新外观，look 卡/prompt 自然即时刷新，不需要单独存外观字段。
export function deriveAppearance(npc) {
  return { gear: npcGear(npc), exposure: attireExposure(npc) };
}

export function npcLookCard(npc) {
  if (!npc?.name) return [];
  const { gear, exposure } = deriveAppearance(npc);
  return [
    { t: "sys", text: `  ${npc.name}${npc.brief ? `：${npc.brief}` : ""}` },
    gear.length ? { t: "sys", text: `  装束：${gear.join("、")}` } : null,
    exposure ? { t: "sys", text: `  ⚠ ${exposure}——浑身上下再找不出一件完整的行头。` } : null,
  ].filter(Boolean);
}

export function buildNpcLookPrompt(npc, { place = "" } = {}) {
  const sys = `你是曲措乡的说书人。玩家正在端详一个人，名字、来历、装束已由系统列出。
写一段两到四句的描写（不超过一百二十字），只写此人的容貌装束、气色伤势、当下神态举止。
铁律：装束只写给定的，不添新物品；此人不开口说话、不出手、不推进任何事件；不写其他人；不替玩家做决定、不向玩家提问；
白话古文的说书人口吻，不用冒号破折号。只输出正文，不要任何前后缀。`;
  const hp = npc?.combatStats?.hp;
  const user = [
    place ? `地点：${place}` : "",
    `人物：${npc?.name || ""}`,
    npc?.brief ? `来历：${npc.brief}` : "",
    (npc?.fullBio || npc?.personality) ? `人设：${npc.fullBio || npc.personality}` : "",
    npcGear(npc).length ? `装束：${npcGear(npc).join("、")}` : "",
    deriveAppearance(npc).exposure ? `衣着状态：${deriveAppearance(npc).exposure}（被扒得几乎不剩行头，叙事要照实反映）` : "",
    Array.isArray(hp) && hp[1] > 0 && hp[0] < hp[1] ? `气血：${hp[0]}/${hp[1]}` : "",
  ].filter(Boolean).join("\n");
  return { sys, user };
}

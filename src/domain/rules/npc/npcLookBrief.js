// 查看 NPC：系统卡片（来历、装束）立刻给出，外貌描写后台补写。
import { ITEM_CATEGORY } from "../economy/equipment.js";

const GEAR = new Set([ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]);

export function npcGear(npc) {
  return (npc?.carriedItems || [])
    .filter((item) => item?.name && !item.stolen && GEAR.has(item.category))
    .map((item) => item.name);
}

export function npcLookCard(npc) {
  if (!npc?.name) return [];
  const gear = npcGear(npc);
  return [
    { t: "sys", text: `  ${npc.name}${npc.brief ? `：${npc.brief}` : ""}` },
    gear.length ? { t: "sys", text: `  装束：${gear.join("、")}` } : null,
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
    Array.isArray(hp) && hp[1] > 0 && hp[0] < hp[1] ? `气血：${hp[0]}/${hp[1]}` : "",
  ].filter(Boolean).join("\n");
  return { sys, user };
}

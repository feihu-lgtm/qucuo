// 地宫 OC 冒险者：节点生成 + 抢劫/反水夺取的纯构建器（不含选择裁决，裁决在 resolve.js）。

import { DUNGEON_NODE_TYPE } from "../../data/dungeon/catalog.js";
import { pickDungeonAdventurer } from "../../data/dungeon/adventurers.js";
import { random } from "../../../utils/rng.js";

export function buildAdventurerNode(keyPrefix, metAdventurers = [], lootMoney = 0) {
  const adv = pickDungeonAdventurer(metAdventurers);
  const scenario = lootMoney > 0 && (adv.stealBias >= 0.45 || random() < 0.45) ? "ambush" : "help";
  if (scenario === "ambush") {
    return {
      type: DUNGEON_NODE_TYPE.ADVENTURER,
      nodeId: `${keyPrefix}_${adv.id}`,
      title: `狭路相逢 · ${adv.name}`,
      desc: `${adv.name}（${adv.title} · ${adv.archetypeLabel}）斜倚在石柱旁目光落向你腰间行囊：「这地宫里的货，见者有份吧？」`,
      scenario,
      adventurer: adv,
      choices: [
        { id: "adv_fight", kind: "adv_fight", label: "拔刀护宝，与他切磋论高下（迎战）" },
        { id: "adv_outwit", kind: "adv_outwit", label: "虚晃一招凭智谋甩开（检定避战）", stat: "智谋", dc: 5 },
        { id: "adv_yield", kind: "adv_yield", label: "破财消灾，舍出几两银子脱身（不管）" },
      ],
    };
  }
  return {
    type: DUNGEON_NODE_TYPE.ADVENTURER,
    nodeId: `${keyPrefix}_${adv.id}`,
    title: `江湖奇遇 · ${adv.name}`,
    desc: `${adv.name}（${adv.title} · ${adv.archetypeLabel}）正被一道半开的石门卡住身形：「道友来的巧，搭把手一块破开这机关？」`,
    scenario,
    adventurer: adv,
    choices: [
      { id: "adv_help", kind: "adv_help", label: "出手相助共破机关（可帮 · 需慎防贪心反水）", stat: "身法", dc: 5 },
      { id: "adv_ignore", kind: "adv_ignore", label: "冷眼旁观，绕道离开（不管）" },
      { id: "adv_rob", kind: "adv_rob", label: "趁火打劫，亮兵刃开抢（必战）" },
    ],
  };
}

export function snatchPlayerLoot(loot, ratio = 0.35, minMoney = 8) {
  const curMoney = loot.money || 0;
  const stolenMoney = curMoney > 0 ? Math.min(curMoney, Math.max(minMoney, Math.floor(curMoney * ratio))) : 0;
  const items = [...(loot.items || [])];
  const stolenItems = [];
  if (items.length > 0 && (stolenMoney === 0 || random() < 0.5)) {
    stolenItems.push(items.pop());
  }
  return {
    nextLoot: { ...loot, money: curMoney - stolenMoney, items },
    stolenMoney,
    stolenItems,
  };
}

export function buildRobberyConfrontation(adv, node, stolenMoney, stolenItems, reason) {
  const parts = [];
  if (stolenMoney > 0) parts.push(`${stolenMoney}两银子`);
  if (stolenItems.length > 0) parts.push(stolenItems.join("、"));
  const stolenText = parts.length ? parts.join("与") : "行囊边角几文碎钱";
  return {
    node: {
      ...node,
      title: `反水夺宝 · ${adv.name}`,
      desc: `${reason} ${adv.name}顺手抢走${stolenText}转身便遁！`,
      stolenFromPlayer: { money: stolenMoney, items: stolenItems },
      choices: [
        { id: "adv_pursue", kind: "adv_pursue", label: "拔刀追击，夺回被抢财物（迎战）" },
        { id: "adv_let_go", kind: "adv_let_go", label: "算了，吃一堑长一智放他走" },
      ],
    },
    logLine: `${adv.name}反水抢走了${stolenText}！`,
  };
}

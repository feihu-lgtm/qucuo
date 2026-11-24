// 随身交易（docs/设定_OC冒险者_改名随从武学商店.md 随身段）：对 OC 冒险者身上的
// carry 列表做买卖——三分区「身上装备 / 行囊 / 挂载伙伴」在 domain/rules/npc/npcCarry.js。
// 挂载伙伴（mount，铁伯这类）只展示永不卖；sellable=false 的装备/信物给多少钱都不卖，
// 面板置灰「舍不得」。成交把条目从 npc.carry 划走（sold 标记），钱进玩家包。
// 换装同步链（E 单）：装备类条目成交→外观即时重算（deriveAppearance 读 sold 标记）
// + 日志「脱下了/换上了」+ 装备扒空时 look/prompt 多插「衣不蔽体」段。
import { attireExposure, carryTradeEntries } from "../../domain/rules/npc/npcCarry.js";
import { ITEM_CATEGORY } from "../../domain/rules/economy/equipment.js";

const GEAR = new Set([ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]);

// 购买一件随身条目：扣玩家钱、入玩家包、npc.carry 该条标 sold、装备类写换装日志。
// 返回 {changes:{char,inv,room}, logs} 喂 applyResult。
export function buyCarryEntry(state, npc, entry) {
  const price = entry.price ?? 0;
  if (entry.sellable === false) {
    return { logs: [{ t: "sys", text: `  ${npc.name}把「${entry.name}」往怀里一拢，摇了摇头——这东西他舍不得卖。` }] };
  }
  if (entry.slot === "mount") {
    return { logs: [{ t: "sys", text: `  ${entry.name}跟着${npc.name}出生入死，不卖。` }] };
  }
  if ((state.char?.money ?? 0) < price) {
    return { logs: [{ t: "err", text: `  银两不够——「${entry.name}」要价 ${price} 两。` }] };
  }
  const isGear = entry.slot === "equipment" && GEAR.has(entry.category);
  const newItem = {
    id: `carry_${npc.name}_${entry.name}_${Date.now()}`,
    name: entry.name, category: entry.category, quality: entry.quality,
    desc: entry.desc || "", equipped: false, sellPrice: Math.floor(price / 2),
  };
  const logs = [
    { t: "item", text: `  你花 ${price} 两从${npc.name}手上买下「${entry.name}」。` },
    ...(isGear ? [{ t: "sys", text: `  ${npc.name}脱下了${entry.name}，换到你手上。` }] : []),
  ];
  return {
    changes: {
      char: (prev) => ({ ...prev, money: (prev.money ?? 0) - price }),
      inv: (prev) => [...prev, newItem],
      // npc.carry 该条标 sold：再开面板不再出现，appearance 同步少一件
      room: (prev) => ({
        ...prev,
        npcs: (prev.npcs || []).map((n) => (n.name === npc.name
          ? {
              ...n,
              carry: (n.carry || []).map((c) => (c.name === entry.name ? { ...c, sold: true } : c)),
              carriedItems: (n.carriedItems || []).map((c) => (c.name === entry.name ? { ...c, sold: true } : c)),
            }
          : n)),
      }),
    },
    logs,
  };
}

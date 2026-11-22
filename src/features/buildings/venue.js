// 场所消费：点单上菜 / 下厨做饭 / 佛前祈祷。
// 从 logic.js 按动作分组拆出——这组是"在建筑里消费一项服务"。
import { random } from "../../utils/rng.js";
import { effectiveMaxHp } from "../../domain/data/kungfu/qucuoKungfu.js";
import { makeBuffFlag } from "../../utils/buffSystem.js";
import { INGREDIENT_LORE } from "../../domain/rules/economy/cooking.js";
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";
import { grantFactionRep } from "../../domain/rules/economy/factionRep.js";
import { add, applyWrite } from "../../domain/rules/state/applyWrite.js";

// 烹饪分赠（合稿「丐帮·七、7.1」加分行为 4）：在破庙大灶亲手烹饪分赠流民、
// 请严九斤品鉴，丐帮三星分舵 +4，严九斤/白婶好感微增。菜不分出去自己吃就无此收益。
export const SHARE_KITCHENS = {
  kitchen_gaibang_zhoupeng: {
    faction: "丐帮三星分舵", rep: 4,
    favors: { 严九斤: 2, 白婶: 2 },
    log: "你把出锅的菜分去粥棚外的流民堆里，又盛了一碗请严九斤尝，老头子难得笑了声。",
  },
};

export function shareKitchenOf(buildingId) { return SHARE_KITCHENS[buildingId] || null; }

export function orderService(state, item, karmaChange = 0) {
  if (!item || !isPositiveAmount(item.price) || !Number.isFinite(karmaChange)) {
    return item ? invalidAmountResult() : noOpResult();
  }
  if ((state.char.money || 0) < item.price) return noOpResult();

  const changes = {
    char: { ...state.char, money: (state.char.money || 0) - item.price },
    flags: [...(state.flags || []), makeBuffFlag(item.buff, item.val, state.time, item.duration)],
  };
  if (karmaChange !== 0) {
    changes.dao = { ...(state.dao || {}), karma: ((state.dao || {}).karma || 0) + karmaChange };
  }
  return {
    changes,
    settle: `点了${item.name}，花费${item.price}两`,
  };
}

export function cookMeal(state, { materials, technique, cookware, freestyle, dish, buildingName, buildingId, share } = {}) {
  if (!dish || !Array.isArray(materials) || materials.length === 0) return noOpResult();
  const shareRule = share ? shareKitchenOf(buildingId) : null;

  const nextInventory = [...(state.inv || [])];
  for (const material of materials) {
    const index = nextInventory.findIndex((item) => (typeof item === "object" ? item?.name : item) === material);
    if (index >= 0) nextInventory.splice(index, 1);
  }

  const changes = { inv: nextInventory };
  if (shareRule) {
    changes.varTree = (prev) => {
      let next = grantFactionRep(prev, { [shareRule.faction]: shareRule.rep }).varTree;
      for (const [npcName, favor] of Object.entries(shareRule.favors || {})) {
        next = applyWrite({ varTree: next }, add(["角色", npcName, "好感度"], favor)).state.varTree;
      }
      return next;
    };
  } else if (dish.hpDelta > 0) {
    changes.char = {
      ...state.char,
      hp: [Math.min(state.char.hp[0] + dish.hpDelta, effectiveMaxHp(state.char.hp[1], state.skills)), state.char.hp[1]],
    };
  }
  const buffs = dish.buffs || [];
  if (buffs.length && !shareRule) {
    changes.flags = [
      ...(state.flags || []),
      ...buffs.map((buff) => makeBuffFlag(buff.attr, buff.val, state.time, buff.turns)),
    ];
  }

  const buffText = buffs.map((buff) => `${buff.attr}+${buff.val}（${buff.turns}回合）`).join("、");
  const logs = shareRule
    ? [
      { t: "stat", text: `  ${freestyle ? "妙手偶得" : `「${dish.name}」出锅`} · 没舍得吃，分了出去` },
      { t: "affection", text: `  ✦ ${shareRule.log}（${shareRule.faction}声誉 +${shareRule.rep}）` },
    ]
    : [{
      t: "stat",
      text: `  ${freestyle ? "妙手偶得" : `「${dish.name}」出锅`} · 气血回复 ${dish.hpDelta} 点${buffText ? ` · ${buffText}` : ""}`,
    }];
  const ingredients = materials.map((name) => (INGREDIENT_LORE[name] ? `${name}（${INGREDIENT_LORE[name]}）` : name)).join("、");
  const techniqueClause = technique ? `用「${technique.id}」法${technique.desc ? `（${technique.desc}）` : ""}` : "";
  const cookwareClause = cookware ? `使${cookware.name}${cookware.desc ? `（${cookware.desc}）` : ""}` : "";
  const place = buildingName || "灶房";
  const ending = shareRule ? "玩家把菜分给了灶外流民，又盛一碗请严九斤尝。" : "玩家随即趁热吃了。";
  const settle = freestyle
    ? `在${place}生火下厨。手边的料是：${ingredients}；${techniqueClause}，${cookwareClause}。这几样本无成法，全凭灶上灵机——请你给这道菜起个贴切的名字（不超过七字，要见料性、见手法），并就其色香味与来由写一两句说书人风味的白话古文小总结，收在具体动作或滋味上，禁冒号破折号。${ending}`
    : `在${place}生火下厨。手边的料是：${ingredients}；${techniqueClause}，${cookwareClause}。这一番炮制，做出一道「${dish.name}」。请就这道菜的色香味与来由写一两句说书人风味的白话古文小总结，收在具体动作或滋味上，禁冒号破折号。${ending}`;
  const settleFact = `在${place}用${materials.join("、")}下厨，${freestyle ? "妙手偶得一道菜" : `做出一道「${dish.name}」`}，${shareRule ? "分赠给了流民与严九斤" : "趁热吃了"}`;
  return { changes, logs, settle, settleOptions: { settleFact } };
}

const SEVEN_DIMS = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];

export function pray(state, karmaPerPray = 10) {
  if (!isPositiveAmount(karmaPerPray)) return invalidAmountResult();
  if ((state.dao?.karma || 0) < karmaPerPray) return noOpResult();
  const available = SEVEN_DIMS.filter((dimension) => (state.char.special?.[dimension] ?? 0) < 10);
  if (!available.length) return noOpResult();

  const attr = available[Math.floor(random() * available.length)];
  return {
    changes: {
      dao: { ...state.dao, karma: state.dao.karma - karmaPerPray },
      char: {
        ...state.char,
        special: {
          ...state.char.special,
          [attr]: Math.min(10, (state.char.special?.[attr] ?? 0) + 1),
        },
      },
    },
    settle: `在佛前虔诚跪拜，消耗${karmaPerPray}功德，${attr}提升了1点`,
  };
}

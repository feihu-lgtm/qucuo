import { random } from "../../core/rng.js";
import { ITEM_CATEGORY, makeItem } from "../../domain/economy/equipment.js";
import { effectiveMaxHp, makeSkillEntry } from "../../domain/kungfu/qucuoKungfu.js";
import { makeItemSmart } from "../../domain/items/catalog.js";
import { getMapNode } from "../../domain/map/qucuoMap.js";
import { makeBuffFlag } from "../../utils/buffSystem.js";
import { INGREDIENT_LORE } from "../../domain/economy/cooking.js";

const TRANSPORT_PRICES = {
  鱼定村: 5, 鱼定土司: 5, 喇嘛庙: 5, 白塔: 8, 后山平台: 8, 玉泉寨: 5, 大草甸: 5, 贡措海: 8,
  天都镇: 5, 锦官城: 15, 雪山派: 12,
};

const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });
const noOpResult = () => ({ logs: [] });
const isPositiveAmount = (amount) => Number.isFinite(amount) && amount > 0;
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export const getPriceForDest = (dest) => TRANSPORT_PRICES[dest] || 10;

export function restAtInn(state, { cost, roomType, buildingName }) {
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();

  return {
    changes: {
      char: {
        ...state.char,
        money: state.char.money - cost,
        hp: [effectiveMaxHp(state.char.hp[1], state.skills), state.char.hp[1]],
      },
      time: state.time + 23,
    },
    logs: [{ t: "stat", text: "  气血回满 · 安睡一日" }],
    settle: `在${buildingName}住下${roomType}，花费${cost}两`,
  };
}

export function healAtHospital(state, { cost, healAmt, buildingName }) {
  if (!isPositiveAmount(cost) || !isPositiveAmount(healAmt)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();

  return {
    changes: {
      char: {
        ...state.char,
        money: state.char.money - cost,
        hp: [Math.min(state.char.hp[0] + healAmt, effectiveMaxHp(state.char.hp[1], state.skills)), state.char.hp[1]],
      },
    },
    logs: [],
    settle: `在${buildingName}求医问药，花费${cost}两，恢复了${healAmt}点气血`,
  };
}

export function buySkill(state, catalogItem) {
  if (!catalogItem?.id || (state.skills || []).some((skill) => skill.id === catalogItem.id)) return noOpResult();

  if (catalogItem.insight) {
    const current = state.char?.[catalogItem.insight.stat] ?? 0;
    if (current < catalogItem.insight.threshold) return noOpResult();
  } else {
    if (!Number.isFinite(catalogItem.price) || catalogItem.price < 0) return invalidAmountResult();
    if ((state.char.money || 0) < catalogItem.price) return noOpResult();
  }

  const changes = {
    skills: [...(state.skills || []), makeSkillEntry(catalogItem)],
  };
  if (!catalogItem.insight) {
    changes.char = { ...state.char, money: (state.char.money || 0) - catalogItem.price };
  }

  return {
    changes,
    settle: catalogItem.insight
      ? `在墓壁前站了许久，那些剑痕忽然连成了路数——参悟「${catalogItem.name}」`
      : `购得秘籍「${catalogItem.name}」，费银${catalogItem.price}两，习得此功`,
  };
}

export function gamble(state, { mode, bet, luck, dayIdx, maxBet = 200 } = {}, now = Date.now()) {
  if (!isPositiveAmount(bet)) return invalidAmountResult();
  if (mode !== "money" && mode !== "item") return noOpResult();
  const day = dayIdx ?? Math.floor(state.time / 24);
  const currentLuck = Number.isFinite(luck) ? luck : (state.char.special?.气运 ?? 5);
  if (!Number.isInteger(day) || !isPositiveAmount(maxBet)) return noOpResult();
  if (mode === "money" && bet > maxBet) return invalidAmountResult();
  if ((state.flags || []).includes(`gambled_day_${day}`)) return noOpResult();
  if ((state.char.money || 0) < bet) return noOpResult();

  let narrateLine;
  const changes = {
    flags: [`gambled_day_${day}`, ...(state.flags || []).filter((flag) => !flag.startsWith("gambled_day_"))],
  };

  if (mode === "item") {
    const qualities = ["白", "绿", "蓝", "紫", "橙"];
    const quality = qualities[Math.min(qualities.length - 1, Math.floor(currentLuck / 2.5))];
    const categories = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
    const category = categories[Math.floor(random() * categories.length)];
    const names = {
      [ITEM_CATEGORY.WEAPON]: ["彩头刀", "幸运剑", "财神棍"],
      [ITEM_CATEGORY.ARMOR]: ["福气甲", "招财护臂", "吉祥软甲"],
      [ITEM_CATEGORY.ACCESSORY]: ["运气链", "财运玉佩", "好运吊坠"],
    };
    const name = names[category][Math.floor(random() * 3)];
    const item = makeGameItem({ name, category, quality });
    changes.char = { ...state.char, money: (state.char.money || 0) - bet };
    changes.inv = [...(state.inv || []), { ...item, id: `gamble_${now}`, equipped: false }];
    narrateLine = `在赌坊押了${bet}两玩物品抽奖，抽中了「${name}」（${quality}）`;
  } else {
    const roll = random() * 100;
    const loseChance = 60 - 30 * (currentLuck / 10);
    const tieChance = 30;
    let result;
    if (roll < loseChance) {
      result = "赔";
      changes.char = { ...state.char, money: (state.char.money || 0) - bet };
    } else if (roll < loseChance + tieChance) {
      result = "平";
    } else {
      result = "赢";
      changes.char = { ...state.char, money: (state.char.money || 0) + bet };
    }
    const text = { 赔: `亏了${bet}两`, 平: "保本", 赢: `赢了${bet}两` }[result];
    narrateLine = `在赌坊押注${bet}两，骰子一落，${text}`;
  }

  return { changes, logs: [], settle: narrateLine };
}

export function travelByCarriage(state, dest, price, { roomMap } = {}) {
  if (!isPositiveAmount(price)) return invalidAmountResult();
  const destNode = getMapNode(dest);
  if (!destNode || !state.mapData?.[dest]) return noOpResult();
  if ((state.char.money || 0) < price) return noOpResult();

  const cached = roomMap?.[dest];
  const changes = {
    char: { ...state.char, money: (state.char.money || 0) - price },
    room: {
      name: dest,
      desc: destNode.desc,
      exits: Object.keys(destNode.exits),
      npcs: [...(cached?.npcs || [])],
      items: [...(cached?.items || [])],
    },
    time: state.time + 5,
  };
  return {
    changes,
    logs: [
      { t: "room", text: "" },
      { t: "room", text: `    ${dest}（马车）` },
      { t: "room", text: "" },
      { t: "sys", text: `  你乘马车前往${dest}，花费${price}两，平安抵达。` },
    ],
  };
}

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

export function cookMeal(state, { materials, technique, cookware, freestyle, dish, buildingName } = {}) {
  if (!dish || !Array.isArray(materials) || materials.length === 0) return noOpResult();

  const nextInventory = [...(state.inv || [])];
  for (const material of materials) {
    const index = nextInventory.findIndex((item) => (typeof item === "object" ? item?.name : item) === material);
    if (index >= 0) nextInventory.splice(index, 1);
  }

  const changes = { inv: nextInventory };
  if (dish.hpDelta > 0) {
    changes.char = {
      ...state.char,
      hp: [Math.min(state.char.hp[0] + dish.hpDelta, effectiveMaxHp(state.char.hp[1], state.skills)), state.char.hp[1]],
    };
  }
  const buffs = dish.buffs || [];
  if (buffs.length) {
    changes.flags = [
      ...(state.flags || []),
      ...buffs.map((buff) => makeBuffFlag(buff.attr, buff.val, state.time, buff.turns)),
    ];
  }

  const buffText = buffs.map((buff) => `${buff.attr}+${buff.val}（${buff.turns}回合）`).join("、");
  const logs = [{
    t: "stat",
    text: `  ${freestyle ? "妙手偶得" : `「${dish.name}」出锅`} · 气血回复 ${dish.hpDelta} 点${buffText ? ` · ${buffText}` : ""}`,
  }];
  const ingredients = materials.map((name) => (INGREDIENT_LORE[name] ? `${name}（${INGREDIENT_LORE[name]}）` : name)).join("、");
  const techniqueClause = technique ? `用「${technique.id}」法${technique.desc ? `（${technique.desc}）` : ""}` : "";
  const cookwareClause = cookware ? `使${cookware.name}${cookware.desc ? `（${cookware.desc}）` : ""}` : "";
  const place = buildingName || "灶房";
  const settle = freestyle
    ? `在${place}生火下厨。手边的料是：${ingredients}；${techniqueClause}，${cookwareClause}。这几样本无成法，全凭灶上灵机——请你给这道菜起个贴切的名字（不超过七字，要见料性、见手法），并就其色香味与来由写一两句说书人风味的白话古文小总结，收在具体动作或滋味上，禁冒号破折号。玩家随即趁热吃了。`
    : `在${place}生火下厨。手边的料是：${ingredients}；${techniqueClause}，${cookwareClause}。这一番炮制，做出一道「${dish.name}」。请就这道菜的色香味与来由写一两句说书人风味的白话古文小总结，收在具体动作或滋味上，禁冒号破折号。玩家随即趁热吃了。`;
  return { changes, logs, settle };
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

export function readBook(_state, book) {
  if (!book?.name || !book?.topic) return noOpResult();
  return { settle: `翻开「${book.name}」细细阅读，对${book.topic}有了更多了解` };
}

export function buyBook(state, book) {
  if (!book?.name || !book.skillEntry) return noOpResult();
  if (!isPositiveAmount(book.price)) return invalidAmountResult();
  if ((state.skills || []).some((skill) => skill.id === book.skillEntry.id)) return noOpResult();
  if ((state.char.money || 0) < book.price) return noOpResult();

  return {
    changes: {
      char: { ...state.char, money: (state.char.money || 0) - book.price },
      skills: [...(state.skills || []), { ...book.skillEntry }],
    },
    settle: `购得「${book.name}」，花费${book.price}两，习得${book.skillEntry.name}`,
  };
}

export function listenToRumor(state, rumor, cost) {
  if (!rumor) return noOpResult();
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();
  return {
    changes: {
      char: (previous) => ({ ...previous, money: (previous.money || 0) - cost }),
    },
    settle: `在茶馆花${cost}两，听掌柜低声说了个传闻：「${rumor}」`,
  };
}

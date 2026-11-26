import { WEAPONS, ARMORS, ACCESSORIES, SUNDRIES, STANDARD_WEAPONS, STANDARD_ARMORS, STANDARD_ACCESSORIES, LEGENDARY, CATALOG, CATALOG_INDEX, makeCatalogItem } from "./catalog.js";
import { ITEM_CATEGORY, statsForQuality, priceForQuality } from "../../rules/economy/equipment.js";

export function filterCatalog({ category, quality, tag, tier } = {}) {
  return CATALOG.filter(e =>
    (!category || e.category === category) &&
    (!quality || e.quality === quality) &&
    (!tag || (e.tags || []).includes(tag)) &&
    (!tier || (tier === "standard" ? e.standardIssue : tier === "named" ? !e.standardIssue : true))
  );
}

// ============================================================================
// 给 AI 看的参考文本 —— "这世界有哪些叫得出名字的物件"
// ============================================================================
// 原则：只给 AI 名字/品级/一句话来历，不给具体数值——数值永远由本表+公式裁决，
// AI 只能在叙事里自然引用/描述这些物件（"墙上挂着一柄雪山松纹剑"），不能篡改属性。
// 输出压缩成紧凑文本，控制 token 占用。
export function describeCatalogForAI({ categories } = {}) {
  const CAT_NAME = { weapon: "兵器", armor: "衣甲", accessory: "饰品", misc: "杂货" };
  const named = { weapon: WEAPONS, armor: ARMORS, accessory: ACCESSORIES, misc: SUNDRIES };
  const std = { weapon: STANDARD_WEAPONS, armor: STANDARD_ARMORS, accessory: STANDARD_ACCESSORIES };
  // LEGENDARY 按 category 归入具名层各类
  const legendaryByCat = { weapon: [], armor: [], accessory: [], misc: [] };
  for (const e of LEGENDARY) legendaryByCat[e.category]?.push(e);
  const keys = categories || Object.keys(named);
  const namedLines = [];
  for (const k of keys) {
    const all = [...(named[k] || []), ...(legendaryByCat[k] || [])];
    if (!all.length) continue;
    namedLines.push(`【${CAT_NAME[k]}】` + all.map(e => `${e.name}(${e.quality})`).join("、"));
  }
  const stdLines = [];
  for (const k of ["weapon", "armor", "accessory"]) {
    if (categories && !categories.includes(k)) continue;
    if (!std[k]?.length) continue;
    stdLines.push(`【${CAT_NAME[k]}】` + std[k].map(e => `${e.name}(${e.quality})`).join("、"));
  }
  return [
    "曲措乡的物件分两层，叙事时可自然引用其名与来历，但不得虚构其数值属性，",
    "也不得凭空创造未列出的“神兵/秘宝”——具名宝物仅限下列，其余皆寻常之物：",
    "",
    "一、有名有姓、独一份、带来历的宝物（罕见，多与人物/剧情绑定，遇之应郑重）：",
    ...namedLines,
    "",
    "二、成批量产的制式通货（常见，江湖上、店铺里、差役身上到处都是，叙事中",
    "可随口带出，不必渲染稀奇）：",
    ...stdLines,
  ].join("\n");
}


// ── 消耗品·探索态服用（消耗品系统第2步）──
// useConsumable：纯函数，输入一件消耗品的 consumable 字段 + 当前角色状态快照，
// 计算"在探索态（非战斗）服用"会产生的即时效果，返回结构化指令交给 MudRPG 应用。
// 严格遵循"AI 提议内容、系统裁决数值"——所有数值在这里算死，AI 不参与。
//
// 探索态与战斗态的能力边界（重要）：
//   · hpRestore（比例回血）——探索态主力效果，按角色最大气血比例回血、夹在上限内。
//   · energyRestore（回气/真气）——真气是纯战斗内概念（每场重置的 [10,10]），
//     探索态没有对应的持久字段，故不在探索态生效，提示玩家"此丹药需在切磋中服用"。
//   · dispel / rebirthOnce——解异常、假死保命同样是战斗内机制（异常状态存在战斗的
//     statusSlots 里、假死是血将尽时救命），探索态无从施展，同样引导去战斗中用。
//   · sixDimTemp / hpRestoreOverTime / combatBuff 等 B 档 buff——第 3 步接 buffSystem
//     时再处理，本函数暂不负责，遇到时按"尚未支持"返回 ok:false 提示。
//
// 返回：{ ok, hpDelta, note, reason }
//   ok=true  时 hpDelta 为应加到 char.hp[0] 的增量（已按上限夹好上界，负溢出不会发生），
//            note 是给玩家看的服用反馈文字；
//   ok=false 时 reason 说明为何这件东西在探索态吃不出效果（战斗类/未支持/非消耗品）。
export function useConsumable(consumable, char) {
  const c = consumable || {};
  if (!c || Object.keys(c).length === 0) {
    return { ok: false, reason: "这不是能服用的东西。" };
  }

  // 能力分类：
  //   即时回血 hpRestore —— 探索态主力，直接回血。
  //   B档增益 —— 临时六维 sixDimTemp（挂 time 计时的 buff flag）、战前餐 combatBuff
  //     （存 pendingCombatBuff）、持续回血 hpRestoreOverTime（探索态降级为即时回一笔）。
  //   纯战斗内 battleOnly —— 回气/解异常/假死，探索态引导去战斗中用。
  const battleOnly = c.energyRestore || c.dispel || c.dispelAll || c.rebirthOnce;

  // 收集本次服用产生的所有效果（一件药可同时带多种，如"回血+临时体魄"）。
  let hpDelta = 0;
  const sixDimBuffs = [];   // [{ attr, val, duration }]，交给 MudRPG 用 makeBuffFlag 写 flag
  let combatBuff = null;    // 战前餐，交给 MudRPG 累加进 char.pendingCombatBuff
  const noteBits = [];

  // ① 即时回血
  if (c.hpRestore) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * c.hpRestore);
    const room = maxHp - curHp;
    const actual = Math.min(room, heal);
    if (actual > 0) { hpDelta += actual; noteBits.push(`气血回复 ${actual} 点`); }
  }

  // ② 持续回血 hpRestoreOverTime——探索态没有逐回合结算机制，降级为即时回一笔
  //    （总量 = 每回合比例 × 回合数），战斗内道具栏本就不列它。
  if (c.hpRestoreOverTime) {
    const ov = c.hpRestoreOverTime;
    const ratio = typeof ov === "number" ? ov : (ov.ratio || 0);
    const turns = typeof ov === "object" ? (ov.turns || 1) : 1;
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const heal = Math.round(maxHp * ratio * turns);
    const room = maxHp - curHp - hpDelta;
    const actual = Math.max(0, Math.min(room, heal));
    if (actual > 0) { hpDelta += actual; noteBits.push(`药力绵长，气血又回 ${actual} 点`); }
  }

  // ③ 临时六维 sixDimTemp: { 属性: 增量 }，默认持续 30 个时辰单位（约合十余回合）
  if (c.sixDimTemp && typeof c.sixDimTemp === "object") {
    const duration = c.buffDuration || 30;
    for (const [attr, val] of Object.entries(c.sixDimTemp)) {
      if (val > 0) { sixDimBuffs.push({ attr, val, duration }); noteBits.push(`${attr}暂增 ${val}`); }
    }
  }

  // ④ 战前餐 combatBuff（作用于下一场战斗）
  if (c.combatBuff && typeof c.combatBuff === "object") {
    combatBuff = { ...c.combatBuff };
    noteBits.push(c.combatBuffNote || "一餐入腹，只待临阵，气力自不同往日");
  }

  // ── C 档降级（消耗品系统第4步：砍/降级重机制，不为个别药新增系统）──
  // ⑤ 跳回合回满 skipTurnsHeal / fullHeal：原设计"跳过N回合、睡一觉回满血"需要一套
  //    时间跳跃机制，砍掉，简化为"即时回满血"（探索态最实用、也最省事）。
  if (c.skipTurnsHeal || c.fullHeal) {
    const maxHp = char?.hp?.[1] ?? 100;
    const curHp = char?.hp?.[0] ?? maxHp;
    const room = maxHp - curHp - hpDelta;
    if (room > 0) { hpDelta += room; noteBits.push("沉沉睡去，再睁眼时气血已复如初"); }
  }
  // ⑥ 全队 buff teamBuff：玩家没有队友系统，降级为"只作用于自己"。teamBuff 里若是
  //    六维增量，按临时六维处理；若是回血比例，并进即时回血。
  if (c.teamBuff && typeof c.teamBuff === "object") {
    const duration = c.buffDuration || 30;
    if (typeof c.teamBuff.hpRestore === "number") {
      const maxHp = char?.hp?.[1] ?? 100;
      const curHp = char?.hp?.[0] ?? maxHp;
      const heal = Math.round(maxHp * c.teamBuff.hpRestore);
      const room = maxHp - curHp - hpDelta;
      const actual = Math.max(0, Math.min(room, heal));
      if (actual > 0) { hpDelta += actual; noteBits.push(`众人本欲同飨，然形单影只，独得气血 ${actual} 点`); }
    }
    for (const [attr, val] of Object.entries(c.teamBuff)) {
      if (attr !== "hpRestore" && typeof val === "number" && val > 0) {
        sixDimBuffs.push({ attr, val, duration });
        noteBits.push(`${attr}暂增 ${val}`);
      }
    }
  }
  // ⑦ 涂抹武器 weaponCoat（毒蝎粉/雪盲药水，原为"下一击附加中毒/目盲"）：这是全新的
  //    "给招式挂临时异常"重机制，砍掉不做。第5步录 catalog 时这类物件应改用 hpRestore
  //    等已支持字段录入；万一仍带了 weaponCoat 字段，这里静默忽略、不报错、不产生效果。
  //    （不在这里给兜底回血——避免"砍了却又偷偷补一个效果"的语义混乱。）

  const producedSomething = hpDelta > 0 || sixDimBuffs.length > 0 || combatBuff;
  if (producedSomething) {
    const extra = battleOnly ? "（另有回气/解毒之效，须在切磋中服用方见）" : "";
    return {
      ok: true,
      hpDelta,
      sixDimBuffs,
      combatBuff,
      note: `服下之后，${noteBits.join("，")}。${extra}`,
    };
  }

  // 没产生任何探索态效果：要么纯战斗内、要么血已满
  if (c.hpRestore && hpDelta === 0) {
    return { ok: false, reason: "气血本已充盈，此时服用未免暴殄，且留着日后急用。" };
  }
  if (battleOnly) {
    return { ok: false, reason: "此丹药回气解毒、救命于须臾，须在切磋交手之际服用方能立竿见影。" };
  }
  return { ok: false, reason: "这东西一时看不出该怎么用。" };
}
// F1 真机验收修：consumable 判定单一来源——实例 consumable → 未盾图鉴药效 →
// category "food" 默认可食（hpRestore 0.08 与广汉干粮/官造青稞干粮/烹饪同基准）。
// 此前散落四处的二源判定漏了 food 类：catalog 里 food 物件多不写字段（青稞炒面），
// 裸「干粮」连图鉴条目都没有——吃干粮走出示旁路零消耗，判官却照叙事签回血。
// noCatalog 盾只挡图鉴名撞车，不挡 food 类固有声（食物可食是品类语义不是图鉴神力）。
export function consumableOfItem(item) {
  if (!item || typeof item !== "object") return null;
  if (item.consumable) return item.consumable;
  if (!item.noCatalog && item.name && CATALOG_INDEX[item.name]?.consumable) {
    return CATALOG_INDEX[item.name].consumable;
  }
  if (item.category === "food") return { hpRestore: 0.08 };
  return null;
}

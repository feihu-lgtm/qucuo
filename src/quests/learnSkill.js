// 拜师学艺（QT_LEARN_SKILL）
// 单一门槛：好感度达标即可学。原本的"双重门槛"（好感度 + 完成专属拜师任务）
// 已按需求简化——任务门槛去掉，只保留好感度≥40 这一个条件。原因：拜师任务
// 只有老猎户1人配了内容（NPC_TEACHABLE_SKILLS 就一条），其余NPC根本没有对应
// 任务，双重门槛等于让绝大多数NPC永远无法教学；改成纯好感度后，每个NPC只要
// 交情够了就能把自己那套专属招式（见 npcSignatureMoves.js）传下来。
//
// 兼容性：canLearnSkillFrom 仍保留第三个参数（questFlags）不删，避免改动所有
// 调用点的函数签名；参数现在不参与判定，留着只为向后兼容。

export const LEARN_SKILL_MIN_FAVORABILITY = 40;

export function canLearnSkillFrom(npcName, varTree, _questFlags) {
  const favorability = varTree.角色?.[npcName]?.好感度 ?? 0;
  const favorabilityMet = favorability >= LEARN_SKILL_MIN_FAVORABILITY;

  return {
    eligible: favorabilityMet, // 只看好感度，不再 && questMet
    favorabilityMet,
    questMet: true, // 恒真：任务门槛已废除，保留字段避免上层读取时 undefined
    currentFavorability: favorability,
    requiredFavorability: LEARN_SKILL_MIN_FAVORABILITY,
  };
}

// 生成一段人类可读的说明文字，告诉玩家现在卡在哪个条件上——
// UI层直接用这段文字展示，不需要自己拼接判断逻辑。
export function describeLearnSkillGate(gate, npcName) {
  if (gate.eligible) return `${npcName}认可你的诚意与情谊，愿意将这身本事倾囊相授。`;
  // 现在唯一可能卡住的条件就是好感度
  return `${npcName}似乎还有所保留：交情尚浅（${gate.currentFavorability}/${gate.requiredFavorability}），还需再多些走动。`;
}

// ── 拜师好感折价曲线 ──────────────────────────────────────────
// 好感够格（≥40）之后，价格随好感继续走低：越熟悉，师父越不吝啬。
// 好感100（满好感）直接免费，算是"名副其实的自己人"。
// 这条曲线同时适用于「拜高手为师学专属招」和「拜平民为师学通用招」，
// 只是两者的"基础价"不同（专属招基础价高，通用招基础价低，见 learnSkill.js）。
export const TEACH_DISCOUNT_TIERS = [
  { min: 100, factor: 0 },     // 好感拉满：免费
  { min: 80, factor: 0.5 },    // 80-99：五折
  { min: 60, factor: 0.7 },    // 60-79：七折
  { min: 40, factor: 1.0 },    // 40-59：原价
];

// 按好感度返回折扣系数（0~1，0=免费，1=原价）。好感<40 时理论上不会调用到
// 这个函数（门槛没过），但仍兜底返回1.0（原价），不返回负数或异常值。
export function teachDiscountFactor(favorability) {
  const fav = favorability ?? 0;
  for (const tier of TEACH_DISCOUNT_TIERS) {
    if (fav >= tier.min) return tier.factor;
  }
  return 1.0;
}

// 计算某基础价在给定好感度下的实际拜师价格，向下取整到整数银两。
export function teachPrice(basePrice, favorability) {
  return Math.floor((basePrice ?? 0) * teachDiscountFactor(favorability));
}

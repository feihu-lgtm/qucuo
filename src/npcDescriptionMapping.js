// 身份/性格描述 -> 数值参数 映射规则
// AI 只负责给"这个人是干什么的、性格如何"这类定性描述，这个模块本地用
// 关键词匹配把描述映射成具体数值（levelCap/性格权重），不让AI直接吐出数值——
// 跟 npcGeneration.js 里"不让AI自由编技能池数值"是同一个理由：AI对
// "这个数字该多大"没有稳定校准，规则化映射才能保证同类描述总是得到类似强度。

// 身份关键词 -> levelCap（决定这个人技能/属性的整体强度上限）
const IDENTITY_LEVEL_MAP = [
  { keywords: ["学徒", "杂役", "小厮", "村民", "百姓", "农夫", "商贩"], levelCap: 0 },
  { keywords: ["猎户", "工匠", "镖师", "护卫", "巡逻"], levelCap: 2 },
  { keywords: ["武师", "教头", "掌柜", "游侠"], levelCap: 3 },
  { keywords: ["高手", "宗师", "长老", "堂主"], levelCap: 4 },
  { keywords: ["神僧", "宗主", "国师", "护法", "宝树王"], levelCap: 5 },
];

// 性格关键词 -> 招式类型权重倾向
const PERSONALITY_WEIGHT_MAP = [
  { keywords: ["好战", "冲动", "豪爽", "莽撞", "暴躁"], weights: { 攻击: 0.55, 防御: 0.25, 状态: 0.2 }, riskAppetite: 0.65 },
  { keywords: ["谨慎", "沉稳", "老成", "持重", "憨厚"], weights: { 攻击: 0.25, 防御: 0.5, 状态: 0.25 }, riskAppetite: 0.25 },
  { keywords: ["狡诈", "善算", "阴险", "机敏", "多疑"], weights: { 攻击: 0.25, 防御: 0.25, 状态: 0.5 }, riskAppetite: 0.6 },
];

const DEFAULT_LEVEL_CAP = 1;
const DEFAULT_WEIGHTS = { moveWeights: { 攻击: 0.4, 防御: 0.35, 状态: 0.25 }, riskAppetite: 0.4 };

function matchLevelCap(description) {
  for (const entry of IDENTITY_LEVEL_MAP) {
    if (entry.keywords.some(kw => description.includes(kw))) return entry.levelCap;
  }
  return DEFAULT_LEVEL_CAP;
}

function matchPersonality(description) {
  for (const entry of PERSONALITY_WEIGHT_MAP) {
    if (entry.keywords.some(kw => description.includes(kw))) {
      return { moveWeights: entry.weights, riskAppetite: entry.riskAppetite, avoidRepeat: 0.4 };
    }
  }
  return { ...DEFAULT_WEIGHTS, avoidRepeat: 0.4 };
}

// 综合入口：给一段AI提供的自然语言身份/性格描述，返回涌现这个NPC需要的
// 全部生成参数（levelCap + personalityProfile），交给 npcGeneration.js 用。
export function mapDescriptionToGenParams(description) {
  return {
    levelCap: matchLevelCap(description || ""),
    personalityProfile: matchPersonality(description || ""),
  };
}

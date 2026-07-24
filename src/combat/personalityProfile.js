// NPC 性格权重表
// 由 LLM 根据角色小传"低频"生成一次（角色第一次进入切磋时调用一次API），
// 结果缓存进 npc 对象本身，之后每一回合的具体选招都是纯本地加权随机，
// 不再调用任何API——保证战斗回合是瞬间响应的，不会因为等LLM而卡顿。

const DEFAULT_PROFILE = {
  moveWeights: { 攻击: 0.4, 防御: 0.35, 状态: 0.25 }, // 没有更细致人设时的中庸兜底权重
  riskAppetite: 0.4,   // 0-1，越高越倾向用高品质高风险技能赌一把
  avoidRepeat: 0.4,    // 0-1，越高越不容易连续两回合用同一类型
};

// 一次性生成的prompt，调用方（MudRPG.jsx）拿到角色简介文本后发起一次API调用，
// 解析返回的JSON得到性格权重表。这个函数只负责拼prompt，不负责发请求，
// 保持跟项目里其他"AI生成"逻辑一致的分工方式。
export function buildPersonalityPrompt(npcBrief) {
  return {
    sys: `你是曲措乡战斗性格分析师。根据角色的简介，为其设定切磋时的招式选择倾向。
只返回纯JSON，不要任何多余文字：
{"moveWeights":{"攻击":0.4,"防御":0.35,"状态":0.25},"riskAppetite":0.4,"avoidRepeat":0.4}
moveWeights三项加起来应约等于1。riskAppetite和avoidRepeat都是0-1之间的小数。
角色越好战/冲动，攻击权重和riskAppetite应越高；角色越谨慎/沉稳，防御权重应越高，avoidRepeat也应越高（不容易被看穿套路）；角色越狡诈/善用心机，状态权重应越高。`,
    user: `角色简介：${npcBrief}`,
  };
}

// 解析LLM返回的JSON文本，解析失败时安全回退到默认权重，不让一次解析失败
// 导致整个战斗系统崩掉——性格权重本质上是锦上添花，不该成为单点故障。
export function parsePersonalityResponse(rawText) {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return DEFAULT_PROFILE;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.moveWeights || !parsed.moveWeights.攻击 == null) return DEFAULT_PROFILE;
    return {
      moveWeights: {
        攻击: parsed.moveWeights.攻击 ?? DEFAULT_PROFILE.moveWeights.攻击,
        防御: parsed.moveWeights.防御 ?? DEFAULT_PROFILE.moveWeights.防御,
        状态: parsed.moveWeights.状态 ?? DEFAULT_PROFILE.moveWeights.状态,
      },
      riskAppetite: typeof parsed.riskAppetite === "number" ? Math.max(0, Math.min(1, parsed.riskAppetite)) : DEFAULT_PROFILE.riskAppetite,
      avoidRepeat: typeof parsed.avoidRepeat === "number" ? Math.max(0, Math.min(1, parsed.avoidRepeat)) : DEFAULT_PROFILE.avoidRepeat,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function getDefaultProfile() {
  return { ...DEFAULT_PROFILE };
}

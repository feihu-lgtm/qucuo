// WO-16E 因果授信输入装配：取代 runTurn/shadow 里 riskLevel:0 硬编码。
// buildCausalBudgetInput(state, intakeResult, opts) 纯函数——同一输入同一输出，
// runTurn 与 WO-16D 影子必须共用此入口，否则对账失真。
// 八参映射（computeCausalBudget 输入）：
//   tension         路遇紧张度——读 encounter 实际返回字段 factionKey
//                   （审计：domain/rules/map/encounter.js rollEncounter 返回
//                   { factionKey, faction, passer }，经 turnContext.encounter 透传），
//                   factionTensionProxy 取该势力在势力冲突表（动态覆盖+BASE，按 pair
//                   key 合并动态优先）里与任意势力的最强张力原值 0-100 直传。
//                   这是势力冲突烈度代理，不是玩家-势力关系账，待有玩家关系账再换源；
//                   无冲突记录/散人=0，不用人工兜底定档。
//   riskLevel       前哨 risk 字段（WO-16G 才加）优先：给了「中/高」取前哨值与规则值较大者；
//                   现在一律走规则兜底——按动作种类定档（偷/决斗 2、翻容器/取物/用物/装备 1、其余 0）。
//   costPaid        v1 保守口径：赠出/交易出去每件记 5，使用消耗品记 3，其余 0
//                   （流血等事后代价开庭前不可知，不虚构）。
//   targetAffection 社交动作目标 NPC 的当前好感最大值（varTree.角色.好感度）。
//   luck            char.special.气运（钳 0-10）。
//   questClimax     任务候选中含末阶段推进（stageIndex 为该任务最后一幕）。
//   gm              创造模式直通。
//   dailyLootUsed   varTree.世界.每日搜刮 { day, count }——跨日自动归零；
//                   只有天机券实际编译入袋的新品计数（materializeFacts 写账），
//                   预设物/备料物/悬空秘宝不占配额。账本不存在时按 0 读，不破坏旧档。
import { factionTensionProxy } from "../conflict/tension.js";

const ACTION_RISK = {
  steal: 2, duel: 2,
  inspect_container: 1, take: 1, use_item: 1, equip: 1,
};

// 前哨 risk 字段档位映射（WO-16G 预留接口）：低/中/高 → 1/2/3
const INTAKE_RISK = { 低: 1, 中: 2, 高: 3, low: 1, mid: 2, medium: 2, high: 3 };

const SOCIAL_KINDS = new Set(["talk", "give", "trade", "appease", "learn", "invite"]);

export function readDailyLootUsed(varTree, day) {
  const ledger = varTree?.世界?.每日搜刮;
  if (!ledger || typeof ledger !== "object") return 0; // 旧档无账本按 0，最小兼容不迁移写
  if (!Number.isInteger(ledger.day) || ledger.day !== day) return 0; // 跨日归零
  return Number.isFinite(ledger.count) ? ledger.count : 0;
}

export function buildCausalBudgetInput(state = {}, intakeResult = {}, opts = {}) {
  const actions = Array.isArray(intakeResult.actions) ? intakeResult.actions : [];
  const char = state.char || {};
  const varTree = state.varTree || {};

  // tension：路遇场景紧张度——factionTensionProxy 取该势力在势力冲突表
  // （动态覆盖+BASE_TENSION）里与任意势力的最强张力原值 0-100 直传
  // （computeCausalBudget 内部已 *0.5）。这是势力冲突烈度代理，不是玩家-势力
  // 关系账，待后续有玩家关系账再换源；无冲突记录/散人=0，不用人工兜底定档。
  const factionKey = state.encounter?.factionKey;
  const tension = factionKey
    ? factionTensionProxy(state.worldTension || varTree?.世界?.tension, factionKey)
    : 0;

  // riskLevel：规则兜底 + 前哨 risk 覆盖接口（取较大者）
  let ruleRisk = 0;
  for (const action of actions) {
    ruleRisk = Math.max(ruleRisk, ACTION_RISK[action?.kind] || 0);
  }
  const intakeRisk = INTAKE_RISK[intakeResult?.risk] || 0;
  const riskLevel = Math.max(ruleRisk, intakeRisk);

  // costPaid：给出物品/用消耗品是有形代价（v1 保守）
  let costPaid = 0;
  for (const action of actions) {
    if ((action?.kind === "give" || action?.kind === "trade") && action?.itemId) costPaid += 5;
    if (action?.kind === "use_item" && action?.itemId) costPaid += 3;
  }

  // targetAffection：社交目标当前好感最大值
  let targetAffection = 0;
  for (const action of actions) {
    if (!SOCIAL_KINDS.has(action?.kind) || !action?.target) continue;
    const aff = varTree?.角色?.[action.target]?.好感度;
    if (Number.isFinite(aff)) targetAffection = Math.max(targetAffection, aff);
  }

  // questClimax：玩家本回合实际在推进末阶段才算支线高潮——候选在场只是
  // 「可以推进」，不等于「正在推进」；否则普通搭话路过终幕地点也会抬额度。
  // 口径：proposals 里 quest_advance 的 questId+flag 命中末阶段候选。
  const candidates = Array.isArray(state.questCandidates) ? state.questCandidates : [];
  const finalKeys = new Set(
    candidates.filter((c) => c?.isFinalStage || c?.climax).map((c) => `${c.questId}::${c.flag}`),
  );
  const proposalsArr = Array.isArray(intakeResult.proposals) ? intakeResult.proposals : [];
  const questClimax = finalKeys.size > 0 && proposalsArr.some(
    (p) => p?.kind === "quest_advance" && finalKeys.has(`${p.questId}::${p.flag}`),
  );

  const turn = Number.isFinite(state.turn) ? state.turn : 0;
  const day = Number.isInteger(state.day) ? state.day : Math.floor(turn / 24) + 1;

  return {
    tension,
    riskLevel,
    costPaid,
    targetAffection,
    luck: Math.max(0, Math.min(10, Number.isFinite(char?.special?.气运) ? char.special.气运 : 0)),
    questClimax,
    gm: !!opts.gm,
    dailyLootUsed: readDailyLootUsed(varTree, day),
  };
}

// 金鸟金蛋开奖的异步一段：开场两行先落，奖品稍后补到。
// 有 API：goldenEgg.prize 让 AI 在系统掷定的品阶里自由随机一件实物（名字/类别/描述/朵朵反应），
// 回包裁剪后由 settleAiEggPrize 落成真物件入行囊。
// 没 API、AI 失败或回包不合规：退回加权奖池（settlePoolEggPrize），朵朵反应用手写兜底句。
// 存档纪元一变（读档/回滚）就整段作废，不往别的存档里塞东西。
import { gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { sessionUiStore } from "../../store/sessionUiStore.js";
import { eggFallbackLine, parseEggPrize, rollEggSpecial, EGG_SPECIAL_FAKE, INTIMATE_TICKET_NAME } from "../../domain/rules/npc/goldenEgg.js";
import { eggFact, eggSignInChange, settleAiEggPrize, settlePoolEggPrize } from "../../features/npc/goldenEgg.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import { hasApiKey } from "../../engine/ports/storyteller.js";
import "../calls/hookCalls.js";

const webAi = createWebAi();

// Review 修（签到账后移到奖品落账帧）后的连点防重领：lastDay 不再在 open 写入，
// 异步窗口内连点会重复开奖——改内存级 pending 闸。读档/回滚后 AI 续跑作废时必须清闸，
// 否则新档永远领不了。模块级即可：按钮流只在 web 单例。
let eggOpenPending = false;
export function eggPrizePending() {
  return eggOpenPending;
}
export function markEggPrizeOpen() {
  eggOpenPending = true;
}
function clearEggPrizeOpen() {
  eggOpenPending = false;
}

// 兜底：奖池开奖 + 手写反应句，两段一起落。
export function settleEggFromPool({ apply, getState = () => gameStore.getState(), rng = Math.random, state: capturedState }) {
  const state = capturedState || getState();
  const pool = settlePoolEggPrize(state, { rng });
  const label = pool.prize?.kind === "empty" ? "空蛋" : pool.prize?.label || "彩头";
  const summaryLabel = pool.prize?.kind === "empty" ? "空蛋" : label;
  apply({
    ...pool,
    changes: { ...pool.changes, npcState: eggSignInChange(state) },
    fact: eggFact(state, summaryLabel),
    logs: [...pool.logs, { t: "sys", text: `  ${eggFallbackLine(pool.tier, rng)}` }],
  });
  return pool;
}

export async function runEggPrize(quality, {
  apply,
  getState = () => gameStore.getState(),
  rng = Math.random,
  ai = webAi,
  getApiCfg = () => sessionUiStore.getState().apiCfg,
  canAsk = hasApiKey,
  isStale,
} = {}) {
  const epoch = getGameEpoch();
  const stale = () => Boolean(isStale?.()) || isGameEpochStale(epoch);
  if (stale()) return null;
  // 用户钦定：情趣物/卡券各约 7.5%——概率约束落系统侧（AI 控不了精确概率）。
  // 先掷这一把：命中则本次必开该件（prompt 明写照抄+reaction 定向，回包名字系统强校），
  // 未命中走 AI 自由开奖；兜底奖池维持原样不受影响。
  // Review 修③：开奖现场以开蛋那一刻为准——异步回包期间玩家可能换房，
  // 见证名单/现场快照不能用落账时的状态。
  const openingState = getState();
  const forced = rollEggSpecial(rng);
  try {
    if (!canAsk()) return settleEggFromPool({ apply, getState, rng, state: openingState });
    let prize = null;
    try {
      const res = await withAI("goldenEgg.prize", { quality, forced }, { ai, apiCfg: getApiCfg(), isStale: stale, throwOnError: false });
      if (stale()) return null;
      prize = res?.ok ? parseEggPrize(res.data) : null;
    } catch {
      prize = null;
    }
    if (stale()) return null;
    if (prize && forced) prize = { ...prize, name: forced }; // 系统强校：必开件名字一字不差，makeItemSmart 按物件志实例化
    // Review 修②：未命中必开档时，AI 自由开奖也不得开出两件系统保留物——
    // sys copy 禁令是软约束，模型仍可能照抽照写，这里硬拒落兜底奖池（守住各 7.5% 的精确口径）。
    if (prize && !forced && (prize.name === EGG_SPECIAL_FAKE || prize.name === INTIMATE_TICKET_NAME)) prize = null;
    if (!prize && forced) {
      // AI 失败但系统已掷定必开件：不退回奖池（会丢掉这 7.5%），按手写兜底句落该件。
      prize = {
        name: forced,
        category: "misc",
        desc: "",
        mood: forced === EGG_SPECIAL_FAKE ? "small" : "jackpot",
        reaction: eggFallbackLine(forced === EGG_SPECIAL_FAKE ? "blush" : "jackpot", rng),
      };
    }
    if (!prize) return settleEggFromPool({ apply, getState, rng, state: openingState });
    const settled = settleAiEggPrize(prize, quality);
    const withFact = {
      ...settled,
      changes: { ...settled.changes, npcState: eggSignInChange(openingState) },
      fact: eggFact(openingState, prize.name),
    };
    apply(withFact);
    return withFact;
  } finally {
    clearEggPrizeOpen();
  }
}

// 系统好感账本：settle 社交（送礼/求教/邀同行）的确定性好感写入。
// 与 mvu 限幅同源的系统语义——魅力修正、0-100 clamp、每日 +12 日涨上限、
// 无好感轨道跳过——但不含 AI 单回合 ±perTurn 限幅：系统结算是终裁，不是 AI 提案。
import { AFFECTION_RULES } from "./fields.js";
import { writePath } from "./applyWrite.js";

const clamp = (value, min = -Infinity, max = Infinity) => Math.max(min, Math.min(max, value));

// 纯函数：给定 varTree 与原始增量，算出系统结算后的实际增量与新树。
// range: [lo, hi] 结算区间（送礼按分量/品阶）；floor 用于钉值语义的下限。
export function systemAffectionDelta(tree, npc, baseDelta, { charm = 5, time = 0, range } = {}) {
  let delta = baseDelta;
  if (delta > 0) delta *= 1 + (clamp(charm, 0, 10) - 5) * 0.06;
  delta = Math.round(delta);
  if (range) delta = clamp(delta, range[0], range[1]);
  const before = tree?.角色?.[npc]?.好感度;
  const base = typeof before === "number" ? before : 0;
  // 负增量语义（WO-16A talk forceful 等复用）：不吃魅力放大、不进日涨账，
  // 结果 clamp 到 0（好感不能为负），返回实际落地的 delta。
  if (baseDelta < 0) {
    const target = Math.max(0, base + baseDelta);
    const actual = target - base;
    if (actual === 0) return { delta: 0, before: base, tree, note: "好感无实质变化" };
    return { delta: actual, before: base, tree: writePath(tree, ["角色", npc, "好感度"], target), note: null };
  }
  if (delta > 0) delta = Math.min(delta, 100 - base);
  if (delta <= 0) return { delta, before: base, tree, note: "好感无实质变化" };
  // 用户钦定：日涨封顶彻底拆除——正增量不再按日限涨、不再写 世界.好感日增 账
  // （usePrivateTalk 旁白账本另有自用读写，与本系统结算无关）。魅力修正保留。
  const next = writePath(tree, ["角色", npc, "好感度"], base + delta);
  return { delta, before: base, tree: next, note: null };
}

// 钉值语义（邀同行初始好感）：直接写到目标值，无日涨上限——这是开局定性，不是渐进涨幅。
export function systemAffectionPin(tree, npc, target) {
  const before = tree?.角色?.[npc]?.好感度;
  const base = typeof before === "number" ? before : 0;
  const pinned = clamp(target, 0, 100);
  if (base >= pinned) return { delta: 0, before: base, tree };
  const next = writePath(tree, ["角色", npc, "好感度"], pinned);
  return { delta: pinned - base, before: base, tree: next };
}

// 无好感轨道判定口径与 commitRound 搭话跳过一致：intimacy.forbidden 或兽类。
// 实现移入 npc/npcTrack.js（叶子无依赖）——此处 re-export 保持既有调用方不破。
export { hasNoAffectionTrack } from "../npc/npcTrack.js";

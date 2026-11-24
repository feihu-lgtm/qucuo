// 切磋界面共享件：招式类型图标、机制描述翻译、公用样式表。
// 从 DuelScreen.jsx 拆出（纯搬运，无逻辑改动），供 duel/ 各区块组件与
// TeamDuelScreen.jsx（经 DuelScreen 转发）复用。

import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import { MOVE_TYPE } from "../../../domain/rules/combat/moveTypes.js";

// TYPE_ICON 同时导出给 TeamDuelScreen.jsx（2v2团战界面）复用。
export const TYPE_ICON = { [MOVE_TYPE.ATTACK]: "⚔", [MOVE_TYPE.DEFENSE]: "🛡", [MOVE_TYPE.STATUS]: "☯" };

// 人类可读地翻译一个招式挂了哪些机制（用于详细察看）
export function describeMoveEffects(m) {
  const out = [];
  if (m.baseDamageMultiplier != null) {
    if (m.type === MOVE_TYPE.DEFENSE) out.push(`减伤至 ${Math.round(m.baseDamageMultiplier * 100)}%（挡下越多越强）`);
    else if (m.type === MOVE_TYPE.ATTACK) out.push(`攻击倍率 ${m.baseDamageMultiplier}×`);
  }
  if (m.energyRestore) out.push(`回复能量 ${m.energyRestore}`);
  if (m.doubleVsStatus) out.push("克中对方状态招时伤害翻倍");
  if (m.ignoreDefense) out.push("无视对方防御减伤");
  if (m.forceFirst) out.push("必定先手（无视身法）");
  if (m.nullifyStatusOnHit) out.push("命中即打散对方状态招");
  if (m.onCounterSuccessDamageRatio) out.push(`应对成功反打对方 ${Math.round(m.onCounterSuccessDamageRatio * 100)}%`);
  if (m.onCounterSuccessEnergyGain) out.push(`应对成功回气 ${m.onCounterSuccessEnergyGain}`);
  if (m.onCounterSuccessPreemptive) out.push("反击抢先结算，可能一击制敌免伤");
  if (m.onCounterFailEnergyPenalty) out.push(`应对失败倒扣能量 ${m.onCounterFailEnergyPenalty}`);
  if (m.onCounterFailDefenseNullified) out.push("应对失败则门户大开，下回合难守");
  if (m.confuseChance) out.push(`${Math.round(m.confuseChance * 100)}% 令对方气乱`);
  if (m.applyStatus) out.push(`${Math.round((m.applyStatus.chance ?? 1) * 100)}% 施加「${m.applyStatus.name}」`);
  if (m.energyDiffDamage) out.push("按双方能量差造成伤害");
  if (m.doubleReflectDamage) out.push("二倍反弹对方力道");
  if (m.freezeEnergyRecovery) out.push("冻结对方下回合回气");
  if (m.enemyCostPenalty) out.push(`抬高对方出招耗气 ${m.enemyCostPenalty.value}（持续${m.enemyCostPenalty.turns}回合）`);
  if (m.nextAttackBonus) out.push(`蓄势：下一击威力 +${Math.round(m.nextAttackBonus * 100)}%`);
  if (m.lowEnemyEnergyBonus) out.push(`对方能量≤${m.lowEnemyEnergyBonus.threshold}时伤害×${m.lowEnemyEnergyBonus.multiplier}`);
  if (m.afterCounterBonus) out.push(`上回合应对成功则本招威力 +${Math.round(m.afterCounterBonus * 100)}%`);
  if (m.lowHpBonus) out.push("残血时越战越勇");
  if (m.allInDamage) out.push("孤注一掷：耗尽能量换爆发");
  if (m.selfSacrifice) out.push("燃烧自身气血催动");
  if (m.permanentGrowthOnUse) out.push("每次使用永久增强");
  if (m.permanentCostReductionOnUse) out.push("每次使用永久降低耗气");
  return out;
}

export const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(4,4,10,0.85)",
    zIndex: 450, display: "flex", alignItems: "center", justifyContent: "center",
  },
  container: {
    width: 480, maxWidth: "94vw", maxHeight: "92vh", borderRadius: 0, padding: 16,
    display: "flex", flexDirection: "column", gap: 12,
  },
  topBar: { display: "flex", alignItems: "center", gap: 12 },
  sideInfo: { flex: 1 },
  name: (t) => ({ fontSize: "var(--fs-sm)", color: t.text, marginBottom: 4 }),
  hpText: { fontSize: "var(--fs-2xs)", color: "var(--attr-value)", marginTop: 2 },
  vsBadge: (t) => ({ fontSize: "var(--fs-2xs)", color: t.accent, border: `1px solid ${t.accent}`,
  borderRadius: 0, padding: "3px 8px", display: "flex",
  alignItems: "center", justifyContent: "center", flexShrink: 0, whiteSpace: "nowrap", }),
  // 上半：操作区
  opSection: { display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 },
  sectionLabel: (t) => ({ fontSize: "var(--fs-sm)", color: t.accent, letterSpacing: "1px" }),
  moveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "30vh", overflowY: "auto" },
  warnLine: { textAlign: "center", color: "var(--red-soft)", fontSize: "11px", padding: "4px 0" },
  hintLine: (t) => ({ fontSize: "var(--fs-xs)", color: t.textDim, textAlign: "center" }),
  // 战斗内道具栏
  itemBarRow: { marginTop: 6 },
  itemToggle: (t, empty) => ({ fontSize: "var(--fs-sm)", cursor: empty ? "default" : "pointer",
  color: empty ? t.textDim : t.accent, letterSpacing: "0.5px",
  opacity: empty ? 0.55 : 1, userSelect: "none", }),
  itemGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6,
    maxHeight: "22vh", overflowY: "auto",
  },
  itemBtn: (t, quality) => ({
    cursor: "pointer", padding: "6px 10px", borderRadius: 0,
    border: `1px solid ${QUALITY_COLOR[quality] || t.accentDim}`,
    background: "rgba(255,255,255,0.03)",
  }),
  itemName: { fontSize: "var(--fs-sm)", color: "inherit" },
  itemEff: (t) => ({ fontSize: "var(--fs-2xs)", color: t.textDim, marginTop: 2 }),
  enemyStripLabel: (t) => ({ fontSize: "var(--fs-xs)", color: t.textDim, marginTop: 4 }),
  enemyStrip: { display: "flex", flexWrap: "wrap", gap: 6 },
  enemyChip: (t, revealed) => ({ fontSize: "var(--fs-xs)", padding: "4px 8px", borderRadius: 0,
  border: `1px dashed ${revealed ? t.accentDim : "rgba(255,255,255,0.15)"}`,
  color: revealed ? t.text : t.textDim,
  cursor: revealed ? "pointer" : "default",
  background: revealed ? "rgba(255,255,255,0.04)" : "transparent", }),
  // 下半：MUD结算日志
  logSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10,
    maxHeight: "34vh", overflowY: "auto", fontFamily: "inherit",
  },
  logHint: (t) => ({ fontSize: "var(--fs-sm)", color: t.textDim, textAlign: "center", padding: "16px 0" }),
  continueRow: { textAlign: "center", marginTop: 6 },
  continueBtn: (t) => ({
    cursor: "pointer", display: "inline-block", padding: "8px 24px",
    color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 0, fontSize: "12px",
  }),
  // 详细察看弹层
  inspectOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 460,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  inspectCard: { width: 320, maxWidth: "88vw", borderRadius: 0, padding: 16 },
};

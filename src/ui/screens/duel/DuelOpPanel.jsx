// 上半操作区：阶段标语、出招网格、战斗内道具栏、敌招迷雾条、推进按钮。

import React from "react";
import { MOVE_TYPE } from "../../../domain/rules/combat/moveTypes.js";
import { MoveButton } from "./MoveButton.jsx";
import { TYPE_ICON, styles } from "./duelShared.js";
import { THEME_VARS } from "../../../utils/theme.js";

export default function DuelOpPanel({
  npc,
  selecting, phase, outcome, error, round, combatBuff,
  moveset, playerEnergy, playerDefenseBroken, onSelectMove, onInspect,
  battleItems, showItemPanel, onToggleItemPanel, onUseItem,
  npcMovesetLocal, revealedNpcMoves,
  onContinue, onClose,
}) {
  return (
    <div className="duel-op" style={styles.opSection}>
      <div style={styles.sectionLabel(THEME_VARS)}>
        {selecting ? "◆ 请出招" : outcome ? (outcome === "win" ? "◆ 切磋已分胜负" : "◆ 你落败了") : "◆ 结算中"}
      </div>

      {selecting && (
        <>
          {error && <div style={styles.warnLine}>⚠ 上一回合结算出错：{error}（已重置，可重新出招）</div>}
          {moveset.length === 0 && <div style={styles.warnLine}>招式数据尚未就绪，请退出重新发起切磋</div>}
          {playerDefenseBroken && <div style={styles.hintLine(THEME_VARS)}>守势已露，此回合不可再守，须变招</div>}
          {round === 1 && (combatBuff.waigong || combatBuff.moveMul || combatBuff.energyBonus || combatBuff.hpBonusRatio) ? (
            <div style={styles.hintLine(THEME_VARS)}>
              战前一餐，药力正盛：{[
                combatBuff.hpBonusRatio ? `气血+${Math.round(combatBuff.hpBonusRatio * 100)}%` : null,
                combatBuff.energyBonus ? `起手真气+${combatBuff.energyBonus}` : null,
                combatBuff.waigong ? `外功+${combatBuff.waigong}` : null,
                combatBuff.moveMul ? `招式威力+${combatBuff.moveMul}` : null,
              ].filter(Boolean).join("，")}
            </div>
          ) : null}
          <div className="duel-move-grid" style={styles.moveGrid}>
            {moveset.map((move, i) => {
              const blockedByRepeat = move.type === MOVE_TYPE.DEFENSE && playerDefenseBroken;
              return (
                <MoveButton key={move.id || i} move={move}
                  disabled={move.energyCost > playerEnergy[0] || blockedByRepeat} onClick={() => onSelectMove(move)}
                  onInspect={() => onInspect({ ...move, side: "你" })} />
              );
            })}
          </div>

          {/* ── 战斗内道具栏：服药消耗本回合行动，对方照常出招 ── */}
          <div style={styles.itemBarRow}>
            <span
              onClick={() => battleItems.length > 0 && onToggleItemPanel()}
              style={styles.itemToggle(THEME_VARS, battleItems.length === 0)}
              title={battleItems.length === 0 ? "身上没有可在战斗中服用的丹药" : "服药消耗本回合，对方照常出招"}>
              {showItemPanel ? "▾" : "▸"} ⊙ 用道具{battleItems.length > 0 ? `（${battleItems.length}）` : "（无）"}
            </span>
          </div>
          {showItemPanel && battleItems.length > 0 && (
            <div style={styles.itemGrid}>
              {battleItems.map(({ item, total }) => {
                const c = item.consumable || {};
                const effBits = [];
                if (c.hpRestore) effBits.push(`回血${Math.round(c.hpRestore * 100)}%`);
                if (c.energyRestore) effBits.push(`回气${c.energyRestore}`);
                if (c.dispel || c.dispelAll) effBits.push("解异常");
                if (c.rebirthOnce) effBits.push("假死保命");
                return (
                  <div key={item.name} onClick={() => onUseItem(item)}
                    style={styles.itemBtn(THEME_VARS, item.quality)}
                    title={item.desc || ""}>
                    <div style={styles.itemName}>{item.name} ×{total}</div>
                    <div style={styles.itemEff(THEME_VARS)}>{effBits.join(" · ")}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 敌招迷雾：用过才揭示，可点开详细察看 */}
          <div style={styles.enemyStripLabel(THEME_VARS)}>{npc.name}的招式（用过才可察看）</div>
          <div style={styles.enemyStrip}>
            {npcMovesetLocal.map((m, i) => {
              const revealed = revealedNpcMoves.has(m.id);
              return (
                <div key={m.id || i}
                  onClick={revealed ? () => onInspect({ ...m, side: npc.name }) : undefined}
                  style={styles.enemyChip(THEME_VARS, revealed)}
                  title={revealed ? "点击详细察看" : "尚未见识过这一招"}>
                  {revealed ? `${TYPE_ICON[m.type]} ${m.name}` : "？ 未知"}
                </div>
              );
            })}
          </div>
        </>
      )}

      {phase === "result" && !outcome && (
        <div style={styles.continueRow}><span onClick={onContinue} style={styles.continueBtn(THEME_VARS)}>下一回合 ▸</span></div>
      )}
      {phase === "result" && outcome && (
        <div style={styles.continueRow}><span onClick={onContinue} style={styles.continueBtn(THEME_VARS)}>结束切磋</span></div>
      )}
      {phase === "over" && (
        <div style={styles.continueRow}><span onClick={onClose} style={styles.continueBtn(THEME_VARS)}>关闭</span></div>
      )}
    </div>
  );
}

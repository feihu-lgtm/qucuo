// 切磋战斗界面
// 布局参照传统回合制对战游戏的信息组织方式（双方血条对峙+中央VS+底部技能栏），
// 视觉语言用曲措乡自己的水墨主题（zoneTheme），不是抄二次元卡通美术，
// 只是复用"血条在哪、技能在哪、回合提示在哪"这套久经考验的信息层级。
//
// 结构：useDuelBattle 持有全部回合状态与结算处理，本组件只做调度+拼装；
// 展示区块拆在 duel/ 目录（对峙条/操作区/战报流/察看弹层/血条气力/出招按钮）。

import React from "react";
import { useDuelBattle } from "./duel/useDuelBattle.js";
import DuelTopBar from "./duel/DuelTopBar.jsx";
import DuelOpPanel from "./duel/DuelOpPanel.jsx";
import DuelLog from "./duel/DuelLog.jsx";
import { MoveInspect } from "./duel/MoveInspect.jsx";
import { styles } from "./duel/duelShared.js";

// TYPE_ICON / HpBar / EnergyDots / MoveButton / MoveInspect 同时导出给
// TeamDuelScreen.jsx（2v2团战界面）复用——纯展示组件，不含任何1v1状态逻辑。
export { TYPE_ICON } from "./duel/duelShared.js";
export { HpBar, EnergyDots } from "./duel/DuelBars.jsx";
export { MoveButton } from "./duel/MoveButton.jsx";
export { MoveInspect } from "./duel/MoveInspect.jsx";

export default function DuelScreen({ npc, playerChar, pendingCombatBuff, playerInv, playerMoveset, playerSkills = [], zoneTheme, onFinish }) {
  const b = useDuelBattle({ npc, playerChar, pendingCombatBuff, playerInv, playerMoveset, playerSkills, onFinish });
  const selecting = b.phase === "select";

  return (
    <div className="mobile-duel-root" style={styles.overlay}>
      <div className="mobile-duel-panel" style={{ ...styles.container, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}` }}>

        {/* ── 血/气条（保留）：双方对峙状态 ── */}
        <DuelTopBar
          npc={npc} round={b.round} zoneTheme={zoneTheme}
          playerHp={b.playerHp} playerEnergy={b.playerEnergy}
          npcHp={b.npcHp} npcEnergy={b.npcEnergy}
        />

        {/* ── 上半：操作区 ── */}
        <DuelOpPanel
          npc={npc} zoneTheme={zoneTheme}
          selecting={selecting} phase={b.phase} outcome={b.outcome} error={b.error}
          round={b.round} combatBuff={b.combatBuff}
          moveset={b.moveset} playerEnergy={b.playerEnergy} playerDefenseBroken={b.playerDefenseBroken}
          onSelectMove={b.handleSelectMove} onInspect={b.setInspectMove}
          battleItems={b.battleItems} showItemPanel={b.showItemPanel}
          onToggleItemPanel={() => b.setShowItemPanel(v => !v)} onUseItem={b.handleUseItem}
          npcMovesetLocal={b.npcMovesetLocal} revealedNpcMoves={b.revealedNpcMoves}
          onContinue={b.handleContinue} onClose={b.handleClose}
        />

        {/* ── 下半：MUD形式的结算展示 ── */}
        <DuelLog battleLog={b.battleLog} npc={npc} zoneTheme={zoneTheme} />
      </div>

      {b.inspectMove && (
        <MoveInspect move={b.inspectMove} zoneTheme={zoneTheme} onClose={() => b.setInspectMove(null)} />
      )}
    </div>
  );
}

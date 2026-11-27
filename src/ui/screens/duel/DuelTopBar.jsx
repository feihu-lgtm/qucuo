// 顶部对峙条：双方名/血条/气力点 + 中央回合徽记。

import React from "react";
import { HpBar, EnergyDots } from "./DuelBars.jsx";
import NpcAvatar from "../../components/NpcAvatar.jsx";
import { styles } from "./duelShared.js";
import { THEME_VARS } from "../../../utils/theme.js";

export default function DuelTopBar({ npc, playerHp, playerEnergy, npcHp, npcEnergy, round }) {
  const playerHpPct = (playerHp[0] / playerHp[1]) * 100;
  const npcHpPct = (npcHp[0] / npcHp[1]) * 100;
  return (
    <div className="duel-topbar" style={styles.topBar}>
      <div style={styles.sideInfo}>
        <div style={styles.name(THEME_VARS)}>你</div>
        <HpBar pct={playerHpPct} color={"var(--accent)"} />
        <div style={styles.hpText}>{playerHp[0]}/{playerHp[1]}</div>
        <EnergyDots value={playerEnergy[0]} color={"var(--accent)"} />
      </div>
      <div style={styles.vsBadge(THEME_VARS)}>第{round}回合</div>
      <div style={{ ...styles.sideInfo, textAlign: "right" }}>
        {/* 对手立绘落像：npcArtUrl 按名查登记表，缺图降级单字印章——与人物卡同口径 */}
        <div style={styles.name(THEME_VARS)} className="duel-name-flex">
          {npc.name}<NpcAvatar name={npc.name} size="sm" />
        </div>
        <HpBar pct={npcHpPct} color="var(--red-soft)" />
        <div style={styles.hpText}>{npcHp[0]}/{npcHp[1]}</div>
        <EnergyDots value={npcEnergy[0]} color="var(--red-soft)" right />
      </div>
    </div>
  );
}

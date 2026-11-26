// 下半：MUD形式的结算展示（自动滚到底）。

import React, { useRef, useEffect } from "react";
import MudRoundLog from "./MudRoundLog.jsx";
import { styles } from "./duelShared.js";

export default function DuelLog({ battleLog, npc, zoneTheme }) {
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [battleLog.length]);

  return (
    <div className="duel-log" style={styles.logSection} ref={logRef}>
      {battleLog.length === 0 && <div style={styles.logHint(zoneTheme)}>——两人拉开架势，静待第一招——</div>}
      {battleLog.map((e, i) => (
        <MudRoundLog key={i} entry={e} npcName={npc.name} />
      ))}
    </div>
  );
}

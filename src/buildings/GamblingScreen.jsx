import React, { useState } from "react";
import { makeItem, ITEM_CATEGORY, rollQuality } from "../equipment.js";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 赌坊：每日一次，押注银两，按气运值决定输赢；或固定押100两抽物品
export default function GamblingScreen({ building, char, flags, time, zoneTheme, onClose, inline, onGamble }) {
  const [mode, setMode] = useState("money"); // "money" | "item"
  const [bet, setBet] = useState(50);
  const money = char.money || 0;
  const luck = (char.special?.气运) ?? 5;
  const maxBet = building.maxBet || 200;
  const dayIdx = Math.floor(time / 100);

  const alreadyGambled = flags.includes(`gambled_day_${dayIdx}`);

  function calcOdds() {
    const t = luck / 10;
    return {
      lose: Math.round((0.6 - 0.3 * t) * 100),
      tie: Math.round(0.3 * 100),
      win: Math.round((0.1 + 0.3 * t) * 100),
    };
  }
  const odds = calcOdds();

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8a8a7a", marginBottom: 10, fontSize: 11 }}>
          银两 {money} 两 · 气运 {luck}/10 · 每日一次
        </div>

        {alreadyGambled && (
          <div style={{ color: "#c45044", marginBottom: 12, fontSize: 12 }}>今日已赌过，明日再来。</div>
        )}

        <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: `1px solid ${zoneTheme.border}` }}>
          {[["money", "赌银两"], ["item", "抽物品（100两）"]].map(([id, label]) => (
            <span key={id} onClick={() => setMode(id)}
              style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", userSelect: "none",
                color: mode === id ? zoneTheme.accent : zoneTheme.accentDim,
                borderBottom: mode === id ? `2px solid ${zoneTheme.accent}` : "2px solid transparent" }}
            >{label}</span>
          ))}
        </div>

        {mode === "money" && (
          <>
            <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 8 }}>
              赔 {odds.lose}% · 平 {odds.tie}% · 赢 {odds.win}%（概率按气运线性插值）
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "#c8bfa0", fontSize: 12 }}>押注：</span>
              <input
                type="number" value={bet} min={10} max={Math.min(maxBet, money)}
                onChange={e => setBet(Math.max(10, Math.min(Number(e.target.value), maxBet, money)))}
                style={{ width: 80, background: "#10121a", border: `1px solid ${zoneTheme.border}`, borderRadius: 4, color: "#c8bfa0", fontSize: 12, padding: "3px 6px" }}
              />
              <span style={{ color: "#5a5a4a", fontSize: 11 }}>两（最多 {maxBet}）</span>
            </div>
            <Btn
              label={`押注 ${bet} 两`}
              disabled={alreadyGambled || money < bet || bet < 10}
              zoneTheme={zoneTheme}
              onClick={() => onGamble({ mode: "money", bet, luck, dayIdx })}
            />
          </>
        )}

        {mode === "item" && (
          <>
            <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 12 }}>
              固定花100两，按气运随机抽一件物品（气运越高品质越好）
            </div>
            <Btn
              label="花100两抽物品"
              disabled={alreadyGambled || money < 100}
              zoneTheme={zoneTheme}
              onClick={() => onGamble({ mode: "item", bet: 100, luck, dayIdx })}
            />
          </>
        )}

        <div style={{ color: "#4a4a4a", fontSize: 10, marginTop: 14 }}>
          {building.desc}
        </div>
      </div>
    </Overlay>
  );
}

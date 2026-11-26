import React, { useState } from "react";
import { makeItem, ITEM_CATEGORY, rollQuality } from "../../../domain/rules/economy/equipment.js";
import { Overlay, Header, Btn } from "./common.jsx";

// 赌坊：每日一次，押注银两，按气运值决定输赢；或固定押100两抽物品
export default function GamblingScreen({ building, char, flags, time, onClose, inline, onGamble }) {
  const [mode, setMode] = useState("money"); // "money" | "item"
  const [bet, setBet] = useState(50);
  const money = char.money || 0;
  const luck = (char.special?.气运) ?? 5;
  const maxBet = building.maxBet || 200;
  const dayIdx = Math.floor(time / 24); // 真正的"天"，跟 getTimeStr 同源（原 time/100 是bug，~8天才翻篇一次）

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
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building.name} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 10, fontSize: "var(--fs-xs)" }}>
          银两 {money} 两 · 气运 {luck}/10 · 每日一次
        </div>

        {alreadyGambled && (
          <div style={{ color: "var(--red-soft)", marginBottom: 12, fontSize: "var(--fs-sm)" }}>今日已赌过，明日再来。</div>
        )}

        <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: `1px solid var(--border)` }}>
          {[["money", "赌银两"], ["item", "抽物品（100两）"]].map(([id, label]) => (
            <span key={id} onClick={() => setMode(id)}
              style={{ padding: "6px 14px", fontSize: "var(--fs-xs)", cursor: "pointer", userSelect: "none",
                color: mode === id ? "var(--accent)" : "var(--accent-dim)",
                borderBottom: mode === id ? `2px solid var(--accent)` : "2px solid transparent" }}
            >{label}</span>
          ))}
        </div>

        {mode === "money" && (
          <>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>
              赔 {odds.lose}% · 平 {odds.tie}% · 赢 {odds.win}%（概率按气运线性插值）
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "var(--ink-text)", fontSize: "var(--fs-sm)" }}>押注：</span>
              <input
                type="number" value={bet} min={10} max={Math.min(maxBet, money)}
                onChange={e => setBet(Math.max(10, Math.min(Number(e.target.value), maxBet, money)))}
                style={{ width: 80, background: "var(--bg-ink)", border: `1px solid var(--border)`, borderRadius: 0, color: "var(--ink-text)", fontSize: "var(--fs-sm)", padding: "3px 6px" }}
              />
              <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)" }}>两（最多 {maxBet}）</span>
            </div>
            <Btn
              label={`押注 ${bet} 两`}
              disabled={alreadyGambled || money < bet || bet < 10}
              onClick={() => onGamble({ mode: "money", bet, luck, dayIdx })}
            />
          </>
        )}

        {mode === "item" && (
          <>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 12 }}>
              固定花100两，按气运随机抽一件物品（气运越高品质越好）
            </div>
            <Btn
              label="花100两抽物品"
              disabled={alreadyGambled || money < 100}
              onClick={() => onGamble({ mode: "item", bet: 100, luck, dayIdx })}
            />
          </>
        )}

        <div style={{ color: "var(--building-desc)", fontSize: "var(--fs-2xs)", marginTop: 14 }}>
          {building.desc}
        </div>
      </div>
    </Overlay>
  );
}

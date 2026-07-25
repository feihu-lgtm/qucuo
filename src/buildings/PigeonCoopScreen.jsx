import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 鸽子笼：每日免费领信鸽，不花银两，跟赌坊一样按 flags 记"今天领过没"。
// dayIdx 用真正的"天"（time/24，跟 getTimeStr 同源），不是赌坊那个错用的 time/100。
export default function PigeonCoopScreen({ building, char, flags, time, zoneTheme, onClose, inline, onCollect }) {
  const pigeons = char.pigeons || 0;
  const dailyQty = building.dailyPigeons || 3;
  const dayIdx = Math.floor(time / 24);
  const alreadyCollected = flags.includes(`pigeon_collected_day_${dayIdx}`);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <p style={{ color: zoneTheme.text, marginBottom: 12, fontSize: 13 }}>{building.desc}</p>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          🕊 现有信鸽 {pigeons} 只 · 每日可领 {dailyQty} 只（不花银两）
        </div>

        {alreadyCollected && (
          <div style={{ color: "#c45044", marginBottom: 12, fontSize: 12 }}>今日已领过，明日再来。</div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn
            label={`领${dailyQty}只信鸽`}
            disabled={alreadyCollected}
            zoneTheme={zoneTheme}
            onClick={() => onCollect({ qty: dailyQty, dayIdx })}
          />
          <Btn label="关闭" zoneTheme={zoneTheme} secondary onClick={onClose} />
        </div>
      </div>
    </Overlay>
  );
}

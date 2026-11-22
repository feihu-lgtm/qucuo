import React from "react";
import { chromeBtn } from "../../../utils/theme.js";
import MusicSettings from "./MusicSettings.jsx";

// 其他 tab：字号 / 字体 / 音乐。状态由壳持有。
export default function OtherTab({ uiScale, setUiScale, font, setFont, zoneTheme }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: 10 }}>显示与其他设置。</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
        <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0 }}>字号</span>
        <input
          type="range" min="0.7" max="1.6" step="0.05"
          value={uiScale}
          onChange={e => setUiScale(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: "11px", color: "var(--text)", flexShrink: 0, width: 42, textAlign: "right" }}>{Math.round(uiScale * 100)}%</span>
        <span
          onClick={() => setUiScale(1)}
          style={{ fontSize: "10px", color: "var(--accent)", cursor: "pointer", flexShrink: 0, border: "1px solid var(--border)", borderRadius: 0, padding: "2px 6px" }}
        >重置</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
        <span style={{ fontSize: "11px", color: "var(--text-dim)", flexShrink: 0 }}>字体</span>
        <button type="button" aria-pressed={font === "pixel"} onClick={() => setFont("pixel")} style={chromeBtn(zoneTheme, { active: font === "pixel" })}>缝合像素</button>
        <button type="button" aria-pressed={font === "song"} onClick={() => setFont("song")} style={chromeBtn(zoneTheme, { active: font === "song" })}>宋体</button>
      </div>

      <MusicSettings />
    </div>
  );
}

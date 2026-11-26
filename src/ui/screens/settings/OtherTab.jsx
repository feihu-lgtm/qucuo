import React from "react";
import { chromeBtn } from "../../../utils/theme.js";
import MusicSettings from "./MusicSettings.jsx";
import { useSessionUi, setNsfwOn } from "../../../store/sessionUiStore.js";

// 其他 tab：字号 / 字体 / 音乐 / NSFW 低频开关（W-INPUT：底栏按钮撤销，默认恒 true 收此处兜底）。
export default function OtherTab({ uiScale, setUiScale, font, setFont, zoneTheme }) {
  const nsfwOn = useSessionUi(s => s.nsfwOn);
  return (
    <div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 10 }}>显示与其他设置。</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", flexShrink: 0 }}>字号</span>
        <input
          type="range" min="0.7" max="1.6" step="0.05"
          value={uiScale}
          onChange={e => setUiScale(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text)", flexShrink: 0, width: 42, textAlign: "right" }}>{Math.round(uiScale * 100)}%</span>
        <span
          onClick={() => setUiScale(1)}
          style={{ fontSize: "var(--fs-2xs)", color: "var(--accent)", cursor: "pointer", flexShrink: 0, border: "1px solid var(--border)", borderRadius: 0, padding: "2px 6px" }}
        >重置</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", flexShrink: 0 }}>字体</span>
        <button type="button" aria-pressed={font === "pixel"} onClick={() => setFont("pixel")} style={chromeBtn(zoneTheme, { active: font === "pixel" })}>缝合像素</button>
        <button type="button" aria-pressed={font === "song"} onClick={() => setFont("song")} style={chromeBtn(zoneTheme, { active: font === "song" })}>宋体</button>
      </div>

      <MusicSettings />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", flexShrink: 0 }}>NSFW</span>
        <button
          type="button"
          aria-pressed={nsfwOn}
          data-settings-nsfw="true"
          onClick={() => setNsfwOn(v => !v)}
          style={chromeBtn(zoneTheme, { active: nsfwOn })}
        >{nsfwOn ? "已开启" : "已关闭"}</button>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>默认常开；关闭后不再注入成人写作规则</span>
      </div>
    </div>
  );
}

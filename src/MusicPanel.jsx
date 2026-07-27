import React, { useState, useEffect } from "react";
import { TRACKS, getState, subscribe, toggleMusic, playTrack, setVolume, isMusicEnabled, setMusicEnabled } from "./musicPlayer.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function MusicPanel({ onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [state, setState] = useState(getState);
  useEffect(() => subscribe(setState), []);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(4,4,10,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 8, padding: 20, width: 360, maxWidth: "90vw", color: "#c8bfa0", fontFamily: "inherit", fontSize: "12.5px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ color: "#6ec6c6", fontSize: "14px" }}>♫ 音乐面板</span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {TRACKS.map(t => {
            const active = state.trackId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => { setMusicEnabled(true); playTrack(t.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 5, cursor: "pointer",
                  background: active ? "#12211f" : "#0e1018",
                  border: `1px solid ${active ? "#6ec6c6" : "#1a2d2a"}`,
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "16px", color: active && state.playing ? "#6ec6c6" : "#3a4a3a", flexShrink: 0 }}>
                  {active && state.playing ? "♫" : "♪"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: active ? "#c8e0d8" : "#8a8a7a", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ color: "#5a5a4a", fontSize: "10.5px" }}>{t.artist}</div>
                </div>
                {active && state.playing && (
                  <span style={{ color: "#6ec6c6", fontSize: "10px", flexShrink: 0 }}>播放中</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#0e0c14", border: "1px solid #1a2d2a", borderRadius: 4 }}>
          <span
            onClick={toggleMusic}
            style={{ cursor: "pointer", color: "#6ec6c6", padding: "4px 12px", border: "1px solid #1a2d2a", borderRadius: 3, fontSize: "11.5px", flexShrink: 0 }}
          >{state.playing ? "⏸ 暂停" : "▶ 播放"}</span>
          <span style={{ fontSize: "11px", color: "#7a7a6a", flexShrink: 0 }}>音量</span>
          <input
            type="range" min="0" max="1" step="0.05" value={state.volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "11px", color: "#c8bfa0", width: 36, textAlign: "right", flexShrink: 0 }}>{Math.round(state.volume * 100)}%</span>
        </div>

        <div style={{ fontSize: "10px", color: "#3a3a2a", marginTop: 10, lineHeight: 1.5 }}>
          音源：archive.org · 无版权音乐 · 秉承着共产主义精神传递的免费文件，完全开源
        </div>
      </div>
    </div>
  );
}

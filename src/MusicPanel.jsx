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
        style={{ background: "#111110", border: "1px solid #4a453c", borderRadius: 0, padding: 20, width: 360, maxWidth: "90vw", color: "#e8e4d6", fontFamily: "inherit", fontSize: "12.5px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ color: "#c8323a", fontSize: "14px" }}>♫ 音乐面板</span>
          <span style={{ color: "#8f8a7c", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
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
                  borderRadius: 0, cursor: "pointer",
                  background: active ? "#241211" : "#161510",
                  border: `1px solid ${active ? "#c8323a" : "#4a453c"}`,
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "16px", color: active && state.playing ? "#c8323a" : "#3a4a3a", flexShrink: 0 }}>
                  {active && state.playing ? "♫" : "♪"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: active ? "#c8e0d8" : "#8f8a7c", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ color: "#8f8a7c", fontSize: "10.5px" }}>{t.artist}{t.origin ? ` · ${t.origin}` : ""}</div>
                </div>
                {active && state.playing && (
                  <span style={{ color: "#c8323a", fontSize: "10px", flexShrink: 0 }}>播放中</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#161510", border: "1px solid #4a453c", borderRadius: 0 }}>
          <span
            onClick={toggleMusic}
            style={{ cursor: "pointer", color: "#c8323a", padding: "4px 12px", border: "1px solid #4a453c", borderRadius: 0, fontSize: "11.5px", flexShrink: 0 }}
          >{state.playing ? "⏸ 暂停" : "▶ 播放"}</span>
          <span style={{ fontSize: "11px", color: "#8f8a7c", flexShrink: 0 }}>音量</span>
          <input
            type="range" min="0" max="1" step="0.05" value={state.volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "11px", color: "#e8e4d6", width: 36, textAlign: "right", flexShrink: 0 }}>{Math.round(state.volume * 100)}%</span>
        </div>

        {/* 播放失败必须看得见。原来 play() 的 rejection 被 .catch(() => {}) 整个
            吞掉，getState() 算了 error 却没人渲染，于是"点一下、没声音、没提示、
            ♪也不变♫"——最难查的那种坏。 */}
        {state.error && (
          <div style={{ marginTop: 10, padding: "7px 9px", background: "#1a0e0e", border: "1px solid #4a2020", borderRadius: 0, fontSize: "10.5px", color: "#d88a7a", lineHeight: 1.5 }}>
            ⚠ {state.error}
          </div>
        )}

        <div style={{ fontSize: "10px", color: "#3a3a2a", marginTop: 10, lineHeight: 1.5 }}>
          音源见各曲目标注 · 外链曲目来自 archive.org，本地曲目需 public/music/ 下有对应 mp3
        </div>
      </div>
    </div>
  );
}

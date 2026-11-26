import React, { useState } from "react";
import { setMusicEnabled, getState as getMusicState, setVolume as setMusicVolume, subscribe as subscribeMusic, toggleMusic, TRACKS } from "../../../infra/musicPlayer.js";

export default function MusicSettings() {
  // enabled 不再单独用一份 useState 影子态：它现在进了 getState()，直接从
  // state 里读。原来两份态各走各的，setMusicEnabled 里的 emit() 推不动这个
  // 复选框以外的任何东西（顶栏按钮就是这么不跟着变的）。
  const [state, setState] = useState(getMusicState);
  React.useEffect(() => subscribeMusic(setState), []);
  const enabled = state.enabled;
  const currentTrack = TRACKS.find(t => t.id === state.trackId) || TRACKS[0];
  return (
    <div style={{ padding: "8px 10px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input
          type="checkbox" checked={enabled}
          onChange={e => setMusicEnabled(e.target.checked)}
          style={{ cursor: "pointer" }} />
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--accent)" }}>🎵 音乐模式</span>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginLeft: "auto" }}>{currentTrack.title} — {currentTrack.artist}</span>
      </div>
      {enabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            onClick={toggleMusic} className="music-settings-1"
          >{state.playing ? "⏸ 暂停" : "▶ 播放"}</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", flexShrink: 0 }}>音量</span>
          <input
            type="range" min="0" max="1" step="0.05" value={state.volume}
            onChange={e => setMusicVolume(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text)", width: 36, textAlign: "right" }}>{Math.round(state.volume * 100)}%</span>
        </div>
      )}
      {state.error && (
        <div style={{ marginTop: 6, padding: "6px 8px", background: "var(--ink-error-bg)", border: "1px solid var(--ink-error-edge)", borderRadius: 0, fontSize: "var(--fs-2xs)", color: "var(--ink-error-text)", lineHeight: 1.5 }}>
          ⚠ {state.error}
        </div>
      )}
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-faint)", marginTop: 6 }}>
        音源见曲库面板各曲目标注 · 顶栏♪按钮可打开曲库面板切换曲目
      </div>
    </div>
  );
}

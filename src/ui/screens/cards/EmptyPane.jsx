// 入册 · 空态（拖卡/选卡入口，从 CardImportScreen.jsx 拆出）
import React from "react";
import { S } from "./widgets.jsx";

export default 
function EmptyPane({ dragOver, setDragOver, err, onPick, onFile, accent }) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 40 }}
    >
      <div onClick={onPick} style={{
        width: 300, height: 300, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        backgroundImage: `url('${S("frames/frame_gold2.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        transform: dragOver ? "scale(1.04)" : "scale(1)",
        transition: "transform .18s ease",
        filter: dragOver ? `drop-shadow(0 0 16px ${accent})` : "none",
      }}>
        <img src={S("ui/scroll_v.webp")} alt="" style={{ width: 62, opacity: dragOver ? 1 : .8 }} />
        <div style={{ color: "var(--tutorial-title)", fontSize: 14, letterSpacing: 2 }}>把角色卡拖进来</div>
        <div style={{ color: "var(--muted)", fontSize: 11 }}>或点此选择 · 支持 PNG 与 JSON</div>
      </div>
      {err && (
        <div style={{
          maxWidth: 520, padding: "10px 16px", color: "var(--ink-error-text)", fontSize: 11.5, lineHeight: 1.7,
          backgroundImage: `url('${S("ui/note_torn.webp")}')`, backgroundSize: "100% 100%",
        }}>{err}</div>
      )}
      <div style={{ color: "var(--muted)", fontSize: 10.5, lineHeight: 1.8, textAlign: "center" }}>
        酒馆角色卡（V2／V3）都能读。卡里的世界书会拆成人物与地理，<br />
        数值那部分卡里没有，由本作自己配——可以让 AI 先抽一版草案，也可以全手填。
      </div>
    </div>
  );
}


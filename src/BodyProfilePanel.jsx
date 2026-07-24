// 体貌面板：编辑主角身体档案 + 按体貌荐装
// ============================================================================
// 显示原则「不完全显示文本」：列表默认只露每栏前十几个字，点一下才展开成输入框。
// 私密层更进一步——默认整条打码成 •••，要先点「显示」才看得见。这个面板是会在
// 别人面前打开的，不该一开就把私密层摊在屏幕上。
// ============================================================================
import React, { useState } from "react";
import {
  BODY_FIELDS, PUBLIC_FIELDS, INTIMATE_FIELDS, BODY_LAYER,
  emptyBodyProfile, bodyProfileFilled, previewText, maskText,
} from "./bodyProfile.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function BodyProfilePanel({
  profile, onChange, onClose, zoneTheme, nsfwOn, onRecommend, recommendState,
}) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [editing, setEditing] = useState(null);      // 当前展开成输入框的 key
  const [showIntimate, setShowIntimate] = useState(false); // 私密层是否揭码
  const p = profile || emptyBodyProfile();
  const filled = bodyProfileFilled(p);

  const th = zoneTheme || {};
  const border = th.border || "#2a3a3a";
  const accent = th.accent || "#6ec6c6";
  const textDim = th.textDim || "#6a7a72";

  const inputStyle = {
    width: "100%", background: "#10121a", border: `1px solid ${border}`, borderRadius: 3,
    color: "#c8bfa0", padding: "6px 8px", fontFamily: "inherit", fontSize: "12px",
    boxSizing: "border-box", lineHeight: 1.6, resize: "vertical",
  };

  const renderField = (f) => {
    const val = p[f.key] || "";
    const isIntimate = f.layer === BODY_LAYER.INTIMATE;
    const hidden = isIntimate && !showIntimate;
    const isEditing = editing === f.key;

    return (
      <div key={f.key} style={{ borderBottom: `1px solid ${border}22`, padding: "5px 0" }}>
        <div
          onClick={() => { if (!hidden) setEditing(isEditing ? null : f.key); }}
          style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: hidden ? "default" : "pointer" }}
        >
          <span style={{ width: 60, flexShrink: 0, fontSize: "11px", color: val ? accent : textDim }}>
            {f.label}
          </span>
          <span style={{ flex: 1, fontSize: "11.5px", color: val ? "#c8bfa0" : "#4a4a3a", minWidth: 0 }}>
            {hidden ? (val ? maskText(val) : "—")
              : isEditing ? ""
              : (previewText(val) || <span style={{ color: "#4a4a3a" }}>未填</span>)}
          </span>
          {!hidden && (
            <span style={{ fontSize: "10px", color: textDim, flexShrink: 0 }}>{isEditing ? "收起" : "编辑"}</span>
          )}
        </div>
        {isEditing && !hidden && (
          <div style={{ marginTop: 5 }}>
            <div style={{ fontSize: "10px", color: textDim, marginBottom: 3 }}>{f.def}</div>
            <textarea
              autoFocus
              value={val}
              placeholder={f.hint || "写你想让 AI 记住的样子，一两句就够"}
              onChange={e => onChange({ ...p, [f.key]: e.target.value })}
              style={{ ...inputStyle, minHeight: 54 }}
            />
          </div>
        )}
      </div>
    );
  };

  const picks = recommendState?.picks || [];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(4,4,10,0.92)", zIndex: 220,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0a0c14", border: `1px solid ${border}`, borderRadius: 6, padding: 18,
          width: 480, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto",
          fontFamily: "inherit", fontSize: "12.5px", color: "#c8bfa0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: accent, fontSize: "14px" }}>◈ 体貌</span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>

        <div style={{ fontSize: "10.5px", color: textDim, lineHeight: 1.7, marginBottom: 10 }}>
          写在这里的样子，动作描写、贴身互动与旁白私聊都会照着写，不会每轮换一副身板。
          点条目展开编辑，留空的栏目一个字都不会发出去。
        </div>

        {/* 公开层 */}
        <div style={{ fontSize: "11px", color: accent, marginBottom: 2 }}>
          公开层 <span style={{ color: textDim, fontSize: "10px" }}>· 外人一眼可见 · 已填 {filled.public}/{PUBLIC_FIELDS.length}</span>
        </div>
        <div style={{ fontSize: "10px", color: "#5a5a4a", marginBottom: 4 }}>
          近距离互动（战斗 / 对话 / 查看）与旁白私聊时注入；赶路、结算轮不发。
        </div>
        {PUBLIC_FIELDS.map(renderField)}

        {/* 私密层 */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "11px", color: nsfwOn ? "#c85a6a" : textDim }}>
            私密层 <span style={{ color: textDim, fontSize: "10px" }}>· 已填 {filled.intimate}/{INTIMATE_FIELDS.length}</span>
          </span>
          <span
            onClick={() => setShowIntimate(v => !v)}
            style={{ marginLeft: "auto", fontSize: "10px", color: accent, cursor: "pointer" }}
          >
            {showIntimate ? "◉ 隐藏" : "○ 显示"}
          </span>
        </div>
        <div style={{ fontSize: "10px", color: "#5a5a4a", margin: "3px 0 4px" }}>
          {nsfwOn
            ? "■ 模式已开，这一层会随剧情注入。"
            : "■ 模式关着，这一层一个字都不会发给 AI——写了也不发。"}
        </div>
        {INTIMATE_FIELDS.map(renderField)}

        {/* 荐装 */}
        <div style={{ borderTop: `1px solid ${border}`, marginTop: 14, paddingTop: 12 }}>
          <div style={{ fontSize: "11px", color: accent, marginBottom: 4 }}>按体貌荐装</div>
          <div style={{ fontSize: "10px", color: "#5a5a4a", marginBottom: 6, lineHeight: 1.7 }}>
            拿你写的体貌去货架上比一遍，挑三件趁手的。
            只告诉你是什么、什么来历、加多少——<span style={{ color: textDim }}>怎么弄到手得自己走一趟</span>。
          </div>
          <span
            onClick={() => { if (!recommendState?.loading) onRecommend?.(); }}
            style={{
              cursor: recommendState?.loading ? "default" : "pointer",
              display: "inline-block", padding: "5px 14px", borderRadius: 3, fontSize: "11.5px",
              color: recommendState?.loading ? textDim : "#0a0c14",
              background: recommendState?.loading ? "#10121a" : accent,
              border: `1px solid ${recommendState?.loading ? border : accent}`,
            }}
          >
            {recommendState?.loading ? "掌柜正在翻货架…" : "◇ 让掌柜挑三件"}
          </span>

          {recommendState?.error && (
            <div style={{ fontSize: "11px", color: "#c46060", marginTop: 8 }}>{recommendState.error}</div>
          )}

          {picks.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {picks.map((it, i) => (
                <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 4, padding: "8px 10px", background: "#0e1018" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: "12.5px", color: it.qualityColor || "#c8bfa0" }}>{it.name}</span>
                    <span style={{ fontSize: "10px", color: textDim }}>{it.categoryLabel} · {it.quality}档</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#8a8a7a", lineHeight: 1.7, marginBottom: 4 }}>{it.desc}</div>
                  <div style={{ fontSize: "11px", color: accent }}>{it.statLine}</div>
                  {it.reason && (
                    <div style={{ fontSize: "10.5px", color: textDim, marginTop: 4, fontStyle: "italic" }}>掌柜的话：{it.reason}</div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: "10px", color: "#5a5a4a" }}>
                数值取自百物录，不是 AI 现编的；掌柜只负责挑，挑不出货架上没有的东西。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

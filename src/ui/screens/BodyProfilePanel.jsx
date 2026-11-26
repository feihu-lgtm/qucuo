// 体貌面板：编辑主角身体档案 + 按体貌荐装
// ============================================================================
// 显示原则「不完全显示文本」：列表默认只露每栏前十几个字，点一下才展开成输入框。
// 私密层更进一步——默认整条打码成 •••，要先点「显示」才看得见。这个面板是会在
// 别人面前打开的，不该一开就把私密层摊在屏幕上。
// ============================================================================
import React, { useState } from "react";
import {
  PUBLIC_FIELDS, INTIMATE_FIELDS, BODY_LAYER,
  emptyBodyProfile, bodyProfileFilled, previewText, maskText,
} from "../../domain/rules/character/bodyProfile.js";
import {
  ALL_BODY_PRESETS, BODY_TAG_POOL, applyBodyPreset, appendBodyTag,
} from "../../domain/rules/character/bodyPresets.js";
import ModalShell from "../primitives/ModalShell.jsx";

export default function BodyProfilePanel({
  profile, onChange, onClose, zoneTheme, nsfwOn, onRecommend, recommendState,
}) {
  const [editing, setEditing] = useState(null);      // 当前展开成输入框的 key
  const [showIntimate, setShowIntimate] = useState(false); // 私密层是否揭码
  const [showPresets, setShowPresets] = useState(false);   // 体貌库模板折叠态
  const p = profile || emptyBodyProfile();
  const filled = bodyProfileFilled(p);

  const th = zoneTheme || {};
  const border = th.border || "var(--border)";
  const accent = th.accent || "var(--accent)";
  const textDim = th.textDim || "var(--ink-sage)";

  const inputStyle = {
    width: "100%", background: "var(--bg-panel)", border: `1px solid ${border}`, borderRadius: 0,
    color: "var(--text)", padding: "6px 8px", fontFamily: "inherit", fontSize: "var(--fs-sm)",
    boxSizing: "border-box", lineHeight: 1.6, resize: "vertical",
  };

  const renderField = (f) => {
    const val = p[f.key] || "";
    const isIntimate = f.layer === BODY_LAYER.INTIMATE;
    const hidden = isIntimate && !showIntimate;
    const isEditing = editing === f.key;

    return (
      <div key={f.key} style={{ borderBottom: `1px solid color-mix(in srgb, ${border} 13%, transparent)`, padding: "5px 0" }}>
        <div
          onClick={() => { if (!hidden) setEditing(isEditing ? null : f.key); }}
          style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: hidden ? "default" : "pointer" }}
        >
          <span style={{ width: 60, flexShrink: 0, fontSize: "var(--fs-xs)", color: val ? accent : textDim }}>
            {f.label}
          </span>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", color: val ? "var(--text)" : "var(--body-empty)", minWidth: 0 }}>
            {hidden ? (val ? maskText(val) : "—")
              : isEditing ? ""
              : (previewText(val) || <span style={{ color: "var(--body-empty)" }}>未填</span>)}
          </span>
          {!hidden && (
            <span style={{ fontSize: "var(--fs-2xs)", color: textDim, flexShrink: 0 }}>{isEditing ? "收起" : "编辑"}</span>
          )}
        </div>
        {isEditing && !hidden && (
          <div style={{ marginTop: 5 }}>
            <div style={{ fontSize: "var(--fs-2xs)", color: textDim, marginBottom: 3 }}>{f.def}</div>
            <textarea
              className="body-profile-textarea"
              autoFocus
              value={val}
              placeholder={f.hint || "写你想让 AI 记住的样子，一两句就够"}
              onChange={e => onChange({ ...p, [f.key]: e.target.value })}
              style={{ ...inputStyle, minHeight: 54 }}
            />
            {(BODY_TAG_POOL[f.key] || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {BODY_TAG_POOL[f.key].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onChange({ ...p, [f.key]: appendBodyTag(val, tag) })}
                    style={{
                      background: "var(--bg-panel)",
                      border: `1px solid color-mix(in srgb, ${border} 55%, transparent)`,
                      borderRadius: 0,
                      color: textDim,
                      fontSize: "var(--fs-2xs)",
                      padding: "2px 6px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const picks = recommendState?.picks || [];

  // 原 z 220 并入 screen 档。手机上根节点原本就挂 mobile-overlay-root、面板用自己的
    // body-profile-panel 规则，对应外壳的 custom 形态；标题栏沿用自己的（下边距 8）。
  return (
    <ModalShell onClose={onClose} layer="screen" mobile="custom" showClose={false} ariaLabel="体貌"
      className="body-profile-root" panelClassName="body-profile-panel"
      panelStyle={{ border: `1px solid ${border}`, padding: 18, width: 480, maxWidth: "92vw" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: accent, fontSize: "var(--fs-base)" }}>◈ 体貌</span>
        <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
      </div>

      <div style={{ fontSize: "var(--fs-xs)", color: textDim, lineHeight: 1.7, marginBottom: 10 }}>
        写在这里的样子，动作描写、贴身互动与旁白私聊都会照着写，不会每轮换一副身板。
        点条目展开编辑，留空的栏目一个字都不会发出去。
      </div>

      {/* 体貌库预设 */}
      <div style={{
        border: `1px solid color-mix(in srgb, ${border} 45%, transparent)`,
        padding: "7px 10px", marginBottom: 12,
      }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={showPresets}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowPresets(v => !v); } }}
          onClick={() => setShowPresets(v => !v)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ fontSize: "var(--fs-xs)", color: accent }}>体貌库预设（{ALL_BODY_PRESETS.length} 套成年模板：8 立绘 + 6 江湖）</span>
          <span style={{ fontSize: "var(--fs-2xs)", color: textDim }}>{showPresets ? "收起" : "展开挑选"}</span>
        </div>
        {showPresets && (
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", lineHeight: 1.5 }}>
              默认仅填入公开层 7 项；开启 ■ 模式并揭开私密层后可一键填入完整 12 项。
            </div>
            {ALL_BODY_PRESETS.map((preset) => (
              <div
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  borderTop: `1px solid color-mix(in srgb, ${border} 18%, transparent)`, paddingTop: 6,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text)" }}>{preset.name}</div>
                  <div style={{ fontSize: "var(--fs-2xs)", color: textDim }}>{preset.tag}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onChange(applyBodyPreset(p, preset, { includeIntimate: false }))}
                    style={{
                      background: "var(--bg-panel)", border: `1px solid ${border}`, borderRadius: 0,
                      color: accent, fontSize: "var(--fs-2xs)", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    套公开层
                  </button>
                  {nsfwOn && showIntimate && (
                    <button
                      type="button"
                      onClick={() => onChange(applyBodyPreset(p, preset, { includeIntimate: true }))}
                      style={{
                        background: "var(--bg-panel)", border: "1px solid var(--body-nsfw)", borderRadius: 0,
                        color: "var(--body-nsfw)", fontSize: "var(--fs-2xs)", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      含私密层
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 公开层 */}
      <div style={{ fontSize: "var(--fs-xs)", color: accent, marginBottom: 2 }}>
        公开层 <span style={{ color: textDim, fontSize: "var(--fs-2xs)" }}>· 外人一眼可见 · 已填 {filled.public}/{PUBLIC_FIELDS.length}</span>
      </div>
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginBottom: 4 }}>
        近距离互动（战斗 / 对话 / 查看）与旁白私聊时注入；赶路、结算轮不发。
      </div>
      {PUBLIC_FIELDS.map(renderField)}

      {/* 私密层 */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: nsfwOn ? "var(--body-nsfw)" : textDim }}>
          私密层 <span style={{ color: textDim, fontSize: "var(--fs-2xs)" }}>· 已填 {filled.intimate}/{INTIMATE_FIELDS.length}</span>
        </span>
        <span
          onClick={() => setShowIntimate(v => !v)}
          style={{ marginLeft: "auto", fontSize: "var(--fs-2xs)", color: accent, cursor: "pointer" }}
        >
          {showIntimate ? "◉ 隐藏" : "○ 显示"}
        </span>
      </div>
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", margin: "3px 0 4px" }}>
        {nsfwOn
          ? "■ 模式已开，这一层会随剧情注入。"
          : "■ 模式关着，这一层一个字都不会发给 AI——写了也不发。"}
      </div>
      {INTIMATE_FIELDS.map(renderField)}

      {/* 荐装 */}
      <div style={{ borderTop: `1px solid ${border}`, marginTop: 14, paddingTop: 12 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: accent, marginBottom: 4 }}>按体貌荐装</div>
        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginBottom: 6, lineHeight: 1.7 }}>
          拿你写的体貌去货架上比一遍，挑三件趁手的。
          只告诉你是什么、什么来历、加多少——<span style={{ color: textDim }}>怎么弄到手得自己走一趟</span>。
        </div>
        <span
          onClick={() => { if (!recommendState?.loading) onRecommend?.(); }}
          style={{
            cursor: recommendState?.loading ? "default" : "pointer",
            display: "inline-block", padding: "5px 14px", borderRadius: 0, fontSize: "var(--fs-sm)",
            color: recommendState?.loading ? textDim : "var(--bg-panel)",
            background: recommendState?.loading ? "var(--bg-panel)" : accent,
            border: `1px solid ${recommendState?.loading ? border : accent}`,
          }}
        >
          {recommendState?.loading ? "掌柜正在翻货架…" : "◇ 让掌柜挑三件"}
        </span>

        {recommendState?.error && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-danger)", marginTop: 8 }}>{recommendState.error}</div>
        )}

        {picks.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {picks.map((it, i) => (
              <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 0, padding: "8px 10px", background: "var(--bg-panel)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: "var(--fs-sm)", color: it.qualityColor || "var(--text)" }}>{it.name}</span>
                  <span style={{ fontSize: "var(--fs-2xs)", color: textDim }}>{it.categoryLabel} · {it.quality}档</span>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 4 }}>{it.desc}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: accent }}>{it.statLine}</div>
                {it.reason && (
                  <div style={{ fontSize: "var(--fs-xs)", color: textDim, marginTop: 4, fontStyle: "italic" }}>掌柜的话：{it.reason}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>
              数值取自百物录，不是 AI 现编的；掌柜只负责挑，挑不出货架上没有的东西。
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

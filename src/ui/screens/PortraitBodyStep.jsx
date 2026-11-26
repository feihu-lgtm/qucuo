import React, { useState } from "react";
import { BODY_LAYER, INTIMATE_FIELDS, PUBLIC_FIELDS, bodyProfileFilled } from "../../domain/rules/character/bodyProfile.js";
import {
  ALL_BODY_PRESETS,
  BODY_PRESETS,
  BODY_SNIPPET_GROUPS,
  BODY_TAG_POOL,
  PLAYER_PORTRAIT_PRESETS,
  appendBodyTag,
  applyBodyPreset,
  portraitPresetUrl,
} from "../../domain/rules/character/bodyPresets.js";
import { maskText, previewText } from "../format/bodyProfile.js";
import BodySnippetComposer from "../components/BodySnippetComposer.jsx";

const MODES = [
  { id: "matched", label: "立绘体貌" },
  { id: "library", label: "预设库拼凑" },
  { id: "custom", label: "自行编辑" },
];

export default function PortraitBodyStep({
  base,
  selectedPortraitId,
  bodyProfile,
  onSelectPortrait,
  onBodyChange,
  onBack,
  onContinue,
  theme,
}) {
  const [mode, setMode] = useState("matched");
  const [includeIntimate, setIncludeIntimate] = useState(true);
  const [showIntimateEdit, setShowIntimateEdit] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [activePresetName, setActivePresetName] = useState(
    () => (PLAYER_PORTRAIT_PRESETS.find((item) => item.id === selectedPortraitId) || PLAYER_PORTRAIT_PRESETS[0]).name,
  );

  const selectedPortrait = PLAYER_PORTRAIT_PRESETS.find((item) => item.id === selectedPortraitId) || PLAYER_PORTRAIT_PRESETS[0];
  const filled = bodyProfileFilled(bodyProfile);
  const border = theme.border || "var(--gold-deep)";
  const accent = theme.accent || "var(--accent)";

  const pickPortrait = (preset) => {
    setActivePresetName(preset.name);
    onSelectPortrait(preset, { includeIntimate });
  };

  const applyFromLibrary = (preset) => {
    setActivePresetName(preset.name);
    onBodyChange(applyBodyPreset(bodyProfile, preset, { includeIntimate }));
  };

  // 只切开关：之后切立绘或套预设时才连带填私密层，不回头覆盖已改的公开层。
  const toggleIncludeIntimate = () => setIncludeIntimate((v) => !v);
  const onKeyActivate = (fn) => (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };

  const renderFieldRow = (field) => {
    const val = bodyProfile?.[field.key] || "";
    const isIntimate = field.layer === BODY_LAYER.INTIMATE;
    const hidden = isIntimate && !showIntimateEdit;
    const isEditing = editingKey === field.key;
    return (
      <div
        key={field.key}
        style={{
          borderBottom: `1px solid color-mix(in srgb, ${border} 25%, transparent)`,
          padding: "5px 0",
        }}
      >
        <div
          role={hidden ? undefined : "button"}
          tabIndex={hidden ? undefined : 0}
          aria-expanded={hidden ? undefined : isEditing}
          onKeyDown={hidden ? undefined : onKeyActivate(() => setEditingKey(isEditing ? null : field.key))}
          onClick={() => { if (!hidden) setEditingKey(isEditing ? null : field.key); }}
          style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: hidden ? "default" : "pointer" }}
        >
          <span style={{ width: 56, flexShrink: 0, fontSize: "var(--fs-xs)", color: val ? accent : "var(--muted)" }}>
            {field.label}
          </span>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", color: val ? "var(--create-input-text)" : "var(--muted)", minWidth: 0 }}>
            {hidden ? (val ? maskText(val) : "未填") : isEditing ? "" : (previewText(val, 22) || "未填")}
          </span>
          {!hidden && (
            <span style={{ fontSize: "var(--fs-2xs)", color: "var(--muted)", flexShrink: 0 }}>
              {isEditing ? "收起" : "编辑"}
            </span>
          )}
        </div>
        {isEditing && !hidden && (
          <div style={{ marginTop: 5 }}>
            <textarea
              className="character-create-body-input"
              value={val}
              placeholder={field.hint || field.def}
              onChange={(e) => onBodyChange({ ...bodyProfile, [field.key]: e.target.value })}
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 52, resize: "vertical",
                background: "rgba(0,0,0,0.45)", border: `1px solid ${border}`, borderRadius: 0,
                color: "var(--create-input-text)", padding: "6px 8px", fontSize: "var(--fs-sm)",
                lineHeight: 1.55, fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {(BODY_TAG_POOL[field.key] || []).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onBodyChange({ ...bodyProfile, [field.key]: appendBodyTag(val, tag) })}
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid color-mix(in srgb, ${border} 55%, transparent)`,
                    borderRadius: 0, color: "var(--ink-tan)", fontSize: "var(--fs-2xs)",
                    padding: "3px 6px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="character-create-appearance">
      <div className="character-create-appearance-layout">
        {/* 左 / 上：8 张开局立绘 */}
        <div className="character-create-portrait-col">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ color: "var(--ink-tan)", fontSize: "var(--fs-sm)", letterSpacing: "1px" }}>
              选定立绘（8 选 1）
            </span>
            <span style={{ color: accent, fontSize: "var(--fs-xs)" }}>{selectedPortrait.name}</span>
          </div>
          <div className="character-create-portrait-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            {PLAYER_PORTRAIT_PRESETS.map((preset) => {
              const active = preset.id === selectedPortraitId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickPortrait(preset)}
                  className="character-create-portrait-btn"
                  style={{
                    position: "relative", padding: 0, aspectRatio: "2 / 3", overflow: "hidden",
                    border: active ? `2px solid ${accent}` : `1px solid color-mix(in srgb, ${border} 70%, transparent)`,
                    borderRadius: 0, background: "var(--create-dark)", cursor: "pointer",
                  }}
                >
                  <img
                    src={portraitPresetUrl(preset, base)}
                    alt={preset.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <span style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    padding: "2px 3px", fontSize: "var(--fs-2xs)", lineHeight: 1.25,
                    background: "rgba(10,8,6,0.78)", color: active ? accent : "var(--create-input-text)",
                    textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右 / 下：体貌模式与内容 */}
        <div className="character-create-body-col">
          <div className="character-create-mode-tabs" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {MODES.map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(item.id)}
                  style={{
                    flex: 1, padding: "6px 4px", fontSize: "var(--fs-sm)", fontFamily: "inherit",
                    borderRadius: 0, cursor: "pointer",
                    border: `1px solid ${active ? accent : border}`,
                    background: active ? "rgba(212,168,83,0.16)" : "rgba(0,0,0,0.35)",
                    color: active ? accent : "var(--ink-tan)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div
            role="switch"
            tabIndex={0}
            aria-checked={includeIntimate}
            onKeyDown={onKeyActivate(toggleIncludeIntimate)}
            onClick={toggleIncludeIntimate}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: "var(--fs-xs)", color: includeIntimate ? "var(--body-nsfw)" : "var(--muted)",
              marginBottom: 8, cursor: "pointer", userSelect: "none",
            }}
          >
            <span>{includeIntimate ? "◉" : "○"} 切模板时连带填入私密层（■模式开启才注入）</span>
            <span style={{ color: "var(--muted)" }}>已填 {filled.public}/7 · 私密 {filled.intimate}/5</span>
          </div>

          <div className="character-create-body-scroll" style={{ maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
            {mode === "matched" && (
              <div style={{ fontSize: "var(--fs-sm)", lineHeight: 1.65, color: "var(--create-input-text)" }}>
                <div style={{ color: accent, fontSize: "var(--fs-xs)", marginBottom: 4 }}>
                  当前体貌：{activePresetName}（{selectedPortrait.tag}）
                </div>
                {PUBLIC_FIELDS.map((field) => (
                  <div key={field.key} style={{ marginBottom: 3 }}>
                    <span style={{ color: "var(--ink-tan)" }}>{field.label}：</span>
                    <span>{bodyProfile?.[field.key] || "未填"}</span>
                  </div>
                ))}
                {showIntimateEdit && (
                  <>
                    <div className="body-intimate-preview-head">
                      私密设定（默认开启并按当前形象预制）
                    </div>
                    {INTIMATE_FIELDS.map((field) => (
                      <div key={field.key} className="body-intimate-preview-row">
                        <span className="body-intimate-preview-label">{field.label}：</span>
                        <span>{bodyProfile?.[field.key] || "未填"}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {mode === "library" && (
              <div style={{ display: "grid", gap: 6 }}>
                <BodySnippetComposer
                  groups={BODY_SNIPPET_GROUPS}
                  onAppend={appendBodyTag}
                  bodyProfile={bodyProfile}
                  onBodyChange={onBodyChange}
                />
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: 4 }}>
                  或整套套用（8 张立绘体貌 + {BODY_PRESETS.length} 套江湖模板）：
                </div>
                {ALL_BODY_PRESETS.map((preset) => {
                  const chosen = activePresetName === preset.name;
                  return (
                    <div
                      key={preset.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        padding: "5px 8px",
                        border: `1px solid color-mix(in srgb, ${chosen ? accent : border} 55%, transparent)`,
                        background: chosen ? "rgba(212,168,83,0.1)" : "rgba(0,0,0,0.28)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "var(--fs-sm)", color: chosen ? accent : "var(--create-input-text)" }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--muted)" }}>{preset.tag}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyFromLibrary(preset)}
                        style={{
                          flexShrink: 0, padding: "4px 8px", fontSize: "var(--fs-xs)", fontFamily: "inherit",
                          border: `1px solid ${accent}`, borderRadius: 0,
                          background: "rgba(0,0,0,0.4)", color: accent, cursor: "pointer",
                        }}
                      >
                        套用
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {mode === "custom" && (
              <div>
                <div style={{ fontSize: "var(--fs-xs)", color: accent, marginBottom: 2 }}>公开层（7 项）</div>
                {PUBLIC_FIELDS.map(renderFieldRow)}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 2 }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--body-nsfw)" }}>私密层（5 项 · 仅 ■ 模式注入）</span>
                  <button
                    type="button"
                    onClick={() => setShowIntimateEdit((v) => !v)}
                    style={{
                      background: "transparent", border: "none", color: accent,
                      fontSize: "var(--fs-xs)", cursor: "pointer", fontFamily: "inherit", padding: 0,
                    }}
                  >
                    {showIntimateEdit ? "◉ 隐藏" : "○ 显示并编辑"}
                  </button>
                </div>
                {INTIMATE_FIELDS.map(renderFieldRow)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="character-create-step-actions" style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: "0 0 auto", padding: "11px 14px", borderRadius: 0,
            border: `1px solid ${border}`, background: "rgba(0,0,0,0.38)",
            color: "var(--ink-tan)", fontSize: "var(--fs-md)", fontFamily: "inherit", cursor: "pointer",
          }}
        >
          ← 上一步
        </button>
        <button
          type="button"
          onClick={onContinue}
          style={{
            flex: 1, border: "none", textAlign: "center", borderRadius: 0,
            background: `linear-gradient(180deg, ${accent}, var(--create-button-bottom))`,
            color: "var(--create-dark)", fontSize: "var(--fs-lg)", fontWeight: "bold",
            letterSpacing: "2px", padding: "11px 0", fontFamily: "inherit", cursor: "pointer",
          }}
        >
          下一步：分配七维 ▸
        </button>
      </div>
    </div>
  );
}

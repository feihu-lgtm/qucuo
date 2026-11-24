// 入册审改 · 「新造一件」面板（从 CarryPicker.jsx 拆出）
// ============================================================================
// 造一件百物录里没有的东西：名/类别/品阶/六维/攻防倍率/攻击特效/描述全手调，
// 描述可让 AI 按名字品阶写两三句。造出来的东西只属于这个人，不进百物录。

import React from "react";
import { SEVEN, TIERS, selStyle } from "./widgets.jsx";
import { statsForQuality } from "../../../domain/rules/economy/equipment.js";
import {
  CAT_LABEL, ITEM_EFFECT_CHOICES, effectHas, toggleItemEffect, blankDraft,
} from "./carryItemModel.js";

export default function ItemForgePane({ draft, setDraft, cat, levelCap, apiCfg, aiBusy, onAskAi, onAdd, onClose }) {
  return (
    <div style={{ marginBottom: 7, padding: "8px 10px", borderRadius: 0, border: "1px solid var(--music-idle-icon)", background: "rgba(120,180,130,.05)" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={draft.name} placeholder="物件名"
          onChange={e => setDraft(d => ({ ...d, name: e.target.value.slice(0, 20) }))}
          style={{ ...selStyle, flex: 1, textAlign: "center" }} />
        <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
          style={{ ...selStyle, width: 84 }}>
          {["weapon", "armor", "accessory", "misc"].map(c => (
            <option key={c} value={c} style={{ background: "var(--bg-deep)" }}>
              {CAT_LABEL[c]}
            </option>
          ))}
        </select>
        <select value={draft.quality} onChange={e => setDraft(d => ({ ...d, quality: e.target.value }))}
          style={{ ...selStyle, width: 72 }}>
          {TIERS.map(t => (
            <option key={t.label} value={t.label} style={{ background: "var(--bg-deep)", color: t.color }}>{t.label}档</option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginBottom: 3 }}>
        六维加成 · 点数字改，0 就是不加（百物录里 139 件带这个，多是 +1 到 +2）
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        {SEVEN.map(k => {
          const v = draft.sixDim?.[k] || 0;
          return (
            <span key={k} onClick={() => setDraft(d => {
              const next = { ...(d.sixDim || {}) };
              const nv = v >= 3 ? 0 : v + 1;
              if (nv) next[k] = nv; else delete next[k];
              return { ...d, sixDim: next };
            })}
              style={{
                cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 0,
                border: `1px solid ${v ? "var(--green-soft)" : "var(--bg-card)"}`,
                color: v ? "var(--ci-pick)" : "var(--muted)",
              }}>{k}{v ? ` +${v}` : ""}</span>
          );
        })}
      </div>

      {/* 攻防倍率：兵器调 atkMul、护具调 defMul，显示成品攻击/防御力 */}
      {(draft.category === "weapon" || draft.category === "armor") && (
        <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
          {draft.category === "weapon" && (() => {
            const base = statsForQuality("weapon", draft.quality).atk ?? 0;
            const mul = draft.atkMul ?? 1;
            return (
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>
                  攻击力 {Math.round(base * mul)} · 倍率 {mul.toFixed(2)}
                </span>
                <input type="range" min={1} max={1.6} step={0.05} value={mul}
                  onChange={e => setDraft(d => ({ ...d, atkMul: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "var(--attr-waigong-tag)" }} />
              </label>
            );
          })()}
          {draft.category === "armor" && (() => {
            const base = statsForQuality("armor", draft.quality).def ?? 0;
            const mul = draft.defMul ?? 1;
            return (
              <label style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>
                  防御力 {Math.round(base * mul)} · 倍率 {mul.toFixed(2)}
                </span>
                <input type="range" min={1} max={1.6} step={0.05} value={mul}
                  onChange={e => setDraft(d => ({ ...d, defMul: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "var(--footer-hint-title)" }} />
              </label>
            );
          })()}
        </div>
      )}

      {/* 攻击特效：跟详情面板同一份可勾选清单 */}
      <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginBottom: 3 }}>攻击特效 · 点一下加上/去掉</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        {ITEM_EFFECT_CHOICES.map(choice => {
          const on = effectHas(draft, choice.key);
          return (
            <span key={choice.key} onClick={() =>
                setDraft(d => ({ ...d, effect: toggleItemEffect(d, choice) }))}
              title={`${choice.def === true ? "" : `默认 ${JSON.stringify(choice.def)} `}装备时叠到招式上`}
              style={{
                cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 0,
                border: `1px solid ${on ? "var(--green-soft)" : "var(--bg-card)"}`,
                color: on ? "var(--ci-pick)" : "var(--muted)",
                background: on ? "rgba(138,176,112,.12)" : "transparent",
              }}>{choice.label}</span>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", flex: 1 }}>描述</span>
        {apiCfg && (
          <span onClick={onAskAi}
            title={draft.name ? "让 AI 照名字与品阶写两三句" : "先起个名"}
            style={{
              cursor: draft.name && !aiBusy ? "pointer" : "default", fontSize: 10,
              color: draft.name && !aiBusy ? "var(--ink-info)" : "var(--building-desc)",
            }}>{aiBusy ? "写着…" : "✎ 让 AI 写"}</span>
        )}
      </div>
      <textarea rows={3} value={draft.desc}
        placeholder="自己写，或让 AI 写完再改"
        onChange={e => setDraft(d => ({ ...d, desc: e.target.value.slice(0, 200) }))}
        style={{ ...selStyle, width: "100%", textAlign: "left", resize: "vertical", lineHeight: 1.7 }} />

      <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-text-dim)", flex: 1 }}>
          造出来的东西只属于这个人，不进百物录
        </span>
        <span onClick={() => setDraft(blankDraft(cat, levelCap))}
          style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-text-dim)" }}>清空</span>
        <span
          onClick={() => {
            const nm = (draft.name || "").trim();
            if (!nm) return;
            onAdd({ ...draft, name: nm, custom: true });
            setDraft(blankDraft(cat, levelCap));
            onClose();
          }}
          style={{
            cursor: draft.name.trim() ? "pointer" : "default", fontSize: 11,
            padding: "4px 12px", borderRadius: 0, fontWeight: 700,
            color: draft.name.trim() ? "var(--bg-deep)" : "var(--muted)",
            background: draft.name.trim() ? "linear-gradient(180deg,var(--tutorial-move),var(--ink-good))" : "rgba(0,0,0,.3)",
            border: `1px solid ${draft.name.trim() ? "var(--tutorial-move)" : "var(--border-deep)"}`,
          }}>⚒ 造好，收进他身上</span>
      </div>
    </div>
  );
}

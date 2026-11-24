// 入册审改 · 招式编辑器（从 ReviewNpc.jsx 拆出）
import React, { useState, useMemo } from "react";
import { TIERS, Src, selStyle } from "./widgets.jsx";
import { MOVE_ARCHETYPE_IDS, MOVE_SLOTS, SLOT_DEFAULT_ARCHETYPE } from "../../../domain/rules/cards/scanPrompts.js";
import { MOVE_ARCHETYPES, resolveArchetype } from "../../../domain/rules/combat/moveArchetypes.js";
import { EFFECT_LABEL, fmtEffectValue } from "./reviewShared.js";

// ── 招式编辑器 ────────────────────────────────────────────────────────────────

/**
 * 【为什么是「选原型 + 起名」而不是「勾十几个标志位」】
 * 本作的招式效果由 原型 × 品阶 自动解出（见 combat/moveArchetypes.js）：同一个
 * 「防守反击」，白档只是挡一下，红档是听桥——近乎全免＋满反打＋抢先结算。
 * 所以玩家该决定的是"这人走哪条路数"，不是逐个数值。改品阶，招式会跟着变强变弱。
 * 底下那块「本档实际效果」把解出来的数值摊开给你看，不用猜。
 */
export default function MoveEditor({ moves, levelCap, onChange, why, source }) {
  const [open, setOpen] = useState(null);
  const slots = useMemo(() => {
    const base = [...MOVE_SLOTS];
    if (moves && moves["疗伤"]) base.push("疗伤");
    return base;
  }, [moves]);

  const setSlot = (slot, patch) => onChange({ ...moves, [slot]: { ...(moves?.[slot] || {}), ...patch } });

  return (
    <div>
      {slots.map(slot => {
        const m = moves?.[slot] || {};
        const arch = m.archetype || SLOT_DEFAULT_ARCHETYPE[slot];
        const resolved = resolveArchetype(arch, levelCap) || {};
        const isOpen = open === slot;
        const type = MOVE_ARCHETYPES[arch]?.type || "—";
        return (
          <div key={slot} style={{ marginBottom: 7, padding: "7px 9px", borderRadius: 0, background: "rgba(0,0,0,.22)", border: "1px solid var(--bg-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{ width: 30, fontSize: 11, color: "var(--ink-warn)", flexShrink: 0 }}>{slot}</span>
              <input value={m.name || ""} placeholder={`${arch}（未起名）`}
                onChange={e => setSlot(slot, { name: e.target.value.slice(0, 10) })}
                style={{ ...selStyle, flex: 1, textAlign: "center" }} />
              {/* 回气槽固定走「回气」原型，不给选——它是能量枯竭时的保底招 */}
              {slot === "回气" ? (
                <span style={{ width: 86, textAlign: "center", fontSize: 11, color: "var(--ink-text-dim)" }}>回气</span>
              ) : (
                <select value={arch} onChange={e => setSlot(slot, { archetype: e.target.value })}
                  style={{ ...selStyle, width: 86 }}>
                  {MOVE_ARCHETYPE_IDS.map(a => (
                    <option key={a} value={a} style={{ background: "var(--bg-deep)" }}>{a}</option>
                  ))}
                </select>
              )}
              <span onClick={() => setOpen(isOpen ? null : slot)}
                title="看这一档解出来的实际效果"
                style={{ cursor: "pointer", fontSize: 10, color: "var(--ink-info)", flexShrink: 0 }}>
                {isOpen ? "收起" : "数值"}
              </span>
            </div>
            <input value={m.desc || ""} placeholder="一句话写这招看起来什么样（会注入给说书人）"
              onChange={e => setSlot(slot, { desc: e.target.value.slice(0, 60) })}
              style={{ ...selStyle, textAlign: "left", fontSize: 10.5, color: "var(--ink-text)" }} />
            {isOpen && (
              <div style={{ marginTop: 6, padding: "6px 8px", background: "var(--bg-ink)", border: "1px solid var(--ink-border)", borderRadius: 0 }}>
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--inject-kind-fallback)", marginBottom: 4, fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>
                  {arch} × {TIERS[levelCap]?.label}档 → 类型 {type}
                </div>
                {Object.entries(resolved).filter(([k]) => k !== "type").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", fontSize: 10, color: "var(--tavern-steam)", lineHeight: 1.6 }}>
                    <span style={{ width: 108, color: "var(--ink-sage)", flexShrink: 0 }}>{EFFECT_LABEL[k] || k}</span>
                    <span style={{ color: "var(--ink-info)" }}>{fmtEffectValue(v)}</span>
                  </div>
                ))}
                <div style={{ fontSize: "var(--fs-2xs)", color: "var(--inject-kind-fallback)", marginTop: 5 }}>
                  这些数值由原型和品阶算出，改品阶会整套跟着变，不用手填。
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        {!moves?.["疗伤"] ? (
          <span onClick={() => setSlot("疗伤", { archetype: "疗伤", name: "", desc: "" })}
            title="第五招，只有会运功回血的人才配"
            style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-muted)" }}>＋ 加一个疗伤招</span>
        ) : (
          <span onClick={() => { const n = { ...moves }; delete n["疗伤"]; onChange(n); }}
            style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-muted)" }}>− 去掉疗伤招</span>
        )}
        <span style={{ flex: 1 }} />
        {why ? <span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-text-dim)", fontStyle: "italic" }}>据「{why}」</span> : null}
        <Src source={source} />
      </div>
    </div>
  );
}


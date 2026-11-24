// 入册审改 · 随身物详情面板（从 CarryPicker.jsx 拆出）
// ============================================================================
// 点随身物名字展开。显示描述/伤害/攻击特效/六维；自造物可改，
// 在册物只读（数值由百物录裁决，改它等于改全世界的设定）。

import React from "react";
import { CATALOG } from "../../../domain/data/items/catalog.js";
import { effectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import {
  nameOf, CAT_LABEL, ITEM_EFFECT_CHOICES, effectHas, toggleItemEffect,
  computeAtk, computeDef,
} from "./carryItemModel.js";

export default function ItemDetailPane({ item, onClose, onPatch }) {
  const custom = typeof item !== "string";
  const catEntry = !custom ? CATALOG.find(e => e.name === item) : null;
  const quality = custom ? item.quality : (catEntry?.quality || "白");
  const category = custom ? item.category : (catEntry?.category || "misc");
  const atk = computeAtk(item);
  const def = computeDef(item);
  const sixDim = custom && item.sixDim ? Object.entries(item.sixDim).filter(([, v]) => v) : [];
  const desc = custom ? item.desc : (catEntry?.desc || "");
  const effectText = custom
    ? effectBrief(item.effect, item.sixDim)
    : effectBrief(catEntry?.effect, catEntry?.sixDim);
  return (
    <div style={{ marginBottom: 7, padding: "8px 10px", borderRadius: 0, border: "1px solid var(--service-card-edge)", background: "rgba(0,0,0,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color: "var(--paper)", fontSize: 12 }}>{nameOf(item)}</span>
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--quest-stage-desc)" }}>
          {CAT_LABEL[category] || category} · {quality}档
        </span>
        <span style={{ flex: 1 }} />
        <span onClick={onClose} style={{ cursor: "pointer", fontSize: 10, color: "var(--ink-text-dim)" }}>收起</span>
      </div>

      {/* 伤害 / 防御 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {atk != null && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--attr-waigong-tag)" }}>
            攻击力 <span style={{ color: "var(--service-item-name)", fontWeight: 700 }}>{atk}</span>
            {custom && category === "weapon" && (
              <span style={{ marginLeft: 6, color: "var(--ink-text-dim)", fontSize: 9.5 }}>
                倍率
                <input type="number" step={0.05} min={1} max={1.6}
                  value={item.atkMul ?? 1}
                  onChange={e => onPatch(nameOf(item), { atkMul: Math.max(1, Math.min(1.6, Number(e.target.value) || 1)) })}
                  style={{ width: 46, marginLeft: 4, textAlign: "center", background: "rgba(0,0,0,.4)", border: "1px solid var(--border-deep)", borderRadius: 0, color: "var(--service-item-name)", fontSize: 10 }} />
              </span>
            )}
          </div>
        )}
        {def != null && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--footer-hint-title)" }}>
            防御力 <span style={{ color: "var(--ink-sky-soft)", fontWeight: 700 }}>{def}</span>
            {custom && category === "armor" && (
              <span style={{ marginLeft: 6, color: "var(--ink-text-dim)", fontSize: 9.5 }}>
                倍率
                <input type="number" step={0.05} min={1} max={1.6}
                  value={item.defMul ?? 1}
                  onChange={e => onPatch(nameOf(item), { defMul: Math.max(1, Math.min(1.6, Number(e.target.value) || 1)) })}
                  style={{ width: 46, marginLeft: 4, textAlign: "center", background: "rgba(0,0,0,.4)", border: "1px solid var(--border-deep)", borderRadius: 0, color: "var(--ink-sky-soft)", fontSize: 10 }} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* 描述：自造物可改，在册物只读 */}
      {custom ? (
        <textarea rows={2}
          value={item.desc || ""}
          placeholder="写它什么样、什么手感或什么来历"
          onChange={e => onPatch(nameOf(item), { desc: e.target.value.slice(0, 200) })}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,.35)", border: "1px solid var(--border-deep)", borderRadius: 0, padding: "5px 8px", color: "var(--ink-text)", fontSize: 10.5, lineHeight: 1.7, resize: "vertical", fontFamily: "inherit" }} />
      ) : (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text)", lineHeight: 1.6 }}>
          {desc || "在册物品，运行时按名字查百物录补全数值与词条。"}
        </div>
      )}

      {/* 攻击特效：自造物可勾选，在册物只读列出 */}
      {custom ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginBottom: 4 }}>攻击特效 · 点一下加上/去掉</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {ITEM_EFFECT_CHOICES.map(choice => {
              const on = effectHas(item, choice.key);
              return (
                <span key={choice.key} onClick={() => onPatch(nameOf(item), { effect: toggleItemEffect(item, choice) })}
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
        </div>
      ) : (
        effectText && (
          <div style={{ marginTop: 5, fontSize: 10, color: "var(--green-soft)" }}>特效：{effectText}</div>
        )
      )}

      {sixDim.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--green-soft)" }}>加成：{sixDim.map(([k, v]) => `${k}+${v}`).join("、")}</div>
      )}
    </div>
  );
}

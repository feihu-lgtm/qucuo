// 入册审改 · 落脚（从 ReviewNpc.jsx 拆出）
import React, { useState } from "react";
import { S, Note, Pills, selStyle } from "./widgets.jsx";
import { PLACEMENT_LABEL, PLACEMENT_HINT } from "./reviewShared.js";
import { DISTRICTS } from "../../../domain/rules/cards/reviewRules.js";
import { hasInnerMap, getPublicInnerRoomNames } from "../../../domain/rules/map/innerMap.js";
import { buildPlacementPlan, sanitizePlacementPlan, PLAN_MAX_TOKENS } from "../../../domain/rules/cards/placementPlan.js";
import { acquire } from "../../../domain/rules/cards/rateLimiter.js";
import { callCardModel } from "../../../engine/ports/cardScan/scanCalls.js";
import { normalizePlacement } from "../../../domain/rules/cards/importedRegistry.js";
import { parseJsonLoose } from "../../../domain/rules/cards/scanPrompts.js";

// ── 落脚 ──────────────────────────────────────────────────────────────────────

export default function Placement({ value, onChange, accent, npc, apiCfg, why, rejected, onPlan, currentDistrict }) {
  const pl = normalizePlacement(value);
  const rooms = pl.district && hasInnerMap(pl.district) ? getPublicInnerRoomNames(pl.district) : [];
  // 手动改过之后 AI 那句依据就过期了——留着会误导（它说「镇上开铁铺」而你已经
  // 改成了不落地）。所以任何手动改动都把依据一并清掉。
  const set = (patch) => onChange({ ...pl, ...patch });
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [err, setErr] = useState("");

  // AI 只定「谁待在哪」，据点名从 DISTRICTS 里挑，回来的东西过一遍
  // sanitizePlacementPlan 白名单过滤。内层房间它不管，玩家自己在下拉里点。
  const askAiPlace = async () => {
    if (busy || !npc?.name) return;
    setBusy(true); setErr(""); setWait(0);
    try {
      await acquire(ms => setWait(Math.ceil(ms / 1000)));
      setWait(0);
      const { system, user } = buildPlacementPlan([npc], DISTRICTS);
      const res = await callCardModel(apiCfg, system, user,
        { maxTokens: PLAN_MAX_TOKENS.single, temperature: 0.6, callLabel: "卡面单个落脚" });
      const plans = sanitizePlacementPlan(parseJsonLoose(res.text || ""), [npc], DISTRICTS);
      if (!plans.length) { setErr("AI 没给出认得出的安排，再点一次试试"); return; }
      onPlan?.(plans[0].placement, plans[0].why, plans[0].rejected);
    } catch (e) {
      // 把模型实际吐出来的开头一并显示。只报 message 的话，「不是合法 JSON」和
      // 「被截断」看起来一样，而两者的补救办法相反（前者改提示词，后者调额度）。
      const raw = e?.raw ? `　模型吐的是：${String(e.raw).replace(/\s+/g, " ").slice(0, 50)}` : "";
      setErr(`${String(e?.message || e).slice(0, 70)}${raw}`);
    } finally {
      setBusy(false); setWait(0);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Pills accent={accent} value={pl.mode} onChange={m => {
          // 【为什么切驻场/游走要立刻塞个默认据点·这是"点不动"的真因】
          // 上面 pl = normalizePlacement(value)，而 normalizePlacement 有一条硬规则：
          // resident 没 district、wander 没 weights，一律退回 mention。于是点「驻场」
          // 时若据点还空着，切过去的 resident 会被当场 normalize 回 mention——Pills 的
          // 高亮瞬间弹回「不落地」，玩家看到的就是"点了没反应、点不动"（光标是手型、
          // 点击也触发了，只是被 normalize 吃掉）。所以切到 resident/wander 必须同时给
          // 一个默认据点让它站得住；据点下拉/权重照旧能改。开局前 currentDistrict 为空，
          // 退而取清单第一个。
          const patch = { mode: m };
          const fallback = DISTRICTS.includes(currentDistrict) ? currentDistrict : DISTRICTS[0];
          if (m === "resident" && !pl.district) patch.district = fallback;
          if (m === "wander" && !Object.keys(pl.weights || {}).length) patch.weights = { [fallback]: 50 };
          set(patch);
        }}
          options={["mention", "resident", "wander"].map(m => ({ value: m, label: PLACEMENT_LABEL[m] }))} />
        {/* 紧跟三个模式钮，不用 spacer 顶到天边——4:6 分栏后右栏有上千像素宽，
            顶到最右就成了一个跟谁都不相干的孤零零按钮（实测截图如此） */}
        <span onClick={askAiPlace} title="让 AI 按人设判断该驻场还是游走，据点只能从本作地图里选"
          style={{
            cursor: busy ? "wait" : "pointer", userSelect: "none",
            fontSize: 11, padding: "4px 11px", borderRadius: 0, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: busy ? "var(--ink-sage)" : "var(--tutorial-move)",
            border: `1px solid ${busy ? "var(--music-idle-icon)" : "var(--temple-full)"}`,
            background: busy ? "rgba(0,0,0,.3)"
              : "linear-gradient(180deg,rgba(130,180,120,.16),rgba(0,0,0,.32))",
          }}>
          <img src={S("ui/star.webp")} alt="" style={{ width: 11, height: 11, opacity: busy ? .4 : .9 }} />
          {busy ? (wait ? `排队 ${wait}s` : "正在相地…") : "AI 荐位"}
        </span>
      </div>

      {pl.mode === "resident" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-muted)", marginBottom: 3 }}>据点</span>
            <select value={pl.district || ""} onChange={e => set({ district: e.target.value || null, innerRoom: null })} style={selStyle}>
              <option value="" style={{ background: "var(--bg-deep)" }}>（未选，等同不落地）</option>
              {DISTRICTS.map(d => <option key={d} value={d} style={{ background: "var(--bg-deep)" }}>{d}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-muted)", marginBottom: 3 }}>
              常在哪间{rooms.length ? "" : "（无内层）"}
            </span>
            <select value={pl.innerRoom || ""} disabled={!rooms.length}
              onChange={e => set({ innerRoom: e.target.value || null })} style={selStyle}>
              <option value="" style={{ background: "var(--bg-deep)" }}>不限</option>
              {rooms.map(r => <option key={r} value={r} style={{ background: "var(--bg-deep)" }}>{r}</option>)}
            </select>
          </label>
        </div>
      )}
      {pl.mode === "wander" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", marginBottom: 4 }}>出现在哪些据点 · 点一下加二十五，满了归零</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {DISTRICTS.map(d => {
              const w = pl.weights?.[d] || 0;
              return (
                <span key={d} onClick={() => {
                  const next = { ...(pl.weights || {}) };
                  const nw = w >= 100 ? 0 : w + 25;
                  if (nw > 0) next[d] = nw; else delete next[d];
                  set({ weights: next });
                }}
                  style={{
                    cursor: "pointer", fontSize: 10.5, padding: "3px 8px", borderRadius: 0,
                    border: `1px solid ${w > 0 ? accent : "var(--bg-card)"}`,
                    background: w > 0 ? `rgba(212,168,83,${0.06 + w / 500})` : "transparent",
                    color: w > 0 ? "var(--paper)" : "var(--ink-text-dim)",
                  }}>{d}{w > 0 ? ` ${w}` : ""}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-muted)" }}>
            <span>时辰</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[0]}
              onChange={e => set({ timeSlot: [Number(e.target.value), pl.timeSlot[1]] })}
              style={{ ...selStyle, width: 52 }} />
            <span>到</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[1]}
              onChange={e => set({ timeSlot: [pl.timeSlot[0], Number(e.target.value)] })}
              style={{ ...selStyle, width: 52 }} />
            <span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-text-dim)" }}>（0-23 时，跨夜请分两次入册）</span>
          </div>
        </div>
      )}

      {/* AI 的判断依据。撕纸条底，跟随身物那边自造物品的提示同一套视觉 */}
      {why ? (
        <div style={{
          marginTop: 9, marginBottom: 6, padding: "9px 14px",
          backgroundImage: `url('${S("ui/note_torn.webp")}')`,
          backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          boxShadow: "0 2px 6px rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "var(--fs-2xs)", color: "var(--good)", border: "1px solid var(--skill-learned)",
          borderRadius: 0, padding: "0 4px", flexShrink: 0, }}>AI 荐位</span>
          <span style={{ fontSize: "var(--fs-xs)", lineHeight: 1.6, color: "var(--map-title-text)" }}>{why}</span>
          {rejected && (
            <span style={{ fontSize: "var(--fs-2xs)", color: "var(--qb-status-edge)" }}>
              · 它给的据点不在本作地图里，已退回不落地，请自己选
            </span>
          )}
        </div>
      ) : null}
      {err ? <Note tone="bad">{err}</Note> : null}

      <Note tone="info">{PLACEMENT_HINT[pl.mode]}</Note>
    </div>
  );
}


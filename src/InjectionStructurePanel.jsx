// Prompt 注入结构（只读）
// ============================================================================
// 按「act 的动作分类」逐块看这一轮到底往 AI 嘴里塞了什么。
//
// 三条原则：
//  1. **不拼全文**。一次性把三千字 sys 糊成一坨，等于没给——要一块一块看，
//     点开哪块看哪块。
//  2. **显示真原文，不显示抄本**。静态块的字直接来自 enginePrompts.js，
//     跟 buildSysBase 用的是同一份常量；面板和真正喂出去的不可能漂移。
//  3. **只读**。这里是"看清楚喂了什么"的地方，不是编辑器。改文案去预设那边。
//
// 动态块（状态串/召回/事实账本）没有固定文本，默认显示字段模板；点「拉取目前」
// 才去主引擎抓当前这一局的真值。做成按钮而不是常驻，一是面板在开局前也能打开、
// 二是不必为了看结构就把一堆实时状态常驻绑进来。
// ============================================================================
import React, { useState } from "react";
import {
  ACTION_VIEWS, blocksForAction, KIND_META, CONSTRAINT_FIELDS,
  STATIC_TEXT_KEYS, schemaKeyFor,
  giftSettleLawExample, giftNarrativeLawExample,
} from "./injectionBlocks.js";
import * as ENGINE from "./enginePrompts.js";
import { buildExtractionSpecExample } from "./extractionEngine.js";
import { getTraceLog } from "./actionTrace.js";
import { getPositionMeta } from "./tavernMapping.js";

export default function InjectionStructurePanel({ getLiveBlockText, extractionEnabled }) {
  const [viewMode, setViewMode] = useState("tavern"); // "tavern" = 13 位置 / "action" = 动作分类
  const [actionId, setActionId] = useState("look");
  const [openBlock, setOpenBlock] = useState(null);
  const [live, setLive] = useState({});     // blockId -> 当前局真值
  const [liveErr, setLiveErr] = useState("");
  // 单调用/双调用切换：默认跟随设置里实际生效的 extractionEnabled，玩家也可以在
  // 面板里手动切换来对比"如果开/关双调用，这个动作分类的注入结构会有什么不同"，
  // 不强制跟设置联动，方便对照学习两种架构的差异。
  const [mode, setMode] = useState(extractionEnabled ? "dual" : "single");

  const view = ACTION_VIEWS.find(v => v.id === actionId) || ACTION_VIEWS[0];
  const blocks = blocksForAction(actionId, mode);
  const litCount = blocks.filter(b => b.lit).length;

  // 静态块的真原文：与 buildSysBase 共用 enginePrompts.js 的同一份常量
  const staticTextOf = (b) => {
    const key = STATIC_TEXT_KEYS[b.id];
    if (key) return ENGINE[key];
    if (b.id === "schema") return ENGINE[schemaKeyFor(view)];
    if (b.id === "catalog") return ENGINE.CATALOG_TAIL;
    // 送礼铁律示例——用固定示例礼物演示实际渲染样例，不用等拉取当前局真值
    if (b.id === "gift_settle_law") return giftSettleLawExample();
    if (b.id === "gift_narrative_law") return giftNarrativeLawExample();
    if (b.id === "extraction_call") return buildExtractionSpecExample(view.intent || "UNKNOWN", view.settleKind || null);
    return null;
  };

  const pullLive = () => {
    if (!getLiveBlockText) { setLiveErr("要在局内打开设置才能拉——开始界面这里没有游戏状态。"); return; }
    try {
      const got = getLiveBlockText(view) || {};
      setLive(got);
      setLiveErr(Object.keys(got).length ? "" : "这一局暂时没有可拉的动态内容。");
    } catch (e) {
      setLiveErr(`拉取失败：${e.message || e}`);
    }
  };

  const box = {
    background: "#0c0e14", border: "1px solid #232733", borderRadius: 4,
    padding: "8px 10px", marginTop: 6, fontSize: 11, lineHeight: 1.75,
    color: "#9a9484", whiteSpace: "pre-wrap", wordBreak: "break-word",
    maxHeight: 260, overflowY: "auto", fontFamily: "inherit",
  };

  const renderTavernView = () => {
    const traces = getTraceLog();
    const t = traces.find(x => x.pipeline?.systemPrompt);
    if (!t) {
      return (
        <div style={{ fontSize: 11, color: "#5a5a4a", padding: "12px 0" }}>
          当前还没有主叙事调用记录。触发一次行动（移动、对话、行动）后，这里会按酒馆 13 位置展示实际发出去的 prompt 结构。
        </div>
      );
    }
    const pl = t.pipeline;
    const sys = Array.isArray(pl.systemPrompt) ? pl.systemPrompt : [{ role: "system", content: pl.systemPrompt || "", tavernBlock: "main", tavernLabel: "Main Prompt" }];
    const msgs = [
      ...sys.map((b, i) => ({ ...b, order: (getPositionMeta(b.tavernBlock)?.order || 0) + i * 0.01 })),
      ...(pl.userMessages || []).map((m, i) => ({ ...m, order: (getPositionMeta(m.tavernBlock)?.order || 100 + i) + i * 0.01 })),
    ].sort((a, b) => a.order - b.order);
    const meta = t.injectionSnapshot?.meta;
    return (
      <div>
        {meta && (
          <div style={{ fontSize: 10, color: "#5a7a6a", marginBottom: 8, lineHeight: 1.6 }}>
            scope={meta.scope ?? "?"} · {meta.narrativeOnly ? "双调用主叙事" : "单调用"}
            {meta.isSettle ? " · settle" : ""}{meta.settleKind ? ` · ${meta.settleKind}` : ""}
            {"　"}want[隔离={meta.wantIsolation ? 1 : 0}/物件志={meta.wantCatalog ? 1 : 0}/MVU={meta.wantMvu ? 1 : 0}]
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {msgs.map((m, i) => {
            const isSys = m.role === "system";
            const label = m.tavernLabel || m.tavernBlock || (isSys ? "system" : m.role);
            const len = (m.content || "").length;
            return (
              <div key={i} style={{ border: "1px solid #1e2129", borderRadius: 4, padding: "6px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: isSys ? "#7a9ab8" : "#8a8a7a" }}>#{Math.floor(m.order)}</span>
                  <span style={{ fontSize: 11, color: isSys ? "#c8bfa0" : "#a8a898", fontWeight: "bold" }}>{label}</span>
                  <span style={{ fontSize: 9, color: "#5a5a4a" }}>{m.role} · {len} 字</span>
                </div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 9.5, lineHeight: 1.45, color: "#9a9484", background: "#0a0c10", border: "1px solid #1a2020", borderRadius: 3, padding: "5px 7px", maxHeight: 140, overflowY: "auto" }}>{m.content || "（空）"}</pre>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 视图切换：动作分类 vs 酒馆 13 位置 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, color: "#5a5a4a" }}>查看视角：</span>
        {[["tavern", "🍺 酒馆 13 位置"], ["action", "⚔ 动作分类"]].map(([m, label]) => (
          <span key={m}
            onClick={() => { setViewMode(m); setOpenBlock(null); }}
            style={{
              cursor: "pointer", padding: "2px 10px", borderRadius: 3, fontSize: 11,
              background: viewMode === m ? "#1a2530" : "transparent",
              color: viewMode === m ? "#c8bfa0" : "#5a5a4a",
              border: `1px solid ${viewMode === m ? "#2a4a4a" : "#242833"}`,
            }}>
            {label}
          </span>
        ))}
      </div>

      {viewMode === "action" && (
        <>
          <div style={{ fontSize: 11, color: "#7a7460", lineHeight: 1.7, marginBottom: 8 }}>
            这一轮到底喂了 AI 什么，按动作分类逐块列在这里。点条目展开看
            <b style={{ color: "#9a9484" }}>真正的原文</b>
            ——静态块与 buildSysBase 共用同一份常量，不是另抄的一份。只读。
          </div>

          {/* 动作分类 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {ACTION_VIEWS.map(v => (
          <span key={v.id}
            onClick={() => { setActionId(v.id); setOpenBlock(null); }}
            style={{
              cursor: "pointer", padding: "3px 10px", borderRadius: 3, fontSize: 11.5,
              background: actionId === v.id ? "#1a2530" : "transparent",
              color: actionId === v.id ? "#c8bfa0" : "#5a5a4a",
              border: `1px solid ${actionId === v.id ? "#2a4a4a" : "#242833"}`,
            }}>
            {v.label}
          </span>
        ))}
      </div>

      {/* 单调用 / 双调用 切换：同一个动作分类，两种模式下喂给AI的东西结构完全不同
          （单调用：主模型一次产JSON+MVU；双调用：主模型只写散文，状态判定转交
          extractionEngine.js 的提取层，是另一次独立AI调用，可配不同模型）。
          默认跟随设置里实际生效的档位，也可以手动切换来对比两种架构的差异。 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, color: "#5a5a4a" }}>查看模式：</span>
        {[["single", "单调用"], ["dual", "双调用"]].map(([m, label]) => (
          <span key={m}
            onClick={() => { setMode(m); setOpenBlock(null); }}
            style={{
              cursor: "pointer", padding: "2px 10px", borderRadius: 3, fontSize: 11,
              background: mode === m ? "#243020" : "transparent",
              color: mode === m ? "#9ac07a" : "#5a5a4a",
              border: `1px solid ${mode === m ? "#3a5a2a" : "#242833"}`,
            }}>
            {label}
          </span>
        ))}
        <span style={{ fontSize: 10, color: "#4a4a3a" }}>
          （设置里实际生效：{extractionEnabled ? "双调用" : "单调用"}{mode !== (extractionEnabled ? "dual" : "single") ? "　—　当前只是切换查看，不影响实际生效的模式" : ""}）
        </span>
      </div>

      <div style={{ fontSize: 11, color: "#7a7460", marginBottom: 6, lineHeight: 1.65 }}>
        {view.note}
        <span style={{ color: "#5a5a4a" }}>
          {"　"}scope=<b style={{ color: "#8a9a8a" }}>{view.scope}</b>
          {view.intent ? `　intent=${view.intent}` : ""}
          {"　"}{litCount}/{blocks.length} 块亮灯
        </span>
      </div>

      {/* 拉取当前局 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span onClick={pullLive}
          style={{
            cursor: "pointer", fontSize: 11, padding: "3px 12px", borderRadius: 3,
            color: "#0a0c14", background: "#6ec6c6", border: "1px solid #6ec6c6",
          }}>
          ⟳ 拉取目前
        </span>
        <span style={{ fontSize: 10, color: "#5a5a4a" }}>
          {Object.keys(live).length
            ? `已拉到 ${Object.keys(live).length} 块当前局真值`
            : "动态块默认显示字段模板，点这里抓当前这一局的真实内容"}
        </span>
      </div>
      {liveErr && <div style={{ fontSize: 10.5, color: "#c08a5a", marginBottom: 8 }}>{liveErr}</div>}

      {/* 图例 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, fontSize: 10 }}>
        {Object.entries(KIND_META).map(([k, m]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#6a6555" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, display: "inline-block" }} />
            {m.label}
          </span>
        ))}
        <span style={{ color: "#4a4a3a" }}>⚫ = 本动作下灭灯（不注入）</span>
      </div>

      {/* 逐块 */}
      {blocks.map((b) => {
        const meta = KIND_META[b.kind] || { label: b.kind, color: "#666" };
        const open = openBlock === b.id;
        const text = staticTextOf(b);
        const liveText = live[b.id];
        return (
          <div key={b.id} style={{
            border: `1px solid ${open ? "#2a4a4a" : "#1e2129"}`, borderRadius: 4,
            marginBottom: 4, opacity: b.lit ? 1 : 0.5, background: open ? "#0e1118" : "transparent",
          }}>
            <div
              onClick={() => setOpenBlock(open ? null : b.id)}
              style={{ cursor: "pointer", padding: "6px 9px", display: "flex", alignItems: "center", gap: 7 }}
            >
              <span style={{ color: "#4a4a3a", fontSize: 10, width: 18, flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: b.lit ? meta.color : "#3a3a3a", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: b.lit ? "#c8bfa0" : "#6a6555", minWidth: 0 }}>
                {b.name}
                {!b.lit && <span style={{ color: "#5a5a4a", fontSize: 10 }}>　⚫灭</span>}
              </span>
              <span style={{ fontSize: 9.5, color: "#4a4a3a", flexShrink: 0 }}>{meta.label}　#{b.depth}</span>
            </div>

            {open && (
              <div style={{ padding: "0 9px 9px 34px" }}>
                {!b.lit && b.off && (
                  <div style={{ fontSize: 10.5, color: "#c08a5a", marginBottom: 4 }}>本动作下不注入：{b.off}</div>
                )}
                <div style={{ fontSize: 10.5, color: "#6a6555", lineHeight: 1.7 }}>{b.summary}</div>

                {/* 文体铁律展开成字段级 */}
                {b.id === "preset_wenfeng" && (
                  <div style={{ ...box, color: "#7a8a9a" }}>
                    {CONSTRAINT_FIELDS.map(f => `${f.label}（${f.type}）— ${f.desc}`).join("\n")}
                  </div>
                )}

                {liveText != null ? (
                  <>
                    <div style={{ fontSize: 10, color: "#6ec6c6", marginTop: 6 }}>⟳ 当前这一局的真实内容</div>
                    <div style={box}>{liveText}</div>
                  </>
                ) : text != null ? (
                  <>
                    <div style={{ fontSize: 10, color: "#5a7a5a", marginTop: 6 }}>
                      原文（与 buildSysBase 共用同一份常量）· {text.length} 字
                    </div>
                    <div style={box}>{text}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 10.5, color: "#6a6555", marginTop: 6, fontStyle: "italic" }}>
                    运行时动态生成，没有固定原文 —— 点上方「⟳ 拉取目前」看这一局的真实内容。
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
        </>
      )}

      {viewMode === "tavern" && renderTavernView()}
    </div>
  );
}

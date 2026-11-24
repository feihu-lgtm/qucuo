import React, { useState } from "react";
import {
  ACTION_VIEWS, blocksForAction, KIND_META, CONSTRAINT_FIELDS,
  STATIC_TEXT_KEYS, schemaKeyFor, giftSettleLawExample, giftNarrativeLawExample,
} from "../../domain/rules/prompt/injectionBlocks.js";
import * as ENGINE from "../../domain/rules/prompt/enginePrompts.js";
import { buildExtractionSpecExample } from "../../domain/rules/prompt/extractionEngine.js";
import { getTraceLog } from "../../infra/actionTrace.js";
import { getPositionMeta } from "../../domain/rules/prompt/tavernMapping.js";
import {
  getPromptOverrides, resetPromptOverrides, setPromptOverride,
} from "../../domain/rules/prompt/registry.js";
import {
  CALL_GROUP_META, EXECUTION_LABELS, ROUTE_LABELS,
  getCallControlMatrix, listAllManagedCalls,
} from "../../domain/rules/prompt/promptCatalog.js";
import { ensureAllPromptsRegistered } from "../../app/calls/registerAllPrompts.js";

ensureAllPromptsRegistered();

const preStyle = {
  background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0,
  padding: "8px 10px", marginTop: 6, fontSize: 11, lineHeight: 1.75,
  color: "var(--inject-body)", whiteSpace: "pre-wrap", wordBreak: "break-word",
  maxHeight: 240, overflowY: "auto", fontFamily: "inherit",
};
const pill = (active) => ({
  cursor: "pointer", padding: "3px 10px", borderRadius: 0, fontSize: 11,
  background: active ? "var(--inject-tab-on)" : "transparent",
  color: active ? "var(--text)" : "var(--text-dim)",
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
});
const MODE_BTNS = [["blue", "蓝灯"], ["green", "绿灯"], ["off", "关闭"]];

export default function InjectionStructurePanel({ getLiveBlockText, extractionEnabled }) {
  const [viewMode, setViewMode] = useState("control");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedCallId, setSelectedCallId] = useState("main:look");
  const [actionId, setActionId] = useState("look");
  const [mode, setMode] = useState(extractionEnabled ? "dual" : "single");
  const [overrides, setOverrides] = useState(() => getPromptOverrides());
  const [drafts, setDrafts] = useState({});
  const [openBlock, setOpenBlock] = useState(null);
  const [live, setLive] = useState({});
  const [liveErr, setLiveErr] = useState("");

  const allCalls = listAllManagedCalls();
  const visibleCalls = groupFilter === "all" ? allCalls : allCalls.filter((c) => c.group === groupFilter);
  const matrix = getCallControlMatrix(selectedCallId, { mode, overrides });
  const view = ACTION_VIEWS.find((v) => v.id === actionId) || ACTION_VIEWS[0];
  const actionBlocks = blocksForAction(actionId, mode);

  const syncOverrides = (next) => setOverrides(next);
  const handleModeChange = (blockId, nextMode, currentActiveMode) => {
    const patchMode = currentActiveMode === nextMode ? null : nextMode;
    syncOverrides(setPromptOverride(blockId, { mode: patchMode }));
  };
  const pullLive = (targetView) => {
    if (!getLiveBlockText) { setLiveErr("要在局内打开设置才能拉——开始界面没有游戏状态。"); return; }
    try {
      const got = getLiveBlockText(targetView) || {};
      setLive(got);
      setLiveErr(Object.keys(got).length ? "" : "这一局暂时没有可拉的动态内容。");
    } catch (e) { setLiveErr(`拉取失败：${e.message || e}`); }
  };

  const staticTextOf = (b, v) => {
    const key = STATIC_TEXT_KEYS[b.id];
    if (key) return ENGINE[key];
    if (b.id === "schema") return ENGINE[schemaKeyFor(v)];
    if (b.id === "catalog") return ENGINE.CATALOG_TAIL;
    if (b.id === "gift_settle_law") return giftSettleLawExample();
    if (b.id === "gift_narrative_law") return giftNarrativeLawExample();
    if (b.id === "extraction_call") return buildExtractionSpecExample(v.intent || "UNKNOWN", v.settleKind || null);
    return null;
  };

  const renderControlView = () => {
    const call = matrix.call;
    const liveView = call?.baseCallId === "turn.main"
      ? ACTION_VIEWS.find((v) => v.id === call.actionId) || ACTION_VIEWS[0]
      : ACTION_VIEWS.find((v) => v.id === "whisper") || ACTION_VIEWS[0];
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
          {[["all", "全部通道"], ...Object.entries(CALL_GROUP_META).map(([k, m]) => [k, m.label])].map(([k, label]) => (
            <span key={k} style={pill(groupFilter === k)} onClick={() => {
              setGroupFilter(k);
              const list = k === "all" ? allCalls : allCalls.filter((c) => c.group === k);
              if (list.length && !list.some((c) => c.id === selectedCallId)) setSelectedCallId(list[0].id);
              setOpenBlock(null);
            }}>{label}</span>
          ))}
          <span style={{ flex: 1 }} />
          {[["single", "单调用"], ["dual", "双调用"]].map(([m, label]) => (
            <span key={m} style={pill(mode === m)} onClick={() => setMode(m)}>{label}</span>
          ))}
          <span style={pill(false)} onClick={() => { syncOverrides(resetPromptOverrides()); setDrafts({}); }}>
            恢复全部默认
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {visibleCalls.map((c) => (
            <span key={c.id} style={pill(call?.id === c.id)} onClick={() => { setSelectedCallId(c.id); setOpenBlock(null); }}>
              {c.label} <span style={{ fontSize: 9.5, opacity: 0.7 }}>[{ROUTE_LABELS[c.route]}]</span>
            </span>
          ))}
        </div>

        {call && (
          <div style={{ border: "1px solid var(--border)", padding: "8px 10px", marginBottom: 8, background: "var(--bg-panel)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 11.5 }}>
              <b style={{ color: "var(--text)" }}>{call.label}</b>
              <span style={{ color: "var(--accent)", fontSize: 10.5 }}>{EXECUTION_LABELS[call.execution]}</span>
              <span style={{ color: "var(--ink-good)", fontSize: 10.5 }}>路由 {ROUTE_LABELS[call.route]}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 10.5 }}>
                {matrix.litCount}/{matrix.totalCount} 块点亮 · 约 {matrix.tokenEstimate} tokens
              </span>
              {(call.group === "main" || call.group === "whisper") && (
                <span onClick={() => pullLive(liveView)} style={{ cursor: "pointer", fontSize: 10.5, padding: "1px 8px", color: "var(--bg-panel)", background: "var(--accent)" }}>
                  ⟳ 拉取目前真值
                </span>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--inject-hint)", marginTop: 4 }}>{call.desc}</div>
            <div style={{ fontSize: 10.5, color: "var(--inject-ok)", marginTop: 2 }}>审阅与校验规则：{call.reviewDesc}</div>
            {liveErr && <div style={{ fontSize: 10.5, color: "var(--inject-off)", marginTop: 4 }}>{liveErr}</div>}
          </div>
        )}

        {matrix.categories.map((cat) => {
          const items = matrix.items.filter((i) => i.category === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 4 }}>
                {cat.label} <span style={{ fontSize: 10, color: "var(--text-dim)" }}>({cat.desc})</span>
              </div>
              {items.map((item) => {
                const open = openBlock === item.id;
                const activeMode = item.overrideMode || item.defaultMode;
                const draftVal = drafts[item.id] ?? (item.effectiveText ?? "");
                return (
                  <div key={item.id} style={{
                    border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`, marginBottom: 4,
                    opacity: item.effectiveLit ? 1 : 0.62, background: open ? "var(--inject-open-bg)" : "transparent",
                  }}>
                    <div onClick={() => setOpenBlock(open ? null : item.id)} style={{ cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--inject-faint)", fontSize: 10 }}>{open ? "▼" : "▶"}</span>
                      <span style={{ width: 8, height: 8, background: item.effectiveLit ? (KIND_META[item.kind]?.color || "var(--ink-good)") : "var(--inject-unlit)" }} />
                      <span style={{ flex: 1, fontSize: 11.5, color: item.effectiveLit ? "var(--text)" : "var(--text-dim)" }}>
                        {item.name} <span style={{ fontSize: 9.5, color: "var(--inject-faint)" }}>#{item.slot}</span>
                      </span>
                      {item.canToggleOff ? (
                        <span style={{ display: "inline-flex", gap: 3 }} onClick={(e) => e.stopPropagation()}>
                          {MODE_BTNS.map(([m, label]) => (
                            <span key={m} onClick={() => handleModeChange(item.id, m, item.overrideMode)}
                              style={{ ...pill(activeMode === m), padding: "1px 6px", fontSize: 9.5 }}>{label}</span>
                          ))}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>引擎锁定</span>
                      )}
                    </div>
                    {open && (
                      <div style={{ padding: "0 8px 8px 26px" }}>
                        <div style={{ fontSize: 10, color: item.effectiveLit ? "var(--inject-ok)" : "var(--inject-off)" }}>状态：{item.reason}</div>
                        {item.summary && <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 2 }}>{item.summary}</div>}
                        {live[item.id] != null && (
                          <>
                            <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 4 }}>⟳ 当前这一局真值</div>
                            <div style={preStyle}>{live[item.id]}</div>
                          </>
                        )}
                        {item.canEditText ? (
                          <div style={{ marginTop: 6 }}>
                            <textarea value={draftVal} onChange={(e) => setDrafts((p) => ({ ...p, [item.id]: e.target.value }))}
                              rows={5} style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-panel)", color: "var(--inject-body)", border: "1px solid var(--border)", padding: 6, fontSize: 10.5, fontFamily: "inherit" }} />
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                              <span style={pill(true)} onClick={() => syncOverrides(setPromptOverride(item.id, { text: draftVal }))}>保存覆盖</span>
                              {item.hasTextOverride && (
                                <span style={pill(false)} onClick={() => {
                                  syncOverrides(setPromptOverride(item.id, { text: null }));
                                  setDrafts((p) => { const c = { ...p }; delete c[item.id]; return c; });
                                }}>恢复原词</span>
                              )}
                            </div>
                          </div>
                        ) : item.effectiveText != null ? (
                          <div style={preStyle}>{item.effectiveText}</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTavernView = () => {
    const t = getTraceLog().find((x) => x.nodes.some((n) => n.pipeline?.callLabel === "主叙事"));
    if (!t) return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "12px 0" }}>触发一次行动后，这里展示实际发出去的 13 位置结构。</div>;
    const pl = t.nodes.find((n) => n.pipeline?.callLabel === "主叙事").pipeline;
    const sys = Array.isArray(pl.systemPrompt) ? pl.systemPrompt : [{ role: "system", content: pl.systemPrompt || "", tavernBlock: "main", tavernLabel: "Main Prompt" }];
    const msgs = [
      ...sys.map((b, i) => ({ ...b, order: (getPositionMeta(b.tavernBlock)?.order || 0) + i * 0.01 })),
      ...(pl.userMessages || []).map((m, i) => ({ ...m, order: (getPositionMeta(m.tavernBlock)?.order || 100 + i) + i * 0.01 })),
    ].sort((a, b) => a.order - b.order);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", padding: "6px 8px" }}>
            <div style={{ fontSize: 10.5, color: "var(--text)", marginBottom: 3 }}>
              #{Math.floor(m.order)} <b>{m.tavernLabel || m.tavernBlock || m.role}</b> ({(m.content || "").length} 字)
            </div>
            <pre style={{ ...preStyle, marginTop: 0, maxHeight: 140 }}>{m.content || "（空）"}</pre>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>查看视角：</span>
        {[["control", "🎛️ 统一总控台"], ["tavern", "🍺 酒馆 13 位置"], ["action", "⚔ 动作分类"]].map(([m, label]) => (
          <span key={m} style={pill(viewMode === m)} onClick={() => { setViewMode(m); setOpenBlock(null); }}>{label}</span>
        ))}
      </div>

      {viewMode === "control" && renderControlView()}
      {viewMode === "tavern" && renderTavernView()}
      {viewMode === "action" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {ACTION_VIEWS.map((v) => (
              <span key={v.id} style={pill(actionId === v.id)} onClick={() => { setActionId(v.id); setOpenBlock(null); }}>{v.label}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--inject-hint)", marginBottom: 6 }}>
            {view.note}（{actionBlocks.filter((b) => b.lit).length}/{actionBlocks.length} 块亮灯，模式 {mode === "dual" ? "双调用" : "单调用"}）
          </div>
          {actionBlocks.map((b) => {
            const meta = KIND_META[b.kind] || { label: b.kind, color: "var(--inject-kind-fallback)" };
            const open = openBlock === b.id;
            const text = staticTextOf(b, view);
            return (
              <div key={b.id} style={{ border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`, marginBottom: 4, opacity: b.lit ? 1 : 0.5 }}>
                <div onClick={() => setOpenBlock(open ? null : b.id)} style={{ cursor: "pointer", padding: "6px 9px", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ color: "var(--inject-faint)", fontSize: 10 }}>{open ? "▼" : "▶"}</span>
                  <span style={{ width: 8, height: 8, background: b.lit ? meta.color : "var(--inject-unlit)" }} />
                  <span style={{ flex: 1, fontSize: 12, color: b.lit ? "var(--text)" : "var(--text-dim)" }}>{b.name}{!b.lit && " ⚫灭"}</span>
                  <span style={{ fontSize: 9.5, color: "var(--inject-faint)" }}>{meta.label} #{b.depth}</span>
                </div>
                {open && (
                  <div style={{ padding: "0 9px 9px 34px" }}>
                    {!b.lit && b.off && <div style={{ fontSize: 10.5, color: "var(--inject-off)" }}>{b.off}</div>}
                    <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{b.summary}</div>
                    {b.id === "preset_wenfeng" && <div style={preStyle}>{CONSTRAINT_FIELDS.map((f) => `${f.label}（${f.type}）— ${f.desc}`).join("\n")}</div>}
                    {live[b.id] != null ? <div style={preStyle}>{live[b.id]}</div> : text != null ? <div style={preStyle}>{text}</div> : null}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

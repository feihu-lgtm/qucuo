// 上报 Bug / 意见反馈弹窗
// -----------------------------------------------------------------------------
// 玩家遇到问题或有建议时，点一下把这局的对话/日志/状态 + 文字描述上传到开发者的
// Supabase 后台。含知情声明勾选：必须勾"同意"才能提交，声明写明"聊天记录仅用于
// debug、不记录其他数据"。三个可选输入：描述bug / 想加的功能 / 任何意见建议。
//
// 在三处复用：顶栏「🐞上报bug」、🧭全流程日志弹窗内的入口、开始页。
// getPayload 由调用方注入（游戏内能带上对话/日志/状态；开始页只有纯文字反馈）。

import React, { useState } from "react";
import { submitBugReport } from "./bugReport.js";
import { CURRENT_VERSION } from "./version.js";

// turns: [{ label, preview, entries }]  —— 由调用方按回合分好组传入（游戏内才有；开始页传 []）
//   label: "第N回合 · 玩家指令摘要"；preview: 纯文本预览（展开时显示）；entries: 该回合原始日志条目
// pipelineCount: pipeline 后台日志条数（0 则不显示总开关）
// getExtraPayload: 返回 { gameState }（对话/pipeline 由本组件按勾选自行组装）
export default function BugReportModal({ turns = [], pipelineData = null, getGameState, onClose, isDayMode = false }) {
  const [agreed, setAgreed] = useState(false);
  const [bugDesc, setBugDesc] = useState("");
  const [featureWish, setFeatureWish] = useState("");
  const [misc, setMisc] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, error }
  // 默认全选所有回合（用 index 集合）；展开查看的回合
  const [selectedTurns, setSelectedTurns] = useState(() => new Set(turns.map((_, i) => i)));
  const [expandedTurn, setExpandedTurn] = useState(null);
  const [includePipeline, setIncludePipeline] = useState(false); // pipeline 后台日志总开关，默认不带（量大）
  const pipelineCount = Array.isArray(pipelineData) ? pipelineData.length : 0;

  const toggleTurn = (i) => setSelectedTurns(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  const allSelected = turns.length > 0 && selectedTurns.size === turns.length;
  const toggleAll = () => setSelectedTurns(allSelected ? new Set() : new Set(turns.map((_, i) => i)));

  const dark = !isDayMode;
  const C = {
    overlay: "rgba(8,6,3,0.82)",
    panel: dark ? "#141019" : "#f7f2e8",
    border: dark ? "#3a3242" : "#b3987a",
    text: dark ? "#e8e4d6" : "#3a2a14",
    dim: dark ? "#7a7060" : "#8a7358",
    accent: dark ? "#d4a853" : "#8a5a12",
    inputBg: dark ? "#0d0b12" : "#fffdf6",
  };

  const submit = async () => {
    if (!agreed || sending) return;
    const note = [
      bugDesc.trim() && `【Bug】${bugDesc.trim()}`,
      featureWish.trim() && `【想加的功能】${featureWish.trim()}`,
      misc.trim() && `【意见建议】${misc.trim()}`,
    ].filter(Boolean).join("\n\n");
    setSending(true);
    setResult(null);
    // 按勾选组装：选中的回合原始日志条目
    const pickedTurns = turns.filter((_, i) => selectedTurns.has(i)).map(t => ({ label: t.label, entries: t.entries }));
    const r = await submitBugReport({
      playerNote: note,
      version: CURRENT_VERSION ? `${CURRENT_VERSION.codename} ${CURRENT_VERSION.time}` : "",
      gameState: getGameState ? getGameState() : null,
      conversation: pickedTurns.length ? pickedTurns : null,
      pipelineLog: includePipeline && pipelineCount ? pipelineData : null,
    });
    setSending(false);
    setResult(r);
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "6px 9px", fontSize: 12.5,
    fontFamily: "inherit", background: C.inputBg, border: `1px solid ${C.border}`,
    borderRadius: 0, color: C.text, resize: "vertical", marginTop: 4,
  };
  const labelStyle = { fontSize: 12, color: C.accent, fontWeight: "bold" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: C.overlay, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "relative", width: 440, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 0, padding: "22px 24px", color: C.text }}>
        <span onClick={onClose} style={{ position: "absolute", top: 14, right: 16, cursor: "pointer", fontSize: 18, color: C.dim }}>✕</span>
        <div style={{ fontSize: 17, fontWeight: "bold", color: C.accent, marginBottom: 4 }}>🐞 上报 Bug · 意见信箱</div>
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 16, lineHeight: 1.7 }}>
          遇到问题、想要的功能、任何想说的，都可以留在这里。
        </div>

        {result?.ok ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 15, color: "#4a9a4a", marginBottom: 8 }}>✓ 已收到，多谢！</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: result.pipelineWarning ? 6 : 18 }}>你的反馈已送达开发者，会尽快看到。</div>
            {result.pipelineWarning && (
              <div style={{ fontSize: 11, color: "#c08a5a", marginBottom: 18 }}>{result.pipelineWarning}</div>
            )}
            <span onClick={onClose} style={{ cursor: "pointer", padding: "6px 20px", border: `1px solid ${C.border}`, borderRadius: 0, color: C.text }}>关闭</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>描述遇到的 Bug（可选）</div>
              <textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)} rows={2} placeholder="比如：从A箱庭走到B，新人物没刷新…" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>想加的功能（可选）</div>
              <textarea value={featureWish} onChange={e => setFeatureWish(e.target.value)} rows={2} placeholder="希望游戏加点什么…" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>任何意见建议（可选）</div>
              <textarea value={misc} onChange={e => setMisc(e.target.value)} rows={2} placeholder="吐槽、夸奖、随便说…" style={inputStyle} />
            </div>

            {/* 选择附带的聊天记录（按回合勾选，可展开看内容）——仅游戏内有 turns */}
            {turns.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={labelStyle}>附带聊天记录（选要发的回合）</span>
                  <span onClick={toggleAll} style={{ cursor: "pointer", fontSize: 11, color: C.accent }}>
                    {allSelected ? "全不选" : "全选"}（已选 {selectedTurns.size}/{turns.length}）
                  </span>
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 0, padding: 4 }}>
                  {turns.map((t, i) => (
                    <div key={i} style={{ borderBottom: i < turns.length - 1 ? `1px solid ${C.border}55` : "none", padding: "3px 2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={selectedTurns.has(i)} onChange={() => toggleTurn(i)} style={{ flexShrink: 0 }} />
                        <span onClick={() => toggleTurn(i)} style={{ flex: 1, cursor: "pointer", fontSize: 11.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                        <span onClick={() => setExpandedTurn(expandedTurn === i ? null : i)} style={{ cursor: "pointer", fontSize: 10.5, color: C.dim, flexShrink: 0 }}>
                          {expandedTurn === i ? "收起" : "查看"}
                        </span>
                      </div>
                      {expandedTurn === i && (
                        <div style={{ marginLeft: 22, marginTop: 4, marginBottom: 4, padding: "6px 8px", background: C.inputBg, borderRadius: 0, fontSize: 11, color: C.dim, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto" }}>
                          {t.preview || "（无文本内容）"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {pipelineCount > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 8, fontSize: 11.5, color: C.dim }}>
                    <input type="checkbox" checked={includePipeline} onChange={e => setIncludePipeline(e.target.checked)} style={{ flexShrink: 0 }} />
                    <span>附带后台 AI 调用日志（{pipelineCount} 条，含完整 prompt/回复，debug 更准但数据量大）</span>
                  </label>
                )}
              </div>
            )}

            {/* 知情声明 + 勾选 */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "10px 12px", background: dark ? "rgba(212,168,83,0.08)" : "rgba(138,90,18,0.06)", borderRadius: 0, marginBottom: 14 }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.7 }}>
                我同意在提交时，将<b style={{ color: C.text }}>本局的聊天/游戏记录</b>一并发送给开发者用于排查问题。
                这些记录<b style={{ color: C.text }}>仅用于 debug</b>，不收集你的任何其他数据（不涉及账号、位置、设备指纹等）。
              </span>
            </label>

            {result && !result.ok && (
              <div style={{ fontSize: 11.5, color: "#e0526a", marginBottom: 10, lineHeight: 1.6 }}>提交失败：{result.error}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
              <span onClick={onClose} style={{ cursor: "pointer", fontSize: 12, color: C.dim, padding: "6px 14px" }}>取消</span>
              <span
                onClick={submit}
                style={{
                  cursor: agreed && !sending ? "pointer" : "not-allowed",
                  padding: "6px 20px", borderRadius: 0, fontSize: 13, fontWeight: "bold",
                  background: agreed && !sending ? C.accent : (dark ? "#2a2620" : "#d8cdb8"),
                  color: agreed && !sending ? (dark ? "#1a140c" : "#fff") : C.dim,
                  border: "none",
                }}
              >{sending ? "上传中…" : "提交"}</span>
            </div>
            {!agreed && <div style={{ fontSize: 10.5, color: C.dim, textAlign: "right", marginTop: 6 }}>需先勾选同意才能提交</div>}
          </>
        )}
      </div>
    </div>
  );
}

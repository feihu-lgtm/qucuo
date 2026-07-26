import React from "react";
import { getPipelineLog, clearPipelineLog } from "./apiConfig.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function PipelineViewer({ onClose, loading, waitSecs }) {
  // 遮罩误触修复：这个面板专门用来给玩家复制长段 prompt/回复文本排查问题，
  // 选字拖拽是最高频操作，正是最容易踩中"选字划出边界导致弹窗自己关了"
  // 这个bug的地方，必须修。见 utils/overlayClose.js。
  const closeGuard = useOverlayCloseGuard(onClose);
  const [expanded, setExpanded] = React.useState({});
  const [subTab, setSubTab] = React.useState({}); // 每条日志内部的子标签页：'sys' | 'user' | 'response' | 'recall'
  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }));
  const setTab = (i, tab) => setSubTab(s => ({ ...s, [i]: tab }));
  const entries = getPipelineLog();

  const TAB_LABELS = { sys: "System", user: "输入", response: "输出", recall: "召回" };

  const [copied, setCopied] = React.useState(null); // 'all' | 索引，用于短暂显示"已复制"

  // 把一条日志整理成一段纯文本：System prompt + 输入 + 输出（失败则给错误），
  // 附上元信息头，方便直接粘给 AI 排查"这轮 prompt 长这样、结果长这样、哪里不对"。
  function formatEntry(entry, n) {
    const head = `=== Pipeline #${n} | ${new Date(entry.ts).toLocaleString()} | ${entry.apiType}/${entry.model}`
      + `${entry.intent ? ` | ${entry.intent.label}` : ""}${entry.streamed ? " | 流式" : ""}`
      + `${entry.durationMs != null ? ` | ${entry.durationMs}ms` : ""} | ${entry.success === false ? "✗失败" : (entry.finishReason || "✓")} ===`;
    const userText = (entry.userMessages || [])
      .map(m => `[${m.role}]\n${m.content}`).join("\n\n");
    const outText = entry.success === false
      ? `【错误】\n${entry.error || "(无错误信息)"}`
      : `【输出 / Response】\n${entry.response || "(空)"}`;
    let recallText = "";
    if (entry.recall && entry.recall.visible?.length) {
      recallText = "\n\n【召回 / RecalledMemories】\n" + entry.recall.visible
        .map(m => `· sim=${m.similarity?.toFixed(3) ?? "-"} [${m.tier || "-"}] (第${m.meta?.turn ?? "?"}回合) ${m.text}`)
        .join("\n");
    }
    return `${head}\n\n【System Prompt】\n${entry.systemPrompt || "(空)"}\n\n【输入 / User】\n${userText}\n\n${outText}${recallText}`;
  }

  // 剪贴板写入：优先 navigator.clipboard，非安全上下文（部分 http/局域网）降级到 textarea+execCommand。
  async function copyText(text, tag) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      setCopied(tag);
      setTimeout(() => setCopied(c => (c === tag ? null : c)), 1500);
    } catch (e) {
      alert("复制失败，请手动选中复制：" + (e.message || e));
    }
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 16, width: 820, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto", fontFamily: "monospace", fontSize: "11px", color: "#8a8a7a" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#f0c060", fontSize: "13px" }}>Pipeline 日志（最近 {entries.length} 条）</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ cursor: "pointer", color: copied === "all" ? "#8ac48a" : "#6a8a6a" }}
              onClick={() => copyText(entries.map((e, k) => formatEntry(e, entries.length - k)).join("\n\n\n"), "all")}>
              {copied === "all" ? "✓ 已复制全部" : "复制全部"}
            </span>
            <span style={{ cursor: "pointer", color: "#8a6a4a" }} onClick={() => { clearPipelineLog(); onClose(); }}>清空</span>
            <span style={{ cursor: "pointer", color: "#5a5a4a", fontSize: "13px" }} onClick={onClose}>×</span>
          </div>
        </div>
        {loading && (
          <div style={{
            marginBottom: 10, padding: "6px 10px", borderRadius: 4,
            background: waitSecs >= 30 ? "#3a1a1a" : waitSecs >= 12 ? "#3a2a12" : "#12180a",
            color: waitSecs >= 30 ? "#e08a6a" : waitSecs >= 12 ? "#e0b060" : "#8ab48a",
            border: `1px solid ${waitSecs >= 30 ? "#5a2a2a" : "#2a3a1a"}`,
          }}>
            {waitSecs >= 30 ? "🐢" : "⏳"} 正在等待接口响应… 已 {waitSecs}s
            {waitSecs >= 30 ? "（疑似卡住，>60s 自动超时）" : waitSecs >= 12 ? "（偏慢）" : ""}
          </div>
        )}
        {entries.length === 0 && <div style={{ color: "#3a3830" }}>暂无 API 调用记录</div>}
        {entries.map((entry, i) => {
          const open = expanded[i];
          const tab = subTab[i] || "response";
          const recall = entry.recall; // { visible, filtered, stats } | null
          return (
            <div key={i} style={{ borderBottom: "1px solid #14161e", padding: "8px 0" }}>
              <div onClick={() => toggle(i)} style={{ cursor: "pointer", marginBottom: 4, userSelect: "none", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: "#6ec6c6" }}>{open ? "▼" : "▶"} #{entries.length - i}</span>
                <span style={{ color: "#5a5a4a" }}>{new Date(entry.ts).toLocaleTimeString()}</span>
                <span style={{ color: "#5a5a4a" }}>{entry.apiType}/{entry.model}</span>
                {entry.streamed && <span style={{ color: "#5a7a9a" }}>流式</span>}
                {entry.intent && <span style={{ color: "#8ac48a" }}>{entry.intent.label}</span>}
                {entry.usage && <span style={{ color: "#5a5a4a" }}>入{entry.usage.prompt_tokens ?? entry.usage.promptTokenCount ?? entry.usage.input_tokens ?? "?"}/出{entry.usage.completion_tokens ?? entry.usage.candidatesTokenCount ?? entry.usage.output_tokens ?? "?"}</span>}
                {entry.durationMs != null && <span style={{ color: "#5a5a4a" }}>{entry.durationMs}ms</span>}
                {recall && <span style={{ color: "#c48a4a" }}>召回{recall.visible?.length ?? 0}{recall.filtered ? `(隐${recall.filtered})` : ""}</span>}
                <span
                  onClick={(e) => { e.stopPropagation(); copyText(formatEntry(entry, entries.length - i), i); }}
                  title="复制本条：System prompt + 输入 + 输出"
                  style={{ color: copied === i ? "#8ac48a" : "#6a8a6a", cursor: "pointer", border: "1px solid #24302a", borderRadius: 3, padding: "0 6px", fontSize: "10.5px" }}
                >
                  {copied === i ? "✓已复制" : "📋复制"}
                </span>
                <span style={{ color: entry.success === false ? "#c46060" : "#5a8a5a", marginLeft: "auto" }}>
                  {entry.success === false ? "✗ 失败" : (entry.finishReason || "✓")}
                </span>
              </div>
              {open && (
                <div style={{ paddingLeft: 12 }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                    {["sys", "user", "response", ...(recall ? ["recall"] : [])].map(t => (
                      <span
                        key={t}
                        onClick={() => setTab(i, t)}
                        style={{
                          cursor: "pointer", padding: "2px 10px", borderRadius: 3,
                          background: tab === t ? "#1a2530" : "transparent",
                          color: tab === t ? "#c8bfa0" : "#5a5a4a",
                        }}
                      >
                        {TAB_LABELS[t]}
                      </span>
                    ))}
                  </div>

                  {tab === "sys" && (
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                      {entry.systemPrompt}
                    </div>
                  )}

                  {tab === "user" && (
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                      {(entry.userMessages || []).map((m, mi) => (
                        <div key={mi} style={{ marginBottom: 8 }}>
                          <div style={{ color: "#5a8a5a" }}>[{m.role}]</div>
                          <div>{m.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "response" && (
                    <div>
                      {entry.success === false ? (
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#1a0d0d", color: "#e08080", padding: "8px", borderRadius: 3 }}>
                          错误：{entry.error}
                        </div>
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#0d0f18", padding: "8px", borderRadius: 3, maxHeight: 400, overflowY: "auto" }}>
                          {entry.response}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "recall" && recall && (
                    <div>
                      {recall.stats && (
                        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", color: "#5a5a4a" }}>
                          {Object.entries(recall.stats).map(([k, v]) => (
                            <span key={k}>{k}: <span style={{ color: "#c8bfa0" }}>{String(v)}</span></span>
                          ))}
                        </div>
                      )}
                      <div style={{ color: "#5a8a5a", marginBottom: 4 }}>▸ 可见（已通过权限过滤，实际进入 prompt）</div>
                      {(recall.visible || []).map((m, mi) => (
                        <div key={mi} style={{ background: "#0d0f18", padding: "6px 8px", borderRadius: 3, marginBottom: 4 }}>
                          <div style={{ color: "#5a5a4a" }}>sim={m.similarity?.toFixed(3) ?? "-"} · {m.meta?.id || m.id}</div>
                          <div>{m.text}</div>
                        </div>
                      ))}
                      {recall.filtered > 0 && (
                        <div style={{ color: "#8a6a4a", marginTop: 6 }}>
                          另有 {recall.filtered} 条召回结果因可见性权限被隐藏（flag 未解锁）
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useSyncExternalStore } from "react";
import { turnMonitor } from "../../core/turnMonitor.js";
import { fmtClock, fmtMs, formatTrace, pipelineTabs } from "../../infra/actionTrace.js";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import { chromeBtn } from "../theme.js";

const LAYER = { ui: "入口", app: "应用", feature: "功能", domain: "规则判定", engine: "引擎", rules: "世界规则", result: "结果" };

function AiDetails({ node, theme }) {
  const tabs = pipelineTabs(node.pipeline);
  const [tab, setTab] = useState("System");
  return (
    <details>
      <summary style={{ cursor: "pointer" }}>{node.label} · {node.model || "未指定模型"} · {fmtMs(node.durationMs) || "进行中"}{node.pipeline.success === false ? " · 失败" : ""}</summary>
      <div style={{ display: "flex", gap: 4, marginBlock: 6 }} role="tablist" aria-label="AI 调用详情">
        {Object.keys(tabs).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name}
            onClick={() => setTab(name)} style={{ ...chromeBtn(theme, { active: tab === name }), fontFamily: "inherit" }}>{name}</button>
        ))}
      </div>
      <pre role="tabpanel" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "35dvh", overflow: "auto" }}>
        {tabs[tab] || "（无内容）"}
      </pre>
    </details>
  );
}

export default function TraceViewer({ theme, onClose, onReport }) {
  const { trees } = useSyncExternalStore(turnMonitor.subscribe, turnMonitor.getSnapshot);
  const closeGuard = useOverlayCloseGuard(onClose);
  const [copied, setCopied] = useState("");
  const button = { ...chromeBtn(theme), fontFamily: "inherit" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${theme.bg} 78%, transparent)` }} {...closeGuard}>
      <section role="dialog" aria-modal="true" aria-label="全流程日志" style={{
        width: "min(760px, calc(100vw - 24px))", maxHeight: "85dvh", overflow: "auto", boxSizing: "border-box",
        background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, padding: 12,
      }}>
        <header style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <strong style={{ marginRight: "auto" }}>全流程日志</strong>
          <button type="button" style={button} onClick={async () => {
            try {
              await navigator.clipboard.writeText(trees.map((turn) => formatTrace(turn)).join("\n\n"));
              setCopied("已复制");
            } catch { setCopied("复制失败"); }
          }}>{copied || "复制全部"}</button>
          <button type="button" style={button} onClick={() => { turnMonitor.clear(); setCopied(""); }}>清空</button>
          <button type="button" style={button} onClick={onReport}>报告问题</button>
          <button type="button" style={button} onClick={onClose}>关闭</button>
        </header>
        {trees.length === 0 && <p style={{ color: theme.textDim }}>还没有行动记录。</p>}
        {trees.map((turn) => (
          <details key={turn.id} style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0" }}>
            <summary style={{ cursor: "pointer", overflowWrap: "anywhere" }}>
              {fmtClock(turn.ts)} · {turn.background ? "后台 · " : ""}{turn.cmd} · {turn.queued && turn.commandId === "rollback" ? "回滚已排队" : turn.phase} {fmtMs(turn.totalMs)}
            </summary>
            <ol style={{ margin: "8px 0", paddingInlineStart: 24 }}>
              {turn.nodes.map((node) => (
                <li key={node.id} style={{ marginBottom: 6, overflowWrap: "anywhere" }}>
                  <small style={{ color: theme.textDim }}>{LAYER[node.layer]} · +{fmtMs(node.atMs)}</small>
                  {node.pipeline
                    ? <AiDetails node={node} theme={theme} />
                    : <div>{node.label}{node.detail && `：${node.detail}`}</div>}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>
    </div>
  );
}

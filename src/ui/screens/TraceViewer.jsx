import { useState, useSyncExternalStore } from "react";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { fmtClock, fmtGameClock, fmtMs, formatTrace, pipelineTabs } from "../../infra/actionTrace.js";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { chromeBtn } from "../../utils/theme.js";
import { gameStore, useGameStore, getGameEpoch } from "../../store/gameStore.js";
import { shadowAggregates } from "../../engine/act/shadow/shadowJudge.js";
import { formatShadowVerdicts, formatAggregate } from "../../engine/act/shadow/shadowFormat.js";
import {
  releaseMetricAggregates,
  formatReleaseMetricLines,
  formatReleaseGateMarkdown,
  resolveReleaseMetricsEnabled,
} from "../../engine/ports/releaseMetrics.js";
import LiveClockText from "../components/LiveClockText.jsx";

const LAYER = { ui: "入口", app: "应用", feature: "功能", domain: "规则判定", engine: "引擎", rules: "世界规则", result: "结果", shadow: "影子" };

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

// WO-16D PR-D2 影子对账折叠段：逐类目 verdict，excluded 亮明盲区。
function ShadowDetails({ node, theme }) {
  const lines = formatShadowVerdicts(node.verdicts || {});
  return (
    <details>
      <summary style={{ cursor: "pointer" }}>
        {node.label}{node.status === "block" ? " · 有缺口" : ""}
      </summary>
      <ul style={{ marginBlock: 4, paddingInlineStart: 20, color: theme.textDim }}>
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </details>
  );
}

export default function TraceViewer({ theme, onClose, onReport }) {
  const { trees } = useSyncExternalStore(turnMonitor.subscribe, turnMonitor.getSnapshot);
  const rawTime = useGameStore((s) => s.time);
  const gameTime = typeof rawTime === "number" && Number.isFinite(rawTime) ? rawTime : gameStore.getState().time;
  const closeGuard = useOverlayCloseGuard(onClose);
  const [copied, setCopied] = useState("");
  const [reportCopied, setReportCopied] = useState("");
  const button = { ...chromeBtn(theme), fontFamily: "inherit" };
  const epoch = String(getGameEpoch());
  const shadowAgg = shadowAggregates(epoch);
  const metricsAgg = releaseMetricAggregates(epoch);
  const metricLines = formatReleaseMetricLines(metricsAgg);
  const showReleaseMetrics = resolveReleaseMetricsEnabled() || Boolean(metricLines);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${theme.bg} 78%, transparent)` }} {...closeGuard}>
      <section role="dialog" aria-modal="true" aria-label="全流程日志" style={{
        width: "min(760px, calc(100vw - 24px))", maxHeight: "85dvh", overflow: "auto", boxSizing: "border-box",
        background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, padding: 12,
      }}>
        <header style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <div style={{ marginRight: "auto", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 10px" }}>
            <strong>全流程日志</strong>
            <span style={{ color: theme.textDim, fontSize: "var(--fs-xs)", fontVariantNumeric: "tabular-nums" }}>
              游戏 {getTimeStr(gameTime)} · 第{gameTime}回合 · 现实 <LiveClockText />
            </span>
          </div>
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
        {(() => {
          const aggLines = formatAggregate(shadowAgg);
          return aggLines ? (
            <details style={{ border: `1px dashed ${theme.border}`, padding: "4px 8px", marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", color: theme.textDim }}>影子对账聚合（本存档 epoch {epoch}）</summary>
              <div style={{ color: theme.textDim, fontSize: "var(--fs-xs)", marginTop: 4 }}>
                {aggLines.map((line) => <div key={line}>{line}</div>)}
              </div>
            </details>
          ) : null;
        })()}
        {showReleaseMetrics && (
          <details style={{ border: `1px dashed ${theme.border}`, padding: "4px 8px", marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", color: theme.textDim }}>放行指标观测（本存档 epoch {epoch}）</summary>
            <div style={{ color: theme.textDim, fontSize: "var(--fs-xs)", marginTop: 4 }}>
              {metricLines
                ? metricLines.map((line) => <div key={line}>{line}</div>)
                : <div>暂无 turn.intake / SEAL 采样。</div>}
              <div style={{ marginTop: 6 }}>
                <button type="button" style={button} onClick={async () => {
                  try {
                    const md = formatReleaseGateMarkdown({ epoch, shadowAgg, metricsAgg });
                    await navigator.clipboard.writeText(md);
                    setReportCopied("已复制报告");
                  } catch { setReportCopied("复制失败"); }
                }}>{reportCopied || "复制报告"}</button>
              </div>
            </div>
          </details>
        )}
        {trees.length === 0 && <p style={{ color: theme.textDim }}>还没有行动记录。</p>}
        {trees.map((turn) => {
          const gameClock = fmtGameClock(turn);
          return (
          <details key={turn.id} style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0" }}>
            <summary style={{ cursor: "pointer", overflowWrap: "anywhere" }}>
              {fmtClock(turn.ts)}{gameClock ? ` · ${gameClock}` : ""} · {turn.background ? "后台 · " : ""}{turn.cmd} · {turn.queued && turn.commandId === "rollback" ? "回滚已排队" : turn.phase} {fmtMs(turn.totalMs)}
            </summary>
            <ol style={{ margin: "8px 0", paddingInlineStart: 24 }}>
              {turn.nodes.map((node) => (
                <li key={node.id} style={{ marginBottom: 6, overflowWrap: "anywhere" }}>
                  <small style={{ color: theme.textDim }}>{LAYER[node.layer]} · +{fmtMs(node.atMs)}</small>
                  {node.pipeline
                    ? <AiDetails node={node} theme={theme} />
                    : node.kind === "shadow"
                      ? <ShadowDetails node={node} theme={theme} />
                      : <div>{node.label}{node.detail && `：${node.detail}`}</div>}
                </li>
              ))}
            </ol>
          </details>
          );
        })}
      </section>
    </div>
  );
}

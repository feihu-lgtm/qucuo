import { useState, useSyncExternalStore } from "react";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { fmtClock, fmtGameClock, fmtMs, formatTrace, pipelineTabs } from "../../infra/actionTrace.js";
import ModalShell from "../primitives/ModalShell.jsx";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { chromeBtn } from "../../utils/theme.js";
import { gameStore, useGameStore, getGameEpoch } from "../../store/gameStore.js";
import { shadowAggregates } from "../../engine/act/shadow/shadowJudge.js";
import { drainShadowTasks, shadowStageCounts } from "../../engine/act/shadow/shadowStages.js";
import { formatShadowVerdicts, formatAggregate } from "../../engine/act/shadow/shadowFormat.js";
import { summarizeShadowCoverage, evaluateShadowThresholds } from "../../engine/act/shadow/shadowCoverage.js";
import {
  releaseMetricAggregates,
  releaseMetricsExport,
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


// A3-Review 修：drain 最长 60s，先 await 再 writeText 会超出点击的用户激活期导致
// 剪贴板写入被浏览器拒绝。ClipboardItem 接受 promise——在激活期内同步创建、
// 文本异步产出，是规范允许的延迟剪贴板写法；不支持的浏览器退回 writeText。
async function copyTextAfterWork(work) {
  const textPromise = (async () => await work())();
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        "text/plain": textPromise.then((t) => new Blob([t], { type: "text/plain" })),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch { /* 退回 writeText */ }
  }
  await navigator.clipboard.writeText(await textPromise);
}

export default function TraceViewer({ theme, onClose, onReport }) {
  const { trees } = useSyncExternalStore(turnMonitor.subscribe, turnMonitor.getSnapshot);
  const rawTime = useGameStore((s) => s.time);
  const gameTime = typeof rawTime === "number" && Number.isFinite(rawTime) ? rawTime : gameStore.getState().time;
  const [copied, setCopied] = useState("");
  const [reportCopied, setReportCopied] = useState("");
  const button = { ...chromeBtn(theme), fontFamily: "inherit" };
  const epoch = String(getGameEpoch());
  const shadowAgg = shadowAggregates(epoch);
  const metricsAgg = releaseMetricAggregates(epoch);
  const metricLines = formatReleaseMetricLines(metricsAgg);
  const showReleaseMetrics = resolveReleaseMetricsEnabled() || Boolean(metricLines);
  // 原 z 70 压在游说屏与酒馆事件（60）之上，单列 float-high 档保住这层先后。
    // 外壳的面板本身就是 role="dialog"，原 <section> 的样式整体移到 panelStyle。
  return (
    <ModalShell onClose={onClose} layer="float-high" mobile="none" chrome={false} showClose={false} ariaLabel="全流程日志"
      rootStyle={{ background: `color-mix(in srgb, ${theme.bg} 78%, transparent)` }}
      panelStyle={{
        width: "min(760px, calc(100vw - 24px))", maxHeight: "85dvh", overflow: "auto",
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
              {/* WO-16D-1：覆盖率/放行阈值评估只读附行——口径见 docs 5.2 节末 */}
              {(() => {
                const evaluation = evaluateShadowThresholds(summarizeShadowCoverage(shadowAgg));
                return (
                  <div style={{ marginTop: 4 }}>
                    {evaluation.pass
                      ? "放行阈值评估：通过"
                      : `放行阈值评估：不通过——${evaluation.failures.join("；")}`}
                  </div>
                );
              })()}
              {/* WO-16D-1：只读导出聚合 JSON 供 scripts/shadowCoverageReport.mjs 覆盖率评估——不碰游戏状态 */}
              <button type="button" style={{ ...button, marginTop: 4 }} onClick={async () => {
                try {
                  // A3：导出前收口——等在途影子结束（上限60s），超时计 pendingAtExport
                  await copyTextAfterWork(async () => {
                    const { pending } = await drainShadowTasks(60000);
                    const fresh = shadowAggregates(epoch);
                    return JSON.stringify({ ...fresh, stageCounts: shadowStageCounts(epoch), pendingAtExport: pending });
                  });
                  setCopied("聚合JSON已复制");
                } catch { setCopied("复制失败"); }
              }}>复制聚合JSON</button>
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
                  await copyTextAfterWork(async () => {
                    const { pending } = await drainShadowTasks(60000);
                    // drain 期间完成的 intake 也要进报告——stageCounts 已是 drain 后口径，
                    // metricsAgg 必须用同一时点重读，否则同一份报告两处计数对不上。
                    return formatReleaseGateMarkdown({ epoch, shadowAgg: shadowAggregates(epoch), metricsAgg: releaseMetricAggregates(epoch), stageCounts: shadowStageCounts(epoch), pendingAtExport: pending });
                  });
                  setReportCopied("已复制报告");
                } catch { setReportCopied("复制失败"); }
              }}>{reportCopied || "复制报告"}</button>
              {/* WO-16D-4：跨 epoch 全量聚合导出，shape 供 npm run release:report 离线消费 */}
              <button type="button" style={{ ...button, marginLeft: 4 }} onClick={async () => {
                try {
                  await copyTextAfterWork(async () => {
                    await drainShadowTasks(60000);
                    return JSON.stringify(releaseMetricsExport());
                  });
                  setReportCopied("指标JSON已复制");
                } catch { setReportCopied("复制失败"); }
              }}>复制放行指标JSON</button>
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
    </ModalShell>
  );
}

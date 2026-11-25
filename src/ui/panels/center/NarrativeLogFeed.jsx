import LogEntry from "../../components/LogEntry.jsx";
import { LOG_T } from "../../../domain/rules/log/logTypes.js";
import { getGameDay } from "../../../utils/mudHelpers.js";
import { useGameStore } from "../../../store/gameStore.js";

function formatEntryTurnLabel(entry) {
  if (typeof entry?.turn !== "number" || !Number.isFinite(entry.turn)) return "";
  const day = typeof entry.day === "number" ? entry.day : getGameDay(entry.turn);
  return `第${day}日·第${entry.turn}回合`;
}

function isNarrativePlaceholder(entry) {
  if (!entry.streaming) return false;
  const text = (entry.text || "").trim();
  return text === "▌" || text === "「旁白」▌";
}

function NarrativeSkeleton() {
  return (
    <div className="narrative-skeleton" role="status" aria-label="叙事生成中">
      <span /><span /><span />
    </div>
  );
}

export default function NarrativeLogFeed({
  hidden, zoneTheme, clr, isDayMode, act,
  collapsedGroups, setCollapsedGroups,
  loading, queueCount, pendingTalks, inspecting, logEnd,
}) {
  const log = useGameStore(s => s.log);

  const groups = [];
  let current = null;
  for (const entry of log) {
    const isStandaloneSys = entry.t === LOG_T.ROOM || entry.standalone;
    if (isStandaloneSys) {
      if (current) { groups.push(current); current = null; }
      groups.push({ standalone: entry });
    } else if (entry.t === LOG_T.CMD) {
      if (current) groups.push(current);
      current = { cmd: entry, replies: [] };
    } else {
      if (!current) current = { cmd: null, replies: [] };
      current.replies.push(entry);
    }
  }
  if (current) groups.push(current);

  let lastCommandIndex = -1;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].t === LOG_T.CMD) { lastCommandIndex = i; break; }
  }
  const lastCommand = lastCommandIndex >= 0 ? log[lastCommandIndex] : null;
  const currentReplies = lastCommandIndex >= 0 ? log.slice(lastCommandIndex + 1) : [];
  const hasNarrative = currentReplies.some(entry =>
    (entry.t === LOG_T.DESC || entry.t === LOG_T.NARRATOR) &&
    (!entry.streaming || !isNarrativePlaceholder(entry)));
  const showSkeleton = (loading || pendingTalks > 0 || inspecting) && !hasNarrative;
  if (showSkeleton) {
    const group = groups.find(item => item.cmd === lastCommand);
    if (group) {
      const placeholderIndex = group.replies.findIndex(isNarrativePlaceholder);
      if (placeholderIndex >= 0) group.replies[placeholderIndex] = { skeleton: true };
      else group.replies.push({ skeleton: true });
    } else {
      groups.push({ skeleton: true });
    }
  }

  // 天机落账卡：EffectReceiptCard 派发结构化 action（id/factId/op/kind 齐全），
  // 原样透传给 act——useTurn 在 intent 识别前的系统边界按 id 寻址确定性执行，
  // 行动识别关闭也同样生效。唯一例外是 viewPact：契约面板尚无结构化入口，
  // 保留文本指令（有意例外，见 docs/AI调用链架构说明.md）。
  const handleEntryAction = (a) => {
    if (a && typeof a === "object" && a.type === "effectReceipt") {
      if (a.op === "viewPact") {
        act("查看江湖契约");
        return;
      }
      act(a);
      return;
    }
    act(a);
  };

  return (
    <div data-testid="narrative-log" style={{ display: hidden ? "none" : "block", flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-narrative)", letterSpacing: "0.3px" }}>
      {groups.map((g, gi) => {
        if (g.skeleton) return <NarrativeSkeleton key={`skeleton-${gi}`} />;
        if (g.standalone) {
          const standaloneLabel = formatEntryTurnLabel(g.standalone);
          return (
            <div key={gi}>
              <LogEntry entry={g.standalone} color={clr[g.standalone.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
              {standaloneLabel && g.standalone.t === LOG_T.ROOM && (
                <div style={{ textAlign: "center", color: zoneTheme.textDim, fontSize: "var(--fs-2xs)", marginTop: -2, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
                  {standaloneLabel}
                </div>
              )}
              {standaloneLabel && g.standalone.t !== LOG_T.ROOM && g.standalone.text?.trim() && (
                <div style={{ color: zoneTheme.textDim, fontSize: "var(--fs-2xs)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
                  {standaloneLabel}
                </div>
              )}
            </div>
          );
        }
        const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
        const replyCount = g.replies.filter(entry => !entry.skeleton).length;
        const canCollapse = g.cmd && replyCount > 0;
        const collapsed = canCollapse && collapsedGroups.has(cmdIdx);
        const turnEntry = g.cmd || g.replies.find(entry => !entry.skeleton && typeof entry?.turn === "number");
        const groupTurnLabel = formatEntryTurnLabel(turnEntry);
        const toggleCollapse = canCollapse ? () => setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(cmdIdx)) next.delete(cmdIdx); else next.add(cmdIdx);
          return next;
        }) : undefined;

        return (
          <div
            key={gi}
            style={{
              border: `1px solid ${zoneTheme.border}`,
              borderRadius: 0,
              marginBottom: 10,
              background: "rgba(255,255,255,0.015)",
              overflow: "hidden",
            }}
          >
            {g.cmd && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "8px 12px",
                  cursor: canCollapse ? "pointer" : "default",
                  userSelect: "none",
                }}
                onClick={toggleCollapse}
              >
                <span style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-2xs)", flexShrink: 0, width: 10 }}>
                  {canCollapse ? (collapsed ? "▶" : "▼") : ""}
                </span>
                <div style={{ flex: 1 }}>
                  <LogEntry entry={g.cmd} color={clr[g.cmd.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
                </div>
                {groupTurnLabel && (
                  <span style={{ color: zoneTheme.textDim, fontSize: "var(--fs-2xs)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {groupTurnLabel}
                  </span>
                )}
                {collapsed && (
                  <span style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-2xs)", flexShrink: 0 }}>
                    +{replyCount}条
                  </span>
                )}
              </div>
            )}
            {!g.cmd && groupTurnLabel && g.replies.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px 0", color: zoneTheme.textDim, fontSize: "var(--fs-2xs)", fontVariantNumeric: "tabular-nums" }}>
                {groupTurnLabel}
              </div>
            )}
            {!collapsed && g.replies.length > 0 && (
              <div style={{ padding: g.cmd ? "0 12px 8px 26px" : "8px 12px" }}>
                {g.replies.map((entry, ri) => (
                  entry.skeleton
                    ? <NarrativeSkeleton key="narrative-skeleton" />
                    : <LogEntry key={ri} entry={entry} color={clr[entry.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {loading && (
        <div style={{ color: zoneTheme.accentDim, padding: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>▌</span>
          <span>引擎运转中</span>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: zoneTheme.accent, animation: `pulse 0.8s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </span>
          {queueCount > 0 && <span style={{ color: zoneTheme.accentDim, fontSize: "var(--fs-xs)" }}>排队中 {queueCount}</span>}
        </div>
      )}
      {pendingTalks > 0 && <div style={{ color: "var(--pink)", animation: "pulse 1.2s ease-in-out infinite" }}>  {pendingTalks} 条对话处理中...</div>}
      {inspecting && (
        <div style={{ color: zoneTheme.accentDim, padding: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>▌</span>
          <span>端详「{inspecting}」中</span>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: zoneTheme.accent, animation: `pulse 0.8s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </span>
        </div>
      )}
      <div ref={logEnd} />
    </div>
  );
}

import LogEntry from "../../components/LogEntry.jsx";
import { LOG_T } from "../../../domain/rules/log/logTypes.js";
import { useGameStore } from "../../../store/gameStore.js";

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

  return (
    <div data-testid="narrative-log" style={{ display: hidden ? "none" : "block", flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontSize: "15px", lineHeight: "var(--lh-narrative)", letterSpacing: "0.3px" }}>
      {groups.map((g, gi) => {
        if (g.skeleton) return <NarrativeSkeleton key={`skeleton-${gi}`} />;
        if (g.standalone) {
          return <LogEntry key={gi} entry={g.standalone} color={clr[g.standalone.t] || clr.desc} onAction={act} isDayMode={isDayMode} />;
        }
        const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
        const replyCount = g.replies.filter(entry => !entry.skeleton).length;
        const canCollapse = g.cmd && replyCount > 0;
        const collapsed = canCollapse && collapsedGroups.has(cmdIdx);
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
                <span style={{ color: zoneTheme.accentDim, fontSize: "10px", flexShrink: 0, width: 10 }}>
                  {canCollapse ? (collapsed ? "▶" : "▼") : ""}
                </span>
                <div style={{ flex: 1 }}>
                  <LogEntry entry={g.cmd} color={clr[g.cmd.t] || clr.desc} onAction={act} isDayMode={isDayMode} />
                </div>
                {collapsed && (
                  <span style={{ color: zoneTheme.accentDim, fontSize: "10px", flexShrink: 0 }}>
                    +{replyCount}条
                  </span>
                )}
              </div>
            )}
            {!collapsed && g.replies.length > 0 && (
              <div style={{ padding: g.cmd ? "0 12px 8px 26px" : "8px 12px" }}>
                {g.replies.map((entry, ri) => (
                  entry.skeleton
                    ? <NarrativeSkeleton key="narrative-skeleton" />
                    : <LogEntry key={ri} entry={entry} color={clr[entry.t] || clr.desc} onAction={act} isDayMode={isDayMode} />
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
          {queueCount > 0 && <span style={{ color: zoneTheme.accentDim, fontSize: "10.5px" }}>排队中 {queueCount}</span>}
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

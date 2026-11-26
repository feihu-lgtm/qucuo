import { useEffect, useRef } from "react";
import LogEntry, { NarrativeSkeleton, isNarrativePlaceholder } from "../../components/LogEntry.jsx";
import { formatRealDateTime, getGameDay, getTimeStr } from "../../../utils/mudHelpers.js";
import { useGameStore } from "../../../store/gameStore.js";
import { openOverlay, OVERLAY } from "../../../store/uiStore.js";
import { LOG_T } from "../../../domain/data/log/logTypes.js";

// 对象级稳定 React Key：彻底避免在流式占位/插入地名/后台补写时因数组下标左移右移，
// 导致 React 错认兄弟节点、重播入场动画或把行跳飞。
const ENTRY_UIDS = new WeakMap();
let nextEntryUid = 1;
function getStableUid(obj) {
  if (!obj || typeof obj !== "object") return String(obj ?? "");
  let id = ENTRY_UIDS.get(obj);
  if (!id) {
    id = `e${nextEntryUid++}`;
    ENTRY_UIDS.set(obj, id);
  }
  return id;
}

function getEntryRenderKey(entry, fallbackPrefix = "row") {
  if (!entry) return fallbackPrefix;
  // 流式占位 -> 超时过渡 -> 流式吐字 -> 完稿始终是同一个 fillKey（非 backfill prose/slot），
  // 锁定同一个 React key 与 DOM 节点，全程零闪烁零跳行。
  if (entry.fillKey && !entry.fillProse && entry.fillSlot == null) {
    return `stream:${entry.fillKey}`;
  }
  return `${fallbackPrefix}:${getStableUid(entry)}`;
}

function formatEntryTurnLabel(entry) {
  if (typeof entry?.turn !== "number" || !Number.isFinite(entry.turn)) return "";
  const day = typeof entry.day === "number" ? entry.day : getGameDay(entry.turn);
  const clock = getTimeStr(entry.turn).replace(/^第\d+日·/, "").replace("·", " ");
  return `第${day}日·第${entry.turn}回合 · ${clock}`;
}

function formatEntryClockLabel(entry) {
  if (entry?.realTs == null) return "";
  const clock = formatRealDateTime(entry.realTs, { withDate: false });
  return clock ? clock.slice(0, 5) : "";
}

function TimeBadge({ entry, className = "narrative-time-badge" }) {
  const turnLabel = formatEntryTurnLabel(entry);
  const clockLabel = formatEntryClockLabel(entry);
  if (!turnLabel && !clockLabel) return null;
  const fullTitle = entry?.realTs != null
    ? `${turnLabel}${turnLabel ? " · " : ""}现实 ${formatRealDateTime(entry.realTs, { withDate: true })}`
    : turnLabel;
  return (
    <span className={className} title={fullTitle}>
      {turnLabel && <span>{turnLabel}</span>}
      {clockLabel && <span className="narrative-time-clock">{clockLabel}</span>}
    </span>
  );
}

export default function NarrativeLogFeed({
  hidden, clr, isDayMode, act,
  collapsedGroups, setCollapsedGroups,
  loading, queueCount, pendingTalks, inspecting, logEnd,
}) {
  const log = useGameStore(s => s.log);
  const feedRef = useRef(null);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(0);

  const handleScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const prevLen = prevLenRef.current;
    const nextLen = log.length;
    prevLenRef.current = nextLen;
    if (hidden || nextLen === 0) return;
    const lastEntry = log[nextLen - 1];
    const isStreamingTail = Boolean(lastEntry?.streaming);
    const addedNew = nextLen > prevLen;
    if (!nearBottomRef.current && lastEntry?.t !== LOG_T.CMD) return;
    logEnd.current?.scrollIntoView?.({
      behavior: addedNew && !isStreamingTail ? "smooth" : "auto",
      block: "end",
    });
  }, [log, hidden, logEnd]);

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
  const hasPlaceholder = currentReplies.some(isNarrativePlaceholder);
  const showSkeleton = (loading || pendingTalks > 0 || inspecting) && !hasNarrative && !hasPlaceholder;

  // 天机落账卡：EffectReceiptCard 派发结构化 action（id/factId/op/kind 齐全），
  // 原样透传给 act——useTurn 在 intent 识别前的系统边界按 id 寻址确定性执行，
  // 行动识别关闭也同样生效。viewPact 已于 WO-22B-P4b 接结构化面板——
  // 「阅契」开江湖契约面板纯读账本，不再发自由文本回合。
  const handleEntryAction = (a) => {
    if (a && typeof a === "object" && a.type === "effectReceipt") {
      if (a.op === "viewPact") {
        openOverlay(OVERLAY.PACTS);
        return;
      }
      act(a);
      return;
    }
    act(a);
  };

  return (
    <div ref={feedRef} onScroll={handleScroll} data-testid="narrative-log" style={{ display: hidden ? "none" : "block", flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontSize: "var(--fs-lg)", lineHeight: "var(--lh-narrative)", letterSpacing: "0.3px" }}>
      {groups.map((g, gi) => {
        if (g.standalone) {
          const isRoom = g.standalone.t === LOG_T.ROOM;
          const hasText = Boolean(g.standalone.text?.trim());
          return (
            <div
              key={getEntryRenderKey(g.standalone, `standalone-${gi}`)}
              className={isRoom ? "narrative-standalone narrative-standalone--room" : "narrative-standalone"}
            >
              <div className="narrative-standalone-main">
                <LogEntry entry={g.standalone} color={clr[g.standalone.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
              </div>
              {isRoom && hasText && (
                <div className="narrative-room-time">
                  <TimeBadge entry={g.standalone} />
                </div>
              )}
              {!isRoom && hasText && <TimeBadge entry={g.standalone} />}
            </div>
          );
        }

        const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
        const replyCount = g.replies.length;
        const canCollapse = g.cmd && replyCount > 0;
        const collapsed = canCollapse && collapsedGroups.has(cmdIdx);
        const turnEntry = g.cmd || g.replies.find(entry => typeof entry?.turn === "number" || entry?.realTs != null);
        const groupKey = g.cmd ? getEntryRenderKey(g.cmd, `cmd-${gi}`)
          : (g.replies[0] ? `orphan-${getStableUid(g.replies[0])}` : `group-${gi}`);
        const isActiveGroup = Boolean(g.cmd && g.cmd === lastCommand);
        const toggleCollapse = canCollapse ? () => setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(cmdIdx)) next.delete(cmdIdx); else next.add(cmdIdx);
          return next;
        }) : undefined;

        let trackedTurn = typeof turnEntry?.turn === "number" ? turnEntry.turn : null;

        return (
          <div key={groupKey} className="narrative-group">
            {g.cmd && (
              <div
                className={collapsed ? "narrative-group-header" : "narrative-group-header narrative-group-header--open"}
                style={{ cursor: canCollapse ? "pointer" : "default" }}
                onClick={toggleCollapse}
              >
                <span className="narrative-group-arrow">
                  {canCollapse ? (collapsed ? "▶" : "▼") : ""}
                </span>
                <div className="narrative-group-cmd">
                  <LogEntry entry={g.cmd} color={clr[g.cmd.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
                </div>
                <TimeBadge entry={turnEntry} />
                {collapsed && (
                  <span className="narrative-group-count">+{replyCount}条</span>
                )}
              </div>
            )}
            {!g.cmd && turnEntry && g.replies.length > 0 && (
              <div className="narrative-orphan-time">
                <TimeBadge entry={turnEntry} />
              </div>
            )}
            {!collapsed && (g.replies.length > 0 || (isActiveGroup && showSkeleton)) && (
              <div className={g.cmd ? "narrative-group-body narrative-group-body--indented" : "narrative-group-body"}>
                {g.replies.map((entry, ri) => {
                  const entryTurn = typeof entry?.turn === "number" ? entry.turn : null;
                  const turnChanged = entryTurn !== null && trackedTurn !== null && entryTurn !== trackedTurn;
                  const isDuelBoundary = entry?.t === LOG_T.SYS && /──\s*与.+切磋\s*──/.test(entry.text || "");
                  const showDivider = (turnChanged || (isDuelBoundary && ri > 0)) && (entryTurn !== null || entry?.realTs != null);
                  if (entryTurn !== null) trackedTurn = entryTurn;
                  return (
                    <div key={getEntryRenderKey(entry, `reply-${groupKey}`)} className="narrative-reply-slot">
                      {showDivider && (
                        <div className="narrative-time-divider">
                          <span className="narrative-time-divider-line" />
                          <TimeBadge entry={entry} />
                        </div>
                      )}
                      <LogEntry entry={entry} color={clr[entry.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
                    </div>
                  );
                })}
                {isActiveGroup && showSkeleton && <NarrativeSkeleton key={`skel-${groupKey}`} />}
              </div>
            )}
          </div>
        );
      })}
      {!lastCommand && showSkeleton && <NarrativeSkeleton key="skel-root" />}
      {loading && (
        <div className="narrative-live-status">
          <span className="narrative-live-caret">▌</span>
          <span>引擎运转中</span>
          <span className="narrative-live-dots">
            <span /><span /><span />
          </span>
          {queueCount > 0 && <span className="narrative-live-queue">排队中 {queueCount}</span>}
        </div>
      )}
      {pendingTalks > 0 && <div className="narrative-live-talk">  {pendingTalks} 条对话处理中...</div>}
      {inspecting && (
        <div className="narrative-live-status">
          <span className="narrative-live-caret">▌</span>
          <span>端详「{inspecting}」中</span>
          <span className="narrative-live-dots">
            <span /><span /><span />
          </span>
        </div>
      )}
      <div ref={logEnd} />
    </div>
  );
}

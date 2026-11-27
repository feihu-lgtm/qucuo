import { useEffect, useMemo, useRef } from "react";
import LogEntry, { NarrativeSkeleton, isNarrativePlaceholder } from "../../components/LogEntry.jsx";
import { formatRealDateTime, getGameDay, getTimeStr } from "../../../utils/mudHelpers.js";
import { useGameStore } from "../../../store/gameStore.js";
import { openOverlay, OVERLAY } from "../../../store/uiStore.js";
import {
  useSessionUi, setActiveNpcMenu, setCenterView, setCharacterPageTarget, setInputCapsule,
} from "../../../store/sessionUiStore.js";
import { LOG_T } from "../../../domain/data/log/logTypes.js";
import { NPC_ART } from "../../../domain/data/art/artManifest.js";
import { createArrivalMarker, createClockMarker, createMapNoteFilter, foldFailedRuns, groupReplies, isRuleHint, ledgerText } from "./feedModel.js";
import ArtImage from "../../components/ArtImage.jsx";
import NpcAvatar from "../../components/NpcAvatar.jsx";
import { districtOfRoomLine, narratorArtUrl, placeArtUrl } from "../../art/art.js";

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

// 细看一组：行动行是「看 某人」（npcLookBackfill 落的指令原文），且此人是认得出的人物。
const LOOK_CMD_RE = /^>?\s*看[\s\u3000]+(.+?)\s*$/;
function lookTargetOf(cmd, knownSpeakers) {
  const name = cmd?.t === LOG_T.CMD ? String(cmd.text || "").match(LOOK_CMD_RE)?.[1] : null;
  return name && knownSpeakers.includes(name) ? name : null;
}

const LETTER_ENTRY_RE = /^[\s\u3000]*「([^」]+)来信」/;
const isLetterEntry = (entry) => Boolean(entry?.letterFrom)
  || (entry?.t === LOG_T.NARRATOR && LETTER_ENTRY_RE.test(entry.text || ""));
const isDuelBannerEntry = (entry) => entry?.t === LOG_T.SYS && /──\s*与.+切磋\s*──/.test(entry.text || "");
const isSettleBannerEntry = (entry) => entry?.t === LOG_T.AFFECTION && /◈\s*.+?·\s*战斗结算/.test(entry.text || "");

function shouldDivideGroupHeader(group, isActiveGroup, showSkeleton) {
  if (isActiveGroup && showSkeleton) return true;
  const replies = group?.replies || [];
  if (replies.length >= 2) return true;
  if (replies.length === 0) return false;
  const only = replies[0];
  if (only.t === LOG_T.LOOT || only.receipts?.length || isLetterEntry(only) || isDuelBannerEntry(only) || isSettleBannerEntry(only)) {
    return true;
  }
  const txt = (only.text || "").trim();
  return txt.includes("\n") || txt.length > 36;
}

function formatEntryTurnLabel(entry) {
  if (typeof entry?.turn !== "number" || !Number.isFinite(entry.turn)) return "";
  const day = typeof entry.day === "number" ? entry.day : getGameDay(entry.turn);
  const clock = getTimeStr(entry.turn).replace(/^第\d+日·/, "").replace("·", " ");
  return `第${day}日·第${entry.turn}回合 · ${clock}`;
}

// 时辰戳只标变化（规则见 feedModel.createClockMarker）：mark 为 null 时不写；
// 现实时间不再占正文位置，只留在悬停提示里。
function TimeBadge({ entry, mark, className = "narrative-time-badge" }) {
  if (!mark) return null;
  const turnLabel = formatEntryTurnLabel(entry);
  const fullTitle = entry?.realTs != null
    ? `${turnLabel}${turnLabel ? " · " : ""}现实 ${formatRealDateTime(entry.realTs, { withDate: true })}`
    : turnLabel;
  return (
    <span className={mark.full ? className : `${className} narrative-time-badge--compact`} title={fullTitle}>
      <span>{mark.text}</span>
    </span>
  );
}

function renderLedgerText(text) {
  const parts = String(text || "").split(/([−-]\d+|\+\d+)/g);
  return parts.map((part, idx) => {
    if (/^[−-]\d+$/.test(part)) return <span key={idx} className="narrative-ledger-dn">{part}</span>;
    if (/^\+\d+$/.test(part)) return <span key={idx} className="narrative-ledger-up">{part}</span>;
    return part;
  });
}

function LedgerRow({ entries }) {
  const items = entries.map((entry, i) => (
    <span key={i} className="narrative-ledger-item">{renderLedgerText(ledgerText(entry))}</span>
  ));
  return (
    <div className="narrative-ledger">
      <span className="narrative-ledger-tag">账</span>
      <span className="narrative-ledger-items">{items}</span>
    </div>
  );
}

export default function NarrativeLogFeed({
  hidden, clr, isDayMode, act,
  collapsedGroups, setCollapsedGroups,
  loading, queueCount, pendingTalks, inspecting, logEnd,
  playerAvatar = null,
}) {
  const log = useGameStore(s => s?.log) || [];
  const room = useGameStore(s => s?.room);
  const varTree = useGameStore(s => s?.varTree);
  const narratorAffection = useGameStore(s => s?.narrator?.affection ?? 0);
  const dialoguePortraitMode = useSessionUi(s => s?.dialoguePortraitMode || "gutter");
  const knownSpeakers = useMemo(() => {
    const set = new Set(NPC_ART);
    for (const npc of room?.npcs || []) if (npc?.name) set.add(npc.name);
    for (const name of Object.keys(varTree?.角色 || {})) if (name) set.add(name);
    return [...set];
  }, [room?.npcs, varTree?.角色]);
  const narratorPortraitSrc = narratorArtUrl(narratorAffection);
  const handleOpenNpc = (speakerName) => {
    if (!speakerName) return;
    if (speakerName === "旁白") {
      setInputCapsule({ kind: "whisper", name: "旁白" });
      return;
    }
    const inRoom = (room?.npcs || []).find(n => n?.name === speakerName);
    if (inRoom) {
      setActiveNpcMenu(inRoom);
      return;
    }
    if (varTree?.角色?.[speakerName]?.好感度 != null) {
      setCharacterPageTarget(speakerName);
      openOverlay(OVERLAY.CHARACTER_PAGE);
    }
  };
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
  const shownGroups = foldFailedRuns(groups);

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

  const markClock = createClockMarker();
  const markArrival = createArrivalMarker(districtOfRoomLine);
  let lastRoomEntry = null;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]?.t === LOG_T.ROOM && String(log[i].text || "").trim()) { lastRoomEntry = log[i]; break; }
  }
  const showMapLine = createMapNoteFilter();
  const openJournal = () => setCenterView("journal");
  const openSettings = () => openOverlay(OVERLAY.SETTINGS);
  const colorFor = (entry) => (isRuleHint(entry) ? "var(--text-dim)" : (clr[entry.t] || clr.desc));

  return (
    <div ref={feedRef} onScroll={handleScroll} data-testid="narrative-log" style={{ display: hidden ? "none" : "block", flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontFamily: "var(--font-center)", fontSize: "var(--fs-center-body)", lineHeight: "var(--lh-narrative)", letterSpacing: "0.3px" }}>
      {shownGroups.map((g, gi) => {
        if (g.standalone) {
          const entry = g.standalone;
          const isRoom = entry.t === LOG_T.ROOM;
          const isLetter = isLetterEntry(entry);
          const hasText = Boolean(entry.text?.trim());
          const quietOutside = entry.t === LOG_T.SYS || entry.t === LOG_T.ITEM;
          const entryColor = isRoom
            ? "var(--center-outside-room)"
            : quietOutside
              ? "var(--center-outside-text)"
              : colorFor(entry);
          const standaloneMark = (isRoom || !isLetter) && hasText ? markClock(entry) : null;
          // 进场横幅：换外层据点时，在地名行处放据点头图；地名就是据点名时由横幅压字代替那一行。
          const arrival = isRoom && hasText ? markArrival(entry) : null;
          const arrivalSrc = arrival ? placeArtUrl(arrival) : null;
          const lineIsDistrict = arrivalSrc && entry.text.trim() === arrival;
          const standaloneCls = isRoom
            ? "narrative-standalone narrative-standalone--room"
            : isLetter
              ? "narrative-standalone narrative-standalone--letter"
              : "narrative-standalone";
          return (
            <div
              key={getEntryRenderKey(entry, `standalone-${gi}`)}
              className={standaloneCls}
            >
              {arrivalSrc && (
                <div className="narrative-arrival">
                  <ArtImage src={arrivalSrc} alt={arrival} caption={arrival} animate={entry === lastRoomEntry} />
                </div>
              )}
              {!lineIsDistrict && <div className="narrative-standalone-main">
                <LogEntry
                  entry={entry}
                  color={entryColor}
                  onAction={handleEntryAction}
                  isDayMode={isDayMode}
                  onOpenLetters={() => openOverlay(OVERLAY.LETTERS)}
                  onOpenJournal={openJournal}
                  onOpenSettings={openSettings}
                  dialoguePortraitMode={dialoguePortraitMode}
                  knownSpeakers={knownSpeakers}
                  onOpenNpc={handleOpenNpc}
                  narratorPortraitSrc={narratorPortraitSrc}
                  playerAvatar={playerAvatar}
                />
              </div>}
              {isRoom && standaloneMark && (
                <div className="narrative-room-time">
                  <TimeBadge entry={entry} mark={standaloneMark} />
                </div>
              )}
              {!isRoom && !isLetter && <TimeBadge entry={entry} mark={standaloneMark} />}
            </div>
          );
        }

        const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
        // 进房描写去重要按渲染顺序逐组过滤，折叠的组也要过，否则展开状态会改变去重结果。
        const visibleReplies = g.replies.filter(showMapLine);
        const replyCount = visibleReplies.length;
        const canCollapse = g.cmd && replyCount > 0;
        const collapsed = canCollapse && collapsedGroups.has(cmdIdx);
        const turnEntry = g.cmd || g.replies.find(entry => typeof entry?.turn === "number" || entry?.realTs != null);
        const groupKey = g.cmd ? getEntryRenderKey(g.cmd, `cmd-${gi}`)
          : (g.replies[0] ? `orphan-${getStableUid(g.replies[0])}` : `group-${gi}`);
        const isActiveGroup = Boolean(g.cmd && g.cmd === lastCommand);
        const headerDivided = !collapsed && shouldDivideGroupHeader(g, isActiveGroup, showSkeleton);
        const toggleCollapse = canCollapse ? () => setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(cmdIdx)) next.delete(cmdIdx); else next.add(cmdIdx);
          return next;
        }) : undefined;

        let trackedTurn = typeof turnEntry?.turn === "number" ? turnEntry.turn : null;
        const headerMark = turnEntry && (g.cmd || g.replies.length > 0) ? markClock(turnEntry) : null;
        const units = groupReplies(visibleReplies);
        const lookName = lookTargetOf(g.cmd, knownSpeakers);
        const lookPortrait = lookName && dialoguePortraitMode !== "off";
        const foldKey = `unfold:${cmdIdx}`;
        const foldOpen = collapsedGroups.has(foldKey);
        const toggleFold = () => setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(foldKey)) next.delete(foldKey); else next.add(foldKey);
          return next;
        });
        const foldedList = (g.foldedCmds || []).map((c, ci) => (
          <div key={ci} className="narrative-folded-cmd">你　{String(c.text || "").replace(/^>\s*/, "")}</div>
        ));

        return (
          <div key={groupKey} className="narrative-group">
            {foldedList.length > 0 && (
              <div className="narrative-folded">
                <button type="button" className="log-inline-link" onClick={toggleFold}>
                  {foldOpen ? "收起" : `另有 ${foldedList.length} 句行动未计入`}
                </button>
                {foldOpen && <div className="narrative-folded-list">{foldedList}</div>}
              </div>
            )}
            {g.cmd && (
              <div
                className={collapsed
                  ? "narrative-group-header"
                  : headerDivided
                    ? "narrative-group-header narrative-group-header--open narrative-group-header--divided"
                    : "narrative-group-header narrative-group-header--open"}
                style={{ cursor: canCollapse ? "pointer" : "default" }}
                onClick={toggleCollapse}
              >
                <span className="narrative-group-arrow">
                  {canCollapse ? (collapsed ? "▶" : "▼") : ""}
                </span>
                <div className="narrative-group-cmd">
                  <LogEntry entry={g.cmd} color={clr[g.cmd.t] || clr.desc} onAction={handleEntryAction} isDayMode={isDayMode} />
                </div>
                <TimeBadge entry={turnEntry} mark={headerMark} />
                {collapsed && (
                  <span className="narrative-group-count">+{replyCount}条</span>
                )}
              </div>
            )}
            {!g.cmd && turnEntry && g.replies.length > 0 && headerMark && (
              <div className={shouldDivideGroupHeader(g, isActiveGroup, showSkeleton) ? "narrative-orphan-time narrative-orphan-time--divided" : "narrative-orphan-time"}>
                <TimeBadge entry={turnEntry} mark={headerMark} />
              </div>
            )}
            {!collapsed && (visibleReplies.length > 0 || (isActiveGroup && showSkeleton)) && (
              <div className={g.cmd ? "narrative-group-body narrative-group-body--indented" : "narrative-group-body"}>
                {(() => {
                  const rows = units.map((unit, ri) => {
                  const entry = unit.kind === "ledger" ? unit.entries[0] : unit.entry;
                  const entryTurn = typeof entry?.turn === "number" ? entry.turn : null;
                  const turnChanged = entryTurn !== null && trackedTurn !== null && entryTurn !== trackedTurn;
                  const isLetterRow = unit.kind === "entry" && isLetterEntry(entry);
                  const dividerMark = turnChanged ? markClock(entry) : null;
                  const showDivider = Boolean(dividerMark) || (isLetterRow && ri > 0 && entry?.realTs != null);
                  if (entryTurn !== null) trackedTurn = entryTurn;
                  return (
                    <div key={getEntryRenderKey(entry, `reply-${groupKey}`)} className="narrative-reply-slot">
                      {showDivider && (
                        <div className="narrative-time-divider">
                          <span className="narrative-time-divider-line" />
                          <TimeBadge entry={entry} mark={dividerMark} />
                        </div>
                      )}
                      {unit.kind === "ledger"
                        ? <LedgerRow entries={unit.entries} />
                        : (
                          <LogEntry
                            entry={entry}
                            color={colorFor(entry)}
                            onAction={handleEntryAction}
                            isDayMode={isDayMode}
                            onOpenLetters={() => openOverlay(OVERLAY.LETTERS)}
                            onOpenJournal={openJournal}
                            onOpenSettings={openSettings}
                            dialoguePortraitMode={dialoguePortraitMode}
                            knownSpeakers={knownSpeakers}
                            onOpenNpc={handleOpenNpc}
                            narratorPortraitSrc={narratorPortraitSrc}
                            playerAvatar={playerAvatar}
                            lookName={lookName}
                          />
                        )}
                    </div>
                  );
                });
                  if (!lookPortrait) return rows;
                  return (
                    <div className="narrative-look">
                      <NpcAvatar name={lookName} size="xl" onClick={() => handleOpenNpc(lookName)} title={`互动 · ${lookName}`} />
                      <div className="narrative-look-body">{rows}</div>
                    </div>
                  );
                })()}
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

import { lazy, Suspense, useEffect, useRef } from "react";
import TopBar from "./panels/TopBar.jsx";
import { LeftPanel, CenterPanel, RightPanel, MobileTabBar, usePanelFaces } from "./panels/gamePanels.js";
import NoticeToast from "./components/NoticeToast.jsx";
import { isMobileKeyboardOpen } from "../utils/mobileKeyboard.js";
import { didOpenCenterContent } from "../utils/mobileColumn.js";
import { OVERLAY, useOverlay } from "../store/uiStore.js";
import { gameActions, useGameStore } from "../store/gameStore.js";
import { useSessionUi, setInteractMode, setMobileColumn } from "../store/sessionUiStore.js";
import { THEME_VARS } from "../utils/theme.js";

const BigMapModal = lazy(() => import("./components/BigMapModal.jsx"));

export default function GameLayout({ layout }) {
  const {
    overlayHost, addLog, jotNote, activeBuffs, setVarTree,
    trainCost,
    ui, autosave, derived, turn, handlers,
  } = layout;
  const { playerActionHandlers, progressionHandlers, aiInspect } = handlers;

  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const time = useGameStore(s => s.time);
  const varTree = useGameStore(s => s.varTree);
  const char = useGameStore(s => s.char);
  const narrator = useGameStore(s => s.narrator);
  const companionState = useGameStore(s => s.companionState);
  const mapData = useGameStore(s => s.mapData);
  const questProgress = useGameStore(s => s.questProgress);
  const flags = useGameStore(s => s.flags);
  const inv = useGameStore(s => s.inv);
  const pot = useGameStore(s => s.pot);
  const exp = useGameStore(s => s.exp);
  const skills = useGameStore(s => s.skills);
  const log = useGameStore(s => s.log);

  const { setSkills, setInv } = gameActions;

  const { leftFaces, rightFaces } = usePanelFaces();
  const showDebug = useOverlay(OVERLAY.DEBUG);
  const showBasement = useOverlay(OVERLAY.BASEMENT);
  const previousCenterContent = useRef(null);
  const narrativeView = useRef({ visible: false, log: null });

  const { logEnd } = ui;
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileColumn = useSessionUi(s => s.mobileColumn);
  const uiScale = useSessionUi(s => s.uiScale);

  const interactMode = useSessionUi(s => s.interactMode);
  const pigeonTarget = useSessionUi(s => s.pigeonTarget);
  const inputCapsule = useSessionUi(s => s.inputCapsule);
  const talkTarget = useSessionUi(s => s.talkTarget);
  const loading = useSessionUi(s => s.loading);
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const tradingShop = useSessionUi(s => s.tradingShop);
  const duelPending = useSessionUi(s => s.duelPending);
  const mapBig = useSessionUi(s => s.mapBig);

  useEffect(() => {
    const content = {
      building: activeBuilding?.id, trade: tradingShop, duel: duelPending,
      interaction: interactMode !== "action" ? `${interactMode}:${pigeonTarget || talkTarget || ""}`
        : inputCapsule ? `capsule:${inputCapsule.kind}:${inputCapsule.name || ""}` : null,
      trauma: derived.seaTraumaActive, debug: showDebug, basement: showBasement,
    };
    const opened = didOpenCenterContent(previousCenterContent.current, content);
    previousCenterContent.current = content;
    if (isMobile && opened) setMobileColumn("center");
  }, [isMobile, activeBuilding?.id, tradingShop, duelPending, interactMode, pigeonTarget,
    inputCapsule, talkTarget, derived.seaTraumaActive, showDebug, showBasement, setMobileColumn]);

  useEffect(() => {
    const previous = narrativeView.current;
    const visible = !isMobile || mobileColumn === "center";
    if (visible) {
      if (isMobile && !previous.visible && previous.log !== log) {
        const seen = new Set(previous.log);
        if (previous.log === null || log.some(entry => !seen.has(entry))) {
          logEnd.current?.scrollIntoView({ behavior: "instant" });
        }
      }
      previous.log = log;
    }
    previous.visible = visible;
  }, [isMobile, mobileColumn, log, logEnd]);

  useEffect(() => {
    const viewport = window.visualViewport;
    let layoutHeight = window.innerHeight;
    const updateHeight = () => {
      const inputFocused = document.activeElement?.matches?.("input, textarea") ?? false;
      // iOS Safari can shrink innerHeight on scroll while the keyboard is still open.
      if (!inputFocused || window.innerHeight > layoutHeight) layoutHeight = window.innerHeight;
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      // 键盘遮住的布局视口底部高度 = innerHeight - offsetTop - vv.height。
      // 必须用当前 innerHeight 而非 layoutHeight：Android resizes-content 下
      // innerHeight 已随键盘收缩（此时 covered=0，不需要抬升）；iOS 键盘开着
      // innerHeight 收缩时也同理自然归零。
      const keyboardHeight = Math.max(0, Math.round(window.innerHeight - offsetTop - height));
      // 只在游戏指令输入框聚焦时才抬升输入栏，避免设置弹层里的输入框触发
      const commandFocused = document.activeElement?.closest?.(".mobile-input-bar") != null;
      document.documentElement.style.setProperty("--mobile-viewport-height", `${Math.round(height)}px`);
      document.documentElement.style.setProperty("--mobile-viewport-offset", `${Math.round(offsetTop)}px`);
      document.documentElement.style.setProperty("--mobile-keyboard-height", `${keyboardHeight}px`);
      const wasOpen = document.documentElement.hasAttribute("data-keyboard-open");
      const open = document.documentElement.toggleAttribute(
        "data-keyboard-open",
        isMobileKeyboardOpen({
          isMobile,
          isInputFocused: inputFocused,
          viewportHeight: viewport?.height,
          innerHeight: layoutHeight,
        }),
      );
      document.documentElement.toggleAttribute("data-input-lift", open && commandFocused);
      if (open && !wasOpen) requestAnimationFrame(() => logEnd?.current?.scrollIntoView?.({ block: "end" }));
    };
    updateHeight();
    viewport?.addEventListener("resize", updateHeight);
    viewport?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    document.addEventListener("focusin", updateHeight);
    document.addEventListener("focusout", updateHeight);
    return () => {
      viewport?.removeEventListener("resize", updateHeight);
      viewport?.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
      document.removeEventListener("focusin", updateHeight);
      document.removeEventListener("focusout", updateHeight);
      document.documentElement.removeAttribute("data-keyboard-open");
      document.documentElement.removeAttribute("data-input-lift");
      document.documentElement.style.removeProperty("--mobile-viewport-height");
      document.documentElement.style.removeProperty("--mobile-viewport-offset");
      document.documentElement.style.removeProperty("--mobile-keyboard-height");
    };
  }, [isMobile, logEnd]);

  return (
    <div
      className="game-layout"
      style={{ "--ui-scale": uiScale, display: "flex", flexDirection: "column", height: `${100 / uiScale}vh`, width: `${100 / uiScale}vw`, zoom: uiScale, background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: "var(--fs-md)", overflow: "hidden", transition: "background 1.2s ease, color 1.2s ease" }}
    >
      <TopBar
        zoneName={ui.zoneName}
        dispatchCommand={turn.dispatchCommand}
        autoSaveError={autosave.autoSaveError} lastAutoSave={autosave.lastAutoSave}
        playerAvatarCustom={ui.playerAvatarCustom} setPlayerAvatarCustom={ui.setPlayerAvatarCustom}
        AV_BASE={ui.AV_BASE} genderAvatar={ui.genderAvatar}
        turnControls={{ loading, stopRunning: turn.stopRunning, rollbackBlocked: turn.rollbackBlocked, rollbackOneStep: turn.rollbackOneStep, onMeditate: progressionHandlers?.meditate }}
        addLog={addLog}
      />

      {overlayHost}

      <div className="mobile-game-columns" style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        <LeftPanel
          isMobile={isMobile} mobileColumn={mobileColumn} faces={leftFaces} zoneName={ui.zoneName} S={ui.S}
          room={room} innerRoomName={innerRoomName} time={time}
          varTree={varTree} char={char}
          inputRef={ui.inputRef} addLog={addLog}
          mapData={mapData} questProgress={questProgress} flags={flags} inv={inv}
          inSeaOfMind={derived.inSeaOfMind} seaGate={derived.seaGate}
          enterSeaOfMind={playerActionHandlers.enterSeaOfMind} leaveSeaOfMind={playerActionHandlers.leaveSeaOfMind}
          act={turn.act} autoTravelTo={turn.autoTravelTo}
          uiGreen={ui.uiGreen} uiPink={ui.uiPink}
        />

        <CenterPanel ui={ui} derived={derived} turn={turn} handlers={handlers} addLog={addLog} jotNote={jotNote} setVarTree={setVarTree} />

        <RightPanel
          isMobile={isMobile} mobileColumn={mobileColumn} faces={rightFaces}
          questProgress={questProgress} flags={flags} S={ui.S}
          char={char} inv={inv} skills={skills} exp={exp} pot={pot}
          playerAvatar={ui.playerAvatar}
          companionState={companionState} onSwitchCompanion={playerActionHandlers.handleSwitchCompanion}
          onStationCompanion={handlers.screenHandlers.handleStationCompanion}
          trainNeigong={progressionHandlers.trainNeigong} trainWaigong={progressionHandlers.trainWaigong} trainCost={trainCost}
          effectiveSpecialNow={turn.effectiveSpecialNow} activeBuffs={activeBuffs}
          varTree={varTree}
          setSkills={setSkills} inspectItem={aiInspect.inspectItem} inspecting={aiInspect.inspecting}
          breakthroughSkill={progressionHandlers.breakthroughSkill}
          narrator={narrator} confessToNarrator={progressionHandlers.confessToNarrator}
          setInv={setInv}
        />
      </div>

      {isMobile && <MobileTabBar theme={THEME_VARS} column={mobileColumn} onSelect={setMobileColumn}
        leftFaces={leftFaces} rightFaces={rightFaces} />}

      {mapBig && (
        <Suspense fallback={null}>
          <BigMapModal
            act={turn.act}
            autoTravelTo={turn.autoTravelTo}
          />
        </Suspense>
      )}

      <NoticeToast />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
        ::selection{background:var(--accent-dim)}
        input::placeholder{color:var(--text-dim)}
        .log-streaming{opacity:0.92}
        .qbtn{transition:filter .15s ease,border-color .15s ease}
        .qbtn:hover{filter:brightness(1.25)}
      `}</style>
    </div>
  );
}

import { useEffect, useRef } from "react";
import TopBar from "../ui/panels/TopBar.jsx";
import { LeftPanel, CenterPanel, RightPanel, MobileTabBar, usePanelFaces } from "../ui/panels/gamePanels.js";
import ClickableMap from "../ui/components/ClickableMap.jsx";
import ZoomableMap from "../ui/components/ZoomableMap.jsx";
import NoticeToast from "../ui/components/NoticeToast.jsx";
import { QUCUO_MAP, isNodeUnlocked } from "../domain/data/map/qucuoMap.js";
import {
  hasInnerMap, getDistrictAnchor, getInnerRoom, visibleInnerExits,
  getInnerRoomNames, isInnerExitUnlocked,
} from "../domain/rules/map/innerMap.js";
import { DIRS } from "../utils/mudHelpers.js";
import { MAP_UI } from "../ui/mapUi.js";
import { isMobileKeyboardOpen } from "../utils/mobileKeyboard.js";
import { didOpenCenterContent } from "../utils/mobileColumn.js";
import { OVERLAY, useOverlay } from "../store/uiStore.js";

export default function GameLayout({ layout }) {
  const {
    overlayHost, uiScale, zoneTheme, isMobile, mobileColumn, setMobileColumn,
    rollbackBlocked, stopRunning, dispatchCommand,
    mobileTopMenu, setMobileTopMenu,
    isDayMode, setIsDayMode, uiGold, uiTurquoise, uiCrimson, uiPink,
    setSettingsInitialTab, autoSaveError, lastAutoSave, playerAvatarCustom,
    setPlayerAvatarCustom, AV_BASE, genderAvatar, S, room, innerRoomName,
    time, varTree, char, setChar, peoplePanel, setPeoplePanel, activeBuilding,
    setActiveBuilding, setActiveItemMenu, setActiveNpcMenu, setCharacterPageTarget,
    setPigeonTarget, setInteractMode, inputRef, addLog, pigeonTarget, portraits,
    portraitTarget, setPortraitTarget, interactMode, activeTarget, setActiveTarget,
    activeGroundItem, setActiveGroundItem,
    talkTarget, setTalkTarget,
    playerAvatar, slImgErr, setSlImgErr, slForm, setSnowLeopardForm,
    setSlFormState, pearlForm, setPearlForm, setPearlFormState, pearlImgErr,
    setPearlImgErr, narrator, narratorImgErr, setNarratorImgErr, companionState,
    mapView, setMapView, mapBig, setMapBig, mapData, questProgress, flags, inv,
    inSeaOfMind, seaGate, enterSeaOfMind, leaveSeaOfMind, loading, act,
    autoTravelTo, uiGreen, setLoading, rollbackOneStep, captureUndo, gm,
    setGm, pot, setPot, exp, setExp, dao, setDao, setVarTree, setNarrator,
    setMapData, setRoom, setInnerRoomName, teleportLookRef, setSkills, duelPending, confirmDuel,
    cancelDuel, tradingShop, setTradingShop, buildingPanelMinimized,
    setBuildingPanelMinimized, handleBuildingInn, handleBuildingHeal, skills,
    handleBuySkill, effectiveSpecialNow, inspectItem, jotNote, handleAcceptEscort, handleCollectGround,
    handleGamble, handleCollectPigeons, buyPigeon, handlePostSend, handleTravel,
    handleServiceOrder, handlePray, handleReadBook, handleBuyBook, deposit,
    depositedAt, handleDeposit, handleWithdraw, pledgedItems, handlePledge,
    handleRedeem, handleAcceptBounty, handleClaimBounty, handleForgeCommission,
    handleForgeDesign, handleJadeDesign, handleJadeCraft, gambleNegotiation,
    handleGambleTalk, handleGambleSettle, handleGambleInspect, handleListenRumor,
    handleJoinSect, handleAuctionWin, handleCook, seaTraumaActive, narratorVarsNow,
    invNames, handleComfort, handleResolveTrauma, sectMasterAffection, log,
    clr, collapsedGroups, setCollapsedGroups, queueCount, pendingTalks, inspecting,
    logEnd, waitSecs, availableQuestsHere, triggerQuestFromPanel,
    triggerQuestChoice, nsfwOn, setNsfwOn, meditate, justMeditated,
    pigeonDelayShichen, input, setInput, composingRef, onKey, handleSwitchCompanion,
    trainNeigong, trainWaigong, trainCost, activeBuffs, breakthroughSkill,
    confessToNarrator, setInv, mapBigCloseGuard,
  } = layout;
  const { leftFaces, rightFaces } = usePanelFaces();
  const showDebug = useOverlay(OVERLAY.DEBUG);
  const showBasement = useOverlay(OVERLAY.BASEMENT);
  const previousCenterContent = useRef(null);
  const narrativeView = useRef({ visible: false, log: null });

  useEffect(() => {
    const content = {
      building: activeBuilding?.id, trade: tradingShop, duel: duelPending,
      interaction: interactMode !== "action" ? `${interactMode}:${pigeonTarget || talkTarget || ""}` : null,
      trauma: seaTraumaActive, debug: showDebug, basement: showBasement,
    };
    const opened = didOpenCenterContent(previousCenterContent.current, content);
    previousCenterContent.current = content;
    if (isMobile && opened) setMobileColumn("center");
  }, [isMobile, activeBuilding?.id, tradingShop, duelPending, interactMode, pigeonTarget,
    talkTarget, seaTraumaActive, showDebug, showBasement, setMobileColumn]);

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
    const updateHeight = () => {
      const height = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--mobile-viewport-height", `${Math.round(height)}px`);
      document.documentElement.style.setProperty("--mobile-viewport-offset", `${Math.round(viewport?.offsetTop || 0)}px`);
      const wasOpen = document.documentElement.hasAttribute("data-keyboard-open");
      const open = document.documentElement.toggleAttribute(
        "data-keyboard-open",
        isMobileKeyboardOpen({
          isMobile,
          isInputFocused: document.activeElement?.matches?.("input, textarea") ?? false,
          viewportHeight: viewport?.height,
          innerHeight: window.innerHeight,
        }),
      );
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
      document.documentElement.style.removeProperty("--mobile-viewport-height");
      document.documentElement.style.removeProperty("--mobile-viewport-offset");
    };
  }, [isMobile, logEnd]);

  return (
    <div
      className="game-layout"
      style={{ display: "flex", flexDirection: "column", height: `${100 / uiScale}vh`, width: `${100 / uiScale}vw`, zoom: uiScale, background: zoneTheme.bg, color: zoneTheme.text, fontFamily: "var(--font-body)", fontSize: "12.5px", overflow: "hidden", transition: "background 1.2s ease, color 1.2s ease" }}
    >
      <TopBar
        isMobile={isMobile} mobileTopMenu={mobileTopMenu} setMobileTopMenu={setMobileTopMenu}
        zoneTheme={zoneTheme} isDayMode={isDayMode} setIsDayMode={setIsDayMode}
        setSettingsInitialTab={setSettingsInitialTab}
        dispatchCommand={dispatchCommand}
        autoSaveError={autoSaveError} lastAutoSave={lastAutoSave}
        playerAvatarCustom={playerAvatarCustom} setPlayerAvatarCustom={setPlayerAvatarCustom}
        AV_BASE={AV_BASE} genderAvatar={genderAvatar}
        turnControls={{ loading, stopRunning, rollbackBlocked, rollbackOneStep }} gm={gm} setGm={setGm} addLog={addLog}
      />

      {overlayHost}

      <div className="mobile-game-columns" style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        <LeftPanel
          isMobile={isMobile} mobileColumn={mobileColumn} faces={leftFaces}
          zoneTheme={zoneTheme} S={S}
          room={room} innerRoomName={innerRoomName} time={time}
          varTree={varTree} char={char}
          peoplePanel={peoplePanel} setPeoplePanel={setPeoplePanel}
          activeBuilding={activeBuilding} setActiveBuilding={setActiveBuilding}
          setActiveNpcMenu={setActiveNpcMenu}
          setCharacterPageTarget={setCharacterPageTarget}
          setPigeonTarget={setPigeonTarget} setInteractMode={setInteractMode} inputRef={inputRef} addLog={addLog}
          pigeonTarget={pigeonTarget}
          mapView={mapView} setMapView={setMapView} mapBig={mapBig} setMapBig={setMapBig}
          mapData={mapData} questProgress={questProgress} flags={flags} inv={inv}
          inSeaOfMind={inSeaOfMind} seaGate={seaGate} enterSeaOfMind={enterSeaOfMind} leaveSeaOfMind={leaveSeaOfMind}
          loading={loading} act={act} autoTravelTo={autoTravelTo}
          uiGreen={uiGreen} uiPink={uiPink}
        />

        <CenterPanel
          isMobile={isMobile} mobileColumn={mobileColumn}
          zoneTheme={zoneTheme} S={S}
          loading={loading} addLog={addLog}
          rollbackOneStep={rollbackOneStep} captureUndo={captureUndo}
          rollbackBlocked={rollbackBlocked} stopRunning={stopRunning} dispatchCommand={dispatchCommand}
          gm={gm} setGm={setGm}
          char={char} setChar={setChar} pot={pot} setPot={setPot} exp={exp} setExp={setExp}
          dao={dao} setDao={setDao}
          varTree={varTree} setVarTree={setVarTree} narrator={narrator} setNarrator={setNarrator}
          room={room} innerRoomName={innerRoomName}
          mapData={mapData} setMapData={setMapData} setRoom={setRoom} setInnerRoomName={setInnerRoomName}
          setInteractMode={setInteractMode} act={act} teleportLookRef={teleportLookRef}
          setSkills={setSkills} setInv={setInv}
          duelPending={duelPending} confirmDuel={confirmDuel} cancelDuel={cancelDuel}
          activeBuilding={activeBuilding} setActiveBuilding={setActiveBuilding}
          tradingShop={tradingShop} setTradingShop={setTradingShop}
          buildingPanelMinimized={buildingPanelMinimized} setBuildingPanelMinimized={setBuildingPanelMinimized}
          handleBuildingInn={handleBuildingInn} handleBuildingHeal={handleBuildingHeal}
          skills={skills} handleBuySkill={handleBuySkill}
          time={time} inv={inv} effectiveSpecialNow={effectiveSpecialNow}
          inspectItem={inspectItem} jotNote={jotNote} handleCollectGround={handleCollectGround}
          flags={flags} questProgress={questProgress}
          handleAcceptEscort={handleAcceptEscort} handleGamble={handleGamble}
          handleCollectPigeons={handleCollectPigeons} buyPigeon={buyPigeon}
          handlePostSend={handlePostSend} handleTravel={handleTravel}
          handleServiceOrder={handleServiceOrder}
          handlePray={handlePray} handleReadBook={handleReadBook} handleBuyBook={handleBuyBook}
          deposit={deposit} depositedAt={depositedAt} handleDeposit={handleDeposit} handleWithdraw={handleWithdraw}
          pledgedItems={pledgedItems} handlePledge={handlePledge} handleRedeem={handleRedeem}
          handleAcceptBounty={handleAcceptBounty} handleClaimBounty={handleClaimBounty}
          handleForgeCommission={handleForgeCommission} handleForgeDesign={handleForgeDesign}
          handleJadeDesign={handleJadeDesign} handleJadeCraft={handleJadeCraft}
          gambleNegotiation={gambleNegotiation} handleGambleTalk={handleGambleTalk}
          handleGambleSettle={handleGambleSettle} handleGambleInspect={handleGambleInspect}
          handleListenRumor={handleListenRumor}
          handleJoinSect={handleJoinSect} handleAuctionWin={handleAuctionWin}
          handleCook={handleCook}
          seaTraumaActive={seaTraumaActive}
          narratorVarsNow={narratorVarsNow}
          invNames={invNames}
          handleComfort={handleComfort} handleResolveTrauma={handleResolveTrauma}
          sectMasterAffection={sectMasterAffection}
          log={log} isDayMode={isDayMode} clr={clr}
          collapsedGroups={collapsedGroups} setCollapsedGroups={setCollapsedGroups}
          queueCount={queueCount} pendingTalks={pendingTalks} inspecting={inspecting}
          logEnd={logEnd} waitSecs={waitSecs}
          availableQuestsHere={availableQuestsHere}
          triggerQuestFromPanel={triggerQuestFromPanel} triggerQuestChoice={triggerQuestChoice}
          uiGreen={uiGreen} uiPink={uiPink} uiCrimson={uiCrimson}
          nsfwOn={nsfwOn} setNsfwOn={setNsfwOn}
          meditate={meditate} justMeditated={justMeditated}
          interactMode={interactMode} activeTarget={activeTarget} setActiveTarget={setActiveTarget}
          activeGroundItem={activeGroundItem} setActiveGroundItem={setActiveGroundItem}
          setTalkTarget={setTalkTarget}
          pigeonTarget={pigeonTarget} setPigeonTarget={setPigeonTarget} pigeonDelayShichen={pigeonDelayShichen}
          input={input} setInput={setInput} inputRef={inputRef} onKey={onKey} composingRef={composingRef}
        />

        <RightPanel
          isMobile={isMobile} mobileColumn={mobileColumn} faces={rightFaces}
          zoneTheme={zoneTheme} S={S}
          char={char} inv={inv} skills={skills} exp={exp} pot={pot}
          playerAvatar={playerAvatar}
          companionState={companionState} onSwitchCompanion={handleSwitchCompanion} slForm={slForm} setSnowLeopardForm={setSnowLeopardForm} setSlFormState={setSlFormState} slImgErr={slImgErr} setSlImgErr={setSlImgErr}
          pearlForm={pearlForm} setPearlForm={setPearlForm} setPearlFormState={setPearlFormState} pearlImgErr={pearlImgErr} setPearlImgErr={setPearlImgErr}
          trainNeigong={trainNeigong} trainWaigong={trainWaigong} trainCost={trainCost}
          effectiveSpecialNow={effectiveSpecialNow} activeBuffs={activeBuffs}
          varTree={varTree}
          setActiveNpcMenu={setActiveNpcMenu}
          setSkills={setSkills} inspectItem={inspectItem} inspecting={inspecting}
          breakthroughSkill={breakthroughSkill}
          setActiveItemMenu={setActiveItemMenu}
          narrator={narrator} confessToNarrator={confessToNarrator}
          setInv={setInv}
        />
      </div>

      {isMobile && <MobileTabBar theme={zoneTheme} column={mobileColumn} onSelect={setMobileColumn}
        leftFaces={leftFaces} rightFaces={rightFaces} />}

      {mapBig && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={mapBigCloseGuard.onMouseDown} onClick={mapBigCloseGuard.onClick}>
        <div style={{
          background: `url("${MAP_UI.scroll}") center/100% 100% no-repeat`,
          borderRadius: 0, minWidth: 300, width: "70vw", maxWidth: 980, maxHeight: "86vh", overflowY: "auto",
          padding: "14% 11% 9% 11%", boxSizing: "border-box",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#4a3520", fontSize: "13px", fontWeight: "bold" }}>{mapView === "inner" ? `村图·${room.name}内景全图` : "舆图·曲措乡全境"} <span style={{ color: "#7a6448", fontSize: "10px", fontWeight: "normal" }}>{mapView === "inner" ? "朱红为当前所在 · 点相邻房间前往" : "朱红为当前所在 · 点已探明据点自动前往 · 🔒需前置"}</span></span>
            <span style={{ color: "#6a4a2a", fontSize: "11px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap", minWidth: 56, flexShrink: 0 }} onClick={() => setMapBig(false)}>× 关闭</span>
          </div>
          {mapView === "outer" && (() => {
            const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
            const exitByDir = QUCUO_MAP[room.name]?.exits || {};
            const reachableDests = new Set(Object.values(exitByDir));
            const explored = new Set(Object.keys(mapData || {}));
            explored.add(room.name);
            const nodes = Object.entries(QUCUO_MAP)
              .filter(([name]) => explored.has(name))
              .map(([name, node]) => {
                const dirTo = Object.entries(exitByDir).find(([, d]) => d === name)?.[0] || null;
                const unlocked = isNodeUnlocked(name, { completedQuests: completed, flags });
                return {
                  name, x: node.x, y: node.y, explored: true,
                  current: name === room.name,
                  links: Object.values(node.exits || {}).filter(d => explored.has(d)),
                  reachable: name !== room.name && unlocked,
                  locked: reachableDests.has(name) && !unlocked,
                  dir: dirTo, dest: name,
                };
              });
            const go = (dir, dest, locked) => {
              if (loading) return;
              setMapBig(false);
              if (locked) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); return; }
              if (dest && mapData[dest] && dest !== room.name) { autoTravelTo(dest); return; }
              if (dir) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" }); }
            };
            return <ClickableMap nodes={nodes} onGo={go} accent={zoneTheme.accent} loading={loading} maxHeight="66vh" />;
          })()}
          {mapView === "inner" && (() => {
            if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim }}>此地无内景可绘。</div>;
            const curRoom = innerRoomName || getDistrictAnchor(room.name);
            const curExits = visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char });
            const adjacent = new Set(Object.values(curExits));
            const nodes = getInnerRoomNames(room.name).filter((rn) => {
              const rr = getInnerRoom(room.name, rn);
              return !rr?.unlockCondition || rr.unlockCondition.type === "stat" || isInnerExitUnlocked(rr.unlockCondition, { questProgress, flags, inv, char });
            }).map((rn) => {
              const r = getInnerRoom(room.name, rn) || {};
              const dirTo = Object.entries(curExits).find(([, d]) => d === rn)?.[0] || null;
              return {
                name: rn, x: r.x ?? 0, y: r.y ?? 0, explored: true,
                current: rn === curRoom,
                links: Object.values(r.exits || {}).filter(d => typeof d === "string"),
                reachable: adjacent.has(rn),
                dir: dirTo, dest: rn,
              };
            });
            const go = (dir) => { if (!loading && dir) { setMapBig(false); setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); } };
            return <ClickableMap nodes={nodes} onGo={go} accent="var(--clay)" loading={loading} maxHeight="66vh" />;
          })()}
        </div>
      </div>}

      <NoticeToast zoneTheme={zoneTheme} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${zoneTheme.border};border-radius:2px}
        ::selection{background:${zoneTheme.accentDim}}
        input::placeholder{color:${zoneTheme.textDim}}
        .log-streaming{opacity:0.92}
        .qbtn{transition:filter .15s ease,border-color .15s ease}
        .qbtn:hover{filter:brightness(1.25)}
      `}</style>
    </div>
  );
}

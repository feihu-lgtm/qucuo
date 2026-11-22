// 中栏（江湖）——三栏布局的正中一栏，游戏的主视野。
import IntentConfirmBar from "../components/IntentConfirmBar.jsx";
import { factionShopCoef } from "../../domain/rules/economy/factionRep.js";
import { DevControls, TurnControls } from "./TopBar.jsx";
import { chromeBtn } from "../../utils/theme.js";
import { useState, useEffect, lazy, Suspense } from "react";
import { OVERLAY, closeOverlay, openOverlay, useOverlay } from "../../store/uiStore.js";
import { gameActions, useGameStore } from "../../store/gameStore.js";
import { BUILDING_TYPE } from "../../domain/data/buildings/qucuoBuildings.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { getBuildingInstanceKey } from "./buildingInstanceKey.js";
import NarrativeLogFeed from "./center/NarrativeLogFeed.jsx";
import CenterFooterBar from "./center/CenterFooterBar.jsx";

const TradingScreen = lazy(() => import("../screens/TradingScreen.jsx"));
const DebugPanel = lazy(() => import("./DebugPanel.jsx"));
const BasementScreen = lazy(() => import("../screens/buildings/ServiceScreen.jsx").then(m => ({ default: m.BasementScreen })));
const SeaOfMindScreen = lazy(() => import("./SeaOfMindScreen.jsx"));
const BuildingScreens = lazy(async () => {
  const { BUILDING_SCREENS } = await import("./buildingScreens.jsx");
  return { default: ({ type, ctx }) => BUILDING_SCREENS[type]?.(ctx) ?? null };
});

function ScreenFallback({ zoneTheme }) {
  return <div style={{ padding: "12px 16px", fontSize: 11.5, color: zoneTheme.textDim }}>载入中…</div>;
}

export default function CenterPanel({ ui, derived, turn, handlers, addLog, jotNote, setVarTree }) {
  const {
    isMobile, mobileColumn, zoneTheme, S, loading, gm, setGm,
    duelPending, activeBuilding, setActiveBuilding, tradingShop, setTradingShop,
    buildingPanelMinimized, setBuildingPanelMinimized, gambleNegotiation,
    isDayMode, clr, collapsedGroups, setCollapsedGroups,
    queueCount, pendingTalks, logEnd, setInteractMode,
  } = ui;
  const {
    duelHandlers, buildingHandlers, craftingAI, pigeonHandlers,
    playerActionHandlers, aiInspect,
  } = handlers;

  const char = useGameStore(s => s.char);
  const pot = useGameStore(s => s.pot);
  const exp = useGameStore(s => s.exp);
  const dao = useGameStore(s => s.dao);
  const varTree = useGameStore(s => s.varTree);
  const narrator = useGameStore(s => s.narrator);
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const mapData = useGameStore(s => s.mapData);
  const skills = useGameStore(s => s.skills);
  const time = useGameStore(s => s.time);
  const inv = useGameStore(s => s.inv);
  const flags = useGameStore(s => s.flags);
  const questProgress = useGameStore(s => s.questProgress);
  const deposit = useGameStore(s => s.deposit);
  const depositedAt = useGameStore(s => s.depositedAt);
  const pledgedItems = useGameStore(s => s.pledgedItems);

  const {
    setChar, setPot, setExp, setDao, setNarrator,
    setMapData, setRoom, setInnerRoomName, setSkills, setInv,
  } = gameActions;

  const runCommand = (id, fn) => turn.dispatchCommand ? turn.dispatchCommand(id, fn) : fn();
  const [craftTab, setCraftTab] = useState("shop");
  const [gambleStoneMinimized, setGambleStoneMinimized] = useState(false);
  useEffect(() => { setCraftTab("shop"); }, [activeBuilding?.id]);
  useEffect(() => { setGambleStoneMinimized(false); }, [activeBuilding?.id]);
  const isJade = activeBuilding?.craft === "jade";
  const tab = (key, label) => (
    <span key={key} className="mobile-touch-target" onClick={() => setCraftTab(key)}
      style={{
        cursor: "pointer", padding: "2px 12px", fontSize: 11.5, borderRadius: 0,
        color: craftTab === key ? zoneTheme.bg : zoneTheme.accent,
        background: craftTab === key ? zoneTheme.accent : "transparent",
        border: `1px solid ${craftTab === key ? zoneTheme.accent : zoneTheme.border}`,
      }}>{label}</span>
  );
  const tabs = (className) => (
    <div className={className} style={{ display: "flex", gap: 6, padding: "2px 16px 8px" }}>
      {tab("shop", "现货")}
      {tab("craft", isJade ? "玉器定制" : "拿料定制")}
    </div>
  );
  const showDebug = useOverlay(OVERLAY.DEBUG);
  const showBasement = useOverlay(OVERLAY.BASEMENT);
  const hideNarrative = Boolean((activeBuilding || tradingShop) && !buildingPanelMinimized);

  return (
    <div style={isMobile ? { flex: 1, ...S.panel, borderRight: "none", display: mobileColumn === "center" ? "flex" : "none" } : { flex: 55, ...S.panel }}>
      <div className="mobile-hide" style={{ ...S.label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>江湖</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <TurnControls theme={zoneTheme} loading={loading} stopRunning={turn.stopRunning} rollbackBlocked={turn.rollbackBlocked} rollbackOneStep={turn.rollbackOneStep} />
          <DevControls theme={zoneTheme} gm={gm} setGm={setGm} addLog={addLog} />
        </span>
      </div>

      {showDebug && (
        <Suspense fallback={<ScreenFallback zoneTheme={zoneTheme} />}>
          <DebugPanel
            isMobile={isMobile} zoneTheme={zoneTheme}
            char={char} setChar={setChar} pot={pot} setPot={setPot} exp={exp} setExp={setExp}
            dao={dao} setDao={setDao} varTree={varTree} setVarTree={setVarTree}
            narrator={narrator} setNarrator={setNarrator}
            room={room} innerRoomName={innerRoomName}
            mapData={mapData} setMapData={setMapData} setRoom={setRoom} setInnerRoomName={setInnerRoomName}
            addLog={addLog} setInteractMode={setInteractMode} act={turn.act}
            teleportLookRef={turn.teleportLookRef} setSkills={setSkills} setInv={setInv}
          />
        </Suspense>
      )}

      {derived.seaTraumaActive && (
        <Suspense fallback={null}>
          <SeaOfMindScreen
            narratorVars={derived.narratorVarsNow} invNames={derived.invNames} zoneTheme={zoneTheme}
            onComfort={playerActionHandlers.handleComfort} onResolve={playerActionHandlers.handleResolveTrauma}
          />
        </Suspense>
      )}

      <IntentConfirmBar zoneTheme={zoneTheme} />
      {duelPending && (
        <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(196,80,68,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text)", fontSize: "12px", flex: 1 }}>是否与「{duelPending.name}」正式切磋？一旦开打，就要见真章了。</span>
          <span onClick={duelHandlers.confirmDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 0, color: "var(--ink-bg-panel)", background: "var(--red-soft)", border: "1px solid var(--red-soft)" }}>确认切磋</span>
          <span onClick={duelHandlers.cancelDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 0, color: "var(--text-dim)", border: "1px solid #2a2d3a" }}>算了</span>
        </div>
      )}

      {(activeBuilding || tradingShop) && buildingPanelMinimized && (
        <div
          onClick={() => setBuildingPanelMinimized(false)}
          style={{ flexShrink: 0, padding: "6px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: 11.5, color: "var(--info)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>▸ {activeBuilding?.name || tradingShop?.shopName}（已最小化，点击展开）</span>
        </div>
      )}

      {(activeBuilding || tradingShop) && (
        <div
          key={getBuildingInstanceKey(activeBuilding, tradingShop)}
          className={`mobile-building-root${gambleStoneMinimized ? " mobile-building-minimized-root" : ""}${buildingPanelMinimized ? " mobile-building-hidden" : ""}`}
          style={{
            flex: 1, minHeight: 0, height: "100%", overflowY: "auto",
            borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.02)",
            display: buildingPanelMinimized ? "none" : undefined,
            visibility: buildingPanelMinimized ? "hidden" : undefined,
            pointerEvents: buildingPanelMinimized ? "none" : undefined,
          }}
        >
          {/* 最小化入口：跟每个面板自己的"× 关闭"平级，点击收起渲染区但保留 activeBuilding 状态 */}
          <div className="mobile-building-minimize"
            onClick={() => setBuildingPanelMinimized(true)}
            style={{ padding: "4px 16px", fontSize: 10.5, color: "var(--text-dim)", cursor: "pointer", textAlign: "right" }}
          >
            ▾ 最小化
          </div>
          {queueCount > 0 && !gambleStoneMinimized && !activeBuilding?.shopKey && !tradingShop && (
            <div role="status" aria-live="polite"
              style={{ ...chromeBtn(zoneTheme), alignSelf: "flex-start", flexShrink: 0, margin: "4px 12px", cursor: "default" }}>
              ⏳ 排队中 {queueCount} · 等待落盘后执行
            </div>
          )}
          {isMobile && activeBuilding?.craft && craftTab !== "shop" && tabs("mobile-trading-tabs-building")}
          {(() => {
            if (!activeBuilding) return null;
            if (showBasement && (activeBuilding.type === BUILDING_TYPE.RESTAURANT || activeBuilding.type === BUILDING_TYPE.THEATER)) return null;
            const ctx = {
              building: activeBuilding, char, time, zoneTheme, inv, skills, flags, questProgress,
              dao, mapData, room, innerRoomName, varTree, queueCount, effectiveSpecialNow: turn.effectiveSpecialNow,
              craftTab, tabs, isJade, runCommand, captureUndo: turn.captureUndo, setDao, setChar, setInv, addLog, jotNote,
              inspectItem: aiInspect.inspectItem, setGambleStoneMinimized, gambleNegotiation,
              deposit, depositedAt, pledgedItems,
              sectMasterAffection: derived.sectMasterAffection,
              closeBuilding: () => setActiveBuilding(null),
              openBasement: () => openOverlay(OVERLAY.BASEMENT),
              ...buildingHandlers,
              ...craftingAI,
              handleCollectPigeons: pigeonHandlers.handleCollectPigeons,
              buyPigeon: pigeonHandlers.buyPigeon,
              handlePostSend: pigeonHandlers.handlePostSend,
            };
            return (
              <Suspense fallback={<ScreenFallback zoneTheme={zoneTheme} />}>
                <BuildingScreens type={activeBuilding.type} ctx={ctx} />
              </Suspense>
            );
          })()}
          {showBasement && (
            <Suspense fallback={<ScreenFallback zoneTheme={zoneTheme} />}>
              <BasementScreen char={char} time={time} zoneTheme={zoneTheme} inline
                onClose={() => closeOverlay(OVERLAY.BASEMENT)} onOrder={buildingHandlers.handleServiceOrder} />
            </Suspense>
          )}
          {tradingShop && (
            <Suspense fallback={<ScreenFallback zoneTheme={zoneTheme} />}>
              <TradingScreen inline queueCount={queueCount} shopName={tradingShop.shopName} shopItems={tradingShop.items}
                playerInv={inv} playerMoney={char.money || 0} playerWit={turn.effectiveSpecialNow?.智谋 ?? 5} repCoef={factionShopCoef(varTree, room?.name)} zoneTheme={zoneTheme} onInspect={aiInspect.inspectItem}
                onClose={() => setTradingShop(null)}
                onBuy={(item) => runCommand("shopBuy", () => { if ((char.money || 0) < item.buyPrice) return; turn.captureUndo(); setChar(c => ({ ...c, money: c.money - item.buyPrice })); setInv(prev => [...prev, { ...item, id: `${item.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, equipped: false }]); addLog([{ t: "item", text: `  你花费${item.buyPrice}两，购得「${item.name}」。` }]); jotNote({ text: `购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB }); })}
                onSell={(item) => runCommand("shopSell", () => { if (item.equipped) return; turn.captureUndo(); setInv(prev => prev.filter(i => (typeof i === "object" ? i.id : i) !== item.id)); setChar(c => ({ ...c, money: (c.money || 0) + item.sellPrice })); addLog([{ t: "item", text: `  你卖出「${item.name}」，得银两${item.sellPrice}两。` }]); jotNote({ text: `卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); })}
              />
            </Suspense>
          )}
        </div>
      )}

      <NarrativeLogFeed
        hidden={hideNarrative}
        zoneTheme={zoneTheme} clr={clr} isDayMode={isDayMode} act={turn.act}
        collapsedGroups={collapsedGroups} setCollapsedGroups={setCollapsedGroups}
        loading={loading} queueCount={queueCount} pendingTalks={pendingTalks}
        inspecting={aiInspect.inspecting} logEnd={logEnd}
      />

      <CenterFooterBar ui={ui} turn={turn} handlers={handlers} />
    </div>
  );
}

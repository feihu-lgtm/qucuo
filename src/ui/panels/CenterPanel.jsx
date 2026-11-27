// 中栏（江湖）——三栏布局的正中一栏，游戏的主视野。
import IntentConfirmBar from "../components/IntentConfirmBar.jsx";
import { factionShopCoef } from "../../domain/rules/economy/factionRep.js";
import { DevControls, TurnControls } from "./TopBar.jsx";
import { THEME_VARS, chromeBtn } from "../../utils/theme.js";
import { useState, useEffect, lazy, Suspense } from "react";
import { OVERLAY, closeOverlay, openOverlay, useOverlay } from "../../store/uiStore.js";
import { gameActions, useGameStore } from "../../store/gameStore.js";
import {
  useSessionUi, setInteractMode, setActiveBuilding, setTradingShop,
  setBuildingPanelMinimized, setCollapsedGroups, setCenterView,
} from "../../store/sessionUiStore.js";
import { BUILDING_TYPE } from "../../domain/data/buildings/qucuoBuildings.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { applyTradeToNpcState, buyFromNpcCarry, sellToNpcCarry, resolveBuyInId } from "../../domain/rules/npc/npcTradeFlow.js";
import { getBuildingInstanceKey } from "./buildingInstanceKey.js";
import NarrativeLogFeed from "./center/NarrativeLogFeed.jsx";
import JuanzongView from "./center/JuanzongView.jsx";
import CenterFooterBar from "./center/CenterFooterBar.jsx";

const TradingScreen = lazy(() => import("../screens/TradingScreen.jsx"));
const DebugPanel = lazy(() => import("./DebugPanel.jsx"));
const BasementScreen = lazy(() => import("../screens/buildings/ServiceScreen.jsx").then(m => ({ default: m.BasementScreen })));
const SeaOfMindScreen = lazy(() => import("./SeaOfMindScreen.jsx"));
const BuildingScreens = lazy(async () => {
  const { renderBuildingScreen } = await import("./buildingScreens.jsx");
  return { default: ({ type, ctx }) => renderBuildingScreen(type, ctx) };
});

function ScreenFallback() {
  return <div style={{ padding: "12px 16px", fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>载入中…</div>;
}

export default function CenterPanel({ ui, derived, turn, handlers, addLog, jotNote, setVarTree }) {
  const {  S,
    isDayMode, clr,
    logEnd,
  } = ui;
  const collapsedGroups = useSessionUi(s => s.collapsedGroups);
  const centerView = useSessionUi(s => s.centerView);
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileColumn = useSessionUi(s => s.mobileColumn);
  const loading = useSessionUi(s => s.loading);
  const queueCount = useSessionUi(s => s.queueCount);
  const pendingTalks = useSessionUi(s => s.pendingTalks);
  const duelPending = useSessionUi(s => s.duelPending);
  const activeBuilding = useSessionUi(s => s.activeBuilding);
  const tradingShop = useSessionUi(s => s.tradingShop);
  const buildingPanelMinimized = useSessionUi(s => s.buildingPanelMinimized);
  const gambleNegotiation = useSessionUi(s => s.gambleNegotiation);
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
    setMapData, setRoom, setInnerRoomName, setSkills, setInv, setNpcState,
  } = gameActions;

  const runCommand = (id, fn) => turn.dispatchCommand ? turn.dispatchCommand(id, fn) : fn();
  const [craftTab, setCraftTab] = useState("shop");
  const [gambleStoneMinimized, setGambleStoneMinimized] = useState(false);
  useEffect(() => { setCraftTab("shop"); }, [activeBuilding?.id]);
  useEffect(() => { setGambleStoneMinimized(false); }, [activeBuilding?.id]);
  const isJade = activeBuilding?.craft === "jade";
  const tab = (key, label) => (
    <span key={key} className="mobile-touch-target craft-tab" data-on={craftTab === key} onClick={() => setCraftTab(key)}>{label}</span>
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
    <div className={`center-panel-col${isMobile && mobileColumn !== "center" ? " mobile-col-hidden" : ""}`} data-mobile={Boolean(isMobile)}>
      <div className="mobile-hide panel-col-head center-header">
        <span className="center-view-head">
          <span>江湖</span>
          <span className="center-view-switch" role="group" aria-label="江湖栏视图">
            <button type="button" className="center-view-tab" data-on={centerView !== "journal"} aria-pressed={centerView !== "journal"} onClick={() => setCenterView("story")}>正文</button>
            <button type="button" className="center-view-tab" data-on={centerView === "journal"} aria-pressed={centerView === "journal"} onClick={() => setCenterView("journal")}>卷宗</button>
          </span>
        </span>
        <span className="center-header-tools">
          <TurnControls theme={THEME_VARS} loading={loading} stopRunning={turn.stopRunning} rollbackBlocked={turn.rollbackBlocked} rollbackOneStep={turn.rollbackOneStep} />
          <DevControls theme={THEME_VARS} addLog={addLog} />
        </span>
      </div>

      {showDebug && (
        <Suspense fallback={<ScreenFallback />}>
          <DebugPanel
            isMobile={isMobile}
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
            narratorVars={derived.narratorVarsNow} invNames={derived.invNames}
            onComfort={playerActionHandlers.handleComfort} onResolve={playerActionHandlers.handleResolveTrauma}
          />
        </Suspense>
      )}

      <IntentConfirmBar />
      {duelPending && (
        <div className="center-confirm-bar center-confirm-bar--duel">
          <span className="center-confirm-text">{duelPending.lethal
            ? `是否与「${duelPending.name}」生死相搏？既分高下，也决生死——这一战没有点到为止。`
            : `是否与「${duelPending.name}」正式切磋？一旦开打，就要见真章了。`}</span>
          <span className="duel-confirm-btn" onClick={duelHandlers.confirmDuel}>{duelPending.lethal ? "决生死" : "确认切磋"}</span>
          <span className="duel-cancel-btn" onClick={duelHandlers.cancelDuel}>算了</span>
        </div>
      )}

      {(activeBuilding || tradingShop) && buildingPanelMinimized && (
        <div
          onClick={() => setBuildingPanelMinimized(false)}
          style={{ flexShrink: 0, padding: "6px 16px", borderBottom: `1px solid var(--border)`, background: "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: "var(--fs-sm)", color: "var(--info)", display: "flex", alignItems: "center", gap: 6 }}
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
            borderBottom: `1px solid var(--border)`, background: "rgba(255,255,255,0.02)",
            display: buildingPanelMinimized ? "none" : "flex", flexDirection: "column",
            visibility: buildingPanelMinimized ? "hidden" : undefined,
            pointerEvents: buildingPanelMinimized ? "none" : undefined,
          }}
        >
          {/* 最小化入口：跟每个面板自己的"× 关闭"平级，点击收起渲染区但保留 activeBuilding 状态 */}
          <div className="mobile-building-minimize"
            onClick={() => setBuildingPanelMinimized(true)}
            style={{ padding: "4px 16px", fontSize: "var(--fs-xs)", color: "var(--text-dim)", cursor: "pointer", textAlign: "right" }}
          >
            ▾ 最小化
          </div>
          {queueCount > 0 && !gambleStoneMinimized && !activeBuilding?.shopKey && !tradingShop && (
              <div role="status" aria-live="polite"
                style={{ ...chromeBtn(THEME_VARS), alignSelf: "flex-start", flexShrink: 0, margin: "4px 12px", cursor: "default" }}>
                排队中 {queueCount} · 等待落盘后执行
              </div>
          )}
          {isMobile && activeBuilding?.craft && craftTab !== "shop" && tabs("mobile-trading-tabs-building")}
          {(() => {
            if (!activeBuilding) return null;
            if (showBasement && (activeBuilding.type === BUILDING_TYPE.RESTAURANT || activeBuilding.type === BUILDING_TYPE.THEATER)) return null;
            const ctx = {
              building: activeBuilding, char, time, inv, skills, flags, questProgress,
              dao, mapData, room, innerRoomName, varTree, queueCount, effectiveSpecialNow: turn.effectiveSpecialNow,
              craftTab, tabs, isJade, runCommand, act: turn.act, captureUndo: turn.captureUndo, setDao, setChar, setInv, addLog, jotNote,
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
              <Suspense fallback={<ScreenFallback />}>
                <BuildingScreens type={activeBuilding.type} ctx={ctx} />
              </Suspense>
            );
          })()}
          {showBasement && (
            <Suspense fallback={<ScreenFallback />}>
              <BasementScreen char={char} time={time} inline
                onClose={() => closeOverlay(OVERLAY.BASEMENT)} onOrder={buildingHandlers.handleServiceOrder} />
            </Suspense>
          )}
          {tradingShop && (
            <Suspense fallback={<ScreenFallback />}>
              <TradingScreen inline queueCount={queueCount} shopName={tradingShop.shopName} shopItems={tradingShop.items}
                playerInv={inv} playerMoney={char.money || 0} playerWit={turn.effectiveSpecialNow?.智谋 ?? 5} repCoef={factionShopCoef(varTree, tradingShop.district ?? room?.name)} onInspect={aiInspect.inspectItem}
                onClose={() => setTradingShop(null)}
                onBuy={(item) => runCommand("shopBuy", () => { if (item.displayOnly || item.notForSale) return; const aff = varTree?.角色?.[tradingShop.npcName]?.好感度 ?? 0; const npc = (room?.npcs || []).find(n => (tradingShop.npcId && n.id === tradingShop.npcId) || n.name === tradingShop.npcName); const res = npc ? buyFromNpcCarry(npc, item, { affection: aff, money: char.money || 0 }) : { ok: false, logs: [{ t: "sys", text: "  对方已经不在此地了。" }] }; if (!res.ok) { if (res.logs) addLog(res.logs); return; } turn.captureUndo(); setChar(c => ({ ...c, money: c.money - res.price })); setInv(prev => [...prev, { ...item, id: resolveBuyInId(item, prev), equipped: false }]); if (npc && res.nextCarriedItems) { const key = npc.id ?? npc.name; setRoom(r => ({ ...r, npcs: r.npcs.map(n => n === npc || n.id === npc.id ? { ...n, carriedItems: res.nextCarriedItems } : n) })); setNpcState(s => applyTradeToNpcState(s, npc, res.tradeDelta)); } addLog(res.logs || [{ t: "item", text: `  你花费${res.price}两，购得「${item.name}」。` }]); jotNote({ text: `购得「${item.name}」，花${res.price}两。`, source: NOTE_SOURCE.DUMB }); })}
                onSell={(item) => runCommand("shopSell", () => { if (item.equipped) return; const aff = varTree?.角色?.[tradingShop.npcName]?.好感度 ?? 0; const npc = (room?.npcs || []).find(n => (tradingShop.npcId && n.id === tradingShop.npcId) || n.name === tradingShop.npcName); const res = npc ? sellToNpcCarry(npc, item, { affection: aff }) : { ok: false, logs: [{ t: "sys", text: "  对方已经不在此地了。" }] }; if (!res.ok) { if (res.logs) addLog(res.logs); return; } turn.captureUndo(); setInv(prev => prev.filter(i => (typeof i === "object" ? i.id : i) !== item.id)); setChar(c => ({ ...c, money: (c.money || 0) + res.price })); if (npc && res.nextCarriedItems) { const key = npc.id ?? npc.name; setRoom(r => ({ ...r, npcs: r.npcs.map(n => n === npc || n.id === npc.id ? { ...n, carriedItems: res.nextCarriedItems } : n) })); setNpcState(s => applyTradeToNpcState(s, npc, res.tradeDelta)); } addLog(res.logs || [{ t: "item", text: `  你卖出「${item.name}」，得银两${res.price}两。` }]); jotNote({ text: `卖出「${item.name}」，得银${res.price}两。`, source: NOTE_SOURCE.DUMB }); })}
                carrySections={tradingShop.sections}
                sellCoef={tradingShop.sellCoef}
                promo={tradingShop.promo}
              />
            </Suspense>
          )}
        </div>
      )}

      <JuanzongView hidden={hideNarrative || centerView !== "journal"} />
      <NarrativeLogFeed
        hidden={hideNarrative || centerView === "journal"} clr={clr} isDayMode={isDayMode} act={turn.act}
        collapsedGroups={collapsedGroups} setCollapsedGroups={setCollapsedGroups}
        loading={loading} queueCount={queueCount} pendingTalks={pendingTalks}
        inspecting={aiInspect.inspecting} logEnd={logEnd}
      />

      <CenterFooterBar ui={ui} turn={turn} handlers={handlers} />
    </div>
  );
}

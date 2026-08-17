// 中栏（江湖）——三栏布局的正中一栏，游戏的主视野。
// ---------------------------------------------------------------------------
// 从 MudRPG.jsx 抽出（0727 三栏拆分的最后一块：左栏 LeftPanel、右栏 RightPanel
// 已先行抽出，本文件补齐中栏）。自上而下的版面顺序：
//   1. 标题栏「江湖」+ 停止/回滚/调试/gamemode 四个开关
//   2. DebugPanel 挂载点（showDebug 时展开）
//   3. 切磋确认条（duelPending：邀战叙事跑完后点确认才真开打）
//   4. 建筑/交易内联功能区（近 20 种 BUILDING_TYPE 的条件渲染 + 最小化开关）
//   5. 叙事日志区（按「一问一答」分组折叠 + loading/端详/队列的等待态提示）
//   6. 任务提示条 / ❢触发框 / ◈抉择框
//   7. 交互模式切换（行动·对话·私聊旁白）+ NSFW + 打坐
//   8. NPC 人选选择器、飞鸽传书状态条、底部输入框
//
// 纯展示组件：不持有任何 state，全部经 props 由 MudRPG.jsx 下传（与
// LeftPanel/RightPanel/DebugPanel 同一套约定）。建筑面板各自的 Screen 组件
// 已经是独立文件，本文件只负责「此刻该显示哪一个」这层调度。
import { useState, useEffect } from "react";
import { isNpcVisibleInInnerRoom } from "../innerMap.js";
import { BUILDING_TYPE } from "../buildings/qucuoBuildings.js";
import { NOTE_SOURCE } from "../memory/note.js";
import { buildShopInventory, rollShopStock } from "../shops/qucuoShops.js";
import LogEntry from "../LogEntry.jsx";
import TradingScreen from "../TradingScreen.jsx";
import DebugPanel from "./DebugPanel.jsx";
import InnScreen from "../buildings/InnScreen.jsx";
import WuguanScreen from "../buildings/WuguanScreen.jsx";
import GamblingScreen from "../buildings/GamblingScreen.jsx";
import PigeonCoopScreen from "../buildings/PigeonCoopScreen.jsx";
import TransportScreen from "../buildings/TransportScreen.jsx";
import ServiceScreen, { BasementScreen } from "../buildings/ServiceScreen.jsx";
import TempleScreen from "../buildings/TempleScreen.jsx";
import LibraryScreen from "../buildings/LibraryScreen.jsx";
import BankScreen from "../buildings/BankScreen.jsx";
import PawnScreen from "../buildings/PawnScreen.jsx";
import EscortScreen from "../buildings/EscortScreen.jsx";
import BountyScreen from "../buildings/BountyScreen.jsx";
import ForgeScreen from "../buildings/ForgeScreen.jsx";
import JadeShopScreen from "../buildings/JadeShopScreen.jsx";
import GambleStoneScreen from "../buildings/GambleStoneScreen.jsx";
import TeahouseScreen from "../buildings/TeahouseScreen.jsx";
import SectEntryScreen from "../buildings/SectEntryScreen.jsx";
import SeaOfMindScreen from "./SeaOfMindScreen.jsx";
import AuctionScreen from "../buildings/AuctionScreen.jsx";
import CookingScreen from "../buildings/CookingScreen.jsx";
import ChestScreen from "../buildings/ChestScreen.jsx";

export default function CenterPanel({
  isMobile, mobileDrawer, setMobileDrawer,
  zoneTheme, S,
  loading, setLoading, addLog,
  undoSnapshotRef, applySnapshot,
  showDebug, setShowDebug,
  gm, setGm,
  char, setChar, pot, setPot, exp, setExp, dao, setDao,
  varTree, setVarTree, narrator, setNarrator,
  room, innerRoomName, mapData, setMapData, setRoom, setInnerRoomName,
  setInteractMode, act, teleportLookRef, setSkills, setInv,
  duelPending, confirmDuel, cancelDuel,
  activeBuilding, setActiveBuilding, tradingShop, setTradingShop, buildingPanelMinimized, setBuildingPanelMinimized,
  handleBuildingInn, handleBuildingHeal,
  skills, handleBuySkill,
  time, inv, effectiveSpecialNow, inspectItem, jotNote,
  flags, questProgress,
  handleAcceptEscort, handleGamble, handleCollectPigeons, buyPigeon, handlePostSend, handleTravel,
  showBasement, setShowBasement, handleServiceOrder,
  handlePray, handleReadBook, handleBuyBook,
  deposit, depositedAt, handleDeposit, handleWithdraw,
  pledgedItems, handlePledge, handleRedeem,
  handleAcceptBounty, handleClaimBounty,
  handleForgeCommission, handleForgeDesign,
  handleJadeDesign, handleJadeCraft,
  gambleNegotiation, handleGambleTalk, handleGambleSettle, handleGambleInspect,
  handleListenRumor,
  handleJoinSect, sectMasterAffection, handleAuctionWin,
  handleCook,
  seaTraumaActive, narratorVarsNow, invNames, handleComfort, handleResolveTrauma,
  log, isDayMode, clr, collapsedGroups, setCollapsedGroups,
  queueCount, pendingTalks, inspecting, logEnd, waitSecs,
  availableQuestsHere, triggerQuestFromPanel, triggerQuestChoice,
  uiGreen, uiPink, uiCrimson,
  nsfwOn, setNsfwOn,
  meditate, justMeditated,
  interactMode, activeTarget, setActiveTarget, setTalkTarget,
  pigeonTarget, setPigeonTarget, pigeonDelayShichen,
  input, setInput, inputRef, onKey, composingRef,
}) {
  // 现货/定制 分页：孟记铁铺(craft=forge)、玉器轩(craft=jade)这类"既卖现货又接定制"
  // 的铺子，用本页签在 TradingScreen 与 ForgeScreen/JadeShopScreen 之间切换。换一家
  // 铺子(activeBuilding.id 变)就复位回"现货"，避免上家的定制页串到下家。
  const [craftTab, setCraftTab] = useState("shop");
  useEffect(() => { setCraftTab("shop"); }, [activeBuilding?.id]);
  return (
        <div style={isMobile ? { flex: 1, ...S.panel, borderRight: "none", position: "relative" } : { flex: 55, ...S.panel }}>
          {/* 手机：叙事区左右边缘贴边小把手，点击滑出左栏(天地)/右栏(行动) */}
          {isMobile && !mobileDrawer && (
            <>
              <div onClick={() => setMobileDrawer("left")} title="天地"
                style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 30,
                  padding: "14px 4px", background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderLeft: "none",
                  borderRadius: "0 6px 6px 0", color: zoneTheme.accent, cursor: "pointer", fontSize: "12px", writingMode: "vertical-rl",
                  boxShadow: "2px 0 8px rgba(0,0,0,.4)", userSelect: "none" }}>◀ 天地</div>
              <div onClick={() => setMobileDrawer("right")} title="行动"
                style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 30,
                  padding: "14px 4px", background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRight: "none",
                  borderRadius: 0, color: zoneTheme.accent, cursor: "pointer", fontSize: "12px", writingMode: "vertical-rl",
                  boxShadow: "-2px 0 8px rgba(0,0,0,.4)", userSelect: "none" }}>行动 ▶</div>
            </>
          )}
          <div style={{ ...S.label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>江湖</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {loading && <span onClick={() => { setLoading(false); addLog([{ t: "sys", text: "  ⏹ 已停止等待本次生成（若结果稍后返回将被忽略）。" }]); }}
                style={{ cursor: "pointer", fontSize: "10px", color: "#e0806a", padding: "1px 6px", border: "1px solid #4a2a1a", borderRadius: 0, userSelect: "none" }}>⏹ 停止</span>}
              <span onClick={() => {
                  if (!undoSnapshotRef.current) { addLog([{ t: "sys", text: "  没有可回滚的上一步。" }]); return; }
                  if (!window.confirm("回滚到上一步行动之前？当前这步的结果会被撤销。")) return;
                  applySnapshot(undoSnapshotRef.current);
                  undoSnapshotRef.current = null;
                  setLoading(false);
                  addLog([{ t: "sys", text: "  ↩ 已回滚到上一步之前。" }]);
                }}
                title="撤销上一步行动，还原到落子之前"
                style={{ cursor: "pointer", fontSize: "10px", color: "#c8a860", padding: "1px 6px", border: "1px solid #4a3a1a", borderRadius: 0, userSelect: "none" }}>↩ 回滚</span>
              <span onClick={() => setShowDebug(s => !s)} style={{ cursor: "pointer", fontSize: "10px", color: showDebug ? "#c8323a" : "#2a2d3a", padding: "1px 6px", border: `1px solid ${showDebug ? "#c8323a" : "#1a1d2e"}`, borderRadius: 0, userSelect: "none" }}>🛠调试</span>
              <span onClick={() => { setGm(g => { const nv = !g; addLog([{ t: "sys", text: nv ? "  [/gamemode 1] 创造模式：无敌，战斗必胜，啥都能干" : "  [/gamemode 0] 生存模式：回归凡人之躯" }]); return nv; }); }} style={{ cursor: "pointer", fontSize: "10px", color: gm ? "#d4a853" : "#2a2d3a", padding: "1px 6px", border: `1px solid ${gm ? "#4a3a1a" : "#1a1d2e"}`, borderRadius: 0, userSelect: "none" }}>/gamemode {gm ? "0" : "1"}</span>
            </span>
          </div>

          {showDebug && (
            <DebugPanel
              isMobile={isMobile} zoneTheme={zoneTheme}
              char={char} setChar={setChar}
              pot={pot} setPot={setPot} exp={exp} setExp={setExp}
              dao={dao} setDao={setDao}
              varTree={varTree} setVarTree={setVarTree}
              narrator={narrator} setNarrator={setNarrator}
              room={room} innerRoomName={innerRoomName}
              mapData={mapData} setMapData={setMapData} setRoom={setRoom} setInnerRoomName={setInnerRoomName}
              addLog={addLog} setInteractMode={setInteractMode} act={act}
              teleportLookRef={teleportLookRef}
              setSkills={setSkills} setInv={setInv}
              setShowDebug={setShowDebug}
            />
          )}

          {/* ── 心灵之海·创伤安抚面板：只在她创伤发作时出现 ── */}
          {seaTraumaActive && (
            <SeaOfMindScreen
              narratorVars={narratorVarsNow} invNames={invNames} zoneTheme={zoneTheme}
              onComfort={handleComfort} onResolve={handleResolveTrauma}
            />
          )}

          {/* ── 切磋确认：邀战叙事跑完后，点确认才真正开打，留一步反悔余地 ── */}
          {duelPending && (
            <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(196,80,68,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#e8e4d6", fontSize: "12px", flex: 1 }}>是否与「{duelPending.name}」正式切磋？一旦开打，就要见真章了。</span>
              <span onClick={confirmDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 0, color: "#111110", background: "#c45044", border: "1px solid #c45044" }}>确认切磋</span>
              <span onClick={cancelDuel} style={{ cursor: "pointer", fontSize: "11.5px", padding: "4px 12px", borderRadius: 0, color: "#8f8a7c", border: "1px solid #2a2d3a" }}>算了</span>
            </div>
          )}

          {/* ── 建筑面板最小化条：收起时只留一行提示，点击可重新展开 ── */}
          {(activeBuilding || tradingShop) && buildingPanelMinimized && (
            <div
              onClick={() => setBuildingPanelMinimized(false)}
              style={{ flexShrink: 0, padding: "6px 16px", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: 11.5, color: "#8ac8b8", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>▸ {activeBuilding?.name || tradingShop?.shopName}（已最小化，点击展开）</span>
            </div>
          )}

          {/* ── 建筑/交易内联功能区：展开时**独占整条主叙事栏**，从顶一直拉到底部行动栏。
                 【为什么不能只占一半】这里原先写 flex:1，而下方叙事区也是 flex:1，两个
                 兄弟节点平分剩余高度——建筑面板只拿到一半，铁匠铺/商店/武馆那些内容长的
                 面板下半截直接被截掉，玩家看不到底下的按钮，也没法滚到（外层不滚，
                 面板自己那层 overflow 又被压在半屏里）。
                 改成展开时建筑面板独占：叙事区在这种时候整个不渲染（见下方 log 区的条件），
                 建筑面板拿满整栏。想看叙事就点"▾ 最小化"，叙事区随即恢复全高。 ── */}
          {(activeBuilding || tradingShop) && !buildingPanelMinimized && (
            <div style={{ flex: 1, minHeight: 0, height: "100%", overflowY: "auto", borderBottom: `1px solid ${zoneTheme.border}`, background: "rgba(255,255,255,0.02)" }}>
              {/* 最小化入口：跟每个面板自己的"× 关闭"平级，点击收起渲染区但保留 activeBuilding 状态 */}
              <div
                onClick={() => setBuildingPanelMinimized(true)}
                style={{ padding: "4px 16px", fontSize: 10.5, color: "#8f8a7c", cursor: "pointer", textAlign: "right" }}
              >
                ▾ 最小化
              </div>
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.INN && (
                <InnScreen building={activeBuilding} char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onRest={handleBuildingInn} onHeal={handleBuildingHeal} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.HOSPITAL && (
                <InnScreen building={activeBuilding} char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onRest={handleBuildingInn} onHeal={handleBuildingHeal} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.WUGUAN && (
                <WuguanScreen building={activeBuilding} char={char} skills={skills} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onBuySkill={handleBuySkill} />
              )}
              {activeBuilding && (activeBuilding.type === BUILDING_TYPE.SHOP || activeBuilding.type === BUILDING_TYPE.SMITHY || activeBuilding.type === BUILDING_TYPE.ANTIQUE || activeBuilding.type === BUILDING_TYPE.MEDICINE || activeBuilding.type === BUILDING_TYPE.CLOTH || activeBuilding.type === BUILDING_TYPE.GROCERY || activeBuilding.type === BUILDING_TYPE.BLACKMARKET || activeBuilding.type === BUILDING_TYPE.SECTSHOP) && (() => {
                const shopData = rollShopStock(activeBuilding.shopKey, time) || buildShopInventory(activeBuilding.shopKey);
                if (!shopData) return null;
                const isKarma = shopData.currency === "karma";
                const trading = (
                  <TradingScreen inline shopName={shopData.shopName} shopItems={shopData.items}
                    playerInv={inv} playerMoney={isKarma ? (dao.karma || 0) : (char.money || 0)}
                    currencyName={isKarma ? "功德" : "银两"} currencyUnit={isKarma ? "点" : "两"} canSell={!isKarma}
                    playerWit={effectiveSpecialNow?.智谋 ?? 5}
                    zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onInspect={inspectItem}
                    onBuy={(item) => { if (isKarma) { if ((dao.karma||0)<item.buyPrice) return; setDao(d=>({...d,karma:d.karma-item.buyPrice})); } else { if ((char.money||0)<item.buyPrice) return; setChar(c=>({...c,money:c.money-item.buyPrice})); if (shopData.karmaLoss) setDao(d=>({...d,karma:(d.karma||0)-shopData.karmaLoss})); } setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]); addLog([{t:"item",text:`  购得「${item.name}」（${item.quality}），花费${item.buyPrice}${isKarma?"功德":"两"}。`}]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}${isKarma?"功德":"两"}。`, source: NOTE_SOURCE.DUMB }); }}
                    onSell={(item) => { if (item.equipped||isKarma) return; setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id)); setChar(c=>({...c,money:(c.money||0)+item.sellPrice})); addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                  />
                );
                // 不带定制的铺子：只渲染现货商店（绝大多数）。
                if (!activeBuilding.craft) return trading;
                // 带定制的铺子（孟记铁铺=forge / 玉器轩=jade）：现货/定制 页签切换。
                const isJade = activeBuilding.craft === "jade";
                const tab = (key, label) => (
                  <span key={key} onClick={() => setCraftTab(key)}
                    style={{ cursor: "pointer", padding: "2px 12px", fontSize: 11.5, borderRadius: 0,
                      color: craftTab === key ? zoneTheme.bg : zoneTheme.accent,
                      background: craftTab === key ? zoneTheme.accent : "transparent",
                      border: `1px solid ${craftTab === key ? zoneTheme.accent : zoneTheme.border}` }}>{label}</span>
                );
                return (
                  <>
                    <div style={{ display: "flex", gap: 6, padding: "2px 16px 8px" }}>
                      {tab("shop", "现货")}
                      {tab("craft", isJade ? "玉器定制" : "拿料定制")}
                    </div>
                    {craftTab === "shop" ? trading : (isJade
                      ? <JadeShopScreen building={{ ...activeBuilding, flags }} char={char} inv={inv} time={time} inline
                          zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onDesign={handleJadeDesign} onCraft={handleJadeCraft} />
                      : <ForgeScreen building={activeBuilding} char={char} time={time} flags={flags} inline
                          zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCommission={handleForgeCommission} onDesign={handleForgeDesign} />)}
                  </>
                );
              })()}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.ESCORT && !activeBuilding.shopKey && (
                <EscortScreen building={activeBuilding} char={char} flags={flags} questProgress={questProgress}
                  currentRoom={room.name} zoneTheme={zoneTheme} inline onClose={() => setActiveBuilding(null)}
                  onAcceptEscort={handleAcceptEscort} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.ESCORT && activeBuilding.shopKey && (() => {
                const shopData = rollShopStock(activeBuilding.shopKey, time) || buildShopInventory(activeBuilding.shopKey);
                return shopData ? (
                  <TradingScreen inline shopName={shopData.shopName} shopItems={shopData.items}
                    playerInv={inv} playerMoney={char.money||0} playerWit={effectiveSpecialNow?.智谋 ?? 5} zoneTheme={zoneTheme} onInspect={inspectItem}
                    onClose={() => setActiveBuilding(null)}
                    onBuy={(item)=>{if((char.money||0)<item.buyPrice)return;setChar(c=>({...c,money:c.money-item.buyPrice}));setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]);addLog([{t:"item",text:`  购得「${item.name}」，花费${item.buyPrice}两。`}]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB });}}
                    onSell={(item)=>{if(item.equipped)return;setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id));setChar(c=>({...c,money:(c.money||0)+item.sellPrice}));addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB });}}
                  />
                ) : null;
              })()}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.GAMBLING && (
                <GamblingScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onGamble={handleGamble} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.PIGEON_COOP && (
                <PigeonCoopScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCollect={handleCollectPigeons} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TRANSPORT && (
                <TransportScreen building={activeBuilding} char={char} mapData={mapData} currentRoom={room.name} inline
                  inv={inv} metNpcs={varTree.世界?.曾经出现人物 || []} onBuyPigeon={buyPigeon} onSendLetter={handlePostSend}
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onTravel={handleTravel} />
              )}
              {activeBuilding && (activeBuilding.type === BUILDING_TYPE.RESTAURANT || activeBuilding.type === BUILDING_TYPE.THEATER) && !showBasement && (
                <ServiceScreen building={activeBuilding} char={char} time={time} flags={flags} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onOrder={handleServiceOrder}
                  onEnterBasement={() => setShowBasement(true)} />
              )}
              {showBasement && (
                <BasementScreen char={char} time={time} zoneTheme={zoneTheme} inline
                  onClose={() => setShowBasement(false)} onOrder={handleServiceOrder} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TEMPLE && (
                <TempleScreen building={activeBuilding} char={char} dao={dao} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onPray={handlePray} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.LIBRARY && (
                <LibraryScreen building={activeBuilding} char={char} skills={skills} zoneTheme={zoneTheme} inline
                  onClose={() => setActiveBuilding(null)} onReadBook={handleReadBook} onBuyBook={handleBuyBook} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.BANK && (
                <BankScreen building={activeBuilding} char={char} time={time} deposit={deposit} depositedAt={depositedAt} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onDeposit={handleDeposit} onWithdraw={handleWithdraw} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.PAWN && (
                <PawnScreen building={activeBuilding} char={char} inv={inv} pledgedItems={pledgedItems} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onPledge={handlePledge} onRedeem={handleRedeem} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.BOUNTY && (
                <BountyScreen building={activeBuilding} flags={flags} questProgress={questProgress} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onAcceptBounty={handleAcceptBounty} onClaimBounty={handleClaimBounty} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.FORGE && (
                <ForgeScreen building={activeBuilding} char={char} time={time} flags={flags} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCommission={handleForgeCommission} onDesign={handleForgeDesign} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.JEWELRY && (
                <JadeShopScreen building={{ ...activeBuilding, flags }} char={char} inv={inv} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onDesign={handleJadeDesign} onCraft={handleJadeCraft} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.GAMBLESTONE && (
                <GambleStoneScreen building={activeBuilding} char={char} time={time}
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)}
                  roomNpcs={(room.npcs || []).filter(n => (n.gambleBidder || n.name === "兰姐" || n.name === "温掌柜") && isNpcVisibleInInnerRoom(room.name, innerRoomName, n))}
                  negotiation={gambleNegotiation}
                  onTalk={handleGambleTalk} onSettle={handleGambleSettle} onInspect={handleGambleInspect} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.TEAHOUSE && (
                <TeahouseScreen building={activeBuilding} char={char} flags={flags} time={time} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onListenRumor={handleListenRumor} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.SECT_ENTRY && (
                <SectEntryScreen building={activeBuilding} char={char} flags={flags} inline
                  narratorAffection={sectMasterAffection}
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onJoinSect={handleJoinSect} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.AUCTION && (
                <AuctionScreen building={activeBuilding} char={char} inv={inv} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onWin={handleAuctionWin} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.KITCHEN && (
                <CookingScreen building={activeBuilding} char={char} inv={inv} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} onCook={handleCook} />
              )}
              {activeBuilding && activeBuilding.type === BUILDING_TYPE.CHEST && (
                <ChestScreen building={activeBuilding} inv={inv} setInv={setInv} inline
                  zoneTheme={zoneTheme} onClose={() => setActiveBuilding(null)} />
              )}
              {tradingShop && (
                <TradingScreen inline shopName={tradingShop.shopName} shopItems={tradingShop.items}
                  playerInv={inv} playerMoney={char.money || 0} playerWit={effectiveSpecialNow?.智谋 ?? 5} zoneTheme={zoneTheme} onInspect={inspectItem}
                  onClose={() => setTradingShop(null)}
                  onBuy={(item) => { if ((char.money || 0) < item.buyPrice) return; setChar(c => ({ ...c, money: c.money - item.buyPrice })); setInv(prev => [...prev, { ...item, id: `${item.name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, equipped: false }]); addLog([{ t: "item", text: `  你花费${item.buyPrice}两，购得「${item.name}」。` }]); jotNote({ text:`购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                  onSell={(item) => { if (item.equipped) return; setInv(prev => prev.filter(i => (typeof i === "object" ? i.id : i) !== item.id)); setChar(c => ({ ...c, money: (c.money || 0) + item.sellPrice })); addLog([{ t: "item", text: `  你卖出「${item.name}」，得银两${item.sellPrice}两。` }]); jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); }}
                />
              )}
            </div>
          )}

          {/* 叙事正文区。建筑面板展开时整个让位——两个 flex:1 的兄弟会平分高度，
              那样建筑面板只有半屏、内容长的下半截看不到（见上方注释）。
              让位而不是压缩，是因为压缩解决不了「一半」这个根因。 */}
          <div style={{ display: ((activeBuilding || tradingShop) && !buildingPanelMinimized) ? "none" : "block", flex: 1, padding: "20px 32px", overflowY: "auto", overflowX: "hidden", fontSize: "15px", lineHeight: 2.0, letterSpacing: "0.3px" }}>
            {(() => {
              // 按"一问一答"分组：玩家的一条 cmd 开启一个新轮次，后面紧跟的所有内容
              // （desc/stat/affection/sys/err 等）都归进这一组，直到下一条 cmd 出现为止。
              // 命令要跟自己的反馈严格对应，不能把不相关的内容混进别的框——
              // room（场景切换标题）和显式标记 standalone 的条目（比如"⏳已入队"，
              // 它说的是"系统现在正忙"，既不属于正在处理的上一条命令，也不属于
              // 还没执行的这一条，谁的框都不该进）真正独立成行，不并入任何框。
              const groups = [];
              let current = null;
              for (const entry of log) {
                const isStandaloneSys = entry.t === "room" || entry.standalone;
                if (isStandaloneSys) {
                  if (current) { groups.push(current); current = null; }
                  groups.push({ standalone: entry });
                } else if (entry.t === "cmd") {
                  if (current) groups.push(current);
                  current = { cmd: entry, replies: [] };
                } else {
                  if (!current) current = { cmd: null, replies: [] };
                  current.replies.push(entry);
                }
              }
              if (current) groups.push(current);

              return groups.map((g, gi) => {
                if (g.standalone) {
                  return <LogEntry key={gi} entry={g.standalone} color={clr[g.standalone.t] || clr.desc} onAction={act} isDayMode={isDayMode} />;
                }
                // 折叠逻辑：用 cmd 在 log 数组里的位置作为稳定 key
                const cmdIdx = g.cmd ? log.indexOf(g.cmd) : -1;
                const canCollapse = g.cmd && g.replies.length > 0;
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
                            +{g.replies.length}条
                          </span>
                        )}
                      </div>
                    )}
                    {!collapsed && g.replies.length > 0 && (
                      <div style={{ padding: g.cmd ? "0 12px 8px 26px" : "8px 12px" }}>
                        {g.replies.map((entry, ri) => (
                          <LogEntry key={ri} entry={entry} color={clr[entry.t] || clr.desc} onAction={act} isDayMode={isDayMode} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {loading && (
              <div style={{
                color: zoneTheme.accentDim, padding: "6px 0", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ animation: "pulse 1.2s ease-in-out infinite" }}>▌</span>
                <span>引擎运转中</span>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: "50%", background: zoneTheme.accent,
                      animation: `pulse 0.8s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
                {queueCount > 0 && (
                  <span style={{ color: "#c4a040", fontSize: "10.5px" }}>队列 {queueCount}</span>
                )}
              </div>
            )}
            {pendingTalks > 0 && <div style={{ color: "#d68a8a", animation: "pulse 1.2s ease-in-out infinite" }}>  {pendingTalks} 条对话处理中...</div>}
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

          {(loading || pendingTalks > 0) && waitSecs > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
              background: waitSecs >= 30 ? "#3a1a1a" : waitSecs >= 12 ? "#3a2a12" : "#12100a",
              fontSize: "11.5px",
              color: waitSecs >= 30 ? "#e08a6a" : waitSecs >= 12 ? "#e0b060" : zoneTheme.textDim,
            }}>
              <span>{waitSecs >= 30 ? "🐢" : "⏳"}</span>
              <span>
                {waitSecs < 12 ? `思索中… 已等待 ${waitSecs}s`
                  : waitSecs < 30 ? `有点慢，已等待 ${waitSecs}s（网络或模型繁忙，请再稍候）`
                  : `已等待 ${waitSecs}s，可能卡住了——超过 60s 会自动超时报错，届时可重试或去设置换更快的模型`}
              </span>
            </div>
          )}
          {/* 任务提示条（本轮新增）：把当前所有可推进 stage 手写的 playerHint 显示在
              叙事框最下面，告诉玩家"这一步该往哪走/怎么做"。与给AI看的 description 分离。
              没写 playerHint 的 stage 不显示（增量补写期间不会报错）。 */}
          {availableQuestsHere.some(e => e.stage.playerHint) && (
            <div style={{
              padding: "6px 14px", borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0,
              background: "#0c0f14",
            }}>
              {availableQuestsHere.filter(e => e.stage.playerHint).map(entry => (
                <div key={entry.quest.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: "10.5px", lineHeight: 1.6 }}>
                  <span style={{ color: "#6a90c0", flexShrink: 0 }}>💡 {entry.quest.title}</span>
                  <span style={{ color: "#8a94a8" }}>{entry.stage.playerHint}</span>
                </div>
              ))}
            </div>
          )}

          {/* ❢ 触发框：纯推进节点（无分支选项）。金色调，点一下即推进。 */}
          {availableQuestsHere.some(e => !e.stage.choices?.length) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
              background: "#141008",
            }}>
              <span style={{ color: "#c8663a", fontSize: "11px", flexShrink: 0 }}>❢ 此处可推进</span>
              {availableQuestsHere.filter(e => !e.stage.choices?.length).map(entry => (
                <span
                  key={entry.quest.id}
                  onClick={() => triggerQuestFromPanel(entry)}
                  title={entry.stage.description}
                  style={{
                    cursor: "pointer", color: "#c8663a", padding: "2px 10px",
                    border: "1px solid #4a3a1a", borderRadius: 0, fontSize: "10.5px",
                    background: "#1a1408", whiteSpace: "nowrap",
                  }}
                >
                  ❢ {entry.quest.title}{entry.quest.giver ? `（${entry.quest.giver}）` : ""}
                </span>
              ))}
            </div>
          )}

          {/* ◈ 抉择框：分支任务的行动选项。绿色调、独立成行，与上面的触发框拉开区分度。 */}
          {availableQuestsHere.some(e => e.stage.choices?.length) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
              borderTop: `1px solid ${zoneTheme.border}`, flexShrink: 0, flexWrap: "wrap", rowGap: 6,
              background: "#0e1410",
            }}>
              <span style={{ color: "#c07050", fontSize: "11px", flexShrink: 0 }}>◈ 行动抉择</span>
              {availableQuestsHere.filter(e => e.stage.choices?.length).map(entry => (
                <span key={entry.quest.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "#e8e4d6", fontSize: "10.5px" }}>{entry.quest.title}：</span>
                  {entry.stage.choices
                    .filter(choice => {
                      // 部分选项有前置条件（如"亮出XX信物"需先完成对应任务）才该出现，
                      // 不满足就不渲染这个按钮，而不是渲染出来点了却不该生效。
                      // requiresQuestCompleted 是"全部都要"（AND），requiresAnyOf 是"任一即可"（OR）。
                      const isDone = (qid) => questProgress[qid]?.status === "completed";
                      if (choice.requiresQuestCompleted) {
                        const need = Array.isArray(choice.requiresQuestCompleted) ? choice.requiresQuestCompleted : [choice.requiresQuestCompleted];
                        if (!need.every(isDone)) return false;
                      }
                      if (choice.requiresAnyOf?.length && !choice.requiresAnyOf.some(isDone)) return false;
                      return true;
                    })
                    .map(choice => {
                      // 按选项性质给个小图标提示玩家这一步会"真的"发生什么：
                      // ⚔进切磋、💬进辩论、○直接了事
                      const icon = choice.resolve === "combat" ? "⚔ " : choice.resolve === "talk" ? "💬 " : "";
                      return (
                        <span
                          key={choice.flag}
                          onClick={() => triggerQuestChoice(entry, choice)}
                          title={choice.resolve === "combat" ? "会进入切磋，打赢才算数" : choice.resolve === "talk" ? "会进入对话，说赢才算数" : ""}
                          style={{
                            cursor: "pointer", color: "#c07050", padding: "2px 10px",
                            border: "1px solid #c8323a", borderRadius: 0, fontSize: "10.5px",
                            background: "#241211", whiteSpace: "nowrap",
                          }}
                        >
                          {icon}{choice.label}
                        </span>
                      );
                    })}
                </span>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {[["action", "◈ 行动", zoneTheme.accent], ["talk", "◎ 对话", uiGreen], ["whisper", "◆ 私聊旁白", uiPink]].map(([id, label, color]) => (
              <span
                key={id}
                onClick={() => { setInteractMode(id); setTalkTarget(null); setActiveTarget(null); setPigeonTarget(null); }}
                style={{
                  cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 0, userSelect: "none",
                  color: interactMode === id ? zoneTheme.bg : color,
                  background: interactMode === id ? color : zoneTheme.bgPanel,
                  border: `1px solid ${interactMode === id ? color : zoneTheme.border}`,
                }}
              >{label}</span>
            ))}
            <span
              onClick={() => setNsfwOn(x => !x)}
              title={nsfwOn ? "已开启：NSFW 写作规则已注入" : "已关闭：点击开启 NSFW 写作规则"}
              style={{
                cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 0, userSelect: "none", fontWeight: "bold", letterSpacing: "0.5px",
                color: nsfwOn ? zoneTheme.bg : zoneTheme.textDim,
                background: nsfwOn ? uiCrimson : "transparent",
                border: `1px solid ${nsfwOn ? uiCrimson : zoneTheme.border}`,
                marginRight: 8,
              }}
            >NSFW</span>
            <span style={{ flex: 1 }} />
            {/* 注：运气·内功+1 / 拆招·外功+1 两个升级按钮已移至右栏「内功外功」区，
                挂在对应数值行后面，就近操作。这里只留打坐（恢复气血，非升级）。 */}
            <span
              onClick={meditate}
              title="打坐运功：消耗1回合，恢复部分气血"
              style={{
                cursor: "pointer", fontSize: "10.5px", padding: "3px 8px", borderRadius: 0,
                color: justMeditated ? "#e8d4ff" : "#b48adf",
                background: justMeditated ? "#3a2a5a" : zoneTheme.bgPanel,
                border: `1px solid ${justMeditated ? "#6a4a9a" : "#2a1d3a"}`,
                transform: justMeditated ? "scale(0.95)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
            >⊙ 打坐{justMeditated ? "…" : ""}</span>
          </div>

          {/* ── NPC 人选选择器：点选某人 → 对话/行动聚焦此人；不选=全人物发给AI ── */}
          {interactMode !== "whisper" && interactMode !== "pigeon" && room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n)).length > 0 && (
            <div style={{
              padding: "4px 14px", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              borderTop: `1px solid ${zoneTheme.border}`, flexWrap: "wrap",
            }}>
              <span style={{ color: zoneTheme.textDim, fontSize: "10px", flexShrink: 0 }}>人选：</span>
              <span
                onClick={() => { setActiveTarget(null); setTalkTarget(null); }}
                style={{
                  cursor: "pointer", fontSize: "10.5px", padding: "2px 7px", borderRadius: 0, userSelect: "none",
                  color: activeTarget ? zoneTheme.textDim : zoneTheme.accent,
                  background: activeTarget ? "transparent" : zoneTheme.accent + "20",
                  border: `1px solid ${activeTarget ? zoneTheme.border : zoneTheme.accent}`,
                }}
              >全部</span>
              {room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n)).map(n => {
                const isSel = activeTarget === n.name;
                return (
                  <span
                    key={n.name}
                    onClick={() => { setActiveTarget(n.name); if (interactMode !== "action") setTalkTarget(n.name); }}
                    title={isSel ? "点击「全部」取消选定" : `聚焦 ${n.name}`}
                    style={{
                      cursor: "pointer", fontSize: "10.5px", padding: "2px 7px", borderRadius: 0, userSelect: "none",
                      color: isSel ? zoneTheme.accent : zoneTheme.textDim,
                      background: isSel ? zoneTheme.accent + "20" : "transparent",
                      border: `1px solid ${isSel ? zoneTheme.accent : zoneTheme.border}`,
                    }}
                  >{n.name}</span>
                );
              })}
            </div>
          )}

          {interactMode === "pigeon" && pigeonTarget && (() => {
            const { delay, loc } = pigeonDelayShichen(pigeonTarget);
            return (
              <div style={{ padding: "6px 16px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontSize: "11px" }}>
                <span style={{ color: "#c4a040" }}>🕊 飞鸽传书 · 致「{pigeonTarget}」</span>
                <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>信往{loc}，约 {delay} 时辰后有回音</span>
                <span style={{ flex: 1 }} />
                <span onClick={() => { setPigeonTarget(null); setInteractMode("action"); }} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "10px" }}>× 取消</span>
              </div>
            );
          })()}
          <div style={{
            borderTop: interactMode === "whisper" ? "1px solid #4a2a4a" : interactMode === "talk" ? "1px solid #1a3a1a" : interactMode === "pigeon" ? "1px solid #4a3a1a" : `1px solid ${zoneTheme.border}`,
            background: interactMode === "whisper" ? "rgba(224,160,208,0.06)" : interactMode === "talk" ? "rgba(138,196,138,0.06)" : interactMode === "pigeon" ? "rgba(196,160,64,0.06)" : "transparent",
            padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <span style={{
              color: interactMode === "whisper" ? "#d68a8a" : interactMode === "talk" ? "#c07050" : interactMode === "pigeon" ? "#c4a040" : zoneTheme.accent,
              flexShrink: 0, fontSize: "13px",
            }}>{interactMode === "pigeon" ? "🕊" : "▸"}</span>
            <input
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={
                interactMode === "action" && loading ? "..." :
                interactMode === "pigeon" ? `提笔给「${pigeonTarget || "…"}」写信，写罢按回车放飞信鸽…` :
                interactMode === "whisper" ? (pendingTalks > 0 ? "旁白回话中…可先打字，待她说完再发" : "对旁白说些什么…（不消耗回合）") :
                interactMode === "talk" ? (pendingTalks > 0 ? `跟房间里的人说句话…（${pendingTalks}条处理中，可继续发）` : "跟房间里的人说句话…（不消耗回合）") :
                "输入行动指令…（消耗1回合）"
              }
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: zoneTheme.text, fontFamily: "inherit", fontSize: "13px" }}
            />
          </div>
        </div>
  );
}

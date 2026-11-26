// 建筑屏映射表：BUILDING_TYPE → 屏渲染函数。
// ---------------------------------------------------------------------------
// 原先 24 种建筑的"哪个类型开哪块屏"散在 CenterPanel 的一长串条件分支里，
// 新建筑要改主渲染函数才能挂上屏。这里收成一张表：每行 = 一个建筑类型 +
// 它的渲染函数（入参 ctx 是 CenterPanel 打包好的共享 props 袋）。
// 新建筑只需在本表登记一行。行为与原先逐分支一致（含 ESCORT.shopKey、
// craft 现货/定制页签这类同类型多屏的分支）。
import { BUILDING_TYPE } from "../../domain/data/buildings/qucuoBuildings.js";
import { Suspense, lazy } from "react";
import { THEME_VARS, chromeBtn } from "../../utils/theme.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";
import { buildShopInventory, rollShopStock } from "../../domain/data/shops/qucuoShops.js";
import { factionShopOffer, factionShopOutlet, isFactionShop } from "../../features/buildings/factionShop.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { buildingClosedReason } from "../../domain/rules/economy/strongholdGate.js";
import TradingScreen from "../screens/TradingScreen.jsx";
import { factionShopCoef } from "../../domain/rules/economy/factionRep.js";
import InnScreen from "../screens/buildings/InnScreen.jsx";
import WuguanScreen from "../screens/buildings/WuguanScreen.jsx";
import GamblingScreen from "../screens/buildings/GamblingScreen.jsx";
import PigeonCoopScreen from "../screens/buildings/PigeonCoopScreen.jsx";
import TransportScreen from "../screens/buildings/TransportScreen.jsx";
import ServiceScreen from "../screens/buildings/ServiceScreen.jsx";
import TempleScreen from "../screens/buildings/TempleScreen.jsx";
import LibraryScreen from "../screens/buildings/LibraryScreen.jsx";
import BankScreen from "../screens/buildings/BankScreen.jsx";
import PawnScreen from "../screens/buildings/PawnScreen.jsx";
import EscortScreen from "../screens/buildings/EscortScreen.jsx";
import BountyScreen from "../screens/buildings/BountyScreen.jsx";
import ForgeScreen from "../screens/buildings/ForgeScreen.jsx";
import JadeShopScreen from "../screens/buildings/JadeShopScreen.jsx";
import GambleStoneScreen from "../screens/buildings/GambleStoneScreen.jsx";
import TeahouseScreen from "../screens/buildings/TeahouseScreen.jsx";
import SectEntryScreen from "../screens/buildings/SectEntryScreen.jsx";
import AuctionScreen from "../screens/buildings/AuctionScreen.jsx";
import CookingScreen from "../screens/buildings/CookingScreen.jsx";
import ChestScreen from "../screens/buildings/ChestScreen.jsx";
import FestivalScreen from "../screens/buildings/FestivalScreen.jsx";

const DungeonScreen = lazy(() => import("../screens/dungeon/DungeonScreen.jsx"));

// 既卖现货又接定制的铺子（SHOP 族 + craft 字段）：现货/定制页签切换。
function shopWithCraftScreen(c, shopData, trading) {
  if (!c.building.craft) return trading;
  return (
    <>
      {c.tabs("mobile-trading-tabs-desktop")}
      {c.craftTab === "shop" ? trading : (c.isJade
        ? <JadeShopScreen building={{ ...c.building, flags: c.flags }} char={c.char} inv={c.inv} time={c.time} inline onClose={c.closeBuilding} onDesign={c.handleJadeDesign} onCraft={c.handleJadeCraft} />
        : <ForgeScreen building={c.building} char={c.char} time={c.time} flags={c.flags} inline onClose={c.closeBuilding} onCommission={c.handleForgeCommission} onDesign={c.handleForgeDesign} />)}
    </>
  );
}

function shopScreen(c) {
  const shopData = rollShopStock(c.building.shopKey, c.time) || buildShopInventory(c.building.shopKey);
  if (!shopData) return null;
  const isKarma = shopData.currency === "karma";
  const factionShop = isFactionShop(c.building.shopKey)
    ? factionShopOffer(c.building.shopKey, c.varTree, factionShopOutlet(c.building.shopKey, c.building.id), c.flags) : null;
  const trading = (
    <TradingScreen inline queueCount={c.queueCount}
      shopName={factionShop ? `${c.building.name}${factionShop.closed ? `（${factionShop.closed}）` : ""}` : shopData.shopName}
      shopItems={factionShop ? factionShop.items : shopData.items}
      playerInv={c.inv} playerMoney={isKarma ? (c.dao.karma || 0) : (c.char.money || 0)}
      currencyName={isKarma ? "功德" : "银两"} currencyUnit={isKarma ? "点" : "两"} canSell={!isKarma}
      headerContent={c.building.craft ? c.tabs("mobile-trading-tabs-header") : null}
      playerWit={c.effectiveSpecialNow?.智谋 ?? 5} repCoef={factionShop ? factionShop.coef : isKarma ? 1 : factionShopCoef(c.varTree, c.building.district ?? c.room?.name)} onClose={c.closeBuilding} onInspect={c.inspectItem}
      onBuy={factionShop
        ? (item) => c.handleBuyTangmenItem(item.name, c.building.shopKey)
        : (item) => c.runCommand("shopBuy", () => { if (isKarma) { if ((c.dao.karma||0)<item.buyPrice) return; c.captureUndo(); c.setDao(d=>({...d,karma:d.karma-item.buyPrice})); } else { if ((c.char.money||0)<item.buyPrice) return; c.captureUndo(); c.setChar(ch=>({...ch,money:ch.money-item.buyPrice})); if (shopData.karmaLoss) c.setDao(d=>({...d,karma:(d.karma||0)-shopData.karmaLoss})); } c.setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]); c.addLog([{t:"item",text:`  购得「${item.name}」（${item.quality}），花费${item.buyPrice}${isKarma?"功德":"两"}。`}]); c.jotNote({ text:`购得「${item.name}」，花${item.buyPrice}${isKarma?"功德":"两"}。`, source: NOTE_SOURCE.DUMB }); })}
      onSell={factionShop
        ? (item) => c.runCommand("shopSell", () => { if (item.equipped) return; c.handleSellFactionItem(item, c.building.shopKey); })
        : (item) => c.runCommand("shopSell", () => { if (item.equipped||isKarma) return; c.captureUndo(); c.setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id)); c.setChar(ch=>({...ch,money:(ch.money||0)+item.sellPrice})); c.addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); c.jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB }); })}
    />
  );
  return shopWithCraftScreen(c, shopData, trading);
}

function escortScreen(c) {
  // 镖局本体是护镖任务屏；带 shopKey 的镖局同时卖防身器，走商店屏。
  if (!c.building.shopKey) {
    return (
      <EscortScreen building={c.building} char={c.char} flags={c.flags} questProgress={c.questProgress}
        currentRoom={c.room.name} inline onClose={c.closeBuilding}
        time={c.time} onAcceptEscort={c.handleAcceptEscort} />
    );
  }
  const shopData = rollShopStock(c.building.shopKey, c.time) || buildShopInventory(c.building.shopKey);
  // 镖局都有 shopKey（卖防身器）：镖单嵌进交易屏的 footer 槽，外层堆叠在移动端会被 fixed 全屏商店盖住。
  const escortBoard = (
    <EscortScreen building={c.building} char={c.char} flags={c.flags} questProgress={c.questProgress}
      currentRoom={c.room.name} inline onClose={c.closeBuilding}
      time={c.time} onAcceptEscort={c.handleAcceptEscort} />
  );
  return shopData ? (
    <TradingScreen inline queueCount={c.queueCount} shopName={shopData.shopName} shopItems={shopData.items} footer={escortBoard}
      playerInv={c.inv} playerMoney={c.char.money||0} playerWit={c.effectiveSpecialNow?.智谋 ?? 5} repCoef={factionShopCoef(c.varTree, c.building.district ?? c.room?.name)} onInspect={c.inspectItem}
      onClose={c.closeBuilding}
      onBuy={(item)=>c.runCommand("shopBuy",()=>{if((c.char.money||0)<item.buyPrice)return;c.captureUndo();c.setChar(ch=>({...ch,money:ch.money-item.buyPrice}));c.setInv(prev=>[...prev,{...item,id:`${item.name}_${Date.now()}`,equipped:false}]);c.addLog([{t:"item",text:`  购得「${item.name}」，花费${item.buyPrice}两。`}]); c.jotNote({ text:`购得「${item.name}」，花${item.buyPrice}两。`, source: NOTE_SOURCE.DUMB });})}
      onSell={(item)=>c.runCommand("shopSell",()=>{if(item.equipped)return;c.captureUndo();c.setInv(prev=>prev.filter(i=>(typeof i==="object"?i.id:i)!==item.id));c.setChar(ch=>({...ch,money:(ch.money||0)+item.sellPrice}));c.addLog([{t:"item",text:`  卖出「${item.name}」，得${item.sellPrice}两。`}]); c.jotNote({ text:`卖出「${item.name}」，得银${item.sellPrice}两。`, source: NOTE_SOURCE.DUMB });})}
    />
  ) : null;
}

function innScreen(c) {
  return (
    <InnScreen building={c.building} char={c.char} skills={c.skills} time={c.time} varTree={c.varTree} flags={c.flags} inline
      onClose={c.closeBuilding} onRest={c.handleBuildingInn} onHeal={c.handleBuildingHeal} onClinic={c.handleClinicService} />
  );
}

export const BUILDING_SCREENS = {
  [BUILDING_TYPE.FESTIVAL]: (c) => (
    <FestivalScreen building={c.building} char={c.char} flags={c.flags} time={c.time} varTree={c.varTree} questProgress={c.questProgress} inline onClose={c.closeBuilding}
      onEnter={c.handleFestivalEnter} onBet={c.handleFestivalBet} onInvite={c.handleFestivalInvite}
      onNight={c.handleFestivalNight} onWubi={c.handleFestivalWubi} onMidnight={c.handleFestivalMidnight} />
  ),
  [BUILDING_TYPE.INN]: innScreen,
  [BUILDING_TYPE.HOSPITAL]: innScreen,
  [BUILDING_TYPE.WUGUAN]: (c) => (
    <WuguanScreen building={c.building} char={c.char} skills={c.skills} flags={c.flags} questProgress={c.questProgress} varTree={c.varTree} inline
      onClose={c.closeBuilding} onBuySkill={c.handleBuySkill} />
  ),
  [BUILDING_TYPE.GAMBLING]: (c) => (
    <GamblingScreen building={c.building} char={c.char} flags={c.flags} time={c.time} inline onClose={c.closeBuilding} onGamble={c.handleGamble} />
  ),
  [BUILDING_TYPE.PIGEON_COOP]: (c) => (
    <PigeonCoopScreen building={c.building} char={c.char} flags={c.flags} time={c.time} inline onClose={c.closeBuilding} onCollect={c.handleCollectPigeons} />
  ),
  [BUILDING_TYPE.TRANSPORT]: (c) => (
    <TransportScreen building={c.building} char={c.char} mapData={c.mapData} currentRoom={c.room.name} inline
      flags={c.flags} questProgress={c.questProgress}
      inv={c.inv} metNpcs={c.varTree.世界?.曾经出现人物 || []} onBuyPigeon={c.buyPigeon} onSendLetter={c.handlePostSend} onClose={c.closeBuilding} onTravel={c.handleTravel} />
  ),
  [BUILDING_TYPE.RESTAURANT]: (c) => (
    <ServiceScreen building={c.building} char={c.char} time={c.time} flags={c.flags} inline onClose={c.closeBuilding} onOrder={c.handleServiceOrder}
      onEnterBasement={c.openBasement} />
  ),
  [BUILDING_TYPE.THEATER]: (c) => (
    <ServiceScreen building={c.building} char={c.char} time={c.time} flags={c.flags} inline onClose={c.closeBuilding} onOrder={c.handleServiceOrder}
      onEnterBasement={c.openBasement} />
  ),
  [BUILDING_TYPE.TEMPLE]: (c) => (
    <TempleScreen building={c.building} char={c.char} dao={c.dao} varTree={c.varTree} flags={c.flags} time={c.time} inline onClose={c.closeBuilding} onPray={c.handlePray} onClinic={c.handleClinicService} />
  ),
  [BUILDING_TYPE.LIBRARY]: (c) => (
    <LibraryScreen building={c.building} char={c.char} skills={c.skills} flags={c.flags} time={c.time} inline
      onClose={c.closeBuilding} onReadBook={c.handleReadBook} onBuyBook={c.handleBuyBook} onChaojing={c.handleChaojing} />
  ),
  [BUILDING_TYPE.BANK]: (c) => (
    <BankScreen building={c.building} char={c.char} time={c.time} deposit={c.deposit} depositedAt={c.depositedAt} inline onClose={c.closeBuilding} onDeposit={c.handleDeposit} onWithdraw={c.handleWithdraw} />
  ),
  [BUILDING_TYPE.PAWN]: (c) => (
    <PawnScreen building={c.building} char={c.char} inv={c.inv} pledgedItems={c.pledgedItems} inline onClose={c.closeBuilding} onPledge={c.handlePledge} onRedeem={c.handleRedeem} />
  ),
  [BUILDING_TYPE.BOUNTY]: (c) => (
    <BountyScreen building={c.building} flags={c.flags} questProgress={c.questProgress} inline onClose={c.closeBuilding} onAcceptBounty={c.handleAcceptBounty} onClaimBounty={c.handleClaimBounty} />
  ),
  [BUILDING_TYPE.FORGE]: (c) => (
    <ForgeScreen building={c.building} char={c.char} time={c.time} flags={c.flags} inline onClose={c.closeBuilding} onCommission={c.handleForgeCommission} onDesign={c.handleForgeDesign} />
  ),
  [BUILDING_TYPE.JEWELRY]: (c) => (
    <JadeShopScreen building={{ ...c.building, flags: c.flags }} char={c.char} inv={c.inv} time={c.time} inline onClose={c.closeBuilding} onDesign={c.handleJadeDesign} onCraft={c.handleJadeCraft} />
  ),
  [BUILDING_TYPE.GAMBLESTONE]: (c) => (
    <GambleStoneScreen building={c.building} char={c.char} time={c.time}
      onMinimizeChange={c.setGambleStoneMinimized} onClose={c.closeBuilding}
      roomNpcs={(c.room.npcs || []).filter(n => (n.gambleBidder || n.name === "兰姐" || n.name === "温掌柜") && isNpcVisibleInInnerRoom(c.room.name, c.innerRoomName, n))}
      negotiation={c.gambleNegotiation}
      onTalk={c.handleGambleTalk} onSettle={c.handleGambleSettle} onInspect={c.handleGambleInspect} />
  ),
  [BUILDING_TYPE.TEAHOUSE]: (c) => (
    <TeahouseScreen building={c.building} char={c.char} flags={c.flags} time={c.time} inline onClose={c.closeBuilding} onListenRumor={c.handleListenRumor} />
  ),
  [BUILDING_TYPE.SECT_ENTRY]: (c) => (
    <SectEntryScreen building={c.building} char={c.char} flags={c.flags} varTree={c.varTree} inline
      narratorAffection={c.sectMasterAffection} questProgress={c.questProgress} onClose={c.closeBuilding} onJoinSect={c.handleJoinSect} onLeaveSect={c.handleLeaveSect} />
  ),
  [BUILDING_TYPE.AUCTION]: (c) => (
    <AuctionScreen building={c.building} char={c.char} inv={c.inv} inline onClose={c.closeBuilding} onWin={c.handleAuctionWin} />
  ),
  [BUILDING_TYPE.KITCHEN]: (c) => (
    <CookingScreen building={c.building} char={c.char} inv={c.inv} inline onClose={c.closeBuilding} onCook={c.handleCook} />
  ),
  [BUILDING_TYPE.CHEST]: (c) => (
    <ChestScreen building={c.building} inv={c.inv} setInv={c.setInv} inline onClose={c.closeBuilding} />
  ),
  [BUILDING_TYPE.ESCORT]: escortScreen,
  [BUILDING_TYPE.DUNGEON]: (c) => (
    <Suspense fallback={null}>
      <DungeonScreen
        building={c.building}
        char={c.char}
        inv={c.inv}
        skills={c.skills}
        effectiveSpecialNow={c.effectiveSpecialNow}
        onClose={c.closeBuilding}
        inline
        addLog={c.addLog}
        jotNote={c.jotNote}
        captureUndo={c.captureUndo}
        runCommand={c.runCommand}
        act={c.act}
      />
    </Suspense>
  ),
};

// 现货商店族：8 种商店类型共用同一块 TradingScreen（含 craft 定制页签）。
for (const type of [
  BUILDING_TYPE.SHOP, BUILDING_TYPE.SMITHY, BUILDING_TYPE.ANTIQUE, BUILDING_TYPE.MEDICINE,
  BUILDING_TYPE.CLOTH, BUILDING_TYPE.GROCERY, BUILDING_TYPE.BLACKMARKET, BUILDING_TYPE.SECTSHOP,
]) {
  BUILDING_SCREENS[type] = shopScreen;
}

function ClosedBuilding({ c, text }) {
  return (
    <div style={{ padding: 12, color: "var(--text)", fontSize: "var(--fs-sm)" }}>
      <div style={{ color: "var(--accent)", marginBottom: 6 }}>{c.building.name}</div>
      <div style={{ marginBottom: 10 }}>{text}</div>
      <button type="button" onClick={c.closeBuilding} style={chromeBtn(THEME_VARS)}>离开</button>
    </div>
  );
}

export function renderBuildingScreen(type, c) {
  const closed = buildingClosedReason(c.building, c.building?.district ?? c.room?.name, c.varTree);
  if (closed) return <ClosedBuilding c={c} text={closed} />;
  return BUILDING_SCREENS[type]?.(c) ?? null;
}

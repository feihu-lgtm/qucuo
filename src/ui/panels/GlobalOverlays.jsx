// 全局弹层——所有 position:fixed 浮层的挂载点，集中一处。
// ---------------------------------------------------------------------------
// 从 MudRPG.jsx 抽出。原先这些弹层的"要不要显示"判断散在主渲染的头尾两段
// （一段在三栏之前、一段在三栏之后），组件本身却早已各自独立成文件；这里把
// 那两段判断合并进同一个组件。因为它们全都是 position:fixed + 高 zIndex 的
// 浮层，DOM 里挂在哪一层不影响最终呈现，合并不改变任何视觉行为。
//
// 收录（按 zIndex 大致由低到高）：
//   TraceViewer(70) · PersuasionScreen(60) · Duel/TeamDuelScreen
//   CharacterPage/QuestLogScreen/LoreScreen/PortraitManager/CodexScreen(300)
//   BugReportModal/NpcActionMenu(400) · ItemActionMenu(410)
//   TutorialOverlay/VersionHistoryPanel(500)
//
// 弹层可见性读 uiStore，游戏数据与业务回调经 props 下传。切磋界面额外包了一层
// ErrorBoundary——战斗引擎报错时不该把整局游戏拖崩，能退回房间重来。
//
// 结构：下面 entries 是一张有序条目表，每行 = {show, render}。新增浮层只需
// 在表尾登记一行；数组顺序即 DOM 顺序（与原条件分支的书写顺序一致）。
import { Fragment, lazy, Suspense, useCallback } from "react";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { listCharacters } from "../../domain/rules/prompt/mvu.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { getPipelineEntries, getTraceLog } from "../../infra/actionTrace.js";
import { duelAlly, isCompanionUnlockedByName } from "../../domain/rules/companion/companion.js";
import { ADVENTURER_BY_NAME } from "../../domain/data/dungeon/adventurers.js";
import { ocMenuRoutes } from "../../features/npc/ocRecruit.js";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import NpcActionMenu from "../components/NpcActionMenu.jsx";
import ItemActionMenu from "../components/ItemActionMenu.jsx";
import { OVERLAY, closeOverlay, openOverlay, useOverlay } from "../../store/uiStore.js";
import {
  useSessionUi, setActiveNpcMenu, setActiveItemMenu, setCharacterPageTarget,
} from "../../store/sessionUiStore.js";

const TutorialOverlay = lazy(() => import("../screens/TutorialOverlay.jsx"));
const VersionHistoryPanel = lazy(() => import("../screens/VersionHistoryPanel.jsx"));
const CharacterPage = lazy(() => import("../screens/CharacterPage.jsx"));
const QuestLogScreen = lazy(() => import("../screens/QuestLogScreen.jsx"));
const LoreScreen = lazy(() => import("../screens/LoreScreen.jsx"));
const QijuzhuScreen = lazy(() => import("../screens/QijuzhuScreen.jsx"));
const PortraitManager = lazy(() => import("../screens/PortraitManager.jsx"));
const TraceViewer = lazy(() => import("../screens/TraceViewer.jsx"));
const CodexScreen = lazy(() => import("../screens/CodexScreen.jsx"));
const BugReportModal = lazy(() => import("../screens/BugReportModal.jsx"));
const PersuasionScreen = lazy(() => import("../screens/PersuasionScreen.jsx"));
const DuelScreen = lazy(() => import("../screens/DuelScreen.jsx"));
const TeamDuelScreen = lazy(() => import("../screens/TeamDuelScreen.jsx"));
const CardImportScreen = lazy(() => import("../screens/CardImportScreen.jsx"));

export default function GlobalOverlays({
  zoneTheme,
  char, inv, skills, varTree, room, innerRoomName, time,
  flags, questProgress, effectiveSpecialNow, companionState,
  onImportNpcs, onImportPlayer, onImportWorld,
  claimedMilestones, claimMilestone, giftToCharacter,
  narratorStage,
  portraits, setPortraits,
  buildBugReportTurns, debugSources,
  handleNpcLook, handleNpcTalk, handleNpcGift, handleNpcDuel, handleNpcSteal,
  handleNpcLearnSkill, handleNpcTrade, handleInviteCompanion,
  handleOcRecruit, handleRecallCompanion,
  inspectItem, handleConsumeItem, handleCollectGround, handleToggleEquip,
  persuasionProgress, savePersuasionProgress, finishPersuasion,
  resetDuel, duelFinishHandler,
}) {
  const activePersuasion = useSessionUi(s => s.activePersuasion);
  const duelingNpc = useSessionUi(s => s.duelingNpc);
  const isDayMode = useSessionUi(s => s.isDayMode);
  const apiCfg = useSessionUi(s => s.apiCfg);
  const rawNpcMenu = useSessionUi(s => s.activeNpcMenu);
  // 原 ui.liveNpcMenu：NPC 已离场时退回快照菜单对象
  const activeNpcMenu = rawNpcMenu ? (room.npcs.find(n => n.name === rawNpcMenu.name) || rawNpcMenu) : null;
  const activeItemMenu = useSessionUi(s => s.activeItemMenu);
  const characterPageTarget = useSessionUi(s => s.characterPageTarget);
  const showTutorial = useOverlay(OVERLAY.TUTORIAL);
  const showVersionHistory = useOverlay(OVERLAY.VERSION_HISTORY);
  const showCharacterPage = useOverlay(OVERLAY.CHARACTER_PAGE);
  const showCardImport = useOverlay(OVERLAY.CARD_IMPORT);
  const showQuestLog = useOverlay(OVERLAY.QUEST_LOG);
  const showLore = useOverlay(OVERLAY.LORE);
  const showQijuzhu = useOverlay(OVERLAY.QIJUZHU);
  const showPortraitManager = useOverlay(OVERLAY.PORTRAIT_MANAGER);
  const showTrace = useOverlay(OVERLAY.TRACE);
  const showCodex = useOverlay(OVERLAY.CODEX);
  const showBugReport = useOverlay(OVERLAY.BUG_REPORT);
  const closeTutorial = useCallback(() => {
    closeOverlay(OVERLAY.TUTORIAL);
    try { localStorage.setItem("qucuo_tutorial_seen", "1"); } catch { /* ignore */ }
  }, []);

  // 有序浮层条目表：{show, render}，顺序即原条件分支的书写顺序。
  const entries = [
    { show: showTutorial, render: () => <TutorialOverlay onClose={closeTutorial} /> },
    { show: showVersionHistory, render: () => (
      <VersionHistoryPanel onClose={() => closeOverlay(OVERLAY.VERSION_HISTORY)} accentDim={zoneTheme.accentDim} />
    )},
    { show: showCardImport, render: () => (
      <Suspense fallback={<div role="status" aria-live="polite">载入中</div>}>
      <CardImportScreen
        onClose={() => closeOverlay(OVERLAY.CARD_IMPORT)}
        apiCfg={apiCfg}
        playerName={char.name}
        zoneTheme={zoneTheme}
        onImportNpcs={onImportNpcs}
        onImportPlayer={onImportPlayer}
        onImportWorld={onImportWorld}
        currentDistrict={room.name}
      />
      </Suspense>
    )},
    { show: showCharacterPage, render: () => (
      <CharacterPage
        varTree={varTree}
        claimedMilestones={claimedMilestones}
        onClaimMilestone={claimMilestone}
        onGift={giftToCharacter}
        initialSelected={characterPageTarget}
        onClose={() => { closeOverlay(OVERLAY.CHARACTER_PAGE); setCharacterPageTarget(null); }}
      />
    )},
    { show: showQuestLog, render: () => (
      <QuestLogScreen
        questProgress={questProgress} flags={flags}
        zoneTheme={zoneTheme}
        onClose={() => closeOverlay(OVERLAY.QUEST_LOG)}
      />
    )},
    { show: showLore, render: () => (
      <LoreScreen
        varTree={varTree}
        time={time}
        turnToStr={getTimeStr}
        zoneTheme={zoneTheme}
        onClose={() => closeOverlay(OVERLAY.LORE)}
      />
    )},
    { show: showQijuzhu, render: () => (
      <QijuzhuScreen
        varTree={varTree}
        time={time}
        narratorStage={narratorStage}
        zoneTheme={zoneTheme}
        onClose={() => closeOverlay(OVERLAY.QIJUZHU)}
      />
    )},
    { show: showPortraitManager, render: () => (
      <PortraitManager
        portraits={portraits}
        onChange={setPortraits}
        knownNames={["旁白", "你", ...listCharacters(varTree).map(c => c.name), ...room.npcs.map(n => n.name)]}
        onClose={() => closeOverlay(OVERLAY.PORTRAIT_MANAGER)}
      />
    )},
    { show: showTrace, render: () => (
      <TraceViewer theme={zoneTheme} onClose={() => closeOverlay(OVERLAY.TRACE)} onReport={() => openOverlay(OVERLAY.BUG_REPORT)} />
    )},
    { show: showCodex, render: () => (
      <CodexScreen zoneTheme={zoneTheme} isDayMode={isDayMode} inv={inv} skills={skills} onClose={() => closeOverlay(OVERLAY.CODEX)} />
    )},
    { show: showBugReport, render: () => (
      <BugReportModal
        isDayMode={isDayMode}
        turns={buildBugReportTurns()}
        pipelineData={getPipelineEntries()}
        actionTrees={getTraceLog()}
        debugSources={{ ...debugSources, apiConfig: apiCfg }}
        getGameState={() => ({
          room: room.name, inner: innerRoomName, time,
          hp: char.hp, money: char.money,
          flags, questProgress,
          invNames: inv.map(i => typeof i === "string" ? i : i.name),
          skillNames: skills.map(s => s.name),
        })}
        onClose={() => closeOverlay(OVERLAY.BUG_REPORT)}
      />
    )},
    { show: activeNpcMenu, render: () => (
      <NpcActionMenu
        npc={activeNpcMenu}
        zoneTheme={zoneTheme}
        inv={inv}
        onClose={() => setActiveNpcMenu(null)}
        onLook={handleNpcLook}
        onTalk={handleNpcTalk}
        onGift={handleNpcGift}
        onDuel={handleNpcDuel}
        onSteal={handleNpcSteal}
        onLearnSkill={handleNpcLearnSkill}
        onTrade={handleNpcTrade}
        onInviteCompanion={handleInviteCompanion}
        onOcRecruit={handleOcRecruit}
        onRecallCompanion={handleRecallCompanion}
        ocRoutes={ADVENTURER_BY_NAME[activeNpcMenu.name] ? ocMenuRoutes({ flags, varTree, companionState }, ADVENTURER_BY_NAME[activeNpcMenu.name]) : []}
        flags={flags} companionUnlocked={isCompanionUnlockedByName(companionState, activeNpcMenu.name)}
      />
    )},
    { show: activeItemMenu, render: () => (
      <ItemActionMenu
        item={activeItemMenu.item}
        mode={activeItemMenu.mode}
        canConsume={activeItemMenu.canConsume}
        roomNpcs={(room.npcs || []).filter((npc) => isNpcVisibleInInnerRoom(room.name, innerRoomName, npc))}
        zoneTheme={zoneTheme}
        onClose={() => setActiveItemMenu(null)}
        onInspect={(it) => inspectItem("item", typeof it === "object" ? it.name : it, null, typeof it === "object" ? it : null, { worldLook: true })}
        onConsume={handleConsumeItem}
        onGive={(npc, it) => handleNpcGift(npc, it)}
        onSell={(npc) => handleNpcTrade(npc)}
        onCollect={handleCollectGround}
        onEquip={handleToggleEquip}
      />
    )},
    { show: activePersuasion, render: () => {
      const pkey = `${activePersuasion.questId}|${activePersuasion.flag}`;
      return (
      <PersuasionScreen
        persuade={activePersuasion.persuade}
        apiCfg={apiCfg}
        ownedFlags={flags}
        playerMoney={char.money || 0}
        playerIdentities={[]}
        playerSpecial={effectiveSpecialNow}
        zoneTheme={zoneTheme}
        savedProgress={persuasionProgress[pkey] || null}
        onProgress={(prog) => savePersuasionProgress(pkey, prog)}
        onFinish={(result) => finishPersuasion(activePersuasion, result)}
      />
      );
    }},
    { show: duelingNpc, render: () => (
      <ErrorBoundary label="切磋界面" onReset={resetDuel}>
      {duelAlly(companionState, duelingNpc) ? (
        // 有队友出战：2v2团战（玩家+队友 vs 当前对手）；对手就是这位队友时走下面的 1v1。
        // 【改成读通用出战位】此前写死 companionState.snowLeopard.data，
        // 明日香入队后带的是她、这里却仍取雪豹（雪豹此时 active=false、data 可能还在），
        // 结果会出现"带着明日香却是雪豹上场"。单槽互斥，activeCompanion 保证只有一个。
        <TeamDuelScreen
          enemies={[duelingNpc]}
          leopardData={duelAlly(companionState, duelingNpc).data}
          playerChar={{ ...char, special: effectiveSpecialNow }}
          pendingCombatBuff={char.pendingCombatBuff}
          playerInv={inv}
          playerMoveset={char.moveset}
          playerSkills={skills}
          zoneTheme={zoneTheme}
          onFinish={duelFinishHandler}
        />
      ) : (
        <DuelScreen
          npc={duelingNpc}
          playerChar={{ ...char, special: effectiveSpecialNow }}
          pendingCombatBuff={char.pendingCombatBuff}
          playerInv={inv}
          playerMoveset={char.moveset}
          playerSkills={skills}
          zoneTheme={zoneTheme}
          onFinish={duelFinishHandler}
        />
      )}
      </ErrorBoundary>
    )},
  ];

  return (
    <Suspense fallback={<div role="status" aria-live="polite">载入中</div>}>
      {entries.map((e, i) => e.show && <Fragment key={i}>{e.render()}</Fragment>)}
    </Suspense>
  );
}

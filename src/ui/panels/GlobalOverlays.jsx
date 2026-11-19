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
//   TutorialOverlay/VersionHistoryPanel(500) · PipelineViewer
//
// 弹层可见性读 uiStore，游戏数据与业务回调经 props 下传。切磋界面额外包了一层
// ErrorBoundary——战斗引擎报错时不该把整局游戏拖崩，能退回房间重来。
import { useCallback } from "react";
import { listCharacters } from "../../domain/prompt/mvu.js";
import { getTimeStr } from "../../utils/mudHelpers.js";
import { getPipelineLog } from "../../infra/apiConfig.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { activeCompanion, isCompanionUnlockedByName } from "../../domain/companion/companion.js";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import TutorialOverlay from "../screens/TutorialOverlay.jsx";
import VersionHistoryPanel from "../screens/VersionHistoryPanel.jsx";
import CharacterPage from "../screens/CharacterPage.jsx";
import CardImportScreen from "../screens/CardImportScreen.jsx";
import QuestLogScreen from "../screens/QuestLogScreen.jsx";
import LoreScreen from "../screens/LoreScreen.jsx";
import QijuzhuScreen from "../screens/QijuzhuScreen.jsx";
import PortraitManager from "../screens/PortraitManager.jsx";
import PipelineViewer from "../screens/PipelineViewer.jsx";
import TraceViewer from "../screens/TraceViewer.jsx";
import CodexScreen from "../screens/CodexScreen.jsx";
import BugReportModal from "../screens/BugReportModal.jsx";
import NpcActionMenu from "../components/NpcActionMenu.jsx";
import ItemActionMenu from "../components/ItemActionMenu.jsx";
import PersuasionScreen from "../screens/PersuasionScreen.jsx";
import DuelScreen from "../screens/DuelScreen.jsx";
import TeamDuelScreen from "../screens/TeamDuelScreen.jsx";
import { OVERLAY, closeOverlay, openOverlay, useOverlay } from "../../store/uiStore.js";

export default function GlobalOverlays({
  zoneTheme, isDayMode,
  char, setChar, inv, setInv, skills, varTree, room, innerRoomName, time,
  flags, questProgress, effectiveSpecialNow, companionState,
  loading, pendingTalks, waitSecs, addLog,
  characterPageTarget, setCharacterPageTarget,
  onImportNpcs, onImportPlayer, onImportWorld,
  claimedMilestones, claimMilestone, giftToCharacter,
  narratorStage,
  portraits, setPortraits,
  buildBugReportTurns, debugSources,
  activeNpcMenu, setActiveNpcMenu,
  handleNpcLook, handleNpcTalk, handleNpcGift, handleNpcDuel, handleNpcSteal,
  handleNpcLearnSkill, handleNpcTrade, handleInviteCompanion,
  activeItemMenu, setActiveItemMenu, inspectItem, handleConsumeItem, handleCollectGround, handleToggleEquip,
  activePersuasion, setActivePersuasion, apiCfg, persuasionProgress, setPersuasionProgress,
  forceAdvanceQuest,
  duelingNpc, setDuelingNpc, setPendingQuestBranch, duelFinishHandler,
}) {
  const showTutorial = useOverlay(OVERLAY.TUTORIAL);
  const showVersionHistory = useOverlay(OVERLAY.VERSION_HISTORY);
  const showCharacterPage = useOverlay(OVERLAY.CHARACTER_PAGE);
  const showCardImport = useOverlay(OVERLAY.CARD_IMPORT);
  const showQuestLog = useOverlay(OVERLAY.QUEST_LOG);
  const showLore = useOverlay(OVERLAY.LORE);
  const showQijuzhu = useOverlay(OVERLAY.QIJUZHU);
  const showPortraitManager = useOverlay(OVERLAY.PORTRAIT_MANAGER);
  const showPipeline = useOverlay(OVERLAY.PIPELINE);
  const showTrace = useOverlay(OVERLAY.TRACE);
  const showCodex = useOverlay(OVERLAY.CODEX);
  const showBugReport = useOverlay(OVERLAY.BUG_REPORT);
  const closeTutorial = useCallback(() => {
    closeOverlay(OVERLAY.TUTORIAL);
    try { localStorage.setItem("qucuo_tutorial_seen", "1"); } catch { /* ignore */ }
  }, []);

  return (
    <>
      {showTutorial && <TutorialOverlay onClose={closeTutorial} />}

      {showVersionHistory && (
        <VersionHistoryPanel onClose={() => closeOverlay(OVERLAY.VERSION_HISTORY)} accentDim={zoneTheme.accentDim} />
      )}

      {showCardImport && (
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
      )}

      {showCharacterPage && (
        <CharacterPage
          varTree={varTree}
          claimedMilestones={claimedMilestones}
          onClaimMilestone={claimMilestone}
          onGift={giftToCharacter}
          initialSelected={characterPageTarget}
          onClose={() => { closeOverlay(OVERLAY.CHARACTER_PAGE); setCharacterPageTarget(null); }}
        />
      )}

      {showQuestLog && (
        <QuestLogScreen
          questProgress={questProgress}
          zoneTheme={zoneTheme}
          onClose={() => closeOverlay(OVERLAY.QUEST_LOG)}
        />
      )}

      {showLore && (
        <LoreScreen
          varTree={varTree}
          time={time}
          turnToStr={getTimeStr}
          zoneTheme={zoneTheme}
          onClose={() => closeOverlay(OVERLAY.LORE)}
        />
      )}

      {showQijuzhu && (
        <QijuzhuScreen
          varTree={varTree}
          time={time}
          narratorStage={narratorStage}
          zoneTheme={zoneTheme}
          onClose={() => closeOverlay(OVERLAY.QIJUZHU)}
        />
      )}

      {showPortraitManager && (
        <PortraitManager
          portraits={portraits}
          onChange={setPortraits}
          knownNames={["旁白", "你", ...listCharacters(varTree).map(c => c.name), ...room.npcs.map(n => n.name)]}
          onClose={() => closeOverlay(OVERLAY.PORTRAIT_MANAGER)}
        />
      )}

      {showPipeline && <PipelineViewer onClose={() => closeOverlay(OVERLAY.PIPELINE)} loading={loading || pendingTalks > 0} waitSecs={waitSecs} />}
      {showTrace && <TraceViewer onClose={() => closeOverlay(OVERLAY.TRACE)} onReport={() => openOverlay(OVERLAY.BUG_REPORT)} />}
      {showCodex && <CodexScreen zoneTheme={zoneTheme} isDayMode={isDayMode} inv={inv} skills={skills} onClose={() => closeOverlay(OVERLAY.CODEX)} />}
      {showBugReport && (
        <BugReportModal
          isDayMode={isDayMode}
          turns={buildBugReportTurns()}
          pipelineData={getPipelineLog()}
          debugSources={debugSources}
          getGameState={() => ({
            room: room.name, inner: innerRoomName, time,
            hp: char.hp, money: char.money,
            flags, questProgress,
            invNames: inv.map(i => typeof i === "string" ? i : i.name),
            skillNames: skills.map(s => s.name),
          })}
          onClose={() => closeOverlay(OVERLAY.BUG_REPORT)}
        />
      )}
      {activeNpcMenu && (
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
          companionUnlocked={isCompanionUnlockedByName(companionState, activeNpcMenu.name)}
        />
      )}
      {activeItemMenu && (
        <ItemActionMenu
          item={activeItemMenu.item}
          mode={activeItemMenu.mode}
          canConsume={activeItemMenu.canConsume}
          roomNpcs={room.npcs || []}
          zoneTheme={zoneTheme}
          onClose={() => setActiveItemMenu(null)}
          onInspect={(it) => inspectItem("item", typeof it === "object" ? it.name : it, null, typeof it === "object" ? it : null, { worldLook: true })}
          onConsume={handleConsumeItem}
          onGive={(npc, it) => handleNpcGift(npc, it)}
          onSell={(npc) => handleNpcTrade(npc)}
          onCollect={handleCollectGround}
          onEquip={handleToggleEquip}
        />
      )}
      {activePersuasion && (() => {
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
          onProgress={(prog) => setPersuasionProgress(m => ({ ...m, [pkey]: prog }))}
          onFinish={(result) => {
            const ap = activePersuasion;
            setActivePersuasion(null);
            // 一场说服结束（不管成没成），清掉该场的续接进度——下次是全新一场。
            setPersuasionProgress(m => { const n = { ...m }; delete n[pkey]; return n; });
            if (result.outcome === "success") {
              if (result.via === "bribe" && result.cost) {
                setChar(c => ({ ...c, money: (c.money || 0) - result.cost }));
              }
              const q = QUCUO_QUESTS.find(x => x.id === ap.questId);
              if (q) {
                forceAdvanceQuest(q, ap.flag);
                const viaText = result.via === "bribe" ? "使了银子" : result.via === "identity" ? "亮了身份" : "把话说到了点子上";
                addLog([{ t: "affection", text: `  ✓ 你${viaText}，「${q.title}」推进。` }]);
              }
            } else {
              addLog([{ t: "sys", text: `  没谈成——这条路暂时没走通，可换个法子再试。` }]);
            }
          }}
        />
        );
      })()}
      {duelingNpc && (() => {
        return (
        <ErrorBoundary label="切磋界面" onReset={() => { setDuelingNpc(null); setPendingQuestBranch(null); }}>
        {activeCompanion(companionState)?.data ? (
          // 有队友出战：2v2团战（玩家+队友 vs 当前对手）。
          // 【改成读通用出战位】此前写死 companionState.snowLeopard.data，
          // 明日香入队后带的是她、这里却仍取雪豹（雪豹此时 active=false、data 可能还在），
          // 结果会出现"带着明日香却是雪豹上场"。单槽互斥，activeCompanion 保证只有一个。
          <TeamDuelScreen
            enemies={[duelingNpc]}
            leopardData={activeCompanion(companionState).data}
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
        );
      })()}
    </>
  );
}

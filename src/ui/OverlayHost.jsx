import { lazy, Suspense } from "react";
import { emptyBodyProfile } from "../domain/rules/character/bodyProfile.js";
import MusicPanel from "./screens/MusicPanel.jsx";
import { getHomestead } from "../domain/rules/map/homestead.js";
import GlobalOverlays from "./panels/GlobalOverlays.jsx";
import { OVERLAY, closeOverlay, openOverlay } from "../store/uiStore.js";
import {
  useSessionUi, setApiCfg, setSettingsInitialTab, setUiScale, setFont,
} from "../store/sessionUiStore.js";

const SettingsPanel = lazy(() => import("./screens/SettingsPanel.jsx"));
const BodyProfilePanel = lazy(() => import("./screens/BodyProfilePanel.jsx"));
const HomesteadPanel = lazy(() => import("./screens/buildings/HomesteadPanel.jsx"));
const CharacterCreate = lazy(() => import("./screens/CharacterCreate.jsx"));
const OpeningSequence = lazy(() => import("./screens/OpeningSequence.jsx"));

export default function OverlayHost({ ctx, apiReady, onCloseInitialSettings }) {
  const apiCfg = useSessionUi(s => s.apiCfg);
  const settingsInitialTab = useSessionUi(s => s.settingsInitialTab);
  const uiScale = useSessionUi(s => s.uiScale);
  const font = useSessionUi(s => s.font);
  const nsfwOn = useSessionUi(s => s.nsfwOn);
  const closeSettings = () => {
    closeOverlay(OVERLAY.SETTINGS);
    // 关闭即清上次停留的子页——下次打开回到设置主页（挂载 effect 复位晚于面板首读，这里兜底）
    setSettingsInitialTab(null);
    onCloseInitialSettings?.();
  };
  if (!apiReady) {
    return ctx.showSettings && (
      <Suspense>
        <SettingsPanel
          onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
          cfg={apiCfg}
          setCfg={(update) => ctx.dispatchCommand("settings", () => setApiCfg(update))}
          dispatchCommand={ctx.dispatchCommand}
          onClose={closeSettings}
          currentSnapshot={ctx.buildCurrentSnapshot}
          onLoadSnapshot={ctx.applySnapshot}
          varTree={ctx.varTree}
          setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
          initialTab={settingsInitialTab}
          onSelectTab={setSettingsInitialTab}
          uiScale={uiScale}
          setUiScale={setUiScale}
          font={font}
          setFont={setFont}
          zoneTheme={ctx.zoneTheme}
          narrator={ctx.narrator}
          setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
        />
      </Suspense>
    );
  }

  if (ctx.showCharCreate) {
    return (
      <Suspense fallback={null}>
        <CharacterCreate onConfirm={ctx.handleCreateCharacter} />
      </Suspense>
    );
  }

  if (ctx.showOpening) {
    return (
      <Suspense fallback={null}>
        <OpeningSequence onFinish={ctx.handleOpeningFinish} playerName={ctx.char.name} />
      </Suspense>
    );
  }

  return (
    <>
      {ctx.showMusicPanel && <MusicPanel onClose={() => closeOverlay(OVERLAY.MUSIC_PANEL)} />}
      {ctx.showHomestead && ctx.innerRoomName && getHomestead(ctx.innerRoomName) && (
        <Suspense fallback={null}>
        <HomesteadPanel
          roomName={ctx.innerRoomName}
          inv={ctx.inv}
          setInv={ctx.setInv}
          char={ctx.char}
          setChar={ctx.setChar}
          zoneTheme={ctx.zoneTheme}
          onClose={() => closeOverlay(OVERLAY.HOMESTEAD)}
          addLog={ctx.addLog}
          dispatchCommand={ctx.dispatchCommand}
        />
        </Suspense>
      )}
      <GlobalOverlays {...ctx.globalOverlays} />
      {ctx.showSettings && (
        <Suspense>
          <SettingsPanel
            onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
            cfg={apiCfg}
            setCfg={(update) => ctx.dispatchCommand("settings", () => setApiCfg(update))}
            dispatchCommand={ctx.dispatchCommand}
            onClose={closeSettings}
            currentSnapshot={ctx.buildCurrentSnapshot}
            onLoadSnapshot={ctx.applySnapshot}
            varTree={ctx.varTree}
            setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
            initialTab={settingsInitialTab}
            onSelectTab={setSettingsInitialTab}
            uiScale={uiScale}
            setUiScale={setUiScale}
            font={font}
            setFont={setFont}
            zoneTheme={ctx.zoneTheme}
            narrator={ctx.narrator}
            setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
            getLiveBlockText={ctx.getLiveBlockText}
          />
        </Suspense>
      )}
      {ctx.showBody && (
        <Suspense fallback={null}>
          <BodyProfilePanel
            profile={ctx.char.bodyProfile || emptyBodyProfile()}
            onChange={ctx.handleBodyProfileChange}
            onClose={() => closeOverlay(OVERLAY.BODY)}
            zoneTheme={ctx.zoneTheme}
            nsfwOn={nsfwOn}
            onRecommend={ctx.recommendOutfit}
            recommendState={ctx.outfitState}
          />
        </Suspense>
      )}
    </>
  );
}

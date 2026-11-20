import { lazy, Suspense } from "react";
import BodyProfilePanel from "../ui/screens/BodyProfilePanel.jsx";
import { emptyBodyProfile } from "../domain/character/bodyProfile.js";
import MusicPanel from "../ui/screens/MusicPanel.jsx";
import HomesteadPanel from "../domain/buildings/HomesteadPanel.jsx";
import { getHomestead } from "../domain/map/homestead.js";
import GlobalOverlays from "../ui/panels/GlobalOverlays.jsx";
import CharacterCreate from "../ui/screens/CharacterCreate.jsx";
import OpeningSequence from "../ui/screens/OpeningSequence.jsx";
import { OVERLAY, closeOverlay, openOverlay } from "../store/uiStore.js";

const SettingsPanel = lazy(() => import("../ui/screens/SettingsPanel.jsx"));

export default function OverlayHost({ ctx, apiReady, onCloseInitialSettings }) {
  const closeSettings = () => {
    closeOverlay(OVERLAY.SETTINGS);
    onCloseInitialSettings?.();
  };
  if (!apiReady) {
    return ctx.showSettings && (
      <Suspense>
        <SettingsPanel
          onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
          cfg={ctx.apiCfg}
          setCfg={(update) => ctx.dispatchCommand("settings", () => ctx.setApiCfg(update))}
          dispatchCommand={ctx.dispatchCommand}
          onClose={closeSettings}
          currentSnapshot={ctx.buildCurrentSnapshot}
          onLoadSnapshot={ctx.applySnapshot}
          varTree={ctx.varTree}
          setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
          initialTab={ctx.settingsInitialTab}
          onSelectTab={ctx.setSettingsInitialTab}
          uiScale={ctx.uiScale}
          setUiScale={ctx.setUiScale}
          font={ctx.font}
          setFont={ctx.setFont}
          zoneTheme={ctx.zoneTheme}
          narrator={ctx.narrator}
          setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
        />
      </Suspense>
    );
  }

  if (ctx.showCharCreate) {
    return <CharacterCreate onConfirm={ctx.handleCreateCharacter} />;
  }

  if (ctx.showOpening) {
    return <OpeningSequence onFinish={ctx.handleOpeningFinish} playerName={ctx.char.name} />;
  }

  return (
    <>
      {ctx.showMusicPanel && <MusicPanel onClose={() => closeOverlay(OVERLAY.MUSIC_PANEL)} />}
      {ctx.showHomestead && ctx.innerRoomName && getHomestead(ctx.innerRoomName) && (
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
      )}
      <GlobalOverlays {...ctx.globalOverlays} />
      {ctx.showSettings && (
        <Suspense>
          <SettingsPanel
            onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
            cfg={ctx.apiCfg}
            setCfg={(update) => ctx.dispatchCommand("settings", () => ctx.setApiCfg(update))}
            dispatchCommand={ctx.dispatchCommand}
            onClose={closeSettings}
            currentSnapshot={ctx.buildCurrentSnapshot}
            onLoadSnapshot={ctx.applySnapshot}
            varTree={ctx.varTree}
            setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
            initialTab={ctx.settingsInitialTab}
            onSelectTab={ctx.setSettingsInitialTab}
            uiScale={ctx.uiScale}
            setUiScale={ctx.setUiScale}
            font={ctx.font}
            setFont={ctx.setFont}
            zoneTheme={ctx.zoneTheme}
            narrator={ctx.narrator}
            setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
            getLiveBlockText={ctx.getLiveBlockText}
          />
        </Suspense>
      )}
      {ctx.showBody && (
        <BodyProfilePanel
          profile={ctx.char.bodyProfile || emptyBodyProfile()}
          onChange={ctx.handleBodyProfileChange}
          onClose={() => closeOverlay(OVERLAY.BODY)}
          zoneTheme={ctx.zoneTheme}
          nsfwOn={ctx.nsfwOn}
          onRecommend={ctx.recommendOutfit}
          recommendState={ctx.outfitState}
        />
      )}
    </>
  );
}

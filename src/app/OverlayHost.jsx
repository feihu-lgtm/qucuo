import SettingsPanel from "../ui/screens/SettingsPanel.jsx";
import BodyProfilePanel from "../ui/screens/BodyProfilePanel.jsx";
import { emptyBodyProfile } from "../domain/character/bodyProfile.js";
import MusicPanel from "../ui/screens/MusicPanel.jsx";
import HomesteadPanel from "../domain/buildings/HomesteadPanel.jsx";
import { getHomestead } from "../domain/map/homestead.js";
import GlobalOverlays from "../ui/panels/GlobalOverlays.jsx";
import CharacterCreate from "../ui/screens/CharacterCreate.jsx";
import OpeningSequence from "../ui/screens/OpeningSequence.jsx";
import { OVERLAY, closeOverlay, openOverlay } from "../store/uiStore.js";

export default function OverlayHost({ ctx, apiReady }) {
  if (!apiReady) {
    return ctx.showSettings && (
      <SettingsPanel
        onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
        cfg={ctx.apiCfg}
        setCfg={(update) => ctx.dispatchCommand("settings", () => ctx.setApiCfg(update))}
        dispatchCommand={ctx.dispatchCommand}
        onClose={() => closeOverlay(OVERLAY.SETTINGS)}
        currentSnapshot={ctx.buildCurrentSnapshot}
        onLoadSnapshot={ctx.applySnapshot}
        varTree={ctx.varTree}
        setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
        initialTab={ctx.settingsInitialTab}
        onSelectTab={ctx.setSettingsInitialTab}
        uiScale={ctx.uiScale}
        setUiScale={ctx.setUiScale}
        narrator={ctx.narrator}
        setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
      />
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
        <SettingsPanel
          onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
          cfg={ctx.apiCfg}
          setCfg={(update) => ctx.dispatchCommand("settings", () => ctx.setApiCfg(update))}
          dispatchCommand={ctx.dispatchCommand}
          onClose={() => closeOverlay(OVERLAY.SETTINGS)}
          currentSnapshot={ctx.buildCurrentSnapshot}
          onLoadSnapshot={ctx.applySnapshot}
          varTree={ctx.varTree}
          setVarTree={(update) => ctx.dispatchCommand("settings", () => ctx.setVarTree(update))}
          initialTab={ctx.settingsInitialTab}
          onSelectTab={ctx.setSettingsInitialTab}
          uiScale={ctx.uiScale}
          setUiScale={ctx.setUiScale}
          narrator={ctx.narrator}
          setNarrator={(update) => ctx.dispatchCommand("settings", () => ctx.setNarrator(update))}
          getLiveBlockText={ctx.getLiveBlockText}
        />
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

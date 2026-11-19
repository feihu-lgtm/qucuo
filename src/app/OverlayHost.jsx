import SettingsPanel from "../SettingsPanel.jsx";
import BodyProfilePanel from "../BodyProfilePanel.jsx";
import { emptyBodyProfile } from "../bodyProfile.js";
import MusicPanel from "../MusicPanel.jsx";
import HomesteadPanel from "../buildings/HomesteadPanel.jsx";
import { getHomestead } from "../homestead.js";
import GlobalOverlays from "../panels/GlobalOverlays.jsx";
import CharacterCreate from "../CharacterCreate.jsx";
import OpeningSequence from "../OpeningSequence.jsx";
import { OVERLAY, closeOverlay, openOverlay } from "../store/uiStore.js";

export default function OverlayHost({ ctx }) {
  if (!ctx.apiCfg.apiKey) {
    return ctx.showSettings && (
      <SettingsPanel
        onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
        cfg={ctx.apiCfg}
        setCfg={ctx.setApiCfg}
        onClose={() => closeOverlay(OVERLAY.SETTINGS)}
        currentSnapshot={ctx.buildCurrentSnapshot}
        onLoadSnapshot={ctx.applySnapshot}
        varTree={ctx.varTree}
        setVarTree={ctx.setVarTree}
        initialTab={ctx.settingsInitialTab}
        uiScale={ctx.uiScale}
        setUiScale={ctx.setUiScale}
        narrator={ctx.narrator}
        setNarrator={ctx.setNarrator}
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
        />
      )}
      <GlobalOverlays {...ctx.globalOverlays} />
      {ctx.showSettings && (
        <SettingsPanel
          onOpenCardImport={() => { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.CARD_IMPORT); }}
          cfg={ctx.apiCfg}
          setCfg={ctx.setApiCfg}
          onClose={() => closeOverlay(OVERLAY.SETTINGS)}
          currentSnapshot={ctx.buildCurrentSnapshot}
          onLoadSnapshot={ctx.applySnapshot}
          varTree={ctx.varTree}
          setVarTree={ctx.setVarTree}
          initialTab={ctx.settingsInitialTab}
          uiScale={ctx.uiScale}
          setUiScale={ctx.setUiScale}
          narrator={ctx.narrator}
          setNarrator={ctx.setNarrator}
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

import { useCallback } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { applyCharacterCard } from "../../features/character/logic.js";
import * as importedRegistry from "../../domain/cards/importedRegistry.js";
import { hpFromNeigong } from "../../domain/npc/npcGeneration.js";
import { unlockImportedCompanion } from "../../domain/companion/companion.js";
import { OVERLAY, closeOverlay } from "../../store/uiStore.js";

export function useCardImportHandlers({
  setVarTree, setChar, setSkills, setInv, setCompanionState, addLog,
  featureCtxRef, schedulerRef,
}) {
  const handleImportNpcs = useCallback((npcs) => {
    const n = importedRegistry.registerImported(npcs, {});
    const withAff = npcs.filter(x => (x.affection || 0) !== 0);
    if (withAff.length) {
      setVarTree(t => {
        const chars = { ...(t.角色 || {}) };
        for (const x of withAff) {
          chars[x.name] = { ...(chars[x.name] || {}), 好感度: Math.max(0, Math.min(100, x.affection)) };
        }
        return { ...t, 角色: chars };
      });
    }
    const here = importedRegistry.getImportedResidentNames()
      .filter(nm => npcs.some(x => x.name === nm));
    addLog([
      { t: "sys", text: `  ${n} 人已入册：${npcs.map(x => x.name).join("、")}` },
      { t: "sys", text: "  他们的人设已挂上世界书，行走江湖时遇到便会照此登场。" },
      ...(here.length
        ? [{ t: "sys", text: `  其中 ${here.join("、")} 驻场于此，此刻已在场。` }]
        : []),
    ]);
  }, [setVarTree, addLog]);

  const handleImportPlayer = useCallback((player, opening) => {
    setChar(c => {
      const next = { ...c };
      if (player.name) next.name = player.name;
      if (player.gender) next.gender = player.gender;
      if (player.special) next.special = { ...(c.special || {}), ...player.special };
      if (player.bodyProfile || player.bodyProfilePrivate) {
        next.bodyProfile = { ...(c.bodyProfile || {}), ...(player.bodyProfile || {}), ...(player.bodyProfilePrivate || {}) };
      }
      if (Number.isFinite(player.neigong)) next.neigong = player.neigong;
      if (Number.isFinite(player.waigong)) next.waigong = player.waigong;
      const maxHp = hpFromNeigong(next.neigong ?? 5, next.special?.体魄 ?? 5);
      const curRatio = (c.hp?.[1] ? c.hp[0] / c.hp[1] : 1);
      next.hp = [Math.max(1, Math.round(maxHp * curRatio)), maxHp];
      return next;
    });
    const cardResult = applyCharacterCard(gameStore.getState(), player, `ci${Date.now().toString(36)}_`);
    applyResult(featureCtxRef.current, cardResult);
    const carried = cardResult.carriedCount;
    const filled = Object.values(player.bodyProfile || {}).filter(v => (v || "").trim()).length;
    const sk = (player.skills || []).length;
    addLog([
      { t: "sys", text: `  已按卡改写自身：体貌填了 ${filled}/7 项，七维已录${sk ? `，带 ${sk} 门武学` : ""}${carried ? `，${carried} 件随身物已入包` : ""}。` },
      ...(filled < 7 ? [{ t: "sys", text: "  余下几项去右栏「◈ 体貌」自己补，私密层那五项只能手填。" }] : []),
      ...(opening?.rewritten ? [{ t: "narr", text: opening.rewritten }] : []),
    ]);
  }, [setChar, setSkills, setInv, addLog]);

  const handleImportWorld = useCallback((items) => {
    const n = importedRegistry.registerImportedWorld(items, {});
    if (n) addLog([{ t: "sys", text: `  ${n} 条地理与规矩已入册，提到时自会浮现。` }]);
  }, [addLog]);

  const handleCreateCharacter = ({ name, gender, fromCard }) => {
    const createCharacter = () => {
      setChar(c => {
        const next = { ...c, name, gender };
        if (fromCard) {
          if (fromCard.special) next.special = { ...(c.special || {}), ...fromCard.special };
          if (fromCard.bodyProfile || fromCard.bodyProfilePrivate) {
            next.bodyProfile = { ...(c.bodyProfile || {}), ...(fromCard.bodyProfile || {}), ...(fromCard.bodyProfilePrivate || {}) };
          }
          if (Number.isFinite(fromCard.neigong)) next.neigong = fromCard.neigong;
          if (Number.isFinite(fromCard.waigong)) next.waigong = fromCard.waigong;
          const maxHp = hpFromNeigong(next.neigong ?? 5, next.special?.体魄 ?? 5);
          next.hp = [maxHp, maxHp];
        }
        return next;
      });
      if (fromCard) {
        const cardResult = applyCharacterCard(gameStore.getState(), fromCard, "cc_");
        applyResult(featureCtxRef.current, cardResult);
        const n = cardResult.carriedCount;
        const sk = (fromCard.skills || []).length;
        if (fromCard.persona || sk || n) {
          addLog([{ t: "sys", text: `  （已按入册的角色卡定下体貌与天赋${sk ? `，带 ${sk} 门武学` : ""}${n ? `，${n} 件随身物已入包、装备已上身` : ""}）` }]);
        }
      }
      const starterName = importedRegistry.getPendingStarterCompanion();
      if (starterName) {
        const npcData = importedRegistry.getImportedNpc(starterName);
        importedRegistry.clearPendingStarterCompanion();
        if (npcData) {
          setCompanionState(prev => unlockImportedCompanion(prev, npcData));
          addLog([{ t: "sys", text: `  （开局同行「${starterName}」已随队）` }]);
        }
      }
    };
    const scheduler = schedulerRef.current;
    if (scheduler) scheduler.runSilently(createCharacter);
    else createCharacter();
    scheduler?.resetPlayed();
    closeOverlay(OVERLAY.CHAR_CREATE);
  };

  const handleOpeningFinish = () => {
    schedulerRef.current?.resetPlayed();
    closeOverlay(OVERLAY.OPENING);
  };

  const handleBodyProfileChange = (next) => setChar(c => ({ ...c, bodyProfile: next }));

  return {
    handleImportNpcs,
    handleImportPlayer,
    handleImportWorld,
    handleCreateCharacter,
    handleOpeningFinish,
    handleBodyProfileChange,
  };
}

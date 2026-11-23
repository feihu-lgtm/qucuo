import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameActions, gameStore, markGameReplaced } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { applyCharacterCard } from "../../features/character/logic.js";
import * as importedRegistry from "../../domain/rules/cards/importedRegistry.js";
import { deriveMovesetFromSkills, hpFromNeigong } from "../../domain/rules/npc/npcGeneration.js";
import { STARTER_SKILLS } from "../../domain/data/kungfu/starterKungfu.js";
import { unlockImportedCompanion } from "../../domain/rules/companion/companion.js";
import { OVERLAY, closeOverlay } from "../../store/uiStore.js";

export function useCardImportHandlers({
  setVarTree, schedulerRef,
}) {
  // Store 直读（路线一）：char/skills/inv/companionState/log 的写全走 gameActions。
  const { setChar, setSkills, setInv, setCompanionState, setLog } = gameActions;
  const addLog = (lines) => setLog((p) => [...p, ...lines]);
  const handleImportNpcs = useCallback((npcs) => applyResult(featureCtx(), () => {
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
  }, { feature: "cards.importNpcs" }), [setVarTree, addLog]);

  const handleImportPlayer = useCallback((player, opening) => applyResult(featureCtx(), () => {
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
    applyResult(featureCtx(), cardResult);
    const carried = cardResult.carriedCount;
    const filled = Object.values(player.bodyProfile || {}).filter(v => (v || "").trim()).length;
    const sk = (player.skills || []).length;
    addLog([
      { t: "sys", text: `  已按卡改写自身：体貌填了 ${filled}/7 项，七维已录${sk ? `，带 ${sk} 门武学` : ""}${carried ? `，${carried} 件随身物已入包` : ""}。` },
      ...(filled < 7 ? [{ t: "sys", text: "  余下几项去右栏「◈ 体貌」自己补，私密层那五项只能手填。" }] : []),
      // 开场改写是叙事正文（desc），不是旁白角色（narrator）；原先写成 "narr"，颜色表和正文样式都认不出
      ...(opening?.rewritten ? [{ t: "desc", text: `  ${opening.rewritten}` }] : []),
    ]);
  }, { feature: "cards.importPlayer" }), [setChar, setSkills, setInv, addLog]);

  const handleImportWorld = useCallback((items) => applyResult(featureCtx(), () => {
    const n = importedRegistry.registerImportedWorld(items, {});
    if (n) addLog([{ t: "sys", text: `  ${n} 条地理与规矩已入册，提到时自会浮现。` }]);
  }, { feature: "cards.importWorld" }), [addLog]);

  const handleCreateCharacter = ({ name, gender, fromCard, special, starterSkillId, bodyProfile, portraitUrl }) => applyResult(featureCtx(), () => {
    const starterSkill = !fromCard && STARTER_SKILLS.find((skill) => skill.id === starterSkillId);
    const initialSkills = starterSkill ? [{
      ...starterSkill, level: 1, exp: 0, maxExp: 100, stage: "入门",
      active: true, source: "开局", upgradable: true,
    }] : null;
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
        } else if (special && initialSkills) {
          next.special = { ...special };
          if (bodyProfile) next.bodyProfile = { ...(c.bodyProfile || {}), ...bodyProfile };
          const maxHp = hpFromNeigong(next.neigong ?? 5, special.体魄);
          next.hp = [maxHp, maxHp];
          next.moveset = deriveMovesetFromSkills(initialSkills);
        }
        // 新角色自带头像标识：开局选的立绘记在本存档里，不去动别的存档共用的头像偏好。
        next.avatarId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        next.portrait = !fromCard && portraitUrl ? portraitUrl : "";
        return next;
      });
      if (fromCard) {
        const cardResult = applyCharacterCard(gameStore.getState(), fromCard, "cc_");
        applyResult(featureCtx(), cardResult);
        const n = cardResult.carriedCount;
        const sk = (fromCard.skills || []).length;
        if (fromCard.persona || sk || n) {
          addLog([{ t: "sys", text: `  （已按入册的角色卡定下体貌与天赋${sk ? `，带 ${sk} 门武学` : ""}${n ? `，${n} 件随身物已入包、装备已上身` : ""}）` }]);
        }
      } else if (initialSkills) {
        setSkills(initialSkills);
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
      markGameReplaced();
    };
    const scheduler = schedulerRef.current;
    if (scheduler) scheduler.runSilently(createCharacter);
    else createCharacter();
    scheduler?.resetPlayed();
    closeOverlay(OVERLAY.CHAR_CREATE);
  }, { feature: "cards.createCharacter" });

  const handleOpeningFinish = () => {
    schedulerRef.current?.resetPlayed();
    closeOverlay(OVERLAY.OPENING);
  };

  const handleBodyProfileChange = (next) => applyResult(featureCtx(), {
    changes: { char: (c) => ({ ...c, bodyProfile: next }) },
  }, { feature: "character.bodyProfile" });

  return {
    handleImportNpcs,
    handleImportPlayer,
    handleImportWorld,
    handleCreateCharacter,
    handleOpeningFinish,
    handleBodyProfileChange,
  };
}

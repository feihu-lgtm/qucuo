import { useCallback, useEffect, useRef } from "react";
import { gameActions, gameStore, useGameStore } from "../../store/gameStore.js";

export function useGameStoreBindings({ restored }) {
  const {
    setChar, setDao, setSkills, setExp, setPot, setInv, setCompanionState, setPreset,
    setRoom, setInnerRoomName, setMapData, setTime, setLog, setConvo, setNarrator,
    setVarTreeState, setFlags, setQuestProgress, setPersuasionProgress,
    setClaimedMilestones, setDeposit, setDepositedAt, setPledgedItems,
  } = gameActions;
  const preset = useGameStore(s => s.preset);
  const room = useGameStore(s => s.room);
  const innerRoomName = useGameStore(s => s.innerRoomName);
  const restoredInnerRef = useRef(null);
  const prevRoomNameRef = useRef(room.name);
  const char = useGameStore(s => s.char);
  const dao = useGameStore(s => s.dao);
  const skills = useGameStore(s => s.skills);
  const companionState = useGameStore(s => s.companionState);
  const companionStateRef = useRef(companionState);
  const inv = useGameStore(s => s.inv);
  const log = useGameStore(s => s.log);
  const convo = useGameStore(s => s.convo);
  const exp = useGameStore(s => s.exp);
  const pot = useGameStore(s => s.pot);
  const flags = useGameStore(s => s.flags);
  const questProgress = useGameStore(s => s.questProgress);
  const persuasionProgress = useGameStore(s => s.persuasionProgress);
  const mapData = useGameStore(s => s.mapData);
  const deposit = useGameStore(s => s.deposit);
  const depositedAt = useGameStore(s => s.depositedAt);
  const pledgedItems = useGameStore(s => s.pledgedItems);
  const time = useGameStore(s => s.time);
  const timeRef = useRef(time);
  const narrator = useGameStore(s => s.narrator);
  const varTree = useGameStore(s => s.varTree);
  const claimedMilestones = useGameStore(s => s.claimedMilestones);
  const varTreeRef = useRef(varTree);
  const setVarTree = useCallback((next) => {
    const v = typeof next === "function" ? next(varTreeRef.current) : next;
    varTreeRef.current = v;
    gameActions.setVarTree(v);
  }, []);
  useEffect(() => gameStore.subscribe((state) => { varTreeRef.current = state.varTree; }), []);

  return {
    setChar, setDao, setSkills, setExp, setPot, setInv, setCompanionState, setPreset,
    setRoom, setInnerRoomName, setMapData, setTime, setLog, setConvo, setNarrator,
    setVarTreeState, setFlags, setQuestProgress, setPersuasionProgress, setClaimedMilestones,
    setDeposit, setDepositedAt, setPledgedItems, preset, room, innerRoomName,
    restoredInnerRef, prevRoomNameRef, char, dao, skills, companionState,
    companionStateRef, inv, log, convo, exp, pot, flags, questProgress,
    persuasionProgress, mapData, deposit, depositedAt, pledgedItems, time,
    timeRef, narrator, varTree, claimedMilestones, varTreeRef, setVarTree,
  };
}

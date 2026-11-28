// 通用地宫探索主屏：本地推演层节点，战斗时懒加载 DuelScreen，离开时统一原子落盘。
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Overlay, Header } from "../buildings/common.jsx";
import DungeonNodeView from "./DungeonNodeView.jsx";
import {
  applyDungeonBattleResult,
  applyMapBattleResult,
  createDungeonRun,
  DUNGEON_ID_TO_DISTRICT,
  ensureDungeonWorld,
  getGameDayFromTime,
  moveRoom,
  normalizeDungeonStore,
  resolveDungeonChoice,
  restoreCheckpoint,
  retreatDungeonRun,
  retreatRun,
  routeRoomAction,
  routeRoomText,
  selectDungeonNode,
  startMapRun,
} from "../../../domain/rules/dungeon/engine.js";
import { settleDungeonRun, settleMapRun } from "../../../features/dungeon/logic.js";
import { applyResult } from "../../../features/run.js";
import DungeonMapPanel from "../../components/DungeonMapPanel.jsx";
import { narrateDungeonEvent } from "../../../app/calls/screenCalls.js";
import { gameActions, gameStore } from "../../../store/gameStore.js";
import { persistDungeonWorld, persistActiveDungeonMapRun, resetDungeonWorldRun } from "../../../store/dungeonWrites.js";

const DuelScreen = lazy(() => import("../DuelScreen.jsx"));

export default function DungeonScreen({
  building, char, inv, skills, effectiveSpecialNow,
  onClose, inline, addLog, jotNote, captureUndo, runCommand, act,
}) {
  const [run, setRun] = useState(() => createDungeonRun(building?.dungeonId, { char }));
  const [narration, setNarration] = useState("");
  const [worldVersion, setWorldVersion] = useState(0);
  const settledRef = useRef(false);
  const narrationSeqRef = useRef(0);

  const mapDistrictKey = DUNGEON_ID_TO_DISTRICT[building?.dungeonId];
  // 注意：mapRun 保持组件内唯一一个初始为 null 的 state（测试桩约定）
  const [mapRun, setMapRun] = useState(null);

  const storeSnapshot = gameStore?.getState?.() || {};
  const dungeonStore = normalizeDungeonStore(storeSnapshot.dungeonRun);
  const currentTime = storeSnapshot.time ?? 0;
  const currentDay = getGameDayFromTime(currentTime);

  const companionNames = Object.values(storeSnapshot.companionState || {})
    .filter((c) => c?.unlocked && c?.label)
    .map((c) => c.label);

  const currentWorld = mapDistrictKey
    ? ensureDungeonWorld(mapDistrictKey, dungeonStore.worlds?.[mapDistrictKey], {
        time: currentTime,
        excludedNames: companionNames,
      })
    : null;
  const savedActiveRun = dungeonStore.active && dungeonStore.active.districtKey === mapDistrictKey
    ? dungeonStore.active
    : null;

  // 若首次为本宫生成了 7 天世界，写回 store 保证离开时可直接读取
  useEffect(() => {
    if (!mapDistrictKey || !currentWorld) return;
    if (dungeonStore.worlds?.[mapDistrictKey]?.seed !== currentWorld.seed) {
      persistDungeonWorld(dungeonStore, mapDistrictKey, currentWorld);
    }
  }, [mapDistrictKey, currentWorld?.seed]);

  const persistActiveMapRun = (nextMapRun) => {
    persistActiveDungeonMapRun(mapDistrictKey, nextMapRun, { currentWorld, fallbackTime: currentTime });
  };

  const oldRunUntouched = run.clearedNodes === 0 && !run.usedItems.length
    && run.hp[0] === (char?.hp?.[0] ?? run.hp[0]);

  useEffect(() => {
    const latest = run.log[run.log.length - 1];
    if (!latest || run.status !== "exploring" || run.clearedNodes === 0) return;
    const seq = ++narrationSeqRef.current;
    let cancelled = false;
    narrateDungeonEvent({
      dungeonName: run.dungeonName,
      floorName: run.floorName,
      nodeTitle: "",
      summary: latest,
    }).then((text) => {
      if (!cancelled && narrationSeqRef.current === seq && text) setNarration(text);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [run.clearedNodes, run.status, run.dungeonName, run.floorName, run.log]);

  const execSettle = (settle) => {
    const exec = runCommand || ((_id, fn) => fn());
    exec("actLocal", () => {
      captureUndo?.();
      const result = settle();
      applyResult({ gameActions, addLog, jotNote }, result, { feature: "dungeon.settle" });
    });
  };

  const runRef = useRef(run);
  runRef.current = run;
  const mapRunRef = useRef(mapRun);
  mapRunRef.current = mapRun;
  const charRef = useRef(char);
  charRef.current = char;
  useEffect(() => () => {
    if (settledRef.current) return;
    const m = mapRunRef.current;
    const r = runRef.current;
    const c = charRef.current;
    if (m) {
      settledRef.current = true;
      execSettle(() => settleMapRun(gameStore.getState(), m.status === "exploring" || m.status === "combat" ? retreatRun({ ...m, status: "exploring" }).runState : m));
    } else if (r.status !== "exploring" || r.clearedNodes > 0 || r.usedItems.length > 0
        || r.hp[0] !== (c?.hp?.[0] ?? r.hp[0])) {
      settledRef.current = true;
      execSettle(() => settleDungeonRun(gameStore.getState(), r.status === "exploring" ? retreatDungeonRun(r) : r));
    }
  }, []);

  const handleSettleAndClose = () => {
    if (settledRef.current) {
      onClose?.();
      return;
    }
    settledRef.current = true;
    execSettle(() => settleDungeonRun(gameStore.getState(), run));
    onClose?.();
  };

  const handleMapSettleAndClose = () => {
    if (settledRef.current) {
      onClose?.();
      return;
    }
    settledRef.current = true;
    execSettle(() => settleMapRun(gameStore.getState(), mapRun));
    onClose?.();
  };

  const startInnerMap = (entryRoom) => {
    const st = gameStore?.getState?.() || {};
    const nextRun = startMapRun(mapDistrictKey, `${building?.dungeonId}|${Date.now()}`, {
      char,
      world: currentWorld,
      entryRoom,
      flags: st.flags || [],
      skills: skills || st.skills || [],
      inv: inv || st.inv || [],
    });
    setMapRun(nextRun);
    persistActiveMapRun(nextRun);
  };

  const resumeSavedMap = () => {
    if (!savedActiveRun) return;
    setMapRun(savedActiveRun);
  };

  const resetWorldMap = () => {
    if (!mapDistrictKey) return;
    const fresh = ensureDungeonWorld(mapDistrictKey, currentWorld, {
      time: currentTime,
      excludedNames: companionNames,
      forceReset: true,
    });
    resetDungeonWorldRun(mapDistrictKey, fresh);
    setWorldVersion((v) => v + 1);
  };

  const updateMapRun = (next) => {
    setMapRun(next);
    persistActiveMapRun(next);
  };

  const handleMapMove = (dir) => {
    const next = moveRoom(mapRun, dir).runState;
    updateMapRun(next);
  };

  const applyMapRoute = (res, text) => {
    if (!res) return;
    if (res.needsAI) { act?.(text); return; }
    const next = res.runState;
    if (!next) return;
    if (res.combatNpc && !next.activeBattle) {
      updateMapRun({
        ...next,
        status: "combat",
        activeBattle: { npc: res.combatNpc, reward: { money: 25, exp: 5, pot: 3 }, roomName: next.current },
      });
      return;
    }
    updateMapRun(next);
  };

  const handleMapAction = (label) => applyMapRoute(routeRoomAction(mapRun, label, { attrs: effectiveSpecialNow }), label);
  const handleMapText = (t) => applyMapRoute(routeRoomText(mapRun, t, { attrs: effectiveSpecialNow }), t);
  const handleMapRetreat = () => updateMapRun(retreatRun(mapRun).runState);
  const handleMapRestoreCheckpoint = () => {
    const res = restoreCheckpoint(mapRun);
    if (res?.runState) updateMapRun(res.runState);
  };

  const handleMapBattleFinish = (outcome, loot, _battleLog, _moveset, usedItems, playerHp, dodgeStolenItems) => {
    const next = applyMapBattleResult(mapRun, { outcome, loot, playerHp, usedItems, dodgeStolenItems });
    updateMapRun(next);
  };

  const handleHeaderClose = () => {
    if (mapRun) {
      if (mapRun.status === "exploring") {
        updateMapRun(retreatRun(mapRun).runState);
        return;
      }
      if (mapRun.status === "combat") return;
      handleMapSettleAndClose();
      return;
    }
    if (run.status === "victory" || run.status === "retreated" || run.status === "defeated") {
      handleSettleAndClose();
      return;
    }
    if (run.clearedNodes === 0 && !run.usedItems.length && run.hp[0] === (char?.hp?.[0] ?? run.hp[0])) {
      onClose?.();
      return;
    }
    setRun((prev) => retreatDungeonRun(prev));
  };

  const handleSelectNode = (nodeId) => {
    setNarration("");
    setRun((prev) => selectDungeonNode(prev, nodeId));
  };

  const handleChoose = (choiceId) => {
    setRun((prev) => resolveDungeonChoice(prev, choiceId, effectiveSpecialNow));
  };

  const handleBattleFinish = (outcome, loot, _battleLog, _moveset, usedItems, playerHp, dodgeStolenItems) => {
    setRun((prev) => applyDungeonBattleResult(prev, {
      outcome, loot, usedItems, playerHp, dodgeStolenItems,
    }));
  };

  const curMapRoom = mapRun ? mapRun.map.rooms[mapRun.current] : null;
  const canRetreatHere = Boolean(mapRun && (mapRun.current === mapRun.map.anchor || curMapRoom?.exitUnlocked));
  const availableSilverNow = mapRun
    ? Math.max(0, (mapRun.charMoney ?? char?.money ?? 0) + (mapRun.loot?.money || 0) - (mapRun.spentMoney || 0))
    : 0;
  const daysLeft = currentWorld ? Math.max(0, (currentWorld.expiresAtDay ?? currentDay + 7) - currentDay) : 7;

  return (
    <Overlay onClose={handleHeaderClose} inline={inline}>
      <Header name={building?.name || run.dungeonName} onClose={handleHeaderClose} />
      <div className="dungeon-screen-body" data-world-v={worldVersion}>
        <div className="dungeon-screen-statbar">
          {mapRun ? (
            <>
              <span>{mapRun.displayName || mapRun.districtKey}·内层（第 {mapRun.step} 步）</span>
              <span>气血 {mapRun.hp[0]}/{mapRun.hp[1]}</span>
              <span>银两可用 {availableSilverNow}两 · 物事 {mapRun.loot.items.length}</span>
            </>
          ) : (
            <>
              <span>{run.floorName}（{run.floor}/{run.maxFloors} 层 · 进度 {run.step}/{run.stepsPerFloor}）</span>
              <span>气血 {run.hp[0]}/{run.hp[1]}</span>
              <span>收获：{run.loot.money}两 · 物事 {run.loot.items.length}</span>
            </>
          )}
        </div>

        {mapRun ? (
          mapRun.status === "exploring" || mapRun.status === "combat" ? (
            <>
              <DungeonMapPanel
                room={{ name: mapRun.current, ...curMapRoom }}
                runState={mapRun}
                onMove={handleMapMove}
                onAction={handleMapAction}
                onText={handleMapText}
              />
              {canRetreatHere && (
                <button
                  type="button"
                  onClick={handleMapRetreat}
                  className="dungeon-screen-1"
                >
                  {mapRun.current === mapRun.map.anchor ? "撤回外城（保收获）" : `经「${mapRun.current}」撤回外城（保收获）`}
                </button>
              )}
              {mapRun.log.length > 0 && (
                <div className="dungeon-screen-log">
                  {mapRun.log.slice(-5).map((line, i) => (
                    <div key={i}>· {line}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="dungeon-screen-result">
              <div className="dungeon-screen-result-title">
                {mapRun.status === "victory" ? "打通内层地宫！" : mapRun.status === "retreated" ? "已稳妥撤回外城。" : "负伤被逐出地宫……"}
              </div>
              <div>带出：银两 {mapRun.loot.money} 两 · 潜能 {mapRun.loot.pot} · 物事 {mapRun.loot.items.length} 件</div>
              <div className="dungeon-screen-result-actions">
                {mapRun.status === "defeated" && mapRun.checkpointSnapshot && (
                  <button
                    type="button"
                    onClick={handleMapRestoreCheckpoint}
                    className="dungeon-screen-btn-checkpoint"
                  >
                    从检查点重来（{mapRun.checkpointSnapshot.current}）
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMapSettleAndClose}
                  className="dungeon-screen-2"
                >
                  结算离开
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            {mapDistrictKey && oldRunUntouched && (
              <div className="dungeon-screen-entrybar">
                {savedActiveRun && (
                  <button
                    type="button"
                    onClick={resumeSavedMap}
                    className="dungeon-screen-btn-resume"
                  >
                    继续上次进度（{savedActiveRun.current}）
                  </button>
                )}
                {(currentWorld?.unlockedEntries || [currentWorld?.map?.anchor]).filter(Boolean).map((entryName) => (
                  <button
                    key={entryName}
                    type="button"
                    data-part="enter-inner-map"
                    onClick={() => startInnerMap(entryName)}
                    className="dungeon-screen-3"
                  >
                    {entryName === currentWorld?.map?.anchor ? `进入内层地图（${entryName}）` : `由已通出口潜入：${entryName}`}
                  </button>
                ))}
                {currentWorld?.bossDefeated && (
                  <button
                    type="button"
                    onClick={resetWorldMap}
                    className="dungeon-screen-btn-reset"
                  >
                    重探新脉（换一张新图）
                  </button>
                )}
                {currentWorld && (
                  <span className="dungeon-screen-hint">
                    当前地宫余 {daysLeft} 日不变 · 潜入冒险者 {currentWorld.adventurers?.length || 0} 人
                  </span>
                )}
              </div>
            )}
            <DungeonNodeView
              run={run}
              effectiveSpecialNow={effectiveSpecialNow}
              narration={narration}
              onSelectNode={handleSelectNode}
              onChoose={handleChoose}
              onRetreat={() => setRun((prev) => retreatDungeonRun(prev))}
              onSettleClose={handleSettleAndClose}
            />
          </>
        )}

        {!mapRun && run.log.length > 0 && (
          <div className="dungeon-screen-log">
            {run.log.slice(-5).map((line, i) => (
              <div key={i}>· {line}</div>
            ))}
          </div>
        )}
      </div>

      {run.status === "combat" && run.activeEnemy && (
        <Suspense fallback={null}>
          <DuelScreen
            key={run.activeNode?.nodeId || run.activeEnemy.id}
            npc={run.activeEnemy}
            playerChar={{ ...char, hp: run.hp, special: effectiveSpecialNow }}
            pendingCombatBuff={char?.pendingCombatBuff}
            playerInv={inv}
            playerMoveset={char?.moveset}
            playerSkills={skills}
            onFinish={handleBattleFinish}
          />
        </Suspense>
      )}

      {mapRun?.status === "combat" && mapRun.activeBattle?.npc && (
        <Suspense fallback={null}>
          <DuelScreen
            key={`map_${mapRun.step}_${mapRun.activeBattle.npc.id}`}
            npc={mapRun.activeBattle.npc}
            playerChar={{ ...char, hp: mapRun.hp, special: effectiveSpecialNow }}
            pendingCombatBuff={char?.pendingCombatBuff}
            playerInv={inv}
            playerMoveset={char?.moveset}
            playerSkills={skills}
            onFinish={handleMapBattleFinish}
          />
        </Suspense>
      )}
    </Overlay>
  );
}

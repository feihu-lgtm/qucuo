// 通用地宫探索主屏：本地推演层节点，战斗时懒加载 DuelScreen，离开时统一原子落盘。
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Overlay, Header } from "../buildings/common.jsx";
import DungeonNodeView from "./DungeonNodeView.jsx";
import {
  applyDungeonBattleResult,
  createDungeonRun,
  resolveDungeonChoice,
  retreatDungeonRun,
  selectDungeonNode,
} from "../../../domain/rules/dungeon/engine.js";
import { settleDungeonRun } from "../../../features/dungeon/logic.js";
import { narrateDungeonEvent } from "../../../engine/ports/dungeonNarration.js";
import { gameActions, gameStore } from "../../../store/gameStore.js";

const DuelScreen = lazy(() => import("../DuelScreen.jsx"));

export default function DungeonScreen({
  building, char, inv, skills, effectiveSpecialNow, zoneTheme,
  onClose, inline, addLog, jotNote, captureUndo, runCommand,
}) {
  const [run, setRun] = useState(() => createDungeonRun(building?.dungeonId, { char }));
  const [narration, setNarration] = useState("");
  const settledRef = useRef(false);
  const narrationSeqRef = useRef(0);

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

  const handleSettleAndClose = () => {
    if (settledRef.current) {
      onClose?.();
      return;
    }
    settledRef.current = true;
    const exec = runCommand || ((_id, fn) => fn());
    exec("actLocal", () => {
      captureUndo?.();
      const result = settleDungeonRun(gameStore.getState(), run);
      if (result.changes) {
        gameActions.setChar(result.changes.char);
        gameActions.setInv(result.changes.inv);
        gameActions.setExp(result.changes.exp);
        gameActions.setPot(result.changes.pot);
        gameActions.setTime(result.changes.time);
        gameActions.setFlags(result.changes.flags);
      }
      if (result.logs?.length) addLog?.(result.logs);
      if (result.note) jotNote?.(result.note);
    });
    onClose?.();
  };

  const handleHeaderClose = () => {
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

  return (
    <Overlay onClose={handleHeaderClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || run.dungeonName} zoneTheme={zoneTheme} onClose={handleHeaderClose} />
      <div style={{ padding: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          fontSize: 11.5, color: zoneTheme.textDim, marginBottom: 10,
          borderBottom: `1px solid ${zoneTheme.border}`, paddingBottom: 8,
        }}>
          <span>{run.floorName}（{run.floor}/{run.maxFloors} 层 · 进度 {run.step}/{run.stepsPerFloor}）</span>
          <span>气血 {run.hp[0]}/{run.hp[1]}</span>
          <span>收获：{run.loot.money}两 · 物事 {run.loot.items.length}</span>
        </div>

        <DungeonNodeView
          run={run}
          effectiveSpecialNow={effectiveSpecialNow}
          zoneTheme={zoneTheme}
          narration={narration}
          onSelectNode={handleSelectNode}
          onChoose={handleChoose}
          onRetreat={() => setRun((prev) => retreatDungeonRun(prev))}
          onSettleClose={handleSettleAndClose}
        />

        {run.log.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 8, borderTop: `1px solid ${zoneTheme.border}`,
            fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6,
          }}>
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
            zoneTheme={zoneTheme}
            onFinish={handleBattleFinish}
          />
        </Suspense>
      )}
    </Overlay>
  );
}

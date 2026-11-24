// 通用地宫探索主屏：本地推演层节点，战斗时懒加载 DuelScreen，离开时统一原子落盘。
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Overlay, Header } from "../buildings/common.jsx";
import DungeonNodeView from "./DungeonNodeView.jsx";
import {
  applyDungeonBattleResult,
  createDungeonRun,
  DUNGEON_ID_TO_DISTRICT,
  moveRoom,
  resolveDungeonChoice,
  retreatDungeonRun,
  retreatRun,
  selectDungeonNode,
  startMapRun,
} from "../../../domain/rules/dungeon/engine.js";
import { settleDungeonRun, settleMapRun } from "../../../features/dungeon/logic.js";
import DungeonMapPanel from "../../components/DungeonMapPanel.jsx";
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
  // 内层地图分支：与旧节点流并存， dungeonId→districtKey 有映射才给入口
  const mapDistrictKey = DUNGEON_ID_TO_DISTRICT[building?.dungeonId];
  const [mapRun, setMapRun] = useState(null);
  // 旧 run 还没动过（没清节点/没嗑药/没掉血）才放转入，免得转入丢掉未结算进度
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

  // 内层地图：探索中关屏兜底按撤退结算（丢图不丢货）；终局走 settleMapRun 落盘
  const handleMapSettleAndClose = () => {
    if (settledRef.current) {
      onClose?.();
      return;
    }
    settledRef.current = true;
    const exec = runCommand || ((_id, fn) => fn());
    exec("actLocal", () => {
      captureUndo?.();
      const result = settleMapRun(gameStore.getState(), mapRun);
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

  const startInnerMap = () => {
    setMapRun(startMapRun(mapDistrictKey, `${building?.dungeonId}|${Date.now()}`, { char }));
  };
  const handleMapMove = (dir) => setMapRun((prev) => moveRoom(prev, dir).runState);
  // 房间事件/自由文本裁决下一单接 resolver，这里先把输入留进 run 日志
  const handleMapAction = (label) => setMapRun((prev) => ({
    ...prev, log: [...prev.log, `（内层事件裁决接线中，先记下：${label}）`],
  }));
  const handleMapText = (t) => setMapRun((prev) => ({
    ...prev, log: [...prev.log, `（内层动作裁决接线中，先记下：${t}）`],
  }));
  const handleMapRetreat = () => setMapRun((prev) => retreatRun(prev).runState);

  const handleHeaderClose = () => {
    if (mapRun) {
      if (mapRun.status === "exploring") {
        setMapRun((prev) => retreatRun(prev).runState);
        return;
      }
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

  return (
    <Overlay onClose={handleHeaderClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || run.dungeonName} zoneTheme={zoneTheme} onClose={handleHeaderClose} />
      <div style={{ padding: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          fontSize: 11.5, color: zoneTheme.textDim, marginBottom: 10,
          borderBottom: `1px solid ${zoneTheme.border}`, paddingBottom: 8,
        }}>
          {mapRun ? (
            <>
              <span>{mapRun.districtKey}·内层（第 {mapRun.step} 步）</span>
              <span>气血 {mapRun.hp[0]}/{mapRun.hp[1]}</span>
              <span>收获：{mapRun.loot.money}两 · 物事 {mapRun.loot.items.length}</span>
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
          mapRun.status === "exploring" ? (
            <>
              <DungeonMapPanel
                room={{ name: mapRun.current, ...mapRun.map.rooms[mapRun.current] }}
                runState={mapRun}
                zoneTheme={zoneTheme}
                onMove={handleMapMove}
                onAction={handleMapAction}
                onText={handleMapText}
              />
              {mapRun.current === mapRun.map.anchor && (
                <button
                  type="button"
                  onClick={handleMapRetreat}
                  style={{
                    marginTop: 10, padding: "4px 14px", fontSize: 11.5,
                    border: `1px solid ${zoneTheme.border}`, color: zoneTheme.text,
                    background: "transparent", cursor: "pointer",
                  }}
                >
                  撤回外城（保收获）
                </button>
              )}
              {mapRun.map.rooms[mapRun.current]?.isBoss && (
                <div style={{ marginTop: 8, fontSize: 11, color: zoneTheme.textDim }}>
                  此地有镇宫首领盘踞——决战接线中，先记下方位。
                </div>
              )}
              {mapRun.log.length > 0 && (
                <div style={{
                  marginTop: 12, paddingTop: 8, borderTop: `1px solid ${zoneTheme.border}`,
                  fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6,
                }}>
                  {mapRun.log.slice(-5).map((line, i) => (
                    <div key={i}>· {line}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              <div style={{ color: zoneTheme.accent, marginBottom: 6 }}>
                {mapRun.status === "victory" ? "打通内层地宫！" : mapRun.status === "retreated" ? "已撤回锚点之外。" : "负伤被逐出地宫……"}
              </div>
              <div>带出：{mapRun.loot.money} 两 · 物事 {mapRun.loot.items.length} 件</div>
              <button
                type="button"
                onClick={handleMapSettleAndClose}
                style={{
                  marginTop: 10, padding: "4px 14px", fontSize: 11.5,
                  border: `1px solid ${zoneTheme.border}`, color: zoneTheme.text,
                  background: "transparent", cursor: "pointer",
                }}
              >
                结算离开
              </button>
            </div>
          )
        ) : (
          <>
            {mapDistrictKey && oldRunUntouched && (
              <button
                type="button"
                data-part="enter-inner-map"
                onClick={startInnerMap}
                style={{
                  marginBottom: 10, padding: "4px 14px", fontSize: 11.5,
                  border: `1px solid ${zoneTheme.accentDim}`, color: zoneTheme.accent,
                  background: "transparent", cursor: "pointer",
                }}
              >
                转入内层地图（房间图探法）
              </button>
            )}
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
          </>
        )}

        {!mapRun && run.log.length > 0 && (
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

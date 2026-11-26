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
  routeRoomAction,
  routeRoomText,
  selectDungeonNode,
  startMapRun,
} from "../../../domain/rules/dungeon/engine.js";
import { settleDungeonRun, settleMapRun } from "../../../features/dungeon/logic.js";
import { applyResult } from "../../../features/run.js";
import DungeonMapPanel from "../../components/DungeonMapPanel.jsx";
import { narrateDungeonEvent } from "../../../engine/ports/dungeonNarration.js";
import { gameActions, gameStore } from "../../../store/gameStore.js";

const DuelScreen = lazy(() => import("../DuelScreen.jsx"));

export default function DungeonScreen({
  building, char, inv, skills, effectiveSpecialNow, zoneTheme,
  onClose, inline, addLog, jotNote, captureUndo, runCommand, act,
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

  // 结算结果落盘的公共件：actLocal 事务里现取 state 现算，写 char/inv/exp/pot/time/flags + 日志 + 笔记
  const execSettle = (settle) => {
    const exec = runCommand || ((_id, fn) => fn());
    exec("actLocal", () => {
      captureUndo?.();
      const result = settle();
      applyResult({ gameActions, addLog, jotNote }, result, { feature: "dungeon.settle" });
    });
  };

  // 侧栏点当前建筑等不走 onClose 的卸载：兜底结算，免得丢收获或白嫖探索时间
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
      execSettle(() => settleMapRun(gameStore.getState(), m.status === "exploring" ? retreatRun(m).runState : m));
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

  // 内层地图：探索中关屏兜底按撤退结算（丢图不丢货）；终局走 settleMapRun 落盘
  const handleMapSettleAndClose = () => {
    if (settledRef.current) {
      onClose?.();
      return;
    }
    settledRef.current = true;
    execSettle(() => settleMapRun(gameStore.getState(), mapRun));
    onClose?.();
  };

  const startInnerMap = () => {
    setMapRun(startMapRun(mapDistrictKey, `${building?.dungeonId}|${Date.now()}`, { char }));
  };
  const handleMapMove = (dir) => setMapRun((prev) => moveRoom(prev, dir).runState);
  // 房间事件/自由文本走 actionRouter 裁决；谜题认不出的输入（needsAI）回退到
  // 主输入框同一条 AI 意图通路（act）——叙事照旧走 AI，判定照旧走系统。
  const applyMapRoute = (res, text) => {
    if (!res) return;
    if (res.needsAI) { act?.(text); return; }
    let next = res.runState;
    if (!next) return;
    if (res.combatNpc) {
      next = { ...next, log: [...next.log, "对方亮了兵器——遭遇战接线中。"] };
    }
    setMapRun(next);
  };
  const handleMapAction = (label) => applyMapRoute(routeRoomAction(mapRun, label, { attrs: effectiveSpecialNow }), label);
  const handleMapText = (t) => applyMapRoute(routeRoomText(mapRun, t, { attrs: effectiveSpecialNow }), t);
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
    <Overlay onClose={handleHeaderClose} inline={inline}>
      <Header name={building?.name || run.dungeonName} onClose={handleHeaderClose} />
      <div style={{ padding: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          fontSize: "var(--fs-sm)", color: zoneTheme.textDim, marginBottom: 10,
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
                    marginTop: 10, padding: "4px 14px", fontSize: "var(--fs-sm)",
                    border: `1px solid ${zoneTheme.border}`, color: zoneTheme.text,
                    background: "transparent", cursor: "pointer",
                  }}
                >
                  撤回外城（保收获）
                </button>
              )}
              {mapRun.map.rooms[mapRun.current]?.isBoss && (
                <div style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: zoneTheme.textDim }}>
                  此地有镇宫首领盘踞——决战接线中，先记下方位。
                </div>
              )}
              {mapRun.log.length > 0 && (
                <div style={{
                  marginTop: 12, paddingTop: 8, borderTop: `1px solid ${zoneTheme.border}`,
                  fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.6,
                }}>
                  {mapRun.log.slice(-5).map((line, i) => (
                    <div key={i}>· {line}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: "var(--fs-sm)", lineHeight: 1.8 }}>
              <div style={{ color: zoneTheme.accent, marginBottom: 6 }}>
                {mapRun.status === "victory" ? "打通内层地宫！" : mapRun.status === "retreated" ? "已撤回锚点之外。" : "负伤被逐出地宫……"}
              </div>
              <div>带出：{mapRun.loot.money} 两 · 物事 {mapRun.loot.items.length} 件</div>
              <button
                type="button"
                onClick={handleMapSettleAndClose}
                style={{
                  marginTop: 10, padding: "4px 14px", fontSize: "var(--fs-sm)",
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
                  marginBottom: 10, padding: "4px 14px", fontSize: "var(--fs-sm)",
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
            fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.6,
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

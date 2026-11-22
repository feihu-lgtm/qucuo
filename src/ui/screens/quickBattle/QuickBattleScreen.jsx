// 斗蛐蛐 · 快速战役（开始界面第五入口）
// 脱离主线剧情/存档的纯数值沙盒：从全 NPC 池子里挑人，分我方/敌方两队，
// 宝可梦式团战（可换人）或 1v1 单挑。战斗内核复用 combat/resolveTurn，
// 界面复用 public/stones 那套木质民俗 UI 素材，跟赌石坊同一套视觉语言。
//
// 四个阶段：mode（选模式）→ pick（选人布阵）→ battle（对战）→ result（战报）。
// 战斗不依赖网络；装了 key 只是每回合多一段说书战报（battleNarration），
// 没 key 就用系统自带 notes，功能完全不缺。
// 展示区块拆在同目录：ModePick / PickScreen / BattleScreen / ResultScreen。

import React, { useState, useMemo } from "react";
import { getAllBattleCandidates, buildBattleFighter } from "../../../domain/data/quickBattle/battlePool.js";
import { initCombatState } from "../../../domain/rules/quickBattle/battleEngine.js";
import ModePick from "./ModePick.jsx";
import PickScreen from "./PickScreen.jsx";
import BattleScreen from "./BattleScreen.jsx";
import ResultScreen from "./ResultScreen.jsx";
import { S, QB_CSS, sx } from "./qbShared.js";

export default function QuickBattleScreen({ onExit }) {
  const [phase, setPhase] = useState("mode"); // mode | pick | battle | result
  const [mode, setMode] = useState(null);     // "1v1" | "team"
  const candidates = useMemo(() => getAllBattleCandidates(), []);

  // 选人：存 candidate.id 列表；playerSideIsLeft 恒为 true（左=我方）
  const [allyIds, setAllyIds] = useState([]);
  const [foeIds, setFoeIds] = useState([]);

  // 战斗态（进入 battle 时初始化）
  const [battle, setBattle] = useState(null);

  const startBattle = () => {
    const allyTeam = allyIds.map(id => initCombatState(buildBattleFighter(candidates.find(c => c.id === id))));
    const foeTeam = foeIds.map(id => initCombatState(buildBattleFighter(candidates.find(c => c.id === id))));
    setBattle({
      allyTeam, foeTeam,
      allyIdx: 0, foeIdx: 0,       // 当前上场者索引
      round: 0,
      logs: [],                    // 战报流 {text, kind}
      pendingMove: null,           // 玩家已选、待结算的招
      over: false, winner: null,
      awaitingSwitch: false,       // 我方倒下等玩家选换谁上
      phase: "choose",             // choose(玩家选招/换人) | resolving | ended
    });
    setPhase("battle");
  };

  return (
    <div style={sx.root}>
      <style>{QB_CSS}</style>
      <img src={S("bg_hall_night.webp")} alt="" style={sx.bg} />
      <div style={sx.scrim} />
      {phase === "mode" && <ModePick onPick={(m) => { setMode(m); setPhase("pick"); }} onExit={onExit} />}
      {phase === "pick" && (
        <PickScreen
          mode={mode} candidates={candidates}
          allyIds={allyIds} foeIds={foeIds}
          setAllyIds={setAllyIds} setFoeIds={setFoeIds}
          onBack={() => { setPhase("mode"); setAllyIds([]); setFoeIds([]); }}
          onStart={startBattle}
        />
      )}
      {phase === "battle" && battle && (
        <BattleScreen
          battle={battle} setBattle={setBattle} mode={mode}
          onFinish={() => setPhase("result")}
          onQuit={() => { setPhase("mode"); setAllyIds([]); setFoeIds([]); setBattle(null); }}
        />
      )}
      {phase === "result" && battle && (
        <ResultScreen
          battle={battle}
          onAgain={() => { setPhase("pick"); setBattle(null); }}
          onExit={onExit}
        />
      )}
    </div>
  );
}

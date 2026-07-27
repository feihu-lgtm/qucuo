// 2v2 团战切磋界面（玩家+雪豹 vs 1~2个对手）
// ============================================================================
// 状态管理基于 teamBattleEngine.js 的单位数组结构（不照抄 DuelScreen.jsx 那种
// player/npc 平铺 useState——2v2 会让状态变量翻倍以上，不可维护）。
// 本组件只负责三件事：
//   ① 收集本回合每个存活单位的行动意图 {move, targetId}（玩家/雪豹手动选或
//      托管AI选；敌方AI选目标随机分散——都已与作者确认的规则）；
//   ② 集齐后调一次 runTeamTurn()，把更新后的单位数组写回 state，渲染 turnLog；
//   ③ checkBattleOver() 判定胜负，结束后把整场经过打包给外层 onFinish
//      （MudRPG.jsx 的同一个 handler，逐回合文字喂给主叙事AI写整场战报）。
// 招式相克/伤害/状态判定全部在 resolveTurn.js（经 teamBattleEngine 调度），
// 这里不做任何数值裁决——跟 DuelScreen.jsx 的分工一致。
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { MOVE_TYPE } from "./combat/moveTypes.js";
import { runTeamTurn, decideUnitMove, decideUnitTarget, checkBattleOver } from "./combat/teamBattleEngine.js";
import { buildPlayerUnit, buildLeopardUnit, buildEnemyUnit } from "./combat/teamUnits.js";
import { rollBattleLoot } from "./npcGeneration.js";
import { resolveCombatBuff } from "./utils/buffSystem.js";
import { HpBar, EnergyDots, MoveButton, MoveInspect, TYPE_ICON } from "./DuelScreen.jsx";

export default function TeamDuelScreen({ enemies, leopardData, playerChar, pendingCombatBuff, playerInv, playerMoveset, zoneTheme, onFinish }) {
  // 战前餐 buff：跟 DuelScreen 同一套进场应用（waigong/气血上限进玩家单位装配，
  // moveMul 在出招时叠进攻击招倍率——见下方 pickMoveForUnit）。
  const combatBuff = resolveCombatBuff(pendingCombatBuff);

  const [allyUnits, setAllyUnits] = useState(() => [
    buildPlayerUnit({ playerChar, playerInv, playerMoveset, combatBuff }),
    buildLeopardUnit(leopardData),
  ]);
  const [enemyUnits, setEnemyUnits] = useState(() => (enemies || []).map((n, i) => buildEnemyUnit(n, i)));

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState("select"); // select | result | over
  const [outcome, setOutcome] = useState(null); // win | lose | draw
  // 选招向导：player → leopard → ready。玩家已倒下时开场直接跳过 player 段；
  // 雪豹托管/已倒下时 leopard 段自动跳过（见下方 needLeopardPick）。
  const [stage, setStage] = useState(() => "player");
  const [playerIntent, setPlayerIntent] = useState(null); // {move, targetId}
  const [leopardIntent, setLeopardIntent] = useState(null);
  const [leopardAuto, setLeopardAuto] = useState(true); // 雪豹托管：纯野兽本能（默认）
  const [error, setError] = useState(null);
  const [inspectMove, setInspectMove] = useState(null);
  // 敌招迷雾：对方的招式一开始全是"？"，用过才揭示（按敌方单位id分别记录）
  const [revealed, setRevealed] = useState(() => new Map());
  // rounds：逐回合战报（渲染用 + 结束时打包给外层）
  const [rounds, setRounds] = useState([]);

  const playerUnit = allyUnits[0];
  const leopardUnit = allyUnits[1];
  const aliveEnemies = enemyUnits.filter(u => u.alive);
  const needPlayerPick = playerUnit?.alive;
  const needLeopardPick = leopardUnit?.alive && !leopardAuto;

  // 当前阶段的初始段（本回合从哪一段开始）：玩家活着先玩家，否则雪豹，都不行就 ready
  const firstStage = () => (needPlayerPick ? "player" : needLeopardPick ? "leopard" : "ready");

  // MUD结算日志自动滚到底
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [rounds.length]);

  // 选招：给"当前在选的那个单位"登记意图。只剩一个存活敌人时自动锁定目标
  // （已与作者确认：不用玩家再点一次）；多于一个时必须显式选目标——
  // 防御招也要指定"防的是谁"（裸奔规则，见 teamBattleEngine.js 文件头）。
  const pickMoveForUnit = (which, move) => {
    if (phase !== "select") return;
    const autoTarget = aliveEnemies.length === 1 ? aliveEnemies[0].id : null;
    if (which === "player") setPlayerIntent({ move, targetId: autoTarget });
    else setLeopardIntent({ move, targetId: autoTarget });
  };
  const pickTargetForUnit = (which, targetId) => {
    if (phase !== "select") return;
    if (which === "player") setPlayerIntent(prev => prev ? { ...prev, targetId } : prev);
    else setLeopardIntent(prev => prev ? { ...prev, targetId } : prev);
  };

  // 各段是否已备齐：玩家段=玩家无行动能力 或 playerIntent有招且(单敌自动锁 或 已选目标)
  const playerReady = !needPlayerPick || (playerIntent?.move && (playerIntent.targetId != null || aliveEnemies.length === 1));
  const leopardReady = !needLeopardPick || (leopardIntent?.move && (leopardIntent.targetId != null || aliveEnemies.length === 1));

  // 出击：集齐全部存活单位意图，调一次 runTeamTurn 结算本回合
  const handleResolve = () => {
    if (phase !== "select") return;
    setError(null);
    try {
      const intents = {};
      if (playerUnit.alive && playerIntent?.move) {
        let move = playerIntent.move;
        // 战前餐 moveMul：攻击招倍率加一截"武功发挥更强"（跟 DuelScreen 同一处理点）
        if (combatBuff.moveMul && move.type === MOVE_TYPE.ATTACK) {
          move = { ...move, baseDamageMultiplier: (move.baseDamageMultiplier ?? 1) + combatBuff.moveMul };
        }
        intents[playerUnit.id] = { move, targetId: playerIntent.targetId ?? aliveEnemies[0]?.id ?? null };
      }
      if (leopardUnit.alive) {
        if (leopardAuto) {
          // 托管：纯野兽本能选招（SNOW_LEOPARD_PROFILE）+ 随机选目标，不配合玩家战术
          const bs = { npcHistory: leopardUnit.history, npcEnergy: leopardUnit.energy[0], forbidDefense: leopardUnit.defenseBroken };
          const move = decideUnitMove(leopardUnit, bs);
          if (!move) throw new Error("雪豹没有可用的招式（数据残缺），已中止本回合");
          intents[leopardUnit.id] = { move, targetId: decideUnitTarget(aliveEnemies) };
        } else if (leopardIntent?.move) {
          intents[leopardUnit.id] = { move: leopardIntent.move, targetId: leopardIntent.targetId ?? aliveEnemies[0]?.id ?? null };
        }
      }
      for (const e of aliveEnemies) {
        const bs = { npcHistory: e.history, npcEnergy: e.energy[0], forbidDefense: e.defenseBroken };
        const move = decideUnitMove(e, bs);
        if (!move) throw new Error(`${e.name}没有可用的招式（数据残缺），已中止本回合`);
        intents[e.id] = { move, targetId: decideUnitTarget(allyUnits.filter(u => u.alive)) };
      }

      const { updatedAlly, updatedEnemy, turnLog } = runTeamTurn(allyUnits, enemyUnits, intents);

      // 已用招式类型历史（avoidRepeat 决策依据）：引擎 {...unit} 展开保留 history 字段，
      // 这里把本回合各单位真正用掉的类型 append 上去
      const withHist = (units) => units.map(u => intents[u.id]?.move
        ? { ...u, history: [...(u.history || []), intents[u.id].move.type] }
        : u);
      const nextAlly = withHist(updatedAlly);
      const nextEnemy = withHist(updatedEnemy);
      setAllyUnits(nextAlly);
      setEnemyUnits(nextEnemy);

      // 敌招揭示：敌方单位这轮用了什么招，对应招式位揭开（之后可详细察看）
      setRevealed(prev => {
        const next = new Map(prev);
        for (const e of turnLog) {
          if (e.skipped) continue;
          const owner = nextEnemy.find(u => u.id === e.actorId && u.side === "enemy");
          if (!owner) continue;
          const mv = owner.movesetLocal.find(m => m.name === e.actorMove);
          if (!mv) continue;
          next.set(owner.id, new Set([...(next.get(owner.id) || []), mv.id]));
        }
        return next;
      });

      // 本回合战报文字：渲染用 + 结束时打包给外层（teamText 单行格式，
      // MudRPG onFinish 的逐回合系统日志和AI整场战报都直接复用这行文字）
      const lines = turnLog.map(e => {
        if (e.skipped) return { text: `${e.actorName}这一击落了空（${e.reason}）。`, notes: [], statusLog: [] };
        const clash = e.targetMove ? `，${e.targetName}以「${e.targetMove}」相抗` : `，${e.targetName}无暇他顾`;
        // 【点名是谁占上风】原来只写"占了上风/被压了一头"，不说主语——
        // 2v2 里一行文字有两三个人名，读者根本分不清是谁赢了那一下（实测反馈）。
        // matchup "A" 是出手方(actor)赢、"B" 是应战方(target)赢。
        const updown = e.matchup === "A" ? `${e.actorName}占了上风`
          : e.matchup === "B" ? `${e.targetName}占了上风`
          : "两招同门相撞";
        const redirect = e.targetRedirected ? "（原目标已倒，转火）" : "";
        const dmg = [e.dmgToTarget > 0 ? `${e.targetName}受创${e.dmgToTarget}` : null, e.dmgToActor > 0 ? `${e.actorName}受创${e.dmgToActor}` : null].filter(Boolean).join("，");
        return {
          actorId: e.actorId,
          // 破折号去掉，改用句号断开：原来"…相抗——占了上风。"读起来像半句话被硬接上，
          // 而且项目的成文铁律本来就写着"禁冒号破折号"。
          text: `${e.actorName}以「${e.actorMove}」击向${e.targetName}${redirect}${clash}。${updown}${dmg ? "。" + dmg : ""}。`,
          notes: e.notes || [], statusLog: e.statusLog || [],
        };
      });
      setRounds(prev => [...prev, { round, lines }]);

      const over = checkBattleOver(nextAlly, nextEnemy);
      if (over) setOutcome(over);
      setPhase("result");
    } catch (e) {
      // 跟 DuelScreen 同一个兜底哲学：结算出错不死在空白阶段，显式抛给玩家并可重选
      console.error("2v2回合结算出错", e);
      setError(e?.message || "回合结算时发生未知错误");
    }
  };

  const handleContinue = () => {
    if (outcome) { setPhase("over"); return; }
    setRound(r => r + 1);
    setPlayerIntent(null);
    setLeopardIntent(null);
    setStage(firstStage());
    setPhase("select");
  };

  const handleClose = () => {
    // 掉落只从主敌（enemies[0]）身上roll——跟1v1同一个 rollBattleLoot；
    // draw 按"罢手"处理（外层 outcome 三分支：win/lose/其他=不了了之）。
    const loot = outcome === "win" ? rollBattleLoot(enemies[0]) : null;
    const battleLog = rounds.flatMap(r => r.lines.map(l => ({ round: r.round, teamText: l.text, narration: null })));
    // 永久成长型招式的威力累积在玩家单位的 movesetLocal 里，回传外层持久化
    // （跟 DuelScreen 第四参同一约定）；2v2 v1 暂无战斗内道具栏，usedItems 恒空。
    onFinish?.(outcome === "draw" ? null : outcome, loot, battleLog, playerUnit.movesetLocal, [], playerUnit.hp);
  };

  const selecting = phase === "select";
  const pickingUnit = stage === "player" ? playerUnit : stage === "leopard" ? leopardUnit : null;
  const pickingMoveset = pickingUnit?.movesetLocal || [];
  const pickingIntent = stage === "player" ? playerIntent : leopardIntent;
  const pickingMoveChosen = !!pickingIntent?.move;
  const pickingNeedTarget = pickingMoveChosen && aliveEnemies.length > 1;

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.container, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}` }}>

        {/* ── 双方单位状态：我方2（玩家+雪豹） vs 敌方1~2 ── */}
        <div style={styles.teamsRow}>
          <div style={styles.teamCol}>
            {allyUnits.map(u => (
              <UnitCard key={u.id} unit={u} color={u.id === "player" ? zoneTheme.accent : "#b48adf"} zoneTheme={zoneTheme} />
            ))}
          </div>
          <div style={styles.vsCol(zoneTheme)}>第{round}回合</div>
          <div style={styles.teamCol}>
            {enemyUnits.map(u => (
              <UnitCard key={u.id} unit={u} color="#c45044" zoneTheme={zoneTheme} right />
            ))}
          </div>
        </div>

        {/* ── 上半：操作区（选招向导 → 出击）── */}
        <div style={styles.opSection}>
          <div style={styles.sectionLabel(zoneTheme)}>
            {!selecting
              ? (outcome ? (outcome === "win" ? "◆ 切磋已分胜负" : outcome === "lose" ? "◆ 你落败了" : "◆ 两败俱伤") : "◆ 结算中")
              : stage === "player" ? "◆ 你的出招"
              : stage === "leopard" ? "◆ 雪豹的出招"
              : "◆ 本回合就绪"}
            {selecting && leopardUnit?.alive && (
              <span
                onClick={() => { setLeopardAuto(v => !v); setLeopardIntent(null); if (stage === "leopard") setStage(firstStage()); }}
                title="托管=雪豹凭野兽本能自行出招选目标；手动=你替它选招选目标"
                style={{ float: "right", cursor: "pointer", fontSize: "10px", color: leopardAuto ? zoneTheme.textDim : "#b48adf", border: `1px solid ${leopardAuto ? zoneTheme.border : "#b48adf"}`, borderRadius: 3, padding: "1px 7px" }}
              >雪豹：{leopardAuto ? "托管中" : "手动"}</span>
            )}
          </div>

          {selecting && stage !== "ready" && (
            <>
              {error && <div style={styles.warnLine}>⚠ 上一回合结算出错：{error}（可重新出招）</div>}
              {pickingUnit?.defenseBroken && <div style={styles.hintLine(zoneTheme)}>{stage === "player" ? "你" : "雪豹"}守势已露，此回合不可再守，须变招</div>}
              {round === 1 && (combatBuff.waigong || combatBuff.moveMul || combatBuff.hpBonusRatio) ? (
                <div style={styles.hintLine(zoneTheme)}>
                  战前一餐，药力正盛：{[
                    combatBuff.hpBonusRatio ? `气血+${Math.round(combatBuff.hpBonusRatio * 100)}%` : null,
                    combatBuff.waigong ? `外功+${combatBuff.waigong}` : null,
                    combatBuff.moveMul ? `招式威力+${combatBuff.moveMul}` : null,
                  ].filter(Boolean).join("，")}
                </div>
              ) : null}

              {/* 选招：当前单位的招式格 */}
              <div style={styles.moveGrid}>
                {pickingMoveset.map((move, i) => {
                  const blockedByRepeat = move.type === MOVE_TYPE.DEFENSE && pickingUnit?.defenseBroken;
                  const chosen = pickingIntent?.move?.id === move.id;
                  return (
                    <div key={move.id || i} style={chosen ? { outline: `2px solid ${zoneTheme.accent}`, borderRadius: 4 } : undefined}>
                      <MoveButton move={move}
                        disabled={move.energyCost > (pickingUnit?.energy?.[0] ?? 0) || blockedByRepeat}
                        zoneTheme={zoneTheme}
                        onClick={() => pickMoveForUnit(stage, move)}
                        onInspect={() => setInspectMove({ ...move, side: stage === "player" ? "你" : "雪豹" })} />
                    </div>
                  );
                })}
              </div>

              {/* 选目标：多于一个存活敌人时必选（防御招也要指定防谁）；单敌自动锁定 */}
              {pickingNeedTarget && (
                <div style={styles.targetRow}>
                  <span style={{ fontSize: "10.5px", color: zoneTheme.textDim, flexShrink: 0 }}>
                    {pickingIntent.move.type === MOVE_TYPE.DEFENSE ? "防谁：" : "打谁："}
                  </span>
                  {aliveEnemies.map(e => (
                    <span key={e.id}
                      onClick={() => pickTargetForUnit(stage, e.id)}
                      style={{
                        cursor: "pointer", fontSize: "11px", padding: "3px 10px", borderRadius: 3, userSelect: "none",
                        color: pickingIntent?.targetId === e.id ? zoneTheme.bg : "#c45044",
                        background: pickingIntent?.targetId === e.id ? "#c45044" : "transparent",
                        border: "1px solid #c45044",
                      }}>{e.name}（{e.hp[0]}/{e.hp[1]}）</span>
                  ))}
                </div>
              )}

              {/* 段推进：玩家段备齐→雪豹段（或就绪）；雪豹段备齐→就绪 */}
              <div style={styles.continueRow}>
                {stage === "player" && playerReady && (needLeopardPick
                  ? <span onClick={() => setStage("leopard")} style={styles.continueBtn(zoneTheme)}>雪豹出招 ▸</span>
                  : <span onClick={() => setStage("ready")} style={styles.continueBtn(zoneTheme)}>就绪 ▸</span>)}
                {stage === "player" && !playerReady && needPlayerPick && (
                  <span style={{ fontSize: "10.5px", color: zoneTheme.textDim }}>选好招式{pickingNeedTarget ? "与目标" : ""}后继续</span>
                )}
                {stage === "leopard" && (
                  <>
                    {leopardReady
                      ? <span onClick={() => setStage("ready")} style={styles.continueBtn(zoneTheme)}>就绪 ▸</span>
                      : <span style={{ fontSize: "10.5px", color: zoneTheme.textDim }}>替雪豹选好招式{pickingNeedTarget ? "与目标" : ""}后继续</span>}
                    <span onClick={() => setStage("player")} style={{ marginLeft: 12, fontSize: "10.5px", color: zoneTheme.textDim, cursor: "pointer" }}>◂ 回改你的招</span>
                  </>
                )}
              </div>
            </>
          )}

          {selecting && stage === "ready" && (
            <div style={{ textAlign: "center" }}>
              <div style={styles.hintLine(zoneTheme)}>
                {playerUnit.alive && playerIntent?.move ? `你使「${playerIntent.move.name}」${aliveEnemies.length > 1 ? `击向${enemyUnits.find(e => e.id === playerIntent.targetId)?.name || "?"}` : ""}` : "你已无法行动"}
                {leopardUnit.alive ? `　·　雪豹${leopardAuto ? "凭本能行事" : leopardIntent?.move ? `使「${leopardIntent.move.name}」${aliveEnemies.length > 1 ? `击向${enemyUnits.find(e => e.id === leopardIntent.targetId)?.name || "?"}` : ""}` : "待定"}` : ""}
              </div>
              {error && <div style={styles.warnLine}>⚠ 上一回合结算出错：{error}（可重新出击）</div>}
              <div style={styles.continueRow}>
                <span onClick={handleResolve} style={styles.continueBtn(zoneTheme)}>出击 ▸</span>
                {(needPlayerPick || needLeopardPick) && (
                  <span onClick={() => setStage(firstStage())} style={{ marginLeft: 12, fontSize: "10.5px", color: zoneTheme.textDim, cursor: "pointer" }}>◂ 回改</span>
                )}
              </div>
            </div>
          )}

          {phase === "result" && !outcome && (
            <div style={styles.continueRow}><span onClick={handleContinue} style={styles.continueBtn(zoneTheme)}>下一回合 ▸</span></div>
          )}
          {phase === "result" && outcome && (
            <div style={styles.continueRow}><span onClick={handleContinue} style={styles.continueBtn(zoneTheme)}>结束切磋</span></div>
          )}
          {phase === "over" && (
            <div style={styles.continueRow}><span onClick={handleClose} style={styles.continueBtn(zoneTheme)}>关闭</span></div>
          )}

          {/* 敌招迷雾：每个敌方单位各自一排，用过才揭示 */}
          {selecting && enemyUnits.map(e => (
            <div key={e.id}>
              <div style={styles.enemyStripLabel(zoneTheme)}>{e.name}的招式（用过才可察看）</div>
              <div style={styles.enemyStrip}>
                {e.movesetLocal.map((m, i) => {
                  const isRev = (revealed.get(e.id) || new Set()).has(m.id);
                  return (
                    <div key={m.id || i}
                      onClick={isRev ? () => setInspectMove({ ...m, side: e.name }) : undefined}
                      style={styles.enemyChip(zoneTheme, isRev)}
                      title={isRev ? "点击详细察看" : "尚未见识过这一招"}>
                      {isRev ? `${TYPE_ICON[m.type]} ${m.name}` : "？ 未知"}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── 下半：MUD形式的结算展示 ── */}
        <div style={styles.logSection} ref={logRef}>
          {rounds.length === 0 && <div style={styles.logHint(zoneTheme)}>——{allyUnits.map(u => u.name).join("与")}拉开架势，静待第一招——</div>}
          {rounds.map(r => (
            <div key={r.round} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accent }}>▸ 第 {r.round} 回合</div>
              {r.lines.map((l, i) => (
                <div key={i} style={{ marginTop: 2 }}>
                  <div style={{ fontSize: "12.5px", color: zoneTheme.text }}>{l.text}</div>
                  {(l.notes || []).map((n, j) => (
                    <div key={j} style={{ fontSize: "12px", color: zoneTheme.textDim }}>{n}。</div>
                  ))}
                  {(l.statusLog || []).map((s, j) => (
                    <div key={"s" + j} style={{ fontSize: "11px", color: zoneTheme.textDim }}>{s}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {inspectMove && (
        <MoveInspect move={inspectMove} zoneTheme={zoneTheme} onClose={() => setInspectMove(null)} />
      )}
    </div>
  );
}

// 单个战斗单位的状态卡：名字 + 血条 + 能量点（倒下后整体置灰）
function UnitCard({ unit, color, zoneTheme, right }) {
  const pct = unit.hp[1] > 0 ? (unit.hp[0] / unit.hp[1]) * 100 : 0;
  return (
    <div style={{ opacity: unit.alive ? 1 : 0.38, marginBottom: 6, textAlign: right ? "right" : "left" }}>
      <div style={{ fontSize: "11.5px", color: zoneTheme.text, marginBottom: 3 }}>
        {unit.name}{!unit.alive && <span style={{ fontSize: "9.5px", color: zoneTheme.textDim }}>（倒下）</span>}
      </div>
      <HpBar pct={pct} color={color} />
      <div style={{ fontSize: "9.5px", color: zoneTheme.textDim, marginTop: 2 }}>{unit.hp[0]}/{unit.hp[1]}</div>
      <EnergyDots value={unit.energy[0]} color={color} right={right} />
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(4,4,10,0.85)",
    zIndex: 450, display: "flex", alignItems: "center", justifyContent: "center",
  },
  container: {
    width: 560, maxWidth: "94vw", maxHeight: "92vh", borderRadius: 6, padding: 16,
    display: "flex", flexDirection: "column", gap: 12, overflowY: "auto",
  },
  teamsRow: { display: "flex", alignItems: "flex-start", gap: 12 },
  teamCol: { flex: 1, minWidth: 0 },
  vsCol: (t) => ({
    fontSize: "10px", color: t.accent, border: `1px solid ${t.accent}`,
    borderRadius: 12, padding: "3px 8px", flexShrink: 0, whiteSpace: "nowrap", marginTop: 18,
  }),
  opSection: { display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 },
  sectionLabel: (t) => ({ fontSize: "12px", color: t.accent, letterSpacing: "1px" }),
  moveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "26vh", overflowY: "auto" },
  targetRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  warnLine: { textAlign: "center", color: "#c45044", fontSize: "11px", padding: "4px 0" },
  hintLine: (t) => ({ fontSize: "11px", color: t.textDim, textAlign: "center", marginBottom: 6 }),
  enemyStripLabel: (t) => ({ fontSize: "10.5px", color: t.textDim, marginTop: 4 }),
  enemyStrip: { display: "flex", flexWrap: "wrap", gap: 6 },
  enemyChip: (t, revealed) => ({
    fontSize: "11px", padding: "4px 8px", borderRadius: 4,
    border: `1px dashed ${revealed ? t.accentDim : "rgba(255,255,255,0.15)"}`,
    color: revealed ? t.text : t.textDim,
    cursor: revealed ? "pointer" : "default",
    background: revealed ? "rgba(255,255,255,0.04)" : "transparent",
  }),
  logSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10,
    maxHeight: "30vh", overflowY: "auto", fontFamily: "inherit",
  },
  logHint: (t) => ({ fontSize: "12px", color: t.textDim, textAlign: "center", padding: "16px 0" }),
  continueRow: { textAlign: "center", marginTop: 6 },
  continueBtn: (t) => ({
    cursor: "pointer", display: "inline-block", padding: "8px 24px",
    color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 4, fontSize: "12px",
  }),
};

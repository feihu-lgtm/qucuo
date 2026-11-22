// 阶段三：对战（对峙区 + 战报流 + 操作区），含 FighterPanel/Bar/StatusChip/MoveButton。

import React, { useState, useMemo, useEffect, useRef } from "react";
import { QUALITY_COLOR } from "../../../domain/rules/economy/equipment.js";
import {
  pickAiMove, resolveBattleTurn,
  nextAliveIndex, isTeamWiped,
} from "../../../domain/rules/quickBattle/battleEngine.js";
import { narrateTurn } from "../../../engine/ports/battleNarration.js";
import { hasApiKey } from "../../../engine/ports/storyteller.js";
import { explainMove, moveTypeGist } from "../../../domain/rules/economy/itemEffectText.js";
import TextBtn from "./TextBtn.jsx";
import { PORTRAIT, UI, tierColor, tierName, sx } from "./qbShared.js";

export default function BattleScreen({ battle, setBattle, mode, onFinish, onQuit }) {
  const ally = battle.allyTeam[battle.allyIdx];
  const foe = battle.foeTeam[battle.foeIdx];
  const logRef = useRef(null);
  const apiOn = useMemo(() => hasApiKey(), []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battle.logs.length]);

  // 玩家选一个招 → 结算一回合
  const playMove = async (myMove) => {
    if (battle.phase !== "choose") return;
    setBattle(b => ({ ...b, phase: "resolving" }));

    const foeMove = pickAiMove(foe);
    const out = resolveBattleTurn(ally, foe, myMove, foeMove);

    // 先落系统结果，战报文字异步补
    setBattle(b => {
      const allyTeam = b.allyTeam.slice(); allyTeam[b.allyIdx] = out.my;
      const foeTeam = b.foeTeam.slice(); foeTeam[b.foeIdx] = out.foe;
      const roundLog = {
        round: b.round + 1,
        myName: ally.name, foeName: foe.name,
        myMove: myMove.name, foeMove: foeMove.name,
        text: out.log.join("。") + "。",
        narration: null,
        dmgToFoe: out.result.damageToB, dmgToMe: out.result.damageToA,
      };
      return {
        ...b, allyTeam, foeTeam, logs: [...b.logs, roundLog], round: b.round + 1,
        lastHit: { key: b.round + 1, toFoe: out.result.damageToB, toMe: out.result.damageToA },
      };
    });

    // 判定倒下/胜负/换人
    finishTurn(out);

    // 异步补说书战报（可选，失败无所谓）
    if (apiOn) {
      const roundNo = battle.round + 1;
      narrateTurn(ally, foe, myMove, foeMove, out.result).then(txt => {
        if (!txt) return;
        setBattle(b => ({
          ...b,
          logs: b.logs.map(l => l.round === roundNo ? { ...l, narration: txt } : l),
        }));
      });
    }
  };

  // 结算后处理胜负与补位
  const finishTurn = (out) => {
    setBattle(b => {
      let { allyIdx, foeIdx } = b;
      let over = false, winner = null, awaitingSwitch = false;

      // 敌方当前倒下 → 补位或敌方全灭
      if (out.foeDown) {
        const next = nextAliveIndex(b.foeTeam, foeIdx);
        if (next === -1 || isTeamWiped(b.foeTeam)) { over = true; winner = "ally"; }
        else foeIdx = next;
      }
      // 我方当前倒下 → 要玩家选换谁（团战）；1v1 直接判负
      if (out.myDown && !over) {
        if (isTeamWiped(b.allyTeam)) { over = true; winner = "foe"; }
        else if (mode === "team") awaitingSwitch = true;
        else { over = true; winner = "foe"; }
      }

      return { ...b, allyIdx, foeIdx, over, winner, awaitingSwitch, phase: over ? "ended" : "choose" };
    });
  };

  // 玩家主动换人（团战特权，消耗当前回合：换上来的人这回合不出手，敌方照打）
  const switchTo = (idx) => {
    if (mode !== "team") return;
    if (idx === battle.allyIdx && !battle.awaitingSwitch) return;

    if (battle.awaitingSwitch) {
      // 倒下后被动换人：直接换上，不消耗额外回合
      setBattle(b => ({ ...b, allyIdx: idx, awaitingSwitch: false, phase: "choose",
        logs: [...b.logs, { round: b.round, myName: b.allyTeam[idx].name, text: `${b.allyTeam[idx].name}接替上场。`, kind: "switch" }] }));
      return;
    }

    // 主动换人：敌方趁机打一记（换人耗一个身位）
    setBattle(b => ({ ...b, phase: "resolving" }));
    const newAlly = battle.allyTeam[idx];
    const foeMove = pickAiMove(foe);
    // 换上来的人这回合只挨打不还手：用一个"回气"式空过招（无伤害输出的状态招兜底）
    const idleMove = newAlly.moveset.find(m => m.id === "move_hui_qi") || newAlly.moveset[newAlly.moveset.length - 1];
    const out = resolveBattleTurn(newAlly, foe, idleMove, foeMove);
    setBattle(b => {
      const allyTeam = b.allyTeam.slice(); allyTeam[idx] = out.my;
      const foeTeam = b.foeTeam.slice(); foeTeam[b.foeIdx] = out.foe;
      const roundLog = {
        round: b.round + 1, myName: newAlly.name, foeName: foe.name,
        text: `${newAlly.name}临阵换上，${foe.name}趁隙抢攻。` + out.log.join("。") + "。",
        kind: "switch", dmgToMe: out.result.damageToA,
      };
      return { ...b, allyTeam, foeTeam, allyIdx: idx, logs: [...b.logs, roundLog], round: b.round + 1 };
    });
    finishTurn(out);
  };

  const canSwitch = mode === "team" && battle.allyTeam.some((f, i) => i !== battle.allyIdx && f.combatState.hp[0] > 0);

  return (
    <div className="qb-battle-screen" style={sx.battleWrap}>
      {/* 顶栏 */}
      <div style={sx.battleTop}>
        <TextBtn onClick={onQuit}>← 认输退出</TextBtn>
        <div style={{ fontSize: 13, color: "var(--parchment)", letterSpacing: 2 }}>第 {battle.round} 回合</div>
        <div style={{ fontSize: 11, color: apiOn ? "var(--qb-api-on)" : "var(--qb-border)" }}>
          {apiOn ? "◆ 说书战报已启用" : "◇ 装 key 可解锁说书战报"}
        </div>
      </div>

      {/* 对峙区（签名元素）：双方立绘 + 血槽 + 飘伤害 */}
      <div className="qb-arena" style={sx.arena}>
        <FighterPanel fighter={ally} side="ally" team={battle.allyTeam} curIdx={battle.allyIdx}
          hit={battle.lastHit ? { key: battle.lastHit.key, dmg: battle.lastHit.toMe } : null} />
        <div className="qb-vs" style={sx.arenaVs}>
          <img src={UI("burst.webp")} alt="" style={{ width: 64, opacity: 0.7 }} />
          <div style={{ fontSize: 22, color: "var(--qb-versus)", fontWeight: "bold", letterSpacing: 2 }}>斗</div>
        </div>
        <FighterPanel fighter={foe} side="foe" team={battle.foeTeam} curIdx={battle.foeIdx}
          hit={battle.lastHit ? { key: battle.lastHit.key, dmg: battle.lastHit.toFoe } : null} />
      </div>

      {/* 战报流 */}
      <div ref={logRef} style={sx.logStream}>
        {battle.logs.length === 0 && <div style={{ color: "var(--qb-border)", fontSize: 13, textAlign: "center", padding: 20 }}>选一招，切磋开始。</div>}
        {battle.logs.map((l, i) => (
          <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontSize: 11, color: "var(--parchment)", marginBottom: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>第{l.round}回合{l.myMove ? ` · ${l.myName}「${l.myMove}」 对 ${l.foeName}「${l.foeMove}」` : ""}</span>
              {/* 伤害数字：醒目独立标记，一眼看清这一击打了多少 */}
              {l.dmgToFoe > 0 && <span style={sx.dmgTag("var(--qb-foe)")}>敌 −{l.dmgToFoe}</span>}
              {l.dmgToMe > 0 && <span style={sx.dmgTag("var(--blue)")}>我 −{l.dmgToMe}</span>}
              {(l.dmgToFoe === 0 || l.dmgToFoe == null) && (l.dmgToMe === 0 || l.dmgToMe == null) && l.myMove && <span style={{ color: "var(--qb-edge)" }}>无伤</span>}
            </div>
            {/* 系统战报（始终显示，权威结算文字） */}
            <div style={{ fontSize: 13.5, color: "var(--qb-text-dim)", lineHeight: 1.8 }}>
              {l.text}
            </div>
            {/* AI 说书（有则另起一行，润色不覆盖系统文字；斜体+左边框区分） */}
            {l.narration && (
              <div style={{ fontSize: 13.5, color: "var(--qb-narrative)", lineHeight: 1.9, marginTop: 6, paddingLeft: 10,
                borderLeft: "2px solid var(--ink-brass)", fontStyle: "italic" }}>
                <span style={{ fontStyle: "normal", fontSize: 10, color: "var(--qb-border)", marginRight: 6 }}>说书</span>
                {l.narration}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 操作区 */}
      {!battle.over && (
        <div style={sx.controlBar}>
          {battle.awaitingSwitch ? (
            <div style={{ width: "100%", textAlign: "center", margin: "auto" }}>
              <div style={{ color: "var(--qb-foe)", fontSize: 14, marginBottom: 10 }}>{ally?.name || "上场者"}已倒下，选谁接替上场</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {battle.allyTeam.map((f, i) => f.combatState.hp[0] > 0 && (
                  <button key={i} onClick={() => switchTo(i)} style={sx.switchBtn}>
                    {f.name}<span style={{ color: "var(--qb-border)", fontSize: 11 }}> {f.combatState.hp[0]}/{f.combatState.hp[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="qb-cardrow" style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                {ally.moveset.map((m, i) => {
                  const afford = m.energyCost <= ally.combatState.energy[0];
                  const forbidDef = ally.combatState.forbidDefense && m.type === "防御";
                  const usable = afford && !forbidDef && battle.phase === "choose";
                  return (
                    <MoveButton key={i} move={m} usable={usable} reason={!afford ? "气力不足" : forbidDef ? "不能连守" : ""} onClick={() => usable && playMove(m)} />
                  );
                })}
              </div>
              {canSwitch && (
                <div style={{ borderLeft: "1px solid rgba(255,255,255,.12)", paddingLeft: 12, marginLeft: 4 }}>
                  <div style={{ fontSize: 10, color: "var(--qb-border)", marginBottom: 6 }}>换人（让位一手）</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 120, overflowY: "auto" }}>
                    {battle.allyTeam.map((f, i) => (i !== battle.allyIdx && f.combatState.hp[0] > 0) && (
                      <button key={i} onClick={() => switchTo(i)} style={sx.switchBtnSmall}>
                        {f.name} <span style={{ color: "var(--qb-border)" }}>{f.combatState.hp[0]}/{f.combatState.hp[1]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {battle.over && (
        <div style={sx.controlBar}>
          <div style={{ width: "100%", textAlign: "center", margin: "auto" }}>
            <div style={{ fontSize: 22, color: battle.winner === "ally" ? "var(--blue)" : "var(--qb-foe)", fontWeight: "bold", letterSpacing: 4, marginBottom: 12 }}>
              {battle.winner === "ally" ? "我方胜" : "我方败"}
            </div>
            <button onClick={onFinish} style={sx.startBtn}>看战报总结 →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 单个上场者面板：立绘/名字 + 血槽 + 气力 + 后备队伍点 + 飘伤害
function FighterPanel({ fighter, side, team, curIdx, hit }) {
  const cs = fighter.combatState;
  const hpRatio = cs.hp[0] / cs.hp[1];
  const enRatio = cs.energy[0] / 10;
  const accent = side === "ally" ? "var(--blue)" : "var(--qb-foe)";
  const align = side === "ally" ? "flex-start" : "flex-end";
  const showDmg = hit && hit.dmg > 0;

  return (
    <div className="qb-fighter" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: align, gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: side === "ally" ? "row" : "row-reverse" }}>
        <div className="qb-portrait" style={{ position: "relative", width: 76, height: 100, borderRadius: 0, overflow: "visible", flexShrink: 0 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 0, overflow: "hidden", border: `2px solid ${tierColor(fighter.levelCap)}`, background: "var(--qb-felt)" }}>
            {fighter.portrait ? (
              <img src={PORTRAIT(fighter.portrait)} alt={fighter.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: tierColor(fighter.levelCap), fontWeight: "bold" }}>
                {fighter.name.slice(0, 2)}
              </div>
            )}
          </div>
          {/* 飘伤害数字：每次 hit.key 变化重新触发动画 */}
          {showDmg && (
            <div key={hit.key} className="qb-dmg" style={{
              position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
              fontSize: 24, fontWeight: "bold", color: "var(--qb-damage)",
              textShadow: "0 2px 6px var(--black), 0 0 12px rgba(255,60,50,.7)", pointerEvents: "none", zIndex: 5,
            }}>−{hit.dmg}</div>
          )}
        </div>
        <div className="qb-fighter-info" style={{ minWidth: 150, textAlign: side === "ally" ? "left" : "right" }}>
          <div style={{ fontSize: 16, color: "var(--qb-text)", fontWeight: "bold" }}>{fighter.name}</div>
          <div style={{ fontSize: 10, color: tierColor(fighter.levelCap) }}>{tierName(fighter.levelCap)}品</div>
          {/* 血槽 */}
          <div style={{ marginTop: 6 }}>
            <Bar ratio={hpRatio} color="var(--qb-hp)" bg="var(--qb-hp-track)" label={`气血 ${cs.hp[0]}/${cs.hp[1]}`} rtl={side === "foe"} />
            <Bar ratio={enRatio} color="var(--ink-warn)" bg="var(--qb-energy-track)" label={`气力 ${cs.energy[0]}/10`} rtl={side === "foe"} thin />
          </div>
          {/* 状态标记 */}
          <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: side === "ally" ? "flex-start" : "flex-end" }}>
            {cs.statusSlots.control && <StatusChip name={cs.statusSlots.control.name} />}
            {cs.statusSlots.drain && <StatusChip name={cs.statusSlots.drain.name} />}
            {cs.statusSlots.mark && <StatusChip name={`${cs.statusSlots.mark.name}×${cs.statusSlots.mark.stacks}`} />}
          </div>
        </div>
      </div>
      {/* 后备队伍圆点 */}
      {team.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexDirection: side === "ally" ? "row" : "row-reverse" }}>
          {team.map((f, i) => {
            const alive = f.combatState.hp[0] > 0;
            return <div key={i} title={`${f.name} ${f.combatState.hp[0]}/${f.combatState.hp[1]}`}
              style={{ width: 12, height: 12, borderRadius: "50%",
                background: i === curIdx ? accent : (alive ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.08)"),
                border: i === curIdx ? `2px solid var(--white)` : "none",
                boxShadow: i === curIdx ? `0 0 8px ${accent}` : "none" }} />;
          })}
        </div>
      )}
    </div>
  );
}

function Bar({ ratio, color, bg, label, rtl, thin }) {
  return (
    <div style={{ position: "relative", height: thin ? 8 : 14, background: bg, borderRadius: 0, overflow: "hidden", marginTop: 3 }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, [rtl ? "right" : "left"]: 0,
        width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color, transition: "width .4s ease" }} />
      {!thin && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--white)", textShadow: "0 1px 2px var(--black)" }}>{label}</div>}
    </div>
  );
}

function StatusChip({ name }) {
  return <span style={{ fontSize: 9, padding: "1px 5px", background: "rgba(180,80,80,.3)", border: "1px solid var(--qb-status-edge)", borderRadius: 0, color: "var(--qb-status-text)" }}>{name}</span>;
}

function MoveButton({ move, usable, reason, onClick }) {
  const qc = QUALITY_COLOR[move.quality] || "var(--ink-text)";
  const lines = explainMove(move);
  const gist = moveTypeGist(move);
  const [flipped, setFlipped] = useState(false);
  const mainLine = lines.length ? lines[0].text : "";

  return (
    <div className="qb-card" style={{ width: 128, height: 96 }}>
      <div className="qb-flip">
        {!flipped && <button
          className="qb-face"
          onClick={() => setFlipped(true)}
          style={{
            cursor: "pointer", textAlign: "left", padding: "8px 10px",
            background: usable ? "rgba(20,16,10,.85)" : "rgba(10,8,5,.7)",
            border: `2px solid ${usable ? qc : "rgba(255,255,255,.1)"}`,
            opacity: usable ? 1 : 0.6,
          }}
        >
          <div style={{ fontSize: 14, color: "var(--qb-text)", fontWeight: "bold" }}>{move.name}</div>
          <div style={{ fontSize: 10, color: qc, marginTop: 2 }}>{move.type} · {move.quality}品 · 耗气{move.energyCost}</div>
          <div style={{ fontSize: 9.5, color: "var(--qb-move-summary)", marginTop: 3, lineHeight: 1.35, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{mainLine}</div>
          {reason
            ? <div style={{ fontSize: 9.5, color: "var(--qb-move-blocked)", marginTop: "auto" }}>{reason}</div>
            : <div style={{ fontSize: 9, color: "var(--qb-edge)", marginTop: "auto" }}>点击看详情 →</div>}
        </button>}
        {flipped && <div
          className="qb-face qb-back"
          style={{ padding: "7px 9px", background: "rgba(24,20,13,.98)", border: `2px solid ${qc}`, overflowY: "auto" }}
        >
          <div style={{ fontSize: 11, color: qc, fontWeight: "bold", marginBottom: 3 }}>
            {move.name} <span style={{ color: "var(--qb-border)", fontWeight: "normal" }}>耗气{move.energyCost}</span>
          </div>
          <div style={{ fontSize: 8.5, color: "var(--qb-border)", marginBottom: 4, lineHeight: 1.4 }}>{gist}</div>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 9.5, color: l.warn ? "var(--qb-move-warn)" : "var(--qb-text-dim)", lineHeight: 1.5, marginBottom: 2 }}>
              · {l.text}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6, position: "sticky", bottom: 0 }}>
            <button onClick={() => usable && onClick()} disabled={!usable}
              style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: "bold", borderRadius: 0,
                border: "none", cursor: usable ? "pointer" : "not-allowed",
                background: usable ? qc : "var(--qb-move-disabled-bg)", color: usable ? "var(--qb-move-button-text)" : "var(--qb-move-disabled-text)" }}>
              {usable ? "⚔ 出招" : (reason || "不可用")}
            </button>
            <button onClick={() => setFlipped(false)}
              style={{ padding: "5px 10px", fontSize: 11, borderRadius: 0, border: `1px solid ${qc}`,
                background: "transparent", color: qc, cursor: "pointer" }}>返回</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

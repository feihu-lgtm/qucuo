// 斗蛐蛐 · 快速战役（开始界面第五入口）
// 脱离主线剧情/存档的纯数值沙盒：从全 NPC 池子里挑人，分我方/敌方两队，
// 宝可梦式团战（可换人）或 1v1 单挑。战斗内核复用 combat/resolveTurn，
// 界面复用 public/stones 那套木质民俗 UI 素材，跟赌石坊同一套视觉语言。
//
// 四个阶段：mode（选模式）→ pick（选人布阵）→ battle（对战）→ result（战报）。
// 战斗不依赖网络；装了 key 只是每回合多一段说书战报（battleNarration），
// 没 key 就用系统自带 notes，功能完全不缺。

import React, { useState, useMemo, useEffect, useRef } from "react";
import { QUALITY, QUALITY_COLOR } from "../equipment.js";
import { getAllBattleCandidates, buildBattleFighter } from "./battlePool.js";
import {
  initCombatState, pickAiMove, resolveBattleTurn,
  nextAliveIndex, isTeamWiped,
} from "./battleEngine.js";
import { narrateTurn, hasApiKey } from "./battleNarration.js";
import { explainMove, moveTypeGist } from "../itemEffectText.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const S = (f) => `${BASE}stones/${f}`;
const UI = (f) => `${BASE}stones/ui/${f}`;
const PORTRAIT = (name) => `${BASE}bidders/full/${name}.webp`;

// 品阶→档位色（复用装备那套 QUALITY_COLOR）；levelCap 0-5 直接映射 QUALITY 索引
const tierColor = (levelCap) => QUALITY_COLOR[QUALITY[Math.max(0, Math.min(5, levelCap))]] || "#c8bfa0";
const tierName = (levelCap) => QUALITY[Math.max(0, Math.min(5, levelCap))] || "白";

const MAX_TEAM = 6; // 每队最多 6 人（宝可梦味）

// 技能卡翻牌动画：复用赌石坊 GambleStoneScreen 那套 preserve-3d + backface-hidden
// 的翻面机制，尺寸适配技能卡。悬停/点选时卡片绕 Y 轴翻到背面，露出字段理解器
// 翻译出的完整招式说明。.qb-flip 是 3D 容器，两个 .qb-face 是正反面。
const QB_CSS = `
  .qb-card{ perspective:900px; }
  .qb-flip{ position:relative; width:100%; height:100%; transform-style:preserve-3d;
    transition:transform .5s cubic-bezier(.4,0,.2,1); }
  .qb-face{ position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden;
    display:flex; flex-direction:column; border-radius:5px; overflow:hidden; }
  .qb-face.qb-back{ transform:rotateY(180deg); }
  /* 伤害数字弹跳：结算后在对峙区飘一下 */
  .qb-dmg{ animation:qbDmg .9s ease-out forwards; }
  @keyframes qbDmg{
    0%{ opacity:0; transform:translateY(6px) scale(.7); }
    18%{ opacity:1; transform:translateY(-4px) scale(1.15); }
    40%{ transform:translateY(-8px) scale(1); }
    100%{ opacity:0; transform:translateY(-26px) scale(.95); }
  }
  /* ── 窄屏(手机)紧凑化：对峙区/选人/技能卡收窄，避免挤爆 ── */
  @media (max-width: 640px){
    /* 对峙区改上下堆叠：我方在上、敌方在下，两人血条都能完整显示 */
    .qb-arena{ flex-direction:column !important; gap:8px !important; padding:8px 10px !important; }
    .qb-arena .qb-fighter{ width:100% !important; align-items:stretch !important; }
    .qb-arena .qb-fighter-info{ min-width:0 !important; flex:1 !important; text-align:left !important; }
    .qb-arena .qb-vs{ padding-top:0 !important; flex-direction:row !important; }
    .qb-arena .qb-vs img{ width:28px !important; }
    .qb-arena .qb-portrait{ width:48px !important; height:64px !important; }
    .qb-cardrow{ gap:6px !important; }
    .qb-card{ width:calc(50% - 3px) !important; height:132px !important; }
    .qb-candgrid{ grid-template-columns:repeat(auto-fill,minmax(84px,1fr)) !important; gap:8px !important; }
    .qb-face.qb-back{ font-size:11px !important; }
  }
`;

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

// ─────────────────────────── 阶段一：选模式 ───────────────────────────
function ModePick({ onPick, onExit }) {
  return (
    <div style={sx.centerCol}>
      <h1 style={sx.title}>斗蛐蛐</h1>
      <div style={sx.subtitle}>从曲措乡众生里挑人下场，切磋见真章</div>
      <div style={{ display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap", justifyContent: "center", width: "100%", padding: "0 12px", boxSizing: "border-box" }}>
        <WoodCard onClick={() => onPick("1v1")} title="单挑" sub="一对一，速战速决" />
        <WoodCard onClick={() => onPick("team")} title="团战" sub="各排一队，可临阵换人" />
      </div>
      <TextBtn onClick={onExit} style={{ marginTop: 48 }}>← 返回主菜单</TextBtn>
    </div>
  );
}

function WoodCard({ title, sub, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", width: "clamp(140px, 42vw, 220px)", height: 150, border: "none", cursor: "pointer",
        background: "transparent", transform: hover ? "translateY(-4px)" : "none",
        transition: "transform .2s ease",
      }}
    >
      <img src={UI("panel_big.webp")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, padding: "0 8px" }}>
        <div style={{ fontSize: "clamp(20px, 6vw, 26px)", letterSpacing: 4, color: "#f0d090", fontWeight: "bold" }}>{title}</div>
        <div style={{ fontSize: "clamp(10px, 3vw, 12px)", color: "#c0a060", letterSpacing: 1, textAlign: "center" }}>{sub}</div>
      </div>
    </button>
  );
}

// ─────────────────────────── 阶段二：选人布阵 ───────────────────────────
function PickScreen({ mode, candidates, allyIds, foeIds, setAllyIds, setFoeIds, onBack, onStart }) {
  const [tab, setTab] = useState("ally"); // 当前在给哪一队选人
  const cap = mode === "1v1" ? 1 : MAX_TEAM;
  const curIds = tab === "ally" ? allyIds : foeIds;
  const setCur = tab === "ally" ? setAllyIds : setFoeIds;
  const otherIds = tab === "ally" ? foeIds : allyIds;

  const toggle = (id) => {
    if (curIds.includes(id)) { setCur(curIds.filter(x => x !== id)); return; }
    if (curIds.length >= cap) {
      if (mode === "1v1") { setCur([id]); return; } // 1v1 直接替换
      return; // 团战满员不再加
    }
    setCur([...curIds, id]);
  };

  const canStart = allyIds.length > 0 && foeIds.length > 0;

  return (
    <div style={sx.pickWrap}>
      <div style={sx.pickHeader}>
        <TextBtn onClick={onBack}>← 换模式</TextBtn>
        <div style={{ fontSize: "clamp(15px, 4vw, 20px)", letterSpacing: 2, color: "#f0d090", whiteSpace: "nowrap" }}>
          布阵 · {mode === "1v1" ? "单挑" : "团战"}
        </div>
        <button
          onClick={canStart ? onStart : undefined}
          disabled={!canStart}
          style={{ ...sx.startBtn, opacity: canStart ? 1 : 0.35, cursor: canStart ? "pointer" : "default", whiteSpace: "nowrap" }}
        >
          开打 →
        </button>
      </div>

      {/* 两队当前阵容条 */}
      <div style={sx.teamsRow}>
        <TeamBar label="我方" ids={allyIds} candidates={candidates} active={tab === "ally"} onClick={() => setTab("ally")} onRemove={(id) => setAllyIds(allyIds.filter(x => x !== id))} accent="#6aa0d4" />
        <div style={sx.vs}>VS</div>
        <TeamBar label="敌方" ids={foeIds} candidates={candidates} active={tab === "foe"} onClick={() => setTab("foe")} onRemove={(id) => setFoeIds(foeIds.filter(x => x !== id))} accent="#d47a6a" />
      </div>
      <div style={sx.pickHint}>
        正在挑选<b style={{ color: tab === "ally" ? "#6aa0d4" : "#d47a6a" }}>{tab === "ally" ? "我方" : "敌方"}</b>
        （{curIds.length}/{cap}）· 点头像加入本队，再点一次移出 · 点上方队旗切换给哪队选
      </div>

      {/* 候选名单 */}
      <div className="qb-candgrid" style={sx.candidateGrid}>
        {candidates.map(c => {
          const inCur = curIds.includes(c.id);
          const inOther = otherIds.includes(c.id);
          return (
            <CandidateCard
              key={c.id} c={c}
              picked={inCur} disabled={inOther}
              accent={tab === "ally" ? "#6aa0d4" : "#d47a6a"}
              onClick={() => !inOther && toggle(c.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TeamBar({ label, ids, candidates, active, onClick, onRemove, accent }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minHeight: 92, padding: "10px 14px", cursor: "pointer",
        background: "rgba(20,16,10,.55)",
        border: `2px solid ${active ? accent : "rgba(255,255,255,.12)"}`,
        borderRadius: 6, transition: "border-color .2s",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 2, color: accent, marginBottom: 8 }}>
        {label}（{ids.length}）{active && <span style={{ color: "#c0a060", fontSize: 11 }}> · 挑选中</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ids.length === 0 && <span style={{ color: "#8a7d5a", fontSize: 12 }}>还没人上阵</span>}
        {ids.map(id => {
          const c = candidates.find(x => x.id === id);
          if (!c) return null;
          return (
            <div key={id} onClick={(e) => { e.stopPropagation(); onRemove(id); }}
              title="点击移出"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: "rgba(0,0,0,.35)", border: `1px solid ${tierColor(c.levelCap)}`,
                borderRadius: 4, fontSize: 12, color: "#e8dfc0", cursor: "pointer" }}>
              {c.name} <span style={{ color: "#8a7d5a" }}>✕</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({ c, picked, disabled, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", width: "100%", aspectRatio: "108/148", padding: 0, cursor: disabled ? "not-allowed" : "pointer",
        border: `2px solid ${picked ? accent : tierColor(c.levelCap)}`,
        borderRadius: 6, overflow: "hidden", background: "#14100b", boxSizing: "border-box",
        opacity: disabled ? 0.3 : 1,
        boxShadow: picked ? `0 0 14px ${accent}` : (hover && !disabled ? "0 4px 14px rgba(0,0,0,.6)" : "none"),
        transform: hover && !disabled ? "translateY(-3px)" : "none", transition: "all .18s ease",
      }}
    >
      {/* 有立绘用真图，没有的用品阶色底 + 大字名 */}
      {c.portrait ? (
        <img src={PORTRAIT(c.portrait)} alt={c.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px",
          background: `radial-gradient(120% 90% at 50% 20%, ${tierColor(c.levelCap)}22 0%, #14100b 70%)` }}>
          <span style={{
            fontSize: c.name.length >= 4 ? 20 : c.name.length === 3 ? 24 : 30,
            lineHeight: 1.1, color: tierColor(c.levelCap), fontWeight: "bold", textAlign: "center",
            writingMode: c.name.length > 4 ? "vertical-rl" : "horizontal-tb",
            wordBreak: "break-word", maxHeight: "100%", overflow: "hidden" }}>{c.name}</span>
        </div>
      )}
      {/* 底部名条 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "4px 6px",
        background: "linear-gradient(0deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 60%, transparent 100%)" }}>
        <div style={{ fontSize: 13, color: "#e8dfc0", fontWeight: "bold", textShadow: "0 1px 2px #000" }}>{c.name}</div>
        <div style={{ fontSize: 9.5, color: tierColor(c.levelCap), letterSpacing: 1 }}>
          {tierName(c.levelCap)}品{c.beast ? " · 兽" : ""}
        </div>
      </div>
      {picked && <div style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
        background: accent, color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
    </button>
  );
}

// ─────────────────────────── 阶段三：对战 ───────────────────────────
function BattleScreen({ battle, setBattle, mode, onFinish, onQuit }) {
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
    <div style={sx.battleWrap}>
      {/* 顶栏 */}
      <div style={sx.battleTop}>
        <TextBtn onClick={onQuit}>← 认输退出</TextBtn>
        <div style={{ fontSize: 13, color: "#c0a060", letterSpacing: 2 }}>第 {battle.round} 回合</div>
        <div style={{ fontSize: 11, color: apiOn ? "#6aa06a" : "#8a7d5a" }}>
          {apiOn ? "◆ 说书战报已启用" : "◇ 装 key 可解锁说书战报"}
        </div>
      </div>

      {/* 对峙区（签名元素）：双方立绘 + 血槽 + 飘伤害 */}
      <div className="qb-arena" style={sx.arena}>
        <FighterPanel fighter={ally} side="ally" team={battle.allyTeam} curIdx={battle.allyIdx}
          hit={battle.lastHit ? { key: battle.lastHit.key, dmg: battle.lastHit.toMe } : null} />
        <div className="qb-vs" style={sx.arenaVs}>
          <img src={UI("burst.webp")} alt="" style={{ width: 64, opacity: 0.7 }} />
          <div style={{ fontSize: 22, color: "#e0526a", fontWeight: "bold", letterSpacing: 2 }}>斗</div>
        </div>
        <FighterPanel fighter={foe} side="foe" team={battle.foeTeam} curIdx={battle.foeIdx}
          hit={battle.lastHit ? { key: battle.lastHit.key, dmg: battle.lastHit.toFoe } : null} />
      </div>

      {/* 战报流 */}
      <div ref={logRef} style={sx.logStream}>
        {battle.logs.length === 0 && <div style={{ color: "#8a7d5a", fontSize: 13, textAlign: "center", padding: 20 }}>选一招，切磋开始。</div>}
        {battle.logs.map((l, i) => (
          <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontSize: 11, color: "#c0a060", marginBottom: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>第{l.round}回合{l.myMove ? ` · ${l.myName}「${l.myMove}」 对 ${l.foeName}「${l.foeMove}」` : ""}</span>
              {/* 伤害数字：醒目独立标记，一眼看清这一击打了多少 */}
              {l.dmgToFoe > 0 && <span style={sx.dmgTag("#d47a6a")}>敌 −{l.dmgToFoe}</span>}
              {l.dmgToMe > 0 && <span style={sx.dmgTag("#6aa0d4")}>我 −{l.dmgToMe}</span>}
              {(l.dmgToFoe === 0 || l.dmgToFoe == null) && (l.dmgToMe === 0 || l.dmgToMe == null) && l.myMove && <span style={{ color: "#6a5f4a" }}>无伤</span>}
            </div>
            {/* 系统战报（始终显示，权威结算文字） */}
            <div style={{ fontSize: 13.5, color: "#cdc2a2", lineHeight: 1.8 }}>
              {l.text}
            </div>
            {/* AI 说书（有则另起一行，润色不覆盖系统文字；斜体+左边框区分） */}
            {l.narration && (
              <div style={{ fontSize: 13.5, color: "#e8d5a8", lineHeight: 1.9, marginTop: 6, paddingLeft: 10,
                borderLeft: "2px solid #6a5d40", fontStyle: "italic" }}>
                <span style={{ fontStyle: "normal", fontSize: 10, color: "#8a7d5a", marginRight: 6 }}>说书</span>
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
              <div style={{ color: "#d47a6a", fontSize: 14, marginBottom: 10 }}>{ally?.name || "上场者"}已倒下，选谁接替上场</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {battle.allyTeam.map((f, i) => f.combatState.hp[0] > 0 && (
                  <button key={i} onClick={() => switchTo(i)} style={sx.switchBtn}>
                    {f.name}<span style={{ color: "#8a7d5a", fontSize: 11 }}> {f.combatState.hp[0]}/{f.combatState.hp[1]}</span>
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
                  <div style={{ fontSize: 10, color: "#8a7d5a", marginBottom: 6 }}>换人（让位一手）</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 120, overflowY: "auto" }}>
                    {battle.allyTeam.map((f, i) => (i !== battle.allyIdx && f.combatState.hp[0] > 0) && (
                      <button key={i} onClick={() => switchTo(i)} style={sx.switchBtnSmall}>
                        {f.name} <span style={{ color: "#8a7d5a" }}>{f.combatState.hp[0]}/{f.combatState.hp[1]}</span>
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
            <div style={{ fontSize: 22, color: battle.winner === "ally" ? "#6aa0d4" : "#d47a6a", fontWeight: "bold", letterSpacing: 4, marginBottom: 12 }}>
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
  const accent = side === "ally" ? "#6aa0d4" : "#d47a6a";
  const align = side === "ally" ? "flex-start" : "flex-end";
  const showDmg = hit && hit.dmg > 0;

  return (
    <div className="qb-fighter" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: align, gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: side === "ally" ? "row" : "row-reverse" }}>
        <div className="qb-portrait" style={{ position: "relative", width: 76, height: 100, borderRadius: 6, overflow: "visible", flexShrink: 0 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", border: `2px solid ${tierColor(fighter.levelCap)}`, background: "#14100b" }}>
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
              fontSize: 24, fontWeight: "bold", color: "#ff6a5a",
              textShadow: "0 2px 6px #000, 0 0 12px rgba(255,60,50,.7)", pointerEvents: "none", zIndex: 5,
            }}>−{hit.dmg}</div>
          )}
        </div>
        <div className="qb-fighter-info" style={{ minWidth: 150, textAlign: side === "ally" ? "left" : "right" }}>
          <div style={{ fontSize: 16, color: "#e8dfc0", fontWeight: "bold" }}>{fighter.name}</div>
          <div style={{ fontSize: 10, color: tierColor(fighter.levelCap) }}>{tierName(fighter.levelCap)}品</div>
          {/* 血槽 */}
          <div style={{ marginTop: 6 }}>
            <Bar ratio={hpRatio} color="#c8483a" bg="#3a1a16" label={`气血 ${cs.hp[0]}/${cs.hp[1]}`} rtl={side === "foe"} />
            <Bar ratio={enRatio} color="#d4a853" bg="#2a2010" label={`气力 ${cs.energy[0]}/10`} rtl={side === "foe"} thin />
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
                border: i === curIdx ? `2px solid #fff` : "none",
                boxShadow: i === curIdx ? `0 0 8px ${accent}` : "none" }} />;
          })}
        </div>
      )}
    </div>
  );
}

function Bar({ ratio, color, bg, label, rtl, thin }) {
  return (
    <div style={{ position: "relative", height: thin ? 8 : 14, background: bg, borderRadius: 3, overflow: "hidden", marginTop: 3 }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, [rtl ? "right" : "left"]: 0,
        width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color, transition: "width .4s ease" }} />
      {!thin && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", textShadow: "0 1px 2px #000" }}>{label}</div>}
    </div>
  );
}

function StatusChip({ name }) {
  return <span style={{ fontSize: 9, padding: "1px 5px", background: "rgba(180,80,80,.3)", border: "1px solid #a05050", borderRadius: 3, color: "#e0b0b0" }}>{name}</span>;
}

function MoveButton({ move, usable, reason, onClick }) {
  const qc = QUALITY_COLOR[move.quality] || "#c8bfa0";
  const lines = explainMove(move);
  const gist = moveTypeGist(move);
  const [flipped, setFlipped] = useState(false);
  const mainLine = lines.length ? lines[0].text : "";

  return (
    <div className="qb-card" style={{ width: 128, height: 96, perspective: 900 }}>
      <div className="qb-flip" style={{ transform: flipped ? "rotateY(180deg)" : undefined }}>
        {/* 正面：招名 + 类型/品阶/耗气 + 主效果一行 + 可用性；点击翻到详情 */}
        <button
          className="qb-face"
          onClick={() => setFlipped(true)}
          style={{
            cursor: "pointer", textAlign: "left", padding: "8px 10px",
            background: usable ? "rgba(20,16,10,.85)" : "rgba(10,8,5,.7)",
            border: `2px solid ${usable ? qc : "rgba(255,255,255,.1)"}`,
            opacity: usable ? 1 : 0.6,
          }}
        >
          <div style={{ fontSize: 14, color: "#e8dfc0", fontWeight: "bold" }}>{move.name}</div>
          <div style={{ fontSize: 10, color: qc, marginTop: 2 }}>{move.type} · {move.quality}品 · 耗气{move.energyCost}</div>
          <div style={{ fontSize: 9.5, color: "#b0a480", marginTop: 3, lineHeight: 1.35, overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{mainLine}</div>
          {reason
            ? <div style={{ fontSize: 9.5, color: "#c8483a", marginTop: "auto" }}>{reason}</div>
            : <div style={{ fontSize: 9, color: "#6a5f4a", marginTop: "auto" }}>点击看详情 →</div>}
        </button>
        {/* 背面：完整字段说明 + 明确的出招/返回按钮 */}
        <div
          className="qb-face qb-back"
          style={{ padding: "7px 9px", background: "rgba(24,20,13,.98)", border: `2px solid ${qc}`, overflowY: "auto" }}
        >
          <div style={{ fontSize: 11, color: qc, fontWeight: "bold", marginBottom: 3 }}>
            {move.name} <span style={{ color: "#8a7d5a", fontWeight: "normal" }}>耗气{move.energyCost}</span>
          </div>
          <div style={{ fontSize: 8.5, color: "#8a7d5a", marginBottom: 4, lineHeight: 1.4 }}>{gist}</div>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 9.5, color: l.warn ? "#d88" : "#cdc2a2", lineHeight: 1.5, marginBottom: 2 }}>
              · {l.text}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6, position: "sticky", bottom: 0 }}>
            <button onClick={() => usable && onClick()} disabled={!usable}
              style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: "bold", borderRadius: 4,
                border: "none", cursor: usable ? "pointer" : "not-allowed",
                background: usable ? qc : "#333", color: usable ? "#1a140c" : "#777" }}>
              {usable ? "⚔ 出招" : (reason || "不可用")}
            </button>
            <button onClick={() => setFlipped(false)}
              style={{ padding: "5px 10px", fontSize: 11, borderRadius: 4, border: `1px solid ${qc}`,
                background: "transparent", color: qc, cursor: "pointer" }}>返回</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── 阶段四：战报总结 ───────────────────────────
function ResultScreen({ battle, onAgain, onExit }) {
  const win = battle.winner === "ally";
  const survivors = battle.allyTeam.filter(f => f.combatState.hp[0] > 0);
  const fallen = battle.allyTeam.filter(f => f.combatState.hp[0] <= 0);
  const foeFallen = battle.foeTeam.filter(f => f.combatState.hp[0] <= 0);

  return (
    <div style={sx.centerCol}>
      <div style={{ fontSize: 40, color: win ? "#6aa0d4" : "#d47a6a", fontWeight: "bold", letterSpacing: 8, marginBottom: 10 }}>
        {win ? "胜" : "败"}
      </div>
      <div style={{ fontSize: 15, color: "#c0a060", marginBottom: 30 }}>
        鏖战 {battle.round} 回合，{win ? "我方力克群雄" : "我方尽墨"}
      </div>
      <div style={{ display: "flex", gap: 40, marginBottom: 40, flexWrap: "wrap", justifyContent: "center" }}>
        <ResultCol title="我方存活" names={survivors.map(f => f.name)} color="#6aa0d4" empty="无人生还" />
        <ResultCol title="我方阵亡" names={fallen.map(f => f.name)} color="#8a7d5a" empty="全员无恙" />
        <ResultCol title="斩获敌方" names={foeFallen.map(f => f.name)} color="#d4a853" empty="未伤敌分毫" />
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <button onClick={onAgain} style={sx.startBtn}>再来一场</button>
        <TextBtn onClick={onExit}>返回主菜单</TextBtn>
      </div>
    </div>
  );
}

function ResultCol({ title, names, color, empty }) {
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ fontSize: 13, color, letterSpacing: 2, marginBottom: 8, borderBottom: `1px solid ${color}44`, paddingBottom: 4 }}>{title}</div>
      {names.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6a5f4a" }}>{empty}</div>
      ) : names.map((n, i) => (
        <div key={i} style={{ fontSize: 13, color: "#cdc2a2", marginBottom: 3 }}>{n}</div>
      ))}
    </div>
  );
}

// ─────────────────────────── 通用小组件 ───────────────────────────
function TextBtn({ children, onClick, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: "none", cursor: "pointer", color: hover ? "#f0d090" : "#c0a060",
        fontSize: 13, letterSpacing: 1, transition: "color .2s", ...style }}>
      {children}
    </button>
  );
}

// ─────────────────────────── 样式 ───────────────────────────
const sx = {
  root: { position: "fixed", inset: 0, fontFamily: "'Noto Serif SC','Songti SC',serif", overflow: "hidden", color: "#e8dfc0" },
  bg: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  scrim: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,6,4,.72) 0%, rgba(8,6,4,.55) 40%, rgba(8,6,4,.8) 100%)" },
  centerCol: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box", textAlign: "center" },
  title: { fontSize: 52, letterSpacing: 16, color: "#f0d090", margin: 0, textShadow: "0 3px 12px rgba(0,0,0,.7)" },
  subtitle: { fontSize: 14, letterSpacing: 3, color: "#c0a060", marginTop: 12 },

  pickWrap: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    padding: "16px clamp(16px,4vw,60px)", boxSizing: "border-box" },
  pickHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  startBtn: { padding: "9px 18px", background: "linear-gradient(180deg,#8a6a2a,#5a4418)", border: "1px solid #c0a060",
    borderRadius: 6, color: "#f5e8c0", fontSize: 14, letterSpacing: 1, cursor: "pointer", fontWeight: "bold" },
  teamsRow: { display: "flex", alignItems: "stretch", gap: 12, marginBottom: 10 },
  vs: { display: "flex", alignItems: "center", fontSize: 18, color: "#e0526a", fontWeight: "bold" },
  pickHint: { fontSize: 12, color: "#a89878", marginBottom: 12, lineHeight: 1.6 },
  candidateGrid: { flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(108px,1fr))",
    gap: 12, overflowY: "auto", alignContent: "start", paddingBottom: 12,
    borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14 },

  battleWrap: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    padding: "14px clamp(16px,4vw,50px)", boxSizing: "border-box" },
  battleTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 },
  arena: { display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 16px", marginBottom: 12,
    background: "rgba(15,12,8,.5)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8 },
  arenaVs: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingTop: 20 },
  logStream: { flex: 1, overflowY: "auto", padding: "12px 16px", background: "rgba(10,8,5,.6)",
    border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, marginBottom: 12, minHeight: 80 },
  controlBar: { display: "flex", gap: 10, padding: "12px 14px", background: "rgba(20,16,10,.7)",
    border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, minHeight: 116, alignItems: "flex-start" },
  switchBtn: { padding: "8px 16px", background: "rgba(40,60,80,.6)", border: "1px solid #6aa0d4",
    borderRadius: 5, color: "#cfe0ee", fontSize: 13, cursor: "pointer" },
  switchBtnSmall: { padding: "4px 10px", background: "rgba(40,60,80,.5)", border: "1px solid #4a6a84",
    borderRadius: 4, color: "#cfe0ee", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" },
  dmgTag: (c) => ({ padding: "1px 7px", borderRadius: 3, background: `${c}22`, border: `1px solid ${c}`,
    color: c, fontWeight: "bold", fontSize: 11 }),
};

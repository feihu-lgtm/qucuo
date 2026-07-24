// 说服对话界面
// 一场"用话把人说动"的交锋。AI 只输出 NPC 的短对话（≤30字），不叙事不扮演旁白。
// 视觉：水墨对谈——上方对手与心结、可见的突破口进度；中间对话流；下方输入+捷径。
// 判定走 persuasion.js 的隐藏结构化字段，UI 只呈现结果。

import React, { useState, useRef, useEffect } from "react";
import { runPersuadeTurn, hintsUnlockedByGuard } from "./quests/persuasion.js";

export default function PersuasionScreen({ persuade, apiCfg, ownedFlags = [], playerMoney = 0, playerIdentities = [], playerSpecial = {}, zoneTheme, savedProgress = null, onProgress, onFinish }) {
  const p = persuade;
  // 魅力影响初始戒心：魅力高，NPC 天生更愿意听你说话，起手戒心低些。
  // 基准100，魅力每高于5一点降4、每低于5一点升4（魅力10→80，魅力0→120封顶100）。
  const charm = playerSpecial?.魅力 ?? 5;
  const initialGuard = Math.max(40, Math.min(100, 100 - (charm - 5) * 4));
  // 进度从外部持久化快照恢复（savedProgress）：再点同一场说服时接着上次，不从头。
  const [turns, setTurns] = useState(() => savedProgress?.turns
    ? savedProgress.turns
    : (p.opening ? [{ who: "npc", text: p.opening }] : []));
  const [hitKeys, setHitKeys] = useState(() => savedProgress?.hitKeys || []);
  const [guard, setGuard] = useState(() => savedProgress?.guard ?? initialGuard);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // null | "yield" | "bribe" | "identity" | "leave"
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [turns, busy]);
  useEffect(() => { inputRef.current?.focus(); }, [done]);
  // 每当进度变化，写回外部持久化（供存档 + 再次打开时续接）。
  useEffect(() => {
    onProgress?.({ guard, hitKeys, turns, done });
  }, [guard, hitKeys, turns, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = zoneTheme || {};
  const accent = t.accent || "#c8a860";
  const bg = t.bg || "#141014";
  const panel = t.bgPanel || "#1c1820";
  const text = t.text || "#e8e0d0";
  const textDim = t.textDim || "#8a8478";
  const border = t.border || "#3a3038";

  const canBribe = p.bribe != null;
  const canIdentity = p.identity && playerIdentities.includes(p.identity);
  const progress = hitKeys.length;
  const need = p.resistance;
  // 已解锁的线索条数由戒心值决定；取 keys 的前 N 条 hint 展示给玩家。
  const unlockedCount = hintsUnlockedByGuard(guard, p.keys.length);
  const unlockedHints = p.keys.slice(0, unlockedCount).map(k => k.hint);

  async function send() {
    const say = input.trim();
    if (!say || busy || done) return;
    setInput("");
    setTurns(prev => [...prev, { who: "player", text: say }]);
    setBusy(true);
    const history = turns.map(x => ({ role: x.who === "npc" ? "assistant" : "user", content: x.text }));
    const res = await runPersuadeTurn(p, say, hitKeys, ownedFlags, history, apiCfg, guard, playerSpecial?.智谋 ?? 5);
    setHitKeys(res.newHitKeys);
    setGuard(res.newGuard);
    setTurns(prev => [...prev, { who: "npc", text: res.line, struck: !!res.hit }]);
    setBusy(false);
    if (res.yield) {
      setDone("yield");
      setTimeout(() => onFinish?.({ outcome: "success", via: "talk" }), 1400);
    }
  }

  function doBribe() {
    if (!canBribe || playerMoney < p.bribe || done) return;
    setTurns(prev => [...prev, { who: "player", text: `（掏出 ${p.bribe} 两银子推过去）` }, { who: "npc", text: "……话不必多说，事我替你办了。" }]);
    setDone("bribe");
    setTimeout(() => onFinish?.({ outcome: "success", via: "bribe", cost: p.bribe }), 1400);
  }
  function doIdentity() {
    if (!canIdentity || done) return;
    setTurns(prev => [...prev, { who: "player", text: `（亮出${p.identity}的身份）` }, { who: "npc", text: "原来是您，失敬。这事好说。" }]);
    setDone("identity");
    setTimeout(() => onFinish?.({ outcome: "success", via: "identity" }), 1400);
  }
  function leave() {
    setDone("leave");
    onFinish?.({ outcome: "leave", via: "leave" });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, background: `${bg}f2`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      fontFamily: "inherit",
    }}>
      <div style={{
        width: "100%", maxWidth: 560, height: "82vh", maxHeight: 720,
        background: panel, border: `1px solid ${border}`, borderRadius: 8,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        {/* 顶栏：对手 + 表象（不泄露心结，心结要玩家自己猜） */}
        <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${border}`, background: `linear-gradient(180deg, ${accent}14, transparent)` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 17, color: text, letterSpacing: 1 }}>说服 · {p.who}</span>
            <span style={{ fontSize: 11, color: textDim }}>言语交锋</span>
          </div>
          {p.observe && (
            <div style={{ marginTop: 6, fontSize: 12, color: textDim, lineHeight: 1.5, fontStyle: "italic" }}>
              {p.observe}
            </div>
          )}
          {/* 火候提示：用戒心值给模糊的"对方松动到几分"的感觉，不预告突破口数量 */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: textDim, marginRight: 2 }}>火候</span>
            <span style={{
              fontSize: 11.5,
              color: progress >= need ? accent : guard < 40 ? "#c8a860cc" : textDim,
              transition: "color 0.4s ease",
            }}>
              {progress >= need ? "话已说透，就等他一句"
                : guard < 15 ? "他几乎守不住了，再推一把"
                : guard < 45 ? "他神色几动，口风软了些"
                : guard < 75 ? "似乎起了点头绪，他不那么冷了"
                : "油盐不进，还没说到点上"}
            </span>
          </div>
          {/* 已解锁线索（戒心每降30解锁一条，按keys顺序）：这是玩家花力气破冰换来的方向指引 */}
          {unlockedHints.length > 0 && (
            <div style={{ marginTop: 8, padding: "7px 10px", background: `${accent}12`, border: `1px solid ${accent}33`, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: accent, marginBottom: 3, letterSpacing: 1 }}>你看出的心结</div>
              {unlockedHints.map((h, i) => (
                <div key={i} style={{ fontSize: 11.5, color: text, lineHeight: 1.6 }}>· {h}</div>
              ))}
            </div>
          )}
        </div>

        {/* 对话流：只显示短对话 */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {turns.map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: x.who === "npc" ? "flex-start" : "flex-end" }}>
              <div style={{
                maxWidth: "78%", padding: "8px 13px", borderRadius: 10, fontSize: 14, lineHeight: 1.5,
                background: x.who === "npc" ? bg : accent,
                color: x.who === "npc" ? text : bg,
                border: x.who === "npc" ? `1px solid ${x.struck ? accent : border}` : "none",
                boxShadow: x.struck ? `0 0 0 1px ${accent}66` : "none",
              }}>
                {x.who === "npc" && <div style={{ fontSize: 10, color: textDim, marginBottom: 2 }}>{p.who}{x.struck ? " · 语气一动" : ""}</div>}
                {x.text}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: "flex-start", color: textDim, fontSize: 13, padding: "4px 6px" }}>
              {p.who}沉吟……
            </div>
          )}
          {done === "yield" && <div style={{ alignSelf: "center", color: accent, fontSize: 13, marginTop: 4 }}>✓ 你把话说到了点子上，对方松口了。</div>}
        </div>

        {/* 输入 + 捷径 */}
        <div style={{ borderTop: `1px solid ${border}`, padding: "10px 14px" }}>
          {!done && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
                  placeholder={`对${p.who}说些什么…（说中要害才管用）`}
                  disabled={busy}
                  style={{
                    flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 6,
                    padding: "9px 12px", color: text, fontSize: 13, outline: "none", fontFamily: "inherit",
                  }}
                />
                <button onClick={send} disabled={busy || !input.trim()} style={{
                  background: input.trim() && !busy ? accent : border, color: bg, border: "none",
                  borderRadius: 6, padding: "9px 16px", fontSize: 13, cursor: input.trim() && !busy ? "pointer" : "default",
                  fontFamily: "inherit",
                }}>说</button>
              </div>
              {/* 捷径：贿赂 / 亮身份 / 作罢 */}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {canBribe && (
                  <button onClick={doBribe} disabled={playerMoney < p.bribe} title={playerMoney < p.bribe ? "银子不够" : ""}
                    style={{ ...chip(border, textDim), opacity: playerMoney < p.bribe ? 0.4 : 1 }}>
                    💰 塞银子（{p.bribe}两）
                  </button>
                )}
                {canIdentity && <button onClick={doIdentity} style={chip(accent, accent)}>🎓 亮出{p.identity}身份</button>}
                <button onClick={leave} style={chip(border, textDim)}>拂袖而去</button>
              </div>
            </>
          )}
          {done && done !== "yield" && (
            <div style={{ textAlign: "center", color: textDim, fontSize: 12, padding: "6px 0" }}>
              {done === "leave" ? "这事没谈成，改日再来。" : "事情办妥了。"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function chip(bc, color) {
  return {
    background: "transparent", border: `1px solid ${bc}`, color, borderRadius: 5,
    padding: "5px 11px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
  };
}

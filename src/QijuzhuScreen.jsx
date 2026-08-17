import React, { useState } from "react";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";
import { TALLY_KINDS, DAY_TURNS, tallyToday, describeLifetime, tallyTotals } from "./memory/tally.js";
import { NNPC_STAGE } from "./narrator.js";

// 起居注：逐日记录起居言动。
// ============================================================================
// 数据来自 memory/tally.js（varTree.世界.起居注）：走 AI 的和不走 AI 的动作都在里头。
// 两个视野对应两个 tab：
//   今日  当前这一整天（24回合）之内，跨天清零 —— 看"今天都干了什么"
//   累计  开局以来，永不清零 —— 看"这一路走了多远"
//
// 【为什么这个面板值得单独存在】
// 不走 AI 的动作（走动/打坐/安抚/装备/拾取）此前一件都不留痕。它们单看没有意义，
// 攒起来才有：走了四百段路、打坐一百回、给她拿过三十次蛋糕——这些数字本身就是
// 玩了很久的证据，比任何成就系统都实在。
//
// 【标题会变】走完旁白线（stage=RESOLVED）之后，这本册子的口吻跟着第六档一起变成
// 她的手笔——面板本身也成了那段关系的证据，与 TONE_BY_TIER.unmasked 同一个道理。

export default function QijuzhuScreen({ varTree, time = 0, narratorStage, zoneTheme, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [tab, setTab] = useState("today");
  const T = zoneTheme || {};
  const accent = T.accent || "#c4a86a";
  const border = T.border || "#2a2d3a";
  const bgPanel = T.bgPanel || "#12141c";
  const textDim = T.textDim || "#6a6a5a";
  const text = T.text || "#e8e4d6";

  const tally = varTree?.世界?.起居注;
  const today = tallyToday(tally, time);
  const lifetime = describeLifetime(tally);
  const totals = tallyTotals(tally, time);
  const day = Math.floor(time / DAY_TURNS) + 1;

  // 走完旁白线之后，这本册子改由她记
  const herBook = narratorStage === NNPC_STAGE.RESOLVED;

  const todayRows = Object.entries(today)
    .filter(([k, v]) => TALLY_KINDS[k] && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: TALLY_KINDS[k].label, count: v, aiBacked: TALLY_KINDS[k].aiBacked }));

  const rows = tab === "today" ? todayRows : lifetime;
  const maxCount = rows.length ? Math.max(...rows.map(r => r.count)) : 1;

  const wrap = { position: "fixed", inset: 0, background: "rgba(4,4,8,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const card = { width: "100%", maxWidth: 560, maxHeight: "86vh", background: "#111110", border: `1px solid ${border}`, borderRadius: 0, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Songti SC','STSong','SimSun',serif", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" };

  return (
    <div style={wrap} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${border}`, background: `linear-gradient(180deg, ${bgPanel}, transparent)` }}>
          <span style={{ fontSize: 18, color: accent, fontWeight: "bold", letterSpacing: 2 }}>🗒 起居注</span>
          <span style={{ fontSize: 11, color: textDim }}>
            {herBook ? "本女侠替这笨蛋记的账" : "逐日记录起居言动"}
          </span>
          <span style={{ flex: 1 }} />
          <span onClick={onClose} style={{ cursor: "pointer", color: textDim, fontSize: 13, padding: "2px 8px" }}>✕ 收起</span>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "10px 20px 0" }}>
          {[["today", `第${day}日`, totals.today], ["lifetime", "累计", totals.lifetime]].map(([k, label, n]) => (
            <span key={k} onClick={() => setTab(k)}
              style={{ cursor: "pointer", padding: "6px 16px", borderRadius: 0, fontSize: 13,
                color: tab === k ? "#111110" : accent, background: tab === k ? accent : "transparent",
                border: `1px solid ${tab === k ? accent : border}`, borderBottom: "none", fontWeight: tab === k ? "bold" : "normal" }}>
              {label} · {n}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 18px", borderTop: `1px solid ${border}` }}>
          {rows.length === 0 ? (
            <div style={{ color: textDim, fontSize: 12, lineHeight: 2, padding: "20px 0", textAlign: "center" }}>
              {tab === "today"
                ? (herBook ? "今日这笨蛋还什么都没干。" : "今日尚无记录。")
                : "还没有可记之事。"}
            </div>
          ) : (
            <>
              {rows.map(r => (
                <div key={r.key} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
                    <span style={{ color: text, flex: 1 }}>{r.label}</span>
                    {/* aiBacked 标一下：那几类另有一条 AI 写的往事落在见闻录里，
                        这儿只是个量。不标的话玩家会以为起居注就是全部记忆。 */}
                    {r.aiBacked && (
                      <span style={{ fontSize: 9, color: textDim }} title="这一类另有详细往事，见「见闻录」">另有记述</span>
                    )}
                    <span style={{ color: accent, fontSize: 13, minWidth: 34, textAlign: "right" }}>{r.count}</span>
                  </div>
                  {/* 条形只作相对比例的直观提示，不标刻度——这不是数据面板 */}
                  <div style={{ height: 3, background: border, borderRadius: 0, marginTop: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(4, (r.count / maxCount) * 100)}%`, height: "100%", background: r.aiBacked ? accent : "#6a8a6a" }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${border}`, fontSize: 10.5, color: textDim, lineHeight: 1.9 }}>
                {tab === "today"
                  ? `今日共动作 ${totals.today} 次。子夜换日，此页清空，累计不清。`
                  : `开局以来共动作 ${totals.lifetime} 次。`}
                <br />
                <span style={{ color: "#6a8a6a" }}>绿</span>=只记数的日常举动，
                <span style={{ color: accent }}>金</span>=另在见闻录里留有往事的那些。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

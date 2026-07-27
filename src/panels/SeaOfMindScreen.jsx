import React from "react";
import {
  COMFORT_ACTIONS, KNOTS, KNOT_BY_KEY,
  defenseLevelOf, comfortScore, canComfort, describeComfortReject,
  availableKnot, canResolve,
} from "../narratorQuest.js";

// 心灵之海 · 创伤安抚面板
// ============================================================================
// 挂在中栏顶部（玩家在心灵之海且 stage 为创伤阶段时显示）。
//
// 【为什么安抚做成按钮而不是打字】
// "抱一抱""喂药"这类动作如果靠玩家打字命中关键词，会变成猜谜——玩家想抱她，
// 打了"过去抱住她"没命中正则，什么都没发生，只会以为游戏坏了。做成按钮之后
// 意图是明确的，系统能确定性地判定门槛、计分、给反应。
//
// 【为什么不显示心防数值/进度条】
// 显示了这一段就变成填表：玩家会盯着数字刷到阈值。这里只给她的**反应**
// （被拒时的那句话），什么时候能做什么让玩家从她的反应里自己摸出来。
// 心结进度是例外——那是叙事进度不是数值，给玩家看是应该的。
export default function SeaOfMindScreen({
  narratorVars, invNames = [], zoneTheme,
  onComfort, onResolve, onClose, inline,
}) {
  const comfort = narratorVars.comfort || {};
  const spoken = narratorVars.knots || [];
  const level = defenseLevelOf(comfort);
  const next = availableKnot(comfort, spoken);
  const resolvable = canResolve(comfort, spoken);

  return (
    <div style={{
      flexShrink: 0, borderBottom: `1px solid ${zoneTheme.border}`,
      background: "linear-gradient(180deg, rgba(232,200,106,0.07), transparent)",
      padding: "10px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "#e8c86a", fontSize: 12 }}>⟡ 她蜷在沙发角落里</span>
        <span style={{ flex: 1 }} />
        {onClose && (
          <span onClick={onClose} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: 10 }}>▾ 收起</span>
        )}
      </div>

      {/* 心结进度：叙事进度，给玩家看 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
        {KNOTS.map(k => {
          const done = spoken.includes(k.key);
          const isNext = next?.key === k.key;
          return (
            <span key={k.key} style={{
              fontSize: 10.5, padding: "2px 9px", borderRadius: 3,
              color: done ? "#8ac48a" : isNext ? "#e8c86a" : "#4a4a44",
              border: `1px solid ${done ? "#2a4a2a" : isNext ? "#4a3a1a" : "#25252a"}`,
              background: done ? "rgba(138,196,138,.08)" : "transparent",
            }}>
              {done ? "✓ " : isNext ? "◦ " : "· "}
              {done || isNext ? k.title : "？？？"}
            </span>
          );
        })}
      </div>

      {/* 安抚动作 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(COMFORT_ACTIONS).map(([key, spec]) => {
          const gate = canComfort(key, comfort, invNames);
          return (
            <span
              key={key}
              onClick={() => onComfort(key)}
              title={spec.needItem ? `需要「${spec.needItem}」` : ""}
              style={{
                cursor: "pointer", userSelect: "none",
                fontSize: 11, padding: "4px 11px", borderRadius: 4,
                // 越级/缺物**不置灰也不禁用**——玩家该被允许试，然后从她的反应里
                // 知道时候未到。置灰等于把机制摊开，那一段的手感就没了。
                color: gate.ok ? "#e8d4a0" : "#8a8478",
                border: `1px solid ${gate.ok ? "#5a4a20" : "#2e2e33"}`,
                background: gate.ok ? "rgba(232,200,106,.08)" : "transparent",
              }}
            >
              {spec.label}
              {spec.needItem && !invNames.includes(spec.needItem) && (
                <span style={{ fontSize: 9, color: "#6a6458", marginLeft: 3 }}>（缺）</span>
              )}
            </span>
          );
        })}
      </div>

      {/* 收束入口：三结说尽且心防够低才出现 */}
      {resolvable && (
        <div
          onClick={onResolve}
          style={{
            marginTop: 9, padding: "7px 10px", borderRadius: 4, cursor: "pointer",
            border: "1px solid #8a6a2a", background: "rgba(232,200,106,.13)",
            color: "#f0d888", fontSize: 11.5, textAlign: "center",
          }}
        >
          ⟡ 跟她说那句她自己说不出口的话
        </div>
      )}

      {/* 引导：只在她还没开口时提一句，且不提数值 */}
      {!resolvable && (
        <div style={{ marginTop: 7, fontSize: 10, color: zoneTheme.textDim, lineHeight: 1.7 }}>
          {/* 只给感受与方向，不报数值、不列门槛清单——什么时候该做什么让玩家从她的
              反应里摸。但"心防够了却因为方式不对开不了下一条"这种情况必须给个方向，
              否则玩家会以为卡住了（他会一直说话，而说话正是推不动那一条的原因）。 */}
          {level >= 4
            ? "她还不让你靠近。先待着，说点什么都行。药在卧室墙角的柜子里，吃的在厨房。"
            : next
              ? "她肯回应了。接着问，或者接着陪。"
              : level <= 2
                ? "她安静下来了。光说话像是不够——试试别的。"
                : "她安静下来了。再多陪一会儿。"}
        </div>
      )}
    </div>
  );
}

// 供外部（MudRPG）复用的展示辅助——把安抚被拒的话转成日志行。
export function comfortRejectLine(actionKey, gate) {
  return describeComfortReject(actionKey, gate.reason, gate);
}

export { KNOT_BY_KEY, comfortScore };

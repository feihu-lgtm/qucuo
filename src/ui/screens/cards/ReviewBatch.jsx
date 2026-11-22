// 审改页共用件：批量设置（落脚/品阶）、AI 规划/配装进度条、两个一键按钮。
// 向导分支与常规分支原本各抄一份，拆屏时并到一处，少量文案/样式差异走 props。
import React from "react";
import { PLAN_BATCH, PLANNABLE_DISTRICTS } from "../../../domain/rules/cards/placementPlan.js";
import { S, TapSpan } from "./widgets.jsx";

// 「批量设置 · 作用于勾选中的人」：落脚三件套 + 品阶六档
export function BatchControls({ npcs, batchDistrict, setBatchDistrict, applyBatchPlacement, applyBatchTier, batchBtn, flexShrink = false }) {
  if (!npcs.length) return null;
  return (
    <div style={{ ...(flexShrink ? { flexShrink: 0 } : null), marginBottom: 10, padding: "8px 9px", borderRadius: 0, background: "rgba(0,0,0,.2)", border: "1px solid var(--bg-card)" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>批量设置 · 作用于勾选中的人</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
        <span style={{ fontSize: 10, color: "var(--text-dim)", width: 26 }}>落脚</span>
        <select value={batchDistrict} onChange={e => setBatchDistrict(e.target.value)}
          style={{ fontSize: 10.5, padding: "2px 4px", background: "var(--bg-deep)", color: "#d8c8a0", border: "1px solid var(--border-deep)", borderRadius: 0, maxWidth: 100 }}>
          {PLANNABLE_DISTRICTS.map(d => <option key={d} value={d} style={{ background: "var(--bg-deep)" }}>{d}</option>)}
        </select>
        <TapSpan onClick={() => applyBatchPlacement("resident", batchDistrict)} title={`勾选的人全部驻场于${batchDistrict}`} baseStyle={batchBtn}>全驻此地</TapSpan>
        <TapSpan onClick={() => applyBatchPlacement("wander", batchDistrict)} title="勾选的人全部改为游走" baseStyle={batchBtn}>全游走</TapSpan>
        <TapSpan onClick={() => applyBatchPlacement("mention", null)} title="勾选的人全部改为不落地（只被提到时注入）" baseStyle={batchBtn}>全不落地</TapSpan>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--text-dim)", width: 26 }}>品阶</span>
        {["白", "绿", "蓝", "紫", "橙", "红"].map((label, lv) => (
          <TapSpan key={lv} onClick={() => applyBatchTier(lv)} title={`勾选的人全部调到${label}档`} baseStyle={batchBtn}>{label}</TapSpan>
        ))}
      </div>
    </div>
  );
}

// 规划/配装进度。只在跑过之后出现，跑完留着当结果条。两个 AI 操作不会同时
// 跑（都走令牌桶），共用这一条：谁在跑显示谁的进度与消息。
export function AiProgress({ planBusy, planMsg, planProg, equipBusy, equipMsg, equipProg }) {
  if (!(planBusy || planMsg || equipBusy || equipMsg)) return null;
  const busy = equipBusy || planBusy;
  const showEquip = equipBusy || (!planBusy && !!equipMsg);
  const prog = showEquip ? equipProg : planProg;
  const msg = showEquip ? equipMsg : planMsg;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ height: 3, borderRadius: 0, overflow: "hidden", background: "rgba(0,0,0,.45)", marginBottom: 5 }}>
        <div style={{ height: "100%", width: `${Math.round(prog * 100)}%`, background: "linear-gradient(90deg,#4a6a48,#9ac088)", transition: "width .35s ease" }} />
      </div>
      <div style={{ fontSize: 10.5, color: busy ? "#bce8ac" : "#cabfa0", textShadow: "0 1px 2px rgba(0,0,0,.85)" }}>{msg}</div>
    </div>
  );
}

// AI 一键规划落脚 + AI 一键配装备。districtNote 是常规分支多出的那句
// 「据点只能从本作地图里选」（向导 Step2 的提示里没有这句）。
export function PlanEquipButtons({ npcCount, planBusy, planAll, equipBusy, equipAll, districtNote = "" }) {
  return (
    <>
      <span onClick={planBusy ? undefined : planAll}
        title={`让 AI 按人设判断每个人该驻场还是游走。${npcCount} 人分 ${Math.ceil(npcCount / PLAN_BATCH)} 批，${districtNote}规划完你还能自己改`}
        style={{
          cursor: planBusy ? "wait" : "pointer", userSelect: "none",
          fontSize: 12, padding: "6px 14px", borderRadius: 0, whiteSpace: "nowrap",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: planBusy ? "#7a8a78" : "#cdeebf", textShadow: "0 1px 2px rgba(0,0,0,.85)",
          border: `1px solid ${planBusy ? "#3a4a38" : "#5f8256"}`,
          background: planBusy ? "rgba(0,0,0,.3)"
            : "linear-gradient(180deg,rgba(74,120,64,.55),rgba(0,0,0,.5))",
        }}>
        <img src={S("ui/star.webp")} alt="" style={{ width: 13, height: 13, opacity: planBusy ? .4 : .9 }} />
        {planBusy ? "正在相地…" : "AI 一键规划落脚"}
      </span>
      <span onClick={equipBusy ? undefined : equipAll}
        title={`让 AI 按每个人的身份与品阶配 2-4 件随身物。${npcCount} 人分 ${Math.ceil(npcCount / PLAN_BATCH)} 批，配完你还能自己改`}
        style={{
          cursor: equipBusy ? "wait" : "pointer", userSelect: "none",
          fontSize: 12, padding: "6px 14px", borderRadius: 0, whiteSpace: "nowrap",
          display: "inline-flex", alignItems: "center", gap: 6,
          color: equipBusy ? "#6a807c" : "#b4ecdc", textShadow: "0 1px 2px rgba(0,0,0,.85)",
          border: `1px solid ${equipBusy ? "#3a4a48" : "#4f807a"}`,
          background: equipBusy ? "rgba(0,0,0,.3)"
            : "linear-gradient(180deg,rgba(60,130,120,.55),rgba(0,0,0,.5))",
        }}>
        <img src={S("ui/star.webp")} alt="" style={{ width: 13, height: 13, opacity: equipBusy ? .4 : .9 }} />
        {equipBusy ? "正在配装…" : "AI 一键配装备"}
      </span>
    </>
  );
}

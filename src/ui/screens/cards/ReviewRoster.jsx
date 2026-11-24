// 入册 · 游戏中常规分支（从 ReviewPane.jsx 拆出）
// 4:6 分栏：左勾选名单 + 批量设置 + 运行日志，右 ReviewNpc 全字段 + 底栏操作。
import React from "react";
import { normalizePlacement } from "../../../domain/rules/cards/importedRegistry.js";
import { S, Bar, JadeTier, Btn, Terminal, barFrame } from "./widgets.jsx";
import { BatchControls, AiProgress, PlanEquipButtons } from "./ReviewBatch.jsx";
import ReviewNpc from "./ReviewNpc.jsx";

export default function ReviewRoster({
  result, accent, detail, setDetail, patchNpc, onBack, onFinish, term, onExpandTerm,
  apiCfg, cardImage, currentDistrict, cur,
  picked, allOn, toggleOne, toggleAll, pickedNpcs, placedCount,
  batchDistrict, setBatchDistrict, applyBatchPlacement, applyBatchTier, batchBtn,
  planBusy, planMsg, planProg, planAll, equipBusy, equipMsg, equipProg, equipAll, dropped,
}) {
  return (
        /* ── 游戏中常规入册：直接选 NPC 逐个设置（4:6 分栏） ── */
        <>
          {/* 4:6 分栏。原来左栏定宽 230px，那是面板还锁在 1120 宽时定的比例；撑满
              之后名单挤在一条窄带里，而运行日志横向被压得每行都折。minWidth 0 是必须
              的——flex 子项默认 min-width:auto，里面的长人名会把栏撑破 4:6 的比例。 */}
          <div style={{ flex: 4, minWidth: 0, borderRight: "1px solid var(--bg-card)", display: "flex", flexDirection: "column" }}>
            <Bar>过目定稿 · 逐个设置</Bar>

            {/* 名单垂直居中：一张卡常见三五个人，顶部对齐会在下面留一大片死黑。
                margin auto 0 而不是 justifyContent center——后者在内容超出容器时会把
                顶部裁掉滚不到（flex 的老陷阱）。外层再 alignSelf center 加限宽，免得
                4:6 分栏后条目在一千像素宽的栏里拉得很散。 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column" }}>
              <BatchControls npcs={result.npcs} batchDistrict={batchDistrict} setBatchDistrict={setBatchDistrict}
                  applyBatchPlacement={applyBatchPlacement} applyBatchTier={applyBatchTier} batchBtn={batchBtn} flexShrink />
              <div style={{ margin: "auto 0", width: "100%", maxWidth: 380, alignSelf: "center" }}>
              {result.npcs.map((n, i) => {
                return (
                <div key={i} onClick={() => setDetail(i)}
                  style={{
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                    padding: "6px 8px", borderRadius: 0, marginBottom: 3,
                    background: detail === i ? "rgba(212,168,83,.12)" : "transparent",
                    borderLeft: `2px solid ${detail === i ? accent : "transparent"}`,
                    opacity: picked.has(i) ? 1 : .45,
                  }}>
                  <span onClick={e => { e.stopPropagation(); toggleOne(i); }}
                    title={picked.has(i) ? "点掉就不加入" : "点上加入"}
                    style={{
                      cursor: "pointer", flexShrink: 0, width: 14, textAlign: "center",
                      fontSize: 12, color: picked.has(i) ? accent : "var(--border)",
                    }}>{picked.has(i) ? "◉" : "○"}</span>
                  <JadeTier value={n.levelCap} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--paper)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.name}
                    </div>
                    <div style={{ color: "var(--text-dim)", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
                  </div>
                  {(() => {
                    const pl = normalizePlacement(n.placement);
                    const m = pl.mode;
                    if (m === "mention") return null;
                    const label = m === "resident"
                      ? `驻·${pl.district}`
                      : `游·${Object.keys(pl.weights).length}处`;
                    return <span title={m === "resident" ? `驻场于${pl.district}` : "按权重游走"}
                      style={{ fontSize: "var(--fs-2xs)", color: accent, flexShrink: 0 }}>{label}</span>;
                  })()}
                  {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>默</span>}
                </div>
                );
              })}
              </div>
            </div>
            <Terminal lines={term} height="min(30vh, 320px)" onExpand={onExpandTerm} />
          </div>

          <div style={{ flex: 6, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Bar right={result.genre ? <span style={{ fontSize: "var(--fs-2xs)", color: "var(--muted)" }}>{result.genre}</span> : null}>
              {cur ? cur.name : "过目定稿"}
            </Bar>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 28px" }}>
              {cur ? (
                <ReviewNpc npc={cur} accent={accent} dropped={dropped} apiCfg={apiCfg} cardImage={cardImage}
                  currentDistrict={currentDistrict}
                  onPatch={patch => patchNpc(detail, patch)} />
              ) : (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.9, padding: "4px 4px", textAlign: "center" }}>
                  在左边点一个人，逐个设置他的品阶、招式、随身物、落脚。
                </div>
              )}
            </div>

            <div style={{
              ...barFrame(S("ui/bar_paper2.webp")),
              padding: "8px 12px",
            }}>
              <AiProgress planBusy={planBusy} planMsg={planMsg} planProg={planProg}
                  equipBusy={equipBusy} equipMsg={equipMsg} equipProg={equipProg} />

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
                <Btn onClick={onBack} tone="dim">← 回名单</Btn>
                <span onClick={toggleAll} title="一次勾上或取消全部"
                  style={{
                    cursor: "pointer", userSelect: "none", fontSize: 11.5,
                    padding: "6px 12px", borderRadius: 0, whiteSpace: "nowrap",
                    border: `1px solid ${allOn ? accent : "var(--ink-wood-edge)"}`,
                    background: "rgba(0,0,0,.3)",
                    color: allOn ? accent : "var(--qb-text-dim)", textShadow: "0 1px 2px rgba(0,0,0,.85)",
                  }}>{allOn ? "◉ 全不选" : "○ 全选"}</span>

                <PlanEquipButtons npcCount={result.npcs.length} planBusy={planBusy} planAll={planAll}
                  equipBusy={equipBusy} equipAll={equipAll} districtNote="据点只能从本作地图里选，" />

                <span style={{ flex: 1 }} />
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--qb-text-dim)", textShadow: "0 1px 2px rgba(0,0,0,.85)" }}>
                  入 {pickedNpcs.length}／{result.npcs.length} 人
                  {placedCount ? `（${placedCount} 人会真的出现）` : "（都只在被提到时注入）"}
                </span>
                <Btn onClick={() => onFinish(pickedNpcs)} tone="main"
                  disabled={!pickedNpcs.length}
                  title={pickedNpcs.length ? `把 ${pickedNpcs.length} 人写进江湖` : "一个人都没选"}>
                  <img src={S("ui/hammer.webp")} alt="" style={{ width: 14, verticalAlign: "-2px", marginRight: 5 }} />
                  加入 {pickedNpcs.length} 人
                </Btn>
              </div>
            </div>
          </div>
        </>
  );
}

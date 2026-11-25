// 入册 · 开局向导分支（从 ReviewPane.jsx 拆出）
// 四步向导：选主角 → 设置主角 → 选 NPC 逐个调 → 同行落册。
// 步骤导航与跳转逻辑由 ReviewPane 的状态下发，本文件只管展示。
import React from "react";
import { normalizePlacement } from "../../../domain/rules/cards/importedRegistry.js";
import { S, Bar, JadeTier, Btn, barFrame } from "./widgets.jsx";
import { BatchControls, AiProgress, PlanEquipButtons } from "./ReviewBatch.jsx";
import ReviewNpc from "./ReviewNpc.jsx";
import ReviewPlayer from "./ReviewPlayer.jsx";

export default function ReviewWizard({
  parsed, result, accent, detail, setDetail, patchNpc, patchPlayer, patchWorld,
  setResult, onBack, onFinish, apiCfg, cardImage, currentDistrict,
  WIZARD_STEPS, wizardStep, setWizardStep, nextStep, prevStep,
  playerFromNpc, bodyBusy, pickPlayerFrom,
  picked, toggleOne, pickedNpcs, placedCount, curNpc,
  starterCompanion, setStarterCompanion,
  batchDistrict, setBatchDistrict, applyBatchPlacement, applyBatchTier, batchBtn,
  planBusy, planMsg, planProg, planAll, equipBusy, equipMsg, equipProg, equipAll, dropped,
}) {
  return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* 步骤导航条 */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
            padding: "8px 12px", borderBottom: "1px solid var(--bg-card)",
            background: "rgba(0,0,0,.25)",
          }}>
            {WIZARD_STEPS.map((s, idx) => (
              <span key={s}
                onClick={() => setWizardStep(idx)}
                style={{
                  cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 7,
                  padding: "5px 12px", borderRadius: 0, transition: "all .15s ease",
                  border: `1px solid ${wizardStep === idx ? accent : "transparent"}`,
                  background: wizardStep === idx ? "rgba(212,168,83,.12)" : "transparent",
                  color: wizardStep === idx ? accent : "var(--muted)",
                }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "var(--fs-xs)", flexShrink: 0,
                  background: wizardStep === idx ? "rgba(212,168,83,.2)" : "rgba(0,0,0,.3)",
                  border: `1px solid ${wizardStep === idx ? accent : "var(--border-deep)"}`,
                }}>{idx + 1}</span>
                <span style={{ fontSize: "var(--fs-sm)", letterSpacing: 1 }}>{s}</span>
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>
              {playerFromNpc ? `主角：${playerFromNpc}` : "主角：待定"}
            </span>
          </div>

          {/* 主内容区 */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            {wizardStep === 0 && (
              /* ── ① 选主角：从认出的 NPC 里挑谁当主角 ── */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <div style={{ fontSize: "var(--fs-base)", color: "var(--paper)", letterSpacing: 3, marginBottom: 4 }}>
                  这张卡里，谁当「我自己」（主角）？
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 16, lineHeight: 1.8 }}>
                  群像卡的主角常常混在世界书里。选一个人就把他套成主角档案（名字/七维/内外功/人设），
                  他会自动从「入江湖」名单挪走，不会重复出现。不选就用空白档案，下一步自己填。
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  <div onClick={() => pickPlayerFrom(null)} title="从头手写主角"
                    style={{
                      cursor: "pointer", padding: "14px 12px", borderRadius: 0, textAlign: "center",
                      border: `1px solid ${playerFromNpc == null ? accent : "var(--border-deep)"}`,
                      background: playerFromNpc == null ? "rgba(212,168,83,.12)" : "rgba(0,0,0,.25)",
                      transition: "all .15s ease",
                    }}>
                    <div style={{ fontSize: "var(--fs-xl)", marginBottom: 6 }}>☯</div>
                    <div style={{ color: playerFromNpc == null ? accent : "var(--quest-stage-desc)", fontSize: "var(--fs-md)" }}>空白 · 自己填</div>
                  </div>
                  {result.npcs.map((n, i) => {
                    const on = playerFromNpc === n.name;
                    return (
                      <div key={i} onClick={() => pickPlayerFrom(n.name)}
                        style={{
                          cursor: "pointer", padding: "12px", borderRadius: 0,
                          border: `1px solid ${on ? accent : "var(--border-deep)"}`,
                          background: on ? "rgba(212,168,83,.12)" : "rgba(0,0,0,.25)",
                          transition: "all .15s ease",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <JadeTier value={n.levelCap} size={22} />
                          <span style={{ color: on ? accent : "var(--paper)", fontSize: "var(--fs-md)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n.name}
                          </span>
                          {on && <span style={{ color: accent, fontSize: "var(--fs-xs)" }}>◉</span>}
                        </div>
                        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", lineHeight: 1.6, minHeight: 30 }}>
                          {n.brief || "（无身份）"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {bodyBusy && (
                  <div style={{ marginTop: 12, fontSize: "var(--fs-xs)", color: "var(--quest-success-text)" }}>⏳ 正在让 AI 从外貌拆出体貌 7 项…</div>
                )}
              </div>
            )}

            {wizardStep === 1 && (
              /* ── ② 设置主角：全字段 + 体貌(选主角时已 AI 扫入) + AI 现编武学 + AI 配装备 ── */
              <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "12px 20px 28px" }}>
                <ReviewPlayer
                  player={result.player} accent={accent} apiCfg={apiCfg}
                  onPatch={patchPlayer}
                  opening={result.opening}
                  onPatchOpening={o => setResult(r => ({ ...r, opening: o }))}
                  worldCandidates={result.world}
                  onPatchWorld={patchWorld}
                  cardPersonality={parsed?.card?.fields?.personality || ""}
                  cardMesExample={parsed?.card?.fields?.mesExample || ""}
                />
                {bodyBusy && (
                  <div style={{ marginTop: 10, fontSize: "var(--fs-xs)", color: "var(--quest-success-text)" }}>⏳ 正在让 AI 从外貌拆出体貌（公开＋私密）…</div>
                )}
              </div>
            )}

            {wizardStep === 2 && (
              /* ── ③ 选 NPC 入江湖 · 逐个调：左勾选名单+批量，右 ReviewNpc 全字段 ── */
              <>
                <div style={{ flex: 2, minWidth: 0, borderRight: "1px solid var(--bg-card)", display: "flex", flexDirection: "column" }}>
                  <Bar right={<span style={{ fontSize: "var(--fs-2xs)", color: "var(--muted)" }}>{pickedNpcs.length}/{result.npcs.length} 人</span>}>
                    选谁入江湖 · 点开逐个调
                  </Bar>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", lineHeight: 1.8, marginBottom: 8 }}>
                      勾选的人会真的落进曲措乡（可结交切磋）。点名字在右边逐个调他的品阶/招式/随身物/落脚。开局同行下一步再选。
                    </div>

                    {/* 批量设置（落脚/品阶），复用原有逻辑 */}
                    <BatchControls npcs={result.npcs} batchDistrict={batchDistrict} setBatchDistrict={setBatchDistrict}
                      applyBatchPlacement={applyBatchPlacement} applyBatchTier={applyBatchTier} batchBtn={batchBtn} />

                    {/* 名单：勾选是否入江湖 + 点名字进右栏逐个调 */}
                    {result.npcs.map((n, i) => {
                      const isPlayerSrc = playerFromNpc != null && n.name === playerFromNpc;
                      const on = picked.has(i);
                      const sel = detail === i && !isPlayerSrc;
                      const pl = normalizePlacement(n.placement);
                      return (
                        <div key={i} onClick={() => { if (!isPlayerSrc) setDetail(i); }}
                          title={isPlayerSrc ? "已作主角" : "点开逐个调"}
                          style={{
                            display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                            borderRadius: 0, marginBottom: 3, cursor: isPlayerSrc ? "default" : "pointer",
                            background: sel ? "rgba(212,168,83,.12)" : "transparent",
                            borderLeft: `2px solid ${sel ? accent : "transparent"}`,
                            opacity: isPlayerSrc ? .8 : (on ? 1 : .45),
                          }}>
                          {isPlayerSrc ? (
                            <span title="已作主角"
                              style={{ flexShrink: 0, width: 14, textAlign: "center", fontSize: "var(--fs-xs)", color: accent }}>主</span>
                          ) : (
                            <span onClick={e => { e.stopPropagation(); toggleOne(i); }}
                              title={on ? "点掉就不加入" : "点上加入"}
                              style={{
                                cursor: "pointer", flexShrink: 0, width: 14, textAlign: "center",
                                fontSize: "var(--fs-sm)", color: on ? accent : "var(--border)",
                              }}>{on ? "◉" : "○"}</span>
                          )}
                          <JadeTier value={n.levelCap} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "var(--paper)", fontSize: "var(--fs-sm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {n.name}{isPlayerSrc && <span style={{ color: accent, fontSize: "var(--fs-2xs)", marginLeft: 5 }}>· 主角</span>}
                            </div>
                            <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
                          </div>
                          {!isPlayerSrc && pl.mode !== "mention" && (
                            <span title={pl.mode === "resident" ? `驻场于${pl.district}` : "按权重游走"}
                              style={{ fontSize: "var(--fs-2xs)", color: accent, flexShrink: 0 }}>
                              {pl.mode === "resident" ? `驻·${pl.district}` : `游·${Object.keys(pl.weights).length}处`}
                            </span>
                          )}
                          {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", flexShrink: 0 }}>默</span>}
                        </div>
                      );
                    })}
                    {!result.npcs.length && (
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", padding: "12px 0", textAlign: "center" }}>
                        这张卡里没有其他人了，就你自己开局。
                      </div>
                    )}
                  </div>
                </div>
                {/* 右：点开谁就编辑谁（复用 ReviewNpc 全字段：品阶/招式/随身物/立绘/落脚）*/}
                <div style={{ flex: 3, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <Bar>{curNpc ? curNpc.name : "逐个设置"}</Bar>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 28px" }}>
                    {curNpc ? (
                      <ReviewNpc npc={curNpc} accent={accent} dropped={dropped} apiCfg={apiCfg} cardImage={cardImage}
                        currentDistrict={currentDistrict}
                        onPatch={patch => patchNpc(detail, patch)} />
                    ) : (
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.9, padding: "12px 4px", textAlign: "center" }}>
                        {result.npcs.length ? "在左边点一个人的名字，逐个设置他的品阶、招式、随身物、落脚。" : "这张卡里没有其他人，直接下一步选同行 / 落册。"}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {wizardStep === 3 && (
              /* ── ④ 同行 · 落册：从入江湖的人里指定开局同行 + 总览 + 加入 ── */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                <div style={{ fontSize: "var(--fs-base)", color: "var(--paper)", letterSpacing: 3, marginBottom: 10 }}>选开局同行 · 落册</div>

                {/* 开局同行：从入江湖的人里指定 1 人随队（唯一出战位）*/}
                <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 0, background: "rgba(138,176,112,.06)", border: "1px solid var(--music-idle-icon)" }}>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--ci-pick)", marginBottom: 4 }}>谁与你一起同行（初始队友）</div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 8, lineHeight: 1.7 }}>
                    从入江湖的人里指定 1 人开局就随队（唯一出战位）；其余同伴后续可在游戏里邀请。不选也行。
                  </div>
                  {pickedNpcs.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {pickedNpcs.map((n, i) => {
                        const isStarter = starterCompanion === n.name;
                        return (
                          <span key={i} onClick={() => setStarterCompanion(isStarter ? null : n.name)}
                            title={isStarter ? "点掉就不随队" : "让他开局就随队"}
                            style={{
                              cursor: "pointer", userSelect: "none", fontSize: "var(--fs-sm)", padding: "4px 11px", borderRadius: 0,
                              border: `1px solid ${isStarter ? "var(--green-soft)" : "var(--music-idle-icon)"}`,
                              color: isStarter ? "var(--ci-pick)" : "var(--tutorial-move)",
                              background: isStarter ? "rgba(138,176,112,.15)" : "rgba(0,0,0,.2)",
                            }}>{isStarter ? "◉ " : "○ "}{n.name}</span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>还没勾选入江湖的人，就你自己开局。</div>
                  )}
                </div>

                <div style={{ fontSize: "var(--fs-md)", color: "var(--paper)", letterSpacing: 2, marginBottom: 12 }}>确认落册</div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 0, background: "rgba(212,168,83,.06)", border: `1px solid color-mix(in srgb, ${accent} 27%, transparent)` }}>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-tan)", marginBottom: 6 }}>主角</div>
                  <div style={{ fontSize: "var(--fs-md)", color: "var(--paper)" }}>
                    {result.player?.name || playerFromNpc || "（未填名讳）"}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: 4, lineHeight: 1.8 }}>
                    体貌公开 {Object.values(result.player?.bodyProfile || {}).filter(v => (v || "").trim()).length}/7 项
                    · 私密 {Object.values(result.player?.bodyProfilePrivate || {}).filter(v => (v || "").trim()).length}/5 项
                    · {result.player?.gender || "性别未定"}
                    · 武学 {(result.player?.skills || []).length} 门
                    · 装备 {(result.player?.carry || []).length} 件
                  </div>
                </div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 0, background: "rgba(0,0,0,.2)", border: "1px solid var(--bg-card)" }}>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-tan)", marginBottom: 6 }}>
                    落江湖 {pickedNpcs.length} 人
                    {placedCount ? `（${placedCount} 人会真的出现）` : "（都只在被提到时注入）"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {pickedNpcs.map((n, i) => (
                      <span key={i} style={{ fontSize: "var(--fs-xs)", padding: "3px 9px", borderRadius: 0,
                      border: `1px solid ${starterCompanion === n.name ? "var(--green-soft)" : "var(--border-deep)"}`,
                      color: starterCompanion === n.name ? "var(--ci-pick)" : "var(--text)",
                      background: starterCompanion === n.name ? "rgba(138,176,112,.15)" : "rgba(0,0,0,.2)", }}>
                        {n.name}
                        {starterCompanion === n.name ? " · 开局同行" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", lineHeight: 1.9 }}>
                  {result.opening ? "将带上一段改写好的开场白。" : "没有开场白。"}
                  开局同行会以唯一出战位随队，其余同伴后续可在游戏里邀请。
                </div>
              </div>
            )}
          </div>

          {/* 底部：上一步 / 下一步 / 加入 */}
          <div style={{
            flexShrink: 0,
            ...barFrame(S("ui/bar_paper2.webp")),
            padding: "8px 12px",
          }}>
            <AiProgress planBusy={planBusy} planMsg={planMsg} planProg={planProg}
                  equipBusy={equipBusy} equipMsg={equipMsg} equipProg={equipProg} />

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
              {wizardStep === 0 && (
                <Btn onClick={onBack} tone="dim">← 回名单</Btn>
              )}
              {wizardStep > 0 && (
                <Btn onClick={prevStep} tone="dim">← 上一步</Btn>
              )}

              {/* AI 一键规划落脚 / 配装备，只在「选 NPC · 逐个调」那步给（Step2，作用于全部 NPC）*/}
              {wizardStep === 2 && (
                <PlanEquipButtons npcCount={result.npcs.length} planBusy={planBusy} planAll={planAll}
                    equipBusy={equipBusy} equipAll={equipAll} />
              )}

              <span style={{ flex: 1 }} />

              {wizardStep < 3 ? (
                <Btn onClick={nextStep} tone="main">
                  下一步 →
                </Btn>
              ) : (
                <Btn onClick={() => onFinish(pickedNpcs, starterCompanion)} tone="main"
                  disabled={!pickedNpcs.length && !result.player}
                  title={pickedNpcs.length ? `把 ${pickedNpcs.length} 人写进江湖，加入游戏` : "一个人都没选"}>
                  <img src={S("ui/hammer.webp")} alt="" style={{ width: 14, verticalAlign: "-2px", marginRight: 5 }} />
                  加入 · 开始游戏
                </Btn>
              )}
            </div>
          </div>
        </div>
  );
}

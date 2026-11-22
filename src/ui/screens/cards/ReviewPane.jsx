// 入册 · 过目定稿（从 CardImportScreen.jsx 拆出）
// 这一层只做分派：顶上选「众人／我自己」，右边挂 ReviewNpc 或 ReviewPlayer。
// 全字段的排布在那两个文件里，各自照映射表的顺序走；AI 批操作与「选主角」
// 逻辑收在 useReviewOps.js。
import React, { useState } from "react";
import { normalizePlacement } from "../../../domain/rules/cards/importedRegistry.js";
import { PLAN_BATCH, PLANNABLE_DISTRICTS } from "../../../domain/rules/cards/placementPlan.js";
import { S, Bar, JadeTier, Btn, Terminal, barFrame, TapSpan } from "./widgets.jsx";
import { useReviewOps } from "./useReviewOps.js";
import ReviewNpc from "./ReviewNpc.jsx";
import ReviewPlayer from "./ReviewPlayer.jsx";

export default function ReviewPane({
  parsed, result, accent, detail, setDetail, patchNpc, patchPlayer, patchWorld,
  setResult, asPlayer, onBack, onFinish, term, onExpandTerm, apiCfg, cardImage,
  currentDistrict, autoPlace = false,
}) {
  const cur = detail >= 0 ? result.npcs[detail] : null;

  // 哪几个人真的要加入。默认全勾——一张卡扫出来的人多半都是想要的，让玩家取消
  // 个别几个，比让他从零勾起省事。
  const [picked, setPicked] = useState(() => new Set(result.npcs.map((_, i) => i)));
  const allOn = picked.size === result.npcs.length && result.npcs.length > 0;
  const toggleOne = (i) => setPicked(p => {
    const n = new Set(p);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(result.npcs.map((_, i) => i)));

  // ── 开局向导 · 分步（仅 playerMode）────────────────────────────────────
  // 借鉴「墨色江湖」开局向导骨架：左侧步骤导航 + 主内容区 + 上一步/下一步。
  // 三步：① 选主角 → ② 调主角·选队友 → ③ 确认落册。步骤定义与跳转集中在这，
  // 内容区按 wizardStep 条件渲染。
  const WIZARD_STEPS = ["选主角", "设置主角", "选NPC · 逐个调", "同行 · 落册"];
  const [wizardStep, setWizardStep] = useState(0);
  // 开局同行：Step2 里从「落江湖的 NPC」指定 1 人开局就随队（companion 出战位）。
  // 存名字即可，落册时在 CardImportScreen.finish 里把它单独交给 onImportStarterCompanion。
  const [starterCompanion, setStarterCompanion] = useState(null);
  const stepLabel = WIZARD_STEPS[wizardStep] || "确认落册";
  const canNext = !asPlayer || wizardStep >= 2 || (wizardStep === 0 ? true : true);
  const nextStep = () => setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
  const prevStep = () => setWizardStep(s => Math.max(s - 1, 0));

  const {
    playerFromNpc, bodyBusy, pickPlayerFrom,
    planBusy, planMsg, planProg, planAll,
    equipBusy, equipMsg, equipProg, equipAll,
    dropped,
  } = useReviewOps({ result, setResult, apiCfg, patchNpc, parsed, autoPlace });
  const pickedNpcs = result.npcs.filter((n, i) => picked.has(i) && n.name !== playerFromNpc);
  // 「会真的出现」只统计勾选中的——没勾的人压根不进库，算进去是虚报
  const placedCount = pickedNpcs.filter(x => normalizePlacement(x.placement).mode !== "mention").length;
  // 向导「选 NPC · 逐个调」右栏当前编辑的人：被选为主角的那位不当 NPC 编辑（他走主角档案）
  const curNpc = cur && cur.name !== playerFromNpc ? cur : null;

  // ── 名单批量：不必逐个点开，勾一批人一键设落脚/品阶 ─────────────────────
  // 招式路数因人而异没法一键套（那个逐个点开在右栏 MoveEditor 里定），但落脚与
  // 品阶是最费手的两项——一张卡的人常常同属一个据点、或该整体拔高一档，批量最省事。
  const [batchDistrict, setBatchDistrict] = useState(() =>
    (currentDistrict && PLANNABLE_DISTRICTS.includes(currentDistrict)) ? currentDistrict : PLANNABLE_DISTRICTS[0]);
  // 只改勾选中、且不是被选为主角的那些人
  const forEachPickedNpc = (fn) => setResult(r => ({
    ...r, npcs: r.npcs.map((n, i) => (picked.has(i) && n.name !== playerFromNpc) ? fn(n) : n),
  }));
  const applyBatchPlacement = (mode, district) => forEachPickedNpc(n => {
    let placement;
    if (mode === "resident") placement = { mode: "resident", district, innerRoom: null, weights: {}, timeSlot: [0, 23] };
    else if (mode === "wander") placement = { mode: "wander", district: null, innerRoom: null, weights: district ? { [district]: 75 } : {}, timeSlot: [0, 23] };
    else placement = { mode: "mention", district: null, innerRoom: null, weights: {}, timeSlot: [0, 23] };
    return { ...n, placement, placementWhy: "手动批量设", placementRejected: false };
  });
  const applyBatchTier = (levelCap) => forEachPickedNpc(n => ({ ...n, levelCap }));
  const batchBtn = {
    cursor: "pointer", fontSize: 10.5, padding: "2px 8px", borderRadius: 0,
    border: "1px solid var(--border-deep)", color: "#a89870", userSelect: "none",
  };

  return (
    <>
      {/* 开局向导：顶部步骤导航（仿墨色江湖 wizard 骨架）+ 主内容区 + 上一步/下一步 */}
      {asPlayer ? (
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
                  justifyContent: "center", fontSize: 10.5, flexShrink: 0,
                  background: wizardStep === idx ? "rgba(212,168,83,.2)" : "rgba(0,0,0,.3)",
                  border: `1px solid ${wizardStep === idx ? accent : "var(--border-deep)"}`,
                }}>{idx + 1}</span>
                <span style={{ fontSize: 12.5, letterSpacing: 1 }}>{s}</span>
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
              {playerFromNpc ? `主角：${playerFromNpc}` : "主角：待定"}
            </span>
          </div>

          {/* 主内容区 */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            {wizardStep === 0 && (
              /* ── ① 选主角：从认出的 NPC 里挑谁当主角 ── */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <div style={{ fontSize: 15, color: "var(--paper)", letterSpacing: 3, marginBottom: 4 }}>
                  这张卡里，谁当「我自己」（主角）？
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16, lineHeight: 1.8 }}>
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
                    <div style={{ fontSize: 22, marginBottom: 6 }}>☯</div>
                    <div style={{ color: playerFromNpc == null ? accent : "#a89870", fontSize: 13 }}>空白 · 自己填</div>
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
                          <span style={{ color: on ? accent : "var(--paper)", fontSize: 13, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n.name}
                          </span>
                          {on && <span style={{ color: accent, fontSize: 11 }}>◉</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6, minHeight: 30 }}>
                          {n.brief || "（无身份）"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {bodyBusy && (
                  <div style={{ marginTop: 12, fontSize: 11, color: "#7a9a70" }}>⏳ 正在让 AI 从外貌拆出体貌 7 项…</div>
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
                  <div style={{ marginTop: 10, fontSize: 11, color: "#7a9a70" }}>⏳ 正在让 AI 从外貌拆出体貌（公开＋私密）…</div>
                )}
              </div>
            )}

            {wizardStep === 2 && (
              /* ── ③ 选 NPC 入江湖 · 逐个调：左勾选名单+批量，右 ReviewNpc 全字段 ── */
              <>
                <div style={{ flex: 2, minWidth: 0, borderRight: "1px solid var(--bg-card)", display: "flex", flexDirection: "column" }}>
                  <Bar right={<span style={{ fontSize: 10, color: "var(--muted)" }}>{pickedNpcs.length}/{result.npcs.length} 人</span>}>
                    选谁入江湖 · 点开逐个调
                  </Bar>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.8, marginBottom: 8 }}>
                      勾选的人会真的落进曲措乡（可结交切磋）。点名字在右边逐个调他的品阶/招式/随身物/落脚。开局同行下一步再选。
                    </div>

                    {/* 批量设置（落脚/品阶），复用原有逻辑 */}
                    {result.npcs.length > 0 && (
                      <div style={{ marginBottom: 10, padding: "8px 9px", borderRadius: 0, background: "rgba(0,0,0,.2)", border: "1px solid var(--bg-card)" }}>
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
                    )}

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
                              style={{ flexShrink: 0, width: 14, textAlign: "center", fontSize: 11, color: accent }}>主</span>
                          ) : (
                            <span onClick={e => { e.stopPropagation(); toggleOne(i); }}
                              title={on ? "点掉就不加入" : "点上加入"}
                              style={{
                                cursor: "pointer", flexShrink: 0, width: 14, textAlign: "center",
                                fontSize: 12, color: on ? accent : "var(--border)",
                              }}>{on ? "◉" : "○"}</span>
                          )}
                          <JadeTier value={n.levelCap} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "var(--paper)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {n.name}{isPlayerSrc && <span style={{ color: accent, fontSize: 9.5, marginLeft: 5 }}>· 主角</span>}
                            </div>
                            <div style={{ color: "var(--text-dim)", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
                          </div>
                          {!isPlayerSrc && pl.mode !== "mention" && (
                            <span title={pl.mode === "resident" ? `驻场于${pl.district}` : "按权重游走"}
                              style={{ fontSize: 9, color: accent, flexShrink: 0 }}>
                              {pl.mode === "resident" ? `驻·${pl.district}` : `游·${Object.keys(pl.weights).length}处`}
                            </span>
                          )}
                          {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: 9, color: "var(--text-dim)", flexShrink: 0 }}>默</span>}
                        </div>
                      );
                    })}
                    {!result.npcs.length && (
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)", padding: "12px 0", textAlign: "center" }}>
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
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.9, padding: "12px 4px", textAlign: "center" }}>
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
                <div style={{ fontSize: 15, color: "var(--paper)", letterSpacing: 3, marginBottom: 10 }}>选开局同行 · 落册</div>

                {/* 开局同行：从入江湖的人里指定 1 人随队（唯一出战位）*/}
                <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 0, background: "rgba(138,176,112,.06)", border: "1px solid #3a4a34" }}>
                  <div style={{ fontSize: 11.5, color: "#bce8ac", marginBottom: 4 }}>谁与你一起同行（初始队友）</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8, lineHeight: 1.7 }}>
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
                              cursor: "pointer", userSelect: "none", fontSize: 11.5, padding: "4px 11px", borderRadius: 0,
                              border: `1px solid ${isStarter ? "var(--green-soft)" : "#3a4a34"}`,
                              color: isStarter ? "#bce8ac" : "#a8b8a0",
                              background: isStarter ? "rgba(138,176,112,.15)" : "rgba(0,0,0,.2)",
                            }}>{isStarter ? "◉ " : "○ "}{n.name}</span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>还没勾选入江湖的人，就你自己开局。</div>
                  )}
                </div>

                <div style={{ fontSize: 13, color: "var(--paper)", letterSpacing: 2, marginBottom: 12 }}>确认落册</div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 0, background: "rgba(212,168,83,.06)", border: `1px solid ${accent}44` }}>
                  <div style={{ fontSize: 11.5, color: "#d8c8a0", marginBottom: 6 }}>主角</div>
                  <div style={{ fontSize: 13, color: "var(--paper)" }}>
                    {result.player?.name || playerFromNpc || "（未填名讳）"}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.8 }}>
                    体貌公开 {Object.values(result.player?.bodyProfile || {}).filter(v => (v || "").trim()).length}/7 项
                    · 私密 {Object.values(result.player?.bodyProfilePrivate || {}).filter(v => (v || "").trim()).length}/5 项
                    · {result.player?.gender || "性别未定"}
                    · 武学 {(result.player?.skills || []).length} 门
                    · 装备 {(result.player?.carry || []).length} 件
                  </div>
                </div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 0, background: "rgba(0,0,0,.2)", border: "1px solid var(--bg-card)" }}>
                  <div style={{ fontSize: 11.5, color: "#d8c8a0", marginBottom: 6 }}>
                    落江湖 {pickedNpcs.length} 人
                    {placedCount ? `（${placedCount} 人会真的出现）` : "（都只在被提到时注入）"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {pickedNpcs.map((n, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "3px 9px", borderRadius: 0,
                        border: `1px solid ${starterCompanion === n.name ? "var(--green-soft)" : "var(--border-deep)"}`,
                        color: starterCompanion === n.name ? "#bce8ac" : "var(--text)",
                        background: starterCompanion === n.name ? "rgba(138,176,112,.15)" : "rgba(0,0,0,.2)",
                      }}>
                        {n.name}
                        {starterCompanion === n.name ? " · 开局同行" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.9 }}>
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
            {/* 规划/配装进度。只在跑过之后出现，跑完留着当结果条。 */}
            {(planBusy || planMsg || equipBusy || equipMsg) && (() => {
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
            })()}

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
              {wizardStep === 0 && (
                <Btn onClick={onBack} tone="dim">← 回名单</Btn>
              )}
              {wizardStep > 0 && (
                <Btn onClick={prevStep} tone="dim">← 上一步</Btn>
              )}

              {/* AI 一键规划落脚 / 配装备，只在「选 NPC · 逐个调」那步给（Step2，作用于全部 NPC）*/}
              {wizardStep === 2 && (
                <>
                  <span onClick={planBusy ? undefined : planAll}
                    title={`让 AI 按人设判断每个人该驻场还是游走。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，规划完你还能自己改`}
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
                    title={`让 AI 按每个人的身份与品阶配 2-4 件随身物。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，配完你还能自己改`}
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
      ) : (
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
              {result.npcs.length > 0 && (
                <div style={{ flexShrink: 0, marginBottom: 10, padding: "8px 9px", borderRadius: 0, background: "rgba(0,0,0,.2)", border: "1px solid var(--bg-card)" }}>
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
              )}
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
                      style={{ fontSize: 9, color: accent, flexShrink: 0 }}>{label}</span>;
                  })()}
                  {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: 9, color: "var(--text-dim)" }}>默</span>}
                </div>
                );
              })}
              </div>
            </div>
            <Terminal lines={term} height="min(30vh, 320px)" onExpand={onExpandTerm} />
          </div>

          <div style={{ flex: 6, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Bar right={result.genre ? <span style={{ fontSize: 10, color: "var(--muted)" }}>{result.genre}</span> : null}>
              {cur ? cur.name : "过目定稿"}
            </Bar>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 28px" }}>
              {cur ? (
                <ReviewNpc npc={cur} accent={accent} dropped={dropped} apiCfg={apiCfg} cardImage={cardImage}
                  currentDistrict={currentDistrict}
                  onPatch={patch => patchNpc(detail, patch)} />
              ) : (
                <div style={{ fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.9, padding: "4px 4px", textAlign: "center" }}>
                  在左边点一个人，逐个设置他的品阶、招式、随身物、落脚。
                </div>
              )}
            </div>

            <div style={{
              ...barFrame(S("ui/bar_paper2.webp")),
              padding: "8px 12px",
            }}>
              {/* 规划/配装进度。只在跑过之后出现，跑完留着当结果条。两个 AI 操作不会同时
                  跑（都走令牌桶），共用这一条：谁在跑显示谁的进度与消息。 */}
              {(planBusy || planMsg || equipBusy || equipMsg) && (() => {
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
              })()}

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
                <Btn onClick={onBack} tone="dim">← 回名单</Btn>
                <span onClick={toggleAll} title="一次勾上或取消全部"
                  style={{
                    cursor: "pointer", userSelect: "none", fontSize: 11.5,
                    padding: "6px 12px", borderRadius: 0, whiteSpace: "nowrap",
                    border: `1px solid ${allOn ? accent : "#5a5038"}`,
                    background: "rgba(0,0,0,.3)",
                    color: allOn ? accent : "#cabfa0", textShadow: "0 1px 2px rgba(0,0,0,.85)",
                  }}>{allOn ? "◉ 全不选" : "○ 全选"}</span>

                {/* AI 一键规划落脚。据点从本作地图里选，回来的东西过白名单，玩家再改 */}
                <span onClick={planBusy ? undefined : planAll}
                  title={`让 AI 按人设判断每个人该驻场还是游走。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，据点只能从本作地图里选，规划完你还能自己改`}
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

                {/* AI 一键配装备。按人设/品阶配随身物，产出过 sanitizeCarryPlan，玩家可再改 */}
                <span onClick={equipBusy ? undefined : equipAll}
                  title={`让 AI 按每个人的身份与品阶配 2-4 件随身物。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，配完你还能自己改`}
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

                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "#cabfa0", textShadow: "0 1px 2px rgba(0,0,0,.85)" }}>
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
      )}
    </>
  );
}

// 角色入册 —— 角色卡导入界面
// ============================================================================
// 三段流程：拖卡（empty）→ 归类与勾选（parsed/scanning）→ 过目定稿（review）。
// 审改那一段按「导入映射表」的顺序覆盖全字段，NPC 与玩家各一套，拆到
// ReviewNpc.jsx / ReviewPlayer.jsx；共用零件在 ReviewParts.jsx。
//
// 【AI 扫描是按钮不是关卡】免费反代 5 次/分钟、随时 429。解析阶段（纯代码）就已经
// 把所有必填字段填满了，玩家手改也能完成入册。外部服务挂了不该让人连导入都做不了。

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { parseCharacterCard } from "./cards/cardParse.js";
import { planScan, runScan } from "./cards/cardScan.js";
import * as scanStore from "./cards/scanStore.js";
import { bucketStatus } from "./cards/rateLimiter.js";
import { callModel } from "./apiConfig.js";
import {
  S, TIERS, KIND_META, BODY_PUBLIC, BODY_PRIVATE, TERM_MONO,
  Bar, JadeTier, Src, Stat, Note, Btn, Pills, Terminal,
} from "./cards/ReviewParts.jsx";
import { sanitizeMoves, TIER_NEIGONG } from "./cards/scanPrompts.js";
import ReviewNpc from "./cards/ReviewNpc.jsx";
import ReviewPlayer from "./cards/ReviewPlayer.jsx";

const EMPTY_SPECIAL = { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 };

export default function CardImportScreen({
  onClose, apiCfg, playerName = "少侠",
  onImportNpcs, onImportPlayer, onImportWorld, zoneTheme,
}) {
  const accent = zoneTheme?.accent || "#d4a853";

  const [stage, setStage] = useState("empty");   // empty | parsed | scanning | review
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [asPlayer, setAsPlayer] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [openingIdx, setOpeningIdx] = useState(0);

  const [waitMs, setWaitMs] = useState(0);
  const [bucket, setBucket] = useState(() => bucketStatus());
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(0);       // ≥0 看第几个 NPC；-1 看玩家档案
  const [term, setTerm] = useState([]);
  const [termBig, setTermBig] = useState(false);

  const abortRef = useRef({ aborted: false });
  const fileRef = useRef(null);

  useEffect(() => { scanStore.init(); }, []);
  useEffect(() => {
    const t = setInterval(() => setBucket(bucketStatus()), 1000);
    return () => clearInterval(t);
  }, []);

  const pushTerm = useCallback((kind, msg, tag) => {
    const at = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setTerm(prev => [...prev, { kind, msg, tag, at }]);
  }, []);

  // ── 读卡 ──
  const loadFile = useCallback(async (file) => {
    setErr(""); setResult(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const out = parseCharacterCard(buf, { playerName });
      setParsed(out);
      setFileName(file.name);
      // 默认只勾机器判定为人物的。待定的不默认勾——为一个判错的条目烧掉四分之一批次不值得
      setPicked(new Set(out.npcLoreCandidates.map(c => c.name)));
      setStage("parsed");
      pushTerm("done", `读入 ${file.name} · ${out.card.entries.length} 条世界书 · 人物候选 ${out.npcLoreCandidates.length} / 待定 ${out.unclassified.length}`, "解析");
      for (const w of out.report.warnings) pushTerm("info", w.msg.slice(0, 90), "体检");
      for (const b of out.report.blockers) pushTerm("fail", b.msg.slice(0, 90), "拦截");
    } catch (e) {
      setParsed(null);
      pushTerm("fail", e.message.slice(0, 90), "解析");
      setErr(e.code === "IS_PRESET" || e.code === "IS_LOREBOOK" || e.code === "NOT_A_CARD"
        ? e.message : `读取失败：${e.message}`);
      setStage("empty");
    }
  }, [playerName, pushTerm]);

  const plan = useMemo(() => {
    if (!parsed) return null;
    try {
      return planScan(parsed, { asPlayer, selectedPeople: Array.from(picked), batchSize: 4 });
    } catch { return null; }
  }, [parsed, asPlayer, picked]);

  // 世界观条目带上开关状态（默认全开），交给玩家逐条取舍
  const initWorld = useCallback((p) => (p.worldCandidates || []).map(w => ({ ...w, on: true })), []);

  // ── 扫描 ──
  const doScan = async () => {
    if (!parsed) return;
    abortRef.current = { aborted: false };
    setStage("scanning");
    try {
      const out = await runScan(parsed, callModel, apiCfg, {
        playerName, asPlayer, batchSize: 4,
        selectedPeople: Array.from(picked),
        openingIndex: openingIdx,
        signal: abortRef.current,
        onWait: (ms) => {
          setWaitMs(ms);
          if (ms > 900) pushTerm("wait", `额度用尽，${Math.ceil(ms / 1000)} 秒后继续`, "限流");
        },
        onProgress: (p) => {
          const tag = p.stage ? `阶段${p.stage}${p.batch != null ? `·批${p.batch + 1}` : ""}` : null;
          pushTerm(p.kind === "start" ? "start" : p.kind, p.msg, tag);
        },
      });
      setResult({ ...out, world: initWorld(parsed), player: out.player ? fillPlayer(out.player) : null });
      pushTerm("done", `扫描完毕 · 实调 ${out.report.calls} 次 / 复用 ${out.report.fromCache.length} 份 / 失手 ${out.report.failures.length} 次`, "汇总");
      setDetail(out.npcs.length ? 0 : -1);
      setStage("review");
    } catch (e) {
      if (e.code === "SCAN_ABORTED") {
        pushTerm("fail", "已中断，已完成的部分保留着", "中断");
      } else {
        pushTerm("fail", e.message.slice(0, 90), "出错");
        setErr(`扫描出错：${e.message}`);
      }
      setStage("parsed");
    } finally {
      setWaitMs(0);
    }
  };

  // 跳过 AI：全部走默认值。免费站挂了也能入册
  const skipScan = () => {
    const people = parsed.npcLoreCandidates.filter(c => picked.has(c.name));
    setResult({
      genre: "", multiPerson: parsed.multiPerson || [],
      world: initWorld(parsed),
      npcs: people.map(p => ({
        name: p.name, aliases: p.aliases, entry: p.entry,
        brief: p.name, levelCap: 1,
        special: { ...EMPTY_SPECIAL },
        neigong: TIER_NEIGONG[1], waigong: TIER_NEIGONG[1],
        moves: sanitizeMoves(null, 1),
        carry: [], portrait: "",
        appearance: "", attitude: "", affection: 0,
        milestones: [
          { threshold: 30, title: "面善", brief: "他开始主动与你搭话", text: [] },
          { threshold: 60, title: "交心", brief: "他说起了从不与人提的事", text: [] },
        ],
        mergedFrom: p._meta?.mergedFrom || [], source: "fallback",
      })),
      player: asPlayer ? fillPlayer(null) : null,
      opening: asPlayer && parsed.card.openings.length
        ? { index: openingIdx, original: parsed.card.openings[openingIdx], rewritten: parsed.card.openings[openingIdx], source: "original" }
        : null,
      report: { calls: 0, failures: [], fromCache: [] },
    });
    pushTerm("info", `跳过 AI，${people.length} 人全部用默认值`, "手填");
    setDetail(people.length ? 0 : -1);
    setStage("review");
  };

  // 玩家档案补齐 AI 不产出的那几项（性别、私密层、内外功、说话示范）
  function fillPlayer(base) {
    const bp = {};
    for (const [k] of BODY_PUBLIC) bp[k] = base?.bodyProfile?.[k] || "";
    const priv = {};
    for (const [k] of BODY_PRIVATE) priv[k] = "";
    return {
      name: base?.name || "", nameWhy: base?.nameWhy || "",
      gender: "男",
      bodyProfile: bp,
      bodyProfilePrivate: priv,
      special: base?.special || { ...EMPTY_SPECIAL },
      specialWhy: base?.specialWhy || "",
      neigong: 5, waigong: 5,
      persona: base?.persona || parsed?.personaCandidate || "",
      dialogueExamples: undefined,
      source: base?.source || "fallback",
    };
  }

  const patchNpc = (i, patch) => setResult(r => ({
    ...r, npcs: r.npcs.map((n, j) => (j === i ? { ...n, ...patch } : n)),
  }));
  const patchPlayer = (patch) => setResult(r => ({ ...r, player: { ...r.player, ...patch } }));
  const patchWorld = (i, patch) => setResult(r => ({
    ...r, world: r.world.map((w, j) => (j === i ? { ...w, ...patch } : w)),
  }));

  const finish = () => {
    pushTerm("done", `落册 ${result?.npcs?.length || 0} 人${result?.player ? " ＋ 主角档案" : ""}`, "落册");
    if (result?.npcs?.length && onImportNpcs) onImportNpcs(result.npcs);
    if (result?.player && onImportPlayer) onImportPlayer(result.player, result.opening);
    const world = (result?.world || []).filter(w => w.on !== false);
    if (world.length && onImportWorld) onImportWorld(world);
    onClose?.();
  };

  const shell = {
    position: "fixed", inset: 0, zIndex: 400,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(6,4,2,.82)", backdropFilter: "blur(3px)",
    fontFamily: "'Noto Serif SC','Songti SC','STSong',serif",
  };
  const panel = {
    position: "relative", width: "min(1120px, 95vw)", height: "min(800px, 93vh)",
    display: "flex", flexDirection: "column", overflow: "hidden",
    backgroundColor: "#14100a",
    backgroundImage: `url('${S("skin_wusha.webp")}')`,
    backgroundSize: "cover", backgroundBlendMode: "multiply",
    border: `2px solid ${accent}`, borderRadius: 6,
    boxShadow: "0 16px 60px rgba(0,0,0,.75), inset 0 0 90px rgba(0,0,0,.6)",
  };

  return (
    <div style={shell} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={panel}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          borderBottom: `1px solid ${accent}44`,
          backgroundImage: `url('${S("ui/bar_paper.webp")}')`, backgroundSize: "100% 100%",
        }}>
          <img src={S("ui/scroll_ic.webp")} alt="" style={{ width: 22, height: 22, opacity: .9 }} />
          <span style={{ color: "#f0e0c0", fontSize: 16, letterSpacing: 5, textShadow: "0 1px 4px #000" }}>角色入册</span>
          {fileName && <span style={{ fontSize: 10.5, color: "#8a8270" }}>{fileName}</span>}
          <span style={{ flex: 1 }} />
          <span title={`调用额度 ${bucket.tokens}/${bucket.cap}，每 12 秒回一次`}
            style={{ display: "flex", gap: 3, alignItems: "center", marginRight: 6 }}>
            {Array.from({ length: bucket.cap }).map((_, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i < bucket.tokens ? accent : "transparent",
                border: `1px solid ${i < bucket.tokens ? accent : "#4a4436"}`,
              }} />
            ))}
          </span>
          <img src={S("ui/btn_close.webp")} alt="关闭" onClick={onClose}
            style={{ width: 24, height: 24, cursor: "pointer", opacity: .85 }} />
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {stage === "empty" && (
            <EmptyPane dragOver={dragOver} setDragOver={setDragOver} err={err}
              onPick={() => fileRef.current?.click()} onFile={loadFile} accent={accent} />
          )}
          {(stage === "parsed" || stage === "scanning") && parsed && (
            <ParsedPane
              parsed={parsed} accent={accent} plan={plan} stage={stage}
              asPlayer={asPlayer} setAsPlayer={setAsPlayer}
              picked={picked} setPicked={setPicked}
              openingIdx={openingIdx} setOpeningIdx={setOpeningIdx}
              waitMs={waitMs} err={err} term={term} onExpandTerm={() => setTermBig(true)}
              onScan={doScan} onSkip={skipScan}
              onAbort={() => { abortRef.current.aborted = true; }}
            />
          )}
          {stage === "review" && result && (
            <ReviewPane
              parsed={parsed} result={result} accent={accent}
              detail={detail} setDetail={setDetail}
              patchNpc={patchNpc} patchPlayer={patchPlayer} patchWorld={patchWorld}
              setResult={setResult} asPlayer={asPlayer}
              term={term} onExpandTerm={() => setTermBig(true)}
              onBack={() => setStage("parsed")} onFinish={finish}
            />
          )}
        </div>

        {termBig && (
          <div onClick={() => setTermBig(false)}
            style={{
              position: "absolute", inset: 0, zIndex: 10, background: "rgba(8,10,14,.92)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 760, background: "#0e1116", border: "1px solid #2a3a3a", borderRadius: 8, overflow: "hidden" }}>
              <Terminal lines={term} height={440} />
              <div style={{ padding: "6px 10px", textAlign: "right", borderTop: "1px solid #1a2020" }}>
                <span onClick={() => setTermBig(false)}
                  style={{ cursor: "pointer", fontFamily: TERM_MONO, fontSize: 10, color: "#8ac8b8" }}>关闭 ✕</span>
              </div>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".png,.json" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ── 空态 ──────────────────────────────────────────────────────────────────────

function EmptyPane({ dragOver, setDragOver, err, onPick, onFile, accent }) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 40 }}
    >
      <div onClick={onPick} style={{
        width: 300, height: 300, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        backgroundImage: `url('${S("frames/frame_gold2.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        transform: dragOver ? "scale(1.04)" : "scale(1)",
        transition: "transform .18s ease",
        filter: dragOver ? `drop-shadow(0 0 16px ${accent})` : "none",
      }}>
        <img src={S("ui/scroll_v.webp")} alt="" style={{ width: 62, opacity: dragOver ? 1 : .8 }} />
        <div style={{ color: "#f0e0c0", fontSize: 14, letterSpacing: 2 }}>把角色卡拖进来</div>
        <div style={{ color: "#8a8270", fontSize: 11 }}>或点此选择 · 支持 PNG 与 JSON</div>
      </div>
      {err && (
        <div style={{
          maxWidth: 520, padding: "10px 16px", color: "#d89080", fontSize: 11.5, lineHeight: 1.7,
          backgroundImage: `url('${S("ui/note_torn.webp")}')`, backgroundSize: "100% 100%",
        }}>{err}</div>
      )}
      <div style={{ color: "#5a5448", fontSize: 10.5, lineHeight: 1.8, textAlign: "center" }}>
        酒馆角色卡（V2／V3）都能读。卡里的世界书会拆成人物与地理，<br />
        数值那部分卡里没有，由本作自己配——可以让 AI 先抽一版草案，也可以全手填。
      </div>
    </div>
  );
}

// ── 归类与勾选 ────────────────────────────────────────────────────────────────

function ParsedPane({
  parsed, accent, plan, stage, asPlayer, setAsPlayer, picked, setPicked,
  openingIdx, setOpeningIdx, waitMs, err, onScan, onSkip, onAbort, term, onExpandTerm,
}) {
  const { card, report, npcLoreCandidates, unclassified, worldCandidates, metaEntries } = parsed;
  const scanning = stage === "scanning";

  const cands = useMemo(() => [
    ...npcLoreCandidates.map(c => ({ name: c.name, aliases: c.aliases, len: c._meta.length, merged: c._meta.mergedFrom.length, sure: true })),
    ...unclassified.map(u => ({ name: u.keys[0] || u.label, aliases: u.keys.slice(1), len: u.length, merged: 0, sure: false })),
  ], [npcLoreCandidates, unclassified]);

  const toggle = (n) => setPicked(p => {
    const s = new Set(p);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });

  return (
    <>
      <div style={{ width: 340, borderRight: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
        <Bar right={<span style={{ fontSize: 10, color: "#8a8270" }}>{card.entries.length} 条</span>}>
          {card.name || "无名卡"}
        </Bar>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          <Stat label="世界书" v={`${card.entries.length} 条 / ${report.stats.totalLength} 字`} />
          <Stat label="开场白" v={`${card.openings.length} 个`} />
          <Stat label="可用兜底字段" v={report.stats.usableFields.join("、") || "无"} />
          {report.blockers.map((b, i) => <Note key={i} tone="bad">{b.msg}</Note>)}
          {report.warnings.map((w, i) => <Note key={i} tone="warn">{w.msg}</Note>)}
          <div style={{ marginTop: 12, borderTop: "1px solid #2a2419", paddingTop: 10 }}>
            <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 6 }}>归类结果</div>
            {[["person", cands.filter(c => c.sure).length], ["faction/place/rule", worldCandidates.length],
              ["meta", metaEntries.length], ["unknown", unclassified.length]].map(([k, n]) => {
              const m = KIND_META[k] || KIND_META.unknown;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 3, color: "#a89870" }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span style={{ flex: 1 }}>{k === "faction/place/rule" ? "世界观" : m.label}</span>
                  <span style={{ color: n ? accent : "#5a5448" }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <Terminal lines={term} height={126} onExpand={onExpandTerm} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Bar right={
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: "#d8c8a0" }}>
            <input type="checkbox" checked={asPlayer} disabled={scanning}
              onChange={e => setAsPlayer(e.target.checked)} />
            这张卡也当我自己
          </label>
        }>入册名单</Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {!cands.length && (
            <div style={{ color: "#6a6250", fontSize: 11.5, padding: "20px 0", textAlign: "center" }}>
              这张卡里没找到可以单独成人的条目。<br />
              {report.stats.usableFields.length
                ? "人设写在卡的经典字段里，勾上「这张卡也当我自己」就能用。"
                : "可以直接跳过，之后手写。"}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {cands.map(c => {
              const on = picked.has(c.name);
              return (
                <div key={c.name} onClick={scanning ? undefined : () => toggle(c.name)}
                  style={{
                    cursor: scanning ? "default" : "pointer", padding: "8px 10px", borderRadius: 4,
                    border: `1px solid ${on ? accent : "#2a2419"}`,
                    background: on ? "rgba(212,168,83,.10)" : "rgba(0,0,0,.25)",
                    transition: "all .15s ease",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: on ? accent : "#4a4436", fontSize: 12 }}>{on ? "◉" : "○"}</span>
                    <span style={{ color: "#e8dcc0", fontSize: 12.5, flex: 1 }}>{c.name}</span>
                    {!c.sure && <span title="机器拿不准这是人还是概念，勾选前请自己看一眼"
                      style={{ fontSize: 9, color: "#8a8270", border: "1px solid #3a3428", borderRadius: 2, padding: "0 3px" }}>待定</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#6a6250", marginTop: 3, paddingLeft: 18 }}>
                    {c.aliases.length ? `别名 ${c.aliases.slice(0, 3).join("/")}` : "无别名"} · {c.len}字
                    {c.merged > 1 ? ` · 合${c.merged}段` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {asPlayer && card.openings.length > 1 && (
            <div style={{ marginTop: 14, borderTop: "1px solid #2a2419", paddingTop: 10 }}>
              <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 6 }}>这张卡有 {card.openings.length} 个开局，选一个改写</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.openings.map((o, i) => (
                  <span key={i} onClick={() => setOpeningIdx(i)} title={o.slice(0, 80)}
                    style={{
                      cursor: "pointer", fontSize: 10.5, padding: "3px 9px", borderRadius: 3,
                      border: `1px solid ${openingIdx === i ? accent : "#2a2419"}`,
                      color: openingIdx === i ? accent : "#8a8270",
                    }}>开局{i + 1}·{o.length}字</span>
                ))}
              </div>
            </div>
          )}

          {scanning && waitMs > 0 && (
            <Note tone="info">额度用完了，{Math.ceil(waitMs / 1000)} 秒后自动继续。过程见左下日志。</Note>
          )}
          {err && <Note tone="bad">{err}</Note>}
        </div>

        <div style={{
          borderTop: `1px solid ${accent}44`, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          backgroundImage: `url('${S("ui/bar_paper2.webp")}')`, backgroundSize: "100% 100%",
        }}>
          {plan && !scanning && (
            <span style={{ fontSize: 11, color: "#8a8270" }}>
              预计 <span style={{ color: accent }}>{plan.calls}</span> 次调用
              {plan.estimateMs > 0 && <> · 约 {Math.ceil(plan.estimateMs / 1000)} 秒</>}
              {plan.alreadyDone > 0 && <> · 已有 {plan.alreadyDone} 次结果可复用</>}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {scanning ? (
            <Btn onClick={onAbort} tone="warn">中断</Btn>
          ) : (
            <>
              <Btn onClick={onSkip} tone="dim" title="不调 AI，全部用默认值，之后自己改">跳过，手填</Btn>
              <Btn onClick={onScan} tone="main" disabled={!report.ok}
                title={report.ok ? "" : "这张卡被拦截了，不建议导入"}>
                <img src={S("ui/eye.webp")} alt="" style={{ width: 15, verticalAlign: "-2px", marginRight: 5 }} />
                让 AI 扫一遍
              </Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── 过目定稿 ──────────────────────────────────────────────────────────────────

// 这一层只做分派：顶上选「众人／我自己」，右边挂 ReviewNpc 或 ReviewPlayer。
// 全字段的排布在那两个文件里，各自照映射表的顺序走。
function ReviewPane({
  parsed, result, accent, detail, setDetail, patchNpc, patchPlayer, patchWorld,
  setResult, asPlayer, onBack, onFinish, term, onExpandTerm,
}) {
  const cur = detail >= 0 ? result.npcs[detail] : null;
  const placedCount = result.npcs.filter(x => (x.placement?.mode || "mention") !== "mention").length;

  // 卡里被本作丢弃的东西，列给玩家看一眼，别让它们悄悄消失
  const dropped = useMemo(() => {
    const out = [];
    const sc = parsed?.card?.scripts;
    if (sc?.regexScripts) out.push(`${sc.regexScripts} 条正则替换脚本（本作有自己的渲染，不需要）`);
    if (sc?.tavernHelper) out.push(`酒馆助手前端界面 ${sc.tavernHelper.size} 字符${sc.remoteImport ? "，且会从远程地址拉代码执行" : ""}`);
    if (sc?.otherExtensionKeys?.length) out.push(`第三方扩展数据：${sc.otherExtensionKeys.join("、")}`);
    for (const m of (parsed?.metaEntries || [])) out.push(`框架类条目「${m.label}」${m.length}字（状态栏／格式／思维链之类）`);
    return out;
  }, [parsed]);

  return (
    <>
      <div style={{ width: 230, borderRight: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
        <Bar>过目定稿</Bar>

        {/* 开头就选：这张卡是当众人写进江湖，还是当我自己 */}
        {asPlayer && (
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #2a2419" }}>
            <Pills accent={accent}
              value={detail >= 0 ? "npc" : "me"}
              onChange={v => setDetail(v === "me" ? -1 : (result.npcs.length ? 0 : -1))}
              options={[
                { value: "npc", label: `众人 ${result.npcs.length}`, title: "写进江湖的人" },
                { value: "me", label: "我自己", title: "这张卡当主角" },
              ]} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
          {detail >= 0 || !asPlayer ? result.npcs.map((n, i) => (
            <div key={i} onClick={() => setDetail(i)}
              style={{
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                padding: "6px 8px", borderRadius: 4, marginBottom: 3,
                background: detail === i ? "rgba(212,168,83,.12)" : "transparent",
                borderLeft: `2px solid ${detail === i ? accent : "transparent"}`,
              }}>
              <JadeTier value={n.levelCap} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e8dcc0", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</div>
                <div style={{ color: "#6a6250", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
              </div>
              {(() => {
                const m = n.placement?.mode || "mention";
                if (m === "mention") return null;
                return <span title={m === "resident" ? `驻场于${n.placement.district}` : "游走各据点"}
                  style={{ fontSize: 9, color: accent, flexShrink: 0 }}>{m === "resident" ? "驻" : "游"}</span>;
              })()}
              {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: 9, color: "#6a6250" }}>默</span>}
            </div>
          )) : (
            <div style={{ fontSize: 10.5, color: "#6a6250", lineHeight: 1.9, padding: "4px 4px" }}>
              正在编辑主角档案。<br />切回「众人」可继续改其他人。
            </div>
          )}
        </div>
        <Terminal lines={term} height={118} onExpand={onExpandTerm} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Bar right={result.genre ? <span style={{ fontSize: 10, color: "#8a8270" }}>{result.genre}</span> : null}>
          {cur ? cur.name : "我自己"}
        </Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cur ? (
            <ReviewNpc npc={cur} accent={accent} dropped={dropped}
              onPatch={patch => patchNpc(detail, patch)} />
          ) : result.player ? (
            <ReviewPlayer
              player={result.player} accent={accent}
              onPatch={patchPlayer}
              opening={result.opening}
              onPatchOpening={o => setResult(r => ({ ...r, opening: o }))}
              worldCandidates={result.world}
              onPatchWorld={patchWorld}
              cardPersonality={parsed?.card?.fields?.personality || ""}
              cardMesExample={parsed?.card?.fields?.mesExample || ""}
            />
          ) : null}
        </div>

        <div style={{
          borderTop: `1px solid ${accent}44`, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          backgroundImage: `url('${S("ui/bar_paper2.webp")}')`, backgroundSize: "100% 100%",
        }}>
          <Btn onClick={onBack} tone="dim">← 回名单</Btn>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "#8a8270" }}>
            将入册 {result.npcs.length} 人
            {placedCount ? `（${placedCount} 人会真的出现）` : "（都只在被提到时注入）"}
            {result.player ? " ＋ 我自己" : ""}
          </span>
          <Btn onClick={onFinish} tone="main">
            <img src={S("ui/hammer.webp")} alt="" style={{ width: 14, verticalAlign: "-2px", marginRight: 5 }} />
            落册
          </Btn>
        </div>
      </div>
    </>
  );
}

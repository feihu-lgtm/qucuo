// 角色入册 —— 角色卡导入界面
// ============================================================================
// 视觉素材全部取自 public/stones/：这套素材本来是给赌石玩法做的，但它的质感
// （木框、纸卷、玉石、铜边）跟"入册"这件事天然合得上——把一个外来的人写进
// 江湖名册，本身就该有翻卷轴、盖印、镶玉的仪式感。
//
// 【六档玉色 = 六档品阶】stones 里有 jade_1_bai 到 jade_6_hong 六种玉色，
// 正好对上 levelCap 的白绿蓝紫橙红。品阶徽记直接用玉石图，不用另画。
//
// 【为什么 AI 扫描是一个按钮而不是一道关】免费反代 5 次/分钟、随时 429。解析
// 阶段（纯代码）就已经把所有必填字段填满了，玩家手改也能完成入册。所以扫描
// 是可选的加速，不是必经流程——外部服务挂了不该让人连导入都做不了。

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { parseCharacterCard } from "./cards/cardParse.js";
import { planScan, runScan } from "./cards/cardScan.js";
import * as scanStore from "./cards/scanStore.js";
import { bucketStatus } from "./cards/rateLimiter.js";
import { callModel } from "./apiConfig.js";
import { QUCUO_MAP } from "./qucuoMap.js";
import { hasInnerMap, getPublicInnerRoomNames } from "./innerMap.js";
import { normalizePlacement } from "./cards/importedRegistry.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
const S = (p) => `${BASE}stones/${p}`;

// levelCap 0-5 → 玉色文件名与档位标签
const TIERS = [
  { key: "bai", label: "白", jade: "jade_1_bai_chun.webp", color: "#d8d4c8" },
  { key: "lv", label: "绿", jade: "jade_2_lv_chun.webp", color: "#8ab070" },
  { key: "lan", label: "蓝", jade: "jade_3_lan_chun.webp", color: "#6a9ac4" },
  { key: "zi", label: "紫", jade: "jade_4_zi_chun.webp", color: "#a078c0" },
  { key: "cheng", label: "橙", jade: "jade_5_cheng_chun.webp", color: "#d89050" },
  { key: "hong", label: "红", jade: "jade_6_hong_chun.webp", color: "#c85850" },
];

const KIND_META = {
  person: { label: "人物", icon: "👤", color: "#d4a853" },
  faction: { label: "势力", icon: "⚔", color: "#c07850" },
  place: { label: "地方", icon: "⛰", color: "#7a9a70" },
  rule: { label: "规矩", icon: "⚖", color: "#8a8ab0" },
  item: { label: "物件", icon: "◈", color: "#b09060" },
  player: { label: "我自己", icon: "☯", color: "#c8a0c0" },
  meta: { label: "框架", icon: "⚙", color: "#5a6a70" },
  unknown: { label: "待定", icon: "?", color: "#8a8270" },
  drop: { label: "弃用", icon: "✕", color: "#4a4a44" },
};

const SEVEN = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];
const DISTRICTS = Object.keys(QUCUO_MAP).filter(d => d !== "心灵之海" && d !== "第三新东京市");
const PLACEMENT_LABEL = {
  mention: "不落地",
  resident: "驻场",
  wander: "游走",
};
const PLACEMENT_HINT = {
  mention: "他的人设只在被提到时注入，不会主动出现在任何据点。适合远方的人、传闻里的人。",
  resident: "进了这个据点必定遇见他，不受时辰与运气影响。跟村长、掌柜这类人同一个待遇。",
  wander: "按权重每天随机出现在选中的据点，且只在设定的时辰里露面。跟行商、镖师同一个待遇。",
};
const BODY_FIELDS = [
  ["height", "身量"], ["build", "体型"], ["face", "面容"], ["skin", "肤色"],
  ["hair", "发式"], ["voice", "声音"], ["clothing", "穿着"],
];

// ── 小组件 ────────────────────────────────────────────────────────────────────

// 木牌标题条，用 bar_wood 做底
function Bar({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      backgroundImage: `url('${S("ui/bar_wood.webp")}')`,
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      padding: "9px 16px", minHeight: 34,
    }}>
      <span style={{ color: "#f0e0c0", fontSize: 13, letterSpacing: 2, textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
        {children}
      </span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// 玉石品阶徽记。点击循环切换档位（比下拉省地方，且能一眼看见颜色变化）
function JadeTier({ value, onChange, size = 30, title }) {
  const t = TIERS[Math.max(0, Math.min(5, value ?? 0))];
  return (
    <span
      onClick={onChange ? () => onChange(((value ?? 0) + 1) % 6) : undefined}
      title={title || `品阶 ${t.label}档${onChange ? "（点击换档）" : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, flexShrink: 0,
        backgroundImage: `url('${S(t.jade)}')`,
        backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        cursor: onChange ? "pointer" : "default",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))",
      }}
    >
      <span style={{
        fontSize: size * 0.36, fontWeight: 700, color: "#1a1206",
        textShadow: `0 0 3px ${t.color}`,
      }}>{t.label}</span>
    </span>
  );
}

// 七维滑条。左侧名、中间条、右侧数字，条本身可点可拖
function SevenDim({ special, onChange, why }) {
  return (
    <div>
      {SEVEN.map(k => {
        const v = special?.[k] ?? 5;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ width: 30, fontSize: 11, color: "#a89870", flexShrink: 0 }}>{k}</span>
            <div
              onClick={e => {
                if (!onChange) return;
                const r = e.currentTarget.getBoundingClientRect();
                const n = Math.round(((e.clientX - r.left) / r.width) * 10);
                onChange({ ...special, [k]: Math.max(0, Math.min(10, n)) });
              }}
              style={{
                flex: 1, height: 9, position: "relative", cursor: onChange ? "pointer" : "default",
                backgroundImage: `url('${S("ui/bar_paper2.webp")}')`,
                backgroundSize: "100% 100%", borderRadius: 2, overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: `${v * 10}%`,
                background: "linear-gradient(90deg, #8a6a2a, #d4a853)", opacity: 0.85,
              }} />
            </div>
            <span style={{ width: 16, textAlign: "right", fontSize: 11, color: "#d4a853", flexShrink: 0 }}>{v}</span>
          </div>
        );
      })}
      {why && <div style={{ fontSize: 10, color: "#6a6250", marginTop: 4, fontStyle: "italic" }}>据「{why}」</div>}
    </div>
  );
}

// AI 产出的字段旁边的小标记。没有它玩家没法判断哪些值可信
function Src({ source, why }) {
  if (source === "fallback") {
    return <span title="AI 没抽出来，这是默认值" style={{ fontSize: 9, color: "#6a6250", border: "1px solid #3a3428", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>默认</span>;
  }
  return (
    <span title={why ? `AI 判断依据：${why}` : "AI 抽取"} style={{ fontSize: 9, color: "#7a9a70", border: "1px solid #3a4a34", borderRadius: 2, padding: "0 3px", marginLeft: 5 }}>
      AI{why ? "·" + why.slice(0, 10) : ""}
    </span>
  );
}

function TextField({ label, value, onChange, placeholder, rows = 1, max }) {
  const common = {
    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,.35)",
    border: "1px solid #3a3428", borderRadius: 3, padding: "5px 8px",
    color: "#e8dcc0", fontSize: 11.5, outline: "none", fontFamily: "inherit", resize: "vertical",
  };
  return (
    <label style={{ display: "block", marginBottom: 7 }}>
      <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3 }}>
        {label}{max ? <span style={{ color: "#5a5448" }}> ≤{max}字</span> : null}
      </span>
      {rows > 1
        ? <textarea rows={rows} value={value || ""} placeholder={placeholder}
            onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} style={common} />
        : <input value={value || ""} placeholder={placeholder}
            onChange={e => onChange(max ? e.target.value.slice(0, max) : e.target.value)} style={common} />}
    </label>
  );
}

// 落脚设定：三种方式对应本作已有的三套机制，见 importedRegistry 的 PLACEMENT_MODES
function Placement({ value, onChange, accent }) {
  const pl = normalizePlacement(value);
  const rooms = pl.district && hasInnerMap(pl.district) ? getPublicInnerRoomNames(pl.district) : [];
  const set = (patch) => onChange({ ...pl, ...patch });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {["mention", "resident", "wander"].map(m => (
          <span key={m} onClick={() => set({ mode: m })}
            style={{
              cursor: "pointer", fontSize: 11.5, padding: "4px 14px", borderRadius: 3,
              border: `1px solid ${pl.mode === m ? accent : "#3a3428"}`,
              background: pl.mode === m ? "rgba(212,168,83,.14)" : "transparent",
              color: pl.mode === m ? accent : "#8a8270",
            }}>{PLACEMENT_LABEL[m]}</span>
        ))}
      </div>

      {pl.mode === "resident" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3 }}>据点</span>
            <select value={pl.district || ""} onChange={e => set({ district: e.target.value || null, innerRoom: null })}
              style={selStyle}>
              <option value="" style={{ background: "#1a1206" }}>（未选，等同不落地）</option>
              {DISTRICTS.map(d => <option key={d} value={d} style={{ background: "#1a1206" }}>{d}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3 }}>
              常在哪间{rooms.length ? "" : "（此据点无内层）"}
            </span>
            <select value={pl.innerRoom || ""} disabled={!rooms.length}
              onChange={e => set({ innerRoom: e.target.value || null })} style={selStyle}>
              <option value="" style={{ background: "#1a1206" }}>不限</option>
              {rooms.map(r => <option key={r} value={r} style={{ background: "#1a1206" }}>{r}</option>)}
            </select>
          </label>
        </div>
      )}

      {pl.mode === "wander" && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 4 }}>
            出现在哪些据点 · 点一下加二十五，满了归零
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {DISTRICTS.map(d => {
              const w = pl.weights?.[d] || 0;
              return (
                <span key={d} onClick={() => {
                  const next = { ...(pl.weights || {}) };
                  const nw = w >= 100 ? 0 : w + 25;
                  if (nw > 0) next[d] = nw; else delete next[d];
                  set({ weights: next });
                }}
                  style={{
                    cursor: "pointer", fontSize: 10.5, padding: "3px 8px", borderRadius: 3,
                    border: `1px solid ${w > 0 ? accent : "#2a2419"}`,
                    background: w > 0 ? `rgba(212,168,83,${0.06 + w / 500})` : "transparent",
                    color: w > 0 ? "#e8dcc0" : "#6a6250",
                  }}>{d}{w > 0 ? ` ${w}` : ""}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8a8270" }}>
            <span>时辰</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[0]}
              onChange={e => set({ timeSlot: [Number(e.target.value), pl.timeSlot[1]] })}
              style={{ ...selStyle, width: 52 }} />
            <span>到</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[1]}
              onChange={e => set({ timeSlot: [pl.timeSlot[0], Number(e.target.value)] })}
              style={{ ...selStyle, width: 52 }} />
            <span style={{ fontSize: 10, color: "#6a6250" }}>（0-23 时，跨夜请分两次入册）</span>
          </div>
        </div>
      )}

      <Note tone="info">{PLACEMENT_HINT[pl.mode]}</Note>
    </div>
  );
}

const selStyle = {
  boxSizing: "border-box", width: "100%", background: "rgba(0,0,0,.4)",
  border: "1px solid #3a3428", borderRadius: 3, padding: "5px 7px",
  color: "#e8dcc0", fontSize: 11.5, outline: "none", fontFamily: "inherit",
};

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function CardImportScreen({
  onClose, apiCfg, playerName = "少侠",
  onImportNpcs, onImportPlayer, zoneTheme,
}) {
  const accent = zoneTheme?.accent || "#d4a853";

  const [stage, setStage] = useState("empty");   // empty | parsed | scanning | review
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [asPlayer, setAsPlayer] = useState(false);
  const [picked, setPicked] = useState(() => new Set());   // 勾选要换算的人名
  const [openingIdx, setOpeningIdx] = useState(0);

  const [progress, setProgress] = useState([]);
  const [waitMs, setWaitMs] = useState(0);
  const [bucket, setBucket] = useState(() => bucketStatus());
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(0);       // 审改时看第几个人物；-1 = 玩家档案

  const abortRef = useRef({ aborted: false });
  const fileRef = useRef(null);

  useEffect(() => { scanStore.init(); }, []);
  useEffect(() => {
    const t = setInterval(() => setBucket(bucketStatus()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── 读卡 ──
  const loadFile = useCallback(async (file) => {
    setErr(""); setResult(null); setProgress([]);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const out = parseCharacterCard(buf, { playerName });
      setParsed(out);
      setFileName(file.name);
      // 默认勾选机器判定为人物的；待定的不默认勾，免得为判错的条目烧额度
      setPicked(new Set(out.npcLoreCandidates.map(c => c.name)));
      setStage("parsed");
    } catch (e) {
      setParsed(null);
      setErr(e.code === "IS_PRESET" ? e.message
        : e.code === "IS_LOREBOOK" ? e.message
        : e.code === "NOT_A_CARD" ? e.message
        : `读取失败：${e.message}`);
      setStage("empty");
    }
  }, [playerName]);

  const plan = useMemo(() => {
    if (!parsed) return null;
    try {
      return planScan(parsed, { asPlayer, selectedPeople: Array.from(picked), batchSize: 4 });
    } catch { return null; }
  }, [parsed, asPlayer, picked]);

  // ── 扫描 ──
  const doScan = async () => {
    if (!parsed) return;
    abortRef.current = { aborted: false };
    setStage("scanning"); setProgress([]);
    try {
      const out = await runScan(parsed, callModel, apiCfg, {
        playerName, asPlayer, batchSize: 4,
        selectedPeople: Array.from(picked),
        openingIndex: openingIdx,
        signal: abortRef.current,
        onWait: (ms) => setWaitMs(ms),
        onProgress: (p) => setProgress(prev => [...prev, p]),
      });
      setResult(out);
      setDetail(out.npcs.length ? 0 : (asPlayer ? -1 : 0));
      setStage("review");
    } catch (e) {
      if (e.code === "SCAN_ABORTED") {
        setProgress(prev => [...prev, { kind: "fail", msg: "已中断，已完成的部分保留着" }]);
        setStage("parsed");
      } else {
        setErr(`扫描出错：${e.message}`);
        setStage("parsed");
      }
    } finally {
      setWaitMs(0);
    }
  };

  // 跳过 AI，直接用纯代码结果进审改（免费站挂了也能入册）
  const skipScan = () => {
    const people = parsed.npcLoreCandidates.filter(c => picked.has(c.name));
    setResult({
      genre: "", multiPerson: parsed.multiPerson || [],
      npcs: people.map(p => ({
        name: p.name, aliases: p.aliases, entry: p.entry,
        brief: p.name, levelCap: 1, special: { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 },
        appearance: "", attitude: "", affection: 0,
        milestones: [
          { threshold: 30, title: "面善", brief: "他开始主动与你搭话", text: [] },
          { threshold: 60, title: "交心", brief: "他说起了从不与人提的事", text: [] },
        ],
        mergedFrom: p._meta?.mergedFrom || [], source: "fallback",
      })),
      player: asPlayer ? {
        name: "", bodyProfile: Object.fromEntries(BODY_FIELDS.map(([k]) => [k, ""])),
        special: { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 },
        persona: parsed.personaCandidate || "", missing: BODY_FIELDS.map(([k]) => k), source: "fallback",
      } : null,
      opening: asPlayer && parsed.card.openings.length
        ? { index: openingIdx, original: parsed.card.openings[openingIdx], rewritten: parsed.card.openings[openingIdx], source: "original" }
        : null,
      report: { calls: 0, failures: [], fromCache: [] },
    });
    setDetail(parsed.npcLoreCandidates.length ? 0 : (asPlayer ? -1 : 0));
    setStage("review");
  };

  const patchNpc = (i, patch) => setResult(r => ({
    ...r, npcs: r.npcs.map((n, j) => (j === i ? { ...n, ...patch } : n)),
  }));

  const finish = () => {
    if (result?.npcs?.length && onImportNpcs) onImportNpcs(result.npcs);
    if (result?.player && onImportPlayer) onImportPlayer(result.player, result.opening);
    onClose?.();
  };

  // ── 外壳 ──
  const shell = {
    position: "fixed", inset: 0, zIndex: 400,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(6,4,2,.82)", backdropFilter: "blur(3px)",
    fontFamily: "'Noto Serif SC','Songti SC','STSong',serif",
  };
  const panel = {
    position: "relative", width: "min(1080px, 94vw)", height: "min(760px, 92vh)",
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
        {/* 标题栏 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          borderBottom: `1px solid ${accent}44`,
          backgroundImage: `url('${S("ui/bar_paper.webp")}')`, backgroundSize: "100% 100%",
        }}>
          <img src={S("ui/scroll_ic.webp")} alt="" style={{ width: 22, height: 22, opacity: .9 }} />
          <span style={{ color: "#f0e0c0", fontSize: 16, letterSpacing: 5, textShadow: "0 1px 4px #000" }}>角色入册</span>
          {fileName && <span style={{ fontSize: 10.5, color: "#8a8270" }}>{fileName}</span>}
          <span style={{ flex: 1 }} />
          {/* 令牌余量：五颗珠子，一眼看出还能调几次 */}
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

        {/* 主体 */}
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
              progress={progress} waitMs={waitMs} err={err}
              onScan={doScan} onSkip={skipScan}
              onAbort={() => { abortRef.current.aborted = true; }}
            />
          )}

          {stage === "review" && result && (
            <ReviewPane
              result={result} accent={accent} detail={detail} setDetail={setDetail}
              patchNpc={patchNpc} setResult={setResult} asPlayer={asPlayer}
              onBack={() => setStage("parsed")} onFinish={finish}
            />
          )}
        </div>

        <input ref={fileRef} type="file" accept=".png,.json" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ── 空态：拖入卡片 ────────────────────────────────────────────────────────────

function EmptyPane({ dragOver, setDragOver, err, onPick, onFile, accent }) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 18, padding: 40,
      }}
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

// ── 解析后：条目清单 + 扫描 ───────────────────────────────────────────────────

function ParsedPane({
  parsed, accent, plan, stage, asPlayer, setAsPlayer, picked, setPicked,
  openingIdx, setOpeningIdx, progress, waitMs, err, onScan, onSkip, onAbort,
}) {
  const { card, report, npcLoreCandidates, unclassified, worldCandidates, metaEntries, personaCandidate } = parsed;
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
      {/* 左：条目总览 */}
      <div style={{ width: 340, borderRight: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
        <Bar right={<span style={{ fontSize: 10, color: "#8a8270" }}>{card.entries.length} 条</span>}>
          {card.name || "无名卡"}
        </Bar>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          <Stat label="世界书" v={`${card.entries.length} 条 / ${report.stats.totalLength} 字`} />
          <Stat label="开场白" v={`${card.openings.length} 个`} />
          <Stat label="可用兜底字段" v={report.stats.usableFields.join("、") || "无"} />
          {report.blockers.map((b, i) => (
            <Note key={i} tone="bad">{b.msg}</Note>
          ))}
          {report.warnings.map((w, i) => (
            <Note key={i} tone="warn">{w.msg}</Note>
          ))}

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
      </div>

      {/* 右：勾选与扫描 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Bar right={
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: "#d8c8a0" }}>
            <input type="checkbox" checked={asPlayer} disabled={scanning}
              onChange={e => setAsPlayer(e.target.checked)} />
            这张卡当我自己
          </label>
        }>入册名单</Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {!cands.length && (
            <div style={{ color: "#6a6250", fontSize: 11.5, padding: "20px 0", textAlign: "center" }}>
              这张卡里没找到可以单独成人的条目。<br />
              {report.stats.usableFields.length
                ? "人设写在卡的经典字段里，勾上「这张卡当我自己」就能用。"
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

          {scanning && (
            <div style={{ marginTop: 14, borderTop: "1px solid #2a2419", paddingTop: 10 }}>
              {progress.slice(-8).map((p, i) => (
                <div key={i} style={{
                  fontSize: 11, marginBottom: 3, lineHeight: 1.6,
                  color: p.kind === "fail" ? "#c08870" : p.kind === "retry" ? "#c0a870" : p.kind === "done" ? "#8ab070" : "#a89870",
                }}>
                  {p.kind === "fail" ? "✕" : p.kind === "retry" ? "↻" : p.kind === "done" ? "✓" : "▸"} {p.msg}
                </div>
              ))}
              {waitMs > 0 && (
                <div style={{ fontSize: 10.5, color: "#8a8270", marginTop: 6 }}>
                  额度用完了，{Math.ceil(waitMs / 1000)} 秒后自动继续
                </div>
              )}
            </div>
          )}
          {err && <Note tone="bad">{err}</Note>}
        </div>

        {/* 底部操作条 */}
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

// ── 审改 ──────────────────────────────────────────────────────────────────────

function ReviewPane({ result, accent, detail, setDetail, patchNpc, setResult, asPlayer, onBack, onFinish }) {
  const cur = detail >= 0 ? result.npcs[detail] : null;

  return (
    <>
      {/* 左：名单 */}
      <div style={{ width: 210, borderRight: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
        <Bar>过目定稿</Bar>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
          {result.npcs.map((n, i) => (
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
          ))}
          {asPlayer && result.player && (
            <div onClick={() => setDetail(-1)}
              style={{
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                padding: "6px 8px", borderRadius: 4, marginTop: 8,
                borderTop: "1px solid #2a2419",
                background: detail === -1 ? "rgba(200,160,192,.12)" : "transparent",
                borderLeft: `2px solid ${detail === -1 ? "#c8a0c0" : "transparent"}`,
              }}>
              <span style={{ fontSize: 16, color: "#c8a0c0" }}>☯</span>
              <div style={{ color: "#e8dcc0", fontSize: 12 }}>我自己</div>
            </div>
          )}
        </div>
        {result.report.calls > 0 && (
          <div style={{ padding: "8px 10px", borderTop: "1px solid #2a2419", fontSize: 10, color: "#6a6250", lineHeight: 1.7 }}>
            实调 {result.report.calls} 次
            {result.report.fromCache.length ? ` · 复用 ${result.report.fromCache.length} 份` : ""}
            {result.report.failures.length ? ` · 失手 ${result.report.failures.length} 次` : ""}
          </div>
        )}
      </div>

      {/* 右：详情 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Bar right={result.genre ? <span style={{ fontSize: 10, color: "#8a8270" }}>{result.genre}</span> : null}>
          {cur ? cur.name : "我自己"}
        </Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cur ? (
            <>
              <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <JadeTier value={cur.levelCap} size={54}
                    onChange={v => patchNpc(detail, { levelCap: v })} />
                  <div style={{ fontSize: 10, color: "#8a8270", marginTop: 4 }}>
                    品阶<Src source={cur.source} why={cur.levelCapWhy} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <TextField label={<>一句话身份<Src source={cur.source} why={cur.briefWhy} /></>}
                    value={cur.brief} max={15} onChange={v => patchNpc(detail, { brief: v })} />
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <TextField label="别名（顿号分隔，用于对话里认出他）"
                        value={(cur.aliases || []).join("、")}
                        onChange={v => patchNpc(detail, { aliases: v.split(/[、,，]/).map(s => s.trim()).filter(Boolean) })} />
                    </div>
                    <div style={{ width: 92 }}>
                      <TextField label="初始好感" value={String(cur.affection)}
                        onChange={v => patchNpc(detail, { affection: Math.max(-20, Math.min(20, Number(v) || 0)) })} />
                    </div>
                  </div>
                </div>
              </div>

              <Section title="落脚 · 他会出现在哪">
                <Placement value={cur.placement} accent={accent}
                  onChange={pl => patchNpc(detail, { placement: pl })} />
              </Section>

              <Section title={<>七维天赋<Src source={cur.source} why={cur.specialWhy} /></>}>
                <SevenDim special={cur.special} onChange={s => patchNpc(detail, { special: s })} />
              </Section>

              <Section title="外貌锚点">
                <TextField label="别人一眼看得见的（会注入给说书人）" rows={3} max={100}
                  value={cur.appearance} onChange={v => patchNpc(detail, { appearance: v })} />
                <TextField label="初次照面的态度与说话方式" rows={2} max={50}
                  value={cur.attitude} onChange={v => patchNpc(detail, { attitude: v })} />
              </Section>

              <Section title="好感里程碑（本作只有 30 / 60 两档）">
                {cur.milestones.map((m, mi) => (
                  <div key={m.threshold} style={{ marginBottom: 9, paddingBottom: 8, borderBottom: "1px dashed #2a2419" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ width: 26, fontSize: 12, color: accent, flexShrink: 0 }}>{m.threshold}</span>
                      <input value={m.title} placeholder="标题"
                        onChange={e => patchNpc(detail, { milestones: cur.milestones.map((x, j) => j === mi ? { ...x, title: e.target.value.slice(0, 8) } : x) })}
                        style={{ width: 76, background: "rgba(0,0,0,.35)", border: "1px solid #3a3428", borderRadius: 3, padding: "4px 6px", color: "#e8dcc0", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      <input value={m.brief} placeholder="一句话说明"
                        onChange={e => patchNpc(detail, { milestones: cur.milestones.map((x, j) => j === mi ? { ...x, brief: e.target.value.slice(0, 30) } : x) })}
                        style={{ flex: 1, background: "rgba(0,0,0,.35)", border: "1px solid #3a3428", borderRadius: 3, padding: "4px 6px", color: "#e8dcc0", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                    </div>
                    <textarea rows={2} value={(m.text || []).join("\n")}
                      placeholder="领取这段剧情时玩家会读到的正文，一行一句。留空则领取后无内容"
                      onChange={e => patchNpc(detail, { milestones: cur.milestones.map((x, j) => j === mi ? { ...x, text: e.target.value.split("\n").map(t => t.trim()).filter(Boolean) } : x) })}
                      style={{ width: "100%", boxSizing: "border-box", marginLeft: 34, maxWidth: "calc(100% - 34px)", background: "rgba(0,0,0,.35)", border: "1px solid #3a3428", borderRadius: 3, padding: "4px 6px", color: "#c8bfa0", fontSize: 10.5, lineHeight: 1.7, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                  </div>
                ))}
                <Note tone="info">
                  这两段是玩家在「人物关系」页手动领取时读到的固定剧情，本作原有角色全是手写的。
                  AI 给的是草稿，值得你自己润一遍。
                </Note>
              </Section>

              {cur.mergedFrom?.length > 1 && (
                <Note tone="info">这个人是由 {cur.mergedFrom.length} 段合成的：{cur.mergedFrom.join(" ＋ ")}</Note>
              )}
              <Section title="原文（入册后作为人设注入，不改文体）">
                <div style={{
                  maxHeight: 150, overflowY: "auto", fontSize: 11, lineHeight: 1.75, color: "#a89870",
                  whiteSpace: "pre-wrap", padding: "8px 10px", background: "rgba(0,0,0,.28)",
                  border: "1px solid #2a2419", borderRadius: 3,
                }}>{cur.entry}</div>
              </Section>
            </>
          ) : result.player ? (
            <>
              <TextField label={<>名讳<Src source={result.player.source} why={result.player.nameWhy} /></>}
                value={result.player.name} max={12}
                onChange={v => setResult(r => ({ ...r, player: { ...r.player, name: v } }))} />

              <Section title={<>体貌 · 公开层{result.player.missing.length ? <span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>缺 {result.player.missing.length} 项</span> : null}</>}>
                {BODY_FIELDS.map(([k, label]) => (
                  <TextField key={k} label={label} max={40} placeholder="留空由你自己填"
                    value={result.player.bodyProfile[k]}
                    onChange={v => setResult(r => ({ ...r, player: { ...r.player, bodyProfile: { ...r.player.bodyProfile, [k]: v } } }))} />
                ))}
                <Note tone="info">
                  私密层那五项（疤痕印记／体味／身体细节／敏感处／习惯癖好）不从卡里抽，
                  入册后去右栏「◈ 体貌」自己填。
                </Note>
              </Section>

              <Section title={<>七维天赋<Src source={result.player.source} why={result.player.specialWhy} /></>}>
                <SevenDim special={result.player.special}
                  onChange={s => setResult(r => ({ ...r, player: { ...r.player, special: s } }))} />
              </Section>

              <Section title="出身来历（注入说书人，不外显）">
                <TextField label="" rows={4} max={200} value={result.player.persona}
                  onChange={v => setResult(r => ({ ...r, player: { ...r.player, persona: v } }))} />
              </Section>

              {result.opening && (
                <Section title={<>开场白{result.opening.source === "ai" ? <Src source="ai" why="已归化人称与文体" /> : <Src source="fallback" />}</>}>
                  <TextField label="" rows={6} value={result.opening.rewritten}
                    onChange={v => setResult(r => ({ ...r, opening: { ...r.opening, rewritten: v } }))} />
                  {result.opening.source === "ai" && (
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 10.5, color: "#6a6250" }}>看原文对照</summary>
                      <div style={{ fontSize: 10.5, lineHeight: 1.7, color: "#6a6250", whiteSpace: "pre-wrap", marginTop: 6 }}>
                        {result.opening.original}
                      </div>
                    </details>
                  )}
                </Section>
              )}
            </>
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
            {(() => {
              const n = result.npcs.filter(x => (x.placement?.mode || "mention") !== "mention").length;
              return n ? `（${n} 人会真的出现）` : "（都只在被提到时注入）";
            })()}
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

// ── 零件 ──────────────────────────────────────────────────────────────────────

function Stat({ label, v }) {
  return (
    <div style={{ display: "flex", fontSize: 11, marginBottom: 4, color: "#8a8270" }}>
      <span style={{ width: 84, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#c8bfa0" }}>{v}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #2a2419", paddingTop: 9 }}>
      <div style={{ fontSize: 11, color: "#d8c8a0", letterSpacing: 1, marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

function Note({ tone = "info", children }) {
  const c = tone === "bad" ? "#d89080" : tone === "warn" ? "#c0a870" : "#7a8a90";
  return (
    <div style={{
      fontSize: 10.5, lineHeight: 1.7, color: c, marginTop: 7,
      padding: "6px 9px", background: "rgba(0,0,0,.3)",
      borderLeft: `2px solid ${c}66`, borderRadius: "0 3px 3px 0",
    }}>{children}</div>
  );
}

function Btn({ children, onClick, tone = "dim", disabled, title }) {
  const main = tone === "main";
  const warn = tone === "warn";
  return (
    <span onClick={disabled ? undefined : onClick} title={title}
      style={{
        cursor: disabled ? "not-allowed" : "pointer", userSelect: "none",
        fontSize: 12, padding: "6px 16px", borderRadius: 4, whiteSpace: "nowrap",
        color: main ? "#1a1206" : warn ? "#c0a870" : "#a89870",
        background: main ? "linear-gradient(180deg,#e0b860,#8a6a2a)" : "rgba(0,0,0,.3)",
        border: `1px solid ${main ? "#e0b860" : warn ? "#5a4a28" : "#3a3428"}`,
        opacity: disabled ? .4 : 1,
        fontWeight: main ? 700 : 400, letterSpacing: main ? 1 : 0,
      }}>{children}</span>
  );
}

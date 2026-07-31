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
import { planScan, runScan, runClassify, peopleAfterClassify } from "./cards/cardScan.js";
import * as scanStore from "./cards/scanStore.js";
import { bucketStatus, acquire } from "./cards/rateLimiter.js";
import { callModel } from "./apiConfig.js";
import {
  S, TIERS, KIND_META, BODY_PUBLIC, BODY_PRIVATE, TERM_MONO,
  Bar, JadeTier, Src, Stat, Note, Btn, Pills, Terminal, barFrame,
} from "./cards/ReviewParts.jsx";
import { sanitizeMoves, TIER_NEIGONG, parseJsonLoose, buildStage3 } from "./cards/scanPrompts.js";
import { normalizePlacement } from "./cards/importedRegistry.js";
import {
  buildPlacementPlan, sanitizePlacementPlan, PLAN_BATCH, PLANNABLE_DISTRICTS,
  PLAN_MAX_TOKENS,
} from "./cards/placementPlan.js";
import { buildCarryPlan, sanitizeCarryPlan, CARRY_PLAN_MAX_TOKENS } from "./cards/carryPlan.js";
import ReviewNpc from "./cards/ReviewNpc.jsx";
import ReviewPlayer from "./cards/ReviewPlayer.jsx";

const EMPTY_SPECIAL = { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 };

// 带 hover 高亮 + 过渡的可点小控件。入册新加的几处（选主角、批量按钮）统一用它——
// 项目其余按钮多是静态内联样式，这里给交互加一层反馈：hover 时提亮描边并上浮 1px，
// 选中(on)时描边与字都用高亮色。手感顺一点。
function TapSpan({ on, onClick, title, children, baseStyle, hi = "#d4a853" }) {
  const [hov, setHov] = useState(false);
  return (
    <span onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        cursor: "pointer", userSelect: "none", transition: "all .14s ease",
        ...baseStyle,
        ...(on ? { borderColor: hi, color: hi, background: "rgba(212,168,83,.14)" } : {}),
        ...(hov && !on ? { borderColor: hi, color: "#e8dcc0", transform: "translateY(-1px)" } : {}),
      }}>{children}</span>
  );
}

// 【为什么 asPlayer 改由入口(playerMode)决定，不再是界面里的勾选】
// 「角色入册」这个入口只做一件事：把别人写进江湖（NPC／世界观）。
// 「这张卡当我自己」只在开局前有意义（角色一旦建好，再导就是覆盖），已挪到开始
// 界面的「开始游戏 → 导入卡当自己」独立入口——那个入口以 playerMode 打开本组件走
// 导主角流程；常规入册 playerMode=false，界面上不再出现「当我自己」，代之以认人后
// 名单上方的「当江湖众人／只当背景传闻」一行。
// 注意：解构块里不要插多行注释——scripts/propsFlow.mjs 的守卫按纯参数列表解析，
// 内嵌注释会让它漏认后面的 prop、误报「传了没解构」。
export default function CardImportScreen({
  onClose, apiCfg, playerName = "少侠",
  onImportNpcs, onImportPlayer, onImportWorld, zoneTheme,
  currentDistrict = "",
  playerMode = false,
  onImportStarterCompanion,
}) {
  const accent = zoneTheme?.accent || "#d4a853";

  const [stage, setStage] = useState("empty");   // empty | parsed | scanning | review
  const [fileName, setFileName] = useState("");
  // 卡自带的立绘。酒馆卡的 PNG 本身就是立绘图，角色卡 JSON 藏在它的 tEXt chunk
  // 里——所以原始字节留着就能当立绘用。裸 JSON 卡没有图，这里是 null。
  // 只存这一份、不做拷贝：审改期与解析在同一次会话里，不需要持久化。
  const [cardImage, setCardImage] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // 是否把这张卡当主角：只由入口(playerMode)决定，界面里不再让玩家临时勾。
  const asPlayer = playerMode;
  // 常规入册的插入方式（认人后玩家在名单上方选）：
  //   "npc"  当江湖众人——正常扫描、落册成 NPC，扫完自动跑一遍荐位
  //   "lore" 只当背景传闻——不进 NPC 名单，只把设定塞世界书，被提及时才浮现
  const [insertMode, setInsertMode] = useState("npc");
  const [picked, setPicked] = useState(() => new Set());
  const [openingIdx, setOpeningIdx] = useState(0);

  const [waitMs, setWaitMs] = useState(0);
  const [bucket, setBucket] = useState(() => bucketStatus());
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(0);       // ≥0 看第几个 NPC；-1 看玩家档案
  const [term, setTerm] = useState([]);
  const [termBig, setTermBig] = useState(false);
  // AI 认人的结果。有它时勾选界面用它，没有就退回机器初判。
  const [classified, setClassified] = useState(null);
  const [classifying, setClassifying] = useState(false);

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
      // PNG 才有图可用（前 8 字节是 PNG magic）。裸 JSON 卡留 null，
      // PortraitPicker 会把"用卡自带的图"置灰并说明原因。
      const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      setCardImage(isPng ? buf : null);
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

  // ── 先认人：只跑阶段 1 ──
  // 【为什么单独一步】原来的顺序是「机器初判 → 勾选 → 扫描时才 AI 分类」，
  // 而人物分组最后有一道按勾选名单的过滤，等于 AI 认出的人进不去。提前跑，
  // 玩家就是在已分好的名单上勾。结果写同一个缓存槽，之后扫描不重复调用。
  const doClassify = async () => {
    if (!parsed || classifying) return;
    setClassifying(true);
    abortRef.current = { aborted: false };
    try {
      const out = await runClassify(parsed, callModel, apiCfg, {
        signal: abortRef.current,
        onWait: (ms) => { setWaitMs(ms); if (ms > 900) pushTerm("wait", `额度用尽，${Math.ceil(ms / 1000)} 秒后继续`, "限流"); },
        onProgress: (p) => pushTerm(p.kind === "start" ? "start" : p.kind, p.msg, "认人"),
      });
      const people = peopleAfterClassify(parsed, out.kindMap, out.groups);
      setClassified({ people, genre: out.genre, multiPerson: out.multiPerson, whyMap: out.whyMap, kindMap: out.kindMap });
      // 认出来的人默认全勾上；玩家仍可逐个取消，最终否决权不交给 AI
      setPicked(new Set(people.map(p => p.name)));
      pushTerm("done",
        `认出 ${people.length} 人${out.genre ? ` · 题材：${out.genre}` : ""}`
        + `${out.multiPerson.length ? ` · ${out.multiPerson.length} 条塞了多人` : ""}`
        + `${out.calls === 0 ? "（用的是缓存，没花调用）" : ""}`,
        "认人");
    } catch (e) {
      if (e.code === "SCAN_ABORTED") pushTerm("fail", "认人已中断", "认人");
      else { pushTerm("fail", e.message.slice(0, 90), "认人"); setErr(`认人失败：${e.message}`); }
    } finally {
      setClassifying(false);
      setWaitMs(0);
    }
  };

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
    // 认过人就用那份名单（peopleAfterClassify 已带 entry），没认过退回机器初判
    const pool = classified
      ? classified.people.map(p => ({
          name: p.name, aliases: p.aliases, entry: p.entry,
          _meta: { mergedFrom: p.mergedFrom || [] },
        }))
      : parsed.npcLoreCandidates;
    const people = pool.filter(c => picked.has(c.name));
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

  // 「只当背景传闻」：不扫描、不落册成 NPC，直接把选中人的设定作为世界书条目导入
  // （走 registerImportedWorld 那条关键词点灯的路，跟地理／势力同源）。他们不进
  // NPC 名单、不出现在任何据点，只在正文提到名字时把设定注入 prompt。
  // 【为什么在这一步就分流】扫描/审改那一整套是为「成为江湖人物」准备的（补数值、
  // 招式、里程碑、落脚），传闻只需要人设文本，认完人就够了，没必要再烧调用。
  const importAsLore = () => {
    const pool = classified ? classified.people : parsed.npcLoreCandidates;
    const items = pool
      .filter(c => picked.has(c.name))
      .map(c => ({
        label: c.name,
        kind: "person",
        keys: [c.name, ...(c.aliases || [])].filter(Boolean),
        content: String(c.entry || "").trim(),
      }))
      .filter(w => w.content);
    pushTerm("done", `收作背景传闻 ${items.length} 条（只在被提到时浮现）`, "传闻");
    if (items.length && onImportWorld) onImportWorld(items);
    onClose?.();
  };

  // 【为什么接一个参数】审改页现在可以只勾一部分人加入——一张卡里常有几个纯粹
  // 的背景人物，玩家未必想把他们都塞进江湖。不传就按全部处理（老行为）。
  const finish = (npcsToImport, starterNpcName) => {
    const list = Array.isArray(npcsToImport) ? npcsToImport : (result?.npcs || []);
    pushTerm("done", `落册 ${list.length} 人${result?.player ? " ＋ 主角档案" : ""}${starterNpcName ? ` ＋ 开局同行「${starterNpcName}」` : ""}`, "落册");
    if (list.length && onImportNpcs) onImportNpcs(list);
    if (result?.player && onImportPlayer) onImportPlayer(result.player, result.opening);
    if (starterNpcName && onImportStarterCompanion) onImportStarterCompanion(starterNpcName);
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
  // 【为什么是 100% 而不是 min(1120px,95vw)】原先写死 1120×800，在 1600 宽以上
  // 的屏幕上四边留一圈空遮罩，而这个界面右侧是长表单（审改页 16 个 Section，
  // 落脚那一节的据点 chip 有二十几个），横向空间越窄 chip 越换行、越往下挤，
  // 结果就是「落脚 · 他会出现在哪」被压到滚动区底部，玩家根本翻不到。
  // 撑满之后左栏 230px 不动，多出来的宽度全给表单。
  // 点遮罩关闭因此失效（没有遮罩了），头部 btn_close 仍在。
  const panel = {
    position: "relative", width: "100%", height: "100%",
    display: "flex", flexDirection: "column", overflow: "hidden",
    backgroundColor: "#14100a",
    backgroundImage: `url('${S("skin_wusha.webp")}')`,
    // 【为什么平铺而不是 cover】这张皮子是 512×512 的方图，cover 会把它放大到
    // 铺满整个全屏面板，纹理里那条对角线就被放大成一道横贯半屏的三角边界（实测
    // 截图里左栏中段那片诡异的斜向暗块就是它）。按原尺寸平铺，纹理密度正常。
    backgroundSize: "512px 512px", backgroundRepeat: "repeat",
    backgroundBlendMode: "multiply",
    borderRadius: 0,
    boxShadow: "inset 0 0 120px rgba(0,0,0,.6)",
  };

  return (
    <div style={shell} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={panel}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          ...barFrame(S("ui/bar_paper.webp")),
          padding: "0 12px", minHeight: 52,
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
              playerMode={playerMode} asPlayer={asPlayer}
              insertMode={insertMode} setInsertMode={setInsertMode}
              picked={picked} setPicked={setPicked}
              classified={classified} classifying={classifying} onClassify={doClassify}
              openingIdx={openingIdx} setOpeningIdx={setOpeningIdx}
              waitMs={waitMs} err={err} term={term} onExpandTerm={() => setTermBig(true)}
              onScan={doScan} onSkip={skipScan} onImportLore={importAsLore}
              onAbort={() => { abortRef.current.aborted = true; }}
            />
          )}
          {stage === "review" && result && (
            <ReviewPane
              parsed={parsed} result={result} accent={accent}
              detail={detail} setDetail={setDetail}
              patchNpc={patchNpc} patchPlayer={patchPlayer} patchWorld={patchWorld}
              setResult={setResult} asPlayer={asPlayer} apiCfg={apiCfg} cardImage={cardImage}
              currentDistrict={currentDistrict}
              autoPlace={insertMode === "npc" && !playerMode}
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
  parsed, accent, plan, stage, playerMode, asPlayer, insertMode, setInsertMode,
  picked, setPicked,
  openingIdx, setOpeningIdx, waitMs, err, onScan, onSkip, onImportLore, onAbort, term, onExpandTerm,
  classified, classifying, onClassify,
}) {
  const { card, report, npcLoreCandidates, unclassified, worldCandidates, metaEntries } = parsed;
  const scanning = stage === "scanning";

  // 认过人之后，名单整个换成 AI 那份——它已经把「三霄」「血角」这类
  // 标签与关键词同名、机器判据够不着的条目认出来了，不再分「候选/待定」两栏。
  const cands = useMemo(() => {
    if (classified) {
      return classified.people.map(p => ({
        name: p.name, aliases: p.aliases, len: p.len,
        merged: p.merged, sure: true, byAi: true, grouped: p.from === "ai",
      }));
    }
    return [
      ...npcLoreCandidates.map(c => ({ name: c.name, aliases: c.aliases, len: c._meta.length, merged: c._meta.mergedFrom.length, sure: true })),
      ...unclassified.map(u => ({ name: u.keys[0] || u.label, aliases: u.keys.slice(1), len: u.length, merged: 0, sure: false })),
    ];
  }, [classified, npcLoreCandidates, unclassified]);

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
        <Bar>{playerMode ? "导入为主角" : "入册名单"}</Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {!classified && !scanning && (
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 10,
              padding: "8px 10px", borderRadius: 4,
              background: "rgba(122,154,112,.08)", border: "1px solid #3a4a34",
            }}>
              <div style={{ flex: 1, fontSize: 10.5, color: "#9aa890", lineHeight: 1.7 }}>
                下面这份名单是按标签与关键词猜的，标「待定」的机器分不出是人是概念。
                让 AI 通读一遍正文能认得准得多。
              </div>
              <Btn onClick={onClassify} tone="main" disabled={classifying || !report.ok}>
                {classifying ? "认人中…" : "先认人"}
              </Btn>
            </div>
          )}
          {classified && !scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, fontSize: 10.5, color: "#7a9a70" }}>
              <span>AI 通读正文后认出 {classified.people.length} 人</span>
              {!!classified.multiPerson.length && (
                <span style={{ color: "#c0a870" }}>
                  · {classified.multiPerson.length} 条塞了多人（{classified.multiPerson.map(m => (m.人名 || []).join("/")).join("；").slice(0, 40)}）
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span onClick={onClassify} title="重新认一遍（走缓存，不额外花调用）"
                style={{ cursor: "pointer", color: "#6a6250" }}>重认</span>
            </div>
          )}
          {classified && !scanning && !playerMode && (
            <div style={{
              marginBottom: 11, padding: "9px 11px", borderRadius: 4,
              background: "rgba(0,0,0,.22)", border: "1px solid #2a2419",
            }}>
              <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 6 }}>这批人想怎么插入曲措乡</div>
              <Pills accent={accent} value={insertMode} onChange={setInsertMode}
                options={[
                  { value: "npc", label: "当江湖众人", title: "正常入册成 NPC，会真的出现在据点、可结交切磋；扫完自动按营生荐位" },
                  { value: "lore", label: "只当背景传闻", title: "不进名单，只把设定塞进世界书，被提到时才浮现" },
                ]} />
              <div style={{ fontSize: 10, color: "#6a6250", marginTop: 6, lineHeight: 1.6 }}>
                {insertMode === "npc"
                  ? "选中的人会成为真正的江湖人物，需要 AI 补一版数值与落脚。"
                  : "选中的人不出现在任何据点，只作为被提及时注入的传闻设定。"}
              </div>
            </div>
          )}
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
                    {c.grouped && <span title="AI 认出这几条写的是同一个人，已合并"
                      style={{ fontSize: 9, color: "#7a9a70", border: "1px solid #3a4a34", borderRadius: 2, padding: "0 3px" }}>合</span>}
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
          ) : (insertMode === "lore" && !playerMode) ? (
            <Btn onClick={onImportLore} tone="main" disabled={!picked.size}
              title={picked.size ? "把选中的人收作被提及时才浮现的传闻设定" : "先勾几个人"}>
              收作背景传闻 {picked.size} 人
            </Btn>
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
  const WIZARD_STEPS = ["选主角", "调主角 · 选队友", "确认落册"];
  const [wizardStep, setWizardStep] = useState(0);
  // 开局同行：Step2 里从「落江湖的 NPC」指定 1 人开局就随队（companion 出战位）。
  // 存名字即可，落册时在 CardImportScreen.finish 里把它单独交给 onImportStarterCompanion。
  const [starterCompanion, setStarterCompanion] = useState(null);
  const stepLabel = WIZARD_STEPS[wizardStep] || "确认落册";
  const canNext = !asPlayer || wizardStep >= 2 || (wizardStep === 0 ? true : true);
  const nextStep = () => setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
  const prevStep = () => setWizardStep(s => Math.max(s - 1, 0));

  // ── 从众人里指定一个当「我自己」（主角）─────────────────────────────────
  // 群像卡的主角常常自己也被当成世界书人物扫了出来（酒馆卡里主角、配角同在世界书
  // 里）。这里让玩家从扫出的人里挑一个填成主角档案；被选中的人自动不再作为 NPC 入库
  // （主角和 NPC 不该是同一人），名单里给他标个「主」。只在 playerMode(asPlayer) 下有意义。
  const [playerFromNpc, setPlayerFromNpc] = useState(null);
  const [bodyBusy, setBodyBusy] = useState(false);   // AI 自动识别体貌中
  const pickRef = useRef(null);                        // 防玩家快速切换时把上一个人的体貌写错人
  const initialPlayerRef = useRef(result.player);
  // AI 返回的 bodyProfile 只取公开层 7 个 key 的非空字符串
  const cleanBody = (bp) => {
    const out = {};
    for (const k of ["height", "build", "face", "skin", "hair", "voice", "clothing"]) {
      if (typeof bp?.[k] === "string" && bp[k].trim()) out[k] = bp[k].trim().slice(0, 40);
    }
    return out;
  };
  const npcToPlayer = (npc) => ({
    name: npc.name || "",
    nameWhy: "",
    gender: "男",
    bodyProfile: {},          // NPC 没有体貌十二项，留空玩家补填
    bodyProfilePrivate: {},
    special: (npc.special && Object.keys(npc.special).length) ? { ...npc.special } : { ...EMPTY_SPECIAL },
    specialWhy: "",
    neigong: Number.isFinite(npc.neigong) ? npc.neigong : 5,
    waigong: Number.isFinite(npc.waigong) ? npc.waigong : 5,
    // 人设正文 + 外貌锚点都并进 persona，套得尽量全（体貌那 7 分项 NPC 没有，留空自填）
    persona: [npc.entry, npc.appearance].filter(Boolean).join("\n") || "",
    dialogueExamples: undefined,
    source: "fromNpc",
  });
  const pickPlayerFrom = async (name) => {
    setPlayerFromNpc(name);
    pickRef.current = name;
    if (name == null) {
      setResult(r => ({ ...r, player: initialPlayerRef.current }));  // 回到空白档案
      return;
    }
    const npc = result.npcs.find(n => n.name === name);
    if (!npc) return;
    setResult(r => ({ ...r, player: npcToPlayer(npc) }));
    // 自动 AI 识别体貌：NPC 只有一段外貌锚点，让 stage3 prompt 把它拆成体貌公开层 7 项
    // （身量/体型/面容/肤色/发式/声音/穿着）。私密层五项照规矩不碰。失败静默、留空手填。
    const src = [npc.appearance, npc.entry].filter(Boolean).join("\n").trim();
    if (!src || !apiCfg) return;
    setBodyBusy(true);
    try {
      await acquire();
      const { system, user } = buildStage3(src, { cardName: npc.name });
      const res = await callModel(apiCfg, system, [{ role: "user", content: user }], { maxTokens: 4000, temperature: 0.6 });
      const bp = cleanBody(parseJsonLoose(res.text || "")?.bodyProfile);
      // 玩家可能已经切走了，只在还选着这个人时才落，别把上个人的体貌写到新选的人身上
      if (pickRef.current === name && Object.keys(bp).length) {
        setResult(r => ({ ...r, player: { ...r.player, bodyProfile: { ...(r.player?.bodyProfile || {}), ...bp } } }));
      }
    } catch { /* 静默，体貌留空玩家手填 */ }
    finally { if (pickRef.current === name) setBodyBusy(false); }
  };

  // 入库名单排除被选为主角的那个人（主角走 player，不重复入 NPC 库）
  const pickedNpcs = result.npcs.filter((n, i) => picked.has(i) && n.name !== playerFromNpc);
  // 「会真的出现」只统计勾选中的——没勾的人压根不进库，算进去是虚报
  const placedCount = pickedNpcs.filter(x => normalizePlacement(x.placement).mode !== "mention").length;

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
    cursor: "pointer", fontSize: 10.5, padding: "2px 8px", borderRadius: 3,
    border: "1px solid #3a3428", color: "#a89870", userSelect: "none",
  };

  // ── AI 一键规划落脚 ──────────────────────────────────────────────────────
  // 【为什么按批而不是一人一次】令牌桶是 5 次/分钟。一人一次的话十个人就要等两
  // 分钟，而落脚判断只需要人物的身份与来历，六个人的摘要塞进一个 prompt 完全放
  // 得下（据点清单本身才八百字）。六人一批意味着三十人也只烧六次额度。
  // 【为什么一批失败不中断】每批是独立的一次调用，第二批 429 不该让第一批已经
  // 规划好的人白丢。失败的批次记数，最后一并告诉玩家哪几批没成、可以再点一次。
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [planProg, setPlanProg] = useState(0);

  const planAll = async () => {
    const npcs = result.npcs;
    if (planBusy || !npcs.length) return;
    setPlanBusy(true); setPlanProg(0);

    // 分批时把全局下标一起带上——sanitizePlacementPlan 返回的 index 是相对这一
    // 批的，直接拿去 patchNpc 会改错人
    const batches = [];
    for (let i = 0; i < npcs.length; i += PLAN_BATCH) {
      batches.push(npcs.slice(i, i + PLAN_BATCH).map((n, j) => ({ npc: n, at: i + j })));
    }

    let done = 0, placed = 0, failed = 0, rejected = 0;
    for (let b = 0; b < batches.length; b++) {
      const grp = batches[b];
      const tag = `第 ${b + 1}/${batches.length} 批`;
      try {
        setPlanMsg(`${tag} · 等额度`);
        await acquire(ms => setPlanMsg(`${tag} · 排队 ${Math.ceil(ms / 1000)}s`));
        setPlanMsg(`${tag} · 正在相地（${grp.length} 人）`);
        const list = grp.map(g => g.npc);
        const { system, user } = buildPlacementPlan(list, PLANNABLE_DISTRICTS);
        const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
          { maxTokens: PLAN_MAX_TOKENS.batch, temperature: 0.6 });
        const plans = sanitizePlacementPlan(parseJsonLoose(res.text || ""), list, PLANNABLE_DISTRICTS);
        if (!plans.length) { failed++; } else {
          for (const p of plans) {
            const target = grp[p.index];
            if (!target) continue;
            patchNpc(target.at, {
              placement: p.placement, placementWhy: p.why, placementRejected: p.rejected,
            });
            if (p.placement.mode !== "mention") placed++;
            if (p.rejected) rejected++;
          }
        }
      } catch (e) {
        failed++;
        const raw = e?.raw ? `　模型吐的是：${String(e.raw).replace(/\s+/g, " ").slice(0, 50)}` : "";
        setPlanMsg(`${tag} 没成：${String(e?.message || e).slice(0, 70)}${raw}`);
      }
      done += grp.length;
      setPlanProg(done / npcs.length);
    }

    setPlanMsg([
      `规划完毕 · ${placed} 人会真的出现`,
      rejected ? `${rejected} 人的据点不在地图里已退回` : "",
      failed ? `${failed} 批没成，可以再点一次` : "",
    ].filter(Boolean).join("，"));
    setPlanBusy(false);
  };

  // ── AI 一键配装备 ────────────────────────────────────────────────────────
  // 跟一键规划落脚同构：按批把人设摘要塞进 prompt，AI 按身份/品阶配 2-4 件随身物，
  // 回来的物件过 sanitizeCarryPlan（品阶不超此人、类别合法）后 patchNpc 进 carry。
  // 一批失败不拖累别批，失败记数最后一并报。
  const [equipBusy, setEquipBusy] = useState(false);
  const [equipMsg, setEquipMsg] = useState("");
  const [equipProg, setEquipProg] = useState(0);

  const equipAll = async () => {
    const npcs = result.npcs;
    if (equipBusy || !npcs.length) return;
    setEquipBusy(true); setEquipProg(0);
    const batches = [];
    for (let i = 0; i < npcs.length; i += PLAN_BATCH) {
      batches.push(npcs.slice(i, i + PLAN_BATCH).map((n, j) => ({ npc: n, at: i + j })));
    }
    let done = 0, equipped = 0, failed = 0;
    for (let b = 0; b < batches.length; b++) {
      const grp = batches[b];
      const tag = `第 ${b + 1}/${batches.length} 批`;
      try {
        setEquipMsg(`${tag} · 等额度`);
        await acquire(ms => setEquipMsg(`${tag} · 排队 ${Math.ceil(ms / 1000)}s`));
        setEquipMsg(`${tag} · 正在配装（${grp.length} 人）`);
        const list = grp.map(g => g.npc);
        const { system, user } = buildCarryPlan(list);
        const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
          { maxTokens: CARRY_PLAN_MAX_TOKENS.batch, temperature: 0.7 });
        const plans = sanitizeCarryPlan(parseJsonLoose(res.text || ""), list);
        if (!plans.length) { failed++; } else {
          for (const p of plans) {
            const target = grp[p.index];
            if (!target) continue;
            patchNpc(target.at, { carry: p.items });
            equipped++;
          }
        }
      } catch (e) {
        failed++;
        setEquipMsg(`${tag} 没成：${String(e?.message || e).slice(0, 70)}`);
      }
      done += grp.length;
      setEquipProg(done / npcs.length);
    }
    setEquipMsg([`配装完毕 · ${equipped} 人已配`, failed ? `${failed} 批没成，可再点一次` : ""].filter(Boolean).join("，"));
    setEquipBusy(false);
  };

  // 「当江湖众人」流程：一进过目页就自动按营生跑一遍荐位，不必玩家手点。
  // 【为什么用 ref 而不只靠 planBusy】planBusy 是异步置起的，StrictMode 双挂载
  // 或 result 变化可能在它置起前重入；autoRanRef 保证这辈子只自动跑一次。玩家仍
  // 可用底部「AI 一键规划落脚」手动重跑，那条路不看这个 ref。
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!autoPlace || autoRanRef.current || !result.npcs.length) return;
    autoRanRef.current = true;
    planAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlace]);

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

  // ── 向导渲染：asPlayer 走三步，否则走原有的「名单 + 逐个设置」──
  return (
    <>
      {/* 开局向导：顶部步骤导航（仿墨色江湖 wizard 骨架）+ 主内容区 + 上一步/下一步 */}
      {asPlayer ? (
        <>
          {/* 步骤导航条 */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
            padding: "8px 12px", borderBottom: "1px solid #2a2419",
            background: "rgba(0,0,0,.25)",
          }}>
            {WIZARD_STEPS.map((s, idx) => (
              <span key={s}
                onClick={() => setWizardStep(idx)}
                style={{
                  cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 7,
                  padding: "5px 12px", borderRadius: 4, transition: "all .15s ease",
                  border: `1px solid ${wizardStep === idx ? accent : "transparent"}`,
                  background: wizardStep === idx ? "rgba(212,168,83,.12)" : "transparent",
                  color: wizardStep === idx ? accent : "#8a8270",
                }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 10.5, flexShrink: 0,
                  background: wizardStep === idx ? "rgba(212,168,83,.2)" : "rgba(0,0,0,.3)",
                  border: `1px solid ${wizardStep === idx ? accent : "#3a3428"}`,
                }}>{idx + 1}</span>
                <span style={{ fontSize: 12.5, letterSpacing: 1 }}>{s}</span>
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: "#6a6250" }}>
              {playerFromNpc ? `主角：${playerFromNpc}` : "主角：待定"}
            </span>
          </div>

          {/* 主内容区 */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
            {wizardStep === 0 && (
              /* ── ① 选主角：从认出的 NPC 里挑谁当主角 ── */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <div style={{ fontSize: 15, color: "#e8dcc0", letterSpacing: 3, marginBottom: 4 }}>
                  这张卡里，谁当「我自己」（主角）？
                </div>
                <div style={{ fontSize: 11, color: "#8a8270", marginBottom: 16, lineHeight: 1.8 }}>
                  群像卡的主角常常混在世界书里。选一个人就把他套成主角档案（名字/七维/内外功/人设），
                  他会自动从「入江湖」名单挪走，不会重复出现。不选就用空白档案，下一步自己填。
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  <div onClick={() => pickPlayerFrom(null)} title="从头手写主角"
                    style={{
                      cursor: "pointer", padding: "14px 12px", borderRadius: 6, textAlign: "center",
                      border: `1px solid ${playerFromNpc == null ? accent : "#3a3428"}`,
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
                          cursor: "pointer", padding: "12px", borderRadius: 6,
                          border: `1px solid ${on ? accent : "#3a3428"}`,
                          background: on ? "rgba(212,168,83,.12)" : "rgba(0,0,0,.25)",
                          transition: "all .15s ease",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <JadeTier value={n.levelCap} size={22} />
                          <span style={{ color: on ? accent : "#e8dcc0", fontSize: 13, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n.name}
                          </span>
                          {on && <span style={{ color: accent, fontSize: 11 }}>◉</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "#6a6250", lineHeight: 1.6, minHeight: 30 }}>
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
              /* ── ② 调主角 · 选队友：左主角全字段，右队友勾选 ── */
              <>
                <div style={{ flex: 3, minWidth: 0, overflowY: "auto", padding: "12px 16px 28px" }}>
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
                </div>
                <div style={{ flex: 2, minWidth: 0, borderLeft: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
                  <Bar right={<span style={{ fontSize: 10, color: "#8a8270" }}>{pickedNpcs.length} 人</span>}>
                    谁一起入江湖
                  </Bar>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                    <div style={{ fontSize: 10.5, color: "#8a8270", lineHeight: 1.8, marginBottom: 8 }}>
                      勾选的人会真的落进曲措乡（可结交切磋）；再从勾选中指定 1 人开局就随队（开局同行）。
                    </div>

                    {/* 批量设置（落脚/品阶），复用原有逻辑 */}
                    {result.npcs.length > 0 && (
                      <div style={{ marginBottom: 10, padding: "8px 9px", borderRadius: 4, background: "rgba(0,0,0,.2)", border: "1px solid #2a2419" }}>
                        <div style={{ fontSize: 10, color: "#8a8270", marginBottom: 6 }}>批量设置 · 作用于勾选中的人</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                          <span style={{ fontSize: 10, color: "#6a6250", width: 26 }}>落脚</span>
                          <select value={batchDistrict} onChange={e => setBatchDistrict(e.target.value)}
                            style={{ fontSize: 10.5, padding: "2px 4px", background: "#1a1206", color: "#d8c8a0", border: "1px solid #3a3428", borderRadius: 3, maxWidth: 100 }}>
                            {PLANNABLE_DISTRICTS.map(d => <option key={d} value={d} style={{ background: "#1a1206" }}>{d}</option>)}
                          </select>
                          <TapSpan onClick={() => applyBatchPlacement("resident", batchDistrict)} title={`勾选的人全部驻场于${batchDistrict}`} baseStyle={batchBtn}>全驻此地</TapSpan>
                          <TapSpan onClick={() => applyBatchPlacement("wander", batchDistrict)} title="勾选的人全部改为游走" baseStyle={batchBtn}>全游走</TapSpan>
                          <TapSpan onClick={() => applyBatchPlacement("mention", null)} title="勾选的人全部改为不落地（只被提到时注入）" baseStyle={batchBtn}>全不落地</TapSpan>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: "#6a6250", width: 26 }}>品阶</span>
                          {["白", "绿", "蓝", "紫", "橙", "红"].map((label, lv) => (
                            <TapSpan key={lv} onClick={() => applyBatchTier(lv)} title={`勾选的人全部调到${label}档`} baseStyle={batchBtn}>{label}</TapSpan>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 队友名单：勾选落江湖 + 指定开局同行 */}
                    {result.npcs.map((n, i) => {
                      const isPlayerSrc = playerFromNpc != null && n.name === playerFromNpc;
                      const on = picked.has(i);
                      const isStarter = starterCompanion === n.name;
                      return (
                        <div key={i}
                          style={{
                            display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                            borderRadius: 4, marginBottom: 3,
                            background: isStarter ? "rgba(138,176,112,.10)" : "transparent",
                            borderLeft: `2px solid ${isStarter ? "#8ab070" : "transparent"}`,
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
                                fontSize: 12, color: on ? accent : "#4a4436",
                              }}>{on ? "◉" : "○"}</span>
                          )}
                          <JadeTier value={n.levelCap} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "#e8dcc0", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {n.name}{isPlayerSrc && <span style={{ color: accent, fontSize: 9.5, marginLeft: 5 }}>· 主角</span>}
                            </div>
                            <div style={{ color: "#6a6250", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
                          </div>
                          {/* 开局同行单选：只能从勾选中挑 */}
                          {!isPlayerSrc && on && (
                            <span onClick={() => setStarterCompanion(isStarter ? null : n.name)}
                              title={isStarter ? "点掉，他就不随队开局" : "让他开局就随队（唯一出战位）"}
                              style={{
                                cursor: "pointer", flexShrink: 0, fontSize: 10, padding: "2px 7px", borderRadius: 3,
                                border: `1px solid ${isStarter ? "#8ab070" : "#3a4a34"}`,
                                color: isStarter ? "#bce8ac" : "#7a9a70",
                                background: isStarter ? "rgba(138,176,112,.15)" : "transparent",
                              }}>{isStarter ? "同行 ◉" : "同行"}</span>
                          )}
                        </div>
                      );
                    })}
                    {!result.npcs.length && (
                      <div style={{ fontSize: 10.5, color: "#6a6250", padding: "12px 0", textAlign: "center" }}>
                        这张卡里没有其他人了，就你自己开局。
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {wizardStep === 2 && (
              /* ── ③ 确认落册：总览 + 加入 ── */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                <div style={{ fontSize: 15, color: "#e8dcc0", letterSpacing: 3, marginBottom: 16 }}>确认落册</div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 4, background: "rgba(212,168,83,.06)", border: `1px solid ${accent}44` }}>
                  <div style={{ fontSize: 11.5, color: "#d8c8a0", marginBottom: 6 }}>主角</div>
                  <div style={{ fontSize: 13, color: "#e8dcc0" }}>
                    {result.player?.name || playerFromNpc || "（未填名讳）"}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#8a8270", marginTop: 4, lineHeight: 1.8 }}>
                    体貌 {Object.values(result.player?.bodyProfile || {}).filter(v => (v || "").trim()).length}/7 项
                    · {result.player?.gender || "性别未定"}
                  </div>
                </div>

                <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 4, background: "rgba(0,0,0,.2)", border: "1px solid #2a2419" }}>
                  <div style={{ fontSize: 11.5, color: "#d8c8a0", marginBottom: 6 }}>
                    落江湖 {pickedNpcs.length} 人
                    {placedCount ? `（${placedCount} 人会真的出现）` : "（都只在被提到时注入）"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {pickedNpcs.map((n, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "3px 9px", borderRadius: 3,
                        border: `1px solid ${starterCompanion === n.name ? "#8ab070" : "#3a3428"}`,
                        color: starterCompanion === n.name ? "#bce8ac" : "#c8bfa0",
                        background: starterCompanion === n.name ? "rgba(138,176,112,.15)" : "rgba(0,0,0,.2)",
                      }}>
                        {n.name}
                        {starterCompanion === n.name ? " · 开局同行" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 10.5, color: "#6a6250", lineHeight: 1.9 }}>
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
                  <div style={{ height: 3, borderRadius: 2, overflow: "hidden", background: "rgba(0,0,0,.45)", marginBottom: 5 }}>
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

              {/* AI 一键规划落脚 / 配装备，只在选队友那步给（Step1） */}
              {wizardStep === 1 && (
                <>
                  <span onClick={planBusy ? undefined : planAll}
                    title={`让 AI 按人设判断每个人该驻场还是游走。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，规划完你还能自己改`}
                    style={{
                      cursor: planBusy ? "wait" : "pointer", userSelect: "none",
                      fontSize: 12, padding: "6px 14px", borderRadius: 4, whiteSpace: "nowrap",
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
                      fontSize: 12, padding: "6px 14px", borderRadius: 4, whiteSpace: "nowrap",
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

              {wizardStep < 2 ? (
                <Btn onClick={nextStep} tone="main" disabled={wizardStep === 0 && result.npcs.length > 0 ? false : false}>
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
        </>
      ) : (
        /* ── 游戏中常规入册：直接选 NPC 逐个设置（4:6 分栏） ── */
        <>
          {/* 4:6 分栏。原来左栏定宽 230px，那是面板还锁在 1120 宽时定的比例；撑满
              之后名单挤在一条窄带里，而运行日志横向被压得每行都折。minWidth 0 是必须
              的——flex 子项默认 min-width:auto，里面的长人名会把栏撑破 4:6 的比例。 */}
          <div style={{ flex: 4, minWidth: 0, borderRight: "1px solid #2a2419", display: "flex", flexDirection: "column" }}>
            <Bar>过目定稿 · 逐个设置</Bar>

            {/* 名单垂直居中：一张卡常见三五个人，顶部对齐会在下面留一大片死黑。
                margin auto 0 而不是 justifyContent center——后者在内容超出容器时会把
                顶部裁掉滚不到（flex 的老陷阱）。外层再 alignSelf center 加限宽，免得
                4:6 分栏后条目在一千像素宽的栏里拉得很散。 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column" }}>
              {result.npcs.length > 0 && (
                <div style={{ flexShrink: 0, marginBottom: 10, padding: "8px 9px", borderRadius: 4, background: "rgba(0,0,0,.2)", border: "1px solid #2a2419" }}>
                  <div style={{ fontSize: 10, color: "#8a8270", marginBottom: 6 }}>批量设置 · 作用于勾选中的人</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                    <span style={{ fontSize: 10, color: "#6a6250", width: 26 }}>落脚</span>
                    <select value={batchDistrict} onChange={e => setBatchDistrict(e.target.value)}
                      style={{ fontSize: 10.5, padding: "2px 4px", background: "#1a1206", color: "#d8c8a0", border: "1px solid #3a3428", borderRadius: 3, maxWidth: 100 }}>
                      {PLANNABLE_DISTRICTS.map(d => <option key={d} value={d} style={{ background: "#1a1206" }}>{d}</option>)}
                    </select>
                    <TapSpan onClick={() => applyBatchPlacement("resident", batchDistrict)} title={`勾选的人全部驻场于${batchDistrict}`} baseStyle={batchBtn}>全驻此地</TapSpan>
                    <TapSpan onClick={() => applyBatchPlacement("wander", batchDistrict)} title="勾选的人全部改为游走" baseStyle={batchBtn}>全游走</TapSpan>
                    <TapSpan onClick={() => applyBatchPlacement("mention", null)} title="勾选的人全部改为不落地（只被提到时注入）" baseStyle={batchBtn}>全不落地</TapSpan>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#6a6250", width: 26 }}>品阶</span>
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
                    padding: "6px 8px", borderRadius: 4, marginBottom: 3,
                    background: detail === i ? "rgba(212,168,83,.12)" : "transparent",
                    borderLeft: `2px solid ${detail === i ? accent : "transparent"}`,
                    opacity: picked.has(i) ? 1 : .45,
                  }}>
                  <span onClick={e => { e.stopPropagation(); toggleOne(i); }}
                    title={picked.has(i) ? "点掉就不加入" : "点上加入"}
                    style={{
                      cursor: "pointer", flexShrink: 0, width: 14, textAlign: "center",
                      fontSize: 12, color: picked.has(i) ? accent : "#4a4436",
                    }}>{picked.has(i) ? "◉" : "○"}</span>
                  <JadeTier value={n.levelCap} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e8dcc0", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.name}
                    </div>
                    <div style={{ color: "#6a6250", fontSize: 9.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.brief}</div>
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
                  {n.source === "fallback" && <span title="全是默认值" style={{ fontSize: 9, color: "#6a6250" }}>默</span>}
                </div>
                );
              })}
              </div>
            </div>
            <Terminal lines={term} height="min(30vh, 320px)" onExpand={onExpandTerm} />
          </div>

          <div style={{ flex: 6, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Bar right={result.genre ? <span style={{ fontSize: 10, color: "#8a8270" }}>{result.genre}</span> : null}>
              {cur ? cur.name : "过目定稿"}
            </Bar>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 28px" }}>
              {cur ? (
                <ReviewNpc npc={cur} accent={accent} dropped={dropped} apiCfg={apiCfg} cardImage={cardImage}
                  currentDistrict={currentDistrict}
                  onPatch={patch => patchNpc(detail, patch)} />
              ) : (
                <div style={{ fontSize: 10.5, color: "#6a6250", lineHeight: 1.9, padding: "4px 4px", textAlign: "center" }}>
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
                    <div style={{ height: 3, borderRadius: 2, overflow: "hidden", background: "rgba(0,0,0,.45)", marginBottom: 5 }}>
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
                    padding: "6px 12px", borderRadius: 4, whiteSpace: "nowrap",
                    border: `1px solid ${allOn ? accent : "#5a5038"}`,
                    background: "rgba(0,0,0,.3)",
                    color: allOn ? accent : "#cabfa0", textShadow: "0 1px 2px rgba(0,0,0,.85)",
                  }}>{allOn ? "◉ 全不选" : "○ 全选"}</span>

                {/* AI 一键规划落脚。据点从本作地图里选，回来的东西过白名单，玩家再改 */}
                <span onClick={planBusy ? undefined : planAll}
                  title={`让 AI 按人设判断每个人该驻场还是游走。${result.npcs.length} 人分 ${Math.ceil(result.npcs.length / PLAN_BATCH)} 批，据点只能从本作地图里选，规划完你还能自己改`}
                  style={{
                    cursor: planBusy ? "wait" : "pointer", userSelect: "none",
                    fontSize: 12, padding: "6px 14px", borderRadius: 4, whiteSpace: "nowrap",
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
                    fontSize: 12, padding: "6px 14px", borderRadius: 4, whiteSpace: "nowrap",
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

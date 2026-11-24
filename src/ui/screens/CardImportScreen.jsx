// 角色入册 —— 角色卡导入界面
// ============================================================================
// 三段流程：拖卡（empty）→ 归类与勾选（parsed/scanning）→ 过目定稿（review）。
// 审改那一段按「导入映射表」的顺序覆盖全字段，NPC 与玩家各一套，拆到
// ReviewNpc.jsx / ReviewPlayer.jsx；共用零件在 cards/widgets.jsx。
//
// 【AI 扫描是按钮不是关卡】免费反代 5 次/分钟、随时 429。解析阶段（纯代码）就已经
// 把所有必填字段填满了，玩家手改也能完成入册。外部服务挂了不该让人连导入都做不了。

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { parseCharacterCard } from "../../domain/rules/cards/cardParse.js";
import { planScan, runScan, runClassify, peopleAfterClassify } from "../../engine/ports/cardScan.js";
import * as scanStore from "../../infra/scanStore.js";
import { bucketStatus } from "../../domain/rules/cards/rateLimiter.js";
import {
  S, TERM_MONO,
  Terminal, barFrame,
} from "./cards/widgets.jsx";
import { fillPlayer, buildFallbackResult } from "./cards/importDefaults.js";
import EmptyPane from "./cards/EmptyPane.jsx";
import ParsedPane from "./cards/ParsedPane.jsx";
import ReviewPane from "./cards/ReviewPane.jsx";
import ImportSelfTutorial, { IMPORT_SELF_TUTORIAL_KEY } from "./cards/ImportSelfTutorial.jsx";

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
  const accent = zoneTheme?.accent || "var(--warn)";

  const [stage, setStage] = useState("empty");   // empty | parsed | scanning | review
  const [fileName, setFileName] = useState("");
  // 卡自带的立绘。酒馆卡的 PNG 本身就是立绘图，角色卡 JSON 藏在它的 tEXt chunk
  // 里——所以原始字节留着就能当立绘用。裸 JSON 卡没有图，这里是 null。
  // 只存这一份、不做拷贝：审改期与解析在同一次会话里，不需要持久化。
  const [cardImage, setCardImage] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // 「导入卡当自己」入门教程：进来先弹一次，看过记进 localStorage 之后不再自动弹；
  // 标题栏留「教程」随时可重看。常规入册(playerMode=false)不弹。
  const [showTutorial, setShowTutorial] = useState(() => {
    if (!playerMode) return false;
    try { return !localStorage.getItem(IMPORT_SELF_TUTORIAL_KEY); } catch { return true; }
  });
  const dismissTutorial = useCallback(() => {
    try { localStorage.setItem(IMPORT_SELF_TUTORIAL_KEY, "1"); } catch { /* ignore */ }
    setShowTutorial(false);
  }, []);

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
      const out = await runClassify(parsed, null, apiCfg, {
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
      const out = await runScan(parsed, null, apiCfg, {
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
      setResult({ ...out, world: initWorld(parsed), player: out.player ? fillPlayer(out.player, parsed?.personaCandidate) : null });
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
    setResult(buildFallbackResult({
      people, asPlayer, parsed, openingIdx, world: initWorld(parsed),
    }));
    pushTerm("info", `跳过 AI，${people.length} 人全部用默认值`, "手填");
    setDetail(people.length ? 0 : -1);
    setStage("review");
  };

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
    backgroundColor: "var(--bg-panel)",
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
    <div className="mobile-overlay-root" style={shell} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="mobile-overlay-panel mobile-card-import-panel" style={panel}>
        <div className="mobile-overlay-header" style={{
          display: "flex", alignItems: "center", gap: 10,
          ...barFrame(S("ui/bar_paper.webp")),
          padding: "0 12px", minHeight: 52,
        }}>
          <img src={S("ui/scroll_ic.webp")} alt="" style={{ width: 22, height: 22, opacity: .9 }} />
          <span style={{ color: "var(--tutorial-title)", fontSize: 16, letterSpacing: 5, textShadow: "0 1px 4px var(--black)" }}>{playerMode ? "导入角色卡当自己" : "角色入册"}</span>
          {fileName && <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>{fileName}</span>}
          <span style={{ flex: 1 }} />
          {playerMode && (
            <span onClick={() => setShowTutorial(true)} title="重看这条流程的教程"
              style={{
                cursor: "pointer", userSelect: "none", fontSize: 11, color: accent,
                border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`, borderRadius: 0, padding: "3px 10px", marginRight: 8,
              }}>教程</span>
          )}
          <span title={`调用额度 ${bucket.tokens}/${bucket.cap}，每 12 秒回一次`}
            style={{ display: "flex", gap: 3, alignItems: "center", marginRight: 6 }}>
            {Array.from({ length: bucket.cap }).map((_, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i < bucket.tokens ? accent : "transparent",
                border: `1px solid ${i < bucket.tokens ? accent : "var(--border)"}`,
              }} />
            ))}
          </span>
          <span className="mobile-card-import-close" onClick={onClose} role="button" aria-label="关闭角色入册">
            <img src={S("ui/btn_close.webp")} alt="" style={{ width: 24, height: 24, cursor: "pointer", opacity: .85 }} />
          </span>
        </div>

        <div className="mobile-card-import-body" style={{ flex: 1, overflow: "hidden", display: "flex" }}>
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
              style={{ width: "100%", maxWidth: 760, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0, overflow: "hidden" }}>
              <Terminal lines={term} height={440} />
              <div style={{ padding: "6px 10px", textAlign: "right", borderTop: "1px solid var(--border)" }}>
                <span onClick={() => setTermBig(false)}
                  style={{ cursor: "pointer", fontFamily: TERM_MONO, fontSize: 10, color: "var(--info)" }}>关闭 ✕</span>
              </div>
            </div>
          </div>
        )}

        {showTutorial && <ImportSelfTutorial accent={accent} onClose={dismissTutorial} />}

        <input ref={fileRef} type="file" accept=".png,.json" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

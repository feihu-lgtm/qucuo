// 曲措乡 · 调试前端（DebugConsole）
// ==================================================================
// 一个独立于游戏的调试页面（/debug.html）：不经过开局界面，点按钮就跑
// "纯逻辑 / 调 AI"的各项检查、把结果当文字打进下面的输出面板。等价于终端
// 的 tools/debug.mjs，只是换成了可点的浏览器界面。
//
// · 纯逻辑（内层移动 / MVU 裁决）随时能点。
// · 调 AI（API 连通 / 叙事→状态）复用游戏在 ⚙设置 里存的 API 配置
//   （localStorage，loadConfig 读取）；没配就提示去游戏里配，key 只显后 4 位。

import React, { useState } from "react";
import { loadConfig, callModel } from "./apiConfig.js";
import { describeInnerArrival } from "./mapNarration.js";
import { resolveInnerExit } from "./innerMap.js";
import { extractMvuBlock, applyMvuCommands, initialVarTree } from "./mvu.js";
import { callExtraction } from "./extractionEngine.js";

const redact = (k) => (k ? `***${String(k).slice(-4)}` : "(空)");

export default function DebugConsole() {
  const [out, setOut] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState(() => loadConfig());

  const log = (...lines) => setOut((o) => [...o, ...lines]);
  const clear = () => setOut([]);
  const reloadCfg = () => { const c = loadConfig(); setCfg(c); log("↻ 已重载游戏 API 配置。", ""); };

  // ── 纯逻辑：内层移动方位描述 ──
  function runInner() {
    log("========== 内层移动 · 鱼定村 ==========");
    const d = "鱼定村", from = "村口";
    for (const dir of ["e", "s", "n", "w"]) {
      const to = resolveInnerExit(d, from, dir);
      log(`· ${from} --${dir}--> ${to ?? "（此方向无内层出口）"}`);
      if (to) describeInnerArrival(d, from, to, dir, { flags: [] }).forEach((l) => log(`    [${l.t}] ${l.text.trim()}`));
    }
    log("· 末端房间：歇马居 --n--> 护镖站");
    describeInnerArrival(d, "歇马居", "护镖站", "n", { flags: [] }).forEach((l) => log(`    [${l.t}] ${l.text.trim()}`));
    log("");
  }

  // ── 纯逻辑：<mvu> 提取 + 系统裁决 ──
  function runMvu() {
    log("========== MVU 提取 + 裁决 ==========");
    const raw = [
      "<mvu>",
      "_.set('角色.呼延雪.好感度', 20);",
      "_.add('角色.呼延雪.好感度', 999);",   // 超幅度：应被钳制
      "_.set('世界.天气', '晴');",           // 合法路径
      "_.set('黑客.注入', true);",           // 越权路径：应被拒
      "</mvu>",
    ].join("\n");
    const { commands } = extractMvuBlock(raw);
    const { tree, applied, rejected } = applyMvuCommands(initialVarTree(), commands);
    log(`提取到 ${commands.length} 条指令 → 裁决通过 ${applied.length}、拒绝 ${rejected.length}`);
    log(`呼延雪好感度最终 = ${tree.角色?.呼延雪?.好感度}（+999 应被钳制在合法幅度内）`);
    log(`越权路径「黑客.注入」是否被挡：${tree.黑客 === undefined ? "是 ✓" : "否 ✗"}`);
    if (rejected.length) log(`被拒明细：${rejected.map((r) => (r && r.path) || JSON.stringify(r)).join("、")}`);
    log("");
  }

  // ── 调 AI：callModel 连通 ──
  async function runApi() {
    const c = loadConfig();
    log("========== API 连通 · callModel ==========");
    if (!c.apiKey) { log("⚠ 未配置 API key。去游戏 ⚙设置 里填好，再点上方「重载配置」。", ""); return; }
    setBusy(true);
    log(`${c.apiType} · ${c.model} · key ${redact(c.apiKey)}`);
    const t0 = Date.now();
    try {
      const { text } = await callModel(c, "你是连通性测试助手，只回极短的话，不要多余解释。",
        [{ role: "user", content: "只回四个字：连通正常" }], { maxTokens: c.callTokenLimits?.connectionTest ?? 200, callLabel: "调试面板·连通性测试" });
      log(`✓ 调用成功（${Date.now() - t0}ms）：「${text.trim().slice(0, 40)}」`, "");
    } catch (e) { log(`✗ 调用失败（${Date.now() - t0}ms）：${e.message || e}`, ""); }
    setBusy(false);
  }

  // ── 调 AI：callExtraction 叙事→状态 ──
  async function runExtract() {
    const c = loadConfig();
    log("========== 叙事→状态 · callExtraction ==========");
    if (!c.apiKey) { log("⚠ 未配置 API key。去游戏 ⚙设置 里填好，再点上方「重载配置」。", ""); return; }
    setBusy(true);
    const narrative = "你从怀里摸出一壶温热的青稞酒递过去，呼延雪怔了怔，接过时指尖微顿，冷淡的眉眼间难得柔和了几分，低声道了句「有心了」。";
    const state = {
      room: { name: "雪山派·内堂", npcs: [{ name: "呼延雪" }], items: [], exits: ["s"] },
      char: { hp: [80, 100] }, inv: ["青稞酒"], invText: "青稞酒", dao: { karma: 0, jie: 0 },
      varTree: { 角色: { 呼延雪: { 好感度: 20, 态度: "冷淡" } } }, lockedDestName: null, lockedExits: null,
    };
    log(`意图 TALK_CASUAL｜叙事：${narrative.slice(0, 26)}…`);
    const t0 = Date.now();
    try {
      const r = await callExtraction("TALK_CASUAL", narrative, state, c);
      log(`✓ 提取成功（${Date.now() - t0}ms）`, `p       = ${JSON.stringify(r.p)}`, `mvu指令 = ${JSON.stringify(r.mvuCommands)}`, "");
    } catch (e) { log(`✗ 提取失败（${Date.now() - t0}ms）：${e.message || e}`, ""); }
    setBusy(false);
  }

  const btn = {
    background: "#2a2214", color: "#e8d6a8", border: "1px solid #6b5836",
    padding: "8px 14px", borderRadius: 0, cursor: busy ? "wait" : "pointer",
    fontSize: 14, fontFamily: "inherit", opacity: busy ? 0.6 : 1,
  };
  const pureBtn = { ...btn, borderColor: "#3f5a3f", color: "#bce0bc" };

  return (
    <div style={{
      minHeight: "100vh", background: "#14110c", color: "#d8c7a0",
      fontFamily: '"Songti SC", "SimSun", serif', padding: "clamp(12px,4vw,24px) clamp(10px,3vw,20px)", boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, color: "#e8c874", margin: "0 0 4px", letterSpacing: 2 }}>曲措乡 · 调试台</h1>
        <div style={{ fontSize: 12, color: "#8a7a58", marginBottom: 16 }}>
          不经开局界面，点按钮跑检查、看文字输出。等价于终端 <code>npm run debug</code>。
        </div>

        {/* 配置状态 */}
        <div style={{
          background: "#1c1810", border: "1px solid #3a3020", borderRadius: 0,
          padding: "10px 14px", marginBottom: 16, fontSize: 13,
        }}>
          <span style={{ color: "#8a7a58" }}>当前 API 配置（来自游戏 ⚙设置 · localStorage）：</span>{" "}
          {cfg.apiKey
            ? <span style={{ color: "#bce0bc" }}>{cfg.apiType} · {cfg.model} · key {redact(cfg.apiKey)}</span>
            : <span style={{ color: "#d08a6a" }}>未配置（调 AI 的按钮会提示）</span>}
          <button onClick={reloadCfg} style={{ ...btn, padding: "3px 10px", marginLeft: 12, fontSize: 12 }}>重载配置</button>
        </div>

        {/* 按钮区 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          <button style={pureBtn} onClick={runInner} disabled={busy}>内层移动（纯逻辑）</button>
          <button style={pureBtn} onClick={runMvu} disabled={busy}>MVU 裁决（纯逻辑）</button>
          <button style={btn} onClick={runApi} disabled={busy}>API 连通（调 AI）</button>
          <button style={btn} onClick={runExtract} disabled={busy}>叙事→状态（调 AI）</button>
          <button style={{ ...btn, borderColor: "#5a3a3a", color: "#d0a0a0", marginLeft: "auto" }} onClick={clear} disabled={busy}>清屏</button>
        </div>

        {/* 输出面板 */}
        <pre style={{
          background: "#0e0c08", border: "1px solid #2a2418", borderRadius: 0,
          padding: 16, minHeight: 320, maxHeight: "60vh", overflow: "auto",
          fontFamily: '"SF Mono", "Menlo", monospace', fontSize: 12.5, lineHeight: 1.6,
          color: "#cdbf9a", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
        }}>
          {out.length ? out.join("\n") : "（点上面的按钮开始…纯逻辑按钮随时能点；调 AI 的按钮需要先在游戏里配好 API）"}
          {busy ? "\n\n⏳ 正在调用 AI……" : ""}
        </pre>
      </div>
    </div>
  );
}

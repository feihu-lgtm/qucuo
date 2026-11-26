import React from "react";
import {
  API_TYPES, wordCountToMaxTokens, DEFAULT_INTENT_BUDGETS, DEFAULT_CALL_TOKEN_LIMITS, CALL_TOKEN_LIMIT_MAX,
} from "../../../infra/apiConfig.js";
import { Button, FieldLabel } from "../../primitives/index.js";

// API 配置 ·「篇幅与超时」组：超时、叙事字数、各意图篇幅、各类调用 token 上限、上下文窗口。
export default function ApiLengthFields({ cfg, patch }) {
  return (
    <>
    <div>
        <FieldLabel>接口超时（秒）</FieldLabel>
        <input className="ui-input" type="number" min="10" max="300" step="10"
          value={Math.round((cfg.timeoutMs ?? 60000) / 1000)}
          onChange={e => patch({ timeoutMs: Math.max(10, Math.min(300, parseInt(e.target.value) || 60)) * 1000 })} />
        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 2 }}>
          接口慢（如千问高峰期）常超时导致移动/操作卡住，可调长到 120~180。
        </div>
    </div>

    <FieldLabel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>每次叙事输出字数 <span style={{ color: "var(--ink-dim-deep)", fontSize: "var(--fs-2xs)" }}>（这是游戏体验的核心，直接按汉字数设定，不是 token 数）</span></span>
    </FieldLabel>
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      {[["简短", 300], ["适中", 600], ["详细", 900], ["长篇", 1500]].map(([label, val]) => (
        <Button variant="settings"
          key={label}
          onClick={() => patch({ targetWordCount: val, maxTokens: wordCountToMaxTokens(val) })} style={{ flex: 1, textAlign: "center",
            color: cfg.targetWordCount === val ? "var(--bg-panel)" : "var(--accent)",
            background: cfg.targetWordCount === val ? "var(--accent)" : "var(--bg-panel)" }}
        >{label}</Button>
      ))}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="range" min="100" max="3000" step="50" value={cfg.targetWordCount}
        onChange={e => { const v = parseInt(e.target.value); patch({ targetWordCount: v, maxTokens: wordCountToMaxTokens(v) }); }}
        style={{ flex: 1 }}
      />
      <input
        type="number" min="50" step="50" value={cfg.targetWordCount}
        onChange={e => { const v = parseInt(e.target.value) || 900; patch({ targetWordCount: v, maxTokens: wordCountToMaxTokens(v) }); }} className="ui-input" style={{ width: 80 }}
      />
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>字</span>
    </div>
    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 3 }}>
      目标约 {cfg.targetWordCount} 字（允许±15%浮动，AI 会根据这个字数目标自行决定要写几段、每段多长）。
      API 侧的 token 上限会自动换算为 {cfg.maxTokens}，只是防止意外截断的安全余量，不需要手动调整。
    </div>

    {cfg.apiType === API_TYPES.QWEN && (
      <div style={{ border: "1px solid var(--ink-edge-panel)", borderRadius: 0, padding: "8px 10px", marginTop: 8, background: "var(--bg-panel)" }}>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--info)", marginBottom: 4 }}>千问 max_tokens 上限</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number" min="256" max="65536" step="1024" className="ui-input" style={{ width: 110, marginBottom: 0 }}
            value={cfg.qwenMaxTokens ?? 32768}
            onChange={e => patch({ qwenMaxTokens: Math.max(256, Math.min(65536, parseInt(e.target.value) || 32768)) })}
          />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>单次输出 token 上限</span>
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 4 }}>
          千问对 max_tokens 有硬上限，传太大直接报 400（Range should be [1, 65536]）。
          这里单独封顶：qwen-max 上限 32768，qwen-plus/coder 可到 65536。默认 32768 最稳，叙事足够用。
          上面的字数换算值再大，发给千问时也会被压到这个上限之内。
        </div>
      </div>
    )}

    <FieldLabel style={{ marginTop: 10 }}>各动作类型篇幅上限（字数）</FieldLabel>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 6 }}>
      {[
        ["LOOK",           "查看 / 环顾"],
        ["MOVE",           "移动"],
        ["TALK_CASUAL",    "日常对话 / 送礼"],
        ["EXPLORE_ACTION", "调查 / 搜索"],
        ["COMBAT",         "战斗 / 切磋"],
      ].map(([key, label]) => {
        const cur = (cfg.intentBudgets && cfg.intentBudgets[key] != null)
          ? cfg.intentBudgets[key]
          : DEFAULT_INTENT_BUDGETS[key];
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>{label}</span>
            <input
              type="number" min="30" step="50" value={cur}
              onChange={e => {
                const v = parseInt(e.target.value) || DEFAULT_INTENT_BUDGETS[key];
                patch({ intentBudgets: { ...(cfg.intentBudgets || DEFAULT_INTENT_BUDGETS), [key]: v } });
              }} className="ui-input" style={{ width: 70 }}
            />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>字</span>
          </div>
        );
      })}
    </div>
    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 6 }}>
      min 自动取 max×40%。UNKNOWN 意图和 MOVE 未匹配时回退到上面的全局字数。
    </div>

    {/* ── 各类调用的 token 输出上限（原来写死在代码里，现全部可调，上限 100000） ── */}
    <FieldLabel style={{ marginTop: 10 }}>各类调用 · token 输出上限</FieldLabel>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 6 }}>
      {[
        ["narratorWhisper", "私聊旁白"],
        ["pigeonReply",    "飞鸽回信"],
        ["inspect",        "查看物品 / 武学介绍"],
        ["persuasion",     "说服台词"],
        ["extraction",     "意图 / 方位抽取"],
        ["knowledge",      "事实抽取"],
        ["connectionTest", "连接测试 ping"],
      ].map(([key, label]) => {
        const cur = (cfg.callTokenLimits && cfg.callTokenLimits[key] != null)
          ? cfg.callTokenLimits[key]
          : DEFAULT_CALL_TOKEN_LIMITS[key];
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>{label}</span>
            <input
              type="number" min="1" max={CALL_TOKEN_LIMIT_MAX} step="100" value={cur}
              onChange={e => {
                let v = parseInt(e.target.value) || DEFAULT_CALL_TOKEN_LIMITS[key];
                if (v > CALL_TOKEN_LIMIT_MAX) v = CALL_TOKEN_LIMIT_MAX;
                if (v < 1) v = 1;
                patch({ callTokenLimits: { ...(cfg.callTokenLimits || DEFAULT_CALL_TOKEN_LIMITS), [key]: v } });
              }} className="ui-input" style={{ width: 84 }}
            />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>tok</span>
          </div>
        );
      })}
    </div>
    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 6 }}>
      这些是各类 LLM 调用的输出 token 上限（不是字数）。默认已调大，避免带思考的模型（如 gemini-3）思考 token 吃穿正文导致半句截断。每项可调到 {CALL_TOKEN_LIMIT_MAX}。主叙事不在此列（它的上限已由上面的目标字数换算、且地板极高）。
    </div>
    <FieldLabel>上下文窗口（保留最近 N 轮对话）</FieldLabel>
    <input className="ui-input" type="number" min="2" step="2" value={cfg.contextWindow} onChange={e => patch({ contextWindow: parseInt(e.target.value) || 16 })} />
    </>
  );
}

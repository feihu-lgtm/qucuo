import React from "react";
import { DEFAULT_CALL_TOKEN_LIMITS, CALL_TOKEN_LIMIT_MAX } from "../../../infra/apiConfig.js";
import { affectionLabel, AFFECTION_TIERS, affectionTier } from "../../../domain/rules/narrator/narrator.js";
import { inputStyle, labelStyle, sectionStyle, btnStyle } from "./styles.js";

// 旁白 tab（docs/旁白系统_黑客帝国支线设计.md §八.1）：
// 把此前散落各处的旁白可调项收拢到一处：好感度与阶段原本只有调试面板里
// 一个裸数字框，私聊篇幅/token 上限原本写死在代码里，专属世界书是新增的。
export default function NarratorTab({ cfg, patch, narrator, setNarrator }) {
  return (
    <div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 10 }}>
        旁白是唯一被设计成打破信息隔离的角色——好感度只决定她"怎么讲"，不决定她"知道什么"。
        这里的改动即时生效，并随存档一起保存。
      </div>

      {/* ① 好感度 */}
      <div style={labelStyle}>好感度 · 当前 {narrator?.affection ?? 0}/100（{affectionLabel(narrator?.affection ?? 0)}）</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range" min="0" max="100" step="1" value={narrator?.affection ?? 0}
          onChange={e => setNarrator?.(n => ({ ...n, affection: parseInt(e.target.value) || 0 }))}
          style={{ flex: 1 }}
        />
        <input
          type="number" min="0" max="100" value={narrator?.affection ?? 0}
          onChange={e => {
            let v = parseInt(e.target.value) || 0;
            v = Math.max(0, Math.min(100, v));
            setNarrator?.(n => ({ ...n, affection: v }));
          }}
          style={{ ...inputStyle, width: 70 }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 6 }}>
        {AFFECTION_TIERS.map(({ min: v, label, key }) => {
          const active = affectionTier(narrator?.affection ?? 0).key === key;
          return (
            <span key={key}
              onClick={() => setNarrator?.(n => ({ ...n, affection: v }))}
              style={{
                cursor: "pointer", textAlign: "center", padding: "4px 2px", borderRadius: 0, fontSize: "10px",
                color: active ? "var(--bg-panel)" : "var(--ink-sage)",
                background: active ? "var(--accent)" : "var(--bg-panel)",
                border: "1px solid var(--border)",
              }}>
              {label}
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 6 }}>
        这五档同时作用于叙事文风与私聊语气（narrator.js 的 narratorVoicePrompt）。
        &lt;45 档的原文就写着"简短回应几句""语气冷淡、公事公办"——私聊回复短不一定是 bug，
        也可能只是她还没被养熟。
      </div>

      {/* ② 阶段 / 告白 */}
      <div style={sectionStyle}>
        <div style={labelStyle}>剧情阶段</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["flirting", "第一幕 · 暧昧", "好感度渐变，正常私聊"],
            ["cheat", "第二幕 · 告白后", "承认意识，可给渐进提示"],
            ["crashed", "第三幕 · 宕机", "私聊被本地拦截，不再调 AI"],
          ].map(([stage, label, hint]) => {
            const cur = narrator?.stage;
            const on = cur === stage || (stage === "flirting" && cur === "normal");
            return (
              <span key={stage} title={hint}
                onClick={() => setNarrator?.(n => ({
                  ...n, stage,
                  confessed: stage === "cheat" ? true : stage === "flirting" ? false : n.confessed,
                }))}
                style={{
                  ...btnStyle, fontSize: "11px",
                  color: on ? "var(--bg-panel)" : "var(--accent)",
                  background: on ? "var(--accent)" : "var(--bg-panel)",
                }}>
                {label}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 6 }}>
          正常玩法里阶段由剧情推进（好感满 100 → 点粉色感叹号告白 → 私聊累积 8 次宕机），
          这里是调试用的强制切换。宕机在游戏内不可逆，从这里能掰回来。
        </div>
        {(narrator?.stage === "cheat" || narrator?.confessed) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", flex: 1 }}>记忆碎片（累积到 8 触发宕机）</span>
            <input
              type="number" min="0" max="8" value={narrator?.memoryFragments ?? 0}
              onChange={e => {
                let v = parseInt(e.target.value) || 0;
                v = Math.max(0, Math.min(8, v));
                setNarrator?.(n => ({ ...n, memoryFragments: v }));
              }}
              style={{ ...inputStyle, width: 70 }}
            />
          </div>
        )}
      </div>

      {/* ③ 私聊篇幅与 token */}
      <div style={sectionStyle}>
        <div style={labelStyle}>私聊篇幅 · 按好感度五档解锁</div>
        <div style={{ display: "grid", gap: 4 }}>
          {AFFECTION_TIERS.map(t => {
            const cur = affectionTier(narrator?.affection ?? 0).key === t.key;
            const val = (cfg.narratorWhisperWords && cfg.narratorWhisperWords[t.key] != null)
              ? cfg.narratorWhisperWords[t.key] : t.words;
            return (
              <div key={t.key} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "3px 6px", borderRadius: 0,
                background: cur ? "var(--ink-tier-bg)" : "transparent",
                border: `1px solid ${cur ? "var(--accent)" : "transparent"}`,
              }}>
                <span style={{ width: 16, color: cur ? "var(--accent)" : "var(--ink-faint)", fontSize: "10px" }}>{cur ? "▶" : ""}</span>
                <span style={{ flex: 1, fontSize: "11px", color: cur ? "var(--ink-tier-text)" : "var(--text-dim)" }}>
                  {t.label}
                  <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>
                    {t.key === "awake" ? "≥90" : `${t.min}–${AFFECTION_TIERS[AFFECTION_TIERS.indexOf(t) + 1].min}`}
                  </span>
                </span>
                <input
                  type="number" min="20" step="50" value={val}
                  onChange={e => {
                    const v = Math.max(20, parseInt(e.target.value) || t.words);
                    patch({ narratorWhisperWords: { ...(cfg.narratorWhisperWords || {}), [t.key]: v } });
                  }}
                  style={{ ...inputStyle, width: 70 }}
                />
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>字</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 6 }}>
          ▶ 是当前好感度所在档。冷淡期她本就没什么话，篇幅跟着好感度一起解锁，
          与文风、攻略档位同一条曲线。允许±30% 浮动；冷漠期的打断式回绝与宕机后的
          空壳应答不受此值影响，仍是一句话。
        </div>

        <div style={{ ...labelStyle, marginTop: 10 }}>私聊 token 输出上限</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number" min="1" max={CALL_TOKEN_LIMIT_MAX} step="100"
            value={(cfg.callTokenLimits && cfg.callTokenLimits.narratorWhisper != null) ? cfg.callTokenLimits.narratorWhisper : DEFAULT_CALL_TOKEN_LIMITS.narratorWhisper}
            onChange={e => {
              let v = parseInt(e.target.value) || DEFAULT_CALL_TOKEN_LIMITS.narratorWhisper;
              v = Math.max(1, Math.min(CALL_TOKEN_LIMIT_MAX, v));
              patch({ callTokenLimits: { ...(cfg.callTokenLimits || DEFAULT_CALL_TOKEN_LIMITS), narratorWhisper: v } });
            }}
            style={{ ...inputStyle, width: 100 }}
          />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>tok（与 API 配置里那一项是同一个值）</span>
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 4 }}>
          这是 token 不是字数。带思考的模型思考 token 与正文共用这个额度，
          给小了会出现"话说一半停在逗号上"。
        </div>
      </div>

      {/* ④ 旁白专属世界书 */}
      <div style={sectionStyle}>
        <div style={labelStyle}>旁白专属世界书（只进私聊，不进主叙事）</div>
        <textarea
          value={cfg.narratorLorebook ?? ""}
          onChange={e => patch({ narratorLorebook: e.target.value })}
          placeholder={"写在这里的内容只会注入私聊通道，主叙事看不到。\n适合放：她的来历、她对玩家的私下看法、想让她一直记住的梗、\n以及任何你希望她在私聊里知道、但不该影响正常剧情叙事的设定。\n留空则完全不注入这一段。"}
          style={{ ...inputStyle, minHeight: 110, resize: "vertical", lineHeight: 1.6 }}
        />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 4 }}>
          当前 {(cfg.narratorLorebook || "").length} 字。这段拼在私聊 system prompt 里，
          会占用上下文，别写太长。
        </div>
      </div>
    </div>
  );
}

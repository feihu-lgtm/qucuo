import React from "react";
import { API_TYPES } from "../../../infra/apiConfig.js";
import { getApiModel } from "../../../infra/apiModel.js";
import IntentRecognitionToggle from "../IntentRecognitionToggle.jsx";
import ModelPicker from "./ModelPicker.jsx";
import { inputStyle, labelStyle, sectionStyle, btnStyle } from "./styles.js";

const EXTRACTION_INTENT_LABELS = [
  ["LOOK",           "查看 / 环顾"],
  ["MOVE",           "移动"],
  ["TALK_CASUAL",    "日常对话 / 送礼"],
  ["EXPLORE_ACTION", "调查 / 搜索"],
  ["COMBAT",         "战斗 / 切磋"],
  ["UNKNOWN",        "未知意图（兜底）"],
];

// API 配置 ·「生成参数」组：温度、意图识别、双调用提取模型、任务触发、流式、思考、向量记忆。
export default function ApiGenerationFields({
  cfg, patch, isVertex, onDetectModels: handleDetectModels, onClearMemory: handleClearMemory,
  modelStatus, modelPickerTarget, modelErr, modelList, setModelList, memCount,
}) {
  return (
    <>
    <div style={{ marginBottom: 10 }}>
      <label htmlFor="api-temperature" style={labelStyle}>Temperature</label>
      <input id="api-temperature" aria-label="温度" style={inputStyle} type="number" min="0" max="2" step="0.1" value={cfg.temperature} onChange={e => patch({ temperature: parseFloat(e.target.value) || 0 })} />
    </div>
    <IntentRecognitionToggle cfg={cfg} patch={patch} />
    {/* ── 提取层配置 ── */}
    <div style={{ borderTop: "1px solid var(--ink-divider-blue)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <input
          type="checkbox"
          id="extractionEnabled"
          checked={!!cfg.extractionEnabled}
          onChange={e => patch({ extractionEnabled: e.target.checked })}
          style={{ cursor: "pointer" }} />
        <label htmlFor="extractionEnabled" style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}>
          启用双调用模式（大模型叙事 + 小模型提取状态）
        </label>
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>
        开启后：主调用只输出叙事散文，提取调用按意图类型单独提取状态变化。
        提取调用可指定更小/更快的模型——空则沿用主模型。
      </div>
      <div style={{ borderTop: "1px solid var(--ink-divider-blue)", paddingTop: 12, marginTop: 12 }}>
        <label htmlFor="bookkeepEnabled" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}><input type="checkbox" id="bookkeepEnabled" checked={cfg.bookkeepEnabled !== false} onChange={e => patch({ bookkeepEnabled: e.target.checked })} style={{ cursor: "pointer" }} />回合记账（人物旧账）</label>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>每回合结束后台用提取模型记一笔人物旧账，多一次小调用</div>
      </div>
      <div style={{ borderTop: "1px solid var(--ink-divider-blue)", paddingTop: 12, marginTop: 12 }}>
        <label htmlFor="softSettleEnabled" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}><input type="checkbox" id="softSettleEnabled" checked={cfg.softSettleEnabled !== false} onChange={e => patch({ softSettleEnabled: e.target.checked })} style={{ cursor: "pointer" }} />结算软判定（平息怒气）</label>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>赔罪是否奏效先由小模型判一道选择题，系统定数值，叙事照写</div>
      </div>
      {cfg.extractionEnabled && (
        <>
          <div style={labelStyle}>默认提取模型（所有意图共用，空则沿用主模型）</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={cfg.extractionModel || ""}
              onChange={e => patch({ extractionModel: e.target.value })}
              placeholder={`留空则使用主模型 ${getApiModel(cfg)}`}
            />
            <span style={{ ...btnStyle, whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : () => handleDetectModels("extractionModel")}>
              {modelStatus === "loading" && modelPickerTarget === "extractionModel" ? "检测中…" : "检测"}
            </span>
          </div>
          <ModelPicker target="extractionModel" modelPickerTarget={modelPickerTarget} modelStatus={modelStatus} modelErr={modelErr}
            modelList={modelList} apiType={cfg.apiType} current={cfg.extractionModel} onClose={() => setModelList(null)}
            onPick={m => { patch({ extractionModel: m }); setModelList(null); }} />

          <div style={{ ...labelStyle, marginTop: 10 }}>各意图单独指定模型（空则使用默认提取模型）</div>
          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginBottom: 4 }}>
            下面每行都是可以点击填写的输入框——灰字是"当前会继承的模型"提示，不是禁用状态；要为某个意图单独指定模型，直接点进框里打字，或点「检测」从列表中选择。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
            {EXTRACTION_INTENT_LABELS.map(([key, label]) => {
              const cur = cfg.extractionModels?.[key] ?? "";
              const placeholder = cfg.extractionModel || getApiModel(cfg) || "主模型";
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 120, fontSize: "11px", color: "var(--text-dim)", flexShrink: 0 }}>{label}</span>
                    <input
                      style={{ ...inputStyle, flex: 1, borderColor: cur ? "var(--ink-edge-active)" : "var(--border)" }}
                      value={cur}
                      onChange={e => patch({
                        extractionModels: { ...(cfg.extractionModels || {}), [key]: e.target.value },
                      })}
                      placeholder={placeholder}
                    />
                    <span
                      style={{ ...btnStyle, whiteSpace: "nowrap", fontSize: "10px", padding: "4px 8px", flexShrink: 0, opacity: modelStatus === "loading" ? 0.5 : 1 }}
                      onClick={modelStatus === "loading" ? undefined : () => handleDetectModels(key)}
                    >
                      {modelStatus === "loading" && modelPickerTarget === key ? "检测中…" : "检测"}
                    </span>
                  </div>
                  <ModelPicker target={key} modelPickerTarget={modelPickerTarget} modelStatus={modelStatus} modelErr={modelErr}
                    modelList={modelList} apiType={cfg.apiType} current={cur} indent={128} shortHeader onClose={() => setModelList(null)}
                    onPick={m => { patch({ extractionModels: { ...(cfg.extractionModels || {}), [key]: m } }); setModelList(null); }} />
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-note-teal)", lineHeight: 1.5 }}>
            优先级：意图专属模型 → 默认提取模型 → 主模型。渠道（Endpoint / Key）始终沿用主配置。
          </div>
        </>
      )}
    </div>

    <div style={labelStyle}>❢ 感叹号任务面板触发方式</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
      {[
        { key: "prompt", label: "专属prompt harness（推荐）" },
        { key: "script", label: "对话自然演绎" },
      ].map(opt => (
        <button key={opt.key}
          onClick={() => patch({ questTriggerMode: opt.key })}
          style={{
            padding: "4px 10px", borderRadius: 0, border: "1px solid var(--ink-edge-quest)",
            cursor: "pointer", fontSize: "11px",
            color: (cfg.questTriggerMode || "prompt") === opt.key ? "var(--bg-panel)" : "var(--accent)",
            background: (cfg.questTriggerMode || "prompt") === opt.key ? "var(--accent)" : "var(--bg-panel)",
          }}
        >{opt.label}</button>
      ))}
    </div>
    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: -6, marginBottom: 6 }}>
      点击感叹号面板里的任务时——「专属prompt harness」：触发本身由系统直接判定（不再等AI自己决定要不要演），AI只负责用一段独立的专属提示词把这件已经确定发生的事写成叙事文字，确定性最高；「对话自然演绎」：送一句话给主线AI，由AI在通常的叙事氛围里自然带出这段剧情，更有代入感但确定性略低。
    </div>

    <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="checkbox" checked={!!cfg.streamEnabled}
        disabled={cfg.apiType === API_TYPES.GEMINI}
        onChange={e => patch({ streamEnabled: e.target.checked })}
        style={{ cursor: cfg.apiType === API_TYPES.GEMINI ? "not-allowed" : "pointer" }}
      />
      <span>流式输出（边生成边显示，不用等一整段返回完）</span>
    </div>
    {cfg.apiType === API_TYPES.GEMINI && (
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--gold)", marginTop: -6, marginBottom: 6 }}>
        Gemini 暂不支持流式输出，切到 Anthropic 或 OpenAI 兼容类型后可用。
      </div>
    )}

    <div style={labelStyle}>思考 / 推理模式</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
      {["off", "low", "medium", "high", "custom"].map(m => (
        <button key={m}
          onClick={() => patch({ thinkingMode: m })}
          style={{
            padding: "4px 10px", borderRadius: 0, fontSize: "11px", cursor: "pointer",
            border: "1px solid var(--ink-edge-think)",
            color: (cfg.thinkingMode || "off") === m ? "var(--bg-panel)" : "var(--accent)",
            background: (cfg.thinkingMode || "off") === m ? "var(--accent)" : "var(--bg-panel)",
          }}>
          {{ off: "关闭", low: "低", medium: "中", high: "高", custom: "自定义" }[m]}
        </button>
      ))}
    </div>
    {(cfg.thinkingMode || "off") === "custom" && (
      <input style={inputStyle} type="number" min="0" step="256" value={cfg.thinkingBudget ?? 1024}
        onChange={e => patch({ thinkingBudget: parseInt(e.target.value) || 0 })}
        placeholder="自定义思考 token 预算，0=关闭" />
    )}
    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 3, marginBottom: 6 }}>
      {isVertex ? "Vertex 的「关闭」会使用模型支持的最低思考档位，仍可能消耗输出 token。" : "默认「关闭」：把 token 全留给正文，避免 Gemini 2.5 等模型的思考过程吃穿额度、导致正文被截断。想让模型多想再答可调高，代价是更慢更贵、且可能需要把上面的目标字数调大。"}
    </div>

    <div style={{ ...sectionStyle }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--accent)", fontSize: "var(--fs-sm)" }}>
        <input type="checkbox" checked={!!cfg.embeddingEnabled} onChange={e => patch({ embeddingEnabled: e.target.checked })} style={{ cursor: "pointer" }} />
        启用向量记忆（长期召回）
      </label>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 3 }}>
        开启后，AI 每轮会额外记一条 ≤50 字的事实摘要并向量化存入本地库；此后每轮发送前，
        会按语义相关度从库里召回可能早已滑出对话窗口的旧事注入 prompt，让"很久以前埋的伏笔/许过的诺/结过的怨"重新被想起。
        不开则完全不触发，游戏行为与之前一致。向量库存在浏览器 IndexedDB，不上传、不进存档文件。
      </div>
      {cfg.embeddingEnabled && (
        <div style={{ marginTop: 8 }}>
          <div style={labelStyle}>Embedding Endpoint（留空用 SiliconFlow 默认）</div>
          <input style={inputStyle} value={cfg.embeddingEndpoint} onChange={e => patch({ embeddingEndpoint: e.target.value })} placeholder="https://api.siliconflow.cn/v1/embeddings" />
          <div style={labelStyle}>Embedding Key（支持逗号分隔多个轮询）</div>
          <input style={inputStyle} type="password" value={cfg.embeddingKey} onChange={e => patch({ embeddingKey: e.target.value })} placeholder="sk-..." />
          <div style={labelStyle}>Embedding 模型</div>
          <input style={inputStyle} value={cfg.embeddingModel} onChange={e => patch({ embeddingModel: e.target.value })} placeholder="例如 BAAI/bge-m3" />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: "10.5px", color: "var(--text-dim)" }}>
            <span>本地记忆库：{memCount == null ? "…" : `${memCount} 条`}</span>
            <span style={{ ...btnStyle, padding: "3px 10px", color: "var(--ink-danger)", borderColor: "var(--ink-danger-edge)" }} onClick={handleClearMemory}>清空记忆库</span>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-caution)", marginTop: 4 }}>
            ⚠ 换 embedding 模型后旧向量不兼容，会被自动跳过（指纹校验）；如需重建，建议清空后重新游玩积累。
          </div>
        </div>
      )}
    </div>
    </>
  );
}

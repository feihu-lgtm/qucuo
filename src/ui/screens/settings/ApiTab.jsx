import React from "react";
import {
  API_TYPES, testConnection, listModels, wordCountToMaxTokens, DEFAULT_INTENT_BUDGETS,
  DEFAULT_CALL_TOKEN_LIMITS, CALL_TOKEN_LIMIT_MAX, listConfigProfiles, saveConfigProfile,
  loadConfigProfile, deleteConfigProfile, exportConfigProfiles, importConfigProfiles,
  hasApiCredentials, importVertexCredential, isDefaultEndpoint, migrateProvider,
  providerApiType, PROVIDERS,
} from "../../../infra/apiConfig.js";
import { classifyError } from "../../../utils/apiErrors.js";
import { getApiModel } from "../../../infra/apiModel.js";
import { clearMemories } from "../../../infra/memoryStore.js";
import IntentRecognitionToggle from "../IntentRecognitionToggle.jsx";
import ApiProviderSettings, { ApiSettingsGroup } from "../ApiProviderSettings.jsx";
import ModelPicker from "./ModelPicker.jsx";
import { inputStyle, labelStyle, sectionStyle, btnStyle } from "./styles.js";
import { downloadText, pickTextFile, ts } from "./fileIo.js";

const EXTRACTION_INTENT_LABELS = [
  ["LOOK",           "查看 / 环顾"],
  ["MOVE",           "移动"],
  ["TALK_CASUAL",    "日常对话 / 送礼"],
  ["EXPLORE_ACTION", "调查 / 搜索"],
  ["COMBAT",         "战斗 / 切磋"],
  ["UNKNOWN",        "未知意图（兜底）"],
];

// API 配置 tab。状态由 SettingsPanel 壳持有（切 tab 卸载后回来不丢），
// 本组件只做渲染与事件处理。
export default function ApiTab({
  cfg, setCfg, patch, zoneTheme, st,
}) {
  const {
    testStatus, setTestStatus, testMsg, setTestMsg,
    apiGroups, setApiGroups,
    modelList, setModelList, modelStatus, setModelStatus,
    modelPickerTarget, setModelPickerTarget, modelErr, setModelErr,
    memCount, setMemCount,
    cfgProfiles, setCfgProfiles, cfgProfileName, setCfgProfileName,
  } = st;

  const providerId = migrateProvider(cfg).provider;
  const isVertex = providerId === "vertex";

  const handleClearMemory = async () => {
    if (!window.confirm("确定清空全部长期向量记忆？此操作不可撤销（存档本身不受影响）。")) return;
    try { await clearMemories(); setMemCount(0); } catch (e) { alert("清空失败：" + e.message); }
  };

  // 保存当前配置为一套 profile
  const handleSaveCfgProfile = () => {
    const nm = saveConfigProfile(cfgProfileName || `配置-${ts()}`, cfg);
    setCfgProfiles(listConfigProfiles());
    setCfgProfileName("");
    alert(`已保存配置「${nm}」到本地。`);
  };
  // 切换到某套 profile
  const handleLoadCfgProfile = (name) => {
    const c = loadConfigProfile(name);
    if (c) { setCfg(migrateProvider(c)); alert(`已切换到配置「${name}」。`); }
  };
  const handleDeleteCfgProfile = (name) => {
    if (!window.confirm(`删除配置「${name}」？`)) return;
    deleteConfigProfile(name); setCfgProfiles(listConfigProfiles());
  };
  // 导出所有配置到本地文件
  const handleExportCfg = () => downloadText(`曲措乡-配置-${ts()}.json`, exportConfigProfiles(cfg));
  // 从本地文件导入配置
  const handleImportCfg = () => pickTextFile((text) => {
    try {
      const n = importConfigProfiles(text);
      setCfgProfiles(listConfigProfiles());
      alert(`已导入 ${n} 套配置。`);
    } catch (e) { alert("导入失败：" + e.message); }
  });

  const handleTest = async () => {
    setTestStatus("testing"); setTestMsg("");
    const startedAt = Date.now();
    try {
      await testConnection(cfg);
      setTestStatus("ok");
      setTestMsg(`✓ 连通 · ${getApiModel(cfg)} · ${Date.now() - startedAt}ms`);
    } catch (e) {
      const { connection } = classifyError(e, { connection: true, apiKey: cfg.apiKey });
      setTestStatus("error");
      setTestMsg(`✕ ${connection.code} · ${connection.cause} · ${connection.fix}`);
    }
  };

  const handleDetectModels = async (target = null) => {
    setModelPickerTarget(target);
    setModelStatus("loading"); setModelErr(""); setModelList(null);
    try {
      const models = await listModels(cfg);
      setModelList(models);
    } catch (e) {
      setModelStatus("error"); setModelErr(e.message);
      return;
    }
    setModelStatus(null);
  };

  return (
    <div>
      {/* 【暂留·等会用】原多渠道说明文案，后续可能放到别处：
        支持 OpenAI 兼容格式、Gemini API、Anthropic 原生格式与千问。密钥仅保存在浏览器本地（localStorage），不会上传到任何服务器。 */}
      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: 8 }}>
        选择服务商，并按其接口协议配置地址、密钥与模型。
      </div>

      <ApiProviderSettings cfg={cfg} patch={patch} providers={PROVIDERS}
        isDefaultEndpoint={isDefaultEndpoint} migrateProvider={migrateProvider} providerApiType={providerApiType}
        importCredential={importVertexCredential} hasCredential={isVertex && hasApiCredentials(cfg)}
        labelStyle={labelStyle} inputStyle={inputStyle} zoneTheme={zoneTheme} />

      {!isVertex && <><label htmlFor="api-model" style={{ ...labelStyle, display: "block" }}>模型名称</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input id="api-model" list="provider-model-suggestions" style={{ ...inputStyle, flex: 1 }} value={cfg.model} onChange={e => patch({ model: e.target.value })} placeholder="输入服务商要求的模型名称" />
        <datalist id="provider-model-suggestions">
          {(PROVIDERS[providerId]?.models || []).map(model => <option key={model} value={model} />)}
        </datalist>
        <span style={{ ...btnStyle, whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : () => handleDetectModels(null)}>
          {modelStatus === "loading" && modelPickerTarget === null ? "检测中…" : "自动检测"}
        </span>
      </div></>}
      {!isVertex && (
        <ModelPicker target={null} modelPickerTarget={modelPickerTarget} modelStatus={modelStatus} modelErr={modelErr}
          modelList={modelList} apiType={cfg.apiType} current={cfg.model} onClose={() => setModelList(null)}
          onPick={m => { patch({ model: m }); setModelList(null); }} />
      )}
      {!isVertex && modelList && modelList.length === 0 && (
        <div style={{ fontSize: "10.5px", color: "var(--gold)", marginTop: 3 }}>接口未返回任何模型，请手动填写模型名称</div>
      )}

      <ApiSettingsGroup title="篇幅与超时" expanded={apiGroups.length} zoneTheme={zoneTheme}
        onToggle={() => setApiGroups(groups => ({ ...groups, length: !groups.length }))}>
      <div>
          <div style={labelStyle}>接口超时（秒）</div>
          <input style={inputStyle} type="number" min="10" max="300" step="10"
            value={Math.round((cfg.timeoutMs ?? 60000) / 1000)}
            onChange={e => patch({ timeoutMs: Math.max(10, Math.min(300, parseInt(e.target.value) || 60)) * 1000 })} />
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: 2 }}>
            接口慢（如千问高峰期）常超时导致移动/操作卡住，可调长到 120~180。
          </div>
      </div>

      <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>每次叙事输出字数 <span style={{ color: "var(--ink-dim-deep)", fontSize: "10px" }}>（这是游戏体验的核心，直接按汉字数设定，不是 token 数）</span></span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {[["简短", 300], ["适中", 600], ["详细", 900], ["长篇", 1500]].map(([label, val]) => (
          <span
            key={label}
            onClick={() => patch({ targetWordCount: val, maxTokens: wordCountToMaxTokens(val) })}
            style={{
              ...btnStyle, flex: 1, textAlign: "center",
              color: cfg.targetWordCount === val ? "var(--bg-panel)" : "var(--accent)",
              background: cfg.targetWordCount === val ? "var(--accent)" : "var(--bg-panel)",
            }}
          >{label}</span>
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
          onChange={e => { const v = parseInt(e.target.value) || 900; patch({ targetWordCount: v, maxTokens: wordCountToMaxTokens(v) }); }}
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>字</span>
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 3 }}>
        目标约 {cfg.targetWordCount} 字（允许±15%浮动，AI 会根据这个字数目标自行决定要写几段、每段多长）。
        API 侧的 token 上限会自动换算为 {cfg.maxTokens}，只是防止意外截断的安全余量，不需要手动调整。
      </div>

      {cfg.apiType === API_TYPES.QWEN && (
        <div style={{ border: "1px solid var(--ink-edge-panel)", borderRadius: 0, padding: "8px 10px", marginTop: 8, background: "var(--bg-panel)" }}>
          <div style={{ fontSize: "11px", color: "var(--info)", marginBottom: 4 }}>千问 max_tokens 上限</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number" min="256" max="65536" step="1024"
              style={{ ...inputStyle, width: 110, marginBottom: 0 }}
              value={cfg.qwenMaxTokens ?? 32768}
              onChange={e => patch({ qwenMaxTokens: Math.max(256, Math.min(65536, parseInt(e.target.value) || 32768)) })}
            />
            <span style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>单次输出 token 上限</span>
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 4 }}>
            千问对 max_tokens 有硬上限，传太大直接报 400（Range should be [1, 65536]）。
            这里单独封顶：qwen-max 上限 32768，qwen-plus/coder 可到 65536。默认 32768 最稳，叙事足够用。
            上面的字数换算值再大，发给千问时也会被压到这个上限之内。
          </div>
        </div>
      )}

      <div style={{ ...labelStyle, marginTop: 10 }}>各动作类型篇幅上限（字数）</div>
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
              <span style={{ flex: 1, fontSize: "11px", color: "var(--text-dim)" }}>{label}</span>
              <input
                type="number" min="30" step="50" value={cur}
                onChange={e => {
                  const v = parseInt(e.target.value) || DEFAULT_INTENT_BUDGETS[key];
                  patch({ intentBudgets: { ...(cfg.intentBudgets || DEFAULT_INTENT_BUDGETS), [key]: v } });
                }}
                style={{ ...inputStyle, width: 70 }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>字</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 6 }}>
        min 自动取 max×40%。UNKNOWN 意图和 MOVE 未匹配时回退到上面的全局字数。
      </div>

      {/* ── 各类调用的 token 输出上限（原来写死在代码里，现全部可调，上限 100000） ── */}
      <div style={{ ...labelStyle, marginTop: 10 }}>各类调用 · token 输出上限</div>
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
              <span style={{ flex: 1, fontSize: "11px", color: "var(--text-dim)" }}>{label}</span>
              <input
                type="number" min="1" max={CALL_TOKEN_LIMIT_MAX} step="100" value={cur}
                onChange={e => {
                  let v = parseInt(e.target.value) || DEFAULT_CALL_TOKEN_LIMITS[key];
                  if (v > CALL_TOKEN_LIMIT_MAX) v = CALL_TOKEN_LIMIT_MAX;
                  if (v < 1) v = 1;
                  patch({ callTokenLimits: { ...(cfg.callTokenLimits || DEFAULT_CALL_TOKEN_LIMITS), [key]: v } });
                }}
                style={{ ...inputStyle, width: 84 }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>tok</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 6 }}>
        这些是各类 LLM 调用的输出 token 上限（不是字数）。默认已调大，避免带思考的模型（如 gemini-3）思考 token 吃穿正文导致半句截断。每项可调到 {CALL_TOKEN_LIMIT_MAX}。主叙事不在此列（它的上限已由上面的目标字数换算、且地板极高）。
      </div>
      <div style={labelStyle}>上下文窗口（保留最近 N 轮对话）</div>
      <input style={inputStyle} type="number" min="2" step="2" value={cfg.contextWindow} onChange={e => patch({ contextWindow: parseInt(e.target.value) || 16 })} />
      </ApiSettingsGroup>

      <ApiSettingsGroup title="生成参数" expanded={apiGroups.generation} zoneTheme={zoneTheme}
        onToggle={() => setApiGroups(groups => ({ ...groups, generation: !groups.generation }))}>
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
          <label htmlFor="extractionEnabled" style={{ fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}>
            启用双调用模式（大模型叙事 + 小模型提取状态）
          </label>
        </div>
        <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>
          开启后：主调用只输出叙事散文，提取调用按意图类型单独提取状态变化。
          提取调用可指定更小/更快的模型——空则沿用主模型。
        </div>
        <div style={{ borderTop: "1px solid var(--ink-divider-blue)", paddingTop: 12, marginTop: 12 }}>
          <label htmlFor="bookkeepEnabled" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}><input type="checkbox" id="bookkeepEnabled" checked={cfg.bookkeepEnabled !== false} onChange={e => patch({ bookkeepEnabled: e.target.checked })} style={{ cursor: "pointer" }} />回合记账（人物旧账）</label>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>每回合结束后台用提取模型记一笔人物旧账，多一次小调用</div>
        </div>
        <div style={{ borderTop: "1px solid var(--ink-divider-blue)", paddingTop: 12, marginTop: 12 }}>
          <label htmlFor="softSettleEnabled" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}><input type="checkbox" id="softSettleEnabled" checked={cfg.softSettleEnabled !== false} onChange={e => patch({ softSettleEnabled: e.target.checked })} style={{ cursor: "pointer" }} />结算软判定（平息怒气）</label>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>赔罪是否奏效先由小模型判一道选择题，系统定数值，叙事照写</div>
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
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: 4 }}>
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
            <div style={{ fontSize: "10px", color: "var(--ink-note-teal)", lineHeight: 1.5 }}>
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
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: -6, marginBottom: 6 }}>
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
        <div style={{ fontSize: "10.5px", color: "var(--gold)", marginTop: -6, marginBottom: 6 }}>
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
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 3, marginBottom: 6 }}>
        {isVertex ? "Vertex 的「关闭」会使用模型支持的最低思考档位，仍可能消耗输出 token。" : "默认「关闭」：把 token 全留给正文，避免 Gemini 2.5 等模型的思考过程吃穿额度、导致正文被截断。想让模型多想再答可调高，代价是更慢更贵、且可能需要把上面的目标字数调大。"}
      </div>

      <div style={{ ...sectionStyle }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--accent)", fontSize: "12px" }}>
          <input type="checkbox" checked={!!cfg.embeddingEnabled} onChange={e => patch({ embeddingEnabled: e.target.checked })} style={{ cursor: "pointer" }} />
          启用向量记忆（长期召回）
        </label>
        <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 3 }}>
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
            <div style={{ fontSize: "10.5px", color: "var(--ink-caution)", marginTop: 4 }}>
              ⚠ 换 embedding 模型后旧向量不兼容，会被自动跳过（指纹校验）；如需重建，建议清空后重新游玩积累。
            </div>
          </div>
        )}
      </div>
      </ApiSettingsGroup>

      <ApiSettingsGroup title="配置管理" expanded={apiGroups.profiles} zoneTheme={zoneTheme}
        onToggle={() => setApiGroups(groups => ({ ...groups, profiles: !groups.profiles }))}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 0, padding: "8px 10px", marginBottom: 12, background: "var(--bg-panel)" }}>
          <div style={{ fontSize: "11px", color: "var(--info)", marginBottom: 6 }}>配置管理（多套 API 配置 · 落盘导出/导入）</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              value={cfgProfileName}
              onChange={e => setCfgProfileName(e.target.value)}
              placeholder="给当前配置起个名（如 DS主号 / 备用）"
            />
            <span onClick={handleSaveCfgProfile} style={{ ...btnStyle, whiteSpace: "nowrap" }}>保存这套</span>
          </div>
          {cfgProfiles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {cfgProfiles.map(p => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px" }}>
                  <span style={{ flex: 1, color: "var(--text)" }}>{p.name}
                    <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>{getApiModel(p.cfg) || ""}</span>
                  </span>
                  <span onClick={() => handleLoadCfgProfile(p.name)} style={{ cursor: "pointer", color: "var(--accent)" }}>切换</span>
                  <span onClick={() => handleDeleteCfgProfile(p.name)} style={{ cursor: "pointer", color: "var(--ink-danger-soft)" }}>删除</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <span onClick={handleExportCfg} style={{ ...btnStyle, flex: 1, textAlign: "center" }}>导出配置到文件</span>
            <span onClick={handleImportCfg} style={{ ...btnStyle, flex: 1, textAlign: "center" }}>从文件导入配置</span>
          </div>
        </div>
        <div style={{ ...sectionStyle, background: "var(--bg-panel)", border: "1px solid var(--border)", padding: 10, fontSize: "10.5px", color: "var(--text-dim)" }}>
          凭证保存在当前浏览器中，请勿在公共设备上导入。Vertex AI 直接连接 Google，不使用代理。
        </div>
      </ApiSettingsGroup>

      <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={btnStyle} onClick={handleTest}>连接测试</span>
        {testStatus === "testing" && <span style={{ color: "var(--text-dim)" }}>测试中...</span>}
      </div>
      {testStatus && testStatus !== "testing" && (
        <div data-testid="api-test-result" role="status" style={{ marginTop: 6, fontSize: "11px", color: testStatus === "ok" ? "var(--good)" : "var(--accent)" }}>
          {testMsg}
        </div>
      )}
    </div>
  );
}

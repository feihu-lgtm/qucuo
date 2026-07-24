import React, { useState } from "react";
import { API_TYPES, testConnection, listModels, wordCountToMaxTokens, DEFAULT_INTENT_BUDGETS, DEFAULT_CALL_TOKEN_LIMITS, CALL_TOKEN_LIMIT_MAX, listConfigProfiles, saveConfigProfile, loadConfigProfile, deleteConfigProfile, exportConfigProfiles, importConfigProfiles, DEFAULT_ENDPOINTS, isDefaultEndpoint } from "./apiConfig.js";

const EXTRACTION_INTENT_LABELS = [
  ["LOOK",           "查看 / 环顾"],
  ["MOVE",           "移动"],
  ["TALK_CASUAL",    "日常对话 / 送礼"],
  ["EXPLORE_ACTION", "调查 / 搜索"],
  ["COMBAT",         "战斗 / 切磋"],
  ["UNKNOWN",        "未知意图（兜底）"],
];
import { listSlots, saveToSlot, loadSlot, deleteSlot, renameSlot, clearAutoSave, autoSave, exportSave, importSave } from "./saves.js";
import { listCharacters, npcAffectionLabel } from "./mvu.js";
import PresetManager, { PresetToolbar } from "./PresetManager.jsx";
import PresetEditor from "./PresetEditor.jsx";
import { loadAllPresets, saveAllPresets } from "./presetSystem.js";
import { clearInspectCache, inspectCacheSize } from "./inspectCache.js";
import { clearMemories, countMemories } from "./memory/memoryStore.js";

const inputStyle = {
  width: "100%", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3,
  color: "#c8bfa0", padding: "6px 8px", fontFamily: "inherit", fontSize: "12px", boxSizing: "border-box",
};
const labelStyle = { fontSize: "11px", color: "#5a8a5a", marginBottom: 4, marginTop: 10 };
const sectionStyle = { borderTop: "1px solid #1a1d2e", paddingTop: 12, marginTop: 12 };
const btnStyle = {
  cursor: "pointer", color: "#6ec6c6", padding: "5px 12px", background: "#10121a",
  border: "1px solid #1a2d2a", borderRadius: 3, fontSize: "11.5px", display: "inline-block",
};

export default function SettingsPanel({ cfg, setCfg, onClose, currentSnapshot, onLoadSnapshot, varTree, setVarTree, initialTab, uiScale, setUiScale }) {
  const [tab, setTab] = useState(initialTab || "api"); // api | preset | saves | cheat | help
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [testMsg, setTestMsg] = useState("");
  const [slots, setSlots] = useState(listSlots());
  const [slotLabel, setSlotLabel] = useState("");
  const [modelList, setModelList] = useState(null); // null=未探测过, [] = 探测到但为空, [...] = 有结果
  const [modelStatus, setModelStatus] = useState(null); // null | 'loading' | 'error'
  const [modelErr, setModelErr] = useState("");
  const [presetState, setPresetState] = useState(loadAllPresets());
  const [showFullEditor, setShowFullEditor] = useState(false);
  const [memCount, setMemCount] = useState(null); // 记忆库条数（懒加载）

  React.useEffect(() => {
    if (tab === "api") countMemories().then(setMemCount).catch(() => setMemCount(null));
  }, [tab]);

  const handleClearMemory = async () => {
    if (!window.confirm("确定清空全部长期向量记忆？此操作不可撤销（存档本身不受影响）。")) return;
    try { await clearMemories(); setMemCount(0); } catch (e) { alert("清空失败：" + e.message); }
  };

  const updatePresetState = (next) => {
    setPresetState(next);
    saveAllPresets(next);
  };

  const patch = (fields) => setCfg(c => ({ ...c, ...fields }));

  // ── 配置 profile（多套 API 配置）与落盘导出/导入 ──
  const [cfgProfiles, setCfgProfiles] = useState(listConfigProfiles());
  const [cfgProfileName, setCfgProfileName] = useState("");

  // 通用：把一段文本下载成本地文件（落盘）。
  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // 通用：让用户选一个本地文件，读出文本回调。
  const pickTextFile = (onText) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json,text/plain";
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onText(String(reader.result || ""));
      reader.onerror = () => alert("读取文件失败。");
      reader.readAsText(file);
    };
    inp.click();
  };

  const ts = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

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
    if (c) { setCfg(c); alert(`已切换到配置「${name}」。`); }
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
    try {
      const reply = await testConnection(cfg);
      setTestStatus("ok"); setTestMsg(reply);
    } catch (e) {
      setTestStatus("error"); setTestMsg(e.message);
    }
  };

  const handleDetectModels = async () => {
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

  const refreshSlots = () => setSlots(listSlots());

  const handleAffectionChange = (name, value) => {
    const v = Math.max(0, Math.min(100, parseInt(value) || 0));
    setVarTree(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.角色[name]) next.角色[name] = {};
      next.角色[name].好感度 = v;
      return next;
    });
  };

  const handleManualSave = () => {
    if (!currentSnapshot) return;
    saveToSlot(currentSnapshot(), slotLabel.trim() || undefined);
    setSlotLabel("");
    refreshSlots();
  };

  const handleLoadSlot = (id) => {
    const snap = loadSlot(id);
    if (snap) onLoadSnapshot(snap);
  };

  const handleDeleteSlot = (id) => {
    deleteSlot(id);
    refreshSlots();
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 520, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", fontFamily: "inherit", fontSize: "12.5px", color: "#c8bfa0" }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#6ec6c6", fontSize: "14px" }}>⚙ 游戏设置</span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>

        <PresetToolbar state={presetState} onStateChange={updatePresetState} />
        <div style={{ marginTop: -6, marginBottom: 12 }}>
          <span
            style={{ ...btnStyle, borderColor: "#3a3020", color: "#f0c060" }}
            onClick={() => setShowFullEditor(true)}
          >
            🗂 进入预设编辑器（库存 / 激活链 / 收藏三栏）
          </span>
        </div>
        {showFullEditor && (
          <PresetEditor
            preset={presetState.presets[presetState.activeIndex]}
            onChange={(nextPreset) => updatePresetState({
              ...presetState,
              presets: presetState.presets.map((p, i) => i === presetState.activeIndex ? nextPreset : p),
            })}
            onClose={() => setShowFullEditor(false)}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "6px 10px", background: "#0e0c14", border: "1px solid #2a2438", borderRadius: 4 }}>
          <span style={{ fontSize: "11px", color: "#7a7a6a", flexShrink: 0 }}>字号</span>
          <input
            type="range" min="0.7" max="1.6" step="0.05"
            value={uiScale}
            onChange={e => setUiScale(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "11px", color: "#c8bfa0", flexShrink: 0, width: 42, textAlign: "right" }}>{Math.round(uiScale * 100)}%</span>
          <span
            onClick={() => setUiScale(1)}
            style={{ fontSize: "10px", color: "#6ec6c6", cursor: "pointer", flexShrink: 0, border: "1px solid #1a2d2a", borderRadius: 3, padding: "2px 6px" }}
          >重置</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: "1px solid #1a1d2e", paddingBottom: 8 }}>
          {[["api", "API 配置"], ["preset", "预设"], ["saves", "存档管理"], ["cheat", "金手指"], ["help", "玩法说明"]].map(([id, label]) => (
            <span key={id} onClick={() => setTab(id)} style={{
              cursor: "pointer", padding: "4px 10px", borderRadius: 3, fontSize: "11.5px",
              color: tab === id ? "#6ec6c6" : "#7a7a6a",
              background: tab === id ? "#1a2a2a" : "transparent",
            }}>{label}</span>
          ))}
        </div>

        {tab === "api" && (
          <div>
            <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 8 }}>
              支持 OpenAI 兼容格式、Gemini API、Anthropic 原生格式与千问。密钥仅保存在浏览器本地（localStorage），不会上传到任何服务器。
            </div>

            {/* 配置管理：多套配置存本地、随时切换、导出/导入落盘 */}
            <div style={{ border: "1px solid #2a2a3a", borderRadius: 5, padding: "8px 10px", marginBottom: 12, background: "#0e1018" }}>
              <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>配置管理（多套 API 配置 · 落盘导出/导入）</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  value={cfgProfileName}
                  onChange={e => setCfgProfileName(e.target.value)}
                  placeholder="给当前配置起个名（如 千问-主号 / DS备用）"
                />
                <span onClick={handleSaveCfgProfile} style={{ ...btnStyle, whiteSpace: "nowrap" }}>保存这套</span>
              </div>
              {cfgProfiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                  {cfgProfiles.map(p => (
                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px" }}>
                      <span style={{ flex: 1, color: "#c8bfa0" }}>{p.name}
                        <span style={{ color: "#5a5a4a", marginLeft: 6 }}>{p.cfg?.apiType || ""} · {p.cfg?.model || ""}</span>
                      </span>
                      <span onClick={() => handleLoadCfgProfile(p.name)} style={{ cursor: "pointer", color: "#6ec6c6" }}>切换</span>
                      <span onClick={() => handleDeleteCfgProfile(p.name)} style={{ cursor: "pointer", color: "#c47070" }}>删除</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <span onClick={handleExportCfg} style={{ ...btnStyle, flex: 1, textAlign: "center" }}>⬇ 导出配置到文件</span>
                <span onClick={handleImportCfg} style={{ ...btnStyle, flex: 1, textAlign: "center" }}>⬆ 从文件导入配置</span>
              </div>
            </div>

            <div style={labelStyle}>API 类型</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[[API_TYPES.ANTHROPIC, "Anthropic"], [API_TYPES.OPENAI, "OpenAI 兼容"], [API_TYPES.GEMINI, "Gemini"], [API_TYPES.QWEN, "千问"]].map(([id, label]) => (
                <span key={id} onClick={() => {
                  // 切换类型时，若当前地址是某个渠道的默认/预设地址（用户没手动改过），
                  // 自动换成新类型的默认地址——免得切到千问还留着 OpenAI 的 URL 连不上。
                  // 用户手填过的自定义地址则保留不动。
                  const patchObj = { apiType: id };
                  if (isDefaultEndpoint(cfg.endpoint)) patchObj.endpoint = DEFAULT_ENDPOINTS[id] || "";
                  patch(patchObj);
                }} style={{
                  ...btnStyle, color: cfg.apiType === id ? "#0a0c14" : "#6ec6c6",
                  background: cfg.apiType === id ? "#6ec6c6" : "#10121a",
                }}>{label}</span>
              ))}
            </div>

            <div style={labelStyle}>快速填入（常用渠道，仍需自己填 API Key）</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                onClick={() => patch({ apiType: API_TYPES.OPENAI, endpoint: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" })}
                style={btnStyle}
              >DeepSeek · deepseek-chat（V3，速度快）</span>
              <span
                onClick={() => patch({ apiType: API_TYPES.OPENAI, endpoint: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-reasoner" })}
                style={btnStyle}
              >DeepSeek · deepseek-reasoner（R1，会推理）</span>
              <span
                onClick={() => patch({ apiType: API_TYPES.QWEN, endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen3.5-plus-2026-04-20" })}
                style={btnStyle}
              >千问 · qwen3.5-plus（阿里百炼）</span>
              <span
                onClick={() => patch({ apiType: API_TYPES.QWEN, endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-plus" })}
                style={btnStyle}
              >千问 · qwen-plus（通用）</span>
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3, marginBottom: 6 }}>
              DeepSeek 走 OpenAI 兼容协议，官方地址是 https://api.deepseek.com。deepseek-reasoner 的推理强度不是这里的
              「思考/推理模式」控制的（那个参数是给 Gemini/Qwen 这类可调思考预算的模型用的）——推理模型是否深入思考由模型本身决定，
              下面的档位对它不生效，但对走同一 OpenAI 兼容协议的其他可调节模型（Gemini 等）仍然有效。
            </div>

            <div style={labelStyle}>API 地址（Endpoint）</div>
            <input style={inputStyle} value={cfg.endpoint} onChange={e => patch({ endpoint: e.target.value })} placeholder="留空使用默认地址" />
            {(cfg.apiType === API_TYPES.OPENAI || cfg.apiType === API_TYPES.QWEN) && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, cursor: "pointer" }}>
                  <input
                    type="checkbox" checked={!!cfg.openaiAutoComplete}
                    onChange={e => patch({ openaiAutoComplete: e.target.checked })}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "11px", color: "#8a8a7a" }}>
                    自动补全地址（补上 /v1/chat/completions）
                  </span>
                </label>
                <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3 }}>
                  {cfg.openaiAutoComplete
                    ? "已开启：地址缺路径时自动补 /v1/chat/completions。填的是完整/非标准路径的家请关掉，否则可能补出 404。"
                    : "默认不补：填什么就原样发什么。多数中转站需要填完整地址（含 /chat/completions）。若你的家只给了 base 地址，可勾上让它自动补。"}
                </div>
              </>
            )}

            <div style={labelStyle}>API Key</div>
            <input style={inputStyle} type="password" value={cfg.apiKey} onChange={e => patch({ apiKey: e.target.value })} placeholder="sk-..." />

            <div style={labelStyle}>模型名称</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={cfg.model} onChange={e => patch({ model: e.target.value })} placeholder="例如 claude-sonnet-4-6 / gpt-4o / gemini-1.5-pro" />
              <span style={{ ...btnStyle, whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : handleDetectModels}>
                {modelStatus === "loading" ? "检测中…" : "🔍 自动检测"}
              </span>
            </div>
            {modelStatus === "error" && (
              <div style={{ fontSize: "10.5px", color: "#c45044", marginTop: 3 }}>✗ 检测失败：{modelErr}</div>
            )}
            {modelList && modelList.length > 0 && (
              <div style={{ marginTop: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #1a2d2a", borderRadius: 3 }}>
                {cfg.apiType === API_TYPES.ANTHROPIC && (
                  <div style={{ padding: "4px 8px", fontSize: "10px", color: "#5a5a4a", borderBottom: "1px solid #14161e" }}>
                    Anthropic 官方无公开模型列表接口，以下是已知模型的静态清单
                  </div>
                )}
                {modelList.map(m => (
                  <div
                    key={m}
                    onClick={() => patch({ model: m })}
                    style={{
                      padding: "5px 8px", cursor: "pointer", fontSize: "11.5px",
                      color: m === cfg.model ? "#6ec6c6" : "#8a8a7a",
                      background: m === cfg.model ? "#1a2a2a" : "transparent",
                      borderBottom: "1px solid #14161e",
                    }}
                  >{m}{m === cfg.model && " ◂"}</div>
                ))}
              </div>
            )}
            {modelList && modelList.length === 0 && (
              <div style={{ fontSize: "10.5px", color: "#c4a040", marginTop: 3 }}>接口未返回任何模型，请手动填写模型名称</div>
            )}

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Temperature</div>
                <input style={inputStyle} type="number" min="0" max="2" step="0.1" value={cfg.temperature} onChange={e => patch({ temperature: parseFloat(e.target.value) || 0 })} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>接口超时（秒）</div>
                <input style={inputStyle} type="number" min="10" max="300" step="10"
                  value={Math.round((cfg.timeoutMs ?? 60000) / 1000)}
                  onChange={e => patch({ timeoutMs: Math.max(10, Math.min(300, parseInt(e.target.value) || 60)) * 1000 })} />
                <div style={{ fontSize: "10px", color: "#5a5a4a", marginTop: 2 }}>
                  接口慢（如千问高峰期）常超时导致移动/操作卡住，可调长到 120~180。
                </div>
              </div>
            </div>

            <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>每次叙事输出字数 <span style={{ color: "#3a3830", fontSize: "10px" }}>（这是游戏体验的核心，直接按汉字数设定，不是 token 数）</span></span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {[["简短", 300], ["适中", 600], ["详细", 900], ["长篇", 1500]].map(([label, val]) => (
                <span
                  key={label}
                  onClick={() => patch({ targetWordCount: val, maxTokens: wordCountToMaxTokens(val) })}
                  style={{
                    ...btnStyle, flex: 1, textAlign: "center",
                    color: cfg.targetWordCount === val ? "#0a0c14" : "#6ec6c6",
                    background: cfg.targetWordCount === val ? "#6ec6c6" : "#10121a",
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
              <span style={{ fontSize: "11px", color: "#7a7a6a" }}>字</span>
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3 }}>
              目标约 {cfg.targetWordCount} 字（允许±15%浮动，AI 会根据这个字数目标自行决定要写几段、每段多长）。
              API 侧的 token 上限会自动换算为 {cfg.maxTokens}，只是防止意外截断的安全余量，不需要手动调整。
            </div>

            {cfg.apiType === API_TYPES.QWEN && (
              <div style={{ border: "1px solid #2a2a3a", borderRadius: 5, padding: "8px 10px", marginTop: 8, background: "#0e1018" }}>
                <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 4 }}>千问 max_tokens 上限</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min="256" max="65536" step="1024"
                    style={{ ...inputStyle, width: 110, marginBottom: 0 }}
                    value={cfg.qwenMaxTokens ?? 32768}
                    onChange={e => patch({ qwenMaxTokens: Math.max(256, Math.min(65536, parseInt(e.target.value) || 32768)) })}
                  />
                  <span style={{ fontSize: "10.5px", color: "#8a8a7a" }}>单次输出 token 上限</span>
                </div>
                <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 4 }}>
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
                    <span style={{ flex: 1, fontSize: "11px", color: "#7a7a6a" }}>{label}</span>
                    <input
                      type="number" min="30" step="50" value={cur}
                      onChange={e => {
                        const v = parseInt(e.target.value) || DEFAULT_INTENT_BUDGETS[key];
                        patch({ intentBudgets: { ...(cfg.intentBudgets || DEFAULT_INTENT_BUDGETS), [key]: v } });
                      }}
                      style={{ ...inputStyle, width: 70 }}
                    />
                    <span style={{ fontSize: "11px", color: "#5a5a4a" }}>字</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginBottom: 6 }}>
              min 自动取 max×40%。UNKNOWN 意图和 MOVE 未匹配时回退到上面的全局字数。
            </div>

            {/* ── 各类调用的 token 输出上限（原来写死在代码里，现全部可调，上限 100000） ── */}
            <div style={{ ...labelStyle, marginTop: 10 }}>各类调用 · token 输出上限</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 6 }}>
              {[
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
                    <span style={{ flex: 1, fontSize: "11px", color: "#7a7a6a" }}>{label}</span>
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
                    <span style={{ fontSize: "11px", color: "#5a5a4a" }}>tok</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginBottom: 6 }}>
              这些是各类 LLM 调用的输出 token 上限（不是字数）。默认已调大，避免带思考的模型（如 gemini-3）思考 token 吃穿正文导致半句截断。每项可调到 {CALL_TOKEN_LIMIT_MAX}。主叙事不在此列（它的上限已由上面的目标字数换算、且地板极高）。
            </div>

            {/* ── 提取层配置 ── */}
            <div style={{ borderTop: "1px solid #1a2d3a", paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  id="extractionEnabled"
                  checked={!!cfg.extractionEnabled}
                  onChange={e => patch({ extractionEnabled: e.target.checked })}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="extractionEnabled" style={{ fontSize: "12px", color: "#6ec6c6", cursor: "pointer", userSelect: "none" }}>
                  启用双调用模式（大模型叙事 + 小模型提取状态）
                </label>
              </div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginBottom: 8, lineHeight: 1.5 }}>
                开启后：主调用只输出叙事散文，提取调用按意图类型单独提取状态变化。
                提取调用可指定更小/更快的模型——空则沿用主模型。
              </div>

              {cfg.extractionEnabled && (
                <>
                  <div style={labelStyle}>默认提取模型（所有意图共用，空则沿用主模型）</div>
                  <input
                    style={inputStyle}
                    value={cfg.extractionModel || ""}
                    onChange={e => patch({ extractionModel: e.target.value })}
                    placeholder={`留空则使用主模型 ${cfg.model}`}
                  />

                  <div style={{ ...labelStyle, marginTop: 10 }}>各意图单独指定模型（空则使用默认提取模型）</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
                    {EXTRACTION_INTENT_LABELS.map(([key, label]) => {
                      const cur = cfg.extractionModels?.[key] ?? "";
                      const placeholder = cfg.extractionModel || cfg.model || "主模型";
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 120, fontSize: "11px", color: "#7a7a6a", flexShrink: 0 }}>{label}</span>
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            value={cur}
                            onChange={e => patch({
                              extractionModels: { ...(cfg.extractionModels || {}), [key]: e.target.value },
                            })}
                            placeholder={placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: "10px", color: "#3a5a5a", lineHeight: 1.5 }}>
                    优先级：意图专属模型 → 默认提取模型 → 主模型。渠道（Endpoint / Key）始终沿用主配置。
                  </div>
                </>
              )}
            </div>

            <div style={labelStyle}>上下文窗口（保留最近 N 轮对话）</div>
            <input style={inputStyle} type="number" min="2" step="2" value={cfg.contextWindow} onChange={e => patch({ contextWindow: parseInt(e.target.value) || 16 })} />

            <div style={labelStyle}>❢ 感叹号任务面板触发方式</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {[
                { key: "prompt", label: "专属prompt harness（推荐）" },
                { key: "script", label: "对话自然演绎" },
              ].map(opt => (
                <button key={opt.key}
                  onClick={() => patch({ questTriggerMode: opt.key })}
                  style={{
                    padding: "4px 10px", borderRadius: 4, border: "1px solid #2a2d3a",
                    cursor: "pointer", fontSize: "11px",
                    color: (cfg.questTriggerMode || "prompt") === opt.key ? "#0a0c14" : "#6ec6c6",
                    background: (cfg.questTriggerMode || "prompt") === opt.key ? "#6ec6c6" : "#10121a",
                  }}
                >{opt.label}</button>
              ))}
            </div>
            <div style={{ fontSize: "10.5px", color: "#7a7a6a", marginTop: -6, marginBottom: 6 }}>
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
              <div style={{ fontSize: "10.5px", color: "#c4a040", marginTop: -6, marginBottom: 6 }}>
                Gemini 暂不支持流式输出，切到 Anthropic 或 OpenAI 兼容类型后可用。
              </div>
            )}

            <div style={labelStyle}>思考 / 推理模式</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {["off", "low", "medium", "high", "custom"].map(m => (
                <button key={m}
                  onClick={() => patch({ thinkingMode: m })}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: "11px", cursor: "pointer",
                    border: "1px solid #2a3550",
                    color: (cfg.thinkingMode || "off") === m ? "#0a0c14" : "#6ec6c6",
                    background: (cfg.thinkingMode || "off") === m ? "#6ec6c6" : "#10121a",
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
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3, marginBottom: 6 }}>
              默认「关闭」：把 token 全留给正文，避免 Gemini 2.5 等模型的思考过程吃穿额度、导致正文被截断。想让模型多想再答可调高，代价是更慢更贵、且可能需要把上面的目标字数调大。
            </div>

            <div style={labelStyle}>CORS 代理地址（可选）</div>
            <input style={inputStyle} value={cfg.corsProxy} onChange={e => patch({ corsProxy: e.target.value })} placeholder="例如 https://your-proxy.com/?url=" />
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3 }}>
              如果目标 API 不支持浏览器直连（CORS 报错），可以填一个中转代理服务的地址前缀。
            </div>

            <div style={{ ...sectionStyle }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#6ec6c6", fontSize: "12px" }}>
                <input type="checkbox" checked={!!cfg.embeddingEnabled} onChange={e => patch({ embeddingEnabled: e.target.checked })} style={{ cursor: "pointer" }} />
                启用向量记忆（长期召回）
              </label>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 3 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: "10.5px", color: "#5a5a4a" }}>
                    <span>本地记忆库：{memCount == null ? "…" : `${memCount} 条`}</span>
                    <span style={{ ...btnStyle, padding: "3px 10px", color: "#c46060", borderColor: "#3a2020" }} onClick={handleClearMemory}>清空记忆库</span>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#8a6a4a", marginTop: 4 }}>
                    ⚠ 换 embedding 模型后旧向量不兼容，会被自动跳过（指纹校验）；如需重建，建议清空后重新游玩积累。
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={btnStyle} onClick={handleTest}>🔗 连接测试</span>
              {testStatus === "testing" && <span style={{ color: "#5a8a5a" }}>测试中...</span>}
              {testStatus === "ok" && <span style={{ color: "#8ac48a" }}>✓ 连接成功：{testMsg}</span>}
              {testStatus === "error" && <span style={{ color: "#c45044" }}>✗ {testMsg}</span>}
            </div>

            <div style={{ ...sectionStyle, background: "#120e0a", border: "1px solid #3a2a1a", borderRadius: 4, padding: 10, fontSize: "10.5px", color: "#a08860" }}>
              ⚠️ 这是纯前端项目，API Key 保存在浏览器本地存储中。请不要把部署后的页面公开挂在互联网上，
              否则访问者可能通过浏览器开发者工具看到你填入的 key。仅限本地自己使用，或搭配后端代理后再对外分享。
            </div>
          </div>
        )}

        {tab === "preset" && <PresetManager state={presetState} onStateChange={updatePresetState} />}

        {tab === "saves" && (
          <div>
            <div style={labelStyle}>手动存档</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={slotLabel} onChange={e => setSlotLabel(e.target.value)} placeholder="存档名称（留空自动生成）" />
              <span style={btnStyle} onClick={handleManualSave}>保存当前进度</span>
            </div>

            {/* 存档落盘：把当前进度导出成 .json 文件，或从文件导入 */}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span style={{ ...btnStyle, flex: 1, textAlign: "center" }} onClick={() => {
                if (!currentSnapshot) return;
                const snap = currentSnapshot();
                downloadText(`曲措乡-存档-${ts()}.json`, exportSave(snap, slotLabel.trim() || undefined));
              }}>⬇ 导出当前进度到文件</span>
              <span style={{ ...btnStyle, flex: 1, textAlign: "center" }} onClick={() => pickTextFile((text) => {
                try { importSave(text); refreshSlots(); alert("已导入存档，可在下方槽位读取。"); }
                catch (e) { alert("导入失败：" + e.message); }
              })}>⬆ 从文件导入存档</span>
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={labelStyle}>自动存档</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "11.5px", color: "#8a8a7a" }}>每</span>
                <input
                  type="number" min="0" max="99"
                  style={{ ...inputStyle, width: 64 }}
                  value={cfg.autoSaveEvery ?? 5}
                  onChange={e => patch({ autoSaveEvery: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)) })}
                />
                <span style={{ fontSize: "11.5px", color: "#8a8a7a" }}>回合写一次自动存档（0 = 每回合都写）</span>
              </div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 6, marginBottom: 8 }}>
                关闭或刷新页面时会自动补写一次，不会丢最近几回合。间隔越大写入越省，回档最多丢对应回合数。
              </div>
              <span
                style={btnStyle}
                onClick={() => {
                  if (!currentSnapshot) return;
                  const r = autoSave(currentSnapshot());
                  alert(r.ok ? "已立即写入自动存档" : `写入失败：${r.error}`);
                }}
              >💾 立即写入自动存档</span>
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={labelStyle}>存档槽位（{slots.length}）</div>
              {slots.length === 0 && <div style={{ color: "#3a3830" }}>暂无手动存档</div>}
              {slots.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #14161e" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#c8bfa0" }}>{s.label}</div>
                    <div style={{ fontSize: "10px", color: "#5a5a4a" }}>{s.presetName} · {new Date(s.savedAt).toLocaleString()}</div>
                  </div>
                  <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => handleLoadSlot(s.id)}>读取</span>
                  <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => {
                    const snap = loadSlot(s.id);
                    if (snap) downloadText(`曲措乡-${s.label}-${ts()}.json`, exportSave(snap, s.label));
                  }}>导出</span>
                  <span style={{ ...btnStyle, padding: "3px 8px", color: "#c45044" }} onClick={() => handleDeleteSlot(s.id)}>删除</span>
                </div>
              ))}
            </div>

            <div style={{ ...sectionStyle, fontSize: "10.5px", color: "#5a5a4a" }}>
              自动存档按上面设定的回合间隔写入，刷新页面后会自动读取。
              进入游戏时如果看到"已从上次自动存档恢复进度"的提示，说明这次是接着上次玩的。
            </div>

            <div style={{ ...sectionStyle }}>
              <div style={labelStyle}>查看缓存</div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginBottom: 8 }}>
                "查看武学/物品"的说书人描述文本会缓存在本地（当前 {inspectCacheSize()} 条），
                同一件东西只调用一次 LLM，之后再看直接读缓存，秒开且不耗 token。
                除非改了描述生成规则想强制刷新，否则不需要清空。
              </div>
              <span
                style={{ ...btnStyle, color: "#c4a040", borderColor: "#3a2d1d" }}
                onClick={() => {
                  if (window.confirm("确定清空「查看武学/物品」的缓存文本？下次查看时会重新调用 LLM 生成。")) {
                    clearInspectCache();
                    alert("已清空查看缓存");
                  }
                }}
              >🗑 清空查看缓存</span>
            </div>

            <div style={{ ...sectionStyle }}>
              <span
                style={{ ...btnStyle, color: "#c45044", borderColor: "#3a1d1d" }}
                onClick={() => {
                  if (window.confirm("确定要清空自动存档、从头开始吗？此操作不可撤销（手动存档槽位不受影响）。")) {
                    clearAutoSave();
                    window.location.reload();
                  }
                }}
              >🗑 清空自动存档，重新开始</span>
            </div>
          </div>
        )}

        {tab === "cheat" && (
          <div>
            <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 10 }}>
              直接修改已经在剧情中登场的角色的好感度数值。这里的角色列表随剧情自动生成，
              不是预先写死的名单——只有 AI 在游戏里通过 &lt;mvu&gt; 指令声明过的角色才会出现在这里。
            </div>
            {listCharacters(varTree).length === 0 && (
              <div style={{ color: "#3a3830" }}>尚未有角色登场，先去游戏里认识几个人吧</div>
            )}
            {listCharacters(varTree).map(({ name, attrs }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #14161e" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#c8bfa0" }}>{name}</div>
                  {typeof attrs.好感度 === "number" && (
                    <div style={{ fontSize: "10.5px", color: "#e0a0d0" }}>{npcAffectionLabel(attrs.好感度)}</div>
                  )}
                </div>
                <input
                  type="number" min="0" max="100"
                  value={attrs.好感度 ?? 0}
                  onChange={e => handleAffectionChange(name, e.target.value)}
                  style={{ ...inputStyle, width: 70 }}
                />
              </div>
            ))}
          </div>
        )}

        {tab === "help" && (
          <div style={{ lineHeight: 1.8 }}>
            <div style={labelStyle}>基本操作</div>
            <div>方向指令：n/s/e/w（北南东西）或"往北"</div>
            <div>look / l 查看房间，look 目标 查看细节</div>
            <div>ask 目标 about 话题 —— 对话</div>
            <div>get / drop / wear / wield / eat / drink</div>
            <div>practice 武功名 —— 运功修炼</div>

            <div style={labelStyle}>三种交互模式</div>
            <div>输入框上方有「◈ 行动 / ◎ 对话 / ◆ 私聊旁白」三个切换按钮。</div>
            <div>行动模式：正常的移动、战斗、开箱子等指令，每次都会消耗1个回合。</div>
            <div>对话模式：只会和当前房间里的 NPC 交谈，不会移动、不会战斗，不消耗回合。</div>
            <div>私聊旁白：打破第四面墙，跟旁白说话，同样不消耗回合。</div>
            <div>⊙ 打坐（右上角）：消耗1回合，恢复部分气血，不是单纯跳过时间。</div>

            <div style={labelStyle}>金手指玩法：旁白攻略</div>
            <div>旁白只有一个，她全程知晓游戏里发生的一切——不管是叙事描述还是私聊内容，都是同一个她。</div>
            <div>好感度不影响她"知道什么"，只影响她讲述时的文风：好感度低时严格公式化，好感度高时连日常叙事里都会渗透她的情绪。</div>
            <div>好感度从 0 到 100，私聊时她的态度会逐渐从生硬转为亲近。</div>
            <div>好感度满 100 后，右侧面板会出现"向旁白告白"的选项。</div>
            <div>告白成功后进入金手指期，可以向旁白打听剧情走向——但提示是渐进式的，不会一次性剧透。</div>
            <div>金手指期持续互动会累积"记忆碎片"，攒够后旁白会经历一次剧烈的宕机，真实身份浮出水面。</div>

            <div style={labelStyle}>创造模式</div>
            <div>点击主控台右上角的 /gamemode 按钮切换。开启后所有请求无条件执行，适合调试或纯玩乐。</div>
          </div>
        )}

      </div>
    </div>
  );
}

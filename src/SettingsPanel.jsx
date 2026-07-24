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
import { affectionLabel } from "./narrator.js";
import PresetManager, { PresetToolbar } from "./PresetManager.jsx";
import PresetEditor from "./PresetEditor.jsx";
import { loadAllPresets, saveAllPresets } from "./presetSystem.js";
import { clearInspectCache, inspectCacheSize } from "./inspectCache.js";
import { clearMemories, countMemories } from "./memory/memoryStore.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

const inputStyle = {
  width: "100%", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3,
  color: "#c8bfa0", padding: "6px 8px", fontFamily: "inherit", fontSize: "12px", boxSizing: "border-box",
};
const labelStyle = { fontSize: "11px", color: "#5a8a5a", marginBottom: 4, marginTop: 10 };
// 次级面板返回栏用的标题
const TAB_LABELS = { api: "API 配置", preset: "预设", narrator: "旁白", saves: "存档管理", other: "其他" };
const sectionStyle = { borderTop: "1px solid #1a1d2e", paddingTop: 12, marginTop: 12 };
const btnStyle = {
  cursor: "pointer", color: "#6ec6c6", padding: "5px 12px", background: "#10121a",
  border: "1px solid #1a2d2a", borderRadius: 3, fontSize: "11.5px", display: "inline-block",
};

export default function SettingsPanel({ cfg, setCfg, onClose, currentSnapshot, onLoadSnapshot, varTree, setVarTree, initialTab, uiScale, setUiScale, narrator, setNarrator }) {
  // 遮罩误触修复：原来外层遮罩单纯 onClick={onClose}，在弹窗内输入框/文本区域
  // 选字拖拽、鼠标移出弹窗范围松手时会被浏览器合成一次落在遮罩上的 click，
  // 导致"复制粘贴选着选着弹窗自己关了"。closeGuard 要求 mousedown 和 click
  // 都精确落在遮罩本身才真正关闭，见 utils/overlayClose.js。
  const closeGuard = useOverlayCloseGuard(onClose);
  const [tab, setTab] = useState(initialTab || null); // null=主页卡片 | api | preset | saves | other
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [testMsg, setTestMsg] = useState("");
  const [slots, setSlots] = useState(listSlots());
  const [slotLabel, setSlotLabel] = useState("");
  const [modelList, setModelList] = useState(null); // null=未探测过, [] = 探测到但为空, [...] = 有结果
  const [modelStatus, setModelStatus] = useState(null); // null | 'loading' | 'error'
  // 提取模型也要能自动检测（本轮补齐）：复用同一份 modelList（提取调用渠道
  // 始终沿用主配置的 endpoint/key，跟主模型是同一个供应商同一份模型列表，
  // 不需要重新发请求检测）。这个状态记录"点击列表里的某一项，应该填到哪个
  // 字段"：null=主模型输入框，"extractionModel"=默认提取模型，其他字符串=
  // 某个意图key(如"MOVE")。modelPickerTarget非null时，模型列表渲染在对应
  // 位置且点击后写入对应字段并清空该状态收起列表。
  const [modelPickerTarget, setModelPickerTarget] = useState(null);
  const [modelErr, setModelErr] = useState("");
  const [presetState, setPresetState] = useState(loadAllPresets());
  const [showFullEditor, setShowFullEditor] = useState(false);
  const [memCount, setMemCount] = useState(null); // 记忆库条数（懒加载）

  React.useEffect(() => {
    if (tab === "api") countMemories().then(setMemCount).catch(() => setMemCount(null));
  }, [tab]);

  // 本项目只对外提供 OpenAI 兼容一种接入方式（DeepSeek/硅基/中转站等）。
  // 旧存档或旧配置里若残留 anthropic/gemini/qwen 类型，挂载时统一纠正为 openai，
  // 避免界面里出现已删除的类型分支、或请求走错协议。
  React.useEffect(() => {
    if (cfg.apiType !== API_TYPES.OPENAI) patch({ apiType: API_TYPES.OPENAI });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 520, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", fontFamily: "inherit", fontSize: "12.5px", color: "#c8bfa0" }} onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#6ec6c6", fontSize: "14px" }}>
            {tab === null ? "⚙ 游戏设置" : (
              <span style={{ cursor: "pointer" }} onClick={() => setTab(null)}>← 返回 · <span style={{ color: "#c8bfa0" }}>{TAB_LABELS[tab] || ""}</span></span>
            )}
          </span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
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

        {/* ── 主页：五个大卡片入口 ── */}
        {tab === null && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {[
              ["api", "🔑 API 配置", "接口地址 · 密钥 · 模型"],
              ["preset", "📜 预设", "对话补全预设 · 编辑器"],
              ["narrator", "🎭 旁白", "好感度 · 阶段 · 私聊篇幅 · 专属世界书"],
              ["saves", "💾 存档管理", "读取 · 导出 · 删除"],
              ["other", "🎚 其他", "字号 · 显示"],
            ].map(([id, title, sub]) => (
              <div key={id} onClick={() => setTab(id)}
                style={{
                  cursor: "pointer", padding: "20px 16px", borderRadius: 6,
                  background: "#0e1018", border: "1px solid #2a3a3a",
                  transition: "all 0.2s ease", textAlign: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#141a24"; e.currentTarget.style.borderColor = "#6ec6c6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#0e1018"; e.currentTarget.style.borderColor = "#2a3a3a"; }}>
                <div style={{ fontSize: "15px", color: "#c8e0d8", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: "10.5px", color: "#6a7a72" }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* 预设次级面板顶部的工具条 + 编辑器入口（原来常驻，现收进预设） */}
        {tab === "preset" && (
          <>
            <PresetToolbar state={presetState} onStateChange={updatePresetState} />
            <div style={{ marginTop: -6, marginBottom: 12 }}>
              <span
                style={{ ...btnStyle, borderColor: "#3a3020", color: "#f0c060" }}
                onClick={() => setShowFullEditor(true)}
              >
                🗂 进入预设编辑器（库存 / 激活链 / 收藏三栏）
              </span>
            </div>
          </>
        )}

        {tab === "api" && (
          <div>
            {/* 【暂留·等会用】原多渠道说明文案，后续可能放到别处：
              支持 OpenAI 兼容格式、Gemini API、Anthropic 原生格式与千问。密钥仅保存在浏览器本地（localStorage），不会上传到任何服务器。 */}
            <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 8 }}>
              填入任一 OpenAI 兼容接口（DeepSeek / 硅基流动 / 各类中转站等）。密钥仅保存在浏览器本地（localStorage），不会上传到任何服务器。
            </div>

            {/* 配置管理：多套配置存本地、随时切换、导出/导入落盘 */}
            <div style={{ border: "1px solid #2a2a3a", borderRadius: 5, padding: "8px 10px", marginBottom: 12, background: "#0e1018" }}>
              <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>配置管理（多套 API 配置 · 落盘导出/导入）</div>
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
                      <span style={{ flex: 1, color: "#c8bfa0" }}>{p.name}
                        <span style={{ color: "#5a5a4a", marginLeft: 6 }}>{p.cfg?.model || ""}</span>
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

            <div style={labelStyle}>API 地址（Endpoint）</div>
            <input style={inputStyle} value={cfg.endpoint} onChange={e => patch({ endpoint: e.target.value })} placeholder="留空使用默认地址" />
            {cfg.apiType === API_TYPES.OPENAI && (
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
              <input style={{ ...inputStyle, flex: 1 }} value={cfg.model} onChange={e => patch({ model: e.target.value })} placeholder="例如 deepseek-chat / deepseek-reasoner" />
              <span style={{ ...btnStyle, whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : () => handleDetectModels(null)}>
                {modelStatus === "loading" && modelPickerTarget === null ? "检测中…" : "🔍 自动检测"}
              </span>
            </div>
            {modelStatus === "error" && modelPickerTarget === null && (
              <div style={{ fontSize: "10.5px", color: "#c45044", marginTop: 3 }}>✗ 检测失败：{modelErr}</div>
            )}
            {modelList && modelList.length > 0 && modelPickerTarget === null && (
              <div style={{ marginTop: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #1a2d2a", borderRadius: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "#5a5a4a", borderBottom: "1px solid #14161e" }}>
                  <span>{cfg.apiType === API_TYPES.ANTHROPIC ? "Anthropic 官方无公开模型列表接口，以下是已知模型的静态清单" : `共 ${modelList.length} 个模型，点击选用`}</span>
                  {/* 之前这个列表没有任何关闭方式：选了模型也不会自动收起，
                      也没有×按钮，列表会一直挂着退不掉。补齐两条退出路径。 */}
                  <span onClick={() => setModelList(null)} style={{ cursor: "pointer", color: "#8a8a7a", flexShrink: 0, marginLeft: 8 }}>✕ 收起</span>
                </div>
                {modelList.map(m => (
                  <div
                    key={m}
                    onClick={() => { patch({ model: m }); setModelList(null); }}
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
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={cfg.extractionModel || ""}
                      onChange={e => patch({ extractionModel: e.target.value })}
                      placeholder={`留空则使用主模型 ${cfg.model}`}
                    />
                    <span style={{ ...btnStyle, whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : () => handleDetectModels("extractionModel")}>
                      {modelStatus === "loading" && modelPickerTarget === "extractionModel" ? "检测中…" : "🔍 检测"}
                    </span>
                  </div>
                  {modelStatus === "error" && modelPickerTarget === "extractionModel" && (
                    <div style={{ fontSize: "10.5px", color: "#c45044", marginTop: 3 }}>✗ 检测失败：{modelErr}</div>
                  )}
                  {modelList && modelList.length > 0 && modelPickerTarget === "extractionModel" && (
                    <div style={{ marginTop: 6, maxHeight: 140, overflowY: "auto", border: "1px solid #1a2d2a", borderRadius: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "#5a5a4a", borderBottom: "1px solid #14161e" }}>
                        <span>{cfg.apiType === API_TYPES.ANTHROPIC ? "Anthropic 官方无公开模型列表接口，以下是已知模型的静态清单" : `共 ${modelList.length} 个模型，点击选用`}</span>
                        <span onClick={() => setModelList(null)} style={{ cursor: "pointer", color: "#8a8a7a", flexShrink: 0, marginLeft: 8 }}>✕ 收起</span>
                      </div>
                      {modelList.map(m => (
                        <div
                          key={m}
                          onClick={() => { patch({ extractionModel: m }); setModelList(null); }}
                          style={{
                            padding: "5px 8px", cursor: "pointer", fontSize: "11.5px",
                            color: m === cfg.extractionModel ? "#6ec6c6" : "#8a8a7a",
                            background: m === cfg.extractionModel ? "#1a2a2a" : "transparent",
                            borderBottom: "1px solid #14161e",
                          }}
                        >{m}{m === cfg.extractionModel && " ◂"}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ ...labelStyle, marginTop: 10 }}>各意图单独指定模型（空则使用默认提取模型）</div>
                  <div style={{ fontSize: "10px", color: "#5a5a4a", marginBottom: 4 }}>
                    下面每行都是可以点击填写的输入框——灰字是"当前会继承的模型"提示，不是禁用状态；要为某个意图单独指定模型，直接点进框里打字，或点🔍从检测到的列表里选。
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
                    {EXTRACTION_INTENT_LABELS.map(([key, label]) => {
                      const cur = cfg.extractionModels?.[key] ?? "";
                      const placeholder = cfg.extractionModel || cfg.model || "主模型";
                      return (
                        <div key={key}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 120, fontSize: "11px", color: "#7a7a6a", flexShrink: 0 }}>{label}</span>
                            <input
                              style={{ ...inputStyle, flex: 1, borderColor: cur ? "#3a6a5a" : "#1a2d2a" }}
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
                              {modelStatus === "loading" && modelPickerTarget === key ? "…" : "🔍"}
                            </span>
                          </div>
                          {modelStatus === "error" && modelPickerTarget === key && (
                            <div style={{ fontSize: "10.5px", color: "#c45044", marginTop: 3, marginLeft: 128 }}>✗ 检测失败：{modelErr}</div>
                          )}
                          {modelList && modelList.length > 0 && modelPickerTarget === key && (
                            <div style={{ marginTop: 4, marginLeft: 128, maxHeight: 140, overflowY: "auto", border: "1px solid #1a2d2a", borderRadius: 3 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "#5a5a4a", borderBottom: "1px solid #14161e" }}>
                                <span>{cfg.apiType === API_TYPES.ANTHROPIC ? "静态清单" : `共 ${modelList.length} 个，点击选用`}</span>
                                <span onClick={() => setModelList(null)} style={{ cursor: "pointer", color: "#8a8a7a", flexShrink: 0, marginLeft: 8 }}>✕ 收起</span>
                              </div>
                              {modelList.map(m => (
                                <div
                                  key={m}
                                  onClick={() => {
                                    patch({ extractionModels: { ...(cfg.extractionModels || {}), [key]: m } });
                                    setModelList(null);
                                  }}
                                  style={{
                                    padding: "5px 8px", cursor: "pointer", fontSize: "11.5px",
                                    color: m === cur ? "#6ec6c6" : "#8a8a7a",
                                    background: m === cur ? "#1a2a2a" : "transparent",
                                    borderBottom: "1px solid #14161e",
                                  }}
                                >{m}{m === cur && " ◂"}</div>
                              ))}
                            </div>
                          )}
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

        {/* ── 旁白 tab（docs/旁白系统_黑客帝国支线设计.md §八.1）──
            把此前散落各处的旁白可调项收拢到一处：好感度与阶段原本只有调试面板里
            一个裸数字框，私聊篇幅/token 上限原本写死在代码里，专属世界书是新增的。 */}
        {tab === "narrator" && (
          <div>
            <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 10 }}>
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
              {[[0, "冷漠疏离"], [20, "略有波动"], [45, "愿意闲聊"], [70, "明显暧昧"], [90, "濒临觉醒"]].map(([v, label], i, arr) => {
                const aff = narrator?.affection ?? 0;
                // 当前落在哪一档：下界 <= 好感度 < 下一档下界（最后一档无上界）
                const active = aff >= v && (i === arr.length - 1 || aff < arr[i + 1][0]);
                return (
                  <span key={v}
                    onClick={() => setNarrator?.(n => ({ ...n, affection: v }))}
                    style={{
                      cursor: "pointer", textAlign: "center", padding: "4px 2px", borderRadius: 3, fontSize: "10px",
                      color: active ? "#0a0c14" : "#6a7a72",
                      background: active ? "#6ec6c6" : "#10121a",
                      border: "1px solid #1a2d2a",
                    }}>
                    {label}
                  </span>
                );
              })}
            </div>
            <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 6 }}>
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
                        color: on ? "#0a0c14" : "#6ec6c6",
                        background: on ? "#6ec6c6" : "#10121a",
                      }}>
                      {label}
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 6 }}>
                正常玩法里阶段由剧情推进（好感满 100 → 点粉色感叹号告白 → 私聊累积 8 次宕机），
                这里是调试用的强制切换。宕机在游戏内不可逆，从这里能掰回来。
              </div>
              {(narrator?.stage === "cheat" || narrator?.confessed) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: "11px", color: "#7a7a6a", flex: 1 }}>记忆碎片（累积到 8 触发宕机）</span>
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
              <div style={labelStyle}>私聊篇幅 · 目标字数</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range" min="50" max="1500" step="50" value={cfg.narratorWhisperWordCount ?? 300}
                  onChange={e => patch({ narratorWhisperWordCount: parseInt(e.target.value) || 300 })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number" min="20" step="50" value={cfg.narratorWhisperWordCount ?? 300}
                  onChange={e => patch({ narratorWhisperWordCount: parseInt(e.target.value) || 300 })}
                  style={{ ...inputStyle, width: 70 }}
                />
                <span style={{ fontSize: "11px", color: "#5a5a4a" }}>字</span>
              </div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 4 }}>
                主叙事有自己的篇幅要求（API 配置里的目标字数，默认 900），私聊此前完全没有篇幅指令、
                模型没有长度目标就只回几十字。这条独立于主叙事，允许±30% 浮动。
                冷漠期的打断式回绝与宕机后的空壳应答不受此值影响，仍是一句话。
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
                <span style={{ fontSize: "11px", color: "#5a5a4a" }}>tok（与 API 配置里那一项是同一个值）</span>
              </div>
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 4 }}>
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
              <div style={{ fontSize: "10.5px", color: "#5a5a4a", marginTop: 4 }}>
                当前 {(cfg.narratorLorebook || "").length} 字。这段拼在私聊 system prompt 里，
                会占用上下文，别写太长。
              </div>
            </div>
          </div>
        )}

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

        {tab === "other" && (
          <div>
            <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 10 }}>显示与其他设置。</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 10px", background: "#0e0c14", border: "1px solid #2a2438", borderRadius: 4 }}>
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
          </div>
        )}

      </div>
    </div>
  );
}

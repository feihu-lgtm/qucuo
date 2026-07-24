import React, { useState, useRef } from "react";
import { setPortrait, removePortrait, fileToDataUrl } from "./portraits.js";
import { loadComfyConfig, saveComfyConfig, generateComfyUIPortrait } from "./comfyui.js";

const btnStyle = {
  cursor: "pointer", color: "#6ec6c6", padding: "4px 10px", background: "#10121a",
  border: "1px solid #1a2d2a", borderRadius: 3, fontSize: "11px", display: "inline-block",
};
const inputStyle = {
  width: "100%", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3,
  color: "#c8bfa0", padding: "6px 8px", fontSize: "12px", boxSizing: "border-box", fontFamily: "inherit",
};

export default function PortraitManager({ portraits, onChange, knownNames, onClose }) {
  const [customName, setCustomName] = useState("");
  const [uploadTarget, setUploadTarget] = useState(null);
  const fileInputRef = useRef(null);

  // ComfyUI 云端自动生成：独立配置口，跟主 LLM 接口配置完全分开存储——
  // 立绘生成用的是图片模型，跟叙事用的文本模型没有任何共享的理由。
  const [comfyCfg, setComfyCfg] = useState(loadComfyConfig);
  const updateComfyCfg = (patch) => setComfyCfg(prev => {
    const next = { ...prev, ...patch };
    saveComfyConfig(next);
    return next;
  });
  const [promptDrafts, setPromptDrafts] = useState({}); // { [name]: 用户为这个人写的外貌提示词 }
  const [generatingNames, setGeneratingNames] = useState(() => new Set());
  const [genError, setGenError] = useState(null); // { name, message }

  const handleGenerate = async (name) => {
    const prompt = (promptDrafts[name] || "").trim();
    if (!prompt) { window.alert("请先填一句外貌提示词，再点自动生成"); return; }
    setGenError(null);
    setGeneratingNames(prev => new Set(prev).add(name));
    try {
      const dataUrl = await generateComfyUIPortrait(prompt);
      const ok = setPortrait(name, dataUrl);
      if (!ok) { window.alert("保存失败，可能是浏览器本地存储空间不足"); return; }
      onChange(prev => ({ ...prev, [name]: dataUrl }));
    } catch (err) {
      setGenError({ name, message: err.message || String(err) });
    } finally {
      setGeneratingNames(prev => { const next = new Set(prev); next.delete(name); return next; });
    }
  };

  const names = [...new Set(knownNames)];

  const triggerUpload = (name) => {
    setUploadTarget(name);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !uploadTarget) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const ok = setPortrait(uploadTarget, dataUrl);
      if (!ok) { window.alert("保存失败，可能是浏览器本地存储空间不足（立绘图片较大时容易超限）"); return; }
      onChange(prev => ({ ...prev, [uploadTarget]: dataUrl }));
    } catch (err) {
      window.alert("读取图片失败：" + err.message);
    }
  };

  const handleRemove = (name) => {
    if (!window.confirm(`删除「${name}」的立绘？`)) return;
    removePortrait(name);
    onChange(prev => { const next = { ...prev }; delete next[name]; return next; });
  };

  const handleAddCustom = () => {
    const name = customName.trim();
    if (!name) return;
    if (!names.includes(name)) names.push(name);
    setCustomName("");
    triggerUpload(name);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div
        style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 6, padding: 20, width: 520, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", fontSize: "12.5px", color: "#c8bfa0" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#6ec6c6", fontSize: "14px" }}>立绘管理</span>
          <span style={{ color: "#5a5a4a", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>
        <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 14 }}>
          为旁白、主角本人、或任意已登场角色导入立绘图片，建议比例 9:16（竖版）。
          图片保存在浏览器本地存储中，不会上传到任何服务器。
        </div>

        <div style={{ border: "1px solid #1a2d2a", borderRadius: 4, padding: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: comfyCfg.enabled ? 8 : 0 }}>
            <span style={{ color: "#6ec6c6", fontSize: "12px" }}>⚡ ComfyUI 云端自动生成</span>
            <label style={{ fontSize: "11px", color: "#8a8a7a", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={comfyCfg.enabled} onChange={e => updateComfyCfg({ enabled: e.target.checked })} />
              启用
            </label>
          </div>
          {comfyCfg.enabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={comfyCfg.baseUrl} onChange={e => updateComfyCfg({ baseUrl: e.target.value })}
                placeholder="ComfyUI 云端地址，例如 https://xxxx.example.com:8188"
                style={inputStyle}
              />
              <textarea
                value={comfyCfg.workflowJson} onChange={e => updateComfyCfg({ workflowJson: e.target.value })}
                placeholder="粘贴 ComfyUI 工作流 JSON（页面菜单「Save (API Format)」导出）"
                style={{ ...inputStyle, height: 64, fontFamily: "monospace", fontSize: "10.5px", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" title="宽度" value={comfyCfg.width} onChange={e => updateComfyCfg({ width: +e.target.value || 768 })} style={{ ...inputStyle, width: 64 }} />
                <input type="number" title="高度" value={comfyCfg.height} onChange={e => updateComfyCfg({ height: +e.target.value || 1152 })} style={{ ...inputStyle, width: 64 }} />
                <input type="number" title="采样步数" value={comfyCfg.steps} onChange={e => updateComfyCfg({ steps: +e.target.value || 20 })} style={{ ...inputStyle, width: 56 }} />
                <input type="number" title="CFG Scale" step="0.5" value={comfyCfg.cfg} onChange={e => updateComfyCfg({ cfg: +e.target.value || 7 })} style={{ ...inputStyle, width: 56 }} />
                <input
                  value={comfyCfg.negativePrompt} onChange={e => updateComfyCfg({ negativePrompt: e.target.value })}
                  placeholder="负向提示词" style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <div style={{ fontSize: "10px", color: "#5a5a4a" }}>
                地址和工作流保存在本地，生成请求经本地开发服务器转发（绕开跨域限制），不经过任何第三方。
                启用后，下方每个已登场角色的卡片会多出一个提示词输入框和「⚡生成」。
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input
            value={customName} onChange={e => setCustomName(e.target.value)}
            placeholder="输入一个新的角色名（比如剧情里刚出场但还没被列出的人）"
            style={{ flex: 1, background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3, color: "#c8bfa0", padding: "6px 8px", fontSize: "12px" }}
          />
          <span style={btnStyle} onClick={handleAddCustom}>+ 添加并上传</span>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
          {names.map(name => {
            const generating = generatingNames.has(name);
            return (
              <div key={name} style={{ border: "1px solid #1a2d2a", borderRadius: 4, padding: 8, textAlign: "center" }}>
                <div style={{
                  width: "100%", aspectRatio: "9/16", background: "#0a0a10", borderRadius: 3, marginBottom: 6,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer",
                }} onClick={() => triggerUpload(name)}>
                  {generating ? (
                    <span style={{ color: "#6ec6c6", fontSize: "10px" }}>⏳ 生成中…</span>
                  ) : portraits[name] ? (
                    <img src={portraits[name]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#3a3830", fontSize: "10px" }}>点击上传</span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "#c8bfa0", marginBottom: 4 }}>{name}</div>
                {comfyCfg.enabled && (
                  <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                    <input
                      value={promptDrafts[name] || ""} onChange={e => setPromptDrafts(p => ({ ...p, [name]: e.target.value }))}
                      placeholder="外貌提示词" disabled={generating}
                      style={{ ...inputStyle, flex: 1, fontSize: "10px", padding: "3px 5px" }}
                    />
                    <span
                      onClick={() => !generating && handleGenerate(name)}
                      style={{ ...btnStyle, fontSize: "10px", padding: "3px 6px", opacity: generating ? 0.5 : 1, cursor: generating ? "default" : "pointer" }}
                    >⚡</span>
                  </div>
                )}
                {genError?.name === name && (
                  <div style={{ color: "#c45044", fontSize: "9.5px", marginBottom: 4 }}>{genError.message}</div>
                )}
                {portraits[name] && (
                  <span onClick={() => handleRemove(name)} style={{ color: "#c45044", fontSize: "10px", cursor: "pointer" }}>删除</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

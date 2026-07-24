import React, { useState, useRef } from "react";
import {
  loadAllPresets, saveAllPresets, defaultPreset, makePromptEntry,
  importFromTavernFormat, exportToTavernFormat, MARKER_IDS,
} from "./presetSystem.js";

const rowStyle = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
  borderBottom: "1px solid #14161e", cursor: "grab",
};
const btnStyle = {
  cursor: "pointer", color: "#6ec6c6", padding: "4px 10px", background: "#10121a",
  border: "1px solid #1a2d2a", borderRadius: 3, fontSize: "11px", display: "inline-block",
};
const inputStyle = {
  width: "100%", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3,
  color: "#c8bfa0", padding: "6px 8px", fontFamily: "inherit", fontSize: "12px", boxSizing: "border-box",
};

// 供外部（MudRPG.jsx）调用：读取当前激活的预设对象
export function getActivePreset() {
  const { presets, activeIndex } = loadAllPresets();
  return presets[activeIndex] || defaultPreset();
}

// 顶部常驻工具栏：参照酒馆"预设永远显示在最上面，不管切到哪个标签页"的布局。
// 挂载在 SettingsPanel 弹窗顶部（标题下方、标签栏上方），而不是藏在某个标签页里。
// state/onStateChange 由父组件（SettingsPanel）持有和传入，这样顶部工具栏
// 和下方"预设"标签页里的条目列表操作的是同一份数据，改一处两边同步更新。
export function PresetToolbar({ state, onStateChange }) {
  const fileInputRef = useRef(null);
  const activePreset = state.presets[state.activeIndex] || defaultPreset();

  const persist = (next) => onStateChange(next);

  const handleSwitchPreset = (idx) => persist({ ...state, activeIndex: idx });

  const handleNewPreset = () => {
    const name = window.prompt("新预设名称：", "新预设");
    if (!name) return;
    const np = { ...defaultPreset(), name };
    persist({ presets: [...state.presets, np], activeIndex: state.presets.length });
  };

  const handleDuplicate = () => {
    const name = window.prompt("另存为名称：", `${activePreset.name} 副本`);
    if (!name) return;
    const copy = { ...JSON.parse(JSON.stringify(activePreset)), name };
    persist({ presets: [...state.presets, copy], activeIndex: state.presets.length });
  };

  const handleDelete = () => {
    if (state.presets.length <= 1) { window.alert("至少要保留一个预设"); return; }
    if (!window.confirm(`确定删除预设「${activePreset.name}」？`)) return;
    const next = state.presets.filter((_, i) => i !== state.activeIndex);
    persist({ presets: next, activeIndex: Math.max(0, state.activeIndex - 1) });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (!json.prompts) { window.alert("这不是一个有效的酒馆预设文件（缺少 prompts 字段）"); return; }
        const name = file.name.replace(/\.json$/i, "");
        const imported = importFromTavernFormat(json, name);
        persist({ presets: [...state.presets, imported], activeIndex: state.presets.length });
        window.alert(`成功导入「${name}」，共 ${imported.prompts.length} 条 prompt，${imported.order.filter(o => o.enabled).length} 条已启用`);
      } catch (err) {
        window.alert("导入失败：" + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const data = exportToTavernFormat(activePreset);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${activePreset.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: "#0e0c14", border: "1px solid #2a2438", borderRadius: 4, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{ fontSize: "10px", color: "#7a7a6a", marginBottom: 6 }}>对话补全预设</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={state.activeIndex}
          onChange={e => handleSwitchPreset(parseInt(e.target.value))}
          style={{ ...inputStyle, width: "auto", flex: 1, minWidth: 140, fontSize: "13px", fontWeight: "bold" }}
        >
          {state.presets.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
        </select>
        <span style={btnStyle} onClick={handleNewPreset}>+ 新建</span>
        <span style={btnStyle} onClick={handleDuplicate}>另存为</span>
        <span style={{ ...btnStyle, color: "#c45044" }} onClick={handleDelete}>删除</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ ...btnStyle, borderColor: "#3a5a3a", color: "#8ac48a" }} onClick={handleImportClick}>📥 导入酒馆 JSON 预设</span>
        <span style={btnStyle} onClick={handleExport}>📤 导出当前预设</span>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileChange} />
      </div>
    </div>
  );
}

export default function PresetManager({ state, onStateChange }) {
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const activePreset = state.presets[state.activeIndex] || defaultPreset();

  const updateActivePreset = (updater) => {
    onStateChange({
      ...state,
      presets: state.presets.map((p, i) => i === state.activeIndex ? updater(p) : p),
    });
  };

  const toggleEnabled = (id) => {
    updateActivePreset(p => ({
      ...p,
      order: p.order.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o),
    }));
  };

  const updateContent = (id, content) => {
    updateActivePreset(p => ({
      ...p,
      prompts: p.prompts.map(pr => pr.id === id ? { ...pr, content } : pr),
    }));
  };

  const addNewEntry = () => {
    const name = window.prompt("新条目名称：", "新片段");
    if (!name) return;
    const entry = makePromptEntry({ name });
    updateActivePreset(p => ({
      ...p,
      prompts: [...p.prompts, entry],
      order: [...p.order, { id: entry.id, enabled: true }],
    }));
  };

  const deleteEntry = (id) => {
    if (!window.confirm("删除这个条目？")) return;
    updateActivePreset(p => ({
      ...p,
      prompts: p.prompts.filter(pr => pr.id !== id),
      order: p.order.filter(o => o.id !== id),
    }));
    if (editingId === id) setEditingId(null);
  };

  const handleDragStart = (id) => setDraggingId(id);
  const handleDragOver = (e, overId) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    updateActivePreset(p => {
      const order = [...p.order];
      const fromIdx = order.findIndex(o => o.id === draggingId);
      const toIdx = order.findIndex(o => o.id === overId);
      if (fromIdx === -1 || toIdx === -1) return p;
      const [moved] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, moved);
      return { ...p, order };
    });
  };
  const handleDragEnd = () => setDraggingId(null);

  const byId = Object.fromEntries(activePreset.prompts.map(p => [p.id, p]));

  return (
    <div>
      <div style={{ fontSize: "11px", color: "#7a7a6a", marginBottom: 10 }}>
        完整兼容 SillyTavern 酒馆预设格式：可以导入酒馆导出的 Chat Completion 预设 JSON，
        每条独立的 prompt 片段都能单独开关、编辑内容、拖拽调整顺序，真正按顺序拼进最终发给模型的 system prompt。
        预设的选择、新建、导入导出已经移到设置面板最上方的常驻工具栏，这里只管理当前预设的具体内容。
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "10.5px", color: "#5a8a5a", marginBottom: 3 }}>Temperature（留空跟随全局设置）</div>
          <input
            type="number" step="0.1" placeholder="跟随全局"
            value={activePreset.temperature ?? ""}
            onChange={e => updateActivePreset(p => ({ ...p, temperature: e.target.value === "" ? null : parseFloat(e.target.value) }))}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "10.5px", color: "#5a8a5a", marginBottom: 3 }}>最大输出 Token（留空跟随全局设置）</div>
          <input
            type="number" step="100" placeholder="跟随全局"
            value={activePreset.maxTokens ?? ""}
            onChange={e => updateActivePreset(p => ({ ...p, maxTokens: e.target.value === "" ? null : parseInt(e.target.value) }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: "11px", color: "#5a8a5a" }}>
          Prompt 条目（{activePreset.order.length} 条，{activePreset.order.filter(o => o.enabled).length} 条已启用）
          <span style={{ color: "#3a3830", fontSize: "10px" }}> · 拖拽排序 · 点名字展开编辑</span>
        </div>
        <span style={btnStyle} onClick={addNewEntry}>+ 新增条目</span>
      </div>

      <div style={{ border: "1px solid #1a2d2a", borderRadius: 4, maxHeight: 360, overflowY: "auto" }}>
        {activePreset.order.map(o => {
          const p = byId[o.id];
          if (!p) return null;
          const isEditing = editingId === o.id;
          return (
            <div key={o.id}>
              <div
                style={{ ...rowStyle, opacity: draggingId === o.id ? 0.4 : 1, background: o.enabled ? "transparent" : "#0a0a10" }}
                draggable
                onDragStart={() => handleDragStart(o.id)}
                onDragOver={e => handleDragOver(e, o.id)}
                onDragEnd={handleDragEnd}
              >
                <span style={{ color: "#3a3830", fontSize: "10px" }}>⠿</span>
                <input type="checkbox" checked={o.enabled} onChange={() => toggleEnabled(o.id)} />
                <span
                  onClick={() => setEditingId(isEditing ? null : o.id)}
                  style={{
                    flex: 1, cursor: "pointer", fontSize: "12px",
                    color: o.enabled ? "#c8bfa0" : "#5a5a4a",
                    textDecoration: p.isMarker ? "none" : "underline", textDecorationStyle: "dotted", textDecorationColor: "#3a3830",
                  }}
                >
                  {p.name} {p.isMarker && <span style={{ fontSize: "9.5px", color: "#5a8a5a" }}>[占位符]</span>}
                  <span style={{ fontSize: "9.5px", color: "#4a4a4a", marginLeft: 6 }}>{p.role}</span>
                </span>
                {!p.isMarker && (
                  <span onClick={() => deleteEntry(o.id)} style={{ color: "#c45044", fontSize: "10px", cursor: "pointer" }}>删除</span>
                )}
              </div>
              {isEditing && (
                <div style={{ padding: "8px 12px", background: "#0a0a10", borderBottom: "1px solid #14161e" }}>
                  {p.isMarker ? (
                    <div style={{ fontSize: "11px", color: "#7a7a6a" }}>
                      这是系统占位符，代表引擎运行时会自动填充的内容
                      {p.id === "scenario" || p.id === "charDescription" ? "（对应曲措乡的剧本设定）" : p.id === "chatHistory" ? "（对应最近的对话历史）" : "（我们的引擎暂不支持这个占位符，拼装时会跳过）"}
                      ，不能手动编辑文字内容。
                    </div>
                  ) : (
                    <textarea
                      value={p.content}
                      onChange={e => updateContent(o.id, e.target.value)}
                      rows={6}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                      placeholder="这条 prompt 片段的具体内容……"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

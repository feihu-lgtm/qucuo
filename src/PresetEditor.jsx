import React, { useState } from "react";
import {
  makePromptEntry, defaultConstraint,
  loadPresetLibrary, addToLibrary, removeFromLibrary,
} from "./presetSystem.js";

// ── 全屏预设编辑器（本轮新增）──
// 参照 SPreset Editor 的三栏布局：左侧"未使用项目"（库存，在 prompts 里但没进
// order 激活链）、中间"激活的提示词链"（真正会拼进最终 system prompt 的顺序清单，
// 就是原来 PresetManager.jsx 那部分逻辑的加强版）、右侧"收藏/模板"（跨预设共享的
// 全局片段库，本预设、其他预设都能随手插用）。
// 数据落点：库存/激活链的增删挪动都是在编辑同一个 preset 对象（prompts + order
// 两个数组），跟原有 PresetManager.jsx 操作的是同一份数据结构，互相兼容，
// 只是这里换了更完整的三栏交互。收藏库是完全独立的全局存储，不属于任何单个预设。

const colStyle = {
  flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
  background: "#0c0e16", border: "1px solid #1a2d2a", borderRadius: 6, overflow: "hidden",
};
const colHeaderStyle = {
  padding: "10px 14px", borderBottom: "1px solid #1a2d2a", fontSize: "13px",
  fontWeight: "bold", color: "#8ac4c4", display: "flex", justifyContent: "space-between", alignItems: "center",
};
const cardStyle = (dragging) => ({
  background: "#10121a", border: "1px solid #22262e", borderRadius: 5, padding: "8px 10px",
  marginBottom: 6, cursor: "grab", opacity: dragging ? 0.4 : 1,
});
const smallBtn = {
  cursor: "pointer", color: "#6ec6c6", fontSize: "10.5px", padding: "2px 6px",
  border: "1px solid #1a2d2a", borderRadius: 3, background: "#10121a", whiteSpace: "nowrap",
};

// 结构化叙事约束的编辑表单：字数范围、禁用词、禁用句式、文体规则勾选。
// 每次修改直接调用 onChange(newConstraint)，由外层负责写回 preset.prompts。
function ConstraintEditor({ constraint, onChange }) {
  const c = constraint || defaultConstraint();
  const set = (field, value) => onChange({ ...c, [field]: value });
  const tagInputStyle = {
    width: "100%", background: "#0a0a10", border: "1px solid #1a2d2a", borderRadius: 3,
    color: "#c8bfa0", padding: "5px 8px", fontFamily: "inherit", fontSize: "11px", boxSizing: "border-box",
  };
  const rowLabel = { fontSize: "10px", color: "#5a8a5a", marginBottom: 3 };
  const checkRow = { display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#c8bfa0", marginTop: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={rowLabel}>字数下限（空=不限）</div>
          <input type="number" min="0" value={c.wordCountMin ?? ""} placeholder="不限"
            onChange={e => set("wordCountMin", e.target.value === "" ? null : parseInt(e.target.value))} style={tagInputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={rowLabel}>字数上限（空=不限）</div>
          <input type="number" min="0" value={c.wordCountMax ?? ""} placeholder="不限"
            onChange={e => set("wordCountMax", e.target.value === "" ? null : parseInt(e.target.value))} style={tagInputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={rowLabel}>单段成语上限（空=不限）</div>
          <input type="number" min="0" value={c.maxIdiomsPerParagraph ?? ""} placeholder="不限"
            onChange={e => set("maxIdiomsPerParagraph", e.target.value === "" ? null : parseInt(e.target.value))} style={tagInputStyle} />
        </div>
      </div>

      <div>
        <div style={rowLabel}>禁用词（逗号或换行分隔）</div>
        <textarea rows={2} value={(c.bannedWords || []).join("、")}
          onChange={e => set("bannedWords", e.target.value.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean))}
          style={{ ...tagInputStyle, resize: "vertical" }} placeholder="例：一丝、不容置疑、不易察觉" />
      </div>

      <div>
        <div style={rowLabel}>禁用句式（每行一条）</div>
        <textarea rows={2} value={(c.bannedPatterns || []).join("\n")}
          onChange={e => set("bannedPatterns", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
          style={{ ...tagInputStyle, resize: "vertical" }} placeholder="例：不是X，而是Y" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={checkRow}>
          <input type="checkbox" checked={!!c.noColonDash} onChange={e => set("noColonDash", e.target.checked)} />
          禁用冒号、破折号
        </label>
        <label style={checkRow}>
          <input type="checkbox" checked={!!c.dialogueQuoteMark} onChange={e => set("dialogueQuoteMark", e.target.checked)} />
          对话必须「」包裹
        </label>
        <label style={checkRow}>
          <input type="checkbox" checked={!!c.noAbstractSummary} onChange={e => set("noAbstractSummary", e.target.checked)} />
          禁止段落抽象总结收尾
        </label>
      </div>
    </div>
  );
}

// 三栏共用的"这条 prompt 卡片"渲染，dragType 标记来源栏，供 onDrop 判断怎么处理
function EntryCard({ entry, name, role, isMarker, entryType, constraint, dragging, onDragStart, onDragEnd, actions, onClickName, editing, content, onContentChange, onConstraintChange, showContent }) {
  return (
    <div>
      <div
        style={cardStyle(dragging)}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#3a3830", fontSize: "10px" }}>⠿</span>
          <span
            onClick={onClickName}
            style={{ flex: 1, cursor: onClickName ? "pointer" : "default", fontSize: "12px", color: "#c8bfa0" }}
          >
            {name} {isMarker && <span style={{ fontSize: "9px", color: "#5a8a5a" }}>[占位]</span>}
            {entryType === "narrativeConstraint" && <span style={{ fontSize: "9px", color: "#c48a4a" }}>[叙事约束]</span>}
            <span style={{ fontSize: "9px", color: "#4a4a4a", marginLeft: 6 }}>{role}</span>
          </span>
          <div style={{ display: "flex", gap: 4 }}>{actions}</div>
        </div>
        {showContent && editing && (
          isMarker ? (
            <div style={{ fontSize: "10.5px", color: "#7a7a6a", marginTop: 6 }}>系统占位符，运行时自动填充，不能手动编辑。</div>
          ) : entryType === "narrativeConstraint" ? (
            <div style={{ marginTop: 8 }}>
              <ConstraintEditor constraint={constraint} onChange={onConstraintChange} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => onContentChange(e.target.value)}
              rows={5}
              style={{
                width: "100%", marginTop: 6, background: "#0a0a10", border: "1px solid #1a2d2a",
                borderRadius: 3, color: "#c8bfa0", padding: "6px 8px", fontFamily: "inherit",
                fontSize: "11.5px", boxSizing: "border-box", resize: "vertical",
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function PresetEditor({ preset, onChange, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [drag, setDrag] = useState(null); // { id, from: 'unused'|'active'|'library' }
  const [library, setLibrary] = useState(() => loadPresetLibrary());

  const byId = Object.fromEntries(preset.prompts.map(p => [p.id, p]));
  const activeIds = new Set(preset.order.map(o => o.id));
  const unusedPrompts = preset.prompts.filter(p => !activeIds.has(p.id));

  const update = (updater) => onChange(updater(preset));
  const setNum = (field) => (e) => update(p => ({ ...p, [field]: e.target.value === "" ? null : parseFloat(e.target.value) }));

  const numFieldStyle = {
    width: "100%", background: "#10121a", border: "1px solid #1a2d2a", borderRadius: 3,
    color: "#c8bfa0", padding: "5px 8px", fontFamily: "inherit", fontSize: "11.5px", boxSizing: "border-box",
  };
  const numFieldWrap = { flex: 1, minWidth: 110 };
  const numLabel = { fontSize: "9.5px", color: "#5a8a5a", marginBottom: 3 };

  // ── 库存 ⇄ 激活链 互相移动 ──
  const moveToActive = (id, atIndex = null) => {
    update(p => {
      if (p.order.some(o => o.id === id)) return p; // 已经在激活链里，不重复加
      const order = [...p.order];
      const entry = { id, enabled: true };
      if (atIndex == null) order.push(entry); else order.splice(atIndex, 0, entry);
      return { ...p, order };
    });
  };
  const moveToUnused = (id) => {
    update(p => ({ ...p, order: p.order.filter(o => o.id !== id) }));
  };
  const reorderActive = (draggedId, overId) => {
    update(p => {
      const order = [...p.order];
      const fromIdx = order.findIndex(o => o.id === draggedId);
      const toIdx = order.findIndex(o => o.id === overId);
      if (fromIdx === -1 || toIdx === -1) return p;
      const [moved] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, moved);
      return { ...p, order };
    });
  };
  const toggleEnabled = (id) => {
    update(p => ({ ...p, order: p.order.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o) }));
  };
  const updateContent = (id, content) => {
    update(p => ({ ...p, prompts: p.prompts.map(pr => pr.id === id ? { ...pr, content } : pr) }));
  };
  const updateConstraint = (id, constraint) => {
    update(p => ({ ...p, prompts: p.prompts.map(pr => pr.id === id ? { ...pr, constraint } : pr) }));
  };
  const deleteEntry = (id) => {
    if (!window.confirm("彻底删除这个条目？（不是移到库存，是真的删掉）")) return;
    update(p => ({ ...p, prompts: p.prompts.filter(pr => pr.id !== id), order: p.order.filter(o => o.id !== id) }));
    if (editingId === id) setEditingId(null);
  };
  const addNewUnused = () => {
    const name = window.prompt("新条目名称：", "新片段");
    if (!name) return;
    const entry = makePromptEntry({ name });
    update(p => ({ ...p, prompts: [...p.prompts, entry] })); // 新建直接进库存，不自动激活
  };
  const addNewConstraintEntry = () => {
    const name = window.prompt("叙事约束条目名称：", "叙事约束");
    if (!name) return;
    const entry = makePromptEntry({ name, type: "narrativeConstraint" });
    update(p => ({ ...p, prompts: [...p.prompts, entry] }));
    setEditingId(entry.id); // 新建的约束条目直接展开编辑表单，减少一次点击
  };

  // ── 收藏库操作 ──
  const saveToLibrary = (id) => {
    const p = byId[id];
    if (!p) return;
    const copy = addToLibrary(p);
    setLibrary(l => [...l, copy]);
  };
  const insertFromLibrary = (libEntry) => {
    // 插入当前预设的库存区（不是直接进激活链——由用户自己再拖进链条，避免收藏一插
    // 就意外改变了当前正在生效的 prompt 顺序和内容）
    const copy = makePromptEntry({ name: libEntry.name, role: libEntry.role, content: libEntry.content, type: libEntry.type || "text", constraint: libEntry.constraint || null });
    update(p => ({ ...p, prompts: [...p.prompts, copy] }));
  };
  // 拖拽目标明确是"激活链"区域时，直接进 order（拖到中栏这个动作本身就表达了
  // "我要激活它"的意图，不需要再多一步"进库存再拖一次"）。
  const insertFromLibraryToActive = (libEntry) => {
    const copy = makePromptEntry({ name: libEntry.name, role: libEntry.role, content: libEntry.content, type: libEntry.type || "text", constraint: libEntry.constraint || null });
    update(p => ({ ...p, prompts: [...p.prompts, copy], order: [...p.order, { id: copy.id, enabled: true }] }));
  };
  const deleteFromLibrary = (libId) => {
    if (!window.confirm("从收藏库删除这个模板？（不影响已经插入到预设里的副本）")) return;
    removeFromLibrary(libId);
    setLibrary(l => l.filter(x => x.id !== libId));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#07080d", zIndex: 900,
      display: "flex", flexDirection: "column", fontFamily: "monospace",
    }}>
      <div style={{
        padding: "12px 20px", borderBottom: "1px solid #1a2d2a", display: "flex",
        justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <div style={{ fontSize: "15px", color: "#f0c060", fontWeight: "bold" }}>
          预设编辑器 · {preset.name}
        </div>
        <span style={{ ...smallBtn, fontSize: "12px", padding: "6px 14px" }} onClick={onClose}>完成，返回</span>
      </div>

      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1a2d2a", flexShrink: 0 }}>
        <div style={{ fontSize: "10px", color: "#7a7a6a", marginBottom: 6 }}>
          采样参数（留空 = 跟随全局 API 设置）· 不同 API 支持范围不同，不支持的字段会在实际请求时自动跳过，不会报错
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={numFieldWrap}>
            <div style={numLabel}>Temperature</div>
            <input type="number" step="0.1" placeholder="跟随全局" value={preset.temperature ?? ""} onChange={setNum("temperature")} style={numFieldStyle} />
          </div>
          <div style={numFieldWrap}>
            <div style={numLabel}>Max Tokens</div>
            <input type="number" step="100" placeholder="跟随全局" value={preset.maxTokens ?? ""} onChange={setNum("maxTokens")} style={numFieldStyle} />
          </div>
          <div style={numFieldWrap}>
            <div style={numLabel}>Top P <span style={{ color: "#4a4a4a" }}>（三家都支持；Anthropic下与Temp二选一，设了这个就不传Temp）</span></div>
            <input type="number" step="0.05" min="0" max="1" placeholder="跟随全局" value={preset.topP ?? ""} onChange={setNum("topP")} style={numFieldStyle} />
          </div>
          <div style={numFieldWrap}>
            <div style={numLabel}>Top K <span style={{ color: "#4a4a4a" }}>（Anthropic/Gemini支持，OpenAI兼容不支持会被跳过）</span></div>
            <input type="number" step="1" min="0" placeholder="跟随全局" value={preset.topK ?? ""} onChange={setNum("topK")} style={numFieldStyle} />
          </div>
          <div style={numFieldWrap}>
            <div style={numLabel}>Frequency Penalty <span style={{ color: "#4a4a4a" }}>（Gemini/OpenAI兼容支持，Anthropic无此概念会被跳过）</span></div>
            <input type="number" step="0.1" min="-2" max="2" placeholder="跟随全局" value={preset.frequencyPenalty ?? ""} onChange={setNum("frequencyPenalty")} style={numFieldStyle} />
          </div>
          <div style={numFieldWrap}>
            <div style={numLabel}>Presence Penalty <span style={{ color: "#4a4a4a" }}>（Gemini/OpenAI兼容支持，Anthropic无此概念会被跳过）</span></div>
            <input type="number" step="0.1" min="-2" max="2" placeholder="跟随全局" value={preset.presencePenalty ?? ""} onChange={setNum("presencePenalty")} style={numFieldStyle} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 12, padding: 14, overflow: "hidden" }}>

        {/* ── 左：未使用项目（库存）── */}
        <div style={{ ...colStyle, flex: 0.8 }}>
          <div style={colHeaderStyle}>
            <span>📦 未使用项目（{unusedPrompts.length}）</span>
            <div style={{ display: "flex", gap: 4 }}>
              <span style={smallBtn} onClick={addNewUnused}>+ 新增</span>
              <span style={{ ...smallBtn, color: "#c48a4a" }} onClick={addNewConstraintEntry}>+ 约束条目</span>
            </div>
          </div>
          <div
            style={{ flex: 1, overflowY: "auto", padding: 10 }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (drag?.from === "active") moveToUnused(drag.id); setDrag(null); }}
          >
            {unusedPrompts.length === 0 && <div style={{ color: "#3a3830", fontSize: "11px", padding: 8 }}>（空，把右边激活链里的条目拖过来即可雪藏）</div>}
            {unusedPrompts.map(p => (
              <EntryCard
                key={p.id}
                entry={p} name={p.name} role={p.role} isMarker={p.isMarker}
                entryType={p.type} constraint={p.constraint}
                dragging={drag?.id === p.id}
                onDragStart={() => setDrag({ id: p.id, from: "unused" })}
                onDragEnd={() => setDrag(null)}
                onClickName={() => setEditingId(editingId === p.id ? null : p.id)}
                editing={editingId === p.id} showContent
                content={p.content} onContentChange={v => updateContent(p.id, v)}
                onConstraintChange={v => updateConstraint(p.id, v)}
                actions={[
                  <span key="act" style={smallBtn} onClick={() => moveToActive(p.id)}>→ 启用</span>,
                  <span key="fav" style={smallBtn} onClick={() => saveToLibrary(p.id)}>☆ 收藏</span>,
                  !p.isMarker && <span key="del" style={{ ...smallBtn, color: "#c45044" }} onClick={() => deleteEntry(p.id)}>删除</span>,
                ]}
              />
            ))}
          </div>
        </div>

        {/* ── 中：激活的提示词链 ── */}
        <div style={{ ...colStyle, flex: 1.4 }}>
          <div style={colHeaderStyle}>
            <span>▶ 激活的提示词链（{preset.order.length}，{preset.order.filter(o => o.enabled).length} 启用）</span>
            <span style={{ fontSize: "10px", color: "#5a5a4a", fontWeight: "normal" }}>拖拽调整顺序 · 拖出左侧可雪藏</span>
          </div>
          <div
            style={{ flex: 1, overflowY: "auto", padding: 10 }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (drag?.from === "unused") moveToActive(drag.id);
              if (drag?.from === "library") {
                const libEntry = library.find(x => x.id === drag.id);
                if (libEntry) insertFromLibraryToActive(libEntry);
              }
              setDrag(null);
            }}
          >
            {preset.order.map(o => {
              const p = byId[o.id];
              if (!p) return null;
              return (
                <div
                  key={o.id}
                  onDragOver={e => { e.preventDefault(); if (drag?.from === "active" && drag.id !== o.id) reorderActive(drag.id, o.id); }}
                >
                  <EntryCard
                    entry={p} name={p.name} role={p.role} isMarker={p.isMarker}
                    entryType={p.type} constraint={p.constraint}
                    dragging={drag?.id === o.id}
                    onDragStart={() => setDrag({ id: o.id, from: "active" })}
                    onDragEnd={() => setDrag(null)}
                    onClickName={() => setEditingId(editingId === o.id ? null : o.id)}
                    editing={editingId === o.id} showContent
                    content={p.content} onContentChange={v => updateContent(o.id, v)}
                    onConstraintChange={v => updateConstraint(o.id, v)}
                    actions={[
                      <input key="chk" type="checkbox" checked={o.enabled} onChange={() => toggleEnabled(o.id)} title="是否参与本次生成" />,
                      <span key="unuse" style={smallBtn} onClick={() => moveToUnused(o.id)}>← 移出</span>,
                      <span key="fav" style={smallBtn} onClick={() => saveToLibrary(o.id)}>☆ 收藏</span>,
                    ]}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 右：收藏/模板 ── */}
        <div style={{ ...colStyle, flex: 0.9, borderColor: "#3a3020" }}>
          <div style={{ ...colHeaderStyle, color: "#f0c060" }}>
            <span>☆ 收藏 / 模板（{library.length}）</span>
          </div>
          <div
            style={{
              flex: 1, overflowY: "auto", padding: 10,
              border: "2px dashed transparent",
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (drag?.from === "unused" || drag?.from === "active") {
                const p = byId[drag.id];
                if (p) { const copy = addToLibrary(p); setLibrary(l => [...l, copy]); }
              }
              setDrag(null);
            }}
          >
            {library.length === 0 && (
              <div style={{ color: "#3a3830", fontSize: "11px", padding: 8 }}>
                （空，把左边或中间的条目拖到这里收藏，或点条目上的"☆ 收藏"按钮）
              </div>
            )}
            {library.map(item => (
              <div key={item.id} style={cardStyle(drag?.id === item.id)} draggable
                onDragStart={() => setDrag({ id: item.id, from: "library" })}
                onDragEnd={() => setDrag(null)}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ flex: 1, fontSize: "12px", color: "#c8bfa0" }}>{item.name}</span>
                  <span style={smallBtn} onClick={() => insertFromLibrary(item)}>+ 插入本预设</span>
                  <span style={{ ...smallBtn, color: "#c45044" }} onClick={() => deleteFromLibrary(item.id)}>删除</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { API_TYPES } from "../../../infra/apiConfig.js";

// 模型检测结果的展示块：错误行 + 可点选列表（原 api tab 里重复 3 份的同一结构）。
// target 命中 modelPickerTarget 时才显示；shortHeader 用于意图行里的紧凑文案。
export default function ModelPicker({ target, modelPickerTarget, modelStatus, modelErr, modelList, apiType, current, onPick, onClose, indent = 0, shortHeader = false }) {
  if (modelPickerTarget !== target) return null;
  return (
    <>
      {modelStatus === "error" && (
        <div style={{ fontSize: "10.5px", color: "var(--red-soft)", marginTop: 3, marginLeft: indent || undefined }}>✗ 检测失败：{modelErr}</div>
      )}
      {modelList && modelList.length > 0 && (
        <div style={{ marginTop: indent ? 4 : 6, marginLeft: indent || undefined, maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", fontSize: "10px", color: "var(--ink-text-dim)", borderBottom: "1px solid var(--bg-slate)" }}>
            <span>{apiType === API_TYPES.ANTHROPIC
              ? (shortHeader ? "静态清单" : "Anthropic 官方无公开模型列表接口，以下是已知模型的静态清单")
              : (shortHeader ? `共 ${modelList.length} 个，点击选用` : `共 ${modelList.length} 个模型，点击选用`)}</span>
            {/* 之前这个列表没有任何关闭方式：选了模型也不会自动收起，
                也没有×按钮，列表会一直挂着退不掉。补齐两条退出路径。 */}
            <span onClick={onClose} style={{ cursor: "pointer", color: "var(--text-dim)", flexShrink: 0, marginLeft: 8 }}>✕ 收起</span>
          </div>
          {modelList.map(m => (
            <div
              key={m}
              onClick={() => onPick(m)}
              style={{
                padding: "5px 8px", cursor: "pointer", fontSize: "11.5px",
                color: m === current ? "var(--accent)" : "var(--text-dim)",
                background: m === current ? "var(--ink-select-bg)" : "transparent",
                borderBottom: "1px solid var(--bg-slate)",
              }}
            >{m}{m === current && " ◂"}</div>
          ))}
        </div>
      )}
    </>
  );
}

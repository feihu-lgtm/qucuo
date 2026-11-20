import { useState } from "react";
import { DEFAULT_VERTEX_MODEL } from "../../core/apiModel.js";

const VERTEX_MODELS = [
  [DEFAULT_VERTEX_MODEL],
  ["google/gemini-3.7-flash"],
  ["google/gemini-3.6-flash"],
  ["google/gemini-3.5-flash"],
  ["google/gemini-3-flash-preview"],
  ["google/gemini-3.1-pro-preview"],
  ["google/gemini-3.5-flash-lite"],
  ["google/gemini-3.1-flash-lite"],
  ["google/gemini-4-hydrogen", "需开通 Gemini 4 额度"],
];

export default function ApiProviderSettings({
  cfg, patch, types, importCredential, hasCredential, labelStyle, inputStyle,
}) {
  const [status, setStatus] = useState("");
  const vertex = cfg.apiType === types.VERTEX;
  const fieldLabel = { ...labelStyle, display: "block" };
  const vertexModel = cfg.vertexModel ?? DEFAULT_VERTEX_MODEL;
  const preset = VERTEX_MODELS.some(([id]) => id === vertexModel) ? vertexModel : "";

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const project = await importCredential(await file.text());
      patch({ vertexProject: project || cfg.vertexProject || "" });
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <>
      <label style={fieldLabel} htmlFor="api-provider">服务商</label>
      <select id="api-provider" style={inputStyle} value={cfg.apiType} onChange={e => patch({ apiType: e.target.value })}>
        <option value={types.OPENAI}>OpenAI 兼容</option>
        <option value={types.VERTEX}>Vertex AI</option>
      </select>
      {vertex ? (
        <>
          <label htmlFor="vertex-adc" style={fieldLabel}>导入 ADC JSON</label>
          <input id="vertex-adc" type="file" accept=".json,application/json" onChange={importFile} style={inputStyle} />
          {(status || hasCredential) && <div role="status">{status || "已导入 ADC 凭证"}</div>}
          <label htmlFor="vertex-project" style={fieldLabel}>项目 ID</label>
          <input id="vertex-project" style={inputStyle} value={cfg.vertexProject || ""} onChange={e => patch({ vertexProject: e.target.value })} />
          <label htmlFor="vertex-location" style={fieldLabel}>位置</label>
          <input id="vertex-location" style={inputStyle} value={cfg.vertexLocation ?? "global"} onChange={e => patch({ vertexLocation: e.target.value })} placeholder="global" />
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: 4 }}>
            每个浏览器只保存一份 ADC，导入新文件会替换旧的
            <br />
            凭证不会随配置、存档或报告导出。仅在信任的设备上使用。
          </div>
          <label htmlFor="vertex-model-preset" style={fieldLabel}>Vertex 预设模型</label>
          <select id="vertex-model-preset" style={inputStyle} value={preset} onChange={e => patch({ vertexModel: e.target.value })}>
            {!preset && <option value="" disabled hidden>自定义模型</option>}
            {VERTEX_MODELS.map(([id, note]) => <option key={id} value={id}>{note ? `${id}（${note}）` : id}</option>)}
          </select>
          <label htmlFor="api-model" style={fieldLabel}>模型名称</label>
          <input id="api-model" style={inputStyle} value={vertexModel} onChange={e => patch({ vertexModel: e.target.value })} placeholder={DEFAULT_VERTEX_MODEL} />
        </>
      ) : (
        <>
          <div style={labelStyle}>API 地址（Endpoint）</div>
          <input style={inputStyle} value={cfg.endpoint} onChange={e => patch({ endpoint: e.target.value })} placeholder="留空使用默认地址" />
          {cfg.apiType === types.OPENAI && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={!!cfg.openaiAutoComplete} onChange={e => patch({ openaiAutoComplete: e.target.checked })} style={{ cursor: "pointer" }} />
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  自动补全地址（补上 /v1/chat/completions）
                </span>
              </label>
              <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 3 }}>
                {cfg.openaiAutoComplete
                  ? "已开启：地址缺路径时自动补 /v1/chat/completions。填的是完整/非标准路径的家请关掉，否则可能补出 404。"
                  : "默认不补：填什么就原样发什么。多数中转站需要填完整地址（含 /chat/completions）。若你的家只给了 base 地址，可勾上让它自动补。"}
              </div>
            </>
          )}
          <div style={labelStyle}>API Key</div>
          <input style={inputStyle} type="password" value={cfg.apiKey} onChange={e => patch({ apiKey: e.target.value })} placeholder="sk-..." />
        </>
      )}
    </>
  );
}

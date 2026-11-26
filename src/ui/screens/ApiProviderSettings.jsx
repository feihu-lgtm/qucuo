import { useEffect, useState } from "react";
import { DEFAULT_VERTEX_MODEL } from "../../content/apiModel.js";
import { FieldLabel } from "../primitives/index.js";
import { Button } from "../primitives/index.js";

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

export function ApiSettingsGroup({ title, expanded, onToggle, children }) {
  return (
    <section>
      <Button variant="chrome" active={expanded} type="button" aria-expanded={expanded} onClick={onToggle} style={{ width: "100%", justifyContent: "flex-start", marginTop: 8 }}>
        {expanded ? "▾" : "▸"} {title}
      </Button>
      {expanded && <div style={{ paddingTop: 6 }}>{children}</div>}
    </section>
  );
}

export default function ApiProviderSettings({
  cfg, patch, providers, isDefaultEndpoint, migrateProvider, providerApiType,
  importCredential, hasCredential,
}) {
  const [status, setStatus] = useState("");
  const [endpointExpanded, setEndpointExpanded] = useState(false);
  const provider = providers[migrateProvider(cfg).provider] || providers.custom;
  const vertex = provider.protocol === "vertex";
  const vertexModel = cfg.vertexModel ?? DEFAULT_VERTEX_MODEL;
  const preset = VERTEX_MODELS.some(([id]) => id === vertexModel) ? vertexModel : "";

  useEffect(() => {
    if (provider.corsProxyRequired && !String(cfg.corsProxy || "").trim()) setEndpointExpanded(true);
  }, [cfg.provider]);

  function selectProvider(providerId) {
    const selected = providers[providerId];
    const endpoint = !cfg.endpoint || isDefaultEndpoint(cfg.endpoint) ? selected.endpoint : cfg.endpoint;
    patch({ provider: providerId, apiType: providerApiType(providerId), endpoint });
  }

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
      <label className="ui-field-label ui-field-label--block" htmlFor="api-provider">服务商</label>
      <select id="api-provider" className="ui-input" value={provider.id} onChange={e => selectProvider(e.target.value)}>
        {Object.values(providers).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {vertex ? (
        <>
          <label htmlFor="vertex-adc" className="ui-field-label ui-field-label--block">导入 ADC JSON</label>
          <input id="vertex-adc" type="file" accept=".json,application/json" onChange={importFile} className="ui-input" />
          {(status || hasCredential) && <div role="status">{status || "已导入 ADC 凭证"}</div>}
          <label htmlFor="vertex-project" className="ui-field-label ui-field-label--block">项目 ID</label>
          <input id="vertex-project" className="ui-input" value={cfg.vertexProject || ""} onChange={e => patch({ vertexProject: e.target.value })} />
          <label htmlFor="vertex-location" className="ui-field-label ui-field-label--block">位置</label>
          <input id="vertex-location" className="ui-input" value={cfg.vertexLocation ?? "global"} onChange={e => patch({ vertexLocation: e.target.value })} placeholder="global" />
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 4 }}>
            每个浏览器只保存一份 ADC，导入新文件会替换旧的
            <br />
            凭证不会随配置、存档或报告导出。仅在信任的设备上使用。
          </div>
          <label htmlFor="vertex-model-preset" className="ui-field-label ui-field-label--block">Vertex 预设模型</label>
          <select id="vertex-model-preset" className="ui-input" value={preset} onChange={e => patch({ vertexModel: e.target.value })}>
            {!preset && <option value="" disabled hidden>自定义模型</option>}
            {VERTEX_MODELS.map(([id, note]) => <option key={id} value={id}>{note ? `${id}（${note}）` : id}</option>)}
          </select>
          <label htmlFor="api-model" className="ui-field-label ui-field-label--block">模型名称</label>
          <input id="api-model" className="ui-input" value={vertexModel} onChange={e => patch({ vertexModel: e.target.value })} placeholder={DEFAULT_VERTEX_MODEL} />
        </>
      ) : (
        <>
          {provider.id === "custom" && (
            <>
              <label className="ui-field-label ui-field-label--block" htmlFor="api-endpoint">API 地址（Endpoint）</label>
              <input id="api-endpoint" className="ui-input" value={cfg.endpoint || ""} onChange={e => patch({ endpoint: e.target.value })} placeholder="留空使用默认地址" />
            </>
          )}
          <Button variant="chrome" active={endpointExpanded}
            type="button"
            aria-expanded={endpointExpanded}
            onClick={() => setEndpointExpanded(value => !value)} style={{ width: "100%", justifyContent: "flex-start", marginTop: 6 }}
          >{endpointExpanded ? "▾" : "▸"} 接口地址</Button>
          {endpointExpanded && (
            <div>
              {provider.id !== "custom" && (
                <>
                  <label className="ui-field-label ui-field-label--block" htmlFor="api-endpoint">API 地址（Endpoint）</label>
                  <input id="api-endpoint" className="ui-input" value={cfg.endpoint || ""} onChange={e => patch({ endpoint: e.target.value })} placeholder="留空使用默认地址" />
                </>
              )}
              {provider.altEndpoints.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                  {provider.altEndpoints.map(alt => (
                    <Button variant="chrome" active={cfg.endpoint === alt.url}
                      key={alt.url}
                      type="button"
                      onClick={() => patch({ endpoint: alt.url })}
                      aria-pressed={cfg.endpoint === alt.url} style={{ padding: "3px 8px", fontSize: "var(--fs-xs)" }}
                    >{alt.label}</Button>
                  ))}
                </div>
              )}
              {provider.id === "custom" && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={!!cfg.openaiAutoComplete} onChange={e => patch({ openaiAutoComplete: e.target.checked })} style={{ cursor: "pointer" }} />
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>
                  自动补全地址（补上 /v1/chat/completions）
                </span>
              </label>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 3 }}>
                {cfg.openaiAutoComplete
                  ? "已开启：地址缺路径时自动补 /v1/chat/completions。填的是完整/非标准路径的家请关掉，否则可能补出 404。"
                : "默认不补：填什么就原样发什么。多数中转站需要填完整地址（含 /chat/completions）。若你的家只给了 base 地址，可勾上让它自动补。"}
              </div>
            </>
              )}
              <label className="ui-field-label ui-field-label--block">CORS 代理地址（可选）</label>
              <input id="api-cors-proxy" className="ui-input" value={cfg.corsProxy || ""} onChange={e => patch({ corsProxy: e.target.value })} placeholder="例如 https://your-proxy.com/?url=" />
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 3 }}>
                如果目标 API 不支持浏览器直连（CORS 报错），可以填一个中转代理服务的地址前缀。
              </div>
            </div>
          )}
          <FieldLabel>API Key</FieldLabel>
          <input id="api-key" className="ui-input" type="password" value={cfg.apiKey || ""} onChange={e => patch({ apiKey: e.target.value })} placeholder="sk-..." />
          {provider.corsProxyRequired && !String(cfg.corsProxy || "").trim() && (
            <div role="status" style={{ color: "var(--accent)", fontSize: "var(--fs-xs)", marginTop: 5 }}>
              此厂商不允许浏览器直连，请在下方填 CORS 代理
            </div>
          )}
        </>
      )}
    </>
  );
}

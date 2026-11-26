import React from "react";
import {
  testConnection, listModels, hasApiCredentials, importVertexCredential, isDefaultEndpoint,
  migrateProvider, providerApiType, PROVIDERS,
} from "../../../infra/apiConfig.js";
import { classifyError } from "../../../utils/apiErrors.js";
import { getApiModel } from "../../../infra/apiModel.js";
import { clearMemories } from "../../../infra/memoryStore.js";
import ApiProviderSettings, { ApiSettingsGroup } from "../ApiProviderSettings.jsx";
import ModelPicker from "./ModelPicker.jsx";
import ApiLengthFields from "./ApiLengthFields.jsx";
import ApiGenerationFields from "./ApiGenerationFields.jsx";
import ApiProfilesFields from "./ApiProfilesFields.jsx";
import { Button, FieldLabel, Panel } from "../../primitives/index.js";

// API 配置 tab。状态由 SettingsPanel 壳持有（切 tab 卸载后回来不丢），
// 本组件只做渲染与事件处理。
export default function ApiTab({
  cfg, setCfg, patch, st,
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
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8 }}>
        选择服务商，并按其接口协议配置地址、密钥与模型。
      </div>

      <ApiProviderSettings cfg={cfg} patch={patch} providers={PROVIDERS}
        isDefaultEndpoint={isDefaultEndpoint} migrateProvider={migrateProvider} providerApiType={providerApiType}
        importCredential={importVertexCredential} hasCredential={isVertex && hasApiCredentials(cfg)} />

      {!isVertex && <><FieldLabel as="label" htmlFor="api-model" style={{ display: "block" }}>模型名称</FieldLabel>
      <div style={{ display: "flex", gap: 6 }}>
        <input id="api-model" list="provider-model-suggestions" className="ui-input" style={{ flex: 1 }} value={cfg.model} onChange={e => patch({ model: e.target.value })} placeholder="输入服务商要求的模型名称" />
        <datalist id="provider-model-suggestions">
          {(PROVIDERS[providerId]?.models || []).map(model => <option key={model} value={model} />)}
        </datalist>
        <Button variant="settings" style={{ whiteSpace: "nowrap", opacity: modelStatus === "loading" ? 0.5 : 1 }} onClick={modelStatus === "loading" ? undefined : () => handleDetectModels(null)}>
          {modelStatus === "loading" && modelPickerTarget === null ? "检测中…" : "自动检测"}
        </Button>
      </div></>}
      {!isVertex && (
        <ModelPicker target={null} modelPickerTarget={modelPickerTarget} modelStatus={modelStatus} modelErr={modelErr}
          modelList={modelList} apiType={cfg.apiType} current={cfg.model} onClose={() => setModelList(null)}
          onPick={m => { patch({ model: m }); setModelList(null); }} />
      )}
      {!isVertex && modelList && modelList.length === 0 && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--gold)", marginTop: 3 }}>接口未返回任何模型，请手动填写模型名称</div>
      )}

      <ApiSettingsGroup title="篇幅与超时" expanded={apiGroups.length}
        onToggle={() => setApiGroups(groups => ({ ...groups, length: !groups.length }))}>
        <ApiLengthFields cfg={cfg} patch={patch} />
      </ApiSettingsGroup>

      <ApiSettingsGroup title="生成参数" expanded={apiGroups.generation}
        onToggle={() => setApiGroups(groups => ({ ...groups, generation: !groups.generation }))}>
        <ApiGenerationFields cfg={cfg} patch={patch} isVertex={isVertex}
          onDetectModels={handleDetectModels} onClearMemory={handleClearMemory}
          modelStatus={modelStatus} modelPickerTarget={modelPickerTarget} modelErr={modelErr}
          modelList={modelList} setModelList={setModelList} memCount={memCount} />
      </ApiSettingsGroup>

      <ApiSettingsGroup title="配置管理" expanded={apiGroups.profiles}
        onToggle={() => setApiGroups(groups => ({ ...groups, profiles: !groups.profiles }))}>
        <ApiProfilesFields cfg={cfg} setCfg={setCfg} cfgProfiles={cfgProfiles} setCfgProfiles={setCfgProfiles}
          cfgProfileName={cfgProfileName} setCfgProfileName={setCfgProfileName} />
      </ApiSettingsGroup>

      <Panel variant="section" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="settings" onClick={handleTest}>连接测试</Button>
        {testStatus === "testing" && <span style={{ color: "var(--text-dim)" }}>测试中...</span>}
      </Panel>
      {testStatus && testStatus !== "testing" && (
        <div data-testid="api-test-result" role="status" style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: testStatus === "ok" ? "var(--good)" : "var(--accent)" }}>
          {testMsg}
        </div>
      )}
    </div>
  );
}

import React from "react";
import {
  listConfigProfiles, saveConfigProfile, loadConfigProfile, deleteConfigProfile,
  exportConfigProfiles, importConfigProfiles, migrateProvider,
} from "../../../infra/apiConfig.js";
import { getApiModel } from "../../../infra/apiModel.js";
import { inputStyle, sectionStyle, btnStyle } from "./styles.js";
import { downloadText, pickTextFile, ts } from "./fileIo.js";

// API 配置 ·「配置管理」组：多套配置的保存 / 切换 / 删除 / 导出导入。
export default function ApiProfilesFields({
  cfg, setCfg, cfgProfiles, setCfgProfiles, cfgProfileName, setCfgProfileName,
}) {
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

  return (
    <>
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
    </>
  );
}

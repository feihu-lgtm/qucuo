// PR-A：web 默认切双调用判官链——出厂默认 extractionEnabled:true；
// 老用户显式存过的 false 必须尊重（不迁移不改写）。
import { describe, expect, it, beforeEach, vi } from "vitest";
import { defaultConfig, loadConfig } from "./apiConfig.js";

const mem = {};
vi.stubGlobal("localStorage", {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
  clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
});

describe("PR-A 默认双调用判官链", () => {
  beforeEach(() => localStorage.clear());

  it("出厂默认 extractionEnabled+judgePipelineEnabled 双真", () => {
    const cfg = defaultConfig();
    expect(cfg.extractionEnabled).toBe(true);
    expect(cfg.judgePipelineEnabled).toBe(true);
  });

  it("无存档新用户走默认双调用", () => {
    expect(loadConfig().extractionEnabled).toBe(true);
  });

  it("老用户显式存过的 false 被尊重，不被翻案", () => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({ ...defaultConfig(), extractionEnabled: false }));
    expect(loadConfig().extractionEnabled).toBe(false);
  });

  it("老用户显式存过的 true 保持 true", () => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({ ...defaultConfig(), extractionEnabled: true }));
    expect(loadConfig().extractionEnabled).toBe(true);
  });
});

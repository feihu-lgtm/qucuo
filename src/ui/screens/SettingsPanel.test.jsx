import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingsPanel from "./SettingsPanel.jsx";
import { ZONE_THEMES } from "../../utils/theme.js";

const render = (cfg, initialTab, props = {}) => renderToStaticMarkup(createElement(SettingsPanel, {
  cfg, initialTab, font: "pixel", setFont: () => {}, zoneTheme: ZONE_THEMES.village, ...props,
}));

describe("SettingsPanel portrait management entry", () => {
  it.each([{}, { apiKey: "" }])("hides portrait management without a configured API key: %s", (cfg) => {
    const html = render(cfg);
    expect(html).not.toContain("立绘管理");
    expect(html).toContain("API 配置");
  });

  it("shows portrait management when the game overlays are available", () => {
    expect(render({ apiKey: "test-placeholder" })).toContain("立绘管理");
  });
});

describe("SettingsPanel provider models", () => {
  it("displays only the active provider's saved model", () => {
    const cfg = { model: "openai-model", vertexModel: "google/vertex-model" };
    expect(render({ ...cfg, apiType: "vertex" }, "api")).toContain('value="google/vertex-model"');
    expect(render({ ...cfg, apiType: "openai" }, "api")).toContain('value="openai-model"');
    const vertexHtml = render({ apiType: "vertex", model: cfg.model }, "api");
    expect(vertexHtml).toContain('value="google/gemini-3.8-flash" selected=""');
    expect(vertexHtml).toContain('placeholder="google/gemini-3.8-flash"');
    expect(vertexHtml).toContain("每个浏览器只保存一份 ADC，导入新文件会替换旧的");
  });

  it("offers Vertex presets in order and labels Hydrogen quota requirements", () => {
    const html = render({ apiType: "vertex" }, "api");
    const options = html.match(/<select id="vertex-model-preset"[^>]*>(.*?)<\/select>/)?.[1] ?? "";
    expect([...options.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(([, id]) => id)).toEqual([
      "google/gemini-3.8-flash", "google/gemini-3.7-flash", "google/gemini-3.6-flash",
      "google/gemini-3.5-flash", "google/gemini-3-flash-preview", "google/gemini-3.1-pro-preview",
      "google/gemini-3.5-flash-lite", "google/gemini-3.1-flash-lite", "google/gemini-4-hydrogen",
    ]);
    expect(options).toContain(">google/gemini-4-hydrogen（需开通 Gemini 4 额度）</option>");
    expect(render({ apiType: "openai" }, "api")).not.toContain('id="vertex-model-preset"');
  });

  it("keeps core API fields visible and collapses secondary settings by default", () => {
    const html = render({ provider: "deepseek", apiType: "openai", apiKey: "test-key", model: "deepseek-chat" }, "api");
    expect(html).toContain('id="api-provider"');
    expect(html).toContain('id="api-key"');
    expect(html).toContain('id="api-model"');
    expect(html).not.toContain('id="api-temperature"');
    expect(html).toContain("生成参数");
    expect(html).toContain("篇幅与超时");
    expect(html).toContain("配置管理");
  });
});

describe("SettingsPanel font preference", () => {
  it("offers Fusion Pixel and Songti choices with the default selected", () => {
    const html = render({ apiKey: "test-placeholder" }, "other");
    expect(html).toContain("缝合像素");
    expect(html).toContain("宋体");
    expect(html).toContain('aria-pressed="true"');
  });
});

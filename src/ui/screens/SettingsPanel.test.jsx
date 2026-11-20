import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingsPanel from "./SettingsPanel.jsx";

const render = (cfg, initialTab) => renderToStaticMarkup(createElement(SettingsPanel, { cfg, initialTab }));

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
    expect(vertexHtml).toContain('value="google/gemini-3.5-flash"');
    expect(vertexHtml).toContain('placeholder="google/gemini-3.5-flash"');
    expect(vertexHtml).toContain("每个浏览器只保存一份 ADC，导入新文件会替换旧的");
  });
});

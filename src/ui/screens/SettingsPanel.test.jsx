import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import SettingsPanel from "./SettingsPanel.jsx";
import { THEME_VARS } from "../../utils/theme.js";
import { resetPromptOverrides, setPromptOverride } from "../../domain/rules/prompt/registry.js";

afterEach(() => {
  resetPromptOverrides();
});

const render = (cfg, initialTab, props = {}) => renderToStaticMarkup(createElement(SettingsPanel, {
  cfg, initialTab, font: "pixel", setFont: () => {}, ...props,
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

describe("SettingsPanel unified prompt control center", () => {
  it("renders unified control tab with all call groups, 6 block dimensions, and review rules", () => {
    const html = render({ apiKey: "test-placeholder", narratorLorebook: "旁白专属秘闻" }, "preset");
    expect(html).toContain("统一总控台");
    expect(html).toContain("主回合行动");
    expect(html).toContain("旁白私聊");
    expect(html).toContain("同步抽取与识别");
    expect(html).toContain("异步后台任务");
    expect(html).toContain("审阅与校验规则");
    expect(html).toContain("当前局势（此地情况/武力值/装备/武学/行囊）");
    const reunionRow = html.split("久别重逢上下文")[1]?.split("</div>")[0] || "";
    expect(reunionRow).toContain("绿灯");
    expect(reunionRow).toContain("关闭");
    expect(reunionRow).not.toContain("蓝灯");
  });

  it("NarratorTab edits cfg.narratorLorebook only and ignores any legacy narrator_lore override text", () => {
    setPromptOverride("narrator_lore", { text: "旧控制台写入的秘密" });
    const html = render({ apiKey: "test-placeholder", narratorLorebook: "设置页里的世界书" }, "narrator");
    expect(html).toContain("设置页里的世界书");
    expect(html).not.toContain("旧控制台写入的秘密");
  });
});

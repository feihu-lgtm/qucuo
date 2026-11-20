import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettingsPanel from "./SettingsPanel.jsx";

const render = (cfg) => renderToStaticMarkup(createElement(SettingsPanel, { cfg }));

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

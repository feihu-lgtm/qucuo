import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ModalShell from "./ModalShell.jsx";

const render = (props, child = "正文") => renderToStaticMarkup(createElement(ModalShell, props, child));

describe("ModalShell", () => {
  it("渲染为带标题的模态对话框，标题与 aria-labelledby 对上", () => {
    const html = render({ title: "⚙ 游戏设置", onClose: () => {} });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain("⚙ 游戏设置");
    expect(html).toContain("正文");
  });

  it("手机形态：默认全屏，sheet 用动作面板类，none 不挂手机类，未知值回落全屏", () => {
    const on = render({ title: "x" });
    expect(on).toContain("mobile-overlay-root");
    expect(on).toContain("mobile-overlay-panel");
    expect(on).toContain("mobile-overlay-header");
    expect(on).toContain("mobile-overlay-close");
    const sheet = render({ title: "x", mobile: "sheet" });
    expect(sheet).toContain("mobile-overlay-root");
    expect(sheet).toContain("ui-modal-panel mobile-action-panel");
    expect(sheet).not.toContain("mobile-overlay-panel");
    const off = render({ title: "x", mobile: "none" });
    expect(off).not.toContain("mobile-overlay-root");
    expect(off).not.toContain("mobile-overlay-panel");
    expect(off).not.toContain("mobile-overlay-header");
    expect(off).not.toContain("mobile-overlay-close");
    expect(render({ mobile: "weird" })).toContain("mobile-overlay-panel");
    const custom = render({ title: "x", mobile: "custom", panelClassName: "body-profile-panel" });
    expect(custom).toContain("ui-modal-root mobile-overlay-root");
    expect(custom).toContain('class="ui-modal-panel body-profile-panel"');
    expect(custom).toContain("mobile-overlay-header");
  });

  it("遮罩深浅与面板去壳通过 data 属性选择", () => {
    expect(render({})).toContain('data-backdrop="ink"');
    expect(render({ backdrop: "soft" })).toContain('data-backdrop="soft"');
    expect(render({})).not.toContain("data-chrome");
    expect(render({ chrome: false })).toContain('data-chrome="none"');
  });

  it("层级通过 data-layer 选档，未知档位回落到 dialog", () => {
    expect(render({ layer: "screen-high" })).toContain('data-layer="screen-high"');
    expect(render({ layer: "nope" })).toContain('data-layer="dialog"');
    expect(render({})).toContain('data-layer="dialog"');
  });

  it("关闭按钮是真按钮并带可读名字；showClose=false 时不渲染", () => {
    const html = render({ title: "x", closeLabel: "关闭上报窗口" });
    expect(html).toContain('<button type="button" class="ui-modal-close mobile-overlay-close" aria-label="关闭上报窗口">× 关闭</button>');
    expect(render({ title: "x", closeText: "✕" })).toContain(">✕</button>");
    expect(render({ title: "x", showClose: false })).not.toContain("ui-modal-close");
  });

  it("没有标题时用 aria-label 命名，且外壳本身不写内联定位", () => {
    const html = render({ ariaLabel: "物品菜单", showClose: false });
    expect(html).toContain('aria-label="物品菜单"');
    expect(html).not.toContain("aria-labelledby");
    expect(html).not.toContain("ui-modal-header");
    expect(html).not.toContain("position:fixed");
  });

  it("默认全屏形态下根节点同时带 mobile-overlay-root 与调用方的类（设置面板的 iOS 适配依赖这一点）", () => {
    const html = render({ title: "⚙ 游戏设置", className: "settings-root", panelClassName: "mobile-settings-panel settings-panel" });
    expect(html).toContain('class="ui-modal-root mobile-overlay-root settings-root"');
    expect(html).toContain('class="ui-modal-panel mobile-overlay-panel mobile-settings-panel settings-panel"');
  });

  it("panelStyle 与 className 透传给面板和根节点", () => {
    const html = render({ panelStyle: { width: 440 }, className: "settings-root", panelClassName: "settings-panel" });
    expect(html).toContain("width:440px");
    expect(html).toContain("ui-modal-root mobile-overlay-root settings-root");
    expect(html).toContain("ui-modal-panel mobile-overlay-panel settings-panel");
  });
});

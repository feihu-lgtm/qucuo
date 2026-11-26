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

  it("默认挂移动端全屏类，可以关掉", () => {
    const on = render({ title: "x" });
    expect(on).toContain("mobile-overlay-root");
    expect(on).toContain("mobile-overlay-panel");
    expect(on).toContain("mobile-overlay-header");
    expect(on).toContain("mobile-overlay-close");
    const off = render({ title: "x", mobileFullscreen: false });
    expect(off).not.toContain("mobile-overlay-root");
    expect(off).not.toContain("mobile-overlay-panel");
  });

  it("层级通过 data-layer 选档，未知档位回落到 dialog", () => {
    expect(render({ layer: "screen-high" })).toContain('data-layer="screen-high"');
    expect(render({ layer: "nope" })).toContain('data-layer="dialog"');
    expect(render({})).toContain('data-layer="dialog"');
  });

  it("关闭按钮是真按钮并带可读名字；showClose=false 时不渲染", () => {
    const html = render({ title: "x", closeLabel: "关闭上报窗口" });
    expect(html).toContain('<button type="button" class="ui-modal-close mobile-overlay-close" aria-label="关闭上报窗口">✕</button>');
    expect(render({ title: "x", showClose: false })).not.toContain("ui-modal-close");
  });

  it("没有标题时用 aria-label 命名，且外壳本身不写内联定位", () => {
    const html = render({ ariaLabel: "物品菜单", showClose: false });
    expect(html).toContain('aria-label="物品菜单"');
    expect(html).not.toContain("aria-labelledby");
    expect(html).not.toContain("ui-modal-header");
    expect(html).not.toContain("position:fixed");
  });

  it("panelStyle 与 className 透传给面板和根节点", () => {
    const html = render({ panelStyle: { width: 440 }, className: "settings-root", panelClassName: "settings-panel" });
    expect(html).toContain("width:440px");
    expect(html).toContain("ui-modal-root mobile-overlay-root settings-root");
    expect(html).toContain("ui-modal-panel mobile-overlay-panel settings-panel");
  });
});

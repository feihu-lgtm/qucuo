import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { isTopModal, modalStackSnapshot, popModal, pushModal, resetModalStack } from "./modalStack.js";

describe("U1-2 Review 修：卡片导入器参与弹窗栈键盘仲裁", () => {
  beforeEach(() => resetModalStack());

  it("导入器压栈后底层 ModalShell 不再栈顶——Esc/Tab 不再被隐藏弹窗劫持", () => {
    pushModal("modal-codex");           // 图鉴 ModalShell 先挂
    expect(isTopModal("modal-codex")).toBe(true);
    pushModal("modal-card-import");     // 导入器后开遮在上面
    expect(isTopModal("modal-codex")).toBe(false);  // 底层不再收 Esc/Tab
    expect(isTopModal("modal-card-import")).toBe(true);
    popModal("modal-card-import");      // 导入器关闭后图鉴回栈顶
    expect(isTopModal("modal-codex")).toBe(true);
    expect(modalStackSnapshot()).toEqual(["modal-codex"]);
  });

  it("CardImportScreen 接线钉死：压栈/判顶/出栈/Esc 四件套齐全", () => {
    const src = readFileSync("src/ui/screens/CardImportScreen.jsx", "utf8");
    expect(src).toContain("pushModal(stackId)");
    expect(src).toContain("isTopModal(stackId)");
    expect(src).toContain("popModal(stackId)");
    expect(src).toContain('"Escape"');
  });

  it("tokens.css：debug dock 层级在 screen-high 之下", () => {
    const css = readFileSync("src/ui/tokens.css", "utf8");
    // 两个同名块（动画定义+定位定义）——取带 z-index 的定位块
    const blocks = css.match(/\.debug-panel-dock\s*\{[^}]*z-index[^}]*\}/gs) || [];
    const dockBlock = blocks[0] || "";
    expect(dockBlock).toContain("z-index: var(--z-screen)");
    expect(dockBlock).not.toContain("z-index: var(--z-screen-high)");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LogEntry from "./LogEntry.jsx";

const render = (entry, props = {}) => renderToStaticMarkup(createElement(LogEntry, { entry, color: "var(--log-err)", onAction: () => {}, ...props }));

describe("主栏报错一句话", () => {
  it("接口故障只显示一句话与次数，给卷宗与接口设置入口", () => {
    const html = render(
      { t: "err", kind: "quota", count: 4, retryable: false, text: "  天机不畅（接口额度已尽），本轮未计入。" },
      { onOpenJournal: () => {}, onOpenSettings: () => {} },
    );
    expect(html).toContain("log-turn-error");
    expect(html).toContain("天机不畅（接口额度已尽），本轮未计入。");
    expect(html).toContain("×4");
    expect(html).toContain("接口设置");
    expect(html).toContain("看卷宗");
  });

  it("可重试的故障不给接口设置入口，只有一次时不标次数", () => {
    const html = render({ t: "err", kind: "timeout", count: 1, retryable: true, text: "  天机暂阻（接口超时），本轮未计入。" }, { onOpenJournal: () => {}, onOpenSettings: () => {} });
    expect(html).not.toContain("接口设置");
    expect(html).not.toContain("×");
  });
});

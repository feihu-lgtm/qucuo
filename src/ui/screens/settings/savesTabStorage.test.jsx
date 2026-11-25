import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageDriverSection } from "./SavesTab.jsx";
import { saveStorageConfig, _resetCloudStateForTest } from "../../../infra/storageDriver.js";

// 仓库 UI 测试口径：renderToStaticMarkup 静态渲染断言（无 testing-library 依赖）。
describe("SavesTab 存储驱动 UI 最小测试", () => {
  beforeEach(() => {
    const data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
    });
    _resetCloudStateForTest();
  });

  it("默认 local 档：三档按钮齐全、无云端控件", () => {
    const html = renderToStaticMarkup(createElement(StorageDriverSection));
    expect(html).toContain("storage-driver-section");
    expect(html).toContain("driver-local");
    expect(html).toContain("driver-cloud");
    expect(html).toContain("driver-file");
    expect(html).not.toContain("wipe-cloud");
  });

  it("cloud 档：地址输入/绑定状态/抹除按钮出现，文案含二次确认前置说明", () => {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://x", deviceId: "d1", boundAt: 1 });
    const html = renderToStaticMarkup(createElement(StorageDriverSection));
    expect(html).toContain("wipe-cloud");
    expect(html).toContain("已绑定");
    expect(html).toContain("一键彻底抹除云端全部存档与记忆");
  });

  it("云冲突：双裁决入口展示，文案明示系统不自动覆盖", () => {
    saveStorageConfig({ driver: "cloud", cloudUrl: "https://x", deviceId: "d1", boundAt: 1 });
    localStorage.setItem("wuxia_mud_cloud_conflicts", JSON.stringify([{ key: "autosave", rev: 3, op: "put", value: {}, detectedAt: 1 }]));
    const html = renderToStaticMarkup(createElement(StorageDriverSection));
    expect(html).toContain("cloud-conflicts");
    expect(html).toContain("用本地覆盖云端");
    expect(html).toContain("放弃本次推送");
    expect(html).toContain("不会自动覆盖");
  });
});

# 浏览器 QA

在仓库根目录运行 `npm run e2e`，会启动固定端口的 Vite、加载种子存档并运行 Chromium 规格；也可用 `QA_PORT` 改端口。单独调试服务运行 `npm run dev:qa`。

规格默认导出 `async ({ page, ai, game }) => {}`。`game.loadSave(page, "village")` 加载存档，`game.act/state/waitFor` 用于操作与断言。AI 可用 `ai.hold()` 暂停下一次主叙事请求，再调用 `release(resp?)` 或 `fail(err?)`；地图预跑可独立用 `ai.hold({ kind: "prerun" })`。也可用 `ai.next(resp)` 指定下一条回复，或 `ai.setDefault(fn)` 设置默认回复。

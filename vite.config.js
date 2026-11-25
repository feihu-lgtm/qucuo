import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // GitHub Pages 部署在 https://<user>.github.io/qucuo/ 子路径下，构建时需把资源引用
  // 前缀改成 /qucuo/，否则页面白屏。本地开发（dev）保持根路径 "/"。
  // 通过环境变量 DEPLOY_BASE 控制：构建 Pages 版时 DEPLOY_BASE=/qucuo/ npm run build。
  base: process.env.DEPLOY_BASE || "/",
  plugins: [
    react(),
    {
      name: "cors-proxy",
      configureServer(server) {
        server.middlewares.use("/api/proxy", async (req, res) => {
          const urlParam = new URL(req.url, "http://localhost").searchParams.get("url");
          if (!urlParam) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Missing ?url= parameter");
            return;
          }

          const target = decodeURIComponent(urlParam);
          let body = "";
          if (req.method === "POST") {
            body = await new Promise((resolve) => {
              let data = "";
              req.on("data", (chunk) => { data += chunk; });
              req.on("end", () => resolve(data));
            });
          }

          const fwdHeaders = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (k === "host") { fwdHeaders.host = new URL(target).host; continue; }
            if (["content-type", "authorization", "x-api-key", "anthropic-version", "accept", "content-length"].includes(k)) {
              fwdHeaders[k] = Array.isArray(v) ? v[0] : v;
            }
          }

          // 下游（浏览器）中途断开时中止上游 provider 请求：否则浏览器端 idle 超时/
          // 取消后，proxy 里的上游 fetch 仍挂着等 provider，重试会叠出同一回合的重复模型请求。
          // res 的 close 在正常完成后也会触发，所以用 writableFinished 区分——
          // 正常 SSE 收尾不误 abort。
          const upstreamCtrl = new AbortController();
          const onDownstreamClose = () => { if (!res.writableFinished) upstreamCtrl.abort(); };
          res.on?.("close", onDownstreamClose);
          try {
            const fetchRes = await fetch(target, {
              method: req.method,
              headers: { ...fwdHeaders, "accept-encoding": "identity" },
              body: body || undefined,
              signal: upstreamCtrl.signal,
            });
            const resHeaders = {};
            for (const [k, v] of fetchRes.headers) {
              // undici 透明解压后 content-encoding 头与实际字节不符，且流式转发不能保留
              // transfer-encoding: chunked（逐块 write 时 node 会自行分块）
              if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) {
                resHeaders[k] = v;
              }
            }
            resHeaders["access-control-allow-origin"] = "*";
            resHeaders["access-control-allow-headers"] = "*";
            resHeaders["access-control-allow-methods"] = "*";
            res.writeHead(fetchRes.status, resHeaders);
            // 逐块转发而非 await .text() 整包缓冲——SSE 流式（OpenAI/Anthropic/Gemini）
            // 依赖增量到达，整包读取会让玩家在等待期间看不到任何字。
            if (fetchRes.body) {
              for await (const chunk of fetchRes.body) res.write(chunk);
            }
            res.end();
          } catch (e) {
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/plain" });
              res.end("Proxy error: " + e.message);
            } else {
              // 流式转发途中上游断流：headers 早已发出，再 writeHead 会抛
              // ERR_HTTP_HEADERS_SENT 打崩 dev server。直接销毁响应，让浏览器
              // 读到连接中断（fetch 抛 network error），而不是干净结束半截正文。
              res.destroy(e);
            }
          } finally {
            res.off?.("close", onDownstreamClose);
          }
        });
      },
    },
  ],
  // 端口从 5171 起。不设 strictPort（默认 false）：若 5171 被占，Vite 会自动
  // 顺延到 5172、5173…… 直到找到空闲端口。配合启动脚本里的 `vite --open`，
  // Vite 会用它最终选定的那个端口去开浏览器，不会再出现"浏览器写死找 5171
  // 却打不开"的问题。
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5171 },
  test: { exclude: [...configDefaults.exclude, "e2e/**", "server/**"] },
  // 多页入口：游戏主页 index.html + 调试台 debug.html。
  // dev 下 Vite 自动伺服根目录任意 .html（直接开 /debug.html 即可），
  // 这里加 input 是为了让 vite build 也把 debug.html 一并打包出来。
  build: {
    rolldownOptions: {
      input: {
        main: r("./index.html"),
        debug: r("./debug.html"),
        debugGamble: r("./debug-gamble.html"),
        debugItem: r("./debug-item.html"),
      },
      output: {
        advancedChunks: {
          groups: [
            { name: "vendor", test: /node_modules/ },
            { name: "content-quest", test: /src[\\/]content[\\/]quest[\\/]/ },
            { name: "content-misc", test: /src[\\/]content[\\/]/ },
            { name: "domain-data", test: /src[\\/]domain[\\/]data[\\/]/ },
            { name: "engine-act", test: /src[\\/]engine[\\/]act[\\/]/ },
            { name: "engine-core", test: /src[\\/]engine[\\/]/ },
            { name: "domain-combat", test: /src[\\/]domain[\\/]rules[\\/]combat[\\/]/ },
            { name: "domain-rules", test: /src[\\/]domain[\\/]/ },
            { name: "features", test: /src[\\/]features[\\/]/ },
            { name: "infra", test: /src[\\/]infra[\\/]/ },
            { name: "app", test: /src[\\/]app[\\/]/ },
          ],
        },
      },
    },
  },
});

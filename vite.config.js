import { defineConfig } from "vite";
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

          try {
            const fetchRes = await fetch(target, {
              method: req.method,
              headers: fwdHeaders,
              body: body || undefined,
            });
            const resBody = await fetchRes.text();
            const resHeaders = {};
            for (const [k, v] of fetchRes.headers) {
              if (!["content-encoding", "transfer-encoding"].includes(k)) {
                resHeaders[k] = v;
              }
            }
            resHeaders["access-control-allow-origin"] = "*";
            resHeaders["access-control-allow-headers"] = "*";
            resHeaders["access-control-allow-methods"] = "*";
            res.writeHead(fetchRes.status, resHeaders);
            res.end(resBody);
          } catch (e) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Proxy error: " + e.message);
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
  // 多页入口：游戏主页 index.html + 调试台 debug.html。
  // dev 下 Vite 自动伺服根目录任意 .html（直接开 /debug.html 即可），
  // 这里加 input 是为了让 vite build 也把 debug.html 一并打包出来。
  build: {
    rollupOptions: {
      input: {
        main: r("./index.html"),
        debug: r("./debug.html"),
        debugGamble: r("./debug-gamble.html"),
        debugItem: r("./debug-item.html"),
      },
    },
  },
});

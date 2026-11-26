// A4 采样留底代理：转发游戏 AI 调用到上游端点，注入真实口令（绝不落盘），
// 按 x-qucuo-lane/x-qucuo-turn/x-qucuo-trace 请求头归属（不再按时间窗/文本推断），
// 每个请求/响应全量记 JSONL（脱敏：不含任何 auth 头，x-qucuo-* 头留在记录里）。
//
// 用法：
//   echo 'KEY=xxx' > ~/.sampling/keyline   # 或 SAMPLING_KEYLINE 指定路径
//   node scripts/sampling/proxy.mjs
// 环境变量：
//   SAMPLING_PROXY_PORT  默认 5411
//   SAMPLING_PROXY_LOG   默认 ~/.sampling/artifacts/ai_calls.jsonl
//   SAMPLING_UPSTREAM    默认 https://argonmeow.online/api/qucuo/v1/chat/completions
//                        （verifyCors 自检时指到本地 stub）
import http from "node:http";
import { readFileSync, createWriteStream, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const KEYLINE_PATH = process.env.SAMPLING_KEYLINE || `${process.env.HOME}/.sampling/keyline`;
const KEYLINE = readFileSync(KEYLINE_PATH, "utf8").trim();
const KEY = KEYLINE.includes("=") ? KEYLINE.split("=").slice(1).join("=") : KEYLINE;
if (!KEY) { console.error("口令为空"); process.exit(1); }
const UPSTREAM = process.env.SAMPLING_UPSTREAM || "https://argonmeow.online/api/qucuo/v1/chat/completions";
const PORT = Number(process.env.SAMPLING_PROXY_PORT) || 5411;
const LOG = process.env.SAMPLING_PROXY_LOG || `${process.env.HOME}/.sampling/artifacts/ai_calls.jsonl`;
mkdirSync(dirname(LOG), { recursive: true });
const stream = createWriteStream(LOG, { flags: "a" });
// 入站令牌：首次启动生成随机令牌写 ~/.sampling/proxy.token（0600），
// collect.mjs 读同一文件配进游戏 apiKey——本机其他进程无令牌不能蹭配额/污染留底。
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync } from "node:fs";
const TOKEN_PATH = `${process.env.HOME}/.sampling/proxy.token`;
if (!existsSync(TOKEN_PATH)) {
  writeFileSync(TOKEN_PATH, randomBytes(24).toString("hex"), { mode: 0o600 });
  chmodSync(TOKEN_PATH, 0o600);
}
const INBOUND_TOKEN = readFileSync(TOKEN_PATH, "utf8").trim();
let seq = 0;

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    // 浏览器自定义头触发 CORS 预检——预检到的是本代理，必须显式放行三个归属头。
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-qucuo-lane, x-qucuo-turn, x-qucuo-trace",
      "access-control-max-age": "86400",
    });
    res.end();
    return;
  }
  if (req.method !== "POST") { res.writeHead(404); res.end(); return; }
  if (req.headers.authorization !== `Bearer ${INBOUND_TOKEN}`) {
    res.writeHead(403, { "access-control-allow-origin": "*", "content-type": "application/json" });
    res.end(JSON.stringify({ error: "sampling_proxy_auth_required" }));
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const id = ++seq;
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* keep null */ }
    // 归属头：采下来留底，不转发上游（上游是中转/官方端点，自定义头无意义且可能触发额外校验）。
    const rec = {
      id, startedAt, model: parsed?.model || null, stream: !!parsed?.stream,
      lane: req.headers["x-qucuo-lane"] ?? null,
      turn: req.headers["x-qucuo-turn"] ?? null,
      trace: req.headers["x-qucuo-trace"] ?? null,
      request: parsed, upstream: UPSTREAM.replace(/^https?:\/\//, ""),
    };
    try {
      const upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body,
      });
      rec.status = upstream.status;
      const ct = upstream.headers.get("content-type") || "";
      if (ct.includes("text/event-stream")) {
        res.writeHead(upstream.status, {
          "content-type": ct,
          "access-control-allow-origin": "*",
          "cache-control": "no-cache",
        });
        const reader = upstream.body.getReader();
        const bufs = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bufs.push(Buffer.from(value));
          res.write(Buffer.from(value));
        }
        res.end();
        rec.sseRaw = Buffer.concat(bufs).toString("utf8");
        // SSE 末包常带 usage（stream_options.include_usage）
        for (const line of rec.sseRaw.split("\n")) {
          if (!line.startsWith("data:") || line.includes("[DONE]")) continue;
          try {
            const d = JSON.parse(line.slice(5).trim());
            if (d?.usage) rec.usage = d.usage;
          } catch { /* 忽略半行 */ }
        }
      } else {
        const text = await upstream.text();
        res.writeHead(upstream.status, { "content-type": ct || "application/json", "access-control-allow-origin": "*" });
        res.end(text);
        try { rec.response = JSON.parse(text); } catch { rec.responseRaw = text.slice(0, 4000); }
        rec.usage = rec.response?.usage || null;
      }
    } catch (err) {
      rec.error = String(err?.message || err);
      // 响应可能已部分透传（SSE 中途上游断）——已发头/已结束的响应不能再写 502
      if (!res.headersSent) {
        res.writeHead(502, { "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ error: "proxy_upstream_error" }));
      } else if (!res.writableEnded) res.end();
    }
    rec.ms = Date.now() - t0;
    rec.finishedAt = new Date().toISOString();
    stream.write(JSON.stringify(rec) + "\n");
  });
});
server.listen(PORT, "127.0.0.1", () => {
  writeFileSync(`${process.env.HOME}/.sampling/proxy.ready`, String(PORT));
  console.log(`sampling proxy on ${PORT} → ${UPSTREAM}`);
});

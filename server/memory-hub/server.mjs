import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createHubStore, assertNoApiKeyPayload } from "./hubCore.mjs";

// node:http 入站 header 名已全部小写化（RFC 层面大小写不敏感），无需另行 canonicalize。
// authorization 也在拒收列：hub 专用凭证走 x-memory-hub-token，收到 authorization/x-api-key
// 即说明客户端在误传模型/其它凭证。
const FORBIDDEN_KEY_HEADERS = ["x-api-key", "x-goog-api-key", "x-openai-key", "authorization"];
const HUB_TOKEN_HEADER = "x-memory-hub-token";

function tokenValid(presented, expected) {
  if (!presented || !expected) return false;
  const a = Buffer.from(String(presented));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readJsonBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        const err = new Error("Payload too large");
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) { resolve({}); return; }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const err = new Error("Invalid JSON body");
        err.status = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function assertNoKeyHeaders(req) {
  for (const h of FORBIDDEN_KEY_HEADERS) {
    if (req.headers[h]) {
      const err = new Error("server/memory-hub 不接收也不中转任何模型 API Key");
      err.status = 400;
      throw err;
    }
  }
}

export function createHubServer({
  dbPath = process.env.MEMORY_HUB_DB || "./memory-hub.sqlite",
  token = process.env.MEMORY_HUB_TOKEN || "",
} = {}) {
  // 鉴权是硬要求（阿里云后端不能无认证公开读写删）：hub 专用 x-memory-hub-token，
  // 绝不复用/接受模型 key。MEMORY_HUB_TOKEN 缺失时拒绝启动；唯一例外是显式
  // ALLOW_INSECURE_LOCAL_ONLY=1 的本机开发（必须自行确保只 bind loopback）。
  if (!token) {
    if (process.env.ALLOW_INSECURE_LOCAL_ONLY === "1") {
      console.warn("[memory-hub] ⚠ 无 token 运行（ALLOW_INSECURE_LOCAL_ONLY=1）——仅限本机 loopback 开发，生产部署必须设 MEMORY_HUB_TOKEN");
    } else {
      throw new Error("MEMORY_HUB_TOKEN 缺失，拒绝启动（生产必须配置；本机开发可显式 ALLOW_INSECURE_LOCAL_ONLY=1 并仅 bind loopback）");
    }
  }
  const store = createHubStore(dbPath);

  const server = createServer(async (req, res) => {
    try {
      assertNoKeyHeaders(req);
      const url = new URL(req.url || "/", "http://localhost");
      const path = url.pathname;
      const method = req.method || "GET";

      if (method === "GET" && path === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      // /api/* 全部要 token——/health 是唯一公开端点
      if (token && path.startsWith("/api/") && !tokenValid(req.headers[HUB_TOKEN_HEADER], token)) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }

      const saveMatch = path.match(/^\/api\/spaces\/([^/]+)\/saves\/([^/]+)$/);
      if (saveMatch) {
        const spaceId = decodeURIComponent(saveMatch[1]);
        const slotId = decodeURIComponent(saveMatch[2]);
        if (method === "GET") {
          const save = store.getSave(spaceId, slotId);
          sendJson(res, save ? 200 : 404, save || { error: "not_found" });
          return;
        }
        if (method === "PUT") {
          const body = await readJsonBody(req);
          assertNoApiKeyPayload(body);
          const result = store.putSave(spaceId, slotId, body);
          sendJson(res, result.status, result);
          return;
        }
        if (method === "DELETE") {
          // 单槽删除：force=1（query 或 body）跳过 rev 检查——唯一合法触发源
          // 是玩家在客户端显式裁决「确认删除/本地覆盖云端」，自动流程绝不许带。
          let body = {};
          try { body = await readJsonBody(req); } catch { body = {}; }
          const force = url.searchParams.get("force") === "1" || body?.force === true;
          const expectedRev = Number.isInteger(body?.expectedRev)
            ? body.expectedRev
            : (url.searchParams.has("expectedRev") ? Number(url.searchParams.get("expectedRev")) : null);
          const result = store.deleteSave(spaceId, slotId, { expectedRev, force });
          sendJson(res, result.status, result);
          return;
        }
      }

      const listMatch = path.match(/^\/api\/spaces\/([^/]+)\/saves$/);
      if (listMatch && method === "GET") {
        const spaceId = decodeURIComponent(listMatch[1]);
        sendJson(res, 200, { spaceId, saves: store.listSaves(spaceId) });
        return;
      }

      const proseAppendMatch = path.match(/^\/api\/spaces\/([^/]+)\/prose$/);
      if (proseAppendMatch && method === "POST") {
        const spaceId = decodeURIComponent(proseAppendMatch[1]);
        const body = await readJsonBody(req);
        assertNoApiKeyPayload(body);
        const result = store.appendProseChunks(spaceId, body.batchId, body.chunks);
        sendJson(res, 200, result);
        return;
      }

      const proseQueryMatch = path.match(/^\/api\/spaces\/([^/]+)\/prose\/query$/);
      if (proseQueryMatch && method === "POST") {
        const spaceId = decodeURIComponent(proseQueryMatch[1]);
        const body = await readJsonBody(req);
        assertNoApiKeyPayload(body);
        const result = store.queryProseChunks(spaceId, body);
        sendJson(res, 200, result);
        return;
      }

      const deleteMatch = path.match(/^\/api\/spaces?\/([^/]+)$/);
      if (deleteMatch && method === "DELETE") {
        const spaceId = decodeURIComponent(deleteMatch[1]);
        const result = store.deleteSpace(spaceId);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (err) {
      sendJson(res, err?.status || 500, { error: err?.message || "internal_error" });
    }
  });

  server.on("close", () => store.close());
  return { server, store };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  // 默认只 bind loopback——生产暴露公网必须显式 HOST=0.0.0.0 且配 MEMORY_HUB_TOKEN。
  const host = process.env.HOST || "127.0.0.1";
  const { server } = createHubServer();
  server.listen(port, host, () => {
    console.log(`qucuo memory-hub listening on http://${host}:${port}`);
  });
}

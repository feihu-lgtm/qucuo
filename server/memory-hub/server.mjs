import { createServer } from "node:http";
import { createHubStore, assertNoApiKeyPayload } from "./hubCore.mjs";

const FORBIDDEN_KEY_HEADERS = ["x-api-key", "x-goog-api-key", "x-openai-key"];

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

export function createHubServer({ dbPath = process.env.MEMORY_HUB_DB || "./memory-hub.sqlite" } = {}) {
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
  const { server } = createHubServer();
  server.listen(port, () => {
    console.log(`qucuo memory-hub listening on http://127.0.0.1:${port}`);
  });
}

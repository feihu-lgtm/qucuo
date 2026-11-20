import { BLOCKED_CREDENTIAL, scrubCredentialPatterns } from "./textRedaction.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const RSA = "RSASSA-PKCS1-v1_5";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const VERTEX_OFF_EFFORT = [
  [/^gemini-4-hydrogen$/, "low"],
  [/^gemini-3(?:\.[56])?-flash(?:-preview)?$/, "minimal"],
  [/^gemini-3\.[15]-flash-lite(?:-preview)?$/, "minimal"],
];

export function vertexReasoningEffort(model, effort) {
  if (["low", "medium", "high"].includes(effort)) return effort;
  const modelId = String(model).replace(/^google\//, "");
  return VERTEX_OFF_EFFORT.find(([pattern]) => pattern.test(modelId))?.[1] ?? "low";
}

export function prepareVertexMessages(messages) {
  let end = messages.length;
  while (end > 0 && messages[end - 1].role === "assistant") end--;
  if (end === messages.length) return messages;
  const text = messages.slice(end).map(message => message.content).filter(content => content?.trim()).join("\n");
  const result = messages.slice(0, end);
  if (text) result.push({ role: "user", content: "（请直接接着下面这段继续写，不要重复）\n" + text });
  return result;
}

export function parseVertexAdc(text) {
  let adc;
  try { adc = JSON.parse(text); } catch { throw new Error("ADC 文件不是有效的 JSON"); }
  const required = adc?.type === "service_account" ? ["client_email", "private_key"]
    : adc?.type === "authorized_user" ? ["client_id", "client_secret", "refresh_token"] : null;
  if (!required || required.some(key => typeof adc[key] !== "string" || !adc[key].trim())) {
    throw new Error("ADC 文件必须是有效的 service_account 或 authorized_user 凭证");
  }
  return adc;
}

export function vertexDefaultProject(adc) {
  const project = adc.type === "authorized_user" ? adc.quota_project_id : adc.project_id;
  return typeof project === "string" ? project.trim() : "";
}

export function buildVertexEndpoint(project, location = "global") {
  project = project?.trim();
  location = location?.trim() || "global";
  if (!project || project === "." || project === "..") throw new Error("请填写 Vertex AI 项目 ID");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(location)) throw new Error("Vertex AI 位置格式不正确");
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${location}/endpoints/openapi/chat/completions`;
}

export function buildVertexJwtClaims(adc, nowMs) {
  const iat = Math.floor(nowMs / 1000);
  return { iss: adc.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 };
}

function base64Url(bytes) {
  return btoa(Array.from(bytes, n => String.fromCharCode(n)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(adc, crypto, nowMs) {
  try {
    const pem = adc.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
    const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
      { name: RSA, hash: "SHA-256" }, false, ["sign"]);
    const encoder = new TextEncoder();
    const encode = value => base64Url(encoder.encode(JSON.stringify(value)));
    const jwt = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(buildVertexJwtClaims(adc, nowMs))}`;
    const signature = await crypto.subtle.sign(RSA, key, encoder.encode(jwt));
    return `${jwt}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    throw new Error("无法用 ADC 文件中的私钥签名");
  }
}

function vertexError(prefix, parts, credentials) {
  let detail = parts.filter(value => typeof value === "string" && value.trim()).join("：");
  for (const credential of credentials) {
    if (credential) detail = detail.split(credential).join(BLOCKED_CREDENTIAL);
  }
  detail = scrubCredentialPatterns(detail).trim();
  if (detail.length > 200) detail = detail.slice(0, 199) + "…";
  return new Error(detail ? prefix + "：" + detail : prefix);
}

export async function vertexResponseError(response, authorization) {
  const data = await response.json().catch(() => null);
  const message = (Array.isArray(data) ? data[0] : data)?.error?.message;
  return vertexError(`Vertex AI HTTP ${response.status}`, [message], [authorization?.replace(/^Bearer\s+/i, "")]);
}

export function createVertexAuth(adc, { fetch, crypto, now }) {
  let token;
  let refreshAt = 0;
  let pending;

  async function exchange() {
    const requestedAt = now();
    const params = adc.type === "service_account"
      ? { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await signJwt(adc, crypto, requestedAt) }
      : { grant_type: "refresh_token", refresh_token: adc.refresh_token, client_id: adc.client_id, client_secret: adc.client_secret };
    let response;
    try {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
        redirect: "error",
      });
    } catch {
      throw new Error("Vertex AI 令牌交换失败：无法连接 Google OAuth");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw vertexError(`Vertex AI 令牌交换失败（HTTP ${response.status}）`, [data?.error, data?.error_description],
        [params.assertion, params.client_id, params.client_secret, params.refresh_token]);
    }
    const lifetime = Number(data?.expires_in) * 1000;
    if (typeof data?.access_token !== "string" || !data.access_token || !(lifetime > 0 && Number.isFinite(lifetime))) {
      throw new Error("Google OAuth 未返回有效的 Vertex AI 令牌");
    }
    token = data.access_token;
    refreshAt = requestedAt + lifetime - Math.min(REFRESH_MARGIN_MS, lifetime / 2);
  }

  return async function getVertexHeaders() {
    if (!token || now() >= refreshAt) {
      pending ||= exchange().finally(() => { pending = undefined; });
      await pending;
    }
    return {
      Authorization: `Bearer ${token}`,
      ...(typeof adc.quota_project_id === "string" && adc.quota_project_id.trim()
        ? { "x-goog-user-project": adc.quota_project_id.trim() } : {}),
    };
  };
}

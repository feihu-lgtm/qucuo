const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const RSA = "RSASSA-PKCS1-v1_5";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

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
    if (!response.ok) throw new Error(`Vertex AI 令牌交换失败（HTTP ${response.status}）`);
    const data = await response.json().catch(() => null);
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

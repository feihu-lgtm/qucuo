const ADC_KEY = "wuxia_mud_vertex_adc";
let storedText;
let getHeaders;

export async function importVertexCredential(text) {
  const { parseVertexAdc, vertexDefaultProject } = await import("./vertexAdc.js");
  const adc = parseVertexAdc(text);
  localStorage.setItem(ADC_KEY, text);
  storedText = undefined;
  getHeaders = undefined;
  return vertexDefaultProject(adc);
}

function readVertexCredential() {
  try { return localStorage.getItem(ADC_KEY); } catch { return null; }
}

export function hasVertexCredential() {
  return !!readVertexCredential();
}

export async function getStoredVertexHeaders(fetch) {
  const { createVertexAuth, parseVertexAdc } = await import("./vertexAdc.js");
  const text = readVertexCredential();
  if (!text) throw new Error("请先在设置中导入 Vertex AI 的 ADC JSON 文件");
  if (!getHeaders || storedText !== text) {
    getHeaders = createVertexAuth(parseVertexAdc(text), { fetch, crypto: globalThis.crypto, now: Date.now });
    storedText = text;
  }
  return getHeaders();
}

export const DEFAULT_VERTEX_MODEL = "google/gemini-4-hydrogen";

export const apiModelField = cfg => cfg?.apiType === "vertex" ? "vertexModel" : "model";

export function getApiModel(cfg) {
  return apiModelField(cfg) === "vertexModel" ? cfg.vertexModel || DEFAULT_VERTEX_MODEL : cfg?.model;
}

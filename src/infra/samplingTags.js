// A4 采样归属标签：dev 采样模式下，驱动器在每个回合前把
// { lane, turn, trace } 写到 window.__qucuoSampling，传输层发请求时
// 把三个值装进 x-qucuo-lane/x-qucuo-turn/x-qucuo-trace 请求头，
// 代理按头归属（不再按时间窗/文本推断）。仅 dev 生效，生产构建恒空对象。
export function getSamplingHeaders() {
  if (!import.meta.env?.DEV) return {};
  const tag = globalThis.__qucuoSampling;
  if (!tag || typeof tag !== "object") return {};
  const headers = {};
  if (tag.lane != null) headers["x-qucuo-lane"] = String(tag.lane);
  if (tag.turn != null) headers["x-qucuo-turn"] = String(tag.turn);
  if (tag.trace) headers["x-qucuo-trace"] = String(tag.trace);
  return headers;
}

// WO-16F-F3 inferAppeaseStance：赔罪诚意本地判定（纯函数，不调 AI）。
// 保守规则：明确歉意词→sincere；短文无歉意/敷衍语→perfunctory；其余 casual。
const SINCERE_RE = /对不起|抱歉|赔罪|赔礼|谢罪|是我不对|我错了|恕罪|海涵|包涵|诚恳/;
const PERFUNCTORY_RE = /行行好|算了吧|别计较|至于吗|多大点事|随便你|哦|嗯/;

export function inferAppeaseStance(text = "") {
  const t = String(text || "").trim();
  if (!t) return "perfunctory"; // 没说话等于没诚意
  if (SINCERE_RE.test(t)) return "sincere";
  if (PERFUNCTORY_RE.test(t)) return "perfunctory";
  if (t.length < 8) return "perfunctory"; // 太短成不了诚意
  return "casual";
}

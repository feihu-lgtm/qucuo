// WO-16F-F3 inferAppeaseStance：赔罪诚意本地判定（纯函数，不调 AI）。
// 保守规则：明确歉意词→sincere；短文无歉意/敷衍语→perfunctory；其余 casual。
const SINCERE_RE = /对不起|抱歉|赔罪|赔礼|谢罪|是我不对|我错了|恕罪|海涵|包涵|诚恳/;
const PERFUNCTORY_RE = /行行好|算了吧|别计较|至于吗|多大点事|随便你|哦|嗯/;

// 签名 (text, giftInfo)：有真实玩家原话就按文本判；无原话时实物赔罪看礼物分量——
// 厚礼/重金→sincere，其余/无礼→casual（薄礼不算敷衍证据）。按钮模板不得当原话。
export function inferAppeaseStance(text = "", giftInfo = null) {
  const t = String(text || "").trim();
  if (t) {
    if (SINCERE_RE.test(t)) return "sincere";
    if (PERFUNCTORY_RE.test(t)) return "perfunctory";
    if (t.length < 8) return "perfunctory"; // 太短成不了诚意
    return "casual";
  }
  // 无原话：实物赔罪由分量升档
  const label = giftInfo?.weight?.label || "";
  if (label === "厚礼" || label === "重金") return "sincere";
  return "casual";
}

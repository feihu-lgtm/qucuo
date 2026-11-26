// F7 真机验收修：口头契约系统侧兜底解析——「我定/我替你做X，你赏我Y」类立约句式。
// 此前 spontaneousPact 纯靠模型在 SEAL 自填，真模型不填就永漏（T16：三天之内替你
// 寻回旧物+事成赏银十两，通篇只有 MUTATE_SOCIAL 无结构化 pact）。
// 三重门槛全齐才成约（要约动词+明言期限+明言酬谢），缺一条返回 null——
// 宁可漏识别，绝不把正常寒暄误结构化（误伤正常对话比漏单更糟）。

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function cnNum(raw) {
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (CN_NUM[raw] != null) return CN_NUM[raw];
  // 十X / X十 简式（十一/二十）——立约口语里顶天二十，够用不扩
  const m = raw.match(/^(十([一二三四五六七八九])?|([一二三四五六七八九])十([一二三四五六七八九])?)$/);
  if (!m) return null;
  if (m[3]) return CN_NUM[m[3]] * 10 + (m[4] ? CN_NUM[m[4]] : 0);
  return 10 + (m[2] ? CN_NUM[m[2]] : 0);
}

// 期限：「三天之内/三日内/两个时辰内/48小时内」→ 小时。天/日×24、时辰×2、小时×1。
// Review 修：期限必带「之内/以内」——「前两天我去过后山」的追忆不带内字不是期限。
const DEADLINE_RE = /([一二两三四五六七八九十\d]+)\s*(天|日|个?时辰|小时)(?:之|以)?内/;
// 要约：我+定/会/去/替/帮 起头的承诺从句（到标点或「事成」收尾）。
const OFFER_RE = /我(?:定|会|去|替|帮)[^，。！？!?,]{2,28}/;
// 酬谢：赏我/给我/谢我/酬我+X（到标点/语气词收尾，cap 20 字与 validPact 口径一致）。
const REWARD_RE = /(?:赏|酬谢|谢|给|酬)我([^，。！？!?,]{1,18}?)(?:如何|怎么样|好不好|行吗|行么|吧|呢|嘛|啊)?(?:[，。！？!?,]|$)/;

export function parsePactOffer(text) {
  const t = String(text || "");
  if (!t) return null;
  const dm = t.match(DEADLINE_RE);
  const om = t.match(OFFER_RE);
  const rm = t.match(REWARD_RE);
  if (!dm || !om || !rm) return null;
  // Review 二轮修：追忆拒约改框架副词扫描（前两天/上次/以前/昨天）——
  //  blankets 过/了 会误伤「送过去」「修好了再回来」等真 forward 承诺。
  if (/(?:前|上)[一二两三四五六七八九十\d]+(?:天|日|周|个?月)|上次|以前|之前|当年|昨天|昨日/.test(t)) return null;
  const n = cnNum(dm[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = dm[2];
  const hours = (unit === "天" || unit === "日") ? n * 24 : unit.includes("时辰") ? n * 2 : n;
  if (!Number.isFinite(hours) || hours < 4) return null; // 与 validPact 期限下限同口径
  // 承诺：从句剥掉「我定/我会」起手与期限前缀，保留行动本体，cap 30 字（validPact 口径）。
  let promise = om[0].replace(/^我(?:定|会)?/, "").trim();
  promise = promise.replace(DEADLINE_RE, "").trim();
  if (!promise) return null;
  if (promise.length > 30) promise = promise.slice(0, 30);
  const rewardHint = String(rm[1] || "").trim().slice(0, 20);
  if (!rewardHint) return null;
  return { promise, deadlineHours: hours, rewardHint };
}

// 派工裁决①：本回合正文拒信关键词——扫到即不立约（静默/含糊/讨价还价不算拒）。
export const PACT_REFUSAL_RE = /休想|不行|免谈|做梦|凭什么|拒绝/;

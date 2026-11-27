// 回合失败整体回滚时，主栏日志也要跟着回滚这一回合写进去的「世界变化」。
// 此前状态（房间、内层房间、时间……）回滚了，日志却留着「你自马车行向西，来到此处」
// 和「※ 新人物出现」，玩家看到的位置和真实位置错开，直到下次真的走过去（FUZZ200 #57→#78）。
//
// 只删同时满足三条的条目：回合开始时还不在日志里；盖着本回合的 tid；不是要留的类型。
// 要留的：玩家自己的行动行（cmd）、报错行（err）、来信（信件状态不随回合回滚）。
const KEEP_TYPES = new Set(["cmd", "err"]);
const LETTER_RE = /^[\s\u3000]*「[^」]+来信」/;

function keep(entry) {
  if (!entry || typeof entry !== "object") return true;
  if (KEEP_TYPES.has(entry.t)) return true;
  return Boolean(entry.letterFrom) || LETTER_RE.test(entry.text || "");
}

export function dropRolledBackEntries(log, { before, tid }) {
  if (!Array.isArray(log) || !tid || !before) return log;
  const next = log.filter((entry) => before.has(entry) || entry?.tid !== tid || keep(entry));
  return next.length === log.length ? log : next;
}

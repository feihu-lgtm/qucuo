// 主栏排版规则（纯函数，单测覆盖）：
// 1. 时辰戳只标变化——换日或换时辰写全「第3日·辰正　第57回合」，同一时辰（辰初、辰正同属辰时）
//    的下一回合只写「第58回合」，
//    游戏时间没走（免费搭话、端详、失败回滚）就什么都不写。现实时间只留在悬停提示里。
// 2. 账目聚合——同一回合里连着出现的得物、数值、好感、武学行，合成一行「账」，不再一句一行插在正文之间。
// 3. 报错分两种——带 kind 的是接口/系统故障（一句话 + 次数），不带 kind 的是玩法内拒止（次要色轻提示）。
import { getGameDay, getTimeStr } from "../../../utils/mudHelpers.js";
import { LOG_T } from "../../../domain/data/log/logTypes.js";

const LEDGER_TYPES = new Set([LOG_T.ITEM, LOG_T.STAT, LOG_T.AFFECTION, LOG_T.SKILL]);
const SETTLE_BANNER_RE = /◈\s*.+?·\s*战斗结算/;

export function isLedgerEntry(entry) {
  if (!entry || !LEDGER_TYPES.has(entry.t)) return false;
  if (entry.action || entry.streaming || entry.fillKey || entry.receipts?.length) return false;
  if (entry.t === LOG_T.AFFECTION && SETTLE_BANNER_RE.test(entry.text || "")) return false;
  return Boolean(String(entry.text || "").trim());
}

// 账目行去掉前导空白与装饰符号（💗 ※ ◈ ✦ ▸ 等），只留内容。
export function ledgerText(entry) {
  return String(entry?.text || "")
    .replace(/^[\s\u3000]+/, "")
    .replace(/^(?:\p{Extended_Pictographic}\uFE0F?|[※◈✦▸•·＋+])+\s*/u, "")
    .trim();
}

// 把一个回合的回复切成渲染单元：连续的账目行合成一个 ledger 单元，其余逐条。
export function groupReplies(replies) {
  const units = [];
  for (const entry of replies || []) {
    if (isLedgerEntry(entry)) {
      const last = units[units.length - 1];
      if (last?.kind === "ledger") last.entries.push(entry);
      else units.push({ kind: "ledger", entries: [entry] });
    } else {
      units.push({ kind: "entry", entry });
    }
  }
  return units;
}

export function isSystemFailure(entry) {
  return entry?.t === LOG_T.ERR && Boolean(entry.kind);
}

export function isRuleHint(entry) {
  return entry?.t === LOG_T.ERR && !entry.kind;
}

function clockOf(entry) {
  if (typeof entry?.turn !== "number" || !Number.isFinite(entry.turn)) return null;
  const day = typeof entry.day === "number" ? entry.day : getGameDay(entry.turn);
  const shichen = getTimeStr(entry.turn).replace(/^第\d+日·/, "").split("·")[0].trim();
  return { day, turn: entry.turn, shichen, zhi: shichen.slice(0, 1) };
}

// 有状态的时辰戳决定器：按渲染顺序喂条目，返回该处要写的标签（null 表示不写）。
export function createClockMarker() {
  let last = null;
  return function mark(entry) {
    const clock = clockOf(entry);
    if (!clock) return null;
    const prev = last;
    last = clock;
    if (prev && prev.turn === clock.turn) return null;
    // 一个时辰两小时（辰初、辰正同属辰时），同日同时辰只写回合号。
    if (prev && prev.day === clock.day && prev.zhi === clock.zhi) {
      return { full: false, text: `第${clock.turn}回合` };
    }
    return { full: true, text: `第${clock.day}日·${clock.shichen}　第${clock.turn}回合` };
  };
}

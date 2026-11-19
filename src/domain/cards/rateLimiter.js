// 扫描调用的令牌桶限流器
// ============================================================================
// 免费反代站的额度是 5 次/分钟。这里用令牌桶而不是每次 sleep(12s)，原因：
//   · 只需要 2 次调用时不该干等 24 秒——桶里有令牌就立刻走
//   · 连续 5 次可以突发跑完（真实额度就是这么算的），之后才排队
//   · 刷新页面额度必须还在，否则玩家一刷新就能白刷 5 次，然后撞 429
// 桶状态只有两个数字，存 localStorage 就够，不值得动 IndexedDB。
//
// 【为什么 at 不能直接置 now】补令牌时如果把时间戳推到当前时刻，那些不足一个
// 补充周期的毫秒就被抹掉了。连续多次小额调用下，这些零头累积起来会让实际速率
// 慢于额度（每次都少攒一点）。所以 at 只推进到「已经兑换成令牌」的那部分。

const KEY = "qucuo_scan_bucket";

export const BUCKET_CAP = 5;          // 桶容量 = 额度上限
export const REFILL_MS = 12000;       // 每 12 秒补 1 个 = 5 次/分钟

function readBucket() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s.tokens === "number" && typeof s.at === "number"
        && s.tokens >= 0 && s.tokens <= BUCKET_CAP && s.at <= Date.now() + 1000) {
      return s;
    }
  } catch { /* 坏数据当没有 */ }
  // 首次使用，或存储被改坏/被别的域写脏 → 按满桶重置
  return { tokens: BUCKET_CAP, at: Date.now() };
}

function writeBucket(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 无痕模式等写不进，忽略 */ }
}

// 结算：把「距上次结算过了几个补充周期」换成令牌，返回结算后的桶
function settle() {
  const s = readBucket();
  const gained = Math.floor((Date.now() - s.at) / REFILL_MS);
  if (gained <= 0) return s;
  const tokens = Math.min(BUCKET_CAP, s.tokens + gained);
  const next = { tokens, at: s.at + gained * REFILL_MS };
  writeBucket(next);
  return next;
}

/**
 * 取一个令牌，没有就等。
 * @param {(waitMs:number)=>void} [onWait] 每轮轮询回调剩余等待毫秒，供 UI 显示倒计时
 * @param {{aborted:boolean}} [signal] 简易中断信号，置 aborted=true 可提前退出
 * @throws {Error} 被中断时抛 code=SCAN_ABORTED
 */
export async function acquire(onWait, signal) {
  for (;;) {
    if (signal?.aborted) {
      const e = new Error("扫描已中断");
      e.code = "SCAN_ABORTED";
      throw e;
    }
    const s = settle();
    if (s.tokens > 0) {
      writeBucket({ tokens: s.tokens - 1, at: s.at });
      return;
    }
    const wait = Math.max(0, REFILL_MS - (Date.now() - s.at));
    if (onWait) onWait(wait);
    // 轮询间隔取 200ms~1s：太长会让倒计时卡顿、中断不灵敏，太短白烧 CPU
    await new Promise(r => setTimeout(r, Math.min(1000, Math.max(200, wait))));
  }
}

/** 供 UI 显示：还剩几个令牌、下一个多久到 */
export function bucketStatus() {
  const s = settle();
  return {
    tokens: s.tokens,
    cap: BUCKET_CAP,
    nextInMs: s.tokens >= BUCKET_CAP ? 0 : Math.max(0, REFILL_MS - (Date.now() - s.at)),
  };
}

/** 估算跑 n 次调用还要多久（毫秒），用于开扫前告诉玩家"大约要等多久" */
export function estimateMs(n) {
  const s = settle();
  if (n <= s.tokens) return 0;
  const need = n - s.tokens;
  const firstWait = s.tokens >= BUCKET_CAP ? REFILL_MS : REFILL_MS - (Date.now() - s.at);
  return Math.max(0, firstWait) + (need - 1) * REFILL_MS;
}

/** 调试/测试用：把桶重置成满 */
export function resetBucket() {
  writeBucket({ tokens: BUCKET_CAP, at: Date.now() });
}

// 真实 provider 的限流重试：429/503 按指数退避（优先 Retry-After），其余错误直接抛出。
const RETRYABLE = new Set([429, 503]);

export function statusOf(error) {
  return error?.status ?? (Number(/HTTP (\d{3})/.exec(String(error?.message || ""))?.[1]) || null);
}

export function withRetry(ai, { retries = 4, baseDelayMs = 1000, maxDelayMs = 30000, jitter = Math.random, sleep, onRetry } = {}) {
  const wait = sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  return {
    async chat(messages, opts) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await ai.chat(messages, opts);
        } catch (error) {
          if (attempt >= retries || !RETRYABLE.has(statusOf(error))) throw error;
          const delay = Math.min(maxDelayMs, error.retryAfterMs ?? baseDelayMs * 2 ** attempt) + Math.floor(jitter() * baseDelayMs * 0.25);
          onRetry?.({ attempt: attempt + 1, delay, status: statusOf(error) });
          await wait(delay);
        }
      }
    },
  };
}

// 酒馆经营沙盒 · AI 叙事调度层
// 反代限流 1 分钟 5 次——AI 在这里是"锦上添花"，不是"生产资料"。
//
// 三条铁律：
// ① 引擎（simEngine.js）零 AI 依赖，没 key/限流/超时全部静默降级成模板文本；
// ② 令牌桶节流：容量 5、每 15 秒回 1 枚（比 12s 的硬限宽一截，给主游戏共用 key 留余量）；
// ③ 攒批合并：一天的营收/客流/事件打包成**一次**调用写成夜报，
//    绝不一件事一次调用——5 次/分钟的预算，烧得起夜报，烧不起碎碎念。

import { loadConfig, callModel } from "../apiConfig.js";

const BUCKET_CAPACITY = 5;
const REFILL_MS = 15000;

export function hasApiKey() {
  try {
    const cfg = loadConfig();
    return !!(cfg && cfg.apiKey && String(cfg.apiKey).trim());
  } catch {
    return false;
  }
}

export function createNarrator() {
  let tokens = BUCKET_CAPACITY;
  let lastRefill = Date.now();
  // 连续失败熔断：key 无效/反代挂了就别再每次日结都去撞墙刷 401，
  // 熔断后本局静默用模板（余额显示也归零，UI 上不装能用的样子）。
  let failStreak = 0;
  const circuitOpen = () => failStreak >= 2;

  // 懒 refill：每次取用时先按经过时间补币
  function refill() {
    const now = Date.now();
    const add = Math.floor((now - lastRefill) / REFILL_MS);
    if (add > 0) {
      tokens = Math.min(BUCKET_CAPACITY, tokens + add);
      lastRefill = now;
    }
  }

  function take() {
    refill();
    if (tokens <= 0) return false;
    tokens -= 1;
    return true;
  }

  async function ask(sys, user, callLabel) {
    let cfg;
    try {
      cfg = loadConfig();
    } catch {
      return null;
    }
    try {
      // 短润色请求强制关思考（thinking 与输出共享 token 预算，是项目已知坑），
      // 否则两三句夜报会被思考吃断在半句。
      const noThinkCfg = { ...cfg, thinkingMode: "off" };
      const { text } = await callModel(noThinkCfg, sys, [{ role: "user", content: user }], {
        maxTokens: 800,
        callLabel,
      });
      const clean = (text || "").replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
      if (clean) { failStreak = 0; return clean; }
      failStreak += 1;
      return null;
    } catch {
      failStreak += 1;
      return null; // 静默降级，调用方用模板兜底
    }
  }

  const SYS = `你是曲措乡「醉三江」酒馆账台边那位说书人。把给你的账目事实讲成一段有烟火气的夜报。
铁律：不改任何数字与结果，不编造没有的事件；白话古文说书口吻，句子完整；
控制在百字以内；只输出正文，不要任何前后缀。`;

  return {
    // UI 显示"AI 夜报 开/关"用：有 key 才有得谈
    available: hasApiKey,

    // 桶余量（UI 可以显示"本月 AI 余量"小圆点）
    balance() { refill(); return circuitOpen() ? 0 : tokens; },

    // 日结夜报：一天的全部亮点一次调用。成功返回文本，任何失败返回 null。
    async requestNightReport(report, eventTexts) {
      if (!hasApiKey() || circuitOpen() || !take()) return null;
      const facts = [
        `第${report.day}日`, `到客${report.guests}人（成交${report.served}、流失${report.lost}）`,
        `营收${report.revenue}两`, `工钱${report.wages}两`,
        report.bookLoss > 0 ? `账面损耗${report.bookLoss}两` : null,
        `净入账${report.net}两`, `声望${report.repDelta >= 0 ? "+" : ""}${report.repDelta}`,
      ].filter(Boolean).join("，");
      const events = (eventTexts || []).filter(Boolean).slice(0, 4).join("；");
      const user = `今日账目：${facts}。${events ? `今日事：${events}。` : "今日平安无事。"}写成一段夜报。`;
      return ask(SYS, user, "酒馆夜报");
    },

    // 事件开场白（可选增强）：只在桶里 ≥2 枚时才舍得花——夜报优先。
    async requestEventFlavor(eventTitle, eventDesc) {
      if (!hasApiKey() || circuitOpen()) return null;
      refill();
      if (tokens < 2) return null;
      if (!take()) return null;
      const user = `店里出了桩事：「${eventTitle}」——${eventDesc}。用说书人口吻补一句现场描写，四十字以内，只一句。`;
      return ask(SYS, user, "酒馆事件");
    },
  };
}

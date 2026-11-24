import { useCallback, useEffect, useRef } from "react";
import { appendDaySummary } from "../../domain/rules/memory/daySummary.js";
import { describeDayForSummary } from "../../domain/rules/memory/tally.js";
import { setFactSummary } from "../../domain/rules/prompt/knowledge.js";
import { resetForDay } from "../../domain/rules/map/mapSquares.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import {
  gameStore, getGameEpoch, getSessionEpoch, isGameEpochStale, isSessionEpochStale, useGameStore,
} from "../../store/gameStore.js";
import "../calls/hookCalls.js";

const webAi = createWebAi();

export function useDaySummary({ apiCfg, setVarTree, dayMaterialRef, prerunSquares }) {
  // 跨天侦测要订阅式地跟着 time 走——hook 内直订 store，不经参数透传（路线一）。
  const time = useGameStore((s) => s.time);
  const summarizeDay = useCallback(async (endedDay, material) => {
    const lines = (material || []).map(m => m.text).filter(Boolean);
    if (!lines.length) return;
    const label = `第${endedDay + 1}日`;
    const session = getSessionEpoch();
    // 同日内撤销不作废昨天的日总结；真换档/新开局或跨天退回昨日才丢弃。
    const isStale = () => isSessionEpochStale(session)
      || Math.floor((gameStore.getState().time ?? 0) / 24) <= endedDay;
    try {
      const { ok, text } = await withAI(
        "day.summary",
        { dayLabel: label, materialLines: lines },
        { ai: webAi, apiCfg, isStale },
      );
      if (!ok || isStale()) return;
      const summary = (text || "").trim();
      if (!summary) return;
      setVarTree(prev => appendDaySummary(prev, { day: endedDay, label, text: summary, turn: (endedDay + 1) * 24 }));
    } catch (_) { /* 日总结失败静默 */ }
  }, [apiCfg]);

  // 把一条结构化事实（切磋结果/飞鸽书信这类系统已知数据）交给 AI 写成一句白话古文小总结，
  // 覆盖掉注册时先塞的结构化兜底摘要。fire-and-forget：AI 没开/失败就保留那句兜底（不再是死模板文风，
  // 而是可读的结构化事实垫底）。cue 是喂给 AI 的事件线索，越具体 AI 写得越准。
  const aiSummarizeFact = useCallback(async (factId, cue) => {
    const epoch = getGameEpoch();
    const isStale = () => isGameEpochStale(epoch);
    try {
      const { ok, text } = await withAI("fact.summary", { cue }, { ai: webAi, apiCfg, isStale });
      if (!ok || isStale()) return;
      // 坑：这里原先写的是 if (line) ... setFactSummary(…, line)，但 callModel 解构出来的
      // 是 text——line 从来就不存在，每次都抛 ReferenceError 被下面的 catch 静默吃掉，
      // 等于 AI 摘要一次都没写进去过，一直在用注册时的结构化兜底（见 version.js 0727 修复记录）。
      const summary = (text || "").trim();
      if (summary) setVarTree(prev => setFactSummary(prev, factId, summary));
    } catch (_) { /* 保留结构化兜底摘要 */ }
  }, [apiCfg]);

  // 跨天侦测：24 回合 = 1 天。time 的整天数一旦增长，就把上一天的原料交给 summarizeDay，
  // 随即清空缓冲、推进 prevDay。用 ref 记上一整天数，避免每次 time 变都误触发。
  const prevDayRef = useRef(Math.floor(time / 24));
  useEffect(() => {
    const curDay = Math.floor(time / 24);
    if (curDay < prevDayRef.current) {
      prevDayRef.current = curDay;
      return;
    }
    if (curDay > prevDayRef.current) {
      const ended = prevDayRef.current;
      const material = dayMaterialRef.current;
      dayMaterialRef.current = [];
      prevDayRef.current = curDay;
      // 把这一天的行动计数也交给日总结当原料。此前不走 AI 的动作（走动/打坐/安抚…）
      // 一件都不留痕，日总结里会出现"今天什么都没干"却实际来回跑了十几趟的怪事。
      // 注意用 prevDayRef 之前那一天的 time 去读（ended*24），否则读到的是新一天的空表。
      const tallyLine = describeDayForSummary(gameStore.getState().varTree?.世界?.起居注, ended * 24);
      const fullMaterial = tallyLine ? [...material, { text: tallyLine }] : material;
      if (fullMaterial.length) summarizeDay(ended, fullMaterial);
      // 新的一天：全图格子重埋（昨日埋物作废，预跑重新掷骰写文——给出"每天值得巡一圈"的理由）
      resetForDay();
      prerunSquares();
    }
  }, [time, summarizeDay, prerunSquares]);
  return { aiSummarizeFact };
}

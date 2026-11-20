import { useCallback, useEffect, useRef, useState } from "react";
import { callModel } from "../../infra/apiConfig.js";
import { effectBrief } from "../../domain/economy/itemEffectText.js";
import { getCachedInspect, setCachedInspect } from "../../domain/prompt/inspectCache.js";
import { NOTE_SOURCE } from "../../domain/memory/note.js";
import { startTrace, step as traceStep, endTrace } from "../../infra/actionTrace.js";
import { PHASE, turnMonitor } from "../../core/turnMonitor.js";

export function useAiInspect({
  addLog, jotNote, setTime, setFlags, apiCfg, skills, char, inv, dispatchCommand,
}) {
  // 点击武学/包袱物品时，临场调用 AI 生成一段介绍文字，不修改任何游戏状态
  const [inspecting, setInspecting] = useState(null); // 记录正在查看哪个名字，用于按钮禁用/loading态展示
  // kind 标签映射：目前 "skill"(武学) / "item"(随身物品) / "pigeon"(信鸽) 三种，
  // 以后再加新 kind 只需在这两张表里添一行，不用到处写嵌套三元。
  const INSPECT_KIND_LABEL = { skill: "武学", item: "物品", pigeon: "信鸽" };
  const INSPECT_KIND_NOUN = { skill: "武学功法", item: "随身物品", pigeon: "信鸽（用于飞鸽传书的鸟）" };
  // 生成一件东西的端详描述文本（纯计算：构造 prompt → 调 AI → 返回文本）。
  // 抽成独立函数，让"点击查看"和"后台预跑"共用同一套 prompt，保证两边算出的
  // 内容一致、缓存键也一致（否则预跑存进去的缓存，点击时因 prompt 不同而读不到）。
  // 只负责生成文本，不碰缓存、不写日志、不算时间——这些副作用留给调用方按场景处理。
  const genInspectText = useCallback(async (kind, name, extra, itemObj, turn) => {
    const kindLabel = INSPECT_KIND_LABEL[kind] || "物品";
    const kindNoun = INSPECT_KIND_NOUN[kind] || "随身物品";
    const sys = `你是曲措乡这个武侠世界的说书人，现在玩家想仔细端详一件${kindNoun}。
用 3-5 句话、章回说书人口吻描述这个${kindLabel}的来历、外观或效用，符合当前世界观（澜湄雪域、曲措乡）。不需要 JSON，不需要更新任何状态，纯文本即可。
如果给出了品质和数值信息，请在描述里自然地体现这个品阶应有的分量感（品质越高描述越有气势），但不要机械地报数字。`;
    let prompt = kind === "skill"
      ? `功法名称：${name}${extra ? `，当前修炼进度：${extra}` : ""}`
      : kind === "pigeon"
        ? `信鸽${extra ? `，${extra}` : ""}`
        : `物品名称：${name}`;
    if (itemObj && typeof itemObj === "object") {
      const statBits = [];
      if (itemObj.atk != null) statBits.push(`攻击力${itemObj.atk}`);
      if (itemObj.def != null) statBits.push(`防御力${itemObj.def}`);
      // 饰品的战力在 sixDim/effect 上，鉴定 prompt 此前只给 AI 看 atk/def/bonus，
      // 于是问一件饰品，AI 只知道它是「白档、加成0.3」——真正的词条一个都没看见。
      if (itemObj.sixDim) statBits.push(Object.entries(itemObj.sixDim).map(([k, v]) => `${k}+${v}`).join("，"));
      if (itemObj.effect) { const t = effectBrief(itemObj.effect, null); if (t) statBits.push(`特效：${t}`); }
      prompt += `，品质：${itemObj.quality}${statBits.length ? `，${statBits.join("，")}` : ""}${itemObj.desc ? `，已知描述：${itemObj.desc}` : ""}`;
    }
    const { text } = await callModel(apiCfg, sys, [{ role: "user", content: prompt }], { maxTokens: apiCfg.callTokenLimits?.inspect ?? 4000, callLabel: "查看端详", turn });
    return (text || "").trim();
  }, [apiCfg]);

  const inspectItem = useCallback(async (kind, name, extra, itemObj, opts = {}) => {
    if (inspecting) return;
    const kindLabel = INSPECT_KIND_LABEL[kind] || "物品";
    const turn = startTrace(`查看${kindLabel}：${name}`, undefined, { source: "button", commandId: "inspect" });
    // worldLook：玩家在游戏世界里端详自己的东西（背包/武学），走主叙事口吻的端详、
    // 算 1 回合时间、并写一张公共小纸条。描述文本本身可以吃缓存（后台可能已预跑好），
    // 但"算时间+写纸条"这两个副作用只跟"玩家真的点了查看"这个动作绑定，跟缓存无关——
    // 命中缓存也照样执行副作用（等于又端详了一遍，只是不用重新调 AI）。
    // 商店预览等（默认 opts 不传 worldLook）走"瞬时缓存、不耗回合、不记事"，逛店翻看不扣时间。
    const worldLook = !!opts.worldLook;

    // 教程任务「四宅家产」触发点之一：端详溪边小屋钥匙即开任务（幂等，见 startEstateTutorial）
    if (name === "溪边小屋钥匙") setFlags(f => f.includes("tutorial_estate_started") ? f : [...f, "tutorial_estate_started"]);

    // 缓存命中：不论 worldLook 与否都先查缓存。命中就直接用缓存文本，不调 LLM、不显示加载态。
    const cached = getCachedInspect(kind, name, extra, itemObj);
    if (cached) {
      addLog([
        { t: "cmd", text: `> 查看${kindLabel}：${name}` },
        { t: "desc", text: "  " + cached.text },
      ]);
      // worldLook 命中缓存也要执行副作用（端详动作本身发生了）。
      if (worldLook) {
        setTime(t => t + 1);
        jotNote({ text: `端详了${kindLabel}「${name}」，看清了它的来历门道。`, owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
      endTrace(turn, "命中缓存");
      return;
    }

    setInspecting(name);
    addLog([{ t: "cmd", text: `> 查看${kindLabel}：${name}` }]);
    try {
      const text = await genInspectText(kind, name, extra, itemObj, turn);
      turnMonitor.transition(turn, PHASE.COMMIT);
      const finalText = text || "旁白一时沉默，未能看出什么门道。";
      addLog([{ t: "desc", text: "  " + finalText }]);
      // 只缓存真正拿到内容的结果；空响应退化不缓存，免得一次偶然的空响应把这件东西
      // 永久锁死成没有描述。worldLook 和非 worldLook 都写缓存（供下次秒显示/供预跑复用）。
      if (text) setCachedInspect(kind, name, extra, itemObj, finalText);
      if (worldLook && text) {
        // 端详是世界里的一个动作，算 1 回合时间 + 写一张公共小纸条
        // （日后"我那把剑当初端详过什么来历"能被召回）。
        setTime(t => t + 1);
        jotNote({ text: `端详了${kindLabel}「${name}」，看清了它的来历门道。`, owner: [], source: NOTE_SOURCE.NARRATIVE });
      }
    } catch (e) {
      addLog([{ t: "err", text: `  [错误] ${e.message}` }]);
      turnMonitor.transition(turn, PHASE.ERROR, String(e));
    }
    endTrace(turn);
    setInspecting(null);
  }, [inspecting, addLog, jotNote, genInspectText, setFlags]);

  // ── 端详描述后台预跑 ──
  // 背包/武学/装备里只要出现"该有描述但还没缓存"的东西，就在后台悄悄把它的端详
  // 描述先跑好存进缓存，玩家日后点"查看"时直接秒显示（命中缓存那条路径）。
  // 预跑只调 genInspectText（纯生成文本），不带任何副作用（不算时间、不写纸条）——
  // 那些副作用只绑在玩家真的点击查看那一刻。调度上每 20 秒跑一件，避开反代限流
  // （1分钟5次那个坑），东西再多也是排队慢慢消化，不会一拥而上打爆额度。
  const prewarmingRef = useRef(false); // 防止同一件正在跑时被重复触发

  // 从当前状态推导"所有该有端详描述的东西"清单。每条的 {kind,name,extra,itemObj}
  // 必须和点击查看时传给 inspectItem 的参数逐字一致，否则缓存键对不上、预跑白做。
  const collectInspectables = useCallback(() => {
    const list = [];
    // 可修炼武学：extra 跟点击调用逐字对齐（含品阶+阶段+等级，升级后键会变、自然重跑）
    for (const s of (skills || [])) {
      const q = s.quality || "白";
      const extra = s.fixed ? `${q}品·授业绝学（完整）` : `${q}品·${s.stage}`;
      list.push({ kind: "skill", name: s.name, extra, itemObj: null });
    }
    // 临阵招式：extra 跟点击调用逐字对齐
    for (const m of (char.moveset || []).filter(mv => !mv.sourceSkill)) {
      const q = m.quality || "白";
      const origin = m.learnedFromMaster ? "授" : "基础";
      list.push({ kind: "skill", name: m.name, extra: `${q}品·临阵招式（${origin}）`, itemObj: null });
    }
    // 背包物品：对象传 itemObj，字符串只传 name
    for (const it of (inv || [])) {
      if (typeof it === "object" && it) list.push({ kind: "item", name: it.name, extra: null, itemObj: it });
      else if (typeof it === "string") list.push({ kind: "item", name: it, extra: null, itemObj: null });
    }
    return list;
  }, [skills, char.moveset, inv]);

  // 用 ref 持有最新的 collectInspectables，让下面那个"每20秒一跳"的定时循环始终能读到
  // 当前最新清单，而不必把 collectInspectables 放进 effect 依赖——否则背包一变 effect 就重跑、
  // 定时器被反复清掉重起，玩家频繁操作时会永远等不满 20 秒、预跑一直不触发。
  const collectInspectablesRef = useRef(collectInspectables);
  useEffect(() => { collectInspectablesRef.current = collectInspectables; }, [collectInspectables]);
  const genInspectTextRef = useRef(genInspectText);
  useEffect(() => { genInspectTextRef.current = genInspectText; }, [genInspectText]);

  useEffect(() => {
    // 挂载时起一个自维持的定时循环：每 20 秒醒一次，扫当前清单，取第一件没缓存的跑掉。
    // 全跑完了就空转（继续每20秒扫一次，等有新东西再跑）——空转只是几次纯本地缓存读取，
    // 开销可忽略，换来的是不用管列表怎么变、定时节奏始终稳定。
    let stopped = false;
    let timer = null;
    const tick = async () => {
      if (stopped) return;
      if (!prewarmingRef.current) {
        const pending = collectInspectablesRef.current().filter(x => !getCachedInspect(x.kind, x.name, x.extra, x.itemObj));
        if (pending.length) {
          const job = pending[0];
          prewarmingRef.current = true;
          // 每件预跑单独开一条 trace，推到顶栏「🧭全流程日志」面板（不碰主叙事）。
          // 玩家/调试时能看到后台正在预热什么、跑好没、耗时多久、以及喂给AI的完整prompt。
          const jobLabel = `${job.kind === "skill" ? "武学" : "物品"}「${job.name}」`;
          const runPrewarm = async () => {
            const _pw = startTrace(`后台预跑端详·${jobLabel}`, `[后台预跑] ${jobLabel} 描述生成`, { background: true, commandId: "inspectPrewarm" });
            traceStep(_pw, "后台预跑", "info", `开始预热 ${jobLabel} 的端详描述`);
            try {
              const text = await genInspectTextRef.current(job.kind, job.name, job.extra, job.itemObj, _pw);
              if (text && !stopped) {
                setCachedInspect(job.kind, job.name, job.extra, job.itemObj, text);
                traceStep(_pw, "写入缓存", "pass", `${jobLabel} 描述已备好，点查看即秒显示`);
                endTrace(_pw, `预热完成：${jobLabel}`);
              } else {
                traceStep(_pw, "写入缓存", "skip", "AI 返回空，未写缓存，下轮再试");
                endTrace(_pw, `预热未成（空响应）：${jobLabel}`);
              }
            } catch (e) {
              traceStep(_pw, "AI调用", "fail", `预跑失败：${e?.message || e}`);
              turnMonitor.transition(_pw, PHASE.ERROR, `预热失败：${jobLabel}`);
            }
          };
          if (dispatchCommand) await dispatchCommand("inspectPrewarm", runPrewarm);
          else await runPrewarm();
          prewarmingRef.current = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, 20000);
    };
    timer = setTimeout(tick, 20000); // 首件也等 20 秒再跑，避开刚进游戏/读档时的一堆其它请求
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [dispatchCommand]);

  return { inspecting, inspectItem };
}

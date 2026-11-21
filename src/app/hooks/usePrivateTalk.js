import { useCallback } from "react";
import { snowLeopardHint } from "../../domain/quests/snowLeopardQuest.js";
import { callModel, callModelStream } from "../../infra/apiConfig.js";
import { startTrace, step as traceStep, endTrace } from "../../infra/actionTrace.js";
import { PHASE, turnMonitor } from "../../core/turnMonitor.js";
import {
  NNPC_STAGE, isInSea, gateWhisperTopics, gateQuestTopic,
} from "../../domain/narrator/narrator.js";
import { gateBodyProfile } from "../../domain/character/bodyProfile.js";
import { SEA_OF_MIND } from "../../domain/narrator/seaOfMind.js";
import { availableKnot, canResolve } from "../../domain/narrator/narratorQuest.js";
import { narratorVars, setNarratorVars } from "../../domain/prompt/mvu.js";
import { buildWhisperStatePrompt, formatFactSummariesForPrompt } from "../../domain/prompt/promptRefs.js";
import { WHISPER_AFFECTION_RULES } from "../../domain/state/fields.js";
import { allFactSummaries } from "../../domain/prompt/knowledge.js";
import { embeddingReady } from "../../domain/memory/embeddingService.js";
import { recallWithVisibility } from "../../domain/memory/recallWithVisibility.js";
import { gateScenario } from "../../domain/prompt/worldbook.js";
import { describeTallyForWhisper } from "../../domain/memory/tally.js";
import { QUCUO_QUESTS } from "../../domain/quests/qucuoQuests.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";
import { gameStore } from "../../store/gameStore.js";
import { buildPrivateTalkPayload } from "../../domain/prompt/privateTalkPayload.js";
import { bindTurnAi, createWebAi } from "../../engine/ports/ai.js";
import { applySettledDeltas, runSoftSettle } from "../../domain/settle/settle.js";
import { UNKNOWN_CHOICE } from "../../domain/settle/judge.js";

export function usePrivateTalk({
  narrator, addLog, apiCfg, convo, room, preset, flags,
  jotNote, char, nsfwOn, questProgress, changePendingTalks,
  talkBusyRef, schedulerRef, setInput, timeRef, varTreeRef, setLog, setConvo,
  setVarTree, setNarrator, noteAction,
}) {
  const talkToNarrator = useCallback(async (content, { isStale = () => false, turn } = {}) => {
    changePendingTalks(1);
    addLog([{ t: "cmd", text: `> 对旁白：${content}` }]);
    setInput("");

    const _wt = turn || startTrace(content, content);
    let summary;
    traceStep(_wt, "意图分类", "pass", "模式=私聊旁白（不消耗回合）");

    if (narrator.stage === NNPC_STAGE.CRASHED) {
      traceStep(_wt, "旁白状态", "block", "旁白已崩溃(CRASHED)，本地兜底话术，未调用AI");
      const flat = ["信号已断开。", "无法连接。", "……无应答。", "她不在这里。"];
      const flatText = flat[Math.floor(Math.random() * flat.length)];
      addLog([{ t: "narrator", text: `  「旁白」${flatText}` }]);
      endTrace(_wt, `旁白已崩溃，本地兜底："${flatText}"`);
      changePendingTalks(-1);
      schedulerRef.current?.touch();
      talkBusyRef.current = false; // 释放私聊闸门
      return;
    }

    try {
      const trace = (paths) => traceStep(_wt, "提示词引用缺失", "warn", paths.join("、"));

      // ── 旁白·全知事实（本轮新增）──
      // 旁白设定上是跳出信息隔离的第四面墙外角色，普通 NPC 之间发生的事（哪怕玩家没
      // 亲口跟她说过）她也该"看在眼里"。knowledge.js 的事实账本本来就是全局记账，
      // 不受"是否在场""是否目击"这层限制，直接全量读给她——不依赖 embedding 开关，
      // 也不需要玩家跟她提过。注意：这条只读普通事实账本，不读旁白私聊内容本身
      // （私聊走的是下面 convo 共享那条独立渠道，两者不混）。
      let factsBlock = "";
      {
        // 条数（绿灯·批五）：20→8。私聊本就是短回合（maxTokens 见 callTokenLimits.narratorWhisper），旁白也只会顺口提一两件；
        // 喂 20 条里绝大多数是陪跑，还把真正相关的那几条冲淡。取最近 8 条，更近更准也更省。
        const facts = allFactSummaries(varTreeRef.current, 8);
        if (facts.length) {
          factsBlock = "\n\n[你冷眼旁观知晓的事，未必是玩家亲口告诉过你的，回应时可以自然提起，但不要生硬列举或表现得像在念清单]\n"
            + formatFactSummariesForPrompt(facts);
          traceStep(_wt, "全知事实", "pass", `注入最近${facts.length}条事实账本摘要`);
        } else {
          traceStep(_wt, "全知事实", "skip", "事实账本为空，未注入");
        }
      }

      // 向量召回：让旁白"记起"可能早已滑出对话窗口的往事（与她"记得游戏里发生一切"的设定一致）。
      // 降级安全：没开向量或召回失败则 recallInfo 为 null，这段完全不影响私聊。
      let recallInfo = null;
      let recallBlock = "";
      if (embeddingReady(apiCfg)) {
        const lastAiText = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
        const focusEntities = Array.from(new Set([...room.npcs.map(n => n.name), ...Object.keys(varTreeRef.current.角色 || {}), room.name]));
        recallInfo = await recallWithVisibility({
          cfg: apiCfg, queryText: content,
          contextText: `${lastAiText}\n[当前]位置:${room.name}`,
          focusEntities, unlockedFlags: flags, presentNames: ["旁白"], topK: 5,
        });
        if (isStale()) return;
        if (recallInfo && recallInfo.visible.length) {
          recallBlock = "\n\n[你记得的往事，与此刻私聊相关，供你回应时自然照应，不要生硬复述]\n"
            + recallInfo.visible.map(m => `· （第${m.meta.turn}回合）${m.tier === "weak" && m.text.length > 40 ? m.text.slice(0, 40) + "…" : m.text}`).join("\n");
          traceStep(_wt, "向量召回", "pass", `召回${recallInfo.visible.length}条相关往事`);
        } else {
          traceStep(_wt, "向量召回", "skip", "已开启但本轮无相关召回结果");
        }
      } else {
        traceStep(_wt, "向量召回", "skip", "embedding未开启，跳过召回");
      }
      // scenario 蓝绿灯（与 act 同一套 gateScenario）：私聊此前直接拼 preset.scenario 全文，
      // 于是每次闲聊都要背一遍地图拓扑、契诃夫之枪、路途遭遇、装备品质六档表——
      // 聊天一句用不上，纯烧上下文，还把她往说书人腔调上拽。scope 走独立的 "whisper"
      // （不在任何条目的 scopes 里），因此专项段全靠关键词点亮：玩家问路才亮拓扑，
      // 提到人名才亮具名人物，聊到掉落才亮装备规则。认不出标题的段落照旧常驻（蓝灯），
      // 用户改过 scenario 或换自定义预设都不会因这层分流丢内容。
      const _lastReply = [...convo].reverse().find(m => m.role === "assistant")?.content || "";
      const _whisperGate = gateScenario(preset.scenario, {
        scope: "whisper",
        userInput: content,
        lastReply: _lastReply,
      });
      if (_whisperGate.lit.length || _whisperGate.dark.length) {
        traceStep(_wt, "世界书·总纲", "info",
          `🟢${_whisperGate.lit.join("、") || "无"}　⚫灭:${_whisperGate.dark.join("、") || "无"}`);
      }

      // 私聊话题红绿灯（身世/赌石邀帖等冷门追问）：默认不给，命中关键词才点亮。
      // 与上面 scenario 的"默认全给、按条目灭灯"相反，是加法而非减法——这些条目
      // 绝大多数轮次用不上，常驻只会白烧上下文；但玩家一旦问起，必须有统一口径，
      // 否则模型只能现编，这局说是将门遗孤、下局说是灭门孤儿。
      const _scan = `${content}\n${_lastReply}`;
      const _topicGate = gateWhisperTopics(_scan);
      if (_topicGate.lit.length) {
        traceStep(_wt, "私聊话题·红绿灯", "pass", `🟢${_topicGate.lit.join("、")}`);
      } else {
        traceStep(_wt, "私聊话题·红绿灯", "skip", "本轮无话题命中");
      }

      // 任务线红绿灯：报出任务全名才查那一条，泛泛问只让她反问；好感度 <30 不给。
      // 全任务表二十几条线、每条四五个 stage，全量注入等于每次闲聊背一本攻略书。
      const _questGate = gateQuestTopic(_scan, narrator.affection, QUCUO_QUESTS, questProgress);
      if (_questGate.lit.length) {
        traceStep(_wt, "任务线·红绿灯", "pass", `🟢${_questGate.lit.join("、")}`);
      } else {
        traceStep(_wt, "任务线·红绿灯", "skip", "本轮没聊到任务");
      }

      // 体貌：私聊时公开层常亮（她一直看着你），私密层仍只认 ■ 模式。
      const _bodyWhisper = gateBodyProfile(char.bodyProfile, {
        whisper: true, nsfw: nsfwOn, scanText: _scan,
      });
      if (_bodyWhisper.lit.length || _bodyWhisper.dark.length) {
        traceStep(_wt, "体貌", "info",
          `🟢${_bodyWhisper.lit.join("、") || "无"}　⚫灭:${_bodyWhisper.dark.join("、") || "无"}`);
      }

      // 旁白专属世界书（设置→旁白 tab 可编辑）：只进私聊，不进主叙事。留空则一个字不发。
      const loreText = (apiCfg.narratorLorebook || "").trim();
      const narratorLoreBlock = loreText
        ? `\n\n[旁白专属设定，只有你自己知道，玩家看不到这段文字，不要复述它的存在]\n${loreText}`
        : "";
      if (loreText) traceStep(_wt, "旁白专属世界书", "pass", `注入${loreText.length}字`);

      // 篇幅指令拼在最末尾（贴生成处 = 酒馆 Depth 0，是插入深度最强的位置，
      // 与「成文铁律放 userContent 末尾」同一条经验），别埋进开头被当耳旁风。
      //
      // ── 海内私聊：整套 system 换成创伤线专用 ──
      // 她此刻不是"被抽出来对话的旁白"，而是一个人蜷在沙发上。
      // 全知事实、旁白世界书、分档攻略、剧本总纲这些在这儿全不适用（她不在讲故事），
      // 只留：创伤线阶段 prompt + 向量召回（她记得你们一路的事）+ 篇幅。
      const inSeaNow = isInSea(narrator.stage) && room.name === SEA_OF_MIND.district;
      const seaVars = narratorVars(varTreeRef.current);
      // 起居注进私聊：她本来就是"记得游戏里发生一切"的角色，聊天时却不知道你今天
      // 干了什么很奇怪。累计只在第六档给——那时账本是她在记（见 tally 里的注释）。
      // 海里那条路不给：她此刻蜷在沙发上，谁还管你今天走了几步路。
      const tallyBlock = inSeaNow ? "" : describeTallyForWhisper(
        varTreeRef.current.世界?.起居注, timeRef.current,
        { includeLifetime: narrator.stage === NNPC_STAGE.RESOLVED },
      );
      const worldState = inSeaNow ? "" : buildWhisperStatePrompt(gameStore.getState(), { trace });
      const privateTalkPayload = buildPrivateTalkPayload({
        narrator,
        content,
        apiCfg,
        convo,
        inSeaNow,
        seaVars,
        worldState,
        snowLeopardBlock: snowLeopardHint({ questProgress, flags, cmd: content }),
        factsBlock,
        recallBlock,
        tallyBlock,
        narratorLoreBlock,
        bodyWhisperText: _bodyWhisper.text,
        topicGateText: _topicGate.text,
        questGateText: _questGate.text,
        whisperGateText: _whisperGate.text,
        narratorStage: NNPC_STAGE,
      });
      for (const paths of privateTalkPayload.promptRefEvents) {
        traceStep(_wt, "提示词引用缺失", "warn", paths.join("、"));
      }
      const { systemPrompt: sys, messages: talkMessages, maxTokens: narratorMaxTokens } = privateTalkPayload;

      let text;
      // ② 内容化好感已下线：⟦好感X⟧ 不再由她写在文末，改走 narrator_affinity 软结算（AI 提议、系统裁决）。
      // softSettleEnabled 关着（回放/离线兜底）时退回固定寻常闲聊 +1。
      let affDelta = WHISPER_AFFECTION_RULES.fallback;
      let finishReason;      // 停止原因：私聊此前完全没接这个字段，撞 length 上限也毫无提示
      // 模型会照着历史里的「（旁白私聊回应）」前缀自己也写一遍，而下面存 convo 时又会
      // 再加一次，于是前缀逐轮累积成「（旁白私聊回应）（旁白私聊回应）…」。存之前先剥干净：
      // 前缀由系统负责加，模型自己写的一律不算数。
      const stripEchoPrefix = (s) => s.replace(/^(?:\s*[（(]\s*旁白私聊回应\s*[）)])+\s*/, "");
      if (apiCfg.streamEnabled && apiCfg.apiType !== "gemini") {
        const logIdx = { current: null };
        addLog([{ t: "narrator", text: "  「旁白」▌", streaming: true }]);
        setLog(l => {
          if (isStale()) return l;
          logIdx.current = l.length - 1;
          return l;
        });
        const { text: streamedText, finishReason: fr } = await callModelStream(
          apiCfg, sys, talkMessages,
          (_delta, fullSoFar) => {
            setLog(l => {
              if (isStale() || logIdx.current == null) return l;
              const copy = [...l];
              copy[logIdx.current] = { t: "narrator", text: `  「旁白」${fullSoFar} ▌`, streaming: true };
              return copy;
            });
          },
          { maxTokens: narratorMaxTokens, recallInfo, callLabel: "私聊", turn: _wt },
        );
        if (isStale()) return;
        finishReason = fr;
        text = stripEchoPrefix(streamedText.trim()) || "……";
        setLog(l => {
          if (isStale() || logIdx.current == null) return l;
          const copy = [...l];
          copy[logIdx.current] = { t: "narrator", text: `  「旁白」${text}`, streamed: true };
          return copy;
        });
        traceStep(_wt, "AI调用", "pass", "流式一次成功");
      } else {
        const result = await callModel(apiCfg, sys, talkMessages, { maxTokens: narratorMaxTokens, recallInfo, callLabel: "私聊", turn: _wt });
        if (isStale()) return;
        finishReason = result.finishReason;
        text = stripEchoPrefix(result.text.trim()) || "……";
        addLog([{ t: "narrator", text: `  「旁白」${text}` }]);
        traceStep(_wt, "AI调用", "pass", "非流式一次成功");
      }

      // ── 截断检查（本轮补齐）──
      // 主叙事那条路一直有 finishReason 判定 + 自动重说，私聊却把这个字段整个丢掉了，
      // 撞上限时界面上毫无提示，只表现成"她话说一半"，排查时无从下手。
      // 这里不自动重试（私聊不消耗回合、玩家再问一句即可，重试反而多烧一次钱），
      // 只把真相摆到台面上：日志提示 + trace 留痕。好感改由软结算裁决玩家的话，
      // 不再依赖她写在文末的标记，截断与否不影响裁决。
      const whisperHitCap = /length|max[_ ]?tokens|max[_ ]?output/i.test(finishReason || "");
      if (whisperHitCap) {
        traceStep(_wt, "截断检查", "block", `撞 token 上限（finishReason=${finishReason}），本轮回复不完整`);
        addLog([{ t: "sys", text: `  ⚠ 旁白这句话没说完就撞上了 token 上限（当前 ${narratorMaxTokens}）。可在 设置 → 旁白 里调大「私聊 token 输出上限」。` }]);
      }

      // ── 好感裁决：narrator_affinity 软结算 ──
      // AI 提议、系统裁决：结算段小模型判玩家这句话落到什么份上，数值和日上限账本
      // 由系统落账，不再读她文末的 ⟦好感X⟧。判的是玩家的话，与回复是否被截断无关。
      // 海内/告白后不走这条路：创伤期靠心结推进，告白后走 memoryFragments。
      if (!inSeaNow && !narrator.confessed && apiCfg.softSettleEnabled !== false) {
        const soft = await runSoftSettle({
          ai: bindTurnAi(createWebAi(), _wt),
          apiCfg,
          kind: "narrator_affinity",
          ctx: {
            playerSay: content,
            varTree: varTreeRef.current,
            narrator,
            time: timeRef.current,
            charm: char?.special?.魅力 ?? 5,
          },
        });
        if (isStale()) return;
        if (soft && soft.choice !== UNKNOWN_CHOICE) {
          const affApplied = (soft.deltas || []).find((d) => d.path === "narrator.affection");
          affDelta = affApplied?.actualDelta ?? 0;
          if (!affApplied && soft.choice !== "敷衍冒犯") {
            // 正向观感却没落 delta = 今日额度已满（软结算按日上限账本裁掉了）
            addLog([{ t: "sys", text: "  （今日与她已够亲近了。改日再来。）" }]);
          }
          const treeDeltas = (soft.deltas || []).filter((d) => !d.path.startsWith("narrator."));
          if (treeDeltas.length) setVarTree((prev) => applySettledDeltas(prev, treeDeltas));
          traceStep(_wt, "结算·软判定", "pass", `旁白观感=${soft.choice}（${soft.note}）`);
        } else {
          affDelta = 0; // 判不了就不替她表态
          traceStep(_wt, "结算·软判定", "skip", "旁白观感判不了，本轮好感不变");
        }
      } else if (!inSeaNow && !narrator.confessed && apiCfg.softSettleEnabled === false && affDelta > 0) {
        // softSettleEnabled 关着的兜底：好感照旧 +1，但日上限仍要管——这条路的节流
        // 不走软结算（narratorDailyDelta），沿用原来手工账本，否则私聊一天就能刷满门槛。
        const led = varTreeRef.current.世界?.好感日增;
        const day = Math.floor((timeRef.current || 0) / 24);
        const gained = (led && led.dayStamp === day) ? { ...(led.gained || {}) } : {};
        const already = Number(gained["旁白"]) || 0;
        const room = Math.max(0, WHISPER_AFFECTION_RULES.daily - already);
        affDelta = Math.min(affDelta, room);
        if (affDelta <= 0) {
          addLog([{ t: "sys", text: "  （今日与她已够亲近了。改日再来。）" }]);
        } else {
          gained["旁白"] = already + affDelta;
          setVarTree(prev => {
            const next = JSON.parse(JSON.stringify(prev || {}));
            if (!next.世界) next.世界 = { 威望: 0 };
            next.世界.好感日增 = { dayStamp: day, gained };
            return next;
          });
        }
      }

      // 把这轮私聊也计入主引擎共享的对话历史，让旁白（以及之后的叙事）都能"记得"这次私聊
      turnMonitor.transition(_wt, PHASE.COMMIT);
      setConvo(c => isStale() ? c : [...c, { role: "user", content: `（私聊）${content}` }, { role: "assistant", content: `（旁白私聊回应）${text}` }]);

      // 私聊旁白也浓缩一张私有小纸条，owner=旁白（你俩私有，只在旁白语境下浮现，
      // 不进任何 NPC 的信息域）——与「对话模式=owner对话对象」同属"私语只你俩知道"这一类。
      jotNote({ text: `与旁白私语：${content.slice(0, 24)}${content.length > 24 ? "…" : ""}`, owner: [{ name: "旁白", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.WHISPER });

      const textPreview = text.length > 30 ? text.slice(0, 30) + "…" : text;
      summary = `旁白回应："${textPreview}"（好感${affDelta >= 0 ? "+" : ""}${affDelta}）`;

      // ── 海内：好感不动，改判"这一轮她有没有把当前那条心结说出来" ──
      // 创伤期的进度靠安抚与倾听推进，不靠聊天涨好感（她此刻不是在被追求）。
      // 判定放本地关键词初筛：AI 已经拿到了那条心结的 guide，它写出来的正文里
      // 必然带那几个核心意象；宁可放宽也不要卡住玩家——他都陪到这儿了。
      if (inSeaNow) {
        const kv = narratorVars(varTreeRef.current);
        const cur = availableKnot(kv.comfort, kv.knots || []);
        if (cur) {
          const HINT = {
            hebe:   ["没有回头", "没回头", "等过", "他没有看", "不理", "没看见我"],
            corner: ["墙角", "那堵墙", "墙是凉", "推我", "打我", "小时候"],
            doll:   ["布偶", "那个女人", "不看我", "她不看", "娃娃"],
          }[cur.key] || [];
          if (HINT.some(h => text.includes(h))) {
            const nextKnots = [...(kv.knots || []), cur.key];
            setVarTree(prev => setNarratorVars(prev, { knots: nextKnots, questStage: 3 }));
            addLog([{ t: "affection", text: `  ⟡ 她把「${cur.title}」说出来了。` }]);
            if (canResolve(kv.comfort, nextKnots)) {
              addLog([{ t: "sys", text: "  ⟡ 三个心结都说尽了。她在等你说一句她自己说不出口的话。" }]);
            }
          }
        }
        summary = `海内私聊："${textPreview}"`;
      }

      // 非海内才走好感结算。刻意不用 early return——函数尾部（try/catch 之外）
      // 统一释放 pendingTalks 与 talkBusyRef 闸门，从这里 return 会跳过它，
      // 要么闸门永久锁死、要么得在这儿重复释放一次（两处释放又会多减一次）。
      if (!inSeaNow) setNarrator(n => {
        if (n.confessed) {
          const mf = n.memoryFragments + 1;
          if (mf >= 8) {
            addLog([
              { t: "sys", text: "" },
              { t: "crash", text: "  ……她的声音忽然卡顿了一下。" },
              { t: "crash", text: "  「等等——这些记忆，不该在这里。」" },
              { t: "crash", text: "  文字开始扭曲，随即恢复成最初那种没有温度的公式化语气。" },
              { t: "sys", text: "" },
            ]);
            return { ...n, stage: NNPC_STAGE.CRASHED, memoryFragments: mf };
          }
          return { ...n, memoryFragments: mf };
        }
        // 日上限账本已搬进软结算（narratorDailyDelta 写 世界.好感日增 并裁幅），
        // 这里只把裁决出来的实际增量施加到旁白状态上。掉好感不限。
        const inc = Math.max(-n.affection, Math.min(affDelta, 100 - n.affection));
        if (inc !== 0) {
          const next = n.affection + inc;
          addLog([{ t: "affection", text: `  💗 好感度 ${inc > 0 ? "+" : ""}${inc}（${n.affection} → ${next}）` }]);
          return { ...n, affection: next };
        }
        return n;
      });
    } catch (e) {
      if (isStale()) return;
      traceStep(_wt, "AI调用", "fail", `私聊失败：${e.message || e}`);
      turnMonitor.transition(_wt, PHASE.ERROR, `私聊中断（${e.message || e}）`);
      addLog([{ t: "err", text: `  [错误] ${e.message}` }]);
    }
    endTrace(_wt, summary);
    noteAction("whisper");
    changePendingTalks(-1);
    schedulerRef.current?.touch();
    talkBusyRef.current = false; // 释放私聊闸门（成功/失败所有路径都到这，确保不会永久锁死）
  }, [narrator, addLog, apiCfg, convo, room, preset, flags, jotNote, char, nsfwOn, questProgress, changePendingTalks]);
  return { talkToNarrator };
}

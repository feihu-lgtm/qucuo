// 过目定稿 · 操作逻辑 Hook（从 ReviewPane.jsx 拆出）
// 收三类与界面无关的动作：① 选 NPC 当主角（含自动 AI 识别体貌）；② AI 一键
// 规划落脚 / 一键配装备（分批走令牌桶）；③ 卡面被丢弃段落的汇总。
import { useState, useRef, useEffect, useMemo } from "react";
import { callModel } from "../../../engine/ports/ai.js";
import { acquire } from "../../../domain/rules/cards/rateLimiter.js";
import { parseJsonLoose, buildStage3 } from "../../../domain/rules/cards/scanPrompts.js";
import {
  buildPlacementPlan, sanitizePlacementPlan, PLAN_BATCH, PLANNABLE_DISTRICTS,
  PLAN_MAX_TOKENS,
} from "../../../domain/rules/cards/placementPlan.js";
import { buildCarryPlan, sanitizeCarryPlan, CARRY_PLAN_MAX_TOKENS } from "../../../domain/rules/cards/carryPlan.js";
import { movesToSkills } from "../../../domain/rules/cards/skillPlan.js";
import { EMPTY_SPECIAL } from "./importShared.js";

export function useReviewOps({ result, setResult, apiCfg, patchNpc, parsed, autoPlace }) {
  // ── 从众人里指定一个当「我自己」（主角）─────────────────────────────────
  // 群像卡的主角常常自己也被当成世界书人物扫了出来（酒馆卡里主角、配角同在世界书
  // 里）。这里让玩家从扫出的人里挑一个填成主角档案；被选中的人自动不再作为 NPC 入库
  // （主角和 NPC 不该是同一人），名单里给他标个「主」。只在 playerMode(asPlayer) 下有意义。
  const [playerFromNpc, setPlayerFromNpc] = useState(null);
  const [bodyBusy, setBodyBusy] = useState(false);   // AI 自动识别体貌中
  const pickRef = useRef(null);                        // 防玩家快速切换时把上一个人的体貌写错人
  const initialPlayerRef = useRef(result.player);
  // AI 返回的 bodyProfile 只取公开层 7 个 key 的非空字符串，私密层 5 个 key 另走一套
  const cleanBody = (bp) => {
    const out = {};
    for (const k of ["height", "build", "face", "skin", "hair", "voice", "clothing"]) {
      if (typeof bp?.[k] === "string" && bp[k].trim()) out[k] = bp[k].trim().slice(0, 40);
    }
    return out;
  };
  const cleanBodyPrivate = (bp) => {
    const out = {};
    for (const k of ["scars", "scent", "intimate", "sensitive", "habit"]) {
      if (typeof bp?.[k] === "string" && bp[k].trim()) out[k] = bp[k].trim().slice(0, 40);
    }
    return out;
  };
  const npcToPlayer = (npc) => ({
    name: npc.name || "",
    nameWhy: "",
    gender: "男",
    bodyProfile: {},          // NPC 没有体貌十二项，选完会自动 AI 识别体貌（含私密层）
    bodyProfilePrivate: {},
    special: (npc.special && Object.keys(npc.special).length) ? { ...npc.special } : { ...EMPTY_SPECIAL },
    specialWhy: "",
    neigong: Number.isFinite(npc.neigong) ? npc.neigong : 5,
    waigong: Number.isFinite(npc.waigong) ? npc.waigong : 5,
    // 群像卡里选出来的主角，扫描时已按 NPC 扫出了招式槽(moves)与随身物(carry)。
    // 选他当主角时直接把这些落成主角的初始武学/装备草案——省一次 AI 调用，玩家仍可在
    // 「设置主角」那步点「AI 现编武学 / AI 配装备」重生成或手改。
    skills: movesToSkills(npc.moves, npc.levelCap ?? 0),
    carry: Array.isArray(npc.carry) ? [...npc.carry] : [],
    // 人设正文 + 外貌锚点都并进 persona，套得尽量全（体貌分项由 pickPlayerFrom 自动识别）
    persona: [npc.entry, npc.appearance].filter(Boolean).join("\n") || "",
    dialogueExamples: undefined,
    source: "fromNpc",
  });
  const pickPlayerFrom = async (name) => {
    setPlayerFromNpc(name);
    pickRef.current = name;
    if (name == null) {
      setResult(r => ({ ...r, player: initialPlayerRef.current }));  // 回到空白档案
      return;
    }
    const npc = result.npcs.find(n => n.name === name);
    if (!npc) return;
    setResult(r => ({ ...r, player: npcToPlayer(npc) }));
    // 自动 AI 识别体貌：NPC 只有一段外貌锚点，让 stage3 prompt 把它拆成体貌公开层 7 项
    // 与私密层 5 项（原文写到的才填，没写的不编）。私密层默认开启，审改界面有风险确认。
    const src = [npc.appearance, npc.entry].filter(Boolean).join("\n").trim();
    if (!src || !apiCfg) return;
    setBodyBusy(true);
    try {
      await acquire();
      const { system, user } = buildStage3(src, { cardName: npc.name });
      const res = await callModel(apiCfg, system, [{ role: "user", content: user }], { maxTokens: 4000, temperature: 0.6 });
      const body = parseJsonLoose(res.text || "") || {};
      const bp = cleanBody(body.bodyProfile);
      const bpPriv = cleanBodyPrivate(body.bodyProfilePrivate);
      // 玩家可能已经切走了，只在还选着这个人时才落，别把上个人的体貌写到新选的人身上
      if (pickRef.current === name && (Object.keys(bp).length || Object.keys(bpPriv).length)) {
        setResult(r => ({
          ...r,
          player: {
            ...r.player,
            bodyProfile: { ...(r.player?.bodyProfile || {}), ...bp },
            bodyProfilePrivate: { ...(r.player?.bodyProfilePrivate || {}), ...bpPriv },
          },
        }));
      }
    } catch { /* 静默，体貌留空玩家手填 */ }
    finally { if (pickRef.current === name) setBodyBusy(false); }
  };

  // 入库名单排除被选为主角的那个人（主角走 player，不重复入 NPC 库）
  // ── AI 一键规划落脚 ──────────────────────────────────────────────────────
  // 【为什么按批而不是一人一次】令牌桶是 5 次/分钟。一人一次的话十个人就要等两
  // 分钟，而落脚判断只需要人物的身份与来历，六个人的摘要塞进一个 prompt 完全放
  // 得下（据点清单本身才八百字）。六人一批意味着三十人也只烧六次额度。
  // 【为什么一批失败不中断】每批是独立的一次调用，第二批 429 不该让第一批已经
  // 规划好的人白丢。失败的批次记数，最后一并告诉玩家哪几批没成、可以再点一次。
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [planProg, setPlanProg] = useState(0);

  const planAll = async () => {
    const npcs = result.npcs;
    if (planBusy || !npcs.length) return;
    setPlanBusy(true); setPlanProg(0);

    // 分批时把全局下标一起带上——sanitizePlacementPlan 返回的 index 是相对这一
    // 批的，直接拿去 patchNpc 会改错人
    const batches = [];
    for (let i = 0; i < npcs.length; i += PLAN_BATCH) {
      batches.push(npcs.slice(i, i + PLAN_BATCH).map((n, j) => ({ npc: n, at: i + j })));
    }

    let done = 0, placed = 0, failed = 0, rejected = 0;
    for (let b = 0; b < batches.length; b++) {
      const grp = batches[b];
      const tag = `第 ${b + 1}/${batches.length} 批`;
      try {
        setPlanMsg(`${tag} · 等额度`);
        await acquire(ms => setPlanMsg(`${tag} · 排队 ${Math.ceil(ms / 1000)}s`));
        setPlanMsg(`${tag} · 正在相地（${grp.length} 人）`);
        const list = grp.map(g => g.npc);
        const { system, user } = buildPlacementPlan(list, PLANNABLE_DISTRICTS);
        const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
          { maxTokens: PLAN_MAX_TOKENS.batch, temperature: 0.6 });
        const plans = sanitizePlacementPlan(parseJsonLoose(res.text || ""), list, PLANNABLE_DISTRICTS);
        if (!plans.length) { failed++; } else {
          for (const p of plans) {
            const target = grp[p.index];
            if (!target) continue;
            patchNpc(target.at, {
              placement: p.placement, placementWhy: p.why, placementRejected: p.rejected,
            });
            if (p.placement.mode !== "mention") placed++;
            if (p.rejected) rejected++;
          }
        }
      } catch (e) {
        failed++;
        const raw = e?.raw ? `　模型吐的是：${String(e.raw).replace(/\s+/g, " ").slice(0, 50)}` : "";
        setPlanMsg(`${tag} 没成：${String(e?.message || e).slice(0, 70)}${raw}`);
      }
      done += grp.length;
      setPlanProg(done / npcs.length);
    }

    setPlanMsg([
      `规划完毕 · ${placed} 人会真的出现`,
      rejected ? `${rejected} 人的据点不在地图里已退回` : "",
      failed ? `${failed} 批没成，可以再点一次` : "",
    ].filter(Boolean).join("，"));
    setPlanBusy(false);
  };

  // ── AI 一键配装备 ────────────────────────────────────────────────────────
  // 跟一键规划落脚同构：按批把人设摘要塞进 prompt，AI 按身份/品阶配 2-4 件随身物，
  // 回来的物件过 sanitizeCarryPlan（品阶不超此人、类别合法）后 patchNpc 进 carry。
  // 一批失败不拖累别批，失败记数最后一并报。
  const [equipBusy, setEquipBusy] = useState(false);
  const [equipMsg, setEquipMsg] = useState("");
  const [equipProg, setEquipProg] = useState(0);

  const equipAll = async () => {
    const npcs = result.npcs;
    if (equipBusy || !npcs.length) return;
    setEquipBusy(true); setEquipProg(0);
    const batches = [];
    for (let i = 0; i < npcs.length; i += PLAN_BATCH) {
      batches.push(npcs.slice(i, i + PLAN_BATCH).map((n, j) => ({ npc: n, at: i + j })));
    }
    let done = 0, equipped = 0, failed = 0;
    for (let b = 0; b < batches.length; b++) {
      const grp = batches[b];
      const tag = `第 ${b + 1}/${batches.length} 批`;
      try {
        setEquipMsg(`${tag} · 等额度`);
        await acquire(ms => setEquipMsg(`${tag} · 排队 ${Math.ceil(ms / 1000)}s`));
        setEquipMsg(`${tag} · 正在配装（${grp.length} 人）`);
        const list = grp.map(g => g.npc);
        const { system, user } = buildCarryPlan(list);
        const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
          { maxTokens: CARRY_PLAN_MAX_TOKENS.batch, temperature: 0.7 });
        const plans = sanitizeCarryPlan(parseJsonLoose(res.text || ""), list);
        if (!plans.length) { failed++; } else {
          for (const p of plans) {
            const target = grp[p.index];
            if (!target) continue;
            patchNpc(target.at, { carry: p.items });
            equipped++;
          }
        }
      } catch (e) {
        failed++;
        setEquipMsg(`${tag} 没成：${String(e?.message || e).slice(0, 70)}`);
      }
      done += grp.length;
      setEquipProg(done / npcs.length);
    }
    setEquipMsg([`配装完毕 · ${equipped} 人已配`, failed ? `${failed} 批没成，可再点一次` : ""].filter(Boolean).join("，"));
    setEquipBusy(false);
  };

  // 「当江湖众人」流程：一进过目页就自动按营生跑一遍荐位，不必玩家手点。
  // 【为什么用 ref 而不只靠 planBusy】planBusy 是异步置起的，StrictMode 双挂载
  // 或 result 变化可能在它置起前重入；autoRanRef 保证这辈子只自动跑一次。玩家仍
  // 可用底部「AI 一键规划落脚」手动重跑，那条路不看这个 ref。
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!autoPlace || autoRanRef.current || !result.npcs.length) return;
    autoRanRef.current = true;
    planAll();
  }, [autoPlace]);

  // 卡里被本作丢弃的东西，列给玩家看一眼，别让它们悄悄消失
  const dropped = useMemo(() => {
    const out = [];
    const sc = parsed?.card?.scripts;
    if (sc?.regexScripts) out.push(`${sc.regexScripts} 条正则替换脚本（本作有自己的渲染，不需要）`);
    if (sc?.tavernHelper) out.push(`酒馆助手前端界面 ${sc.tavernHelper.size} 字符${sc.remoteImport ? "，且会从远程地址拉代码执行" : ""}`);
    if (sc?.otherExtensionKeys?.length) out.push(`第三方扩展数据：${sc.otherExtensionKeys.join("、")}`);
    for (const m of (parsed?.metaEntries || [])) out.push(`框架类条目「${m.label}」${m.length}字（状态栏／格式／思维链之类）`);
    return out;
  }, [parsed]);

  // ── 向导渲染：asPlayer 走三步，否则走原有的「名单 + 逐个设置」──
  // 【为什么向导分支要包一层纵向容器】外层 review 容器是横向 flex（flex:1, display:flex），
  // 只包一个 fragment 的话三个块（导航条/内容区/底部）会被排成一行、全挤在左边。
  // 加这层 flex:1 + column，让向导自己占满整栏并纵向堆叠。

  return {
    playerFromNpc, bodyBusy, pickPlayerFrom,
    planBusy, planMsg, planProg, planAll,
    equipBusy, equipMsg, equipProg, equipAll,
    dropped,
  };
}

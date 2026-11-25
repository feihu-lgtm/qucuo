// WO-12 纯函数判官：AI 提议、系统裁决。
// judgeTurn(envelope, intakeResult, { rng }) 顺序执行四步：
//   1) 核验 refIds 的 witnesses 知情权——不知情 NPC 拆分为独立反应导引；
//   2) 按 NPC 性情/偏爱/好感裁定赠礼、赔罪、求教收拒，拒收不产扣物事实；
//   3) inspect_container 三关掷骰：预设物 → 备料物 → 玩家 proposals
//      （fit 档位 + 气运 + 悬空道具落点，不达标降级残页线索）；
//   4) 签发 JudgeVerdict（契约 C 冻结形状）：facts 铁案 + 空白 warrants，
//      tier/pointBudget/allowedAffixes 由 WO-09 computeCausalBudget 核定。
// 纯函数，禁 Date.now/Math.random——随机只走传入 rng。

import { computeCausalBudget } from "./causalBudget.js";
import { resolveWarrantQuality, inferCategoryFromClaim } from "./warrantRules.js";
import { allowedAffixesForBudget } from "../effects/affixPointTable.js";
import { giftPreference, computeGiftWeight } from "../npc/giftWeight.js";

const QUALITY_ORDER = ["白", "绿", "蓝", "紫", "橙", "红"];

// 性情对收拒的修正：冷傲难动、豪爽易热、精明看价、温善心软、暴烈吃软不吃硬。
const PERSONA_MOD = [
  [/冷傲|孤傲|清冷/, -0.15],
  [/豪爽|直率|爽朗|豪迈/, 0.15],
  [/精明|算计|市侩/, -0.05],
  [/温善|和善|仁慈|热心/, 0.1],
  [/暴烈|暴躁|烈性/, -0.1],
  [/狡猾|多疑|阴鸷/, -0.1],
];

function personaMod(personality) {
  const text = String(personality || "");
  let mod = 0;
  for (const [re, m] of PERSONA_MOD) if (re.test(text)) mod += m;
  return mod;
}

function affectionOf(varTree, npcName) {
  const v = varTree?.角色?.[npcName]?.好感度;
  return Number.isFinite(v) ? v : 0;
}

// 好感档位修正：过命 +0.25 / 亲近 +0.15 / 熟络 +0.05 / 芥蒂 -0.2
function affectionMod(aff) {
  if (aff >= 80) return 0.25;
  if (aff >= 60) return 0.15;
  if (aff >= 40) return 0.05;
  if (aff <= 0) return -0.05;
  return 0;
}

// 搭话 stance → 好感增量（WO-16A）：覆盖 schema 全部 enum，未知/无法判断按 0。
// perfunctory=0 不产事实（空事实不进账本）；forceful 负数走负向社交。
const TALK_STANCE_DELTA = { sincere: 2, clever: 1, casual: 1, perfunctory: 0, forceful: -1 };

// fit 档位的过关门槛：越离谱越难成；气运（luck 0-10）每点降 3% 门槛。
const FIT_GATE = { natural: 0.25, stretch: 0.55, absurd: 0.85 };

function findNpc(npcs, name) {
  return (npcs || []).find((n) => n?.name === name) || null;
}

function knowsEntry(entry, npcName) {
  const w = entry?.witnesses;
  if (!Array.isArray(w) || w.length === 0) return true;
  return w.includes("*") || w.includes(npcName);
}

export function judgeTurn(envelope = {}, intakeResult = {}, { rng } = {}) {
  const roll = typeof rng === "function" ? rng : () => 0.5;
  const turn = Number.isInteger(envelope.turn) ? envelope.turn : 0;
  const day = Number.isInteger(envelope.day) ? envelope.day : 0;
  const place = envelope.place || "";
  const entries = Array.isArray(envelope.entries) ? envelope.entries : [];
  const npcs = Array.isArray(envelope.npcs) ? envelope.npcs : [];
  const varTree = envelope.varTree || {};
  const inv = Array.isArray(envelope.inv) ? envelope.inv : [];
  const budget = computeCausalBudget(envelope.budget || {});

  const facts = [];
  const warrants = [];
  const notes = [];
  let factSeq = 0;
  let warrantSeq = 0;
  const nextFactId = () => `F${turn}_${++factSeq}`;

  // ── 第一步：refIds 知情权核验 ──
  // 玩家援引的场记板条目，逐 NPC 分知情/不知情；不知情者拆独立反应导引——
  // 他只能对玩家话语的表面反应，不能表现出知道内情。
  const refIds = Array.isArray(intakeResult.refIds) ? intakeResult.refIds : [];
  const refEntries = refIds.map((id) => entries.find((e) => e?.id === id)).filter(Boolean);
  const missingRefIds = refIds.filter((id) => !entries.some((e) => e?.id === id));
  if (missingRefIds.length) notes.push(`查无此条目的引用：${missingRefIds.join("、")}`);
  const reactionGuides = npcs.map((npc) => {
    const known = refEntries.filter((e) => knowsEntry(e, npc.name)).map((e) => e.id);
    const unknown = refEntries.filter((e) => !knowsEntry(e, npc.name)).map((e) => e.id);
    return {
      npc: npc.name,
      knownRefIds: known,
      unknownRefIds: unknown,
      // 不知情拆分：存在不知内情的引用时，给该角色单独的反应导引
      guidance: unknown.length
        ? `${npc.name}不知晓${unknown.join("、")}内情，只能按话语表面反应，禁写出知情暗示`
        : "",
    };
  });

  // ── 第二步：赠礼/赔罪/求教收拒裁决 ──
  const rawActions = Array.isArray(intakeResult.actions) ? intakeResult.actions : [];
  // WO-16G interim：带前提（condition≠无）的动作全部机械结算跳过——前提是否成真
  // 判官还没裁决能力（WO-16F 才做真条件裁决），提前结算会把「要是没人我就翻箱」
  // 当成已经翻了：容器被耗竭、物件被搬空。只留 note 痕迹，其余 action 照常。
  const conditioned = rawActions.filter((a) => a?.condition && a.condition !== "无");
  for (const a of conditioned) {
    notes.push(`前提未裁，暂不结算：${a.kind}${a.target && a.target !== "无" ? `→${a.target}` : ""}（${a.condition}：${a.condition_text || "未述"}）`);
  }
  const actions = rawActions.filter((a) => !(a?.condition && a.condition !== "无"));
  const signedRestKeys = new Set(); // WO-16F-F1 本 verdict 调息去重
  // 任务交付去重预扫：quest_advance 提议命中带 deliver 的合法候选时，同目标同物的
  // give 动作必须压制——交付件归属由 questFlagRule 任务通道扣件结算，赠礼通道再转
  // 一次就是双扣件+虚假好感（村2 糌粑→老孙：交差不是送礼）。
  const questCandidatesPre = Array.isArray(envelope.questCandidates) ? envelope.questCandidates : [];
  const proposalsPre = Array.isArray(intakeResult.proposals) ? intakeResult.proposals : [];
  const deliverClaims = proposalsPre
    .filter((p) => p?.kind === "quest_advance")
    .map((p) => questCandidatesPre.find((c) => c.questId === p.questId && c.flag === p.flag))
    .filter((c) => c?.deliver)
    .map((c) => c.deliver);
  const isDeliverGive = (action, item) => deliverClaims.some((d) => {
    if (action.target !== d.to) return false;
    const iname = item?.name || action.itemId || "";
    return !!iname && (iname === d.item || iname.includes(d.item) || d.item.includes(iname));
  });
  let anyAccepted = false;
  // WO-16A 搭话开闸：talkOnly 回合（纯搭话）判官只产小额社交事实——
  // 严禁因搭话误搬物品：give/inspect_container 等硬事实整条拦截，只留 notes 痕迹。
  const talkOnly = !!envelope.talkOnly;
  for (const action of actions) {
    // ── WO-16F-F1 free_act 按 outcome+risk 查表签发（target 常为「无」，先于此处理）──
    // 检定/区间随机只用传入 rng；公式见 docs/PR：伤损 -maxHp×{低.05,中.12,高.25}、
    // 身法/体魄检定（attr+rng()×6 ≥ 6）减半；得财 T0 2-10/T1 10-40/T2 40-120 且须
    // 有 fit 非 absurd 的对应 proposal；调息同时辰幂等；修习按 tier 定 potDelta。
    if (action.kind === "free_act") {
      if (talkOnly) { notes.push(`纯搭话回合不结算free_act`); continue; }
      const outcome = action.outcome || "无";
      const risk = action.risk || "无";
      const ch = envelope.char || {};
      const sp = ch.special || {};
      const maxHp = Array.isArray(ch.hp) ? (ch.hp[1] ?? 100) : 100;
      const money = ch.money ?? 0;
      const tierRank = { T0: 0, T1: 1, T2: 2 }[budget.tier] ?? 0;
      const ck = (attr) => ((sp[attr] ?? 5) + roll() * 6) >= 6; // 属性检定：身法/体魄
      const wit = ["主角"];
      if (outcome === "伤损") {
        const ratio = risk === "高" ? 0.25 : risk === "中" ? 0.12 : 0.05;
        let dmg = Math.round(maxHp * ratio);
        const halved = ck("身法") || ck("体魄");
        if (halved) dmg = Math.max(1, Math.round(dmg / 2));
        facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", hpDelta: -dmg, witnesses: wit });
        notes.push(`伤损签发：-${dmg} 气血（risk ${risk}${halved ? "，检定减半" : ""}）`);
      } else if (outcome === "得财") {
        // 只有 proposal fit 非 absurd 才签——玩家随口「发财」不落银两。
        const fitProp = proposalsPre.find((pp) => pp && pp.fit && pp.fit !== "absurd");
        if (!fitProp) { notes.push("得财无 fit 合规 proposal，不签发"); continue; }
        const ranges = [[2, 10], [10, 40], [40, 120]][tierRank];
        const amt = ranges[0] + Math.floor(roll() * (ranges[1] - ranges[0] + 1));
        facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: amt, witnesses: wit });
        notes.push(`得财签发：+${amt} 银两（tier ${budget.tier}）`);
      } else if (outcome === "破费") {
        // 玩家原话写明数额才签，且不超过现有银两；没写数额不签。
        const m = String(action.text || "").match(/(\d+)\s*(?:两|银|钱)/);
        if (!m) { notes.push("破费未写明数额，不签发"); continue; }
        const amt = Math.min(parseInt(m[1], 10), money);
        if (amt <= 0) { notes.push("破费数额超出囊中银两，不签发"); continue; }
        facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -amt, witnesses: wit });
      } else if (outcome === "调息") {
        // 同一游戏时辰只签一次——时辰两回合一档（restKey 按 watch=turn/2 取整），
        // varTree 记账跨回合防重 + 本 verdict 内 signedRest 去重（快照同读）。
        const restKey = `rest_${Math.floor(turn / 2)}`;
        const done = (varTree?.世界?.调息账 || []).includes(restKey) || signedRestKeys.has(restKey);
        if (done) { notes.push("本时辰已调息过，幂等跳过"); continue; }
        signedRestKeys.add(restKey);
        facts.push({
          id: nextFactId(), op: "CHANGE_VITALS_SILVER",
          hpDelta: Math.round(maxHp * 0.10), witnesses: wit,
        });
        facts.push({
          id: nextFactId(), op: "PROGRESS_CULTIVATION", potDelta: 1,
          reason: "调息养气", witnesses: wit, restKey,
        });
      } else if (outcome === "修习") {
        const pot = [1, 2, 3][tierRank];
        facts.push({ id: nextFactId(), op: "PROGRESS_CULTIVATION", potDelta: pot, reason: "修习精进", witnesses: wit });
      } else if (outcome === "受寒中毒") {
        // schema 只有合并枚举——按玩家原话关键词分流寒/毒，两者兼有并列签两条。
        const text = String(action.text || "");
        const cold = /寒|冷|冻|受风/.test(text);
        const poison = /毒|中毒/.test(text);
        if (!cold && !poison) { notes.push("寒热毒型不明，不签发"); continue; }
        if (cold) {
          facts.push({
            id: nextFactId(), op: "APPLY_CONDITION",
            attr: "身法", val: -1, negative: true, durationTurns: 12, reason: "受寒", witnesses: wit,
          });
        }
        if (poison) {
          facts.push({
            id: nextFactId(), op: "APPLY_CONDITION",
            attr: "体魄", val: -1, negative: true, durationTurns: 12, reason: "中毒", witnesses: wit,
          });
        }
      } else if (outcome === "醉酒") {
        facts.push({
          id: nextFactId(), op: "APPLY_CONDITION", attr: "智谋", val: -1, negative: true,
          durationTurns: 6, reason: "醉酒", witnesses: wit,
        });
      }
      // 服用/无/其他：不签。
      continue;
    }

    // ── WO-16F-F1 steal 按表裁定 ──
    // 检定 = 身法+智谋+rng()×6 对 警觉难度 4+修正；性情含 精明/多疑/阴鸷 +2，
    // 在场人数每多一人（除目标外）+1。成功且目标身携有物签 TRANSFER_ITEM
    // （npc→player 取其 carry 首件）；失败签 MUTATE_SOCIAL 怨 -6 并置生气标记。
    if (action.kind === "steal") {
      if (talkOnly) { notes.push(`纯搭话回合不结算steal`); continue; }
      const target = findNpc(npcs, action.target);
      if (!target) { notes.push(`偷窃目标 ${action.target || "无名"} 不在场，不签发`); continue; }
      const ch2 = envelope.char || {};
      const sp2 = ch2.special || {};
      const sneaky = /精明|多疑|阴鸷/.test(target.personality || "") ? 2 : 0;
      const crowd = Math.max(0, npcs.length - 1);
      const check = (sp2.身法 ?? 5) + (sp2.智谋 ?? 5) + roll() * 6;
      const difficulty = 4 + sneaky + crowd;
      if (check >= difficulty) {
        // 真实 room NPC 物件在 carriedItems（materializeFacts/roomNpcs/attireSync 同口径），
        // carry 仅作卡牌数据末位兼容；暂取数组首件（确定性起步，后续可按珍惜度/随机选）。
        const carried = Array.isArray(target.carriedItems) ? target.carriedItems : [];
        const carry = (carried.length ? carried : (Array.isArray(target.carry) ? target.carry : []))
          // 已易手/掉落/卖出的物件记录仍挂在 carriedItems 上——过滤后再选，
          // 否则首件被取走后后续偷窃永远选到死记录。
          .filter((it) => it && it.name && !it.taken && !it.dropped && !it.sold);
        if (carry.length) {
          const item = carry[0];
          facts.push({
            id: nextFactId(), op: "TRANSFER_ITEM",
            itemId: item.id || "", itemName: item.name,
            from: target.name, to: "player", witnesses: ["主角"],
          });
          notes.push(`偷窃得手：${target.name}的「${item.name}」（检定${check.toFixed(1)}≥${difficulty}）`);
        } else {
          notes.push(`${target.name}身无一物，偷窃无获`);
        }
      } else {
        facts.push({
          id: nextFactId(), op: "MUTATE_SOCIAL", npc: target.name,
          affectionDelta: -6, ledgerKind: "怨", reason: "偷窃败露",
          witnesses: ["主角", target.name],
          anger: { active: true, reason: "偷窃败露", turnsLeft: 3 },
        });
        notes.push(`偷窃败露：${target.name}结怨（检定${check.toFixed(1)}<${difficulty}）`);
      }
      continue;
    }

    const npc = findNpc(npcs, action.target);
    if (!npc) continue;
    const aff = affectionOf(varTree, npc.name);
    const stance = action.stance || "casual";
    const stanceMod = stance === "sincere" ? 0.1 : stance === "perfunctory" ? -0.1 : stance === "forceful" ? -0.15 : 0;

    // 搭话：stance 映射确定性小额好感，不掷骰——闲聊不该有随机性社交风险。
    if (action.kind === "talk") {
      // 第一道防线：无好感轨道对象（兽类/intimacy.forbidden）判官直接不产社交事实——
      // findNpc 处本来就有对象，不必等 materialize 再拦。cannotSpeak 不算无轨道。
      // 注：谓词就地内联而非 import affection.js——affection→applyWrite→fields
      // 会循环依赖回本模块。口径与 hasNoAffectionTrack 一致：forbidden 或兽类。
      if (npc?.intimacy?.forbidden || npc?.beast) continue;
      const delta = TALK_STANCE_DELTA[action.stance] ?? 0;
      if (!delta) continue; // perfunctory/未知：零事实
      facts.push({
        id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
        affectionDelta: delta, ledgerKind: delta > 0 ? "恩" : "怨",
        reason: delta > 0 ? "搭话投机" : "言语冲撞", witnesses: ["主角", npc.name],
      });
      continue;
    }

    // 真白名单：talkOnly 回合只有 talk 进社交结算，其余 action（含 appease——
    // 不能随机 +3 漏进纯搭话）一律只留 notes，零物品/状态/好感搬动。
    if (talkOnly) {
      notes.push(`纯搭话回合不结算${action.kind}（${npc.name}），无物品/状态搬动`);
      continue;
    }

    if (action.kind === "give") {
      const item = inv.find((it) => it?.id === action.itemId || it?.name === action.itemId);
      if (isDeliverGive(action, item)) {
        notes.push(`${action.target}的${item?.name || "物件"}走任务交付通道结算，赠礼动作去重压制`);
        continue;
      }
      const prefer = giftPreference(npc);
      const preferHit = prefer && item?.category === prefer ? 0.15 : 0;
      const weight = item ? computeGiftWeight(npc, item) : null;
      const weightMod = weight?.ratio >= 2 ? 0.15 : weight?.ratio >= 1 ? 0.05 : -0.05;
      const score = 0.55 + personaMod(npc.personality) + affectionMod(aff) + preferHit + weightMod + stanceMod;
      if (roll() < Math.max(0.05, Math.min(0.95, score))) {
        anyAccepted = true;
        const wid = nextFactId();
        facts.push({
          id: wid, op: "TRANSFER_ITEM",
          itemId: item?.id || action.itemId || "", itemName: item?.name || action.itemId || "礼物",
          from: "player", to: npc.name, witnesses: ["主角", npc.name],
        });
        facts.push({
          id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
          affectionDelta: weight?.ratio >= 2 ? 6 : weight?.ratio >= 1 ? 4 : 2,
          ledgerKind: "恩", reason: `赠${item?.name || "礼"}`, witnesses: ["主角", npc.name],
        });
      } else {
        // 拒收不产扣物事实——物件还在玩家身上，彻底消灭错账
        notes.push(`${npc.name}拒收${item?.name || "礼物"}，物件未易主`);
      }
    }

    if (action.kind === "appease") {
      // WO-16F-F3：perfunctory 一票否决——敷衍赔罪不受理，零 facts 不掷骰。
      if (action.stance === "perfunctory") {
        notes.push(`${npc.name}面前几句敷衍，赔罪不受理（perfunctory 否决）`);
        continue;
      }
      const score = 0.5 + personaMod(npc.personality) + affectionMod(aff) + stanceMod;
      if (roll() < Math.max(0.05, Math.min(0.95, score))) {
        anyAccepted = true;
        facts.push({
          id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
          affectionDelta: 3, ledgerKind: "见", reason: "赔罪言和", witnesses: ["主角", npc.name],
          // WO-16F-F3：成功消气 + 消解对方最近一条未了「怨」（不删原文，只打标记）。
          angerRelease: true, grudgeResolve: true,
        });
      } else {
        notes.push(`${npc.name}余怒未消，赔罪未收下`);
      }
    }

    if (action.kind === "learn") {
      const score = 0.3 + affectionMod(aff) + personaMod(npc.personality) + stanceMod;
      if (roll() < Math.max(0.05, Math.min(0.9, score))) {
        anyAccepted = true;
        if (budget.allowSkillBestow) {
          const factId = nextFactId();
          const warrantId = `W${turn}_${++warrantSeq}`;
          facts.push({ id: factId, op: "BESTOW_SKILL", npc: npc.name, witnesses: ["主角", npc.name] });
          warrants.push({
            warrantId, factId, op: "BESTOW_SKILL",
            pointBudget: budget.maxPointBudget, allowedAffixes: [],
            origin: { turn, day, place, fromNpc: npc.name },
          });
        } else {
          facts.push({
            id: nextFactId(), op: "PROGRESS_CULTIVATION", npc: npc.name,
            potDelta: 2, reason: "指点一二", witnesses: ["主角", npc.name],
          });
          notes.push(`因果 tier ${budget.tier} 不足授技，降为点拨`);
        }
      } else {
        notes.push(`${npc.name}不肯传授`);
      }
    }
  }

  // ── 第三步：inspect_container 三关掷骰 ──
  // WO-16A：纯搭话回合不翻容器——搭话时翻箱倒柜本就不该发生，整段跳过。
  const proposals = Array.isArray(intakeResult.proposals) ? intakeResult.proposals : [];
  const collapsingThisTurn = new Set(); // WO-22A 本回合内翻过的容器——幂等去重
  for (const action of actions) {
    if (action.kind !== "inspect_container" || talkOnly) continue;
    const container = envelope.containers?.[action.target];
    if (container?.collapsed) {
      notes.push(`${action.target}已坍缩，翻不出新东西`);
      continue;
    }
    // WO-22A：目标是本房未声明的容器——不进入三关（第一关要有容器才能走），
    // 也不留坍缩记录（没容器可坍），只降级一句。
    if (!container) {
      notes.push(`${action.target || "那里"}没什么可翻的`);
      continue;
    }
    // WO-22A 容器坍缩：未定容器首次被翻，无论三关结局如何（预设/备料/券/残页），
    // 翻完即坍缩记为事实——之后绝不翻脸认账。坍缩事实延到本段末尾统一签发：
    // ① 同回合两次翻同一容器，第二次按已坍缩处理（防双份预设物）；
    // ② 回合记忆摘要取首条事实时看到的是「发现」而非「坍缩」。
    if (collapsingThisTurn.has(action.target)) {
      notes.push(`${action.target}已坍缩，翻不出新东西`);
      continue;
    }
    collapsingThisTurn.add(action.target);
    // 第一关：预设物（容器剧本里写死的东西，必中）
    const preset = Array.isArray(container?.presetItems) ? container.presetItems.filter((it) => it && !it.taken) : [];
    if (preset.length) {
      const item = preset[0];
      const factId = nextFactId();
      facts.push({
        id: factId, op: "GRANT_ITEM", itemId: item.id || "", itemName: item.name || "不明物件",
        // WO-22A：预设物详情（desc/quality/category/id）随事实下传——materialize
        // 兜底不再写成「来历成谜的物件」。
        ...(item.desc ? { desc: item.desc } : {}),
        ...(item.quality ? { quality: item.quality } : {}),
        ...(item.category ? { category: item.category } : {}),
        from: action.target, to: "player", witnesses: ["主角"],
      });
      notes.push(`${action.target}里翻出预设物「${item.name}」`);
      continue;
    }
    // 第二关：备料物（休整期备料池，有则直取一件）
    const prep = Array.isArray(envelope.prepItems) ? envelope.prepItems.filter((it) => it && !it.taken) : [];
    if (prep.length) {
      const item = prep[0];
      const factId = nextFactId();
      facts.push({
        id: factId, op: "GRANT_ITEM", itemId: item.id || "", itemName: item.name || "备料物件",
        from: action.target, to: "player", witnesses: ["主角"],
      });
      continue;
    }
    // 第三关：玩家 proposals——fit 档位 + 气运 + 悬空道具落点
    const luck = Number.isFinite(envelope.budget?.luck) ? envelope.budget.luck : 0;
    let granted = false;
    for (const proposal of proposals) {
      if (proposal.kind !== "find_item") continue;
      const gate = Math.max(0.05, (FIT_GATE[proposal.fit] ?? FIT_GATE.absurd) - luck * 0.03);
      if (roll() >= gate) continue;
      // 悬空道具落点：有悬空道具待落时优先落它，否则签发空白天机券
      const floating = Array.isArray(envelope.floatingItems)
        ? envelope.floatingItems.find((it) => it && !it.placed) : null;
      const factId = nextFactId();
      if (floating) {
        facts.push({
          id: factId, op: "GRANT_ITEM", itemId: floating.id || "", itemName: floating.name || "悬空之物",
          from: action.target, to: "player", witnesses: ["主角"],
        });
        granted = true;
        break;
      }
      if (budget.maxPointBudget <= 0 && QUALITY_ORDER.indexOf(budget.maxQuality) <= 0) {
        continue; // 额度归零，连白档都发不出——留待降级
      }
      // WO-16E：品阶按 resolveWarrantQuality 掷骰裁定（GM 红/配额尽白/否则按
      // fit+气运概率取 maxQuality 或降一档），品类按 inferCategoryFromClaim
      // 从玩家声称原话推断——不再固定白阶 misc。
      const quality = resolveWarrantQuality(budget, proposal, luck, roll());
      const category = inferCategoryFromClaim(proposal.claim);
      const warrantId = `W${turn}_${++warrantSeq}`;
      facts.push({ id: factId, op: "GRANT_ITEM", from: action.target, to: "player", witnesses: ["主角"] });
      warrants.push({
        warrantId, factId, op: "GRANT_ITEM",
        category, quality,
        pointBudget: budget.maxPointBudget,
        allowedAffixes: allowedAffixesForBudget(category, budget.maxPointBudget),
        origin: { turn, day, place, fromNpc: "" },
      });
      granted = true;
      break;
    }
    if (!granted) {
      // 不达标降级：残页线索——不给实物，只给一条往后的线头
      const clue = `${action.target}里只翻出一角残页，字迹模糊，似乎指向别处`;
      facts.push({
        id: nextFactId(), op: "ALTER_WORLD_SCENE", place,
        sceneKey: place, key: "clue", value: clue,
        detail: clue,
        witnesses: ["主角"],
      });
      notes.push(`${action.target}无所获，降级为残页线索`);
    }
  }
  // 坍缩事实统一段尾签发（理由见上）：每个本回合翻过的容器一条。
  for (const name of collapsingThisTurn) {
    facts.push({
      id: nextFactId(), op: "COLLAPSE_CONTAINER", place: envelope.containerPlace || place,
      containerName: name, witnesses: ["主角"],
    });
  }

  // ── B1 任务推进扩展律：quest_advance 白名单核验 ──
  // 候选只能由系统 helper（questAdvanceCandidates）现场生成并进 envelope；
  // 小模型提议的 questId+flag 必须精确命中本轮候选，自编/提前阶段/错地点一律
  // 安静丢弃——叙事到位判定归 intake 提议，上下文合法性归判官裁决。
  const questCandidates = Array.isArray(envelope.questCandidates) ? envelope.questCandidates : [];
  const signedQuestFlags = new Set();
  for (const proposal of proposals) {
    if (proposal?.kind !== "quest_advance") continue;
    const hit = questCandidates.find((c) => c.questId === proposal.questId && c.flag === proposal.flag);
    if (!hit) {
      notes.push(`任务推进提议未过白名单（${proposal.questId || "?"}/${proposal.flag || "?"}），丢弃`);
      continue;
    }
    if (signedQuestFlags.has(hit.flag)) continue;
    signedQuestFlags.add(hit.flag);
    facts.push({
      id: nextFactId(), op: "ADVANCE_QUEST",
      questId: hit.questId, flag: hit.flag, questTitle: hit.title,
      // 「主角」是判官全链统一的系统主角代号（talk/give/sealVerifier 同口径），不用玩家实名
      witnesses: ["主角"],
    });
  }

  // ── WO-16C 移动拾取条件券：rollMovementEvents 系统掷中的路遇拾取，只签空白
  // 条件券（quality/category 系统硬账锁进 warrant，模型碰不到）——不进 facts。
  // 双证据齐备才落账：正文落实处埋 ⟦Fid⟧ 锚点 + 尾章 fill 可编译；叙事此刻
  // 不宜捡（被盯着/险境）就不埋锚不填空，券自然作废零落账——拒捡权归叙事、
  // 数值权归系统，与器物天机券同口径。迁移期 pointBudget=0/无词条，保持旧
  // 移动拾取本无词条的行为；预算整合归后续工单。
  if (!talkOnly && envelope.pickupJudgment) {
    const j = envelope.pickupJudgment;
    const factId = nextFactId();
    const warrantId = `W${turn}_${++warrantSeq}`;
    warrants.push({
      warrantId, factId, op: "GRANT_ITEM", conditional: true,
      category: j.category || "misc", quality: j.quality || "白",
      pointBudget: 0, allowedAffixes: [],
      origin: { turn, day, place, fromNpc: "" },
    });
    notes.push(`路遇拾取条件券 ${warrantId}：品质「${j.quality}」类别「${j.category}」系统锁定，正文埋锚+尾章填空双证据齐备才落账`);
  }

  // ── 第四步：签发 JudgeVerdict（契约 C） ──
  return {
    causalTier: budget.tier,
    pacingWords: Number.isInteger(envelope.pacingWords) ? envelope.pacingWords : 320,
    facts,
    warrants,
    allowSpontaneousPact: anyAccepted || budget.tier !== "T0",
    reactionGuides,
    notes,
    budget: {
      maxQuality: budget.maxQuality,
      maxPointBudget: budget.maxPointBudget,
      remainingDailyQuota: budget.remainingDailyQuota,
    },
  };
}

// @判官定案单 引用渲染：铁案与天机券的紧凑清单，供叙事模型照本写正文。
export function renderJudgeVerdict(verdict) {
  if (!verdict || typeof verdict !== "object") return "";
  const lines = [`因果档 ${verdict.causalTier || "T0"}，目标篇幅约 ${verdict.pacingWords ?? 320} 字`];
  for (const fact of verdict.facts || []) {
    lines.push(`⟦${fact.id}⟧${fact.op}${fact.itemName ? `·${fact.itemName}` : ""}${fact.npc ? `·${fact.npc}` : ""}${fact.detail ? `·${fact.detail}` : ""}`);
  }
  for (const warrant of verdict.warrants || []) {
    if (warrant.conditional) {
      lines.push(`⟦${warrant.factId}⟧条件拾取券/⟦${warrant.warrantId}⟧ GRANT_ITEM（品质「${warrant.quality}」/类别「${warrant.category}」系统锁定）：若写拾取，须在落实处埋 ⟦${warrant.factId}⟧ 并在尾章 fills 填名；若此刻不宜拾取，忽略此券即可（券自动作废，不会在正文外硬塞）。`);
    } else {
      lines.push(`⟦${warrant.warrantId}⟧空白天机券 ${warrant.op}（${warrant.pointBudget} 点，待尾章填名）`);
    }
  }
  for (const note of verdict.notes || []) lines.push(`注：${note}`);
  return lines.join("\n");
}

// @因果授信 引用渲染：本拍额度一行。
export function renderCausalBudget(budget) {
  if (!budget || typeof budget !== "object") return "";
  return `本拍授信：品阶上限${budget.maxQuality || "白"}，词条点数 ${budget.maxPointBudget ?? 0}，今日搜刮余量 ${budget.remainingDailyQuota ?? 0}`;
}

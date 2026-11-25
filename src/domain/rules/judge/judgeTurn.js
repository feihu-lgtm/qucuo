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
import { resolveFreeActExpense, parseStatedExpense } from "./freeActPricing.js";
import { resolveWarrantQuality, inferCategoryFromClaim } from "./warrantRules.js";
import { allowedAffixesForBudget } from "../effects/affixPointTable.js";
import { giftPreference, computeGiftWeight } from "../npc/giftWeight.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";

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
  const signedRestKeys = new Set();
  const signedFreeActGainKeys = new Set(); // WO-16F-F1 本 verdict 调息去重
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
  // S3 破费查价链修订：同一回合内 得财/破费 按签发顺序累计流水余额，
  // 先赚后花不再被开场余额误卡（materialize 按 facts 顺序落账，此处同序预演）。
  let freeActMoneyRun = envelope.char?.money ?? 0;
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
        // S3 得财放宽：不再要求 fit 合格 proposal——按 tier 查表直签；
        // natural proposal 取上半区间；fit absurd 不签；
        // 同一游戏时辰 free_act 得财只签一次（varTree.世界.每日搜刮.freeActGain 同账本另键）。
        const absurd = proposalsPre.some((pp) => pp && pp.fit === "absurd");
        if (absurd) { notes.push("得财 proposal 离谱（absurd），不签发"); continue; }
        const gainKey = `freeActGain_${Math.floor(turn / 2)}`;
        const ledger = varTree?.世界?.每日搜刮 || {};
        const gainDone = (ledger.freeActGain || []).includes(gainKey) || signedFreeActGainKeys.has(gainKey);
        if (gainDone) { notes.push("本时辰已签得财，幂等跳过"); continue; }
        signedFreeActGainKeys.add(gainKey);
        const ranges = [[2, 10], [10, 40], [40, 120]][tierRank];
        const natural = proposalsPre.some((pp) => pp && pp.fit === "natural");
        // natural 取上半区间：lo' = lo + ceil((hi-lo)/2)
        const lo = natural ? ranges[0] + Math.ceil((ranges[1] - ranges[0]) / 2) : ranges[0];
        const amt = lo + Math.floor(roll() * (ranges[1] - lo + 1));
        facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: amt, gainKey, witnesses: wit });
        freeActMoneyRun += amt;
        notes.push(`得财签发：+${amt} 银两（tier ${budget.tier}${natural ? "，natural上半" : ""}）`);
      } else if (outcome === "破费") {
        // S3 破费查价链：原话写数额按原话；没写依次查 驻场货架同名/同类价 →
        // 物件志 → priceForQuality(category,"白")；都查不到按 risk 默认 无2/低5/中10/高20。
        // 超囊中只扣到零并 notes 囊中不足。
        const stated = parseStatedExpense(action.text);
        let amt = 0;
        let source = "原话";
        if (stated != null) {
          amt = stated;
        } else {
          // category 只在目标物能确定时传入（背包实证）；item 为无/查无实证传空——
          // 服务/请客/打点不得默认套 misc 白档，应落 risk 默认（调度初审口径）。
          const invHit = action.item && action.item !== "无" ? (envelope.inv || []).find((e) => e && e.name === action.item) : null;
          const cat = invHit?.category || "";
          const hit = resolveFreeActExpense({
            text: String(action.text || ""),
            itemName: action.item && action.item !== "无" ? action.item : "",
            category: cat,
            presentNpcNames: (envelope.npcs || []).map((n) => n?.name).filter(Boolean),
          });
          if (hit) {
            amt = hit.price;
            source = hit.source;
          } else {
            amt = { 无: 2, 低: 5, 中: 10, 高: 20 }[risk] ?? 2;
            source = `risk默认(${risk})`;
          }
        }
        if (!(amt > 0)) { notes.push("破费查价为零，不签发"); continue; }
        let clampNote = "";
        if (amt > freeActMoneyRun) {
          if (!(freeActMoneyRun > 0)) { notes.push("囊中原已空空，破费无从扣起，不签发"); continue; }
          amt = freeActMoneyRun;
          clampNote = "，囊中不足只扣到零";
        }
        facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -amt, witnesses: wit });
        freeActMoneyRun -= amt;
        notes.push(`破费签发：-${amt} 银两（${source}${clampNote}）`);
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
      // WO-16F-F4a：字符串背包条目（初始存档遗产形态，如「半袋青稞」）也要能找到——
      // 只认对象 id/name 会让按钮 defer 的礼物判官查无此物，重量/偏好全空。
      const item = inv.find((it) => (typeof it === "string"
        ? it === action.itemId
        : it?.id === action.itemId || it?.name === action.itemId));
      // 重量/偏好/交付判定读对象形状——字符串条目规范化（目录属性并入，无目录裸名兜底），
      // 不改写 item 本体（TRANSFER 寻址仍走 action.itemId/item.id 原口径）。
      const itemObj = typeof item === "string"
        ? { name: item, ...(CATALOG_INDEX[item] || {}) }
        : item;
      if (isDeliverGive(action, itemObj)) {
        notes.push(`${action.target}的${item?.name || "物件"}走任务交付通道结算，赠礼动作去重压制`);
        continue;
      }
      const prefer = giftPreference(npc);
      const preferHit = prefer && itemObj?.category === prefer ? 0.15 : 0;
      const weight = itemObj ? computeGiftWeight(npc, itemObj) : null;
      const weightMod = weight?.ratio >= 2 ? 0.15 : weight?.ratio >= 1 ? 0.05 : -0.05;
      const score = 0.55 + personaMod(npc.personality) + affectionMod(aff) + preferHit + weightMod + stanceMod;
      if (roll() < Math.max(0.05, Math.min(0.95, score))) {
        anyAccepted = true;
        const wid = nextFactId();
        facts.push({
          id: wid, op: "TRANSFER_ITEM",
          itemId: (item && typeof item === "object" ? item.id : null) || action.itemId || "",
          itemName: itemObj?.name || action.itemId || "礼物",
          from: "player", to: npc.name, witnesses: ["主角", npc.name],
        });
        // WO-16F-F4a：无好感轨道对象（兽类/intimacy.forbidden）只收物不涨好感——
        // 与 legacy giftNpc 的 hasNoAffectionTrack 口径一致（谓词内联同 talk 分支，防循环依赖）。
        if (!(npc?.intimacy?.forbidden || npc?.beast)) {
          facts.push({
            id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
            affectionDelta: weight?.ratio >= 2 ? 6 : weight?.ratio >= 1 ? 4 : 2,
            ledgerKind: "恩", reason: `赠${itemObj?.name || "礼"}`, witnesses: ["主角", npc.name],
          });
        }
      } else {
        // 拒收不产扣物事实——物件还在玩家身上，彻底消灭错账
        notes.push(`${npc.name}拒收${itemObj?.name || "礼物"}，物件未易主`);
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
          // WO-16F-F3：detail 明示正文方向——renderJudgeVerdict 逐字渲染进定案单，
          // 主叙事不得写成余怒未消。
          detail: "赔罪奏效，怒气消解，好感回暖",
          // WO-16F-F3：成功消气 + 消解对方最近一条未了「怨」（不删原文，只打标记）。
          angerRelease: true, grudgeResolve: true,
        });
      } else {
        notes.push(`${npc.name}余怒未消，赔罪未收下`);
      }
    }

    if (action.kind === "learn") {
      // WO-16F-F4b 按钮求教「直签转写」：learnRequest 在场即 feature 门规/束脩已裁，
      // 不二次掷骰——否则会出现「按钮说愿教、判官掷成不肯」双裁决打架。
      // 自由文本 learn（无 learnRequest）维持下方裁量/天机券/降级口径不变。
      const lreq = action.learnRequest;
      if (lreq && typeof lreq === "object" && Array.isArray(lreq.freshSkills)) {
        // 防御性原子口径（返修）：正常按钮路径 feature 已验资，但信封银两不足时
        // 整批零 facts——不得出现技能照得但银两只扣部分的半落账。
        const moneyNow = Number(envelope.char?.money ?? 0);
        if (Number.isFinite(lreq.totalPrice) && lreq.totalPrice > 0 && moneyNow < lreq.totalPrice) {
          notes.push(`束脩不足，授业未成（需银${lreq.totalPrice}两，现有${moneyNow}两）`);
          continue;
        }
        anyAccepted = true;
        facts.push({
          id: nextFactId(), op: "BESTOW_SKILL", npc: npc.name,
          // 直接携带 feature 确定的招式目录快照——不走天机券自由填名（绝学有固定招式表）
          skills: lreq.freshSkills.map((sk) => ({ ...sk })),
          detail: `倾囊相授「${lreq.moveBrief || "所学"}」`,
          witnesses: ["主角", npc.name],
        });
        if (Number.isFinite(lreq.totalPrice) && lreq.totalPrice > 0) {
          facts.push({
            id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -lreq.totalPrice,
            detail: `束脩银${lreq.totalPrice}两`, witnesses: ["主角", npc.name],
          });
        }
        // 无好感轨道（兽类/intimacy.forbidden）不签好感——内联谓词与 give 分支同口径
        if (!(npc?.intimacy?.forbidden || npc?.beast)) {
          facts.push({
            id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
            affectionDelta: lreq.isMaster ? 6 : 3,
            ledgerKind: "恩", reason: "授业传艺", witnesses: ["主角", npc.name],
          });
        }
        continue;
      }
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
  const freshCollapseThisTurn = new Set(); // WO-22B-P2 本回合「首次」坍缩的容器（relicOnly 重翻已坍缩不再签）
  // WO-22B-P2：本 verdict 内已签出的悬空秘宝登记 id——同回合多容器/多行动命中时
  // 世间无第二件，第二条不得再签真品（materialize 唯一锁是落账后验，正文定案单必须先唯一）。
  const signedFloatingIds = new Set();
  for (const action of actions) {
    if (action.kind !== "inspect_container" || talkOnly) continue;
    const container = envelope.containers?.[action.target];
    // WO-22B-P2 裁决：悬空秘宝是地域级落点事件而非容器普通内容物——容器坍缩只封锁
    // 普通内容（预设/备料/天机券/通用残页），不封锁未定秘宝：有秘宝在视野时
    // 已坍缩容器仍可翻，但只走第三关秘宝落点判定（relicOnly），普通关全跳。
    const floatingAvail = Array.isArray(envelope.floatingItems)
      ? envelope.floatingItems.find((it) => it && !it.placed && !signedFloatingIds.has(it.id)) : null;
    const relicOnly = !!container?.collapsed && !!floatingAvail;
    if (container?.collapsed && !relicOnly) {
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
    // 已坍缩进 relicOnly 的不再重复签 COLLAPSE 事实（本就是坍缩态）。
    if (!container?.collapsed) freshCollapseThisTurn.add(action.target);
    // 第一关：预设物（容器剧本里写死的东西，必中）——relicOnly 跳过
    const preset = !relicOnly && Array.isArray(container?.presetItems) ? container.presetItems.filter((it) => it && !it.taken) : [];
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
    // WO-24E 初审裁决：必须 exact containerId 匹配当前翻的容器——不匹配不能取
    // prep[0]（否则书桌能翻出铁柜草案，containerId 契约失效），落入后续 proposals/降级。
    const prep = relicOnly ? [] : (Array.isArray(envelope.prepItems) ? envelope.prepItems.filter((it) => it && !it.taken && String(it.containerId || "") === String(action.target || "")) : []);
    if (prep.length) {
      const item = prep[0];
      const factId = nextFactId();
      // WO-24E 终审 blocker 修：备料物仍按 CausalBudget 二次钳制——quality 按
      // budget.maxQuality 降档封顶（额度尽白/低档不能出高阶，备料不是法外之地）；
      // quality/category 透传、clue 拼 desc——materialize 兜底不再落成「来历成谜的物件」。
      const maxRank = QUALITY_ORDER.indexOf(budget.maxQuality || "白");
      const itemRank = QUALITY_ORDER.indexOf(item.quality || "白");
      const clamped = QUALITY_ORDER[Math.max(0, Math.min(itemRank < 0 ? 0 : itemRank, maxRank < 0 ? 0 : maxRank))];
      facts.push({
        id: factId, op: "GRANT_ITEM", itemId: item.id || "", itemName: item.name || "备料物件",
        quality: clamped,
        ...(item.category ? { category: item.category } : {}),
        ...(item.clue ? { desc: item.clue } : {}),
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
        ? envelope.floatingItems.find((it) => it && !it.placed && !signedFloatingIds.has(it.id)) : null;
      const factId = nextFactId();
      if (floating) {
        signedFloatingIds.add(floating.id);
        facts.push({
          id: factId, op: "GRANT_ITEM", itemId: floating.id || "", itemName: floating.name || "悬空之物",
          // WO-22B-P2：真品详情随事实下传（与预设物同口径）——materialize 兜底不写
          // 「来历成谜」；itemId 即登记表 id，materializeFacts 据此写 placed/唯一锁。
          ...(floating.desc ? { desc: floating.desc } : {}),
          ...(floating.quality ? { quality: floating.quality } : {}),
          ...(floating.category ? { category: floating.category } : {}),
          from: action.target, to: "player", witnesses: ["主角"],
        });
        notes.push(`${action.target}里竟翻出传说中的「${floating.name}」——悬空秘宝落定，世间再无第二件`);
        granted = true;
        break;
      }
      if (relicOnly) continue; // 坍缩落点判定不产天机券——只认秘宝
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
      // WO-22B-P2 差一截降级（阈值沿用现有「未达标即降级」语义，不新造玄学）：
      // 本地域有未定悬空秘宝时，降级不止一句空话——真落一页残页实物
      // （GRANT_ITEM 残页，非神兵不占天机券），notes 批注真品去向线头；
      // 无秘宝在视野时维持原 ALTER_WORLD_SCENE 通用降级不变。
      const floatingInScope = Array.isArray(envelope.floatingItems)
        ? envelope.floatingItems.find((it) => it && !it.placed && !signedFloatingIds.has(it.id)) : null;
      const signedElsewhere = Array.isArray(envelope.floatingItems)
        ? envelope.floatingItems.find((it) => it && !it.placed && signedFloatingIds.has(it.id)) : null;
      if (!floatingInScope && signedElsewhere) {
        notes.push(`${action.target}翻不出真品——「${signedElsewhere.name}」本回合已另有落点，同一落点不可复制`);
      }
      // 残页是「差一截」降级——前提是玩家真声称了要找什么（find_item proposal）
      // 且掷骰未过；无声称的纯翻找不掷骰不掉残页（否则已坍缩容器可无限白刷残页）。
      const claimedFind = proposals.some((p) => p && p.kind === "find_item");
      if (floatingInScope && claimedFind) {
        facts.push({
          id: nextFactId(), op: "GRANT_ITEM",
          itemId: `fragment_${floatingInScope.id}`, itemName: "残页",
          quality: "白", category: "misc",
          desc: `一角残页，字迹模糊，隐约是「${floatingInScope.name}」相关的零碎记载——气机未合，真品仍未落定。`,
          from: action.target, to: "player", witnesses: ["主角"],
        });
        notes.push(`${action.target}差一截——只翻出残页，真品「${floatingInScope.name}」去向线头：${floatingInScope.hint || "别处"}`);
      } else if (floatingInScope && !claimedFind && relicOnly) {
        notes.push(`${action.target}里翻不出新东西——隐约有股气机未合，似有异物未定`);
      } else {
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
  }
  // 坍缩事实统一段尾签发（理由见上）：每个本回合翻过的容器一条。
  for (const name of freshCollapseThisTurn) {
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

  // ── 履约核验（WO-22B-P3）：判官只在「玩家行为客观满足 promise 且对象 NPC 在场」
  // 时签 settle——严禁模型正文自证，证据只取本 verdict 已签硬事实/在场名册/当前地。
  // 窄规则最小类：
  //   A 交付/送还某物：本回合已签 TRANSFER_ITEM player→该 NPC，且 promise 含该物名；
  //   B 到达/在场重逢：promise 含当前据点名（≥2 字）且 NPC 在场。
  // 违约 breachTurn 不签（P1 已罚）；无法结构化核验的 promise 不签，notes 留痕。
  const pactsByNpc = varTree?.世界?.契约 || {};
  for (const [pactNpc, byKey] of Object.entries(pactsByNpc)) {
    if (!byKey || typeof byKey !== "object") continue;
    const npcObj = findNpc(npcs, pactNpc);
    for (const [pactKey, pact] of Object.entries(byKey)) {
      if (!pact || typeof pact !== "object" || !pact.promise) continue;
      if (pact.settled) continue;
      if (pact.breachTurn != null) continue; // 违约后不可再履约（P1 口径）
      if (!npcObj) continue; // 不在场不裁——notes 都不留，避免每轮刷屏
      if (talkOnly) continue; // 纯搭话回合零硬事实，履约无从谈起
      const promise = String(pact.promise);
      let fulfilled = false;
      let evidence = "";
      // A 交付/送还：本 verdict 已签的 TRANSFER_ITEM player→pactNpc
      for (const f of facts) {
        if (f.op !== "TRANSFER_ITEM" || f.to !== pactNpc) continue;
        const invHit = (inv || []).find((it) => it && typeof it === "object" && it.id && it.id === f.itemId);
        const itemName = f.itemName || invHit?.name || "";
        if (itemName && itemName.length >= 2 && promise.includes(itemName)) {
          fulfilled = true;
          evidence = `交付「${itemName}」`;
          break;
        }
      }
      // B 类「到达/在场重逢」已按初审裁决删除——promise 含地名过宽
      // （「去贡措海取回剑谱」在贡措海做任何事都会误履约），宁可 false negative。
      if (fulfilled) {
        facts.push({
          id: nextFactId(), op: "BIND_OR_SETTLE_PACT", npc: pactNpc,
          settle: true, settleKey: pactKey,
          note: `履约：${evidence}`, witnesses: ["主角", pactNpc],
        });
        notes.push(`履约核验通过：${pactNpc}「${promise.slice(0, 18)}」（${evidence}）——签 settle`);
      } else {
        notes.push(`履约无法核验不签：${pactNpc}「${promise.slice(0, 18)}」——非交付/重逢可核验类或无本回合硬证据`);
      }
    }
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

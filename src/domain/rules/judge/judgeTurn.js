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
import { allowedAffixesForBudget } from "../effects/affixPointTable.js";
import { giftPreference, computeGiftWeight } from "../npc/giftWeight.js";

const QUALITY_ORDER = ["白", "绿", "蓝", "紫", "橙", "红"];

function capQuality(quality, maxQuality) {
  const qi = QUALITY_ORDER.indexOf(quality);
  const mi = QUALITY_ORDER.indexOf(maxQuality);
  if (qi < 0) return maxQuality;
  return QUALITY_ORDER[Math.min(qi, mi < 0 ? QUALITY_ORDER.length - 1 : mi)];
}

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
  const actions = Array.isArray(intakeResult.actions) ? intakeResult.actions : [];
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
        affectionDelta: delta, ledgerKind: delta > 0 ? "谊" : "隙",
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
      const score = 0.5 + personaMod(npc.personality) + affectionMod(aff) + stanceMod;
      if (roll() < Math.max(0.05, Math.min(0.95, score))) {
        anyAccepted = true;
        facts.push({
          id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
          affectionDelta: 3, ledgerKind: "和", reason: "赔罪言和", witnesses: ["主角", npc.name],
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
    // 翻完即坍缩记为事实——之后绝不翻脸认账。
    facts.push({
      id: nextFactId(), op: "COLLAPSE_CONTAINER", place: envelope.containerPlace || place,
      containerName: action.target, witnesses: ["主角"],
    });
    // 第一关：预设物（容器剧本里写死的东西，必中）
    const preset = Array.isArray(container?.presetItems) ? container.presetItems.filter((it) => it && !it.taken) : [];
    if (preset.length) {
      const item = preset[0];
      const factId = nextFactId();
      facts.push({
        id: factId, op: "GRANT_ITEM", itemId: item.id || "", itemName: item.name || "不明物件",
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
      const warrantId = `W${turn}_${++warrantSeq}`;
      facts.push({ id: factId, op: "GRANT_ITEM", from: action.target, to: "player", witnesses: ["主角"] });
      warrants.push({
        warrantId, factId, op: "GRANT_ITEM",
        category: "misc", quality: capQuality("白", budget.maxQuality),
        pointBudget: budget.maxPointBudget,
        allowedAffixes: allowedAffixesForBudget("misc", budget.maxPointBudget),
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

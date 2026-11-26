// ── inspect_container 三关掷骰（S4 纯搬家：原 judgeTurn.js 第三步原样移入）──
// 预设物 → 备料物 → 玩家 proposals（fit 档位 + 气运 + 悬空道具落点，不达标降级残页线索）。
import { QUALITY_ORDER, FIT_GATE } from "./shared.js";
import { computeNpcAlertness } from "../../world/containers.js";
import { hasNoAffectionTrack } from "../../npc/npcTrack.js";
import { resolveWarrantQuality, inferCategoryFromClaim } from "../warrantRules.js";
import { allowedAffixesForBudget } from "../../effects/affixPointTable.js";

export function processInspectContainers(J, actions) {
  const { envelope, roll, turn, day, place, budget, facts, warrants, notes, nextFactId, nextWarrantId, talkOnly, proposals } = J;
  const collapsingThisTurn = new Set(); // WO-22A 本回合内翻过的容器——幂等去重
  const freshCollapseThisTurn = new Set(); // WO-22B-P2 本回合「首次」坍缩的容器（relicOnly 重翻已坍缩不再签）
  // WO-22B-P2：本 verdict 内已签出的悬空秘宝登记 id——同回合多容器/多行动命中时
  // 世间无第二件，第二条不得再签真品（materialize 唯一锁是落账后验，正文定案单必须先唯一）。
  const signedFloatingIds = new Set();
  for (let action of actions) {
    if (action.kind !== "inspect_container" || talkOnly) continue;
    // D2 坑⑥：前哨渲染带「(有主:X)」括注，小模型可能连括号抄进 target——入口先清洗
    const targetName = String(action.target || "").replace(/[（(](?:户主|有主)[:：][^）)]+[）)]$/, "").trim();
    action = { ...action, target: targetName };
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
    // ── D2 翻箱目击检定（每只容器每回合只检一次）──
    // owner 在场：玩家身法+智谋+roll(0-5) vs computeNpcAlertness——失败被撞破记怨扣好感；
    // owner 不在场但有旁观者在场：记「见」不扣好感（materialize 补好感建档）。
    if (!container?.collapsed) {
      const owner = typeof container?.owner === "string" ? container.owner : "";
      const present = Array.isArray(J.npcs) ? J.npcs : [];
      const ownerNpc = owner ? present.find((n) => n?.name === owner) : null;
      if (ownerNpc) {
        const charSpecial = envelope?.char?.special || {};
        const playerScore = (Number(charSpecial?.身法) || 5) + (Number(charSpecial?.智谋) || 5) + Math.floor(roll() * 6);
        if (playerScore < computeNpcAlertness(ownerNpc)) {
          facts.push({
            id: nextFactId(), op: "MUTATE_SOCIAL", npc: owner,
            affectionDelta: -3, ledgerKind: "怨", reason: "当面乱翻" + targetName,
            witnesses: ["主角", owner],
          });
          notes.push(`翻动「${targetName}」时手法不够利落，被在场的${owner}当场撞见，对方神色不悦（好感 -3，记怨一笔）。`);
        } else {
          notes.push(`趁${owner}不备悄声翻看「${targetName}」，未被察觉，正文须写出暗中遮掩的分寸，不得写对方看见。`);
        }
      } else if (owner) {
        // owner 不在场——旁观者记「见」：排除 owner 本人/灵兽无好感轨道者/出战同伴
        const witness = present.find((n) => n && n.name && n.name !== owner
          && !hasNoAffectionTrack(n) && n.companion !== true);
        if (witness) {
          facts.push({
            id: nextFactId(), op: "MUTATE_SOCIAL", npc: witness.name,
            affectionDelta: 0, ledgerKind: "见", reason: "撞见翻动" + owner + "的" + targetName,
            witnesses: ["主角", witness.name],
          });
          notes.push(`原主${owner}不在，但一旁的${witness.name}将你翻动「${targetName}」看在眼里（不扣好感，记见一笔）。`);
        }
      }
    }
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
      const warrantId = nextWarrantId();
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
      } else if (container?.isTemplate) {
        // D2 模板容器兜底三档：65% 空（只坍缩）、25% 白档寻常杂物空白天机券
        // （受今日搜刮余量约束）、10% 环境琐碎线索。显式声明剧本房维持原残页行为。
        const rollVal = roll();
        if (rollVal < 0.65) {
          notes.push(`「${targetName}」翻遍了也只有积灰与寻常杂碎，并无值得入囊之物，已记坍缩。`);
        } else if (rollVal < 0.90 && (budget.remainingDailyQuota ?? 0) > 0) {
          const factId = nextFactId();
          facts.push({ id: factId, op: "GRANT_ITEM", from: action.target, to: "player", witnesses: ["主角"] });
          warrants.push({
            warrantId: nextWarrantId(), factId, op: "GRANT_ITEM",
            category: "misc", quality: "白",
            pointBudget: 0,
            allowedAffixes: [],
            origin: { turn, day, place, fromNpc: "" },
          });
          notes.push(`「${targetName}」里翻出一件寻常杂物（白档空白天机券，无词条点数）`);
        } else {
          const clue = `${action.target}里只翻出一角残页，字迹模糊，似乎指向别处`;
          facts.push({
            id: nextFactId(), op: "ALTER_WORLD_SCENE", place,
            sceneKey: place, key: "clue", value: clue,
            detail: clue,
            witnesses: ["主角"],
          });
          notes.push(`${action.target}无所获，降级为残页线索`);
        }
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
}

// ── free_act 按 outcome+risk 查表签发（S4 纯搬家：原 judgeTurn.js free_act 分支原样移入）──
// 检定/区间随机只用传入 rng；公式见 docs/PR：伤损 -maxHp×{低.05,中.12,高.25}、
// 身法/体魄检定（attr+rng()×6 ≥ 6）减半；得财 T0 2-10/T1 10-40/T2 40-120 且须
// 有 fit 非 absurd 的对应 proposal；调息同时辰幂等；修习按 tier 定 potDelta。
import { resolveFreeActExpense, parseStatedExpense } from "../freeActPricing.js";
import { classifyRoomNature } from "../../world/containers.js";
import { getInnerRoom } from "../../map/innerMap.js";
import { getHomestead } from "../../map/homestead.js";

export function handleFreeAct(J, action) {
  const { envelope, roll, turn, budget, facts, notes, nextFactId, talkOnly, varTree, proposalsPre, signedRestKeys, signedFreeActGainKeys } = J;
  if (talkOnly) { notes.push(`纯搭话回合不结算free_act`); return; }
  const outcome = action.outcome || "无";
  const risk = action.risk || "无";
  const ch = envelope.char || {};
  const sp = ch.special || {};
  const maxHp = Array.isArray(ch.hp) ? (ch.hp[1] ?? 100) : 100;
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
    if (absurd) { notes.push("得财 proposal 离谱（absurd），不签发"); return; }
    const gainKey = `freeActGain_${Math.floor(turn / 2)}`;
    const ledger = varTree?.世界?.每日搜刮 || {};
    const gainDone = (ledger.freeActGain || []).includes(gainKey) || signedFreeActGainKeys.has(gainKey);
    if (gainDone) { notes.push("本时辰已签得财，幂等跳过"); return; }
    signedFreeActGainKeys.add(gainKey);
    const ranges = [[2, 10], [10, 40], [40, 120]][tierRank];
    const natural = proposalsPre.some((pp) => pp && pp.fit === "natural");
    // natural 取上半区间：lo' = lo + ceil((hi-lo)/2)
    const lo = natural ? ranges[0] + Math.ceil((ranges[1] - ranges[0]) / 2) : ranges[0];
    const amt = lo + Math.floor(roll() * (ranges[1] - lo + 1));
    facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: amt, gainKey, witnesses: wit });
    J.money.run += amt;
    notes.push(`得财签发：+${amt} 银两（tier ${budget.tier}${natural ? "，natural上半" : ""}）`);
  } else if (outcome === "破费") {
    // V2 无消费对象扣银拦截（R04/R24）：既无在场收款人（target 指名在场 NPC）
    // 也无消费场所（商号/茶馆/酒肆/客栈/饭馆/杂货/店铺摊位类）时直接拒决——
    // 不让说书人编造「银子掉河里」强行扣钱。
    const targetNpc = action.target && action.target !== "无"
      ? (envelope.npcs || []).find((n) => n?.name === action.target) : null;
    // Review修：场所判定走 classifyRoomNature 建筑类型准确口径（歇马居=客栈类型
    // 但名不带商号茶馆字样），类型查不到再落名字正则兜底。
    const rn = envelope.roomName || envelope.place || "";
    const irn = envelope.innerRoomName || "";
    // 仅内层房用建筑类型判定——外层房间（村口/广场）的据点级类型会误把整村当商铺。
    const innerDef = irn ? getInnerRoom(rn, irn) : null;
    const nature = irn ? classifyRoomNature({ districtName: rn, innerRoomName: irn, innerDef }) : "";
    const placeText = `${envelope.place || ""}${rn}${irn}`;
    const COMMERCE_RE = /商号|茶馆|酒肆|客栈|饭馆|杂货|商铺|店|摊|市|当铺|钱庄|驿站|赌/;
    // Review修：私家厨房/居所不算消费场所——灶房虽 food 类（KITCHEN 建筑型）但是
    // 玩家自家或私宅，无商户在内，targetless 破费照样拒决。
    // 私宅口径与 containers 对齐：privateHome 旗标/玩家家园覆盖——不套名字正则，
    // 否则歇马居（客栈）带「居」字被误归私宅。food/shop 类型私厨由这两条兜住。
    const privateHome = irn && (innerDef?.privateHome === true || getHomestead(irn));
    const isCommerce = !privateHome && (nature === "food" || nature === "shop" || COMMERCE_RE.test(placeText));
    if (!targetNpc && !isCommerce) {
      notes.push("破费无消费对象（收款人不在场、此处亦非商铺），拒决扣银");
      return;
    }
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
    if (!(amt > 0)) { notes.push("破费查价为零，不签发"); return; }
    let clampNote = "";
    if (amt > J.money.run) {
      if (!(J.money.run > 0)) { notes.push("囊中原已空空，破费无从扣起，不签发"); return; }
      amt = J.money.run;
      clampNote = "，囊中不足只扣到零";
    }
    facts.push({ id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -amt, witnesses: wit });
    J.money.run -= amt;
    // 协调裁决口径：破费=开销不回货——请茶/香火钱/打赏是泼出去的水，notes 必须
    // 明示「开销」性质，正文写花销不写购得；实物交付闭环另属商店交互工单。
    notes.push(`破费签发：-${amt} 银两（${source}${clampNote}）——纯开销不回货，正文写花销应酬，严禁写成购得实物`);
  } else if (outcome === "调息") {
    // 同一游戏时辰只签一次——时辰两回合一档（restKey 按 watch=turn/2 取整），
    // varTree 记账跨回合防重 + 本 verdict 内 signedRest 去重（快照同读）。
    const restKey = `rest_${Math.floor(turn / 2)}`;
    const done = (varTree?.世界?.调息账 || []).includes(restKey) || signedRestKeys.has(restKey);
    if (done) { notes.push("本时辰已调息过，幂等跳过"); return; }
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
    if (!cold && !poison) { notes.push("寒热毒型不明，不签发"); return; }
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
}

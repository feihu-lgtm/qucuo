// ── give 赠礼收拒裁决（S4 纯搬家：原 judgeTurn.js give 分支原样移入）──
import { CATALOG_INDEX } from "../../../data/items/catalog.js";
import { giftPreference, computeGiftWeight } from "../../npc/giftWeight.js";
import { personaMod, affectionMod } from "./shared.js";
import { isNpcAngry } from "../../combat/stealSystem.js";

// ── 送银判官桥（S7 放行洞最小修）──
// intake kind 仍走 give、钱写「银两」（INTAKE_SYS 契约），在此接入既有送银链口径：
// CHANGE_VITALS_SILVER 扣银 + MUTATE_SOCIAL 恩（分量 = computeGiftWeight{amount} 区间中值，
// 与 features giftSilver 同一 deterministic 表，materialize 侧魅力修正/日涨账自动生效）。
// 金额只认玩家原话（action.text 为 intake 逐字照抄），绝不让模型编数；
// 未写数额/超囊中/对象不在场一律不签。生气对象镜像 giftSilver：扣银记仇不涨好感。
const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 中文小写数字解析（十/百，1-999）：非法拼写返回 0——宁可不签不可错扣。
function parseCnNumeral(w) {
  if (!w) return 0;
  if (w === "十") return 10;
  let total = 0, section = 0, rest = w;
  const qian = rest.indexOf("千");
  if (qian >= 0) {
    const t = CN_NUM[rest.slice(0, qian)];
    if (!t) return 0;
    total += t * 1000;
    rest = rest.slice(qian + 1);
  }
  const bai = rest.indexOf("百");
  if (bai >= 0) {
    const h = CN_NUM[rest.slice(0, bai)];
    if (!h) return 0;
    total += h * 100;
    rest = rest.slice(bai + 1);
  }
  const shi = rest.indexOf("十");
  if (shi >= 0) {
    const before = rest.slice(0, shi);
    const t = before ? CN_NUM[before] : 1; // 「十五」十前省略为一
    if (!t) return 0;
    section += t * 10;
    rest = rest.slice(shi + 1);
  }
  if (rest) {
    const ones = CN_NUM[rest];
    if (!ones) return 0;
    section += ones;
  }
  return total + section;
}

// 从玩家原文提取全部银两数额提及（ground truth 解析）。
// 小数/分数（1.5两）与非法中文数字整段视为无效提及——不猜半截。
// 返回数额数组（保序、可含重复）。
export function extractSilverAmounts(text) {
  const src = String(text || "");
  const amounts = [];
  const consumed = [];
  // 中文数字在前（字符集不重叠不会与阿拉伯混淆）
  const cnRe = /([一二三四五六七八九十百千零]{1,6})\s*两/g;
  let m;
  while ((m = cnRe.exec(src))) {
    // 含「零」整段拒签——零的占位语义（一千零五=1005）全解超最小口径，宁可不签不可错扣。
    if (m[1].includes("零")) { consumed.push([m.index, m.index + m[0].length]); continue; }
    const v = parseCnNumeral(m[1]);
    if (v > 0) amounts.push(v);
    consumed.push([m.index, m.index + m[0].length]);
  }
  // 万级以上不猜：万作为数词紧邻数字/中文数字时整句拒收（宁可不签不可错扣）；
  // 「千万收下」「万万不可」等副词用法的万前后不是数字，不误伤。
  if (/[一二三四五六七八九十百千\d]\s*万[一二三四五六七八九十百千零\d]*\s*两/.test(src)) return [];
  // 阿拉伯数字：前后不得紧邻数字或小数点（1.5两/12.5整体拒收），且不在中文数字段内
  const digitRe = /(?<![\d.])(\d+)\s*两(?!\d)/g;
  while ((m = digitRe.exec(src))) {
    const inCn = consumed.some(([a, b]) => m.index >= a && m.index < b);
    if (!inCn) amounts.push(parseInt(m[1], 10));
  }
  return amounts;
}

// 送银金额唯一可信来源：玩家原文（envelope.playerInput）。
//  zero 个提及 → 未写数额；多个不同数额 → 歧义（余额/礼金并列等）不猜；
//  恰好一个有效数额 → 采用。model 的 action.text 永不作为金额来源。
function resolveGiftSilverAmount(envelope) {
  const amounts = extractSilverAmounts(envelope?.playerInput);
  if (!amounts.length) return { amount: 0, reason: "未写明数额" };
  if (new Set(amounts).size > 1) return { amount: 0, reason: "原话数额歧义" };
  return { amount: amounts[0], reason: "" };
}
export function isSilverGive(action) {
  return action?.item === "银两" || action?.itemId === "银两";
}

export function handleGive(J, action, npc, aff, stanceMod) {
  const { roll, facts, notes, nextFactId, inv, isDeliverGive } = J;
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
    return;
  }
  // ── 送银桥：银两不是背包物件，走 CHANGE_VITALS_SILVER 专用通道 ──
  if (isSilverGive(action)) {
    const { amount, reason } = resolveGiftSilverAmount(J.envelope);
    if (!(amount > 0)) {
      notes.push(`送银${reason || "数额无效"}（只认玩家原话明确数额），不签发`);
      return;
    }
    if (amount > (J.money?.run ?? 0)) {
      notes.push(`囊中银两不足${amount}两，送银不签发`);
      return;
    }
    J.money.run -= amount;
    facts.push({
      id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -amount,
      witnesses: ["主角", npc.name],
    });
    // 好感分量与 features giftSilver 同一 deterministic 表：区间中值；
    // 生气只扣银不涨好感（镜像旧链），无好感轨道对象跳过。
    const angry = isNpcAngry(J.varTree, npc.name);
    if (!angry && !(npc?.intimacy?.forbidden || npc?.beast)) {
      const range = computeGiftWeight(npc, { amount })?.range;
      const baseDelta = range ? Math.round((range[0] + range[1]) / 2) : 2;
      facts.push({
        id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
        affectionDelta: baseDelta, ledgerKind: "恩", reason: `赠${amount}两银`,
        witnesses: ["主角", npc.name],
      });
    }
    notes.push(`送银签发：${npc.name}收${amount}两${angry ? "（对方气头上，不涨好感）" : ""}`);
    J.accept.value = true;
    return;
  }
  // S2 补洞：所赠之物必须在玩家背包实有——查无此物时不得签发。
  // 否则幻影礼物会空签 TRANSFER_ITEM 落空 + MUTATE_SOCIAL 好感照涨，
  // 货未出手恩已入账，本闸把假账封死。
  if (!item) {
    notes.push(`所赠之物「${action.item || action.itemId || "未名"}」不在囊中，赠礼不签发`);
    return;
  }
  const prefer = giftPreference(npc);
  const preferHit = prefer && itemObj?.category === prefer ? 0.15 : 0;
  const weight = itemObj ? computeGiftWeight(npc, itemObj) : null;
  const weightMod = weight?.ratio >= 2 ? 0.15 : weight?.ratio >= 1 ? 0.05 : -0.05;
  const score = 0.55 + personaMod(npc.personality) + affectionMod(aff) + preferHit + weightMod + stanceMod;
  if (roll() < Math.max(0.05, Math.min(0.95, score))) {
    J.accept.value = true;
    facts.push({
      id: nextFactId(), op: "TRANSFER_ITEM",
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

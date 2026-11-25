// NPC 学艺与窃取：拜师 / 偷窃。
// 从 logic.js 按动作分组拆出——这组只管"从对方身上学到/拿到东西"。
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { markNpcAsKnown as markNpcKnown } from "../../domain/rules/npc/npcAwareness.js";
import { markCarriedLost } from "../../domain/rules/npc/roomNpcs.js";
import { tryLearnFromMaster, tryStealFrom } from "../../domain/rules/kungfu/learnSkill.js";
import { isNpcAngry } from "../../domain/rules/combat/stealSystem.js";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";
import { appeaseAngryNpc } from "./anger.js";
import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { systemAffectionDelta, hasNoAffectionTrack } from "../../domain/rules/state/affection.js";
import { learnRange } from "../../domain/rules/state/fields.js";
import { selectEffectiveStats } from "../stats/logic.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export function stealFromNpc(state, npc, { now = Date.now() } = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }], kind: "blocked" };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "steal", detail: "偷窃", now });
  const agility = state.char?.special?.身法 ?? 0;
  const result = tryStealFrom(npc, state.varTree || {}, state.skills || [], state.char || {}, agility, now);
  if (!result.ok) {
    return { logs: [{ t: "sys", text: `  ${result.reason}` }], kind: "blocked", steal: result };
  }
  if (!result.success) {
    const favorability = state.varTree?.角色?.[npc.name]?.好感度 ?? 0;
    return {
      changes: {
        varTree: (prev) => {
          const known = markNpcKnown(prev || {}, npc.name);
          return updateField("varTree", [
            add(["角色", npc.name, "好感度"], -result.favorabilityLoss),
            set(["角色", npc.name, "生气状态"], result.angryState),
          ])(known);
        },
      },
      logs: [
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你手法生涩，被${npc.name}当场察觉！他脸色一沉，显然动了真怒。` },
      ],
      note: {
        text: `对${npc.name}下手偷窃，被他当场察觉，好感掉了${result.favorabilityLoss}，他动了真怒。`,
        owner: [{ name: npc.name, via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.DUMB,
      },
      noteAction: "stealFail",
      kind: "caught",
      steal: { ...result, favorability },
    };
  }

  if (result.outcome === null) {
    return {
      logs: [{ t: "sys", text: `  你想对${npc.name}下手，摸了半天，却发现他身上早已一无所有，只得悻悻作罢。` }],
      note: { text: `摸了${npc.name}的身，他身上已经一无所有。`, source: NOTE_SOURCE.DUMB },
      noteAction: "steal",
      kind: "empty",
      steal: result,
    };
  }

  if (result.outcome === "item") {
    const target = result.item;
    const fullItem = {
      ...makeGameItem({ name: target.name, category: target.category || "misc", quality: target.quality || "白" }),
      id: `stolen_${target.id}_${now}`,
    };
    return {
      changes: {
        inv: updateField("inv", (prev) => set("inv", [...prev, fullItem])),
        room: (prev) => ({ ...prev, npcs: markCarriedLost(prev.npcs, npc.name, target, "stolen") }),
      },
      logs: [
        { t: "cmd", text: `> 偷窃 ${npc.name}` },
        { t: "desc", text: `  你运指如风，趁${npc.name}不备，将「${target.name}」（${target.quality}）神不知鬼不觉地顺入了自己怀中。` },
        { t: "loot", text: `🤫 妙手空空：「${target.name}」`, item: fullItem, source: "steal", fromNpc: npc.name },
      ],
      note: { text: `从${npc.name}身上顺走了「${target.name}」，他毫无察觉。`, source: NOTE_SOURCE.DUMB },
      noteAction: "steal",
      kind: "item",
      steal: result,
    };
  }

  return {
    changes: { skills: (prev) => prev.some((skill) => skill.id === result.skill.id) ? prev : [...prev, result.skill] },
    logs: [
      { t: "cmd", text: `> 偷窃 ${npc.name}` },
      { t: "desc", text: `  你悄然窥破${npc.name}出手的门道，趁其不备，竟将「${result.move.name}」这一手偷学了去！` },
      { t: "loot", text: `🤫 偷師得手：「${result.move.name}」`, skill: { name: result.move.name, quality: result.move.quality || result.skill?.quality || "白", moveType: result.move.type }, desc: result.move.desc, source: "steal", fromNpc: npc.name },
    ],
    note: { text: `偷看${npc.name}出手的门道，把「${result.move.name}」这一手学了去，他没有察觉。`, source: NOTE_SOURCE.DUMB },
    noteAction: "steal",
    kind: "move",
    steal: result,
  };
}

export function learnNpcSkill(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  if (isNpcAngry(state.varTree, npc.name)) return appeaseAngryNpc(state, npc, { kind: "learn" });

  const char = state.char || {};
  const skills = state.skills || [];
  const decision = tryLearnFromMaster(npc, state.varTree || {}, skills, char);
  if (!decision.ok) {
    return { logs: [{ t: "sys", text: `  ${decision.reason}` }] };
  }

  const money = char.money || 0;
  if (money < decision.totalPrice) {
    return {
      logs: [{
        t: "sys",
        text: `  ${npc.name}愿意传授，但束脩需银${decision.totalPrice}两（现有${money}两），你银两不够，一时难以成行。`,
      }],
    };
  }

  const priceNote = decision.totalPrice > 0
    ? `，奉上束脩银${decision.totalPrice}两`
    : "（好感深厚，分文不取）";
  const label = decision.isMaster ? "授业绝学" : "江湖通行招";
  const verb = decision.isMaster ? "将平生所学" : "将几手江湖基本功";

  // WO-16B：授业好感 deterministic 硬结算——普通 3/绝学 6（learnRange 第三值），
  // 经系统账本（魅力修正/日涨上限/0-100 clamp）；兽类无好感轨道跳过。
  const [learnLo, learnHi, learnBase] = learnRange(decision.isMaster);
  const affectionWrite = hasNoAffectionTrack(npc) ? null : (prev) => {
    const charm = selectEffectiveStats(state).effectiveSpecialNow?.魅力 ?? 5;
    return systemAffectionDelta(prev, npc.name, learnBase, { charm, time: state.time ?? 0, range: [learnLo, learnHi] }).tree;
  };
  return {
    changes: {
      varTree: (prev) => {
        const known = markNpcKnown(prev || {}, npc.name);
        return affectionWrite ? affectionWrite(known) : known;
      },
      char: applyWrite({ char }, add("char.money", -decision.totalPrice)).state.char,
      skills: [...skills, ...decision.freshSkills],
    },
    logs: [{
      t: "sys",
      text: `  （习得 ${decision.freshSkills.length} 招${priceNote}，已录入武学栏 · ${label}，学即完整）`,
    }],
    settle: `拜${npc.name}为师，${npc.name}${verb}「${decision.moveBrief}」倾囊相授，我凝神习得`,
    settleOptions: {
      settleNpc: npc.name,
      settleKind: "learn_skill",
      learnInfo: {
        isMaster: decision.isMaster,
        moveBrief: decision.moveBrief,
        totalPrice: decision.totalPrice,
        beast: !!npc.beast || !!npc.cannotSpeak,
      },
    },
  };
}

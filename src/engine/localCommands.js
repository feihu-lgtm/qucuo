import { ITEM_CATEGORY, CATEGORY_LABEL, getEquipped } from "../domain/rules/economy/equipment.js";
import { selectEffectiveStats } from "../features/stats/logic.js";
import { getLookText } from "../domain/rules/map/mapSquares.js";
import { isBareLook } from "../domain/rules/prompt/inputIntent.js";
import { QUCUO_MAP } from "../domain/data/map/qucuoMap.js";
import { QUCUO_QUESTS } from "../domain/data/quests/qucuoQuests.js";
import { getQuestScript } from "../domain/data/quests/questScripts.js";
import { bar } from "../utils/mudHelpers.js";
import { getPresentNpcs } from "../domain/rules/state/fields.js";
import { giftSilver } from "../features/npc/logic.js";

const ROOM_LOOK_COMMANDS = new Set(["看", "look", "l", "看看", "环顾", "环顾四周", "环视", "环视四周", "查看四周"]);

function localLines(lines, recordHistory = true) {
  return { kind: "lines", lines, recordHistory };
}

function questScriptLines(command) {
  const parts = command.split(/\s+/);
  const testQuestId = parts[1];
  const testFlag = parts[2];
  if (!testQuestId || !testFlag) {
    return [{ t: "sys", text: "  用法：#testscript <任务id> <flag>，比如 #testscript village2_jieshixiajiu quest_village2_s2" }];
  }
  const quest = QUCUO_QUESTS.find((entry) => entry.id === testQuestId);
  if (!quest) {
    return [{ t: "sys", text: `  ✗ 找不到任务 "${testQuestId}"，检查一下id有没有打对` }];
  }
  const stage = quest.stages?.find((entry) => {
    const flags = Array.isArray(entry.completionFlag) ? entry.completionFlag : [entry.completionFlag];
    return flags.includes(testFlag);
  });
  if (!stage) {
    return [{ t: "sys", text: `  ✗ 任务 "${testQuestId}" 里没有任何 stage 的 completionFlag 包含 "${testFlag}"` }];
  }
  const script = getQuestScript(quest.id, stage.id, [testFlag]);
  if (!script) {
    return [{ t: "sys", text: `  ⚠ 这个stage（${stage.id}）在 questScripts.js 里没有登记固定台本，正常情况下会走AI生成` }];
  }
  return [
    { t: "sys", text: `  ── 台本夺舍测试：${quest.title} / ${stage.id} / flag=${testFlag} ──` },
    ...script.split("\n").filter((line) => line.length).map((line) => ({ t: "desc", text: `  ${line}` })),
    { t: "sys", text: "  ── 以上为固定台本展示效果，未调用AI ──" },
  ];
}

export function isRoomLookCommand(text) {
  const command = String(text ?? "");
  return ROOM_LOOK_COMMANDS.has(command.trim().toLowerCase()) || isBareLook(command);
}

export function parseLocalCommand(text, state = {}, { surface = "web" } = {}) {
  const command = String(text ?? "");
  const normalized = command.trim().toLowerCase();
  if (!normalized || state.isTalk) return null;

  const gift = /^(?:给|送(?:给)?)\s*(.+?)\s+(\d+)\s*(?:元|两(?:银子|银两)?)$/
    .exec(command.trim()) ?? /^给([^\d]+?)(\d+)\s*(?:元|两(?:银子|银两)?)$/.exec(command.trim());
  if (gift) {
    const [, name, amount] = gift;
    const npc = getPresentNpcs(state).find((entry) => entry.name === name.trim());
    return { kind: "result", localKind: "giftSilver", result: giftSilver(state, npc, Number(amount)) };
  }

  if (normalized === "help" || normalized === "帮助") {
    if (surface === "web") {
      return localLines([
        { t: "sys", text: "  ▸ 方向 n/s/e/w 移动 · look 查看 · 输入框上方可切换「◈行动 / ◎对话 / ◆私聊旁白」三种模式" },
        { t: "sys", text: "  ▸ 对话模式：只跟房间里的人说话，不移动、不消耗回合；私聊旁白：直接找旁白聊天，同样不消耗回合" },
        { t: "sys", text: "  ▸ 完整玩法说明见右上角 ⚙ 设置 →「玩法说明」" },
      ]);
    }
    return localLines([
      { t: "sys", text: "── 命令列表 ──" },
      { t: "sys", text: "  look/l        查看房间" },
      { t: "sys", text: "  n/s/e/w/u/d   移动" },
      { t: "sys", text: "  look <目标>   查看NPC/物品" },
      { t: "sys", text: "  kill <NPC>    攻击" },
      { t: "sys", text: "  ask <NPC> about <话题>  对话" },
      { t: "sys", text: "  get/drop <物品>  拿/丢" },
      { t: "sys", text: "  wear/wield <物品>  穿/持" },
      { t: "sys", text: "  eat/drink <物品>  吃喝" },
      { t: "sys", text: "  用/服 <丹药>  服用消耗品（回血等，探索态即时结算）" },
      { t: "sys", text: "  practice <武功>  运功修炼" },
      { t: "sys", text: "  ◈行动/◎对话/◆私聊旁白 三态切换：行动消耗回合，对话与私聊不消耗回合" },
      { t: "sys", text: "  对话模式下只能和房间里的人说话，不能移动或战斗" },
      { t: "sys", text: "  ⊙ 打坐：消耗1回合，恢复部分气血" },
      { t: "sys", text: "  hp/状态  i/背包  skills/武功" },
      { t: "sys", text: "  或输入任意动作，引擎会处理。" },
    ]);
  }

  if (surface === "cli" && (normalized === "hp" || normalized === "状态")) {
    const { effectiveSpecialNow, maxHpNow, activeBuffs } = selectEffectiveStats(state);
    const special = state.char?.special || {};
    const sevenDimLine = Object.entries(special).map(([key, value]) => {
      const effective = effectiveSpecialNow[key] ?? value;
      return effective !== value ? `${key}${value}→${effective}` : `${key}${value}`;
    }).join(" ");
    const buffLines = activeBuffs.length
      ? [{ t: "stat", text: `  丹药药力：${activeBuffs.map((buff) => `${buff.attr}+${buff.val}(余${buff.remaining}回合)`).join("、")}` }]
      : [];
    return localLines([
      { t: "sys", text: "── 状态 ──" },
      { t: "stat", text: `  气血 ${bar(state.char.hp[0], maxHpNow)} ${state.char.hp[0]}/${maxHpNow}` },
      { t: "stat", text: `  内功 ${bar(state.char.neigong ?? 0, 100)} ${state.char.neigong ?? 0}/100` },
      { t: "stat", text: `  外功 ${bar(state.char.waigong ?? 0, 100)} ${state.char.waigong ?? 0}/100` },
      { t: "sys", text: "── 根骨悟性体魄魅力智谋身法气运 ──" },
      { t: "stat", text: `  ${sevenDimLine || "（无数据）"}` },
      ...buffLines,
      { t: "stat", text: `  经验 ${state.exp}  潜能 ${state.pot}` },
    ]);
  }

  if (surface === "cli" && (normalized === "i" || normalized === "背包" || normalized === "inventory")) {
    const inv = state.inv || [];
    return localLines([
      { t: "sys", text: "── 包袱 ──" },
      ...inv.map((item) => {
        if (typeof item === "string") return { t: "item", text: `  · ${item}` };
        const equipped = item.equipped ? "[已装备] " : "";
        return { t: "item", text: `  · ${equipped}${item.name}（${item.quality}）` };
      }),
      ...(inv.length === 0 ? [{ t: "sys", text: "  （空空如也）" }] : []),
    ]);
  }

  if (surface === "cli" && (normalized === "skills" || normalized === "武功" || normalized === "武学")) {
    return localLines([
      { t: "sys", text: "── 武学 ──" },
      ...(state.skills || []).map((skill) => ({
        t: "skill",
        text: `  ${skill.active ? "▶" : "○"} ${skill.name}·${skill.stage || "完整"}（${skill.quality || "白"}品）`,
      })),
    ]);
  }

  if (surface === "cli" && (normalized === "eq" || normalized === "装备")) {
    const categories = [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY];
    return localLines([
      { t: "sys", text: "── 装备 ──" },
      ...categories.map((category) => {
        const items = getEquipped(state.inv || [], category);
        const label = CATEGORY_LABEL[category];
        return { t: "item", text: `  ${label}：${items.length ? items.map((item) => `${item.name}(${item.quality})`).join("、") : "无"}` };
      }),
    ]);
  }

  if (normalized.startsWith("#testscript")) {
    return localLines(questScriptLines(command), false);
  }

  // 房间预成文本只给裸 look（环顾四周）：带目标的端详（look <id>/看 <人>/打量 …）
  // 也归 LOOK 意图，但必须放行到端详路径，不能吃房间缓存
  const isRoomLook = isRoomLookCommand(command);
  if (isRoomLook && QUCUO_MAP[state.room?.name]) {
    const lookText = getLookText(state.room.name, Math.floor(state.time / 24));
    if (!lookText) return null;
    return {
      kind: "result",
      result: {
        changes: {
          time: state.time + 1,
          convo: [
            ...(state.convo || []),
            { role: "user", content: command },
            { role: "assistant", content: lookText.slice(0, 500) },
          ],
        },
        logs: [
          { t: "cmd", text: `> ${command}` },
          { t: "desc", text: `  ${lookText}` },
        ],
      },
      recordHistory: true,
      localKind: "cachedLook",
    };
  }

  return null;
}

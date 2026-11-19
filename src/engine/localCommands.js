import { ITEM_CATEGORY, CATEGORY_LABEL, getEquipped } from "../equipment.js";
import { selectEffectiveStats } from "../features/stats/logic.js";
import { getLookText } from "../mapSquares.js";
import { classifyIntent } from "../inputIntent.js";
import { QUCUO_MAP } from "../qucuoMap.js";
import { QUCUO_QUESTS } from "../quests/qucuoQuests.js";
import { getQuestScript } from "../quests/questScripts.js";
import { bar } from "../utils/mudHelpers.js";

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

export function parseLocalCommand(text, state = {}) {
  const command = String(text ?? "");
  const normalized = command.trim().toLowerCase();
  if (!normalized || state.isTalk) return null;

  if (normalized === "help" || normalized === "帮助") {
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

  if (normalized === "hp" || normalized === "状态") {
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

  if (normalized === "i" || normalized === "背包" || normalized === "inventory") {
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

  if (normalized === "skills" || normalized === "武功" || normalized === "武学") {
    return localLines([
      { t: "sys", text: "── 武学 ──" },
      ...(state.skills || []).map((skill) => ({
        t: "skill",
        text: `  ${skill.active ? "▶" : "○"} ${skill.name}·${skill.stage || "完整"}（${skill.quality || "白"}品）`,
      })),
    ]);
  }

  if (normalized === "eq" || normalized === "装备") {
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

  const intent = classifyIntent(command);
  if ((ROOM_LOOK_COMMANDS.has(normalized) || intent.code === "LOOK") && QUCUO_MAP[state.room?.name]) {
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

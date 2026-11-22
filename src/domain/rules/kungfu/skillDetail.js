// 武学详情：右栏点武学名字时，原文描述之外再给一份「正经」数值说明。
// 数值全从派生招式上读（与战斗同一份），描述优先取武学自己的，其次目录定义。
import { SKILL_CATALOG } from "../../data/kungfu/qucuoKungfu.js";
import { explainMove, passiveBonusBrief } from "../economy/itemEffectText.js";

let catalogById = null;
const catalogEntry = (id) => {
  if (!id) return null;
  catalogById ??= new Map(Object.values(SKILL_CATALOG).flat().map((entry) => [entry.id, entry]));
  return catalogById.get(id) || null;
};

const pct = (n) => `${Math.round(n * 100)}%`;
const num = (n) => n.toFixed(2).replace(/\.?0+$/, "");

export function skillDetail(skill, move) {
  if (!skill) return null;
  const def = catalogEntry(skill.id);
  const type = skill.moveType || move?.type || def?.moveType || "";
  const rows = [
    ["类型", type ? `${type}类` : "未定"],
    ["品阶", `${skill.quality || def?.quality || "白"}品`],
    ["火候", skill.fixed ? "完整招式（学即圆满）" : (skill.stage || "入门")],
  ];
  // 内功、轻功不进出招栏，只有被动加成，不报招式数值以免误导。
  const passiveOnly = type === "内功" || type === "轻功";
  const passive = passiveBonusBrief(skill.passiveBonus || def?.passiveBonus);
  if (passiveOnly) {
    if (passive) rows.push(["被动", passive]);
    return { desc: skill.desc || def?.desc || "", rows: rows.map(([label, value]) => ({ label, value })), effects: [] };
  }
  const mul = move?.baseDamageMultiplier;
  if (typeof mul === "number" && mul > 0) {
    rows.push(type === "防御"
      ? ["减伤", `受伤倍率 ×${num(mul)}，只吃原伤害的 ${pct(mul)}`]
      : ["威力", `伤害倍率 ×${num(mul)}`]);
  }
  const cost = move?.energyCost ?? 0;
  rows.push(["耗气", cost > 0 ? `${cost} 点` : "不耗气"]);
  if (move?.hpRestore) rows.push(["回血", pct(move.hpRestore)]);
  if (move?.energyRestore) rows.push(["回气", `${move.energyRestore} 点`]);
  if (typeof move?.confuseChance === "number" && type === "状态") rows.push(["扰乱几率", pct(move.confuseChance)]);
  if (passive) rows.push(["被动", passive]);
  return {
    desc: skill.move?.desc || skill.desc || def?.desc || "",
    rows: rows.map(([label, value]) => ({ label, value })),
    effects: explainMove(move),
  };
}

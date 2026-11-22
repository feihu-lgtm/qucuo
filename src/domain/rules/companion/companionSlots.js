export const COMPANION_SLOTS = [
  { key: "snowLeopard", label: "雪豹", beast: true, humanForm: true },
  { key: "pearl", label: "珍珠", beast: true, humanForm: true },
  { key: "panda", label: "墨团", beast: true },
  { key: "asuka", label: "明日香", beast: false },
];

// 雪豹、珍珠认主入队即化为人形；化形后一律是成年女子，设定、提示词、档案共用这句。
export const ADULT_HUMAN_FORM = "化形后是年满十八岁以上的成年女子，相貌、身段、言谈口吻都是成年人，绝不写成未成年的外貌或口吻";

export function isHumanFormCompanion(name) {
  return COMPANION_SLOTS.some(s => s.label === name && s.humanForm);
}

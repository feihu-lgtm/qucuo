const expand = (left, right, render) => left.flatMap((a) => right.map((b) => render(a, b)));
const reactionActions = ["拂袖", "退步", "晃肩", "收掌", "提气", "沉身", "转腕", "敛息", "抬眼", "稳住脚跟"];
const reactionLabels = { damaged: "受击", dodged: "闪避", recovered: "回气", controlled: "受制" };
const reactionTones = {
  damaged: [["浑若无事", "神色未改", "气息平稳", "脚下未乱", "尚自从容", "不见慌色", "气定神闲", "衣袂轻扬"],
    ["身形一晃", "胸口微震", "脚下踉跄", "面色一白", "气息微促", "步履迟滞", "肩头发麻", "勉强站定"],
    ["摇摇欲坠", "几乎站不稳", "眼看就要倒下", "膝头发软", "勉强支身", "步履虚浮", "身形欲倾", "险些跌倒"]],
  dodged: [["安然避过", "稳稳落地", "未伤分毫", "气定神闲", "从容收势", "衣袂轻扬", "身法飘然", "全然无损"],
    ["落地微晃", "气息略促", "踉跄半步", "才站定脚跟", "身形稍乱", "勉强站稳", "步势微偏", "轻喘一声"],
    ["险险站稳", "摇摇欲坠", "勉强支身", "几乎失势", "脚下发软", "踉跄欲倒", "身形不稳", "险些跌倒"]],
  recovered: [["气机渐平", "内息周流", "真元归位", "神色如常", "气息平和", "周身舒展", "缓缓收功", "从容运息"],
    ["气息渐匀", "稍稍缓过", "真气接续", "脉息渐稳", "脸色稍霁", "胸口起伏", "仍需调理", "勉强舒气"],
    ["气息稍复", "勉强支身", "暂稳心脉", "提气站定", "仍显虚弱", "稍得喘息", "强撑不倒", "尚未脱险"]],
  controlled: [["气机略滞", "衣袂微顿", "步势稍缓", "内息一窒", "身形微僵", "招势一停", "气息微乱", "动作迟疑"],
    ["呼吸一窒", "难以续招", "劲意缠身", "身形微滞", "脉息受阻", "步法凌乱", "气机不畅", "肩背一紧"],
    ["勉强稳身", "气机迟滞", "脚步一顿", "身形难动", "招势尽失", "几乎跌倒", "周身发麻", "强自支撑"]],
};

export const REACTION_POOLS = Object.fromEntries(Object.entries(reactionTones).map(([family, bands]) => [
  family,
  Object.fromEntries(["healthy", "hurt", "nearDown"].map((band, index) => [
    band,
    expand(reactionActions, bands[index], (action, tone) => `{target}${reactionLabels[family]}，${action}${tone}`),
  ])),
]));

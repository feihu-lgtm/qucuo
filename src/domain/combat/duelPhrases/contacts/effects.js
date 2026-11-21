const expand = (left, right, render) => left.flatMap((a) => right.map((b) => render(a, b)));
const turns = ["随势", "乘势", "悄然", "倏忽", "旋即", "转眼", "当即", "借力", "顺势", "一时"];
const impacts = ["击中", "掠过", "撞上", "直取", "扫中", "擦过", "正中", "震开", "逼退", "破开"];
const controlTurns = ["倏忽", "旋即", "抢先", "趁势", "蓦地", "当即", "骤然", "忽地", "乘势", "眨眼"];
const controlImpacts = ["点住", "封住", "截住", "制住", "锁住", "按住", "封穴", "点中", "顿住", "拿住"];
const makeEffects = (left, right, text) => expand(left, right, text);
const blockGestures = ["抬臂", "横掌", "拂袖", "沉肩", "翻腕", "屈肘", "架臂", "振袖", "格腕", "并掌"];
const interruptionMoves = ["一掌截住", "一指点中", "掌风震散", "劲力压下", "手腕一格", "肩头一撞", "招势封回", "劲气拦住", "指影一挑", "横臂一扫"];
const reflectEnds = ["震回原处", "逼回原处", "直袭自身", "倒撞胸前", "循势回击", "透衣而入", "转向来者", "迎面扑回", "沿臂倒灌", "一举反噬"];
const reflectCounterStarts = ["反劲倒卷", "护体劲力一转", "真气回旋", "袖底暗劲一震", "劲力顺势回荡", "气机一收一放", "掌中劲力反卷", "内息骤然逆转", "护体罡气一震", "周身气劲回旋"];
const reflectCounterEnds = ["逼得{target}退了半步", "震得{target}气息一滞", "将{target}来势尽数弹开", "迫得{target}招势一顿", "震得{target}身形微晃"];
const controlLands = ["气机一滞", "身形骤僵", "周身发麻", "步法凌乱", "难以续招", "脉息受阻", "动作迟疑", "内息不畅", "穴道受制", "招势顿停"];
const controlFollowups = ["劲力难续", "气息微乱", "身法受限", "步履一顿", "真气凝涩", "周身僵直", "手足发麻", "门户大开", "难以转圜", "招势尽失"];
const statusEffects = ["气息微乱", "内息稍滞", "周身一震", "脉息浮动", "步法微偏", "劲力稍散", "真气一荡", "神色微变", "招势略缓", "气机不宁"];
const statusFollowups = ["余劲未消", "片刻方定", "转瞬难平", "仍受牵制", "内息微滞", "气机不畅", "心神稍乱", "难以调匀", "招势受扰", "未能如常"];
const healingEffects = ["气息渐匀", "脉息稍平", "真气接续", "脸色稍霁", "胸口舒展", "内息归元", "心脉渐稳", "精神稍振", "疼痛稍缓", "气机回转"];
const healingFollowups = ["收势从容", "运息渐平", "眉间舒展", "步履稍稳", "面色转和", "真气流转", "心神稍定", "血色渐回", "胸中安定", "内息续行"];
const dotEffects = ["余毒侵体", "旧伤复发", "气血翻涌", "经脉刺痛", "寒意入骨", "劲力透体", "伤处抽痛", "内息受扰", "脉络发涩", "疼痛难忍"];
const dotFollowups = ["身形微晃", "面色发白", "气息一促", "脚步稍乱", "眉头紧锁", "强自支身", "肩背一沉", "额间见汗", "呼吸紊乱", "身形欲倾"];
const dodgeEffects = ["安然落地", "从容收势", "稳住脚跟", "衣袂轻扬", "身法飘然", "未伤分毫", "转身而立", "退步无声", "气定神闲", "轻巧避开"];
const dodgeFollowups = ["气息平稳", "脚下未乱", "神色如常", "步势未停", "仍自从容", "旋身回望", "举止安然", "不见慌色", "收招自若", "身形稳当"];
const idleModifiers = ["始终", "终究", "一时", "到底", "竟然", "仍然", "偏偏", "依旧", "一直", "终归"];
const idleOutcomes = ["得手", "建功", "奏效", "近身", "破招", "占先", "撼动对方", "显出威势", "找到破绽", "压住对手"];

export const EFFECT_POOLS = {
  hit: makeEffects(turns, impacts, (a, b) => `劲力${a}${b}{target}`),
  blocked: makeEffects(turns, blockGestures, (a, b) => `招势被{target}${a}${b}架住，攻势难进`),
  interrupted: makeEffects(turns, interruptionMoves, (a, b) => `刚要运气，便被{target}${a}${b}打断`),
  controlInterrupted: makeEffects(controlTurns, controlImpacts, (a, b) =>
    `刚要运气，便被{target}${a}一指${b}，动弹不得`).slice(0, 50),
  reflected: makeEffects(turns, reflectEnds.slice(0, 5), (a, b) => `招势被{target}${a}以护体劲力截住，反劲${b}`),
  reflectCounter: makeEffects(reflectCounterStarts, reflectCounterEnds, (a, b) => `${a}，${b}`),
  controlLanded: makeEffects(controlLands, controlFollowups, (a, b) =>
    `@round.result.statusAppliedToB落在{target}身上，${a}，${b}`),
  controlPreempt: makeEffects(controlLands, controlFollowups, (a, b) =>
    `抢先制住{target}的攻势，${a}，${b}`).slice(0, 50),
  statusApplied: makeEffects(statusEffects, statusFollowups, (a, b) =>
    `@round.result.statusAppliedToB落在{target}身上，${a}，${b}`),
  heal: makeEffects(healingEffects, healingFollowups, (a, b) =>
    `气血渐复（+@round.result.hpRestoreA），${a}，${b}`),
  dot: makeEffects(dotEffects, dotFollowups, (a, b) =>
    `身受持续伤害@round.result.statusDamageA，${a}，${b}`).slice(0, 50),
  dodged: makeEffects(dodgeEffects, dodgeFollowups, (a, b) =>
    `侧身躲过{target}的{targetMove}，${a}，${b}`),
  nothing: makeEffects(idleModifiers, idleOutcomes, (a, b) => `却${a}未能${b}`).slice(0, 50),
};

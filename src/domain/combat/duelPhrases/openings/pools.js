const expand = (left, right, render) => left.flatMap((a) => right.map((b) => render(a, b)));

const openingForms = ["踏前半步", "旋身欺近", "振袖扬腕", "沉肩进步", "提气纵身", "侧身掠出", "并步抢进", "足尖一点", "拧腰发劲", "袍袖翻飞", "身形骤起", "斜掠三尺", "步踏七星", "疾趋而上", "错步前探", "腕底生风", "气贯周身", "身如离弦", "长身一展", "横掠而来", "凝神敛息"];
const openingEnds = ["递向中门", "直取前路", "探向胸前", "斜挑门户", "横扫身前", "疾点要害", "划开长空", "透出劲风", "不离身前", "直逼近处", "蓄势待发", "翻出劲影", "带起衣袂", "稳稳递出", "破空而来", "护住门户", "凝出气墙"];

export const OPENING_POOLS = Object.fromEntries(["攻击", "防御", "状态"].map((type) => [
  type,
  expand(openingForms, openingEnds, (a, b) => {
    const action = type === "攻击" ? "使出" : type === "防御" ? "架起" : "运起";
    return `{actor}${a}${action}{move}${b}`;
  }),
]));

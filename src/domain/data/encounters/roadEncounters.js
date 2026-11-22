// 路途遭遇表——总纲 7.6「熊山/狼曲路途遭遇池」的物理载体。
// 此前提示词只承诺"可随机触发地域遭遇"，具体撞什么全由 AI 临场编；本表把
// 每段路途的遭遇条目写成数据：条目名 + tag（任务清剿统计用）+ 一句话钩子，
// 移动那一轮按「出发据点→目的据点」查表注入，AI 从池里挑一条演绎（也可不遇）。
//
// 覆盖总纲点名的两段路途：
//   熊山口  鱼定村↔大草甸——藏马熊/黑熊/白虎/雪狐/吊睛虎王等野兽生态，
//           土司府管家常设卡（虎胆传说发生地）
//   狼曲河谷 大草甸↔玉泉寨——黑风寨山贼的游哨/巡山人，有组织的人而非野兽，
//           寨规克制、不伤妇孺，态度视玩家与黑风寨声誉而定
// tag 与 presets/qucuo.js 的约定一致：入战 NPC 挂 "熊山野兽"/"黑风寨山贼"，
// 清剿类任务按 tag 统计进度。

export const ROAD_ENCOUNTERS = [
  {
    id: "xiongshan_pass",
    name: "熊山口",
    between: ["鱼定村", "大草甸"],
    pool: [
      { name: "藏马熊", tag: "熊山野兽", hint: "挡道觅食的壮熊，可绕可斗可引开" },
      { name: "黑熊母子", tag: "熊山野兽", hint: "护崽母熊，主动避人，被逼急才扑" },
      { name: "白虎", tag: "熊山野兽", hint: "虎胆传说里那类通体雪白的山君，罕见，气场压人" },
      { name: "雪狐", tag: "熊山野兽", hint: "不伤人，只远远缀着，像在引路" },
      { name: "吊睛虎王", tag: "熊山野兽", hint: "熊山兽王，单遇即死局级强敌，宜避不宜斗" },
      { name: "土司府巡卡家丁", tag: null, hint: "管家常设的哨卡，盘查往来行旅，认令旗认熟人" },
      { name: "赶脚的行商", tag: null, hint: "顺路搭话的脚商，可换几句熊山口见闻与雪山派传闻" },
    ],
  },
  {
    id: "langqu_valley",
    name: "狼曲河谷",
    between: ["大草甸", "玉泉寨"],
    pool: [
      { name: "黑风寨游哨", tag: "黑风寨山贼", hint: "两三骑巡河哨，先盘问来路；寨规不伤妇孺，名声好者放行甚至指路" },
      { name: "黑风寨巡山队", tag: "黑风寨山贼", hint: "一队带刀巡山人；与黑风寨交恶会遭驱赶或动手，入伙者反被招呼" },
      { name: "落单的断粮山贼", tag: "黑风寨山贼", hint: "私下拦路讨粮的散兵，给钱给粮放行，动手他也敢拼" },
      { name: "迷路的牧羊人", tag: null, hint: "玉泉寨方向走失羊群的牧人，指路可结善缘" },
      { name: "野狼群", tag: "熊山野兽", hint: "河谷苇丛里的狼群，人多则避，人孤则围" },
    ],
  },
  {
    id: "dacaodian_wilds",
    name: "大草甸",
    between: null, // 抵达大草甸本身即进入生态区（任一方向来都算）
    arriveOnly: "大草甸",
    pool: [
      { name: "野狼", tag: "熊山野兽", hint: "草甸游荡的孤狼或三两小群" },
      { name: "盘旋的鹰", tag: null, hint: "只在头顶盘旋，可指向远处异常（兽群/炊烟）" },
      { name: "白马", tag: null, hint: "无主野马，神骏难近，追它要费周折" },
      { name: "牦牛群", tag: null, hint: "散牧的牦牛，不惊不扰" },
      { name: "猞猁", tag: "熊山野兽", hint: "伏在草浪里的猎手，近身才暴起" },
      { name: "银灰独眼狼王", tag: "熊山野兽", hint: "草甸深处的狼王，虎胆传说同级强敌，宜避不宜斗" },
    ],
  },
];

// 按「出发据点→目的据点」查这一段路途对应的遭遇池。方向无关（A→B 与 B→A 同池）。
export function roadEncounterFor(fromDistrict, toDistrict) {
  if (!toDistrict) return null;
  for (const segment of ROAD_ENCOUNTERS) {
    if (segment.arriveOnly) {
      if (toDistrict === segment.arriveOnly) return segment;
      continue;
    }
    const [a, b] = segment.between || [];
    if ((fromDistrict === a && toDistrict === b) || (fromDistrict === b && toDistrict === a)) {
      return segment;
    }
  }
  return null;
}

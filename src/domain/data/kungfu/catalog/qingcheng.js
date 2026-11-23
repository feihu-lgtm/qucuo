// 武学目录·青城（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const qingcheng = [
    {
      id: "kf_rec_xiaozhoutian", name: "玄门小周天", type: SKILL_TYPE.MOVE, quality: "蓝", price: 125,
      unlock: { faction: "青城派", rep: 0, member: false, note: "无需拜师，青城派声誉 ≥ 0" },
      moveType: "状态",
      energyRestore: 7,
      desc: "道门正宗的行气路子，气自尾闾上夹脊、过玉枕、下重楼，绕一圈回丹田。一清道长说走这一圈要一炷香，急不得——「你催它，它就散。」",
    },
    {
      id: "kf_rec_libui", name: "离堆分水息", type: SKILL_TYPE.MOVE, quality: "紫", price: 205,
      unlock: { faction: "青城派", rep: 40, member: false, note: "拜入青城派，或青城派声誉 ≥ 40（门墙之交）" },
      moveType: "状态",
      energyRestore: 9, hpRestore: 0.12,
      desc: "仿离堆分水的理路：气到胸口一分为二，一股沉丹田，一股走四肢。不蓄在一处，就不会憋。宝瓶口边上练，水声大得听不见自己呼吸，反而练得成。",
    },
    {
      id: "kf_ting_fenshui", name: "听桥·分水", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      unlock: { faction: "青城派", rep: 40, member: false, note: "需拜入青城派，或青城派声誉 ≥ 40（门墙之交）" },
      moveType: "防御",
      onCounterSuccessEnergyGain: 5, onCounterSuccessDamageRatio: 0.5,
      desc: "听桥的青城正解。来力到身前如江水撞上离堆，自然分作两股从身侧滑过——分完那一瞬江水还在推，借的就是那一推。一清道长使这招是闭着眼的。",
    },
    {
      id: "kf_qingchengjian", name: "青城剑法", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      unlock: { faction: "青城派", rep: 0, member: false, note: "无需拜师，青城派声誉 ≥ 0（非敌对即可在三清殿外院求学）" },
      moveType: "攻击",
      // 【原来挂的是 onCounterSuccessEnergyGain】那个标志位只在「防御成功反击」时
      // 结算，挂在攻击槽的招上永远不触发。改成接反击追打，既合青城后发制人的路子，
      // 也跟松风剑法(0.3)形成入门→进阶的递进。
      afterCounterBonus: 0.2,
      desc: "青城派开蒙剑法，只有十二式，弟子上山头三个月练的就是它。招式灵动飘逸，起手不求力也不求快，只求准——剑尖始终对着对手重心那一点。松鹤道长说这套剑法一辈子都练不完，「你嫌它简单，是因为你还没被它救过命」。",
    },
    {
      id: "kf_songfeng", name: "松风剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      unlock: { faction: "青城派", rep: 15, member: false, note: "青城派声誉 ≥ 15（外门记名或门墙善缘可学）" },
      moveType: "攻击",
      afterCounterBonus: 0.3,
      desc: "青城派入门剑法，三十六式舒展如松涛过涧。不以快取胜——剑尖划过空气看似缓慢，实则每一剑藏着连绵后劲。使到第三十六式时第一式剑劲还在对手体内残留，新旧叠加，一剑比一剑沉。宝瓶口练此剑，剑尖点水不起水花方为入门。",
    },
    {
      id: "kf_xuanmenqi", name: "青城玄门气", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 90,
      moveType: "防御",
      desc: "道门正宗内功，以呼吸吐纳养气。气劲悠长连绵如岷江之水，表面平缓底下深沉。运功时周身气机形成绵密防御场，来犯之力如击棉絮，层层消解。缺陷：防御状态下只能守不能攻——蓄水时不泄洪，泄洪时不蓄水。",
      passiveBonus: { maxHp: 20 },
    },
    {
      id: "kf_dujiangshi", name: "都江古堰势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      enemyCostPenalty: { value: 1, turns: 2 },
      desc: "不伤敌不护身——改变脚下的势。将内劲灌入地面布下无形力场，力场内敌方劲力被引导分流，快招自动变慢、准头偏移，如岷江激流撞上离堆被迫分为内外两江。维持时间短极耗内力，但一旦布下攻守之势立转。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_tiyunzong", name: "梯云纵", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 0,
      moveType: "状态",
      desc: "青城派不传之秘，仅藏于伏龙观藏经阁。纵身时如踏云梯而上，一步高过一步，三步之后人在半空，落地无声。不是跳得高——是每一步都踩在前一步的余势上，如岷江后浪推前浪，绵绵不绝。",
      passiveBonus: { speedBonus: 2 },
    },
    {
      id: "kf_yizidianjian", name: "一字电剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      unlock: { faction: "青城派", rep: 80, member: true, note: "需拜入青城派且声誉 ≥ 80（或完成主线「青3·伏龙观下的三十年前剑约」获青霞子亲授）" },
      moveType: "攻击",
      // forceFirst：走"快如闪电"这条线最贴切的现成标志位——无视身法强行先手
      //（见 resolveTurn.js 同类型对撞的判定）。不卖，练功堂秘传。
      forceFirst: true,
      desc: "青城剑法练到极处的一式。不走弧、不带转，剑自鞘中直出一线，快到看不见剑身只看见一道白。全套只此一招，因为再多一招就慢了。青霞子说这一剑他练了四十年，「前三十九年在练怎么不出这一剑」。",
    },
    {
      id: "kf_ziyang", name: "紫阳神功", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 200,
      unlock: { faction: "青城派", rep: 80, member: true, note: "需拜入青城派且声誉 ≥ 80（青城派开门收徒后方可求教）" },
      moveType: "防御",
      desc: "青城派镇山内功，取紫阳真人丹道之意。气沉丹田后不外放，只在周身经脉里反复淬炼，久之皮肉筋骨皆如浸过药水。练成者不显山不露水，挨打时才看得出分别——同样一剑，别人见血，他只留一道白痕。练岔了会浑身发烫三日不退。",
      passiveBonus: { maxHp: 35 },
    },
    {
      id: "kf_qingling", name: "青灵功", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 60,
      moveType: "回气",
      desc: "辅修内功，与紫阳神功一刚一柔。不增气血只理气机，呼吸间自行归拢散逸的内力，久战不虚。玉真子拿它比作药圃的水渠——「渠通了，水自己会流到该去的地方，不必你一瓢一瓢舀」。",
      passiveBonus: { maxHp: 8 },
    },
    {
      id: "kf_qingfengbu", name: "清风步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 40,
      unlock: { faction: "青城派", rep: 15, member: false, note: "无需拜师，青城派声誉 ≥ 15（颇具善缘）" },
      moveType: "状态",
      desc: "青城入门轻功，梯云纵的根基。不比谁跳得高，只讲一个「轻」字——踩过青苔不留痕，穿过竹林不惊鸟。持堂道人考校弟子的法子是在练功堂地上铺一层香灰，走一趟，看脚印深浅。",
      passiveBonus: { speedBonus: 1 },
    },
  ];

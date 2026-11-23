// 武学目录·鱼定（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const yuding = [
    {
      id: "kf_yuding_biandan", name: "茶马挑担棍", type: SKILL_TYPE.MOVE, quality: "白", price: 25,
      moveType: "攻击",
      lowHpBonus: 0.2,
      unlock: { faction: "鱼定村", rep: 0, note: "鱼定村声誉 ≥ 0（晒谷演武场公开可学）" },
      desc: "雅江到鱼定滩的脚夫挑着百斤砖茶走山路，遇上恶狗山贼全靠手里这根桑木扁担。没那么多花哨起手，人越累、路越窄，横扫出去那一下越狠——保住担子就保住了全家一年的口粮。",
    },
    {
      id: "kf_yuding_zaohuo", name: "灶火调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.06,
      unlock: { faction: "鱼定村", rep: 0, note: "鱼定村声誉 ≥ 0（晒谷演武场公开可学）" },
      desc: "老孙守在滚烫羊汤锅前二十年磨出的换气法子：灶烟呛人的时候把气沉到脐下，等锅盖一掀再顺着热气吐匀。老孙说练武跟熬汤一样，火太急容易糊底，气顺了才经得起熬。",
    },
    {
      id: "kf_yuding_bozhu", name: "算盘拨珠手", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "防御",
      onCounterSuccessEnergyGain: 3, onCounterSuccessDamageRatio: 0.25,
      unlock: { faction: "鱼定村", rep: 15, note: "鱼定村声誉 ≥ 15（颇具善缘）" },
      desc: "才旦拿算盘教出来的巧劲：来势再凶，先拿两指像拨下珠似的轻轻一搭一滑，把对方的蛮力撇歪半寸，顺手再还一记快戳。她说这叫「进出平账」——谁打了你，当场就得把本利拨回来。",
    },
    {
      id: "kf_yuding_zhagen", name: "界石扎根功", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 75,
      moveType: "防御",
      passiveBonus: { maxHp: 14 },
      unlock: { faction: "鱼定村", rep: 15, note: "鱼定村声誉 ≥ 15（颇具善缘，泽仁村长点拨）" },
      desc: "当年全村汉子替老土司修水渠、抬青石界碑时练出来的笨内功。双脚抓地如老树盘根，不求轻灵飘逸，只求被人推一把、踹一脚时脊梁骨纹丝不动。",
    },
    {
      id: "kf_yuding_xunzong", name: "踏雪寻踪步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 110,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "鱼定村", rep: 40, quest: ["yudingcun_side1_yushan_chuhuan"], note: "鱼定村声誉 ≥ 40，并完成支线《村支1·熊山除患》" },
      desc: "老猎户桑登在熊山积雪里踩了四十年的步子。脚尖先探虚实，脚跟不落死力，踩在半尺厚的雪壳上只留浅浅一印。学会了这步法，跑山道比寻常江湖客快出半个身位。",
    },
    {
      id: "kf_yuding_bopi", name: "熊山剔骨刀", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      forceCrit: { multiplier: 1.45 },
      unlock: { faction: "鱼定村", rep: 40, quest: ["yudingcun_side1_yushan_chuhuan"], note: "鱼定村声誉 ≥ 40，并完成支线《村支1·熊山除患》" },
      desc: "老猎户剥熊皮、卸羊骨的刀法，绝不跟硬骨头死磕，专挑筋膜缝隙往里递。桑登从不叫它武功，只说「牲口和恶人都一样，找准了软处，一刀就省力」。",
    },
    {
      id: "kf_yuding_fuxi", name: "熊山伏息术", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      moveType: "防御",
      immuneControl: true, energyRestore: 6,
      unlock: { faction: "鱼定村", rep: 80, quest: ["village5_laolieshu_chuanren"], note: "鱼定村声誉 ≥ 80，并完成《村5·老猎户的传人》得桑登亲传" },
      desc: "老猎户压箱底的雪窝绝活。大雪夜埋伏猛兽时，把心跳压得像冻住的溪水，寒风吹不乱、虎啸震不慌，任对手点穴缠丝也锁不住这口潜气，反倒能借对方招老的空档喘回满胸真元。",
    },
  ];

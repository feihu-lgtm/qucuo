import { BUILDING_TYPE } from "../buildingType.js";

export const qionglong = [
  {
    id: "inn_qionglong", name: "煨桑皮货店", type: BUILDING_TYPE.INN, innPrice: 15,
    desc: "外城平顶黑石客店，火塘终年焚烧松柏枝与苦艾，供掘藏散人与矿商歇脚。",
  },
  {
    id: "shop_qionglong", name: "黑石山民集", type: BUILDING_TYPE.SHOP, shopKey: "黑石山民集",
    desc: "象雄遗民聚居的石板街市，售卖矿石、骨器、青稞铁朵玛与天铁小器。",
  },
  {
    id: "forge_qionglong", name: "天铁矿炉坊", type: BUILDING_TYPE.FORGE,
    desc: "苯门辖下的冶铁重地，以雪山雷击天铁与寒铁混锻九股黑杵与掘藏钢钎。",
  },
  {
    id: "kitchen_benmen", name: "青稞朵玛庄房", type: BUILDING_TYPE.KITCHEN,
    desc: "领地庄户缴纳青稞炒面与酥油的总坊，门人在此揉制坚如铁石的朵玛与干粮。",
  },
  {
    id: "sect_entry_benmen", name: "左旋雍仲正门", type: BUILDING_TYPE.SECT_ENTRY, sect: "古象雄苯门",
    desc: "嵌着十八具逆时针黑铜经轮的平顶巨石城门，九乘长老木雅仲巴于门内收徒。",
  },
  {
    id: "wuguan_benmen", name: "琼鸟九乘武馆", type: BUILDING_TYPE.WUGUAN, skillSet: "苯门",
    desc: "黑门授武大坪，金翅武师阿古顿巴在此传授《象雄大鹏爪》《九宫算路手》等苯门武学。",
  },
  {
    id: "sectshop_benmen", name: "掘藏奇珍阁", type: BUILDING_TYPE.SECTSHOP, shopKey: "掘藏奇珍阁",
    desc: "收纳历代掘藏师从深山岩缝与古塔地底刨出的羊皮秘籍、天铁兵刃与兽面具。",
  },
  {
    id: "library_benmen", name: "九宫卜算楼", type: BUILDING_TYPE.LIBRARY,
    desc: "苯门前四乘卜算重地，藏有大量羊皮古卷与九宫星象图。",
  },
  {
    id: "hospital_benmen", name: "中阴度亡医窟", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
    desc: "前四乘「驱邪、度亡」医理所在，以矿物药石与金针将濒死之人从鬼门关拽回。",
  },
  {
    id: "temple_benmen", name: "辛饶大鹏正殿", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
    desc: "八根整石黑柱撑起的平顶主殿，供奉骑金翅大鹏的祖师辛饶米沃黑铜像。",
  },
];

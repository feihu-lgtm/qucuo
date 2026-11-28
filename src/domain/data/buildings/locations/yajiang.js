import { BUILDING_TYPE } from "../buildingType.js";

  // ── 雅江（6 种，雨城竹海·青城派） ──
export const yajiang = [
    {
      id: "restaurant_yajiang", name: "青衣楼", type: BUILDING_TYPE.RESTAURANT, menuKey: "冷锅鱼",
      desc: "江门街最大的冷锅鱼老字号。冷锅底料铺上七分熟江团鱼片，不开火先吃鱼，一锅两吃。雅江人待客必点。",
    },
    {
      id: "shop_yajiang", name: "雅纸铺", type: BUILDING_TYPE.SHOP, shopKey: "雅纸铺",
      desc: "青衣江竹子做的纸，薄而韧，墨迹存百年不褪。兼营竹编器物、日用杂货。",
    },
    {
      id: "transport_yajiang", name: "西城门驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "驿道尽头界碑「曲措乡界」。骡马夫专做最后一段路的生意——再往里走官道没了。",
    },
    {
      id: "temple_yajiang", name: "伏龙观", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "离堆顶上供奉李冰父子。最后一进悬在崖边，推窗即是奔腾岷江。老道士说这是李冰在下面翻身。",
    },
    {
      id: "wuguan_yajiang", name: "青城派·三清殿", type: BUILDING_TYPE.WUGUAN, skillSet: "青城",
      desc: "青城派正殿。入门先站桩——站在宝瓶口江边，水没脚踝，站半日。站住了才教剑。",
    },
    {
      id: "hospital_qingcheng_yaopu", name: "青城药圃", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "玉真子坐镇的后山草药庐，给药不给方子。雅江的郎中求不来的药，在这里一帖帖配好。",
    },
    {
      id: "sectshop_yajiang", name: "三清玄阁", type: BUILDING_TYPE.SECTSHOP, shopKey: "青城商坊",
      desc: "设在三清殿偏庑的门内库房，由持堂道人兼管账目，只认青城声誉与门中功劳，寻常银两买不走里头的紫阳丹与松纹剑。",
    },
    {
      id: "sect_entry_yajiang", name: "青城山山门", type: BUILDING_TYPE.SECT_ENTRY, sect: "青城派",
      desc: "石砌牌坊额书青城二字。不收富贵子弟捐纳——想入门，先去江边站桩，站住了再说。",
    },
    {
      id: "yajiang_chensha_dock", name: "沉沙古坞", type: BUILDING_TYPE.DUNGEON, dungeonId: "yajiang_chensha_dock",
      desc: "安澜索桥下游悬崖底藏着的一处沉船旧坞，治水暗闸与盐帮沉银引起巴蜀群雄云集抢宝。",
    },
];

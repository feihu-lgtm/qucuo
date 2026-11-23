import { BUILDING_TYPE } from "../buildingType.js";

  // ── 天龙营（西风隘）：玄甲军与白衣旧部隔谷对峙的连营 ──
export const tianlongying = [
    {
      id: "sect_entry_tianlong", name: "天龙点将台", type: BUILDING_TYPE.SECT_ENTRY, sect: "天龙教",
      desc: "黑石高台，牛皮大鼓裂了口。台下插着一圈断刀——接不住三招的，刀留下，人下山。厉苍龙在此收人，只看拳头与办差。",
    },
    {
      id: "wuguan_tianlong", name: "西风演武场", type: BUILDING_TYPE.WUGUAN, skillSet: "天龙",
      desc: "玄甲军操练的夯土大坪，号子声压过风声。外来的拳师想挣一声服气，先得上坪里走几招。",
    },
    {
      id: "sectshop_tianlong", name: "天龙军需坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "天龙军需坊",
      desc: "半敞的皮顶货棚，弯刀皮甲止血散一应俱全。军需官记账先看你脸——在天龙教挣的声名，在这里直接抵银子。",
    },
    {
      id: "forge_xifeng", name: "西域铁砧炉", type: BUILDING_TYPE.FORGE,
      desc: "依岩壁砌的两座炭炉，火色不熄。砧上打的不是农具——弯刀、马镫、玄甲的铆片。",
    },
    {
      id: "hospital_xigu", name: "西谷草药棚", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "白衣旧部的药庐，檐下挂满晾着的草药，苦味顺谷口往外飘。贺兰昭的火候比军营规矩还硬。",
    },
    {
      id: "inn_xifeng", name: "风沙客帐", type: BUILDING_TYPE.INN, innPrice: 25,
      desc: "避风坡上几顶驼毛毡帐，火塘边常备酽茶烤饼，专收过路商旅与说不上来路的人。",
    },
    {
      id: "library_tianlong", name: "止戈经帐", type: BUILDING_TYPE.LIBRARY,
      desc: "安静得不像军营的经帐，毡壁上挂着褪色的白帆，案上摊着写满经文的羊皮卷。",
    },
    {
      id: "tianlong_serpent_crypt", name: "摩呼罗迦蛇窟", type: BUILDING_TYPE.DUNGEON, dungeonId: "tianlong_serpent_crypt",
      desc: "沙坡下垂着蟒皮帘的西域秘窟，陶瓮成列，深处盘坐天龙八部护法。",
    },
];

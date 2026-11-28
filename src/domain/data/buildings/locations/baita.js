import { BUILDING_TYPE } from "../buildingType.js";

export const baita = [
  {
    id: "library_baita",
    name: "唐蕃会盟古碑",
    type: BUILDING_TYPE.LIBRARY,
    desc: "藏汉双文碑刻古亭，守塔僧人在此收存前朝碑拓与密宗旧卷。",
  },
  {
    id: "wuguan_baita",
    name: "铁网护法武馆",
    type: BUILDING_TYPE.WUGUAN,
    skillSet: "喇嘛庙",
    desc: "守塔武僧在此传授沉重降魔杵法与铁网护体硬功，与西面琼隆古墟隔谷相望。",
  },
  {
    id: "temple_baita",
    name: "哑钟石亭",
    type: BUILDING_TYPE.TEMPLE,
    karmaPerPray: 10,
    desc: "悬着三十年未响青铜大钟的石亭，静心祈福参悟可添定力。",
  },
  {
    id: "baita_crypt_entrance",
    name: "白塔地宫",
    type: BUILDING_TYPE.DUNGEON,
    dungeonId: "white_pagoda_crypt",
    innerRoom: "白塔地宫",
    desc: "白塔基座深处的藏传地宫入口，石阶湿冷，深处传出铁网与降魔杵的回响。",
  },
];

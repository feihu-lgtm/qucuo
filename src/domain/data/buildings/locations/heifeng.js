import { BUILDING_TYPE } from "../buildingType.js";

  // ── 黑风寨（4 种，义匪山寨·狼曲响马） ──
export const heifeng = [
    {
      id: "sect_entry_heifeng", name: "聚义岩洞", type: BUILDING_TYPE.SECT_ENTRY, sect: "黑风寨",
      desc: "寨后岩洞深处只摊着一张狼曲地形图和几把旧刀，没有虎皮大椅。巴桑在这儿见客、收投名状——入伙不磕头，只问一句寨规守不守得住。",
    },
    {
      id: "wuguan_heifeng", name: "后山演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "黑风",
      desc: "后山草坡往里的一片碎石坪，寨里的刀口在这对练。彭措管着场子，外人想搭手先过他这关——不许下黑手，不许淬毒。",
    },
    {
      id: "sectshop_heifeng", name: "山寨货栈", type: BUILDING_TYPE.SECTSHOP, shopKey: "黑风货栈",
      desc: "岩壁下凿出的石仓，码着下山得的正经货和寨里自酿的土烧。仓头按寨规做买卖：玉泉寨的乡亲按本钱算，官家的货加价，外人看巴桑的面子。",
    },
    {
      id: "kitchen_heifeng", name: "伙房大灶", type: BUILDING_TYPE.KITCHEN,
      desc: "寨门东侧的露天大灶，老阿雅婶掌勺。出征前一席饭全员同吃是寨规，铁锅底结着十几年的锅巴，熬出来的牦牛肉汤格外厚。",
    },
    {
      id: "heifeng_wolf_cavern", name: "狼曲旧契藏窟", type: BUILDING_TYPE.DUNGEON, dungeonId: "heifeng_wolf_cavern",
      desc: "寨后柴垛掩盖的夹缝密道，直通狼曲绝崖藏窟与十年前血账旧地。",
    },
];

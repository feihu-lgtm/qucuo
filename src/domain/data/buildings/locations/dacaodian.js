import { BUILDING_TYPE } from "../buildingType.js";

  // ── 大草甸：血刀磨刀坪挂在已有的血刀营地内层房间 ──
export const dacaodian = [
    {
      id: "wuguan_xuedao", name: "血刀磨刀坪", type: BUILDING_TYPE.WUGUAN, skillSet: "血刀",
      desc: "营地正中一片踩得发亮的磨刀坪，刀口磨出火星，血腥味混着铁屑味。血刀部的路数不问出身，想学先把手伸出来让刀认一认。",
    },
    {
      id: "dacaodian_duanan_post", name: "断鞍古驿", type: BUILDING_TYPE.DUNGEON, dungeonId: "dacaodian_duanan_post",
      desc: "大草甸东隅荒废多年的军马古驿，残墙底下暗道纵横，天龙、血刀、黑风与各路散客正聚在里面抢宝火并。",
    },
];

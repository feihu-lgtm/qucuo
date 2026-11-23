import { BUILDING_TYPE } from "../buildingType.js";

  // ── 鱼定土司府（合稿·土司府 2.2；客卿偏仓要接家园存取，暂不开） ──
export const yudingTusi = [
    {
      id: "bounty_yudingtusi", name: "土司府缉捕榜", type: BUILDING_TYPE.BOUNTY,
      desc: "府门前厅一侧的乌木告示板，贴满了盖着土司云雷铜印的海捕文书：抗税刁民、劫道马匪、走私盐贩，赏银写得明明白白。",
    },
    {
      id: "wuguan_yudingtusi", name: "巡捕营校场", type: BUILDING_TYPE.WUGUAN, skillSet: "土司",
      desc: "护卫厅外夯得发亮的黄土校场，兵器架上插着制式短矛和铁柄马刀。格桑顿珠的规矩：交得起学费的，不问来路都能学两手。",
    },
    {
      id: "shop_yudingtusi", name: "土司府军需司", type: BUILDING_TYPE.SECTSHOP, shopKey: "土司军需司",
      desc: "西厢外院的军需库房，柜台后的差役拨着算盘，给巡捕营发军粮、卖铠甲。外客照价，府里信得过的人能打折。",
    },
    {
      id: "library_yudingtusi", name: "档册文书房", type: BUILDING_TYPE.LIBRARY,
      desc: "议事厅东侧的长屋，架上堆满鱼定一带的税册、地契抄本和户籍账。主簿洛桑平措记性极好，哪年哪户欠了几升青稞都背得出来。",
    },
    {
      id: "pigeon_yudingtusi", name: "官驿鸽棚", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 1,
      desc: "府门檐下的鸽棚，养着往锦官城、雅江递公文的官鸽，鸽爪上的铜环刻着土司府的云雷纹。",
    },
    {
      id: "chest_yudingtusi", name: "客卿偏仓", type: BUILDING_TYPE.CHEST, house: "鱼定土司府客卿偏仓", emptyStock: true,
      faction: "鱼定土司府", minRep: 40,
      repLocked: "看库的老差役把钥匙往怀里一揣：「偏仓只给府里的客卿用。等你在土司府说得上话（声誉 ≥ 40）再来。」",
      desc: "库房一角隔出来的杉木库箱，箱盖烙着土司府的云雷徽记，供受聘客卿与巡边差官暂存行囊军械。",
    },
];

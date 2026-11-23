import { BUILDING_TYPE } from "../buildingType.js";

  // ── 雪山派（2 种，隐世门派） ──
export const xueshan = [
    {
      id: "wuguan_xueshan", name: "雪山练功堂", type: BUILDING_TYPE.WUGUAN, skillSet: "雪山",
      desc: "雪山派对弟子开放的练功场地，外人能进此堂，说明已得门派一定程度的认可。",
    },
    {
      id: "sectshop_xueshan", name: "门派商坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "门派商坊",
      desc: "沈既白打理的石木杂轩，架上除了寒铁兵器与雪山药膏，还替门人备着从鱼定村背上来的粗盐和酥油茶。外客只按规矩买卖，门墙中人方能见识里柜的真货。",
    },
    {
      id: "sectentry_xueshan", name: "拜师堂", type: BUILDING_TYPE.SECT_ENTRY,
      desc: "内堂正中，何雨谢坐镇处。掌门不在山上这些年，收不收徒都是她一句话。入了门便是雪山派弟子，领一枚令牌——那令牌也是弟子别院的钥匙。",
    },
    {
      id: "kitchen_bieyuan", name: "弟子别院·灶房", type: BUILDING_TYPE.KITCHEN,
      desc: "弟子别院西厢的小灶，何雨谢偶尔在此给弟子炖雪鸡汤。灶膛里松柴火常年不熄。",
    },
    {
      id: "chest_bieyuan", name: "弟子别院·库房", type: BUILDING_TYPE.CHEST, house: "弟子别院",
      desc: "东厢卧房床头那只小木箱，放私物刚好。箱底也有一份食材家底。",
    },
    {
      id: "inn_xueshan", name: "雪山客舍", type: BUILDING_TYPE.INN, innPrice: 15,
      desc: "贴着山门东侧砌出的四间避风石舍，炕底连着地龙火道，被褥带着松针晒过的干爽气。若遇大雪封道，山门也绝不把赶路人关在风雪外头。",
    },
    {
      id: "hospital_xueshan_wenquan", name: "后山温泉", type: BUILDING_TYPE.HOSPITAL,
      desc: "雪崖裂隙间涌出的滚烫硫磺热泉，白雾终年不散，浸入半炷香便能逼出深骨寒毒与内外暗伤。何雨谢立了规矩：一炷香便得起身，再泡下去补的是懒，不是气。",
    },
    {
      id: "library_xueshan", name: "寒玉旧剑阁", type: BUILDING_TYPE.LIBRARY,
      desc: "深藏内堂后壁的寒玉暗阁，木架上封存着雪山百年剑论、川西正道旧函与三十年前的未完手札。落灰极厚，却处处擦拭得没有半点潮霉。",
    },
];

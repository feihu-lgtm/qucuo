import { BUILDING_TYPE } from "../buildingType.js";

export const shunanTangbao = [
    {
      id: "wuguan_tangmen", name: "千机演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "唐门",
      desc: "满地机关暗桩与会转身的铁皮假人，练的不是堂堂正正的招架，是在别人眨眼的半息里把暗器送进缝隙的本事。",
    },
    {
      id: "sectshop_tangmen", name: "唐堡内库", type: BUILDING_TYPE.SECTSHOP, shopKey: "唐门暗器",
      desc: "不对生客开放的石砌货房，凡本门弟子与信重客卿凭令牌入内，方能取到暗巷铺面绝不外摆的精巧机弩与高阶解毒秘药。",
    },
    {
      id: "hospital_tangmen", name: "试毒药庐", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "既是练毒的灶，也是救命的堂；世上最狠的毒往往和最灵的解药同出一炉，只要出得起银子，断气前总能拉回来半口。",
    },
    {
      id: "sect_entry_tangmen", name: "宗祠·入堂石", type: BUILDING_TYPE.SECT_ENTRY, sect: "唐门",
      desc: "唐家宗祠门前的入堂石，向唐老太行礼立誓、滴血入槽，便领一块玄竹弟子令。",
    },
    {
      id: "tangmen_poison_vault", name: "唐堡试毒暗阁", type: BUILDING_TYPE.DUNGEON, dungeonId: "tangmen_poison_vault",
      desc: "外姓竹坞尽头的唐门试毒暗阁，朱签陶瓮与千机暗弩交错，深处封存孤本暗器。",
    },
];

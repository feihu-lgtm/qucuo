import { BUILDING_TYPE } from "../buildingType.js";

  // ── 鱼定村（7 种，枢纽村） ──
export const yudingCun = [
    {
      id: "pigeon_coop_xibian", name: "鸽子笼", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 2,
      desc: "溪边小屋屋檐下钉着的一只竹编鸽笼，两只灰鸽咕咕地叫，脚环上刻着编号。原先它只是家园面板里的一个图标，现在挂回屋檐底下——站在院子里才够得着。",
    },
    {
      id: "inn_yiding", name: "歇马居", type: BUILDING_TYPE.INN, innPrice: 5,
      desc: "三曲交汇的老客栈，门匾褪色，炉火常年不灭，商旅猎人惯于落脚。",
    },
    {
      id: "shop_yiding", name: "鱼定商号", type: BUILDING_TYPE.SHOP, shopKey: "鱼定商号",
      desc: "村里最全的杂货铺，武器杂物一应俱全，掌柜是个寡言的汉子。",
    },
    {
      id: "restaurant_yiding", name: "老孙饭馆", type: BUILDING_TYPE.RESTAURANT, menuKey: "饭馆",
      desc: "村里唯一的饭馆，菜式简单，但牦牛骨汤是一绝，吃了腿脚有劲。",
    },
    {
      id: "transport_yiding", name: "驿站", type: BUILDING_TYPE.TRANSPORT,
      desc: "备有脚力和驾车人，花银两可直接抵达已探索的其他据点，不走山路。",
    },
    {
      id: "escort_yiding", name: "护镖站", type: BUILDING_TYPE.ESCORT, shopKey: "护镖站",
      desc: "接押送任务，货到对方手上结算。途中遭遇的可能性比单独走更高。",
    },
    {
      id: "grocery_yiding", name: "杂货铺", type: BUILDING_TYPE.GROCERY, shopKey: "杂货商人",
      desc: "杂货商人在此驻店，日用杂物、草药糌粑都有，是村里最热闹的角落。",
    },
    {
      id: "gambling_yiding", name: "赌坊", type: BUILDING_TYPE.GAMBLING, maxBet: 200,
      desc: "每日只能赌一次，按气运值决定输赢，也可以直接抽物品，看命。",
    },
    {
      id: "pigeon_coop_yiding", name: "鸽子笼", type: BUILDING_TYPE.PIGEON_COOP, dailyPigeons: 3,
      desc: "村口老槐树下支着几间竹编鸽笼，看笼的老汉每日清晨放三只信鸽出来，任由往来客商领去，图的是曲措乡这条邮路越走越熟。",
    },
    {
      id: "med_xitou", name: "西头药铺", type: BUILDING_TYPE.MEDICINE, shopKey: "西头药铺",
      desc: "管家小舅子开的药材铺子，药柜锁得比别家都严实，金疮药、止血散倒是常年有货，价钱比别处贵一截。",
    },
    {
      id: "wuguan_shaiguchang", name: "晒谷演武场", type: BUILDING_TYPE.WUGUAN, skillSet: "鱼定",
      desc: "村长院后侧一片压得死实的夯土晒谷场，秋收晒青稞，平日里老猎户和护镖老卒就在这儿指点村中后生练些护身实招。",
    },
    {
      id: "forge_yiding", name: "铁匠铺", type: BUILDING_TYPE.FORGE,
      desc: "村东头一间冒着黑烟的铁匠铺，老铁匠祖上三代打铁，寻常农具兵器都能打，也接客人拿料定制的活计。",
    },
    {
      id: "kitchen_xibian", name: "溪边小屋·灶房", type: BUILDING_TYPE.KITCHEN,
      desc: "灶台上铁锅铜壶齐整，灶膛余烬未冷。溪边小屋的灶房，一口旧铁锅炖炒皆可。有食材就能开火，自炊出 buff。",
    },
    {
      id: "chest_xibian", name: "溪边小屋·库房", type: BUILDING_TYPE.CHEST, house: "溪边小屋",
      desc: "起居室床底那只铁皮包角的旧木箱。开张时里头已备下一套食材调味料——是这屋子原先的主人留下的家底。",
    },
];

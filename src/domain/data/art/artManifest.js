// 美术素材登记表：游戏按字段查图，查到的才显示，查不到就只显示文字。
// 文件放在 public/art/<类>/<文件名>.webp（地点、建筑 600×300 的 2:1；舆图 1024 方；一律 webp，不入库 png），
// 这里只登记「谁有图、文件叫什么」。
// 新图入库：把切好的 webp 放进对应目录，再在下面登记一行；scripts/art/artManifest.test.js 会核对
// 登记的名字在游戏数据里真实存在、登记的文件确实在目录里。
//
// 键的口径与 scripts/art/artPrompts.mjs 的格子 keys 一致：
//   PLACE_ART       外层据点名（QUCUO_MAP 的键）→ 文件名
//   BUILDING_ART    建筑类型（BUILDING_TYPE 的值）→ 文件名
//   BUILDING_ID_ART 个别建筑专图（建筑 id）→ 文件名，优先于类型图；给后山温泉、令狐冲墓这类
//                   用通用类型图会画错的地方单独配图
//   HOME_ART        家园设施 id（HOMESTEAD_FEATURES 里的 id）→ 文件名
//   MAP_ART         舆图底卷（M01）文件名，放 public/art/map/；没有就为 null，大地图只用代码画

export const PLACE_ART = Object.freeze({
  "鱼定村": "L01",
  "鱼定土司": "L02",
  "喇嘛庙": "L03",
  "白塔": "L04",
  "后山平台": "L05",
  "雪山派": "L06",
  "山洞": "L07",
  "顶峰": "L08",
  "天都镇": "L09",
  "大草甸": "L10",
  "玉泉寨": "L11",
  "黑风寨": "L12",
  "贡措海": "L13",
  "雅江": "L14",
  "广汉": "L15",
  "锦官城": "L16",
  "天龙营": "L17",
  "雾隐寨": "L18",
  "蜀南唐堡": "L19",
  "心灵之海": "L20",
  "第三新东京市": "L21",
});

export const BUILDING_ART = Object.freeze({
  antique: "antique",
  auction: "auction",
  bank: "bank",
  blackmarket: "blackmarket",
  bounty: "bounty",
  chest: "chest",
  cloth: "cloth",
  dungeon: "dungeon",
  escort: "escort",
  festival: "festival",
  forge: "forge",
  gamblestone: "gamblestone",
  gambling: "gambling",
  grocery: "grocery",
  hospital: "hospital",
  inn: "inn",
  jewelry: "jewelry",
  kitchen: "kitchen",
  library: "library",
  medicine: "medicine",
  pawn: "pawn",
  pigeon_coop: "pigeon_coop",
  restaurant: "restaurant",
  sect_entry: "sect_entry",
  sectshop: "sectshop",
  shop: "shop",
  smithy: "smithy",
  teahouse: "teahouse",
  temple: "temple",
  theater: "theater",
  transport: "transport",
  wuguan: "wuguan",
});

export const BUILDING_ID_ART = Object.freeze({});

// 家园设施图：蜀王庄书房（library）尚未跑图，查不到时设施卡片保留原样。
export const HOME_ART = Object.freeze({
  cooking: "home-cooking",
  fireplace: "home-fireplace",
  garden: "home-garden",
  guqin: "home-guqin",
  meditation: "home-meditation",
  study: "home-study",
  telescope: "home-telescope",
  training: "home-training",
  wine: "home-wine",
});

export const MAP_ART = "qucuo";

export const NPC_ART = Object.freeze(["阿财","阿呆","阿赌","阿萝","阿奴","阿萨辛","阿翔","阿雅","阿芷","巴登阿妈","巴桑","白凌霜","白玛次仁","白婶","白术","白猿","才旦","苍青","馋鸡偃甲","陈九","陈默","持堂道人","赤练","赤练金雕","赤碳","赤瞳貂","赤羽","楚绘","次仁","崔市隐","达摩药堂师父","大公鸡","大胡子朱四","大桃子","丹巴","丹增","刀疤镖师","段履霜","断雷","多吉","樊枯","樊未离","梵衍那","风吹雪","凤鸣","符鬼","嘎则","赶马人阿旺","格桑顿珠","贡布","顾狂澜","挂单道人","关晚棠","管家·陆福生","归隐剑客","寒魄","韩菱纱","何雨谢","贺兰昭","赫连铸","黑风寨采买","黑骨","黑云踏雪","红葵","红莲","红鳞","侯敢","呼延雪","胡三爷","虎王","护谷弟子","花婆","花嫂","花楹","姬无双","纪纹","江小彤","姜泠","姜云凡","街头混混","金冠灵蛇","锦官差役","景天","净莲","磕长头的朝圣者","喇嘛庙住持","来访武者","兰姐","蓝婷","狼王","老阿雅婶","老兵退伍汉","老道士","老何","老孙","了因师太","愣头侠客","李若由","李逍遥","李掌柜","厉苍龙","厉苍山","厉苍天","厉天行","林月如","灵蛇","凌香儿","柳梦璃","柳青鸢","龙葵","龙汐月","陆寒枝","陆濯尘","吕仙儿","罗布桑","罗那","罗琦","罗蛇君","骡马夫","洛桑","洛桑平措","落第书生","麻九娘","梅朵","明日香","墨童","墨团","木人桩改","穆怀青","聂秋红","欧阳雪","裴惊蛰","裴九江","彭措","彭老四","破军傀","七彩","齐丽","齐照野","乞丐老七","秦红殇","秦小鹊","青铜面人·丙","青铜面人·甲","青铜面人·乙","青铜偃甲","青霞子","青玄","青衣楼老板娘","曲灵犀","曲艳丝","曲幽竹","任清璇","任天翔","肉包","桑杰","桑杰朵杰","桑七","商葶苧","上官虹","沈归尘","沈既白","沈澜","沈湘芸","沈濯清","石墩儿","食蛊鸟","史燕","霜华剑魄","霜魄","霜影","说书人陈七","司徒瑛","松鹤道长","宋小乙","苏宛","苏小青","苏折柳","素商的青鸟","孙文墨","索朗","踏云","太岁","探路灵鼠","唐伯渊","唐老太","唐听竹","唐雪见","唐仲衡","铁伯","铁莲和尚","铁牛","王蓉","旺堆","薇霓","卫紫绫","温掌柜","乌婆婆","乌鸦","无尘","戏班旦角","仙音","仙音的青鸟","香客老夫人","萧沉戟","小蝉","小哼","小虎煞","小牧童阿索","小石头","小野猪","行脚僧","虚白道姑","玄尘师太","玄甲赤骥","玄女","雪豹","雪女之影","雪山弟子","雪山银豹","血刀门徒·初七","血刀门徒·廿三","血刀门徒·十三","荀杳杳","哑巴七","胭脂扣","胭脂贼","严九斤","魇兽幼体","燕绾烟","燕未还","瑶姬","药王幽魂","一清道长","殷如月","幽光灵蛾","油嘴小贩","游方道人","鱼定大娘","虞照夜","玉真子","元朵朵","云天河","杂耍艺人","簪娘","泽仁","扎西","张商人","招财童子","赵灵儿","赵雅儿","照微","珍珠","周铭章","周小满","柷敔灵卵","卓玛","卓央","紫灵梦貘","紫萱","紫玉","纵目者","醉花","醉仙蝶"]);

export const ITEM_ART = Object.freeze(["accessory-beads","accessory-charm","accessory-fang","accessory-hairpin","accessory-jade","accessory-mirror","accessory-ring","accessory-sachet","accessory-token","armor-apron","armor-cloth","armor-fur","armor-guard","armor-heavy","armor-leather","armor-monk","armor-soft","armor-taoist","misc-food","misc-herb","misc-key","misc-letter","misc-pill","misc-silver","misc-sutra","misc-talisman","misc-wine","weapon-crossbow","weapon-dagger","weapon-hammer","weapon-hidden","weapon-saber","weapon-spear","weapon-staff","weapon-sword","weapon-whip"]);

export const QUEST_ART = Object.freeze(["baihuamen_1_huajiufengbo","baihuamen_2_guyinganxiang","baihuamen_3_shixinyudu","baihuamen_4_wuxianjiuan","baihuamen_5_hualuotusi","baihuamen_rank_yinmeiling","baihuamen_rank_zunke","baihuamen_side_1_tuimozhang","baihuamen_side_2_shishuzudecha","baihuamen_side_3_duanyucaique","divine_budongmingwang","divine_dizang","divine_huxiao","divine_niepanyin","divine_shuangtianyue","emei_1_xichengshiyao","emei_2_fodaoshilian","emei_3_minjiangjiuyue","emei_4_jianchujinding","emei_cangjian_yinjian","emei_sub1_chaojingbashiba","emei_sub2_baiyuanshiyuan","emei_sub3_duanzanzhuihen","finale_neutral_baihua","finale_neutral_huanxi","finale_neutral_lama","finale_neutral_xueshan","gaibang_1_yiwanxizhou","gaibang_2_taomindejiaoyin","gaibang_3_zhangmuhedui","gaibang_4_jiuenyuxinzhai","gaibang_5_shiliudagouzhen","gaibang_join_xiaokao","gaibang_s1_xujiejiuyue","gaibang_s2_jianluyiyao","gaibang_s3_jiuguiduzu","gaze_1_mitu","gaze_2_xiashan","gaze_3_buhuan","heifengzhai_1_wolu_yufei","heifengzhai_2_meimeidexiaoxi","heifengzhai_3_5_jieyao","heifengzhai_3_shangshan","heifengzhai_4_guanjiadetongjiling","heifengzhai_5_langyanjiuzhang","huanxijiao_1_xiangzhongyi","huanxijiao_2_biwuzhaoxian","huanxijiao_3_guanjiadetanzi","huanxijiao_4_jinguanchengdeanxian","huanxijiao_5_guanjiadetuxi","huanxijiao_6_juezhanqianye","huanxijiao_6a_bangguanjia","huanxijiao_6b_bangfanyanna","huanxijiao_dive_1_caimaixiangliao","huanxijiao_dive_2_paomahuideyaoqing","huanxijiao_dive_3_gongyangyishi","huanxijiao_dive_4_yaobobiandegushi","huanxijiao_dive_5_dizidegusi","jinguancheng_guan1_xinren","jinguancheng_guan2_guitu","jinguancheng_guan2a_toukao","jinguancheng_guan2b_zhongli","jinguancheng_zhi2_tianduanxian","jinguancheng_zhi3_hongmotuming","lamamiao_1_xianghuoanying","lamamiao_2_canjuanjiuhui","lamamiao_3_xuenihongzhua","lamamiao_4_digongwenxin","lamamiao_5_zhongmingsanshinian","lamamiao_side_1_xueshancaoyao","lamamiao_side_2_jiumenraodao","lamamiao_side_3_dixiayaorou","paoma_saima","paoma_shejian","paoma_wubi","paoma_ziye","qingcheng_1_taogongdao","qingcheng_2_maoming","qingcheng_3_jianyue","qingcheng_4_shanmen_jueze","qingcheng_5_songfeng_xidu"]);

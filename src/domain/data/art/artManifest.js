// 美术素材登记表：游戏按字段查图，查到的才显示，查不到就只显示文字。
// 文件放在 public/art/<类>/<文件名>.webp（地点、建筑 600×300 的 2:1；舆图 1024 方；一律 webp，不入库 png），
// 这里只登记「谁有图、文件叫什么」。
// 新图入库：把切好的 webp 放进对应目录，再在下面登记一行；scripts/art/artManifest.test.js 会核对
// 登记的名字在游戏数据里真实存在、登记的文件确实在目录里。
// 每日随机过路人不用姓名登记：randomPassers.js 的身份模板控制 public/art/passer 下的图。
//
// 键的口径与 scripts/art/artPrompts.mjs 的格子 keys 一致：
//   PLACE_ART       外层据点名（QUCUO_MAP 的键）→ 文件名
//   BUILDING_ART    建筑类型（BUILDING_TYPE 的值）→ 文件名
//   BUILDING_ID_ART 个别建筑专图（建筑 id）→ 文件名，优先于类型图；给后山温泉、令狐冲墓这类
//                   用通用类型图会画错的地方单独配图
//   HOME_ART        家园设施 id（HOMESTEAD_FEATURES 里的 id）→ 文件名
//   ROOM_ART        外层据点名 → 内层房间显示名 → 文件名，放 public/art/room/（左栏位置模块在房间描写旁显示）
//   ITEM_NAME_ART    具名物品 → 文件名；同名不同物品时用「名称:品质」，优先于 ITEM_ART 的通用图。
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
  "打箭炉": "L22",
  "丹霞城": "L23",
  "焚风渡": "L24",
  "琼隆古墟": "L25",
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

export const BUILDING_ID_ART = Object.freeze({
  transport_dajianlu: "transport_dajianlu",
  forge_dajianlu: "forge_dajianlu",
  teahouse_dajianlu: "teahouse_dajianlu",
  wuguan_dajianlu: "wuguan_dajianlu",
  inn_dajianlu: "inn_dajianlu",
  shop_dajianlu: "shop_dajianlu",
  restaurant_dajianlu: "restaurant_dajianlu",
  medicine_dajianlu: "medicine_dajianlu",
  bounty_dajianlu: "bounty_dajianlu",
  shop_danxiacheng: "shop_danxiacheng",
  library_sajia: "library_sajia",
  inn_danxiacheng: "inn_danxiacheng",
  sect_entry_sajia: "sect_entry_sajia",
  bounty_sajia: "bounty_sajia",
  sectshop_sajia: "sectshop_sajia",
  wuguan_sajia: "wuguan_sajia",
  temple_sajia: "temple_sajia",
  chest_sajia: "chest_sajia",
  inn_fenfengdu: "inn_fenfengdu",
  shop_fenfengdu: "shop_fenfengdu",
  restaurant_fenfengdu: "restaurant_fenfengdu",
  sect_entry_gaju: "sect_entry_gaju",
  wuguan_gaju: "wuguan_gaju",
  sectshop_gaju: "sectshop_gaju",
  hospital_gaju: "hospital_gaju",
  temple_gaju: "temple_gaju",
  inn_qionglong: "inn_qionglong",
  shop_qionglong: "shop_qionglong",
  forge_qionglong: "forge_qionglong",
  kitchen_benmen: "kitchen_benmen",
  sect_entry_benmen: "sect_entry_benmen",
  wuguan_benmen: "wuguan_benmen",
  sectshop_benmen: "sectshop_benmen",
  library_benmen: "library_benmen",
  hospital_benmen: "hospital_benmen",
  temple_benmen: "temple_benmen",
});

// 内层房间专图：外层据点名 → 房间显示名 → 文件名（public/art/room/）。只登记有图的房间；
// 没登记的房间不显示图，外层据点图不受影响。
export const ROOM_ART = Object.freeze({
  "打箭炉": Object.freeze({
    "炉城东关": "dajianlu-01",
    "折多索桥": "dajianlu-04",
    "溜溜云亭": "dajianlu-07",
  }),
  "丹霞城": Object.freeze({
    "丹霞外城街": "danxiacheng-01",
    "三十六石柱大院": "danxiacheng-08",
    "龙象般若石窟": "danxiacheng-10",
    "班智达辩经坛": "danxiacheng-11",
  }),
  "焚风渡": Object.freeze({
    "焚风牛皮渡": "fenfengdu-01",
    "白牦牛官牧场": "fenfengdu-03",
    "十六白柱敞院": "fenfengdu-07",
    "口传密授石室": "fenfengdu-09",
  }),
  "琼隆古墟": Object.freeze({
    "对转铁索桥": "qionglong-01",
    "十二黑石柱王院": "qionglong-07",
  }),
});

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

export const NPC_ART = Object.freeze([
  "一清道长","七彩","上官虹","东方未明","严九斤","丹增","丹巴","乌婆婆","乌鸦","乐无异","乞丐老七","了因师太","于小雪","云天河","云无月","云霁微","秩秩","参昴","鱼丽","仙音","仙音的青鸟","任天翔","任清璇","何雨谢","侯敢","元朵朵","兰姐","关晚棠","净莲","凌香儿","凤鸣","刀疤镖师","北洛","卓央","卓玛","南宫煌","卫紫绫","厉天行","厉苍天","厉苍山","厉苍龙","史燕","叶轻崖","司徒瑛","吕仙儿","周小满","周铭章","呼延雪","哑奴","哑巴七","唐三少","唐仲衡","唐伯渊","唐听竹","唐老太","唐雪见","商葶苧","喇嘛庙住持","嘎则","墨团","墨童","多吉","大公鸡","大桃子","大胡子朱四","太岁","姜云凡","姜泠","姬无双","孙文墨","宋小乙","寒魄","小哼","小牧童阿索","小石头","小虎煞","小蝉","小野猪","山寨喽啰","崔市隐","巴桑","巴登阿妈","幽光灵蛾","张商人","归隐剑客","彭措","彭老四","影奴","愣头侠客","戏班旦角","才旦","扎西","护谷弟子","抱剑童子","拓跋玉儿","招财童子","持堂道人","挂单道人","探路灵鼠","断雷","无名暗卫","无尘","旺堆","明日香","景天","曲幽竹","曲灵犀","曲艳丝","木人桩改","杂耍艺人","杂货商人","李掌柜","李若由","李逍遥","来访武者","松鹤道长","林月如","柳梦璃","柳青鸢","柷敔灵卵","格桑顿珠","桑七","桑杰","桑杰朵杰","梅朵","梵衍那","楚绘","樊未离","樊枯","次仁","欧阳雪","段履霜","殷如月","江小彤","沈弄枢","沈归尘","沈既白","沈湘芸","沈澜","沈濯清","油嘴小贩","泽仁","洛桑","洛桑平措","温掌柜","游方道人","灵蛇","照微","燕未还","燕烈","燕绾烟","狼王","玄女","玄尘师太","玄甲赤骥","玉真子","王小虎","王蓉","珍珠","瑶姬","白凌霜","白婶","白术","白染霜","白猿","白玛次仁","百里屠苏","石墩儿","破军傀","磕长头的朝圣者","秦小鹊","秦红殇","穆怀青","符鬼","管家·陆福生","簪娘","素商","素商的青鸟","索朗","紫灵梦貘","紫玉","紫萱","红莲","红葵","红鳞","纪纹","纵目者","罗布桑","罗琦","罗蛇君","罗那","老仆阿福","老何","老兵退伍汉","老孙","老猎户","老道士","老阿雅婶","老齐","聂秋红","肉包","胡三爷","胭脂扣","胭脂贼","花婆","花嫂","花楹","苍青","苏宛","苏小青","苏折柳","荀杳杳","荆棘","药王幽魂","药童小九","萧沉戟","落第书生","蓝婷","薇霓","虎王","虚白道姑","虞照夜","血刀门徒·初七","血刀门徒·十三","血刀门徒·廿三","行脚僧","街头混混","裴九江","裴惊蛰","裴炽野","说书人陈七","谷月轩","贡布","贺兰昭","赤瞳貂","赤碳","赤练","赤练金雕","赤羽","赫连铸","赵灵儿","赵雅儿","赶马人阿旺","越今朝","越祈","踏云","达摩药堂师父","醉仙蝶","醉花","采药童子","金冠灵蛇","铁伯","铁牛","铁莲和尚","锦官力士","锦官差役","闻人羽","阿呆","阿奴","阿紫","阿翔","阿芷","阿萝","阿萨辛","阿财","阿赌","阿铁","阿雅","阿飞","陆寒枝","陆濯尘","陈九","陈靖仇","陈默","隐龙卫","雪女之影","雪山弟子","雪山银豹","雪豹","霜华剑魄","霜影","霜魄","青玄","青衣楼老板娘","青铜偃甲","青铜面人·丙","青铜面人·乙","青铜面人·甲","青霞子","韩菱纱","顾狂澜","风吹雪","风晴雪","食蛊鸟","馋鸡偃甲","香客老夫人","骡马夫","魇兽幼体","鱼定大娘","麻九娘","黑云踏雪","黑风寨采买","黑骨","齐丽","齐照野","龙汐月","龙葵",
  "阿洛扎西", "朱弦", "马跃川", "格桑央绒",
  "洛桑曲培", "云丹梅朵", "赤桑多杰", "白玛令仪",
  "仁杰洛布", "玉珍桑果", "达杰听风", "索央踏浪",
  "平措乌金", "央青阿若", "多杰砾", "曲珍石燕",
  "洛丹嘉木", "沈照铃", "丹增云措", "卓嘎听雨",
  "守关把总赵铁山", "炉城铁匠郭三", "说书瞎子阿吉", "炉城歌女拉姆", "藏医老彭措", "调停客宗喀", "康巴总教头·扎巴", "锅庄大掌柜兰措",
  "收租管事·旺堆", "雕版老匠人根秋", "昆·索朗坚赞", "金轮护法·达尔巴", "昆·阿旺班智达", "大轮法王·卓玛嘉", "昆·法王丹巴坚赞",
  "摆渡老汉多吉", "牧场头人仁青", "盘道人·白衣赤列", "拜火大迦叶·燃灯", "拜火三迦叶·明空", "寻访使·楚臣", "转世法王·白衣少年", "拜火二迦叶·灿莲",
  "逆行护法·琼波", "天铁匠首·贡布", "九乘长老·木雅仲巴", "铁钎掘藏师·阿旺", "九算神婆·雍措", "象雄大宗主·桑吉坚赞", "金翅武师·阿古顿巴",
]);

export const ITEM_ART = Object.freeze(["accessory-beads","accessory-charm","accessory-fang","accessory-hairpin","accessory-jade","accessory-mirror","accessory-ring","accessory-sachet","accessory-token","armor-apron","armor-cloth","armor-fur","armor-guard","armor-heavy","armor-leather","armor-monk","armor-soft","armor-taoist","misc-food","misc-herb","misc-key","misc-letter","misc-pill","misc-silver","misc-sutra","misc-talisman","misc-wine","weapon-crossbow","weapon-dagger","weapon-hammer","weapon-hidden","weapon-saber","weapon-spear","weapon-staff","weapon-sword","weapon-whip"]);

export const ITEM_NAME_ART = Object.freeze({
  "萨迦金铜飞轮": "萨迦金铜飞轮",
  "日月五轮": "日月五轮",
  "昆氏金刚法杵": "昆氏金刚法杵",
  "康巴厚背重刀": "康巴厚背重刀",
  "武侯破甲重弩": "武侯破甲重弩",
  "火焰铜刀": "火焰铜刀",
  "三迦叶赤铜戒刀": "三迦叶赤铜戒刀",
  "天铁掘藏钢钎": "天铁掘藏钢钎",
  "天铁九股黑杵": "天铁九股黑杵",
  "大鹏裂石爪套": "大鹏裂石爪套",
  "三色花纹法袍": "三色花纹法袍",
  "白玛草护法软甲": "白玛草护法软甲",
  "康巴牛皮马帮甲": "康巴牛皮马帮甲",
  "噶举单层白布衣": "噶举单层白布衣",
  "白牦牛毛暖氅": "白牦牛毛暖氅",
  "象雄黑石片甲": "象雄黑石片甲",
  "黑门法王氅": "黑门法王氅",
  "萨迦三色护法牌": "萨迦三色护法牌",
  "白幡口传信物": "白幡口传信物",
  "左旋雍仲黑铜牌": "左旋雍仲黑铜牌",
  "黑木琼鸟面具": "黑木琼鸟面具",
  "九眼天珠:紫": "九眼天珠",
  "辟寒火珠": "辟寒火珠",
  "八思巴玉印拓片": "八思巴玉印拓片",
  "左旋黑铜转经轮": "左旋黑铜转经轮",
  "羊肩胛卜骨挂坠": "羊肩胛卜骨挂坠",
  "康定红珊瑚串": "康定红珊瑚串",
  "朱砂印经残卷": "朱砂印经残卷",
  "雅州边茶砖": "雅州边茶砖",
  "康定红酒": "康定红酒",
  "白牦牛酥油块": "白牦牛酥油块",
  "青稞铁朵玛": "青稞铁朵玛",
  "狼曲沙金袋": "狼曲沙金袋",
  "焚风辟寒丹": "焚风辟寒丹",
  "中阴还魂散": "中阴还魂散",
});

export const QUEST_ART = Object.freeze(["baihuamen_1_huajiufengbo","baihuamen_2_guyinganxiang","baihuamen_3_shixinyudu","baihuamen_4_wuxianjiuan","baihuamen_5_hualuotusi","baihuamen_rank_yinmeiling","baihuamen_rank_zunke","baihuamen_side_1_tuimozhang","baihuamen_side_2_shishuzudecha","baihuamen_side_3_duanyucaique","bounty_bandit","bounty_daluma","bounty_wolves3","divine_budongmingwang","divine_dizang","divine_huxiao","divine_niepanyin","divine_shuangtianyue","emei_1_xichengshiyao","emei_2_fodaoshilian","emei_3_minjiangjiuyue","emei_4_jianchujinding","emei_cangjian_yinjian","emei_sub1_chaojingbashiba","emei_sub2_baiyuanshiyuan","emei_sub3_duanzanzhuihen","eq_awang_tiandu","eq_lama_xingjiao","eq_lizhang_tiandu","eq_zhangshang_yuquan","eq_zhuoma_goncuo","eq_zhusi_yiding","finale_neutral_baihua","finale_neutral_huanxi","finale_neutral_lama","finale_neutral_xueshan","gaibang_1_yiwanxizhou","gaibang_2_taomindejiaoyin","gaibang_3_zhangmuhedui","gaibang_4_jiuenyuxinzhai","gaibang_5_shiliudagouzhen","gaibang_join_xiaokao","gaibang_s1_xujiejiuyue","gaibang_s2_jianluyiyao","gaibang_s3_jiuguiduzu","gaze_1_mitu","gaze_2_xiashan","gaze_3_buhuan","he_yuxie_line","heifengzhai_1_wolu_yufei","heifengzhai_2_meimeidexiaoxi","heifengzhai_3_5_jieyao","heifengzhai_3_shangshan","heifengzhai_4_guanjiadetongjiling","heifengzhai_5_langyanjiuzhang","hidden_all_collect_line","huanxijiao_1_xiangzhongyi","huanxijiao_2_biwuzhaoxian","huanxijiao_3_guanjiadetanzi","huanxijiao_4_jinguanchengdeanxian","huanxijiao_5_guanjiadetuxi","huanxijiao_6_juezhanqianye","huanxijiao_6a_bangguanjia","huanxijiao_6b_bangfanyanna","huanxijiao_dive_1_caimaixiangliao","huanxijiao_dive_2_paomahuideyaoqing","huanxijiao_dive_3_gongyangyishi","huanxijiao_dive_4_yaobobiandegushi","huanxijiao_dive_5_dizidegusi","hunter_learn_quest","jinguancheng_guan1_xinren","jinguancheng_guan2_guitu","jinguancheng_guan2a_toukao","jinguancheng_guan2b_zhongli","jinguancheng_zhi2_tianduanxian","jinguancheng_zhi3_hongmotuming","lamamiao_1_xianghuoanying","lamamiao_2_canjuanjiuhui","lamamiao_3_xuenihongzhua","lamamiao_4_digongwenxin","lamamiao_5_zhongmingsanshinian","lamamiao_side_1_xueshancaoyao","lamamiao_side_2_jiumenraodao","lamamiao_side_3_dixiayaorou","lanjie_line","paoma_saima","paoma_shejian","paoma_wubi","paoma_ziye","qingcheng_1_taogongdao","qingcheng_2_maoming","qingcheng_3_jianyue","qingcheng_4_shanmen_jueze","qingcheng_5_songfeng_xidu","qingcheng_side1_sishibabai","qingcheng_side2_yijianweizhen","qingcheng_side3_taijiechen","sanxingpai_1_xujiejiuyue","sanxingpai_2_sanmianjianzhen","sanxingpai_3_tongyinxuanji","sanxingpai_4_sanshinianjiushi","sanxingpai_5_jinwupowang","sanxingpai_side_1_xuwaijiuyao","sanxingpai_side_2_chiluhuo","sanxingpai_side_3_shenniaocanye","snow_leopard_quest","tangmen_1_anxianglaike","tangmen_2_tuimoqingjiang","tangmen_3_zhulintingfeng","tangmen_4_wuxianhuohuan","tangmen_5_jiaguichujian","tangmen_s1_yajiangtieyin","tangmen_s2_duanertingji","tangmen_s3_qingchengjiuzhen","tianlong_1_caodianxueshui","tianlong_2_xifengruying","tianlong_3_shishixunzong","tianlong_4_xueqitunchuan","tianlong_4_zhigeanhuo","tianlong_5_baiqizhige","tianlong_5_tieqitatu","tianlong_z1_yechaxiyan","tianlong_z2_xiuluogong","tigerside_16_fenzang","tigerside_17_qinshi","tigerside_18_heidian","tigerside_19_yirong","tigerside_20_fengkou","tusiline_2_xueshan_dizi","tusiline_3_zuihua","tusiline_4_husong","tusiline_5_daifu","tutorial_four_estates","village1_lubujianbuping","village2_jieshixiajiu","village3_zanghan_hunshi","village4_zahuoshangren_jinhuonan","village5_laolieshu_chuanren","village6_jieshichongli","wuxianjiao_1_zilanwenjing","wuxianjiao_2_dudianyiying","wuxianjiao_3_shijiejiuhen","wuxianjiao_4_chiwujiaoyi","wuxianjiao_5_yingguandingtan","wuxianjiao_side_1_shujinxiangnang","wuxianjiao_side_2_ext_yaofang","wuxianjiao_side_2_xueshanhanlu","wuxianjiao_side_3_shigujianghu","xian2_10_yinju","xian2_6_mixin","xian2_7_jiadiqi","xian2_8_tingyu","xian2_9_yupei","xueshan_1_shuangjie_wenmen","xueshan_2_hanji_tang","xueshan_3_emei_jiushu","xueshan_4_yadi_zhenxiang","xueshan_5_pojie_chushan","xueshan_side_1_xuelian_jishi","xueshan_side_2_hongtong_baiyuan","xueshan_side_3_shuangtian_wenjian","yudingcun_side1_yushan_chuhuan","yudingcun_side2_shuangshui_ka","yudingcun_side3_ye_song_chaomian","yudingtusi_1_xunshan_cuiliang","yudingtusi_2_caodian_anliang","yudingtusi_3_jiuqi_canyin","yudingtusi_4_gushu_wenxin","yudingtusi_5_dou_dizhu","yudingtusi_side1_paoma_yishi","yudingtusi_side2_anu_xunyuan","yudingtusi_side3_qiangwai_qingke","yuquanzhai_1_mumutongdemaoniu","yuquanzhai_2_liruoyoudeshangduizhang","yuquanzhai_3_danzengdemabian","yuquanzhai_4_zhuomadeqingkejiu","yuquanzhai_5_gongcuohaideyueding","yuquanzhai_6_langquyimeng","zhaxi_line"]);

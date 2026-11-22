export default { residentGroup: {
锦官城: [
    // ── 唐门外堂（驻锦官城·暗巷）；家主唐老太在蜀南唐堡 ──
    {
      name: "唐三少", id: "resident_tangsanshao", levelCap: 2,
      brief: "暗巷铺面的看店掌柜，年轻话少",
      personality: "找钱从不多找一文，也从不少找；你问暗器怎么用，他只说「照说明」",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "锦官制式软甲", category: "armor", quality: "蓝" },
        { name: "苗银暗器囊", category: "accessory", quality: "蓝" },
        { name: "铜钱压襟", category: "accessory", quality: "白" },
        { name: "毒蝎粉", category: "misc", quality: "绿" },
        { name: "蛇药", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    // ── 峨眉派（驻锦官城·峨眉剑庐）──
    // 掌门与大弟子的名字按要求换过：设计稿原写「灭绝师太」「周芷若」，是《倚天》
    // 里现成的人，换成本作自己的人。性格底子保留（掌门冷硬多疑、大弟子笑着出剑），
    // 但来历与执念重写。佛道双修落在人上：尼姑与道姑各占半边，谁也不压谁。
    {
      name: "玄尘师太", id: "resident_xuanchen", levelCap: 5,
      brief: "峨眉掌门，六十岁，瘦削，目光如剑",
      personality: "不信人只信剑，「剑不会骗你」；对弟子严苛到刻薄，唯独在佛堂里会跪很久，跪完出来照旧不认账",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "青布长衫", category: "armor", quality: "橙" },
        { name: "菩提子手串", category: "accessory", quality: "白" },
        { name: "雪山问心珠", category: "accessory", quality: "蓝" },
        { name: "藏经阁线香", category: "misc", quality: "蓝" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "照微", id: "resident_zhaowei", levelCap: 4,
      brief: "峨眉大弟子，二十岁，貌美温柔，剑比谁都狠",
      personality: "笑着跟你说话的时候剑已经出鞘了；她自己也不觉得这有什么不对——「师父说过，先客气的人先死」",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "松纹剑", category: "weapon", quality: "蓝" },
        { name: "百香纱衣", category: "armor", quality: "蓝" },
        { name: "银鎏花簪", category: "accessory", quality: "绿" },
        { name: "锦官文思膏", category: "misc", quality: "绿" },
        { name: "核桃糕", category: "misc", quality: "蓝" },
        { name: "金疮药", category: "misc", quality: "白" },
      ],
    },
    {
      name: "虚白道姑", id: "resident_xubai", levelCap: 4,
      brief: "峨眉道门那一半的当家，站十二庄站到第九庄用了二十二年",
      personality: "慢，说话慢做事慢，被催了也慢；跟玄尘师太共事三十年没红过脸，也没真同意过她一件事",
      carry: [
        { name: "松纹剑", category: "weapon", quality: "蓝" },
        { name: "青城道袍", category: "armor", quality: "蓝" },
        { name: "藏银经轮", category: "accessory", quality: "紫" },
        { name: "青城符箓袋", category: "accessory", quality: "绿" },
        { name: "老参酥油茶", category: "misc", quality: "紫" },
        { name: "薄荷醒神叶", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "了因师太", id: "resident_liaoyin", levelCap: 3,
      brief: "佛堂管事，教清心普善咒，城里郎中也来听",
      personality: "话密心软，谁受伤都先骂一顿再包扎；从不收郎中的学费——「你们治的人比我多」",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "铁网僧袍", category: "armor", quality: "蓝" },
        { name: "达摩药堂念珠", category: "accessory", quality: "绿" },
        { name: "桃木平安牌", category: "accessory", quality: "白" },
        { name: "雪山接骨膏", category: "misc", quality: "蓝" },
        { name: "三七活血散", category: "misc", quality: "绿" },
        { name: "金疮药", category: "misc", quality: "白" },
      ],
    },
    {
      name: "铁莲和尚", id: "resident_tielian", levelCap: 3,
      brief: "峨眉枪传人，剑庐里唯一的男僧，抄了三个月经才准碰兵器",
      personality: "闷，一天说不了十句话，说的多半是「让开」；枪杆磨得发亮，握处一层包浆",
      carry: [
        { name: "红缨枪", category: "weapon", quality: "绿" },
        { name: "点钢枪", category: "weapon", quality: "紫" },
        { name: "铁网僧袍", category: "armor", quality: "蓝" },
        { name: "菩提子手串", category: "accessory", quality: "白" },
        { name: "牦牛肉包子", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "司徒瑛", id: "resident_situying", levelCap: 2,
      brief: "自称白猿祖师司徒玄空的后人，练通臂拳",
      personality: "跳脱，坐不住，说话手舞足蹈；那个「后人」的身份谁也没查证过，她自己讲了三个版本",
      carry: [
        { name: "乌木鞭", category: "weapon", quality: "绿" },
        { name: "青城练气服", category: "armor", quality: "绿" },
        { name: "结绳护腕串", category: "accessory", quality: "绿" },
        { name: "牦牛骨扳指", category: "accessory", quality: "白" },
        { name: "松子糖", category: "misc", quality: "白" },
        { name: "熊山野蜂蜜", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "净莲", id: "resident_jinglian", levelCap: 2,
      brief: "知客尼，管进出登记和茶水",
      personality: "客气得滴水不漏，谁来都是那套话；记性极好，你三个月前说过什么她能一字不差复述",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "格桑花染布衣", category: "armor", quality: "绿" },
        { name: "菩提子手串", category: "accessory", quality: "白" },
        { name: "旧护身符", category: "accessory", quality: "绿" },
        { name: "甜奶茶", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "簪娘", id: "resident_zanniang", levelCap: 2,
      brief: "在剑庐后院打峨眉刺的老妇，峨眉刺形似发簪，她真拿它当簪子卖",
      personality: "耳朵背嘴不饶人，一边锉钢一边骂；给女弟子打的刺都比制式的短半寸——「插头上得好看」",
      carry: [
        { name: "峨眉刺", category: "weapon", quality: "蓝" },
        { name: "市集杀猪刀", category: "weapon", quality: "白" },
        { name: "孟记皮护腕", category: "armor", quality: "白" },
        { name: "银鎏花簪", category: "accessory", quality: "绿" },
        { name: "孟记铁铺淬火油", category: "misc", quality: "白" },
        { name: "孟记铁铺烫伤膏", category: "misc", quality: "白" },
        { name: "青稞酒", category: "misc", quality: "白" },
      ],
    },
    {
      name: "陈九", id: "resident_chenjiu", levelCap: 0,
      brief: "抄经抄到第八十七天的男弟子，还没摸过剑",
      personality: "苦着脸抄，抄错一个字要重来一页；见人就问「还有几天」，问了八十七回",
      carry: [
        { name: "乡勇木棓", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "桃木平安牌", category: "accessory", quality: "白" },
        { name: "牛骨素圈", category: "accessory", quality: "白" },
        { name: "贝叶抄经纸", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "酥油茶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "柳青鸢", id: "resident_liuqingyuan", levelCap: 5,
      brief: "锦官城都事，官府代理人",
      personality: "手腕圆滑，对各方势力都留一手分寸，私下藏着一桩未破的执念",
      carry: [
        { name: "青鸢", category: "weapon", quality: "橙" },
        { name: "青鸢尾", category: "weapon", quality: "橙" },
        { name: "青布长衫", category: "armor", quality: "橙" },
        { name: "青鸢私印", category: "accessory", quality: "蓝" },
        { name: "官眷诰命簪", category: "accessory", quality: "橙" },
        { name: "柳青鸢的菊花茶", category: "misc", quality: "绿" },
        { name: "锦官续命丹", category: "misc", quality: "紫" },
        { name: "锦官烧刀子", category: "misc", quality: "蓝" },
      ],
      fullBio: `身份与站位（总纲第一章·锦官城）：柳青鸢是锦官城的都事，乡外官方
秩序在曲措乡的代理人。她借土司府的把柄谋求渗透（在鱼定村一带设收税
点），但对土司、喇嘛庙、雪山派、欢喜教各有一套不主动撕破脸的分寸——
雷声大、雨点小，凡事留有余地。全篇论情感厚度，锦官城这一方仅次于
雪山派，排第二。

真实目的（线三·雪山之劫）：柳青鸢的公务身份之下，藏着一桩六年未破的
私人执念——她的上司在六年前失踪，最后一条可靠线索，指向后山平台的
那年跑马会，而雪山派也有人参加过。她在锦官城等了五年，终于等到消息，
才派人摸上后山平台。不是来打，是来找人。她对身边的老兵退伍汉说过
一句话："我不是来收税的，我是来接人回家的。"官府代理人的收税渗透
只是表壳，寻人才是她真正的动机——这也是她对欢喜教（教主梵衍那与
失踪上司的调查线索有交集）投鼠忌器、不敢真动的原因。

与土司的博弈（都事档案原文）：对土司，柳青鸢礼数周全，信尾每次加一句
"望贵府查收附件"，附件是什么从不写，桑杰朵杰也从不问——两个聪明人
之间的默契，她知道土司怕她，土司知道她不怕他。这份"土司怕她"是她
红档实力的来路：一个深藏不露的红袍土司都要忌惮三分的官场高手，权术
与身手都不显山露水，真正的底牌从不轻易示人。

终局定位：官2终局任务"归途·凤隐于青"有二选一分支（投靠官府／保持
中立）。若被说服保持中立，官府不再浑水摸鱼；若选中立线，柳青鸢会
推动终局之后任命梅朵代管曲措乡。`,
    },
  ]
} };

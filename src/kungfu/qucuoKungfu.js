// 曲措乡武学目录：各武馆出售的功法秘籍清单。
// 武学分三类：招式（战斗用，有 moveType）、内功（被动加成 passiveBonus）、轻功（被动加成）。
// 购买后以"入门"阶段加入角色的 skills 数组，通过 deriveMovesetFromSkills 自动影响战斗。
//
// passiveBonus 目前支持：maxHp（气血上限加成）、speedBonus（身法加值，影响先手判断）。
// 被动加成在 MudRPG 里调用 computePassiveBonus(skills) 汇总后叠加到 char 的相关字段上。

export const SKILL_TYPE = {
  MOVE: "招式",
  NEIGONG: "内功",
  QINGGONG: "轻功",
};

// 各武馆的武学目录，key 对应 qucuoBuildings.js 里 skillSet 字段
export const SKILL_CATALOG = {
  // ── 玉泉练武场：藏地摔跤+游走风格，状态/轻功为主 ──
  玉泉: [
    {
      id: "kf_rec_muge", name: "牧歌调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 6,
      desc: "放牦牛的人在坡上哼的调子，没词，只有起伏。哼到第三遍呼吸自己就跟上了拍子，胸口那口憋着的气顺下去。阿索说这不是功夫，是「人跟着牛走久了，走出来的」。",
    },
    {
      id: "kf_rec_langqu", name: "狼曲饮雪", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.08,
      desc: "掬一捧狼曲上游的雪含在嘴里，不嚼不咽，让它自己化。凉气顺喉管一路沉到丹田，化开的时候整个人激灵一下。牧民冬天赶远路全靠这一口。",
    },
    {
      id: "kf_liuyun", name: "流云步法", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 45,
      moveType: "状态",
      desc: "藏地牧民代代相传的步伐心诀，身随意转，如云散无形。修习后身法加强，与对手同类招式对撞时更易占得先手。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_daishuai", name: "摔跌术", type: SKILL_TYPE.MOVE, quality: "绿", price: 35,
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.4,
      desc: "借力打力，将对手的气势引入虚处——看似平淡，实则以巧破力，是玉泉寨人相互切磋最常用的手段。",
    },
    {
      id: "kf_jiangong", name: "坚桩功", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      moveType: "防御",
      ignoreDefensePartialImmune: 0.3,
      desc: "扎实的站桩功夫，招式简单但根基牢固，练到纯熟能以守代攻。初学者的不二之选。",
    },
  ],

  // ── 雪山练功堂：雪山派内外兼修，防御反击+内功为主 ──
  雪山: [
    {
      id: "kf_rec_xuexian", name: "雪线吐纳", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      moveType: "状态",
      energyRestore: 8,
      desc: "站在雪线上呼吸——那条线以上空气稀薄，逼得你把每一口都吸到底。练熟了下山再喘气，觉得平地的空气浓得发腻。呼延雪说这门功夫的诀窍是「先学会难受」。",
    },
    {
      id: "kf_rec_wenquan", name: "温泉纳气", type: SKILL_TYPE.MOVE, quality: "紫", price: 200,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.14,
      desc: "后山温泉水温烫手，泡到肩膀，任热气从毛孔往里钻。何雨谢定的规矩是一炷香就得起来——「再泡下去补的是懒，不是气。」",
    },
    {
      id: "kf_ting_tingxue", name: "听雪", type: SKILL_TYPE.MOVE, quality: "紫", price: 230,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.4,
      desc: "听桥一路的雪山变体。不看不挡，只听。雪落在肩上有声，剑破空也有声，两种声音在他耳朵里是一样的。听准了再动，一动就是还手。",
    },
    {
      id: "kf_xuexin", name: "雪山养气诀", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 70,
      moveType: "防御",
      desc: "雪山派内功入门，以静养气、以气养血。修习后气血上限提升，且每次切磋后恢复更快。",
      passiveBonus: { maxHp: 15 },
    },
    {
      id: "kf_bingxin", name: "冰心掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "防御",
      immuneControl: true,
      desc: "以静制动，掌法平稳如雪山不动，防住来势后余力犹在。雪山派弟子入门必学的防身功夫。",
    },
    {
      id: "kf_xuekong", name: "虚空游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 100,
      moveType: "状态",
      desc: "雪山派独门轻功，步随心走，动静之间令对手难以判断落脚点，身法与状态浑然一体。",
      passiveBonus: { speedBonus: 1 },
    },
  ],

  // ── 锦官武馆：通行江湖功夫，攻击为主，入门无门槛 ──
  锦官: [
    {
      id: "kf_rec_chabo", name: "茶博士收势", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.05,
      desc: "清风茶馆的跑堂一天走三十里地不歇脚，全靠这一手：长嘴壶收势那一下顺势沉肩塌腰，一口气就换过来了。李掌柜说学会了「端一天盘子腰不酸」。",
    },
    {
      id: "kf_rec_xiaochang", name: "校场歇鼓", type: SKILL_TYPE.MOVE, quality: "蓝", price: 140,
      moveType: "状态",
      energyRestore: 7, nextAttackBonus: 0.3,
      desc: "锦官武馆校场上，一通鼓歇下来的那三息。老兵教的：别急着喘，先把散掉的劲收回丹田，收利索了下一棍才有分量。鼓再响时，你比刚才更沉。",
    },
    {
      id: "kf_gangfeng", name: "刚锋腿", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      moveType: "攻击",
      lowHpBonus: 0.2,
      desc: "朴实无华的腿法，踢出去带着一股硬劲，胜在简单直接，江湖初入者常练。",
    },
    {
      id: "kf_lieyan", name: "烈焰拳", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "攻击",
      forceCrit: { multiplier: 1.4 },
      desc: "流传甚广的刚猛拳法，以力破巧，一拳连着一拳往上催，架不住就是硬吃。",
    },
    {
      id: "kf_jinshen", name: "金身诀", type: SKILL_TYPE.NEIGONG, quality: "白", price: 22,
      moveType: "防御",
      desc: "流传于锦官城武林的入门内功，练气固体，气血略有增益，初学者常备。",
      passiveBonus: { maxHp: 8 },
    },
    {
      id: "kf_wuyou", name: "无忧步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 40,
      moveType: "状态",
      desc: "行云流水般的步法，能在混战中灵活穿插，身形难以捉摸，是走南闯北的江湖人惯用的入门轻功。",
      passiveBonus: { speedBonus: 1 },
    },
  ],

  // ── 令狐冲墓·独孤九剑：非售卖，仅通过贡措海令狐冲墓参悟获得 ──
  独孤: [
    {
      id: "kf_rec_jianzhong", name: "剑冢独坐", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "状态",
      energyRestore: 10, immuneControl: true,
      desc: "在剑冢边上坐着，什么也不做。风穿过那些插了几十年的剑，声音很杂，坐久了就听不见了。听不见的时候，气自己回来了，心里也没什么能扰得动你。",
    },
    {
      id: "kf_dugujiujian", name: "独孤九剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "攻击",
      desc: "剑魔独孤求败所创，无招胜有招。总诀式、破剑式、破刀式、破掌式、破索式、破鞭式、破枪式、破箭式、破气式，九式归一。令狐冲刻于墓壁，待有缘人。",
      passiveBonus: { speedBonus: 2 },
    },
  ],

  // ── 青城派：以柔克刚、后发制人，道门正宗 ──
  青城: [
    {
      id: "kf_rec_xiaozhoutian", name: "玄门小周天", type: SKILL_TYPE.MOVE, quality: "蓝", price: 125,
      moveType: "状态",
      energyRestore: 7,
      desc: "道门正宗的行气路子，气自尾闾上夹脊、过玉枕、下重楼，绕一圈回丹田。一清道长说走这一圈要一炷香，急不得——「你催它，它就散。」",
    },
    {
      id: "kf_rec_libui", name: "离堆分水息", type: SKILL_TYPE.MOVE, quality: "紫", price: 205,
      moveType: "状态",
      energyRestore: 9, hpRestore: 0.12,
      desc: "仿离堆分水的理路：气到胸口一分为二，一股沉丹田，一股走四肢。不蓄在一处，就不会憋。宝瓶口边上练，水声大得听不见自己呼吸，反而练得成。",
    },
    {
      id: "kf_ting_fenshui", name: "听桥·分水", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "防御",
      onCounterSuccessEnergyGain: 5, onCounterSuccessDamageRatio: 0.5,
      desc: "听桥的青城正解。来力到身前如江水撞上离堆，自然分作两股从身侧滑过——分完那一瞬江水还在推，借的就是那一推。一清道长使这招是闭着眼的。",
    },
    {
      id: "kf_qingchengjian", name: "青城剑法", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      moveType: "攻击",
      // 【原来挂的是 onCounterSuccessEnergyGain】那个标志位只在「防御成功反击」时
      // 结算，挂在攻击槽的招上永远不触发。改成接反击追打，既合青城后发制人的路子，
      // 也跟松风剑法(0.3)形成入门→进阶的递进。
      afterCounterBonus: 0.2,
      desc: "青城派开蒙剑法，只有十二式，弟子上山头三个月练的就是它。招式灵动飘逸，起手不求力也不求快，只求准——剑尖始终对着对手重心那一点。松鹤道长说这套剑法一辈子都练不完，「你嫌它简单，是因为你还没被它救过命」。",
    },
    {
      id: "kf_songfeng", name: "松风剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "攻击",
      afterCounterBonus: 0.3,
      desc: "青城派入门剑法，三十六式舒展如松涛过涧。不以快取胜——剑尖划过空气看似缓慢，实则每一剑藏着连绵后劲。使到第三十六式时第一式剑劲还在对手体内残留，新旧叠加，一剑比一剑沉。宝瓶口练此剑，剑尖点水不起水花方为入门。",
    },
    {
      id: "kf_xuanmenqi", name: "青城玄门气", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 90,
      moveType: "防御",
      desc: "道门正宗内功，以呼吸吐纳养气。气劲悠长连绵如岷江之水，表面平缓底下深沉。运功时周身气机形成绵密防御场，来犯之力如击棉絮，层层消解。缺陷：防御状态下只能守不能攻——蓄水时不泄洪，泄洪时不蓄水。",
      passiveBonus: { maxHp: 20 },
    },
    {
      id: "kf_dujiangshi", name: "都江古堰势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      enemyCostPenalty: { value: 1, turns: 2 },
      desc: "不伤敌不护身——改变脚下的势。将内劲灌入地面布下无形力场，力场内敌方劲力被引导分流，快招自动变慢、准头偏移，如岷江激流撞上离堆被迫分为内外两江。维持时间短极耗内力，但一旦布下攻守之势立转。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_tiyunzong", name: "梯云纵", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 0,
      moveType: "状态",
      desc: "青城派不传之秘，仅藏于伏龙观藏经阁。纵身时如踏云梯而上，一步高过一步，三步之后人在半空，落地无声。不是跳得高——是每一步都踩在前一步的余势上，如岷江后浪推前浪，绵绵不绝。",
      passiveBonus: { speedBonus: 2 },
    },
    {
      id: "kf_yizidianjian", name: "一字电剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "攻击",
      // forceFirst：走"快如闪电"这条线最贴切的现成标志位——无视身法强行先手
      //（见 resolveTurn.js 同类型对撞的判定）。不卖，练功堂秘传。
      forceFirst: true,
      desc: "青城剑法练到极处的一式。不走弧、不带转，剑自鞘中直出一线，快到看不见剑身只看见一道白。全套只此一招，因为再多一招就慢了。青霞子说这一剑他练了四十年，「前三十九年在练怎么不出这一剑」。",
    },
    {
      id: "kf_ziyang", name: "紫阳神功", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 200,
      moveType: "防御",
      desc: "青城派镇山内功，取紫阳真人丹道之意。气沉丹田后不外放，只在周身经脉里反复淬炼，久之皮肉筋骨皆如浸过药水。练成者不显山不露水，挨打时才看得出分别——同样一剑，别人见血，他只留一道白痕。练岔了会浑身发烫三日不退。",
      passiveBonus: { maxHp: 35 },
    },
    {
      id: "kf_qingling", name: "青灵功", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 60,
      moveType: "回气",
      desc: "辅修内功，与紫阳神功一刚一柔。不增气血只理气机，呼吸间自行归拢散逸的内力，久战不虚。玉真子拿它比作药圃的水渠——「渠通了，水自己会流到该去的地方，不必你一瓢一瓢舀」。",
      passiveBonus: { maxHp: 8 },
    },
    {
      id: "kf_qingfengbu", name: "清风步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 40,
      moveType: "状态",
      desc: "青城入门轻功，梯云纵的根基。不比谁跳得高，只讲一个「轻」字——踩过青苔不留痕，穿过竹林不惊鸟。持堂道人考校弟子的法子是在练功堂地上铺一层香灰，走一趟，看脚印深浅。",
      passiveBonus: { speedBonus: 1 },
    },
  ],
  // ── 峨眉派：佛道双修，剑法指法并重，五峰（头肩肘臀膝）发力 ──
  // 峨眉山既是普贤菩萨道场（佛），又是道家第七洞天（道），门中尼姑道姑同堂，
  // 武学也就一半禅意一半丹道。源流上托三个人：春秋隐士司徒玄空仿山中灵猴创
  // 通臂拳（后人尊白猿祖师）、南宋白云禅师融医入武创十二庄（正式创宗）、
  // 明代峨眉枪一度独步天下。
  峨眉: [
    {
      id: "kf_rec_jinding", name: "金顶观日", type: SKILL_TYPE.MOVE, quality: "蓝", price: 135,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.10,
      desc: "天不亮上金顶，等云海底下那一线红。等的时候不许动，冻得发抖也不许动。日头出来那一刻吸一口气——师太说那口气跟别的时辰不一样，「你自己会知道」。",
    },
    {
      id: "kf_rec_xiaozhuang", name: "十二庄·小庄息", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      moveType: "状态",
      energyRestore: 8, nextAttackBonus: 0.25,
      desc: "十二庄里最短的一庄，只换一个站姿。虚白道姑演示给你看，你没看出哪里变了，但她说气已经归了位。「下一下你自己使使看。」",
    },
    {
      id: "kf_ting_foguang", name: "听桥·佛光", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "防御",
      onCounterSuccessEnergyGain: 6, doubleReflectDamage: true,
      desc: "峨眉不外传的听桥。双掌合什立于身前，来力撞上去像撞庙墙——墙不动，撞的人自己先受不住。玄尘师太说这一式的关键不在手上，「在你信不信那堵墙」。",
    },
    {
      id: "kf_emei_tongbei", name: "峨眉通臂拳", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      moveType: "攻击",
      lowHpBonus: 0.25,
      desc: "峨眉最老的一门，托名白猿祖师司徒玄空所创。相传他在山中看灵猴攀援腾挪看了十年，把猴子怎么甩臂、怎么借腰劲写成了拳。招式看着不雅相，肩臂甩得很开，但打人极疼——猴子打架从来不讲好看。",
    },
    {
      id: "kf_emei_jian", name: "峨眉剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "攻击",
      nullifyStatusOnHit: true,
      desc: "峨眉入门剑法，三十六式，式式带禅意。剑走轻灵不尚蛮力，剑尖画出的轨迹如梵文种子字——看似随意，实则每一笔都有定数。女子使来如飞天散花，男子使来如老僧扫地。",
    },
    {
      id: "kf_emei_jieshou", name: "截手九式", type: SKILL_TYPE.MOVE, quality: "绿", price: 48,
      moveType: "防御",
      onCounterSuccessDamageRatio: 0.35,
      desc: "峨眉掌法里最不起眼的一门，专管「接」。对方拳来掌来兵刃来，九式各截一路，截住就完，不追不打。了因师太说这九式是给新弟子保命用的——「你先学会不挨打，再谈打人。」",
    },
    {
      id: "kf_emei_piaoxue", name: "飘雪穿云掌", type: SKILL_TYPE.MOVE, quality: "蓝", price: 105,
      moveType: "攻击",
      ignoreDefenseRatio: 0.3,
      desc: "掌风轻柔得像拂脸上的雪，挨着不疼，退开三步才觉得胸口发闷。峨眉五峰发力里最见功夫的一门——力不出在掌上，出在肩肘之间那一寸转折里，看的人只看见袖子动了动。",
    },
    {
      id: "kf_emei_zhi", name: "兰花拂穴手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 100,
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.55,
      desc: "六大专修功里指穴功一路。五指如兰花绽放，指尖点出带一股柔劲，不伤皮肉专封经脉。被点中的人不疼，但半边身子动不了。解法只有两个：等两个时辰自行散开，或者让峨眉的人再点一下。",
    },
    {
      id: "kf_emei_qingxin", name: "清心普善咒", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      // 原写 moveType:"疗伤"，但上阵槽只有攻击/防御/状态三格（deriveMovesetFromSkills
      // 就按这三类找 active 武学），疗伤压根匹配不上——这门买了也永远上不了阵。
      // 改挂状态槽，回血靠 hpRestore（resolveTurn 本就按最大气血比例结算），
      // 「高效回血」是真的回，不是描述。
      moveType: "状态",
      hpRestore: 0.18,
      desc: "不是打人的功夫，是救人的。默诵咒文导气归经，血止得快，断骨接得齐。了因师太在佛堂教这个，来学的一半是弟子，一半是城里的郎中。她从不收郎中的钱——「你们治的人比我多。」",
    },
    {
      id: "kf_emei_foguang", name: "佛光普照", type: SKILL_TYPE.MOVE, quality: "紫", price: 185,
      moveType: "防御",
      doubleReflectDamage: true,
      desc: "峨眉掌法巅峰一门。双掌合什再分开，掌心朝外一推，来力像撞在庙墙上——墙不动，撞的人手疼。金顶云海上日出时佛光现，看的人都说那是菩萨显圣；练成这门的人知道，那不过是光碰上了雾。",
    },
    {
      id: "kf_emei_huifeng", name: "回风拂柳剑", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      moveType: "状态",
      confuseChance: 0.5, afterCounterBonus: 0.35,
      desc: "峨眉代表剑法。剑不直去，走的是回旋的路子，一剑荡开对方兵刃，剑势不停顺势卷回来，像风过柳梢那一下回摆。对手往往是被自己格挡的余力带偏的——你使多大劲挡，就被带出多远。",
    },
    {
      id: "kf_emei_shierzhuang", name: "峨眉十二庄", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 195,
      moveType: "防御",
      desc: "南宋白云禅师融医理入武创下的核心内功，天地之人心龙鹤风云大小幽明十二庄，一庄一桩一诀。动静双修，站桩时不动如山，行气时又要求周身关节皆活。练全的人极少——虚白道姑站到第九庄用了二十二年。",
      passiveBonus: { maxHp: 26 },
    },
    {
      id: "kf_emei_hubu", name: "虎步功", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 52,
      moveType: "状态",
      desc: "六大专修功之一。名叫虎步却不是猛冲，讲的是落脚——脚掌先着地再压脚跟，重心始终吊在两腿之间，随时能转向。在金顶石阶上练，下雨天不许扶栏杆。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_emei_jiuyang", name: "峨嵋九阳功", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 0,
      moveType: "防御",
      desc: "镇派内功，相传自《九阳真经》残卷中悟出，只得三成而已——但这三成已经够峨眉立派数百年。行功时周身发热，冬日盘坐雪地上，坐处一圈雪自行化去。掌门口传心授，不入剑庐的武学榜，也从不标价。",
      passiveBonus: { maxHp: 45 },
    },
  ],

  // ── 唐门：暗器与毒药，家族制不收外姓，但暗器卖给所有人 ──
  唐门: [
    {
      id: "kf_rec_yaoxi", name: "药息", type: SKILL_TYPE.MOVE, quality: "蓝", price: 145,
      moveType: "状态",
      energyRestore: 7, immuneControl: true,
      desc: "唐门以毒淬体的副产物：运起药息，体表渗出一层微苦的薄汗，人也跟着清醒。旁人的迷香定身之类，到了这层汗跟前就矮了三分。唐老太一边喝茶一边说「这不算功夫，是习惯」。",
    },
    {
      id: "kf_rec_xiazhong", name: "匣中静", type: SKILL_TYPE.MOVE, quality: "紫", price: 215,
      moveType: "状态",
      energyRestore: 9, nextAttackBonus: 0.35,
      desc: "开匣之前的那一息。十二格暗器都在手边，你不看它们，只调匀呼吸——手一稳，出去的东西才准。唐三少说店里最贵的不是暗器，是这一息。",
    },
    { id: "kf_tangmen_anqi", name: "满天星雨", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      ignoreDefenseRatio: 0.35, applyMark: { name: "内伤", stacks: 1, max: 5 },
      desc: "唐门暗器总诀。袖中同时飞出七枚铁蒺藜，走七条不同弧线，封死对手三个闪避方向。不是快，是密。练到极处一袖出三十六枚，如星雨覆面，无处可躲。" },
    { id: "kf_tangmen_du", name: "百毒不侵体", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 130,
      moveType: "防御",
      desc: "唐门弟子自幼以毒淬体，小剂量百毒日日服，练出一副抗毒的筋骨。运功时体表渗出一层薄汗，带微苦药气——毒物近身先被这层汗化去三分。不是解毒，是毒到了跟前就矮了三分。",
      passiveBonus: { maxHp: 15 } },
  ],

  // ── 血刀门：邪派，以杀养刀。不外传，只从厉天行身上掉 ──
  血刀: [
    {
      id: "kf_rec_chuoxue", name: "啜血还气", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "状态",
      energyRestore: 12,
      desc: "血刀门的路子：把干在指缝里的血痂抠下来吃了。气回得极快，快到不像人该有的速度。厉天行说这没什么讲究，「你饿了会吃饭，我这就是吃饭」。",
    },
    {
      id: "kf_rec_daoxiu", name: "刀锈入喉", type: SKILL_TYPE.MOVE, quality: "紫", price: 0,
      moveType: "状态",
      energyRestore: 8, forceCrit: { multiplier: 1.35 },
      desc: "舔一下刀背。铁锈味混着别人的血腥味压在舌根，恶心，但眼睛会红。红了之后下一刀的分量不一样——这门功夫从不解释为什么。",
    },
    { id: "kf_xuedao", name: "血刀大法", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      // hpRestore 是招式层已经跑通的字段（resolveTurn 里按最大气血比例结算），
      // 设计稿原写的 lifesteal（按实际伤害比例吸血）全项目没有接线，写了也不生效，
      // 所以这里落在 hpRestore 上——"砍中就回一口"的观感一样，但它是真的会回血。
      hpRestore: 0.06,
      moveType: "攻击",
      desc: "以血养刀，以杀证道。每一刀劈出都带着铁锈般的血腥气，砍中对手时刀身会吸——不是吸肉，是吸气。被砍中的人伤口愈合极慢，而持刀者面色红润。练到极处，一刀下去，对手瘦一圈，你胖一圈。",
      passiveBonus: { maxHp: 10 } },
  ],

  // ── 三星派：古蜀剑派，不设铺面不收束脩，武学只从面具试炼来 ──
  三星: [
    {
      id: "kf_rec_guixu", name: "归墟坐忘", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "状态",
      energyRestore: 12,
      desc: "纵目者那一式的皮毛。闭眼，把自己当成一件被放回坑里的青铜器——三千年没人动过，也就三千年没耗过。睁眼时气是满的。",
    },
    {
      id: "kf_rec_neishi", name: "纵目内视", type: SKILL_TYPE.MOVE, quality: "紫", price: 0,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.12, immuneControl: true,
      desc: "戴上面具之后视野窄了，反而看得见自己身体里的事——哪条经堵着，哪处旧伤没长好，一目了然。看见了，也就理顺了。青铜面人不说话，他们就这么互相教。",
    },
    { id: "kf_sanxing_jian", name: "纵目剑法", type: SKILL_TYPE.MOVE, quality: "紫", price: 0,
      moveType: "攻击",
      ignoreDefense: true,
      desc: "剑走直线，不拐弯。三星堆青铜面具的眼睛是凸出来的，看人不看表面，看穿。剑也一样：不刺你格挡的地方，刺你格挡之后的地方。一剑出去你挡了，但剑尖已经在你身后。三千年前的剑法本没有名字，后人叫它纵目——纵目所见，皆是要害。" },
    { id: "kf_sanxing_bu", name: "神树步", type: SKILL_TYPE.QINGGONG, quality: "紫", price: 0,
      moveType: "状态",
      desc: "三星堆青铜神树九枝九鸟，枝杈交错毫无规律。步法脱胎于此，走位如攀树，每一步都踩在你判断不到的枝杈上。不是快，是无规律——你预判他往左，他往上了；你预判他落地，他还在半空拐了个弯。",
      passiveBonus: { speedBonus: 2 } },
  ],
};

// 汇总某角色skills里所有内功/轻功的被动加成。
//
// 【这个函数曾经从来没有被调用过】文件头写着"被动加成在 MudRPG 里调用
// computePassiveBonus(skills) 汇总后叠加到 char 的相关字段上"——MudRPG 里没有这一行。
// 结果是 15 门武学里 9 门带 passiveBonus 的全是死数据：青城玄门气的气血+20、
// 梯云纵的身法+2、独孤九剑的身法+2、雪山养气诀的+15，一个都没生效，只在图鉴里
// 显示得挺好看。整个内功/轻功品类的存在意义都悬着。
// 现在接上了，两条出口分别是：
//   maxHp     → effectiveMaxHp()，叠进战斗入场血量、面板显示、以及各处回血封顶
//   speedBonus→ equipment.js 的 effectiveSpecial()，叠进七维「身法」（resolveTurn
//               里同类型对撞比身法定先手，正是文件头承诺的那个用途）
// 两条都做成**派生**而不是写回存档：写回存档会在读档/重复习得时反复叠加，
// 而派生值随 skills 变化自动跟上，也不需要给老存档写迁移。
export function computePassiveBonus(skills) {
  const bonus = { maxHp: 0, speedBonus: 0 };
  if (!Array.isArray(skills)) return bonus;
  for (const s of skills) {
    if (s?.passiveBonus) {
      bonus.maxHp += (Number(s.passiveBonus.maxHp) || 0);
      bonus.speedBonus += (Number(s.passiveBonus.speedBonus) || 0);
    }
  }
  return bonus;
}

// 有效气血上限 = 存档里的 hp[1] + 内功被动。
// 【为什么不直接改 hp[1]】hp[1] 是存档字段，且会被内功修炼（MudRPG 里 newMax 那段）
// 真实写高。把被动也写进去，读档时分不清哪部分是修炼来的、哪部分是装备/武学给的，
// 卸掉武学就减不回去。所以被动一律派生，hp[1] 只保留"自身修为"这一份。
// 全项目凡是要用"这个人到底有多少血上限"的地方都该走这里：战斗入场、面板显示、
// 打坐/客栈/丹药的回血封顶。
export function effectiveMaxHp(baseMaxHp, skills) {
  const base = Number(baseMaxHp) || 0;
  return base + computePassiveBonus(skills).maxHp;
}

// 检查某个 skill id 是否已被玩家习得
export function hasSkill(skills, skillId) {
  return skills.some(s => s.id === skillId);
}

// 拜师/偷师学到的招式：并入"武学"栏统一管理，但学到即【完整版】——不修炼、不
// 成长，没有阶段/等级/经验。保存完整招式本体 move，deriveMovesetFromSkills 原样
// 取用，不做阶段缩放（区别于武馆买的可修炼武学）。
// source 标注这一条是怎么来的，供右栏 UI 显示不同小标签：
//   "拜师"（专属招，倾囊相授）/ "拜师·通用"（平民教通用招池的招）/ "偷师"（偷来的）
// 不传 source 时兜底成 "拜师"，向后兼容旧调用点。
export function makeLearnedMoveSkill(move, source = "拜师") {
  return {
    id: move.id,
    name: move.name,
    type: SKILL_TYPE.MOVE,
    moveType: move.type,                 // 攻击/防御/状态
    quality: move.quality || "白",       // 完整版的品阶，直接显示
    fixed: true,                         // 固定招：武学栏不显示成长条
    upgradable: false,                   // 与 fixed 同义，供统一习得系统按这个字段判断能否升阶
    learned: true,                       // 来源：拜师/偷师所授，区别于武馆买的
    source,                              // ★来源维度："拜师" | "拜师·通用" | "偷师"
    active: false,
    move: { ...move, sourceSkill: move.name }, // 完整招式本体，带 sourceSkill 与派生招统一
  };
}

// 从目录定义生成一条 skills 数组里的初始记录（武馆购买）
export function makeSkillEntry(catalogItem) {
  return {
    id: catalogItem.id,
    name: catalogItem.name,
    type: catalogItem.type,
    quality: catalogItem.quality || "白", // 武学本身的品阶（白绿蓝紫橙红），随学会带入，供武学栏显示。
    level: 1,
    exp: 0,
    maxExp: 100,
    stage: "入门",
    active: false,
    moveType: catalogItem.moveType,
    passiveBonus: catalogItem.passiveBonus || null,
    source: "武馆",       // ★来源维度，武馆买的都能潜能升阶
    upgradable: true,     // 与 fixed:false 同义
  };
}

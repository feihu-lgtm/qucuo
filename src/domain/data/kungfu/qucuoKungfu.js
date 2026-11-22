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
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0（非敌对即可在练武场求学）" },
      desc: "放牦牛的人在坡上哼的调子，没词，只有起伏。哼到第三遍呼吸自己就跟上了拍子，胸口那口憋着的气顺下去。阿索说这不是功夫，是「人跟着牛走久了，走出来的」。",
    },
    {
      id: "kf_rec_langqu", name: "狼曲饮雪", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.08,
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0" },
      desc: "掬一捧狼曲上游的雪含在嘴里，不嚼不咽，让它自己化。凉气顺喉管一路沉到丹田，化开的时候整个人激灵一下。牧民冬天赶远路全靠这一口。",
    },
    {
      id: "kf_liuyun", name: "流云步法", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 45,
      moveType: "状态",
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0" },
      desc: "藏地牧民代代相传的步伐心诀，身随意转，如云散无形。修习后身法加强，与对手同类招式对撞时更易占得先手。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_daishuai", name: "摔跌术", type: SKILL_TYPE.MOVE, quality: "绿", price: 35,
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.4,
      unlock: { faction: "玉泉寨", rep: 15, member: false, note: "玉泉寨声誉 ≥ 15（练武场才肯教真摔法）" },
      desc: "借力打力，将对手的气势引入虚处——看似平淡，实则以巧破力，是玉泉寨人相互切磋最常用的手段。",
    },
    {
      id: "kf_jiangong", name: "坚桩功", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      moveType: "防御",
      ignoreDefensePartialImmune: 0.3,
      unlock: { faction: "玉泉寨", rep: 15, member: false, note: "玉泉寨声誉 ≥ 15" },
      desc: "扎实的站桩功夫，招式简单但根基牢固，练到纯熟能以守代攻。初学者的不二之选。",
    },
    // 合稿·玉泉寨 武学三档：rep40 套马索魂手、rep80 长生天吐纳诀/搏狼鞭法（声誉封顶 100，原 140 档压回 80）。
    {
      id: "kf_yuquan_taoma", name: "套马索魂手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.45,
      unlock: { faction: "玉泉寨", rep: 40, member: false, note: "玉泉寨声誉 ≥ 40（丹增点头才传）" },
      desc: "驯马人的套索手，索影一抖缠住对手脚踝——套马的东西用在人身上，套上就跑不脱。",
    },
    {
      id: "kf_yuquan_changshengtian", name: "长生天吐纳诀", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 180,
      moveType: "状态",
      passiveBonus: { maxHp: 28 }, energyRestore: 6, hpRestore: 0.1,
      unlock: { faction: "玉泉寨", rep: 80, member: false, note: "玉泉寨声誉 ≥ 80（视作狼曲义亲候选）" },
      desc: "牧民对长生天的吐纳法，一呼一吸学草原的风——绵长、不绝。练成后气血如草根般自己往回长。",
    },
    {
      id: "kf_yuquan_bolang", name: "搏狼鞭法", type: SKILL_TYPE.MOVE, quality: "紫", price: 180,
      moveType: "攻击",
      forceCrit: 1.55, lowHpBonus: 0.35,
      unlock: { faction: "玉泉寨", rep: 80, member: false, note: "玉泉寨声誉 ≥ 80" },
      desc: "狼曲河谷猎户的保命鞭法，专等自己血气最弱、狼扑上来那一刻反手一鞭——越险越狠。",
    },
  ],

  // ── 雪山练功堂：雪山派内外兼修，防御反击+内功为主 ──
  雪山: [
    {
      id: "kf_rec_xuexian", name: "雪线吐纳", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      moveType: "状态",
      energyRestore: 8,
      unlock: { faction: "雪山派", rep: 15, member: false, note: "雪山派声誉 ≥ 15（颇具善缘）" },
      desc: "站在雪线上呼吸——那条线以上空气稀薄，逼得你把每一口都吸到底。练熟了下山再喘气，觉得平地的空气浓得发腻。呼延雪说这门功夫的诀窍是「先学会难受」。",
    },
    {
      id: "kf_rec_wenquan", name: "温泉纳气", type: SKILL_TYPE.MOVE, quality: "紫", price: 200,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.14,
      unlock: { faction: "雪山派", rep: 40, member: false, note: "雪山派声誉 ≥ 40（门墙之交）" },
      desc: "后山温泉水温烫手，泡到肩膀，任热气从毛孔往里钻。何雨谢定的规矩是一炷香就得起来——「再泡下去补的是懒，不是气。」",
    },
    {
      id: "kf_ting_tingxue", name: "听雪", type: SKILL_TYPE.MOVE, quality: "紫", price: 230,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.4,
      unlock: { faction: "雪山派", rep: 40, member: true, guestRep: 80, note: "需拜入雪山派且声誉 ≥ 40；未拜入者需声誉 ≥ 80（股肱心腹）方可破例传授" },
      desc: "听桥一路的雪山变体。不看不挡，只听。雪落在肩上有声，剑破空也有声，两种声音在他耳朵里是一样的。听准了再动，一动就是还手。",
    },
    {
      id: "kf_xuexin", name: "雪山养气诀", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 70,
      moveType: "防御",
      unlock: { faction: "雪山派", rep: 0, member: false, note: "雪山派声誉 ≥ 0（外客可学）" },
      desc: "雪山派内功入门，以静养气、以气养血。修习后气血上限提升，且每次切磋后恢复更快。",
      passiveBonus: { maxHp: 15 },
    },
    {
      id: "kf_bingxin", name: "冰心掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "防御",
      immuneControl: true,
      unlock: { faction: "雪山派", rep: 0, member: false, note: "雪山派声誉 ≥ 0（外客可学）" },
      desc: "以静制动，掌法平稳如雪山不动，防住来势后余力犹在。雪山派弟子入门必学的防身功夫。",
    },
    {
      id: "kf_xuekong", name: "虚空游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 100,
      moveType: "状态",
      unlock: { faction: "雪山派", rep: 15, member: false, note: "雪山派声誉 ≥ 15（颇具善缘）" },
      desc: "雪山派独门轻功，步随心走，动静之间令对手难以判断落脚点，身法与状态浑然一体。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_shuangtian_luoxue", name: "霜天落雪剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      ignoreDefenseRatio: 0.25,
      unlock: { faction: "雪山派", rep: 80, member: true, guestRep: 100, quest: ["xueshan_4_yadi_zhenxiang"], note: "需拜入雪山派且声誉 ≥ 80 + 完成「雪4·雪山崖底三十年」；客卿尊宿（声誉 ≥ 100）获何雨谢亲授" },
      desc: "呼延大侠留下的雪山正宗剑法。起手平平无奇，像大雪压枝时一声极轻的咔哒，落下来却避无可避。齐照野说，这剑不是为了杀得痛快，是为了让该停下的事停下来。",
    },
    {
      id: "kf_taisu_hanyujing", name: "太素寒玉经", type: SKILL_TYPE.NEIGONG, quality: "红", price: 680,
      moveType: "防御",
      passiveBonus: { maxHp: 45 },
      immuneControl: true,
      unlock: { faction: "雪山派", rep: 100, member: true, quest: ["xueshan_5_pojie_chushan"], note: "镇派秘传：须正式拜入且完成「雪5·破戒出山」（合稿需声誉 ≥140，引擎封顶 100）" },
      desc: "雪山寒岭与后山热泉阴阳相济的最高心法，外如寒玉不侵、内似温泉不竭。修到深处，百毒难入、心魔不扰，任山下风浪翻天，丹田里始终只有一潭平水。",
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
    {
      id: "kf_guan_yanxing", name: "雁行缉拿棍", type: SKILL_TYPE.MOVE, quality: "蓝", price: 115,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "锦官城", rep: 15, member: false, note: "锦官城声誉 ≥ 15（差役把式）" },
      desc: "都事府差役巡街缉凶的棍法，棍走雁行斜插——不取要害，专打持刀的手腕与膝盖，拿人为主、伤人为辅。班头侯敢教这门时说：「打躺下容易，捆回去才算完。」",
    },
    {
      id: "kf_guan_fuhu", name: "六扇门缚虎手", type: SKILL_TYPE.MOVE, quality: "紫", price: 250,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "锦官城", rep: 40, member: false, note: "锦官城声誉 ≥ 40（门墙之交）" },
      desc: "官衙缉拿凶犯的擒拿散手，讲究一手锁腕一手压肩，三招之内叫对方兵刃脱手、跪地就缚。练到深处连成名凶徒也挣不脱，故名缚虎。",
    },
    {
      id: "kf_guan_qingyuan", name: "青鸢回风", type: SKILL_TYPE.MOVE, quality: "橙", price: 450,
      moveType: "攻击",
      highHpBonus: 0.15, applyMark: { name: "内伤", stacks: 2, max: 5 },
      unlock: { faction: "锦官城", rep: 80, member: true, guestRep: 100, note: "需投效都事府且声誉 ≥ 80（外客须声誉 ≥ 100 一代尊宿方可求教）" },
      desc: "柳青鸢压箱底的剑式，青鸢点水、回风折柳——出手时不显山露水，收剑时内伤已埋进对方筋骨。她只授给府里当差且信得过的人。",
    },
  ],

  // ── 令狐冲墓·独孤九剑：非售卖，仅通过贡措海令狐冲墓参悟获得 ──
  独孤: [
    {
      insight: { stat: "waigong", threshold: 60, label: "外功" },
      id: "kf_rec_jianzhong", name: "剑冢独坐", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      moveType: "状态",
      energyRestore: 10, immuneControl: true,
      desc: "在剑冢边上坐着，什么也不做。风穿过那些插了几十年的剑，声音很杂，坐久了就听不见了。听不见的时候，气自己回来了，心里也没什么能扰得动你。",
    },
    {
      // price 0 + insight：不卖钱，走"参悟"。门槛写成数据，WuguanScreen 据此显示
      // 「参悟」而非「购买」，够不到就明说还差多少。剑诀刻在墓壁上，看得见看不懂。
      insight: { stat: "waigong", threshold: 80, label: "外功" },
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
      unlock: { faction: "青城派", rep: 0, member: false, note: "无需拜师，青城派声誉 ≥ 0" },
      moveType: "状态",
      energyRestore: 7,
      desc: "道门正宗的行气路子，气自尾闾上夹脊、过玉枕、下重楼，绕一圈回丹田。一清道长说走这一圈要一炷香，急不得——「你催它，它就散。」",
    },
    {
      id: "kf_rec_libui", name: "离堆分水息", type: SKILL_TYPE.MOVE, quality: "紫", price: 205,
      unlock: { faction: "青城派", rep: 40, member: false, note: "拜入青城派，或青城派声誉 ≥ 40（门墙之交）" },
      moveType: "状态",
      energyRestore: 9, hpRestore: 0.12,
      desc: "仿离堆分水的理路：气到胸口一分为二，一股沉丹田，一股走四肢。不蓄在一处，就不会憋。宝瓶口边上练，水声大得听不见自己呼吸，反而练得成。",
    },
    {
      id: "kf_ting_fenshui", name: "听桥·分水", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      unlock: { faction: "青城派", rep: 40, member: false, note: "需拜入青城派，或青城派声誉 ≥ 40（门墙之交）" },
      moveType: "防御",
      onCounterSuccessEnergyGain: 5, onCounterSuccessDamageRatio: 0.5,
      desc: "听桥的青城正解。来力到身前如江水撞上离堆，自然分作两股从身侧滑过——分完那一瞬江水还在推，借的就是那一推。一清道长使这招是闭着眼的。",
    },
    {
      id: "kf_qingchengjian", name: "青城剑法", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      unlock: { faction: "青城派", rep: 0, member: false, note: "无需拜师，青城派声誉 ≥ 0（非敌对即可在三清殿外院求学）" },
      moveType: "攻击",
      // 【原来挂的是 onCounterSuccessEnergyGain】那个标志位只在「防御成功反击」时
      // 结算，挂在攻击槽的招上永远不触发。改成接反击追打，既合青城后发制人的路子，
      // 也跟松风剑法(0.3)形成入门→进阶的递进。
      afterCounterBonus: 0.2,
      desc: "青城派开蒙剑法，只有十二式，弟子上山头三个月练的就是它。招式灵动飘逸，起手不求力也不求快，只求准——剑尖始终对着对手重心那一点。松鹤道长说这套剑法一辈子都练不完，「你嫌它简单，是因为你还没被它救过命」。",
    },
    {
      id: "kf_songfeng", name: "松风剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      unlock: { faction: "青城派", rep: 15, member: false, note: "青城派声誉 ≥ 15（外门记名或门墙善缘可学）" },
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
      unlock: { faction: "青城派", rep: 80, member: true, note: "需拜入青城派且声誉 ≥ 80（或完成主线「青3·伏龙观下的三十年前剑约」获青霞子亲授）" },
      moveType: "攻击",
      // forceFirst：走"快如闪电"这条线最贴切的现成标志位——无视身法强行先手
      //（见 resolveTurn.js 同类型对撞的判定）。不卖，练功堂秘传。
      forceFirst: true,
      desc: "青城剑法练到极处的一式。不走弧、不带转，剑自鞘中直出一线，快到看不见剑身只看见一道白。全套只此一招，因为再多一招就慢了。青霞子说这一剑他练了四十年，「前三十九年在练怎么不出这一剑」。",
    },
    {
      id: "kf_ziyang", name: "紫阳神功", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 200,
      unlock: { faction: "青城派", rep: 80, member: true, note: "需拜入青城派且声誉 ≥ 80（青城派开门收徒后方可求教）" },
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
      unlock: { faction: "青城派", rep: 15, member: false, note: "无需拜师，青城派声誉 ≥ 15（颇具善缘）" },
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
      unlock: { faction: "峨眉派", rep: 0, member: false, note: "峨眉派声誉 ≥ 0，无需拜入" },
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.10,
      desc: "天不亮上金顶，等云海底下那一线红。等的时候不许动，冻得发抖也不许动。日头出来那一刻吸一口气——师太说那口气跟别的时辰不一样，「你自己会知道」。",
    },
    {
      id: "kf_rec_xiaozhuang", name: "十二庄·小庄息", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      unlock: { faction: "峨眉派", rep: 40, member: false, note: "峨眉派声誉 ≥ 40，虚白道姑传授" },
      moveType: "状态",
      energyRestore: 8, nextAttackBonus: 0.25,
      desc: "十二庄里最短的一庄，只换一个站姿。虚白道姑演示给你看，你没看出哪里变了，但她说气已经归了位。「下一下你自己使使看。」",
    },
    {
      id: "kf_ting_foguang", name: "听桥·佛光", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      unlock: { faction: "峨眉派", rep: 40, member: true, note: "峨眉派声誉 ≥ 40 且正式拜入峨眉" },
      moveType: "防御",
      onCounterSuccessEnergyGain: 6, doubleReflectDamage: true,
      desc: "峨眉不外传的听桥。双掌合什立于身前，来力撞上去像撞庙墙——墙不动，撞的人自己先受不住。玄尘师太说这一式的关键不在手上，「在你信不信那堵墙」。",
    },
    {
      id: "kf_emei_tongbei", name: "峨眉通臂拳", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      unlock: { faction: "峨眉派", rep: 0, member: false, note: "峨眉派声誉 ≥ 0，司徒瑛传授，无需拜入" },
      moveType: "攻击",
      lowHpBonus: 0.25,
      desc: "峨眉最老的一门，托名白猿祖师司徒玄空所创。相传他在山中看灵猴攀援腾挪看了十年，把猴子怎么甩臂、怎么借腰劲写成了拳。招式看着不雅相，肩臂甩得很开，但打人极疼——猴子打架从来不讲好看。",
    },
    {
      id: "kf_emei_jian", name: "峨眉剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      unlock: { faction: "峨眉派", rep: 15, member: false, note: "峨眉派声誉 ≥ 15（颇具善缘）" },
      moveType: "攻击",
      nullifyStatusOnHit: true,
      desc: "峨眉入门剑法，三十六式，式式带禅意。剑走轻灵不尚蛮力，剑尖画出的轨迹如梵文种子字——看似随意，实则每一笔都有定数。女子使来如飞天散花，男子使来如老僧扫地。",
    },
    {
      id: "kf_emei_jieshou", name: "截手九式", type: SKILL_TYPE.MOVE, quality: "绿", price: 48,
      unlock: { faction: "峨眉派", rep: 15, member: false, prestige: 0, note: "峨眉派声誉 ≥ 15 且威望 ≥ 0" },
      moveType: "防御",
      onCounterSuccessDamageRatio: 0.35,
      desc: "峨眉掌法里最不起眼的一门，专管「接」。对方拳来掌来兵刃来，九式各截一路，截住就完，不追不打。了因师太说这九式是给新弟子保命用的——「你先学会不挨打，再谈打人。」",
    },
    {
      id: "kf_emei_piaoxue", name: "飘雪穿云掌", type: SKILL_TYPE.MOVE, quality: "蓝", price: 105,
      unlock: { faction: "峨眉派", rep: 15, member: false, note: "峨眉派声誉 ≥ 15（颇具善缘）" },
      moveType: "攻击",
      ignoreDefenseRatio: 0.3,
      desc: "掌风轻柔得像拂脸上的雪，挨着不疼，退开三步才觉得胸口发闷。峨眉五峰发力里最见功夫的一门——力不出在掌上，出在肩肘之间那一寸转折里，看的人只看见袖子动了动。",
    },
    {
      id: "kf_emei_zhi", name: "兰花拂穴手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 100,
      unlock: { faction: "峨眉派", rep: 40, member: true, note: "峨眉派声誉 ≥ 40 且正式拜入峨眉" },
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.55,
      desc: "六大专修功里指穴功一路。五指如兰花绽放，指尖点出带一股柔劲，不伤皮肉专封经脉。被点中的人不疼，但半边身子动不了。解法只有两个：等两个时辰自行散开，或者让峨眉的人再点一下。",
    },
    {
      id: "kf_emei_qingxin", name: "清心普善咒", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      unlock: { faction: "峨眉派", rep: 40, member: false, prestige: 0, note: "峨眉派声誉 ≥ 40（门墙之交）且威望 ≥ 0，了因师太传授" },
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
      unlock: { faction: "峨眉派", rep: 80, member: false, prestige: 20, note: "峨眉派声誉 ≥ 80（股肱心腹）且威望 ≥ 20" },
      moveType: "防御",
      doubleReflectDamage: true,
      desc: "峨眉掌法巅峰一门。双掌合什再分开，掌心朝外一推，来力像撞在庙墙上——墙不动，撞的人手疼。金顶云海上日出时佛光现，看的人都说那是菩萨显圣；练成这门的人知道，那不过是光碰上了雾。",
    },
    {
      id: "kf_emei_huifeng", name: "回风拂柳剑", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      unlock: { faction: "峨眉派", rep: 80, member: true, note: "峨眉派声誉 ≥ 80（股肱心腹）且正式拜入峨眉" },
      moveType: "状态",
      confuseChance: 0.5, afterCounterBonus: 0.35,
      desc: "峨眉代表剑法。剑不直去，走的是回旋的路子，一剑荡开对方兵刃，剑势不停顺势卷回来，像风过柳梢那一下回摆。对手往往是被自己格挡的余力带偏的——你使多大劲挡，就被带出多远。",
    },
    {
      id: "kf_emei_shierzhuang", name: "峨眉十二庄", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 195,
      unlock: { faction: "峨眉派", rep: 80, member: true, note: "正式拜入峨眉且峨眉派声誉 ≥ 80，玄尘与虚白合传" },
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

  // ── 唐门：暗器与毒药，暗器卖给所有人；宗祠入堂石立誓可正式拜入 ──
  唐门: [
    {
      id: "kf_tm_cuntie", name: "寸铁点星手", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "攻击",
      lowHpBonus: 0.25,
      unlock: { faction: "唐门", rep: 0, member: false, note: "无需拜入，唐门声誉 ≥ 0（演武坪可学）" },
      desc: "唐门最不起眼的入门暗器手法，铁莲子、铜钱甚至半枚碎瓷片都能脱手打穴。唐三少说这门功夫不图好看，只图「对手以为你手里空着的时候，他已经少了一口气」。",
    },
    {
      id: "kf_rec_yaoxi", name: "药息", type: SKILL_TYPE.MOVE, quality: "蓝", price: 145,
      moveType: "状态",
      energyRestore: 7, immuneControl: true,
      unlock: { faction: "唐门", rep: 15, member: false, note: "无需拜入，唐门声誉 ≥ 15" },
      desc: "唐门以毒淬体的副产物：运起药息，体表渗出一层微苦的薄汗，人也跟着清醒。旁人的迷香定身之类，到了这层汗跟前就矮了三分。唐老太一边喝茶一边说「这不算功夫，是习惯」。",
    },
    {
      id: "kf_rec_xiazhong", name: "匣中静", type: SKILL_TYPE.MOVE, quality: "紫", price: 215,
      moveType: "状态",
      energyRestore: 9, nextAttackBonus: 0.35,
      unlock: { faction: "唐门", rep: 40, member: false, note: "需正式拜入唐门，或唐门声誉 ≥ 40" },
      desc: "开匣之前的那一息。十二格暗器都在手边，你不看它们，只调匀呼吸——手一稳，出去的东西才准。唐三少说店里最贵的不是暗器，是这一息。",
    },
    { id: "kf_tangmen_anqi", name: "满天星雨", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      ignoreDefenseRatio: 0.35, applyMark: { name: "内伤", stacks: 1, max: 5 },
      unlock: { faction: "唐门", rep: 40, member: true, guestRep: 80, note: "需正式拜入唐门且声誉 ≥ 40（或声誉 ≥ 80）" },
      desc: "唐门暗器总诀。袖中同时飞出七枚铁蒺藜，走七条不同弧线，封死对手三个闪避方向。不是快，是密。练到极处一袖出三十六枚，如星雨覆面，无处可躲。" },
    { id: "kf_tangmen_du", name: "百毒不侵体", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 130,
      moveType: "防御",
      desc: "唐门弟子自幼以毒淬体，小剂量百毒日日服，练出一副抗毒的筋骨。运功时体表渗出一层薄汗，带微苦药气——毒物近身先被这层汗化去三分。不是解毒，是毒到了跟前就矮了三分。",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "唐门", rep: 40, member: true, guestRep: 80, note: "需正式拜入唐门且声誉 ≥ 40（外客须声誉 ≥ 80 方可求教）" } },
    {
      id: "kf_tm_fuguang", name: "浮光掠竹步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 130,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "唐门", rep: 15, member: false, note: "唐门声誉 ≥ 15" },
      desc: "蜀南竹海里踩着暗桩练出的诡谲身法，步幅极碎，忽左忽右，专挑对手视野盲区落脚。练成后衣摆贴腿不扬尘，连吊桥上的九枚警铃都震不响。",
    },
    {
      id: "kf_tm_cuogu", name: "千机错骨针", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.5, ignoreDefenseRatio: 0.2,
      unlock: { faction: "唐门", rep: 80, member: true, note: "需正式拜入唐门且声誉 ≥ 80" },
      desc: "内堂秘传的重手毒针，专打周身关节筋膜。针入皮肉不流血，只觉半边身子渐如灌铅，三息之后气力大减。唐老太严令此针只准对付死敌，绝不许用来欺压市井。",
    },
    {
      id: "kf_tm_tianluo", name: "天罗绣影针", type: SKILL_TYPE.MOVE, quality: "红", price: 680,
      moveType: "攻击",
      forceCrit: { multiplier: 1.65 }, ignoreDefenseRatio: 0.45, applyStatus: "剧毒", statusChance: 0.4,
      unlock: { faction: "唐门", rep: 100, member: true, quest: ["tangmen_5_jiaguichujian"], note: "需正式拜入唐门、完成「唐5·家法断机」且唐门声誉 ≥ 100" },
      desc: "唐老太压箱底的镇派绝学。寻常一根三寸银绣针，在七十岁老手捻动下竟如穿花织锦，针尾牵着肉眼难辨的冰蚕细丝，一去一回皆有后手——外人只道她是在纳鞋底，等看见针影，胸口已缝好了三道血线。",
    },
  ],

  // ── 喇嘛庙：不收俗家弟子，护法禅院按喇嘛庙声誉与主线进度传授（合稿「喇嘛庙·五」）──
  // armorBreak 落为 ignoreDefenseRatio；合稿里引擎不消费的字段（bonusVsEvil/perTurnHpRestore/damageReduction/reflectDamageRatio/coldResist）未落；
  // 不动明王禅合稿写 ≥140，引擎声誉封顶 100，取 100；「≥80 且寺4完美心结」的替代路径走任务另授。
  喇嘛庙: [
    {
      id: "kf_lama_zhuantong", name: "转经调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 60,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "喇嘛庙", rep: 0, member: false, note: "无门槛（喇嘛庙声誉 ≥ 0 即可在护法禅院请教）" },
      desc: "顺着大殿外一排铜经筒走一圈，左手拨筒、右手垂膝，每转三下换一口深气。洛桑说这门功夫最妙的地方在于「腿脚不停，喘气却先平了」，走一整天雪坡也不犯头晕。",
    },
    {
      id: "kf_lama_jingangzhang", name: "大雪金刚掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 75,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2,
      unlock: { faction: "喇嘛庙", rep: 15, member: false, note: "喇嘛庙声誉 ≥ 15（颇具善缘）" },
      desc: "雪域古刹流传最广的护院掌法，出手不求花哨，专讲究像屋檐积雪突然滑落那般沉实一砸。丹巴拿它拍松柴火，根敦拿它震散病人淤血，打在恶徒胸口则是闷雷一声。",
    },
    {
      id: "kf_lama_zhongming", name: "听钟·无畏", type: SKILL_TYPE.MOVE, quality: "蓝", price: 160,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.35, immuneControl: true,
      unlock: { faction: "喇嘛庙", rep: 15, member: false, quest: ["lamamiao_2_canjuanjiuhui"], note: "喇嘛庙声誉 ≥ 15，且完成主线「寺2·残卷与旧灰」" },
      desc: "与雪山「听雪」、青城「听桥」隐隐相通的一路守势。白塔古钟三十年未响，罗布桑却仍日日对着空钟练耳力——任你刀剑风声乱成一团，心中只认那一记嗡鸣，稳住下盘便顺势震回。",
    },
    {
      id: "kf_lama_xunshanbu", name: "雪岭苦行步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 130,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "喇嘛庙", rep: 40, member: false, note: "喇嘛庙声誉 ≥ 40（门墙之交）" },
      desc: "行脚僧常年在齐膝大雪里化缘磨出来的步法。不靠腾挪轻飘，胜在脚底发力稳如岩羊，深雪冰面如履平地，疾行百里而不散一口丹田热气。",
    },
    {
      id: "kf_lama_suyoudeng", name: "酥油长明诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 150,
      moveType: "防御",
      passiveBonus: { maxHp: 22 },
      unlock: { faction: "喇嘛庙", rep: 40, member: false, note: "喇嘛庙声誉 ≥ 40（门墙之交）" },
      desc: "达摩药堂一脉相传的养元内功，运息如殿前酥油灯芯，火苗不大、却熬得住漫长寒夜。根敦常拿它替自己和重病之人吊命，修成后气血浑厚，最耐持久苦战与寒毒侵蚀。",
    },
    {
      id: "kf_lama_fumo", name: "降魔杵法", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "攻击",
      forceCrit: { multiplier: 1.55 },
      unlock: { faction: "喇嘛庙", rep: 80, member: false, quest: ["lamamiao_3_xuenihongzhua"], note: "喇嘛庙声誉 ≥ 80（股肱心腹），且完成主线「寺3·雪泥鸿爪」" },
      desc: "白塔守塔僧团秘传的刚猛杀招，原本专配重杵使出，徒手运劲亦可化掌为杵、自上而下雷霆镇压。罗布桑说：「平日低眉是慈悲，可恶鬼上了山门，总得有人举起这根铁疙瘩。」",
    },
    {
      id: "kf_lama_budongxin", name: "不动明王禅", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 480,
      moveType: "防御",
      passiveBonus: { maxHp: 45 },
      unlock: { faction: "喇嘛庙", rep: 100, member: false, note: "喇嘛庙声誉 ≥ 140（一代尊宿，引擎封顶取 100）；或声誉 ≥ 80 且触发「寺4·地宫问心」完美心结解开" },
      desc: "喇嘛庙三百年镇寺绝学，源自前任经师强巴留于白塔地宫的密传禅功。修至深处，任敌劲如雪崩压顶，周身气墙巍然如金刚石雕，非但不受惑乱控制，反将沛然佛力倒震敌手心脉。",
    },
  ],

  // ── 五仙教：苗疆蛊毒，软鞭淬毒与虫养之术，于听虫演武坪授徒 ──
  五仙: [
    {
      id: "kf_wx_tingchong", name: "听虫吐纳", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.04,
      unlock: { faction: "五仙教", rep: 0, member: false, note: "无需拜师，五仙教声誉 ≥ 0（演武坪可学）" },
      desc: "苗疆入门吐纳法：闭目听草间虫鸣，以虫息定人息。瘴气再浓的地界，运起这门功也能把肺里那口浊气一点点换出去。苏小青说难的不是学，是敢不敢真的什么都不看、只靠耳朵。",
    },
    {
      id: "kf_wx_yinshe", name: "银蛇绕腕", type: SKILL_TYPE.MOVE, quality: "绿", price: 58,
      moveType: "攻击",
      applyStatus: "淬毒", statusChance: 0.4,
      unlock: { faction: "五仙教", rep: 0, member: false, note: "无需拜师，五仙教声誉 ≥ 0（演武坪可学）" },
      desc: "五仙教入门鞭缠手法，腕上劲走螺旋，缠上兵器或手腕一拧一带，指缝里藏的草粉就抹进对方伤口。阿萝教这招时说：「疼是不疼的，就是过会儿你胳膊就不是你的了。」",
    },
    {
      id: "kf_wx_talan", name: "踏岚步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 115,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "五仙教", rep: 15, member: false, note: "五仙教声誉 ≥ 15（颇具善缘）" },
      desc: "踩着瘴气的边走的轻功。紫岚瘴低处浓高处薄，练熟了的人专挑雾气断层里落足，远远看去像贴着雾面滑行。龙汐月使起来赤足点露，裙角都不带湿的。",
    },
    {
      id: "kf_wx_yanggu", name: "五仙养蛊经", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 140,
      moveType: "防御",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "五仙教", rep: 15, member: false, note: "五仙教声誉 ≥ 15（颇具善缘）" },
      desc: "以自身气血温养母蛊的养炼法门：蛊在经脉里走得越顺，人越扛得住毒与伤痛。乌婆婆传了半辈子，总念叨「医毒同源，养的是蛊，护的是人」。",
    },
    {
      id: "kf_wx_chiwu", name: "赤蜈缠丝鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.35, ignoreDefenseRatio: 0.25,
      unlock: { faction: "五仙教", member: true, guestRep: 40, note: "需正式拜入五仙教，或五仙教声誉 ≥ 40（门墙之交）" },
      desc: "赤蜈堂鞭法正解。鞭身浸过百年毒油，抖直了穿甲破防如蜈蚣钻土，缠住了又软得卸不掉。麻九娘使的是阴毒变式，龙汐月使的是堂堂正正的快——同一条鞭子，两样心肠。",
    },
    {
      id: "kf_wx_jincan", name: "金蚕脱壳", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "防御",
      dispelSelf: true, nextAttackBonus: 0.2,
      unlock: { faction: "五仙教", member: true, guestRep: 40, note: "需正式拜入五仙教且声誉 ≥ 40（门墙之交）" },
      desc: "金蚕蛊代主受过：中招的瞬间蛊蜕替你吞了毒与点穴，人借那一蜕的力道滑出半步。蛊蜕一枚要养三个月——所以乌婆婆说，这招是用来保命的，不是用来逞能的。",
    },
    {
      id: "kf_wx_dudian", name: "五仙毒典·万蛊归宗", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 480,
      moveType: "状态",
      passiveBonus: { maxHp: 30, speedBonus: 1 },
      unlock: { faction: "五仙教", member: true, guestRep: 80, quest: ["wuxianjiao_5_yingguandingtan"], note: "需正式拜入五仙教且声誉 ≥ 80，并完成主线《蛊5·银冠定坛》得传毒典正解" },
      desc: "《五仙毒典》上下卷合一的镇派内功，万蛊听令、百毒不侵。老教主当年凭它在昆明城外一人压服三派围攻——练成者气血如蛊潮生生不息，毒物入身反成滋养。",
    },
  ],

  // ── 鱼定村：茶马灶火与熊山猎手的实用防身路数（合稿「鱼定村·五」）。不可拜入，只按鱼定村声誉与前置任务学 ──
  鱼定: [
    {
      id: "kf_yuding_biandan", name: "茶马挑担棍", type: SKILL_TYPE.MOVE, quality: "白", price: 25,
      moveType: "攻击",
      lowHpBonus: 0.2,
      unlock: { faction: "鱼定村", rep: 0, note: "鱼定村声誉 ≥ 0（晒谷演武场公开可学）" },
      desc: "雅江到鱼定滩的脚夫挑着百斤砖茶走山路，遇上恶狗山贼全靠手里这根桑木扁担。没那么多花哨起手，人越累、路越窄，横扫出去那一下越狠——保住担子就保住了全家一年的口粮。",
    },
    {
      id: "kf_yuding_zaohuo", name: "灶火调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.06,
      unlock: { faction: "鱼定村", rep: 0, note: "鱼定村声誉 ≥ 0（晒谷演武场公开可学）" },
      desc: "老孙守在滚烫羊汤锅前二十年磨出的换气法子：灶烟呛人的时候把气沉到脐下，等锅盖一掀再顺着热气吐匀。老孙说练武跟熬汤一样，火太急容易糊底，气顺了才经得起熬。",
    },
    {
      id: "kf_yuding_bozhu", name: "算盘拨珠手", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "防御",
      onCounterSuccessEnergyGain: 3, onCounterSuccessDamageRatio: 0.25,
      unlock: { faction: "鱼定村", rep: 15, note: "鱼定村声誉 ≥ 15（颇具善缘）" },
      desc: "才旦拿算盘教出来的巧劲：来势再凶，先拿两指像拨下珠似的轻轻一搭一滑，把对方的蛮力撇歪半寸，顺手再还一记快戳。她说这叫「进出平账」——谁打了你，当场就得把本利拨回来。",
    },
    {
      id: "kf_yuding_zhagen", name: "界石扎根功", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 75,
      moveType: "防御",
      passiveBonus: { maxHp: 14 },
      unlock: { faction: "鱼定村", rep: 15, note: "鱼定村声誉 ≥ 15（颇具善缘，泽仁村长点拨）" },
      desc: "当年全村汉子替老土司修水渠、抬青石界碑时练出来的笨内功。双脚抓地如老树盘根，不求轻灵飘逸，只求被人推一把、踹一脚时脊梁骨纹丝不动。",
    },
    {
      id: "kf_yuding_xunzong", name: "踏雪寻踪步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 110,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "鱼定村", rep: 40, quest: ["yudingcun_side1_yushan_chuhuan"], note: "鱼定村声誉 ≥ 40，并完成支线《村支1·熊山除患》" },
      desc: "老猎户桑登在熊山积雪里踩了四十年的步子。脚尖先探虚实，脚跟不落死力，踩在半尺厚的雪壳上只留浅浅一印。学会了这步法，跑山道比寻常江湖客快出半个身位。",
    },
    {
      id: "kf_yuding_bopi", name: "熊山剔骨刀", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      forceCrit: { multiplier: 1.45 },
      unlock: { faction: "鱼定村", rep: 40, quest: ["yudingcun_side1_yushan_chuhuan"], note: "鱼定村声誉 ≥ 40，并完成支线《村支1·熊山除患》" },
      desc: "老猎户剥熊皮、卸羊骨的刀法，绝不跟硬骨头死磕，专挑筋膜缝隙往里递。桑登从不叫它武功，只说「牲口和恶人都一样，找准了软处，一刀就省力」。",
    },
    {
      id: "kf_yuding_fuxi", name: "熊山伏息术", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      moveType: "防御",
      immuneControl: true, energyRestore: 6,
      unlock: { faction: "鱼定村", rep: 80, quest: ["village5_laolieshu_chuanren"], note: "鱼定村声誉 ≥ 80，并完成《村5·老猎户的传人》得桑登亲传" },
      desc: "老猎户压箱底的雪窝绝活。大雪夜埋伏猛兽时，把心跳压得像冻住的溪水，寒风吹不乱、虎啸震不慌，任对手点穴缠丝也锁不住这口潜气，反倒能借对方招老的空档喘回满胸真元。",
    },
  ],

  // ── 丐帮三星分舵：竹棒缠斗、醉步腾挪、刚猛掌风，重抗揍与后劲（合稿·丐帮第 5 节）──
  丐帮: [
    {
      id: "kf_rec_pomiao", name: "破庙烤火", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.08,
      unlock: { faction: "丐帮三星分舵", rep: 0, member: false, note: "无需拜入，丐帮三星分舵声誉 ≥ 0（破庙竹坪可学）" },
      desc: "大雪夜缩在漏风的土地庙里，抱紧膝盖凑着半截柴火烤手。冷到骨头缝里还能把一口暖气吊住不散，是叫花子走江湖的第一门本事。白婶说学会了这手，「饿两顿照样能翻过雪山垭口」。",
    },
    {
      id: "kf_gaibang_lianhuan", name: "莲花落棍", type: SKILL_TYPE.MOVE, quality: "白", price: 24,
      moveType: "攻击",
      lowHpBonus: 0.25,
      unlock: { faction: "丐帮三星分舵", rep: 0, member: false, note: "无需拜入，丐帮三星分舵声誉 ≥ 0（丐帮入门外功）" },
      desc: "讨饭时打竹板唱莲花落顺手改出来的棒法，专挑下三路磕膝盖、扫脚踝。招式看着滑稽寒酸，真到血肉相搏、自己快撑不住的时候，越是拼命越粘人。",
    },
    {
      id: "kf_gaibang_zuitabu", name: "醉踏青石步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 85,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "丐帮三星分舵", rep: 15, member: false, note: "丐帮三星分舵声誉 ≥ 15" },
      desc: "广汉雨后的青石板滑得能摔死骡子，严九斤提着酒葫芦走在上面却东倒西歪偏偏不倒。身法看着浑身破绽，刀锋真削过去，人早顺着酒劲滑出三尺外了。",
    },
    {
      id: "kf_gaibang_huntian", name: "混元吐纳功", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 135,
      moveType: "防御",
      passiveBonus: { maxHp: 22 },
      unlock: { faction: "丐帮三星分舵", rep: 15, member: false, note: "丐帮三星分舵声誉 ≥ 15" },
      desc: "丐帮代代相传的固本内功，不讲深山辟谷的清贵套路，专练风餐露宿、啃糙米喝冷水也能化作浑厚底气的本事。修成之后皮糙肉厚，极耐缠斗。",
    },
    {
      id: "kf_ting_zhusheng", name: "听桥·竹声", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.45,
      unlock: { faction: "丐帮三星分舵", rep: 40, member: false, note: "需正式拜入丐帮三星分舵，或声誉 ≥ 40" },
      desc: "听桥一路流落川北丐帮的变体。老槐树下竹叶沙沙响，哑巴七闭着眼敲竹板，风往哪边吹、恶犬从哪边扑，全在半寸竹影里听得清清楚楚。先引其势，顺竹反抽。",
    },
    {
      id: "kf_gaibang_daguo", name: "缠丝打犬棒", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "丐帮三星分舵", rep: 40, member: true, guestRep: 80, note: "需正式拜入丐帮三星分舵且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "三星分舵赖以成名的正宗棒法精要，讲究绊、挑、封、戳四字诀。竹棒看着轻巧，粘上兵刃便如老藤缠树，专克西域血刀的莽猛劈砍与马背长刀。",
    },
    {
      id: "kf_gaibang_fuhu", name: "裂山伏虎掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      moveType: "攻击",
      forceCrit: { multiplier: 1.65 }, nextAttackBonus: 0.25,
      unlock: { faction: "丐帮三星分舵", rep: 80, member: true, guestRep: 100, note: "需正式拜入丐帮三星分舵且声誉 ≥ 80（外客须声誉满 100）" },
      desc: "严九斤压箱底的刚猛掌法，脱胎于丐帮古传伏虎降龙一脉，又融了岷江出峡的暴烈水势。出掌前沉如醉汉伏地，推出时如山石崩裂，十成劲里还藏着三成连绵不绝的后浪。",
    },
  ],

  // ── 欢喜教：天竺摔擒、大理步法与迷香（合稿·欢喜教第 5 节；合稿 140 的门槛按声誉上限改 100）──
  欢喜: [
    {
      id: "kf_huanxi_xunxiang", name: "熏香换气", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "欢喜教", rep: 0, member: false, note: "无需拜入，欢喜教声誉 ≥ 0" },
      desc: "天都香行伙计熬夜捣香粉练出来的吐纳法子——满屋辛辣烟气里不屏息，反而顺着甜味把浊气往下压，压到丹田再一吐。李掌柜说这功夫不打人，专治「站一天柜台腿肚子转筋」。",
    },
    {
      id: "kf_huanxi_jinlun", name: "伽罗转手", type: SKILL_TYPE.MOVE, quality: "绿", price: 85,
      moveType: "防御",
      onCounterSuccessEnergyGain: 3, onCounterSuccessDamageRatio: 0.25,
      unlock: { faction: "欢喜教", rep: 15, member: false, note: "欢喜教声誉 ≥ 15" },
      desc: "梵衍那从天竺带来的旧摔擒手法，不跟人硬碰骨头，顺着对方来拳拧腕画半个圆，像老何在洱海里用船桨拨暗礁。挡住了不吃亏，还能顺手偷一口气回来。",
    },
    {
      id: "kf_huanxi_tanchen", name: "身坛养息诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 145,
      moveType: "防御",
      passiveBonus: { maxHp: 18 },
      unlock: { faction: "欢喜教", rep: 15, member: false, note: "欢喜教声誉 ≥ 15" },
      desc: "欢喜教「身即坛城」的根基心法。以药香熏脉、以内息暖脏，练久了寻常迷烟毒雾近身只觉微甜，不仅气血见长，连阿雅新调的三息醉也得多吸两口才倒。",
    },
    {
      id: "kf_huanxi_huanbu", name: "踏香游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 165,
      moveType: "状态",
      passiveBonus: { speedBonus: 2 },
      unlock: { faction: "欢喜教", rep: 40, member: false, note: "欢喜教声誉 ≥ 40" },
      desc: "罗琦把大理山民走藤桥的脚法和天竺舞步揉在了一处。脚尖点地轻得像香灰落地，进退之间带起一股极淡的甜风，等对手闻出味不对，人已经绕到了后背。",
    },
    {
      id: "kf_huanxi_milezhang", name: "弥香醉骨掌", type: SKILL_TYPE.MOVE, quality: "紫", price: 270,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "欢喜教", rep: 40, member: true, note: "需正式拜入欢喜教，且欢喜教声誉 ≥ 40" },
      desc: "出掌前先以指缝暗藏的药脂抹过掌心，劲风扑面时裹着一层暖融融的甜香。挨上一掌当下不觉多疼，两息之后四肢却像泡在热汤里发软，想架招都慢半拍。",
    },
    {
      id: "kf_huanxi_leshi", name: "乐施无碍印", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "防御",
      onCounterSuccessEnergyGain: 5, onCounterSuccessDamageRatio: 0.55, immuneControl: true,
      unlock: { faction: "欢喜教", rep: 80, member: true, note: "需正式拜入欢喜教且声誉 ≥ 80" },
      desc: "罗琦独悟的护身绝学，取教义「乐施即乐得」之意。对手打来多狠的劲，她便眉眼含笑地全盘笑纳，顺势递回去一半还带利息。她常说：「让人先占了便宜，他才肯把破绽露全。」",
    },
    {
      id: "kf_huanxi_jialuo", name: "伽罗欢喜禅功", type: SKILL_TYPE.NEIGONG, quality: "红", price: 680,
      moveType: "状态",
      passiveBonus: { maxHp: 45, speedBonus: 1 },
      immuneControl: true,
      unlock: { faction: "欢喜教", rep: 100, member: true, note: "需正式拜入欢喜教且声誉满 100" },
      desc: "天竺伽罗王族秘传的镇派心法，原本是给亡国流亡者在绝境里续命的法门。以极烈之意催极静之气，运转时周身如覆无形坛城，心神不为迷毒所乱，气血内息生生不息。",
    },
  ],

  // ── 黑风寨：马帮刀法与寨规把式，重刀重马，不使毒不弄险，于后山演武坪授艺 ──
  黑风: [
    {
      id: "kf_hf_duanshui", name: "断水刀", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "攻击",
      highHpBonus: 0.2,
      unlock: { faction: "黑风寨", rep: 0, member: false, note: "无需入伙，黑风寨声誉 ≥ 0（演武坪可学）" },
      desc: "黑风寨入门刀法，厚背刀借势下压，一刀断水——断的是对手刚起的手。彭措教这门时总说：「刃不用磨太利，分量够了，砸下去比劈下去实在。」",
    },
    {
      id: "kf_hf_tangzi", name: "趟子手摔法", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.35,
      unlock: { faction: "黑风寨", rep: 0, member: false, note: "无需入伙，黑风寨声誉 ≥ 0（演武坪可学）" },
      desc: "鹰曲马帮趟子手的缠摔把式：贴身上去别腕拧腰，把人撂倒不算完，顺手还压一穴。彭措走镖时靠它制服过三回劫道的——「摔出去的是人，留住的是命。」",
    },
    {
      id: "kf_hf_zouma", name: "狼曲走马", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 110,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "黑风寨", rep: 15, member: false, note: "黑风寨声誉 ≥ 15（颇具善缘）" },
      desc: "在狼曲河谷乱石滩上练出来的身法，步点像马趟浅水——看着慢，实则每一步都踩在最实的石头上。寨里人过河谷如履平地，追兵的坐骑倒先崴了脚。",
    },
    {
      id: "kf_hf_xiongqi", name: "熊山硬气功", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 135,
      moveType: "防御",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "黑风寨", rep: 15, member: false, note: "黑风寨声誉 ≥ 15（颇具善缘）" },
      desc: "寨里老人传的笨功夫：天不亮对着熊山风口站桩吐纳，把一口硬气养进筋骨里。不花哨，挨打的时候才知道值多少。老阿雅婶说练这个的人冬天不咳嗽。",
    },
    {
      id: "kf_hf_zhigui", name: "寨规三刀", type: SKILL_TYPE.MOVE, quality: "紫", price: 230,
      moveType: "攻击",
      ignoreDefenseRatio: 0.25, applyMark: { name: "内伤", stacks: 1, max: 5 },
      unlock: { faction: "黑风寨", rep: 40, member: false, note: "黑风寨声誉 ≥ 40（门墙之交）" },
      desc: "三刀对应寨规三条：一刀封退路、二刀落兵器、三刀点到为止。巴桑定下规矩——第三刀永远停在对手咽喉前三寸。会这三刀的人，都知道分寸比刀快重要。",
    },
    {
      id: "kf_hf_shisanduan", name: "黑风十三断", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      highHpBonus: 0.15, applyMark: { name: "内伤", stacks: 2, max: 5 },
      unlock: { faction: "黑风寨", rep: 80, member: true, guestRep: 100, note: "需入伙黑风寨且声誉 ≥ 80（外客须声誉 ≥ 100 一代尊宿方可求教）" },
      desc: "巴桑压箱底的连环刀，十三断断的是土司府巡捕营的合围阵——当年一道旧疤换来的十三年琢磨。刀势如狼曲河谷的乱风，起手无定处，收手必留人一命。",
    },
  ],

  // ── 血刀门：邪派，以杀养刀。不外传，只从厉天行身上掉 ──
  // ── 鱼定土司府·巡捕营校场（合稿·土司府第 5 节）。不可拜入，全部按土司府声誉解锁；雪域不动诀可由府4格桑顿珠真传、印山镇岳掌另要桑杰朵杰好感 45 或府4清营真传。 ──
  土司: [
    {
      id: "kf_tusi_xunshan", name: "巡山铁步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 60,
      moveType: "状态",
      passiveBonus: { speedBonus: 1, maxHp: 6 },
      unlock: { faction: "鱼定土司府", rep: 0, member: false, note: "鱼定土司府声誉 ≥ 0 即可在巡捕营校场购习" },
      desc: "巡捕营骑手下马巡岭练出来的硬步子，踩雪不滑、踏石不晃。格桑顿珠常骂新兵：「轻功不是用来飘给姑娘看的，是背着四十斤甲还能抢占高坡的！」",
    },
    {
      id: "kf_tusi_duanqi", name: "校场整肃", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "鱼定土司府", rep: 0, member: false, note: "鱼定土司府声誉 ≥ 0 即可购习" },
      desc: "巡捕营寅时点卯后的站桩调息法。腰板挺得像门前的旗杆，气沉下去，不乱喘也不露怯——站久了，连站在衙门口讨公道的百姓都先矮了三分气势。",
    },
    {
      id: "kf_tusi_maozhen", name: "镇边矛势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      nextAttackBonus: 0.25, lowHpBonus: 0.15,
      unlock: { faction: "鱼定土司府", rep: 15, member: false, note: "鱼定土司府声誉 ≥ 15（颇具善缘）" },
      desc: "格桑顿珠压箱底的军阵长兵路数，化繁为简，就三下：压、扎、挑。不跟江湖人比花巧，专破单打独斗的游击散招，一杆矛捅出去像一堵移动的墙。",
    },
    {
      id: "kf_tusi_tiebian", name: "敕令铁鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      forceCrit: { multiplier: 1.55 },
      unlock: { faction: "鱼定土司府", rep: 40, member: false, note: "鱼定土司府声誉 ≥ 40（门墙之交）" },
      desc: "土司府执法重技，原本配的是沉铁马鞭与硬木算筹。抽出去带着破风的尖啸，打的不是要害，打的是「不守规矩」那口气——挨上一鞭，半边身子都发麻。",
    },
    {
      id: "kf_tusi_budong", name: "雪域不动诀", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 280,
      moveType: "防御",
      immuneControl: true,
      passiveBonus: { maxHp: 28 },
      unlock: { faction: "鱼定土司府", rep: 40, member: false, bypassFlag: "tusi_gesang_true_heir", note: "鱼定土司府声誉 ≥ 40（门墙之交），或府4格桑顿珠真传" },
      desc: "三十年前老土司桑杰大侠融合藏地密息与中原内功所创的护体心法。气行周天如雪峰盘踞，任狂风扑面岿然不动；只是如今府里懂它本意的人，满打满算不过两个。",
    },
    {
      id: "kf_tusi_yinshan", name: "印山镇岳掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      moveType: "攻击",
      forceCrit: { multiplier: 1.75 }, nextAttackBonus: 0.35,
      unlock: { faction: "鱼定土司府", rep: 80, member: false, favor: { npc: "桑杰朵杰", min: 45 }, bypassFlag: "quest_ts4_purge", note: "鱼定土司府声誉 ≥ 80（股肱心腹）且桑杰朵杰好感 ≥ 45，或府4清营后桑杰朵杰亲授" },
      desc: "桑杰朵杰不轻易示人的世家绝学。出掌前看不出半分杀气，落下来却似一方千斤官印从天压顶，外绵内沉、劲透脏腑。三十年前雪山崖底，老土司正是以此掌接下了呼延大侠的剑。",
    },
  ],
  // ── 血刀部：天龙教血刀部磨刀坪传功。想往深学，先在天龙教把声名挣出来 ──
  血刀: [
    {
      id: "kf_rec_chuoxue", name: "啜血还气", type: SKILL_TYPE.MOVE, quality: "橙", price: 80,
      moveType: "状态",
      energyRestore: 12,
      desc: "血刀门的路子：把干在指缝里的血痂抠下来吃了。气回得极快，快到不像人该有的速度。厉天行说这没什么讲究，「你饿了会吃饭，我这就是吃饭」。",
      unlock: { faction: "天龙教", rep: 0, member: false, note: "非敌对即可在磨刀坪学" },
    },
    {
      id: "kf_rec_daoxiu", name: "刀锈入喉", type: SKILL_TYPE.MOVE, quality: "紫", price: 180,
      moveType: "状态",
      energyRestore: 8, forceCrit: { multiplier: 1.35 },
      desc: "舔一下刀背。铁锈味混着别人的血腥味压在舌根，恶心，但眼睛会红。红了之后下一刀的分量不一样——这门功夫从不解释为什么。",
      unlock: { faction: "天龙教", rep: 15, member: false, note: "天龙教声誉 ≥ 15（厉天行另眼相看者亦可求教）" },
    },
    { id: "kf_xuedao", name: "血刀大法", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      // hpRestore 是招式层已经跑通的字段（resolveTurn 里按最大气血比例结算），
      // 设计稿原写的 lifesteal（按实际伤害比例吸血）全项目没有接线，写了也不生效，
      // 所以这里落在 hpRestore 上——"砍中就回一口"的观感一样，但它是真的会回血。
      hpRestore: 0.06,
      moveType: "攻击",
      desc: "以血养刀，以杀证道。每一刀劈出都带着铁锈般的血腥气，砍中对手时刀身会吸——不是吸肉，是吸气。被砍中的人伤口愈合极慢，而持刀者面色红润。练到极处，一刀下去，对手瘦一圈，你胖一圈。",
      passiveBonus: { maxHp: 10 },
      unlock: { faction: "天龙教", rep: 80, member: true, note: "需拜入天龙教且声誉 ≥ 80（门人秘传，外客不可求教）" } },
  ],

  // ── 天龙教本部：西风演武场。玄甲军的拳、旧部的印、教主的劲，各挣各的声名 ──
  天龙: [
    {
      id: "kf_tl_xifengbu", name: "西风踏沙步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 85,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      desc: "西风隘的孩子五岁就学这个：沙地上一错步，人借着风势滑出去半丈。厉苍龙说这不是轻功，是「不给风添麻烦」。",
      unlock: { faction: "天龙教", rep: 0, member: false, note: "非敌对即可在西风演武场学" },
    },
    {
      id: "kf_tl_shahuang", name: "沙暴震岳拳", type: SKILL_TYPE.MOVE, quality: "蓝", price: 160,
      moveType: "攻击",
      forceCrit: { multiplier: 1.35 },
      desc: "玄甲军的正拳。出拳不快，像沙暴先压过来再砸下来——架住的觉得手麻，没架住的觉得地晃。",
      unlock: { faction: "天龙教", rep: 15, member: false, note: "天龙教声誉 ≥ 15" },
    },
    {
      id: "kf_tl_zhigezhang", name: "止戈印", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "防御",
      energyRestore: 6,
      desc: "白衣旧部传下来的手印：掌心朝外一推，来势在掌前硬生生顿住——不是挡，是让对方自己停下来。天王说止戈为武，旧部说那是天王一个人的武。",
      unlock: { faction: "天龙教", rep: 40, member: false, note: "天龙教声誉 ≥ 40（止戈经帐与天王旧部认可）" },
    },
    {
      id: "kf_tl_longyuan", name: "龙渊霸世劲", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.5 },
      desc: "厉苍龙压箱底的劲。劲发时人不像在打人，像整条西风隘压下来——盔甲、横练、招架，全都不作数，只作数一件事：你站不站得住。",
      unlock: { faction: "天龙教", rep: 80, member: true, note: "需拜入天龙教且声誉 ≥ 80（门人秘传，外客不可求教）" },
    },
    {
      id: "kf_tl_babujing", name: "八部天龙经", type: SKILL_TYPE.NEIGONG, quality: "红", price: 980,
      moveType: "防御",
      passiveBonus: { maxHp: 70 },
      desc: "天龙教镇教内功，只此一册，在断崖石室的老天王手里。八层关隘层层相扣，练到深处气脉自行周天——教里传说，练成它的人才能真正统合玄甲与白衣两脉。",
      unlock: { faction: "天龙教", rep: 100, member: true, quest: ["tianlong_5_baiqizhige"], note: "需拜入天龙教且声誉 ≥ 100（镇教经卷，还须天5 之局了结后由厉苍天亲传）" },
    },
  ],

  // ── 三星派：古蜀剑派，不设铺面不收束脩，武学只从面具试炼来 ──
  // 三星派七门（合稿·三星派第五节）。旧四门保留原 id 与效果，补上价钱和门槛。
  // 声誉上限 100：金乌破妄剑外客门槛由合稿 140 收到 100；member 条目本门弟子走 rep，外客走 guestRep。
  三星: [
    {
      id: "kf_sanxing_tingfeng", name: "听风铜剑", type: SKILL_TYPE.MOVE, quality: "绿", price: 85,
      moveType: "攻击",
      nextAttackBonus: 0.15,
      unlock: { faction: "三星派", rep: 15, note: "三星派声誉 ≥ 15（无需正式拜入）" },
      desc: "墟外听风人姜泠常使的入门剑路。鸭子河畔雾大看不清人，便先听风擦过芦苇的响动再递剑。不求一剑封喉，只求上一剑试出虚实，下一剑稳稳落在空门上。",
    },
    {
      id: "kf_rec_guixu", name: "归墟坐忘", type: SKILL_TYPE.MOVE, quality: "橙", price: 160,
      moveType: "状态",
      energyRestore: 12,
      unlock: { faction: "三星派", rep: 15, quest: ["sanxingpai_2_sanmianjianzhen"], note: "三星派声誉 ≥ 15 且通过「星2·三面试剑」" },
      desc: "纵目者那一式的皮毛。闭眼，把自己当成一件被放回坑里的青铜器——三千年没人动过，也就三千年没耗过。睁眼时气是满的。",
    },
    {
      id: "kf_sanxing_xuantong", name: "玄铜镇岳势", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "防御",
      immuneControl: true, onCounterSuccessDamageRatio: 0.35,
      unlock: { faction: "三星派", rep: 40, note: "三星派声誉 ≥ 40" },
      desc: "青铜面人·甲与丙守坪时最爱用的重剑架势。双足钉死夯土，宽背铜剑横在胸前如门板，任你百般巧劲刺来，先吃住你七分力道，再顺着铜脊沉沉反震回去。",
    },
    { id: "kf_sanxing_bu", name: "神树步", type: SKILL_TYPE.QINGGONG, quality: "紫", price: 210,
      moveType: "状态",
      unlock: { faction: "三星派", rep: 40, note: "三星派声誉 ≥ 40" },
      desc: "三星堆青铜神树九枝九鸟，枝杈交错毫无规律。步法脱胎于此，走位如攀树，每一步都踩在你判断不到的枝杈上。不是快，是无规律——你预判他往左，他往上了；你预判他落地，他还在半空拐了个弯。",
      passiveBonus: { speedBonus: 2 } },
    {
      id: "kf_rec_neishi", name: "纵目内视", type: SKILL_TYPE.MOVE, quality: "紫", price: 220,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.12, immuneControl: true,
      unlock: { faction: "三星派", rep: 40, member: true, guestRep: 80, note: "正式拜入三星派且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "戴上面具之后视野窄了，反而看得见自己身体里的事——哪条经堵着，哪处旧伤没长好，一目了然。看见了，也就理顺了。青铜面人不说话，他们就这么互相教。",
    },
    { id: "kf_sanxing_jian", name: "纵目剑法", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "攻击",
      ignoreDefense: true,
      unlock: { faction: "三星派", rep: 40, member: true, guestRep: 80, note: "正式拜入三星派且声誉 ≥ 40（外客须声誉 ≥ 80）" },
      desc: "剑走直线，不拐弯。三星堆青铜面具的眼睛是凸出来的，看人不看表面，看穿。剑也一样：不刺你格挡的地方，刺你格挡之后的地方。一剑出去你挡了，但剑尖已经在你身后。三千年前的剑法本没有名字，后人叫它纵目——纵目所见，皆是要害。" },
    {
      id: "kf_sanxing_jinwupowang", name: "金乌破妄剑", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.8 }, ignoreDefenseRatio: 0.45,
      unlock: { faction: "三星派", rep: 80, member: true, guestRep: 100, quest: ["sanxingpai_4_sanshinianjiushi"], note: "通过「星4·三十年前的旧客」，且正式拜入三星派、声誉 ≥ 80（外客须声誉满 100）" },
      desc: "纵目者枯坐青铜神树之巅三十年所悟的镇派绝剑。一剑挥落如金乌破开鸭子河千重阴雾，专斩世间一切护体假势与虚妄心障——剑光过后，真假自明，强弱立判。",
    },
  ],

  // ── 百花门：毒蛊耗血、控场祛毒、灵动反制（合稿·百花门五）。百花门无拜师堂，
  // 全部靠百花门声誉门槛+指定任务解锁，在百花暖棚·传艺地购学。rep140 合稿值
  // 按引擎声誉封顶 100 记；花3/花4 任务未落地前对应武学保持先锁（同雪山惯例）。
  百花: [
    {
      id: "kf_baihua_huaniang", name: "花酿换气", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.06, dispelSelf: true,
      unlock: { faction: "百花门", rep: 0, member: false, note: "百花门声誉 ≥ 0，入门即学（暖棚传艺地）" },
      desc: "百花楼的姑娘端着酒盘子站一夜不倒，全靠花婆教的一口换气法——吸进肺里的是苦艾香，吐出去的是宿醉气。小蝉说练熟了连喝三碗劣质青稞烧都不上头，中了小毒也能顺气逼出三分。",
    },
    {
      id: "kf_baihua_yinci", name: "银梅点刺", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "攻击",
      applyStatus: "裂伤", statusChance: 0.4, ignoreDefenseRatio: 0.15,
      unlock: { faction: "百花门", rep: 15, member: false, note: "百花门声誉 ≥ 15（颇具善缘）" },
      desc: "兰姐教楼里姑娘防身的三手发簪功夫。不拼蛮力，专挑手腕脉门与肘窝脆处扎——「醉汉手重，你跟他比劲是傻，扎他麻筋一寸，他自己就把酒碗松了。」",
    },
    {
      id: "kf_baihua_fudie", name: "拂蝶穿花步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 135,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "百花门", rep: 40, member: false, note: "百花门声誉 ≥ 40（门墙之交，持素梅牌）" },
      desc: "在桌椅挤得转不开身的酒楼大堂里练出来的步法。脚尖蹭着裙摆滑出去，人影还在左桌敬酒，袖口已经擦过右桌客人的刀柄。阿芷练这步子时脚踝绑着两串铜铃——什么时候走完一圈不响，才算入门。",
    },
    {
      id: "kf_baihua_biyu", name: "碧玉养蛊诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 150,
      moveType: "防御",
      passiveBonus: { maxHp: 18 },
      unlock: { faction: "百花门", rep: 40, member: false, note: "百花门声誉 ≥ 40（门墙之交，持素梅牌）" },
      desc: "原是苗疆五仙教入门心法，到了花婆手里删去三分狠毒、添了七分温养。以微毒日日试炼经脉，久练之下寻常蒙汗药与山瘴近身只觉鼻尖微凉，气血也比旁人沉厚耐耗。",
    },
    {
      id: "kf_baihua_tingxiang", name: "听香避瘴势", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "防御",
      immuneControl: true, onCounterSuccessDamageRatio: 0.35, applyStatus: "淬毒", statusChance: 0.3,
      unlock: { faction: "百花门", rep: 80, member: false, note: "百花门声誉 ≥ 80（股肱心腹，持银梅令）" },
      desc: "不硬架来招，只顺着风声退半步，袖底扬起一撮无色花尘。对手招式越猛，吸进去的药粉越深。花婆讲得好：「疯狗扑上来咬人，你伸手捂它嘴作甚？往它鼻尖吹把花椒面就老实了。」",
    },
    {
      id: "kf_baihua_jincan", name: "金蚕缠丝鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.35, ignoreDefenseRatio: 0.15,
      unlock: { faction: "百花门", rep: 80, member: false, quest: ["baihuamen_3_shixinyudu"], note: "百花门声誉 ≥ 80 且完成花3·蚀心余毒（任务未落地前先锁）" },
      desc: "三尺软银丝浸过百花露与金蚕涎，抖开像一缕月光，抽在身上先不觉痛，三息之后骨缝里才往外冒寒酸劲。阿芷说这招最不讲体面——专缠那些爱摆架子的名门剑客手腕。",
    },
    {
      id: "kf_baihua_shixin", name: "百花蚀心掌", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.5 }, applyStatus: "剧毒", statusChance: 0.4, ignoreDefenseRatio: 0.25,
      unlock: { faction: "百花门", rep: 100, member: false, quest: ["baihuamen_4_wuxianjiuan"], note: "百花门声誉 ≥ 100（合稿写140，引擎封顶100）且完成花4·雾隐旧案，兰姐亲授（任务未落地前先锁）" },
      desc: "脱胎自《五仙毒典》残页的镇楼杀招，兰姐流亡十年里只在天都镇外荒野动过一回。掌风拂面先闻梅香，继而五脏如浸冰水，内力越深厚的人反而越压不住这股逆行寒毒——兰姐传你时只嘱咐一句：「用完这一掌，记得洗手。」",
    },
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

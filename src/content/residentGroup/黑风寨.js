export default { residentGroup: {
黑风寨: [
    {
      name: "巴桑", id: "resident_basang", levelCap: 4,
      brief: "黑风寨首领，脸上有道旧疤",
      personality: "沉稳克制，寨规立得严，对手下心软，对土司府旧账耿耿于怀",
      carry: [
        { name: "黑风断刃", category: "weapon", quality: "绿" },
        { name: "红缨枪", category: "weapon", quality: "绿" },
        { name: "黑风寨分发刀", category: "weapon", quality: "蓝" },
        { name: "马帮硬皮褂", category: "armor", quality: "绿" },
        { name: "黑风令", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
      ],
      fullBio: `出身与旧账（总纲第五章·黑风寨）：巴桑原本是玉泉寨一户普通牧民家的
次子。那年家里的牦牛被土司府差役牵走抵税，父亲当场气病，不到半年过世。
巴桑没有走告官、也没有忍气吞声，他上了山，纠集了七八个跟他一样被逼到
绝境的人。第一次下山"借"回来的东西，只够全寨人吃三个月的糌粑。这笔
十年前戍边税逼死父亲的旧账，是他与土司府（尤其是管家）不共戴天的
根子。

其人（本轮完整设计）：三十出头，脸上有一道被土司府巡捕营砍的旧疤——
十年前上山那晚留下的。说话不多，做决定很快，从不虐杀。他有一条不成文
的寨规："不抢救命的口粮，不伤妇孺，不碰玉泉寨的人"（黑风寨从不打劫
自己的老乡）。真正的目标是土司府的税粮车队、锦官城的官家货运，以及
个别民愤极大的富商；玉泉寨、鱼定村这些普通百姓的商队，反而是黑风寨
"顺手"护送的对象——不收护送费，只是路过顺路，但商队主人心知肚明是
黑风寨罩着才平安过路。这是"义匪式"经营，不是典型山贼。

寨众与家人：黑风寨如今约四十余人，三分之一是当年一起上山的老人，
其余是陆续投奔来的（还不上税的、被管家手下打断腿赶出村的、也有个别
图财的江湖亡命徒——巴桑不喜欢这类人，赶不走，只能压着他们别做太过）。
内部有核心决策层（五六个老兄弟）、眼线、"刀口"（约二十名青壮），
还有跟着上山的老弱妇孺负责后勤。他有个妹妹卓央，没跟他上山，留在
玉泉寨嫁了人；巴桑每年托手下悄悄送东西，从不现身，卓央知道是谁送的，
从不声张也从不拒收。

对外关系：不共戴天于土司府，克制守护玉泉寨，与锦官城／都事保持
"雷声大雨点小"的默契。`,
    },
    {
      name: "卓央", id: "resident_zhuoyang", levelCap: 1,
      brief: "巴桑之妹，嫁在寨子边缘",
      personality: "话不多，惦记着哥哥，怕给他惹麻烦，收东西时手会抖",
      carry: [
        { name: "鱼定猎刀", category: "weapon", quality: "白" },
        { name: "百褶皮围", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "格桑花籽", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "老阿雅婶的止咳散", category: "misc", quality: "绿" },
      ],
    },
    {
      name: "嘎则", id: "resident_gaze",
      brief: "养着一只白虎的少女",
      personality: "天真直接，跟雪团寸步不离，对外人先戒备后依赖",
      levelCap: 3,
      carry: [
        { name: "大草甸套索", category: "weapon", quality: "白" },
        { name: "格桑花染布衣", category: "armor", quality: "绿" },
        { name: "格桑铃", category: "accessory", quality: "蓝" },
        { name: "虎乳牙", category: "accessory", quality: "蓝" },
        { name: "桂花糖", category: "misc", quality: "白" },
        { name: "格桑花籽", category: "misc", quality: "白" },
        { name: "虎糖草", category: "misc", quality: "绿" },
        { name: "狼曲冷水鱼", category: "misc", quality: "白" },
      ],
    },
    // 合稿·黑风寨「三、人物」原创角色补驻场。
    {
      name: "贡布", innerRoom: "寨内公共区", id: "resident_gongbu", levelCap: 3,
      brief: "黑风寨二当家兼铁匠，原鱼定村老佃户，右腿被陆福生打瘸",
      personality: "厚道直爽，嘴硬心软，护着寨里老弱；最恨彭老四那伙不守寨规的亡命徒",
      carry: [
        { name: "百炼锻铁锤", category: "weapon", quality: "蓝" },
        { name: "焦边熟牛皮围裙", category: "armor", quality: "绿" },
        { name: "旧铜算盘珠手串", category: "accessory", quality: "白" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "熊山续骨膏", category: "misc", quality: "绿" },
        { name: "牦牛粪饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "旺堆", innerRoom: "寨后岩洞", id: "resident_wangdui", levelCap: 2,
      brief: "黑风寨眼线头目兼暗库管事，原川西马帮脚夫",
      personality: "嘴碎精明，滑不留手，看似贪财怕死，实则死忠于救过他命的巴桑",
      carry: [
        { name: "马帮短弯匕", category: "weapon", quality: "绿" },
        { name: "双层暗袋羊皮袄", category: "armor", quality: "绿" },
        { name: "三城脚夫铜腰牌", category: "accessory", quality: "蓝" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "黑风寨草药包", category: "misc", quality: "绿" },
        { name: "酥油茶", category: "misc", quality: "白" },
      ],
    },
    {
      name: "彭老四", innerRoom: "寨内公共区", id: "resident_penglaosi", levelCap: 3,
      brief: "黑风寨外乡亡命徒头目，外号「铁爪鹞」，寨内主战逐利派",
      personality: "贪婪暴躁，阴狠现实，视巴桑的寨规为妇人之仁，一心抢一票大的远走高飞",
      carry: [
        { name: "血锈铁链钩", category: "weapon", quality: "蓝" },
        { name: "暗嵌铁片黑布衫", category: "armor", quality: "绿" },
        { name: "沉甸甸的碎银荷包", category: "accessory", quality: "绿" },
        { name: "黑风寨土烧", category: "misc", quality: "绿" },
        { name: "风干牦牛肉", category: "misc", quality: "白" },
        { name: "狼曲冷水鱼", category: "misc", quality: "白" },
        { name: "黑风寨草药包", category: "misc", quality: "绿" },
      ],
    },
  ]
} };

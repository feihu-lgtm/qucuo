// 化形灵兽同伴全档案（纯数据单源：雪豹→白栖雪、小珍珠→夏明珠）
// 供同伴实例化、初次入队化形叙事、人物图鉴、体貌门控与提示词总控台共用。

export const HUMAN_PROFILE_REV = 1;

export const COMPANION_PROFILES = Object.freeze({
  snowLeopard: Object.freeze({
    key: "snowLeopard",
    beastName: "雪豹",
    humanName: "白栖雪",
    nativeName: null,
    aliases: Object.freeze(["雪豹", "白栖雪"]),
    title: "雪线孤影",
    gender: "女",
    age: 22,
    faction: "雪线灵兽",
    levelCap: 2,
    humanFormFlag: "snow_leopard_humanized",
    brief: "雪线之上的灵兽化形女子，银发松石，孤高寡言而只认主",
    beastBrief: "长卧村口青石的雪白灵兽，前爪有旧伤",
    personality: "化形为二十二岁清冷女子白栖雪，对旁人疏离寡言、戒心极高，认主后却忠贞黏人，骨子里仍留着雪线猎手的敏锐与独占欲。",
    lifeHistory: "自雪线冰川之巅而来，非嘎则或任何土司府驯养之兽，长年卧于鱼定村村口青石静候前世羁绊之人。七灵试心后认主结契，蜕去兽身化名「白栖雪」伴行江湖，平日按剑护侧，夜宿必守在主人身旁三尺之内。",
    fullBio: "白栖雪，本相乃雪线之上无主雪豹，前世与主角结下深重羁绊。久卧鱼定村青石，只待有灵之人喂肉、顺毛、治伤、立功以证心意。认主入队那一刻，寒雾敛身化作年满二十二岁的成年女子：及腰银发垂着松石蓝珠与金穗流苏，额心嵌菱形绿松石额饰，一对缀着墨斑的雪豹兽耳与身后粗长斑尾仍保留本相印记。她虽可随心意在兽形与人形间切换，然既已开口吐出「白栖雪」三字，此生便再无二心。",
    likes: "生鲜牦牛肉、温热羊乳、清冽雪水，以及主人顺毛轻挠她豹耳与颈后；忌讳喧闹油腻市井酒气、被人从背后骤然擒尾或擅碰额饰。",
    hobby: "夜深独坐高处擦拭松石长剑，或化回兽相用粗长斑尾圈住主人手腕小憩。",
    tradeStyle: "不善与外人讨价还价，随身物件只凭主人心意取用，旁人递再多银两也只冷眼旁观。",
    kungfu: Object.freeze({
      school: "雪隐三绝·栖雪剑掌",
      neigongName: "玄冰吐纳诀",
      qinggongName: "冰川无声步",
      weapon: "松石金穗长剑 / 裂岩五指",
      desc: "由雪线捕猎本能与前世剑意融汇而成，讲求伏低敛息、蓄势骤扑与无声步法；化形后将肉垫步法与掌劲并入剑势，一击即中脊骨裂隙。",
      moves: Object.freeze([
        Object.freeze({
          slot: "攻击", archetype: "硬攻", name: "碎岩击",
          desc: "借俯冲之势将全身劲力灌入五指与剑脊，正击敌身骨缝裂点，不追不缠、一掌炸开劲伤。",
        }),
        Object.freeze({
          slot: "防御", archetype: "防守反击", name: "融雪",
          desc: "伏低敛息使体温与寒风同频，外息几近于无；待敌方失准贴近的刹那顺势反击。",
        }),
        Object.freeze({
          slot: "状态", archetype: "蓄势", name: "冰川步",
          desc: "踩冰踏雪无声侧移半步，足印如冰川裂隙扩散，借闪避调整扑杀站位、蓄起下一击重势。",
        }),
        Object.freeze({
          slot: "回气", archetype: "回气", name: "伏雪憩息",
          desc: "寻背风处静坐调运玄冰吐纳诀，斑尾轻搭膝头，豹耳半垂，数息间气息复匀。",
        }),
        Object.freeze({
          slot: "绝技", archetype: "硬攻", name: "松石孤雪剑",
          desc: "化形后方才施展的合剑杀招，拔剑时金穗先动、剑光冷白如雪线日照，直取对手护心空门。",
        }),
      ]),
    }),
    bodyProfile: Object.freeze({
      height: "一米七一，身姿高挑修长，站立时肩平颈直，自带雪线猛兽居高临下的冷冽气场",
      build: "年满二十二岁（十八岁以上）的成年女子高挑柔韧身段，骨架纤窄，细腰极富柔韧度、背脊可折出猫科弧度，曲线挺拔利落",
      face: "冷艳成熟的精致轮廓，眉眼微狭上挑，淡蓝灰兽目竖瞳，额心嵌菱形绿松石额饰，神情疏离克制",
      skin: "肤白胜雪、平日微凉如冰玉，肩头、侧腰与小腹隐约透出长在皮肉里的淡墨色雪豹斑纹，体温升高时花斑愈发分明",
      hair: "及腰雪白银发，发间垂着松石蓝珠与金穗流苏，头顶生一对白绒缀墨斑的雪豹兽耳",
      voice: "人形时能开口说人话，嗓音清冷偏低、措辞简短克制；被顺毛或情潮涌起时会碎成压抑哑喘，喉咙深处溢出猫科呼噜低鸣",
      clothing: "身披半透雪纹薄纱外衫、内衬贴身豹纹短衣，腰系细金链与绿松石挂饰，步动间金链贴肤轻响，身后拖着粗长雪豹斑尾，手按松石金穗长剑",
      scars: "肌肤无疤，肩胛、腰侧至髋骨一路蜿蜒着天然墨色雪豹花斑，尾根与后腰衔接处毛色雪白浓密",
      scent: "平日是清冽的高原雪水、冷松针与淡松石矿气，贴身温热后从颈窝与墨斑腰侧散出一缕微甜冷麝香",
      intimate: "成年高挑冷艳女体，体表平日偏凉，贴合动情后迅速从耳根、墨斑边缘与腰腹透出滚烫热度，半透薄纱与冰凉金链贴在滚烫雪肤上反差极烈",
      sensitive: "豹耳耳根与后颈（顺毛或衔咬颈侧会弓背溢满呼噜低鸣）、粗长斑尾尾根（抚握即浑身轻颤、长尾反卷缠腕缠腰）、带墨斑的侧腰与肋下",
      habit: "平日孤高冷淡，床笫间反差极烈且独占欲强，最偏好被从背后环抱掌控节奏与衔咬颈侧；动情时竖瞳缩线、用粗长斑尾勾缠拉扯、用兽耳蹭人求欢，情浓时轻啃主人肩头留月牙印，事后蜷在怀里细细舔舐指尖如猫科理毛",
    }),
    nsfwProfile: Object.freeze({
      summary: "白栖雪是年满二十二岁的化形成年女子，清冷孤高的外表下压着极烈的猫科兽性与独占欲；平日冰凉自持，动情时耳根、墨斑腰侧与腿心却发烫得惊人，嘴上寡言、身子诚实极了。",
      chest: "肩胛瘦削平直，锁骨深而利落，胸前肌肤雪白偏凉，微喘时胸膛起伏带起薄纱下细金链轻颤，一经捂热便迅速泛开大片醉红。",
      breasts: "一对大小适中却极挺拔饱满的雪白双乳，形如凝脂扣碗、弹性惊人，因常披半透雪纹薄纱而隐现弧度；乳晕呈极浅冰粉色，顶上两颗娇小乳尖平日怕冷微缩，舌尖轻拨或指腹揉捻便立刻硬挺充血、泄出细碎哑喘。",
      butt: "窄腰下方收出一双紧致挺翘的冷白蜜桃臀，髋线修长有力、拍揉时弹韧生香；臀瓣上方尾椎衔接处长着粗长柔密的雪豹斑尾，握住尾根揉捏时她会本能塌腰后顶，用圆润臀肉贴磨掌心。",
      vulva: "腿心芳草稀疏洁白如细绒，掩着一线闭拢粉嫩的幽微花穴；平日偏凉克制，一旦被顺毛舔耳便骤然发烫湿润，外唇薄而紧致、内壁层叠软热且咬合吸吮极紧，情浓时会跟着呼噜低鸣一波波绞紧流出清甜蜜水。",
      legsAndFeet: "一双修长笔直、肌理匀称的雪白长腿常赤足踏雪，大腿内侧皮肉冰凉滑嫩，极怕掌心慢磨；足弓高挑秀丽、脚踝纤细，十枚脚趾圆润粉白，动情被压住时足趾会紧蜷扣紧。",
      sensitive: "豹耳耳根与后颈咬痕处、粗长斑尾尾根（一握即浑身发软）、淡墨斑纹蔓延的腰窝与肋侧、以及怕冷又怕热的挺立乳尖。",
      habit: "极度偏爱主人从背后整具环抱掌控节奏、边揉按腰侧墨斑边咬住后颈；情急时竖瞳缩成细线、粗长斑尾死死缠紧主人腰腕，齿尖在肩头留下浅浅月牙咬痕，事后乖顺窝进怀里细舔主人指节。",
    }),
    firstJoinCue: "寒雾自青石周遭骤起又收束，雪白兽躯化为二十二岁银发冷艳女子「白栖雪」；她额间菱形绿松石微闪，头顶豹耳轻抖、身后斑尾微卷，手按松石长剑清冷开口自报姓名「白栖雪」，只认主角为主。",
    carry: Object.freeze([
      Object.freeze({ name: "松石金穗长剑", category: "weapon", quality: "蓝", slot: "equipment", cherish: 95, sellable: false }),
      Object.freeze({ name: "雪纹薄纱豹纹衣", category: "armor", quality: "蓝", slot: "equipment", cherish: 90, sellable: false }),
      Object.freeze({ name: "菱形松石额饰", category: "accessory", quality: "蓝", slot: "equipment", cherish: 95, sellable: false }),
    ]),
    stealables: Object.freeze({
      equipment: Object.freeze([
        Object.freeze({ name: "松石金穗长剑", quality: "蓝", desc: "雪白银鞘嵌绿松石与金穗的随身长剑", slot: "equipment", cherish: 95, sellable: false }),
        Object.freeze({ name: "雪纹薄纱豹纹衣", quality: "蓝", desc: "寒气凝织而成的半透雪纹薄纱与贴身豹纹短衣", slot: "equipment", cherish: 90, sellable: false }),
      ]),
      sundries: Object.freeze([
        Object.freeze({ name: "雪线霜晶", desc: "雪山绝顶带来的冷晶石，揣在袖中常年微凉", slot: "bag" }),
      ]),
    }),
  }),

  pearl: Object.freeze({
    key: "pearl",
    beastName: "珍珠",
    humanName: "夏明珠",
    nativeName: "哈瓦夏日",
    aliases: Object.freeze(["珍珠", "小珍珠", "哈瓦夏日", "夏明珠"]),
    title: "踏雪白驹",
    gender: "女",
    age: 20,
    faction: "曲措灵驹",
    levelCap: 2,
    humanFormFlag: "pearl_humanized",
    brief: "灵马珍珠化形女子夏明珠，高马尾马耳惫懒贪吃，护主时脚力惊人",
    beastBrief: "村口通体雪白的小白马，爱低头啃草",
    personality: "化形为二十岁明艳女子夏明珠（藏名哈瓦夏日），平日惫懒散漫、最爱干饭与晒太阳躺平，说话直白讨喜，认主后却护短忠贞、紧要关头寸步不离。",
    lifeHistory: "生于鱼定村边的一匹神俊白马，藏语原名「哈瓦夏日」（意为灰色的梅花鹿），嫌赛马太累而一心干饭躺平。直到被主角真心牵起缰绳邀作同伴，灵机顿开褪去兽相化形为二十岁少女「夏明珠」，仍保留高马尾与一对白栗马耳、蓬松马尾，一边嘀咕饿了找吃的，一边以惊人脚力随侍左右。",
    fullBio: "夏明珠，江湖唤作小珍珠、原本的藏名为「哈瓦夏日」。它本是一匹睫毛极长、丰神俊朗的雪白灵马，志不在争雄夺魁，生平只讲究专心干饭与就地躺平。一旦认准主角相邀同行，当场化作年满二十岁的明艳健美女子：高扎栗色长马尾、发间立着会随心情转动的马耳、腰后拖着蓬松马尾，穿比基尼外罩轻纱小衣。她既能在马形与人形间随心转换，护主之时亦毫不含糊，双腿一发力便是白影掠阵。",
    likes: "青稞精料、鲜甜苜蓿嫩尖、热腾腾的肉包子与酥油茶，以及饭后靠在主人怀里晒太阳犯懒；最烦别人催她赶死路或克扣零嘴干粮。",
    hobby: "每逢进城先嗅遍食摊香味，闲来把主人腿当枕头晃着马尾打盹。",
    tradeStyle: "嘴馋耳根软，遇上卖零嘴点心的摊子就迈不动腿，算账全凭主人兜着。",
    kungfu: Object.freeze({
      school: "白驹踏云劲·游缰腿法",
      neigongName: "暖阳青草功",
      qinggongName: "踏雪追风步",
      weapon: "三股编皮缰 / 疾风长腿",
      desc: "化去坐骑冲劲入武道，平时蓄而不发像踩棉花般懒散，真到了护主瞬间四肢暴起惊人爆发力，近身踢蹬又快又沉。",
      moves: Object.freeze([
        Object.freeze({
          slot: "攻击", archetype: "硬攻", name: "飞蹄踏阵",
          desc: "长腿翻飞骤然冲起，靴底叩地如急鼓撞进敌阵，蕴着神骏坐骑般的沉猛蹬力。",
        }),
        Object.freeze({
          slot: "防御", archetype: "防守反击", name: "后蹄蹬山",
          desc: "背身让过来势，后腿一记结实反蹬甩起马尾疾风，敢贴近背后偷袭者无不闷哼倒退。",
        }),
        Object.freeze({
          slot: "状态", archetype: "蓄势", name: "踏雪疾驰",
          desc: "撒开长腿绕场掠作白影拖出尾线，跑顺了血气之后下一击借冲劲威力陡增。",
        }),
        Object.freeze({
          slot: "回气", archetype: "回气", name: "低头干饭",
          desc: "天大的架也得吃完这口，就地摸出青稞糕点或苜蓿蜜饯细嚼，马耳惬意抖着顺回一口暖阳真气。",
        }),
        Object.freeze({
          slot: "绝技", archetype: "硬攻", name: "游缰缚月手",
          desc: "化形后使出的合击绝技，三股编皮缰凌空抖直锁住敌肩，人借缰势腾身旋踢正中中门。",
        }),
      ]),
    }),
    bodyProfile: Object.freeze({
      height: "一米六八，腰腿比例修长，站在高大玩家身侧只矮半头，方便并肩倚靠与贴身托抱",
      build: "年满二十岁（十八岁以上）的成年健美女子身段，身形舒展饱满，腰肢柔软却不羸弱，下盘与大腿紧实极富弹性，腰腿劲道惊人",
      face: "五官明艳舒朗，眼眶深大、睫毛极长微翘，唇色健康红润，平日总带没睡醒似的懒散笑意",
      skin: "暖调象牙白，肌肤饱满滑韧与常人无异，唯独体表常年比常人暖热半度，贴上去暖烘烘的",
      hair: "浓密顺滑的栗色长发高扎成蓬松马尾垂至腰际，发间立着一对毛茸茸的白栗色马耳，耳廓随情绪前后转动",
      voice: "明朗温热、尾音懒洋洋的，人形时能开口说人话，措辞直白坦率；情动时声线滚烫急促、夹着带鼻音的轻哼",
      clothing: "上身穿贴身露肩短衣与半透轻纱罩衫（前襟轻系易松），下着方便发力的短裙软靴，腰后留出给蓬松长马尾垂落的开口",
      scars: "周身光洁无疤，唯后腰尾椎上方与长马尾衔接处生着一圈极细软的雪白绒毛",
      scent: "高原青草、干苜蓿与暖洋洋日光烘过的清甜气息，出汗后颈窝与心口浮出一丝淡奶甜与青苹果香",
      intimate: "实打实的成年人类女体，胸臀丰润富有肉感，大腿与臀部肌肉弹手且承托力极佳；动情后全身透出健康蜜粉潮红，体温滚烫",
      sensitive: "马耳耳根（揉捏或吹气会立刻向后抿平轻抖）、后腰尾根白绒处（打圈摩挲会本能弓腰甩尾）、大腿内侧与腰侧软肉（按揉便瞬间卸力）",
      habit: "平日惫懒爱把温热身子整个人压到玩家身上用马耳蹭人讨食；亲密时直球热烈毫不扭捏，既享受顺毛安抚，动情后也常凭腰腿劲道主动翻身骑乘掌控节奏；事后摊在玩家胸口讨水讨零嘴，尾梢轻扫小腿",
    }),
    nsfwProfile: Object.freeze({
      summary: "夏明珠是年满二十岁的化形健美成年女子，体表常年暖热半度，比基尼与轻纱小衣包裹出极富肉感与爆发力的女体；平日撒娇犯懒，动情时却直球黏糊、腰腿劲道惊人。",
      chest: "肩胸舒展滚烫，贴身轻纱前襟常系得松散，胸口蜜白瓷肌在日光与急喘下泛着诱人粉光，贴贴时像一团暖炉捂在人怀里。",
      breasts: "一对丰硕软弹、沉甸甸兜不住的蜜桃大乳，穿轻纱比基尼时深沟鼓胀欲溢；乳晕暖粉、乳头饱满挺软，一被含住搓揉就烫得打颤，鼻音拖长绵软求饶却还往掌心里送。",
      butt: "因为常年奔跑护主练出浑圆肉厚又极富弹性的大蜜桃臀，屁股肉感十足却丝毫不松垮；后腰尾椎一圈雪白软绒紧连蓬松马尾根部，拍揉上去泛起浅粉浪痕，臀肉迎合地主动后顶。",
      vulva: "腿心白皙饱满，嫩肉合拢的肥厚花穴热得惊人，芳草修整柔软；平日温顺讨食时就比常人热半度，一旦被摸马耳或打圈揉尾根便骤然泥泞涌泉，内壁紧吸绞缠且湿滑滚烫。",
      legsAndFeet: "一双健康匀长、大腿浑圆弹手的美腿承托力与腰腿劲道极强；褪去短靴后小脚圆润白里透粉，脚心怕痒、足踝柔韧，主动骑乘时双腿能把人腰侧牢牢夹实。",
      sensitive: "白栗马耳耳根（轻捏舔吻立刻抿平震颤）、后腰尾根雪白绒圈（揉搓立即弓腰甩尾）、丰润乳尖与大腿内侧滚烫软肉。",
      habit: "最爱先赖在怀里拿马耳蹭下巴要顺毛喂食，等到全身烧透便直接翻身跨坐上去主动掌控起伏节奏，口里直白喊热喊还要，事后整个人懒洋洋趴在胸口蹭尾索吻讨零嘴。",
    }),
    firstJoinCue: "暖白灵光散去，白马褪去兽身化作高扎马尾、配比基尼与轻纱小衣的二十岁明艳少女「夏明珠」；她抖抖立起的马耳与蓬松长尾，懒洋洋笑说原本叫哈瓦夏日，今后就唤她夏明珠，眼下肚子倒真有点饿了。",
    carry: Object.freeze([
      Object.freeze({ name: "珍珠的缰绳", category: "accessory", quality: "蓝", slot: "equipment", cherish: 95, sellable: false }),
      Object.freeze({ name: "轻纱比基尼夏装", category: "armor", quality: "蓝", slot: "equipment", cherish: 85, sellable: false }),
      Object.freeze({ name: "藏纹小马鞍", category: "armor", quality: "绿", slot: "bag" }),
      Object.freeze({ name: "一袋青稞精料", category: "misc", quality: "绿", slot: "bag" }),
      Object.freeze({ name: "晒干的苜蓿草", category: "misc", quality: "白", slot: "bag" }),
    ]),
    stealables: Object.freeze({
      equipment: Object.freeze([
        Object.freeze({ name: "珍珠的缰绳", quality: "蓝", desc: "编了三股的贴身皮缰，握处温热润泽", slot: "equipment", cherish: 95, sellable: false }),
        Object.freeze({ name: "轻纱比基尼夏装", quality: "蓝", desc: "腰后特意留有马尾穿孔的轻纱比基尼与薄衫", slot: "equipment", cherish: 85, sellable: false }),
      ]),
      sundries: Object.freeze([
        Object.freeze({ name: "一袋青稞精料", desc: "随时塞进袖袋里备用的香脆青稞料", slot: "bag" }),
        Object.freeze({ name: "晒干的苜蓿草", desc: "挑去硬梗留下的嫩苜蓿花叶", slot: "bag" }),
      ]),
    }),
  }),
});

const BY_ALIAS = new Map();
for (const profile of Object.values(COMPANION_PROFILES)) {
  BY_ALIAS.set(profile.key, profile);
  BY_ALIAS.set(profile.beastName, profile);
  BY_ALIAS.set(profile.humanName, profile);
  if (profile.nativeName) BY_ALIAS.set(profile.nativeName, profile);
  for (const alias of profile.aliases) BY_ALIAS.set(alias, profile);
}

export function resolveCompanionKeyByAlias(keyOrName) {
  if (!keyOrName || typeof keyOrName !== "string") return null;
  const hit = BY_ALIAS.get(keyOrName.trim());
  return hit ? hit.key : null;
}

export function getCompanionProfile(keyOrName) {
  const key = resolveCompanionKeyByAlias(keyOrName);
  return key ? COMPANION_PROFILES[key] : null;
}

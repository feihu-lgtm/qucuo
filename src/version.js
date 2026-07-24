// 版本历史：每次迭代给一个代号 + 时间戳，方便区分不同版本的构建
// 新版本加在数组最前面，CURRENT 始终指向最新一条
//
// notes 写法：可以是一个字符串，也可以是字符串数组。数组的每一项渲染成
// 独立一行，版本历史弹窗里会逐条列出——长条目请写成数组，别再堆成一整行
// 两千字的字符串（那样弹窗里是一堵墙，编辑器里也没法读 diff）。
// 惯例：第一项写一句话说清这版干了什么，后面用 ①②③ 分条，一条一件事。
// 坑：notes 里不要用反引号（会和模板字符串打架）。

export const VERSION_HISTORY = [
  {
    codename: "对峙区手机改上下堆叠(看得到敌方血) + AI说书另起一行不覆盖系统文字 + 说书接入主游戏切磋",
    time: "2026-07-25 21:30",
    notes: [
      "①【看不到敌方血】斗蛐蛐对峙区手机上左右并排放不下(每个FighterPanel含minWidth150名字区+76立绘，两个超472px，敌方被挤出屏幕)。窄屏(<640px)改上下堆叠：我方在上、敌方在下，两人气血/气力条都完整可见。加 qb-fighter/qb-fighter-info 类名配合媒体查询(flex-direction:column、min-width归零、立绘缩到48x64)。",
      "②【AI说书不再覆盖系统文字】此前战报是 narration||text 二选一(AI回来就把系统文字顶掉)。改成系统结算文字始终显示在上，AI说书文字另起一行接在下面(斜体+左边框+'说书'小标签区分)，两者并存——系统文字给权威数字、说书给代入感。",
      "③【说书接入主游戏切磋】把斗蛐蛐的 narrateTurn 复用到 DuelScreen(玩家真实切磋)：每回合结算后异步请求AI把该回合结果润色成说书文字，补到该回合 entry.narration，在 MudRoundLog 里另起一行显示(同样斜体+左边框，不覆盖原系统notes)。装key才有、失败静默降级，与斗蛐蛐同一套逻辑同一个说书人口吻。'你'作我方名、npc.name作敌方名。",
      "DuelScreen/QuickBattleScreen esbuild 通过，vite build 通过。",
    ],
  },
  {
    codename: "修真机截图暴露的手机bug：调试台关不掉/渲染崩 + 斗蛐蛐多处溢出",
    time: "2026-07-25 20:30",
    notes: [
      "按真机截图逐条修。",
      "①【调试台关不掉+渲染崩】根因：调试面板是中栏内嵌块，手机上把中栏撑爆(叠加叙事+输入框超出屏幕)导致布局重叠错乱，且关闭入口被顶出视野。改为手机时 position:fixed 从底部升起的浮层(maxHeight:70vh独立滚动，不再挤占中栏)，顶部加 sticky '✕关闭'条(滚到哪都能关)。",
      "②【斗蛐蛐选模式卡溢出】单挑/团战两张 WoodCard 固定220宽并排在手机溢出到屏幕外。改 width:clamp(140px,42vw,220px)、容器 flex-wrap+留边、标题/副标题字号 clamp 自适应。",
      "③【选人候选卡溢出撑破】CandidateCard 固定 width:108 在窄屏 grid 列(84px)下溢出撑破(桑杰朵杰卡明显爆框)。改 width:100%+aspectRatio 跟随列宽；无立绘占位大名按字数动态缩字号(4字20/3字24/2字30)、加padding防爆。",
      "④【布阵头部挤】'布阵·单挑'标题被挤到竖排、'开打→'按钮字换两行。标题+按钮加 whiteSpace:nowrap、字号 clamp；startBtn 缩 padding/letterSpacing。",
      "⑤【战斗顶栏挤+技能卡详情截断】battleTop 加 flex-wrap 防三段挤一行；技能卡从 hover 翻牌(触屏无hover)改为受控点击翻转——点卡片翻到详情面(完整字段说明)，详情面带明确'⚔出招'和'返回'按钮，正面也直接显示主效果一行；手机技能卡改两列(50%宽)、高度加到132容纳详情。",
      "MudRPG/QuickBattleScreen esbuild 通过，vite build 通过。",
    ],
  },
  {
    codename: "手机模式三期：赌石竖屏改造(竞价者卡改手指滑动轮播) + 调试台适配",
    time: "2026-07-25 19:00",
    notes: [
      "把上期赌石的'请横屏'提示改成真·竖屏可玩，并适配调试台。",
      "①【赌石竖屏轮播】竖屏(innerWidth<768且高>宽)时：横向舞台(1672:941)从居中改钉到上半区(top:7%按100vw铺)，原绕桌抛物线排布的竞价者卡不再渲染；下半区改成'竞价者轮播'——每次只显示一张竞价者大卡(立绘+身份+出价+简介)，手指左右滑动切上/下一张(onTouchStart/End测dx>40px判方向)，配左右‹›箭头、底部圆点指示(可点跳转)、'买家 x/N'计数。每张卡直接带'✓接受报价'和'🗣谈价'按钮，复用原 sellTo/startTalk 回调。横屏/桌面维持原绕桌hover翻牌布局不变。",
      "②【调试台】游戏内嵌调试面板(showDebug，金钱/属性/七维等密集input横排)手机时加 maxHeight:42vh 竖向可滚 + overflowX:auto 横向可滚，防止固定宽input挤爆窄栏；独立调试页 debugConsole.jsx 的 padding 改 clamp 自适应收窄。",
      "新增 carouselIdx state + touchRef(触摸起点) + carArrow/carBtn 样式常量。GambleStoneScreen/MudRPG/debugConsole esbuild 通过，vite build 通过。",
    ],
  },
  {
    codename: "手机模式二期：13建筑弹窗改底部滑出 + 赌石竖屏提示横屏 + 斗蛐蛐窄屏紧凑化",
    time: "2026-07-25 17:30",
    notes: [
      "接手机模式一期(主界面三栏抽屉化)，这期把响应式推广到建筑交互和斗蛐蛐。",
      "①【13建筑一次性搞定】所有建筑面板(当铺/武馆/钱庄/医馆/悬赏/镖局/寺庙/赌坊/藏书阁/铁匠铺/茶馆/运镖+任务日志)共用 InnScreen.jsx 的 Overlay 外壳，改这一处即全覆盖：手机时弹窗从居中小框改为'底部滑出式(bottom sheet)'——贴底、圆角朝上、宽度占满、高度放宽到92vh，符合移动端拇指操作习惯；桌面维持440宽居中不变。",
      "②【赌石竖屏提示】玉石料场是1672:941的横向沉浸舞台(横图大厅)，竖屏手机塞进去又扁又小、上下全黑边。加竖屏检测(innerWidth<768且高>宽)：竖持时盖一层温和的'请横屏体验赌石'提示(带离场按钮)，转横屏自动消失(监听resize+orientationchange)。横向场景不硬塞竖屏是业界惯例。",
      "③【斗蛐蛐(宝可梦模式)窄屏紧凑化】给 QB_CSS 追加 @media(max-width:640px) 规则：对峙区(qb-arena)缩小间距/padding、立绘(qb-portrait)从76x100收到52x68、VS火花缩小；技能翻牌卡(qb-card)从128x96收到104x88；选人候选网格(qb-candgrid)列宽从108px降到84px(手机一行能多塞一两个)。对峙'左右面对面'的核心视觉语义保留不改成上下堆叠。相关元素加 qb-arena/qb-portrait/qb-vs/qb-cardrow/qb-card/qb-candgrid 类名配合CSS，!important 覆盖内联尺寸。",
      "三文件(InnScreen/GambleStoneScreen/QuickBattleScreen) esbuild 均通过，vite build 通过。",
    ],
  },
  {
    codename: "手机模式：叙事占满 + 左右栏收成贴边把手抽屉 + 顶栏收成☰菜单",
    time: "2026-07-25 16:00",
    notes: [
      "修手机端布局：此前三栏(天地25/江湖55/侠客30)是写死的桌面并排，窄屏挤成一团没法玩。现在窄屏(<768px)自动切成'叙事区占满 + 左右栏抽屉 + 顶栏折叠'，桌面(≥768px)维持原样，纯前端布局零改游戏逻辑。",
      "①【检测】加 isMobile(监听 window.innerWidth<768，resize 实时切换，放大回桌面自动收起抽屉) + mobileDrawer(null/left/right) + mobileTopMenu 三个state。",
      "②【左右栏→抽屉】左栏(天地)/右栏(侠客·行动)手机时改 position:fixed 侧滑抽屉，默认藏在屏幕外(translateX ±100%)，点击滑入(.28s过渡)，带半透明遮罩点击关闭，各带'✕关闭'条。内部复用原 S.scroll 照常滚动。",
      "③【贴边把手】叙事区(江湖)手机时占满，左右边缘各一个竖排贴边小把手'◀天地'/'行动▶'(position:absolute 居中贴边、writing-mode竖排、半透明带阴影)，点击滑出对应栏；抽屉打开时把手自动隐藏。这就是所谓'叙事界面左右小按钮点击弹左右栏'。",
      "④【顶栏→☰菜单】顶栏一排功能入口(教程/图鉴/日志/上报/人物/任务/见闻/主菜单/存档/设置/日夜)手机时收成一个'☰菜单'按钮(旁边留版本号)，点开才换行铺开全部入口，可'收起✕'。桌面常显不变。",
      "esbuild + vite build 均通过；JSX 标签配平核对无误。",
    ],
  },
  {
    codename: "斗蛐蛐升级：战报写伤害数字 + 技能卡翻牌看字段理解器 + 复用赌石3D flip动画",
    time: "2026-07-25 14:30",
    notes: [
      "按作者三条反馈升级斗蛐蛐：写伤害、悬停看描述(字段理解器)、动画用赌石那套flip；顺带更新README突出特色玩法。",
      "①【写伤害】战报流每回合明确标出双方受创数字(敌−X/我−X 醒目色块，不再只藏在notes文字里，无伤显示'无伤')；对峙区受击时在立绘上飘一记暴击式伤害数字(qbDmg弹跳动画·每次hit.key变化重新触发)。",
      "②【字段理解器】新建 quickBattle/moveExplainer.js：把 resolveTurn 认识的全部招式字段(baseDamageMultiplier/onCounterSuccessDamageRatio/applyMark/selfSacrifice/onCounterFail* 等30+字段)翻译成含具体倍率/消耗/比例的人话，代价类(应对失败倒扣气力/防御失效)标warn红字。所见即所得：玩家看到的说明与结算真正用的字段是同一份数据翻译，不会漂移。验证白/蓝/红各类型翻译准确，红品听桥双重赌输代价正确标⚠。",
      "③【翻牌看招】技能按钮从平板改为可翻面卡片(MoveButton→翻牌卡)：正面招名/类型/品阶/耗气，鼠标悬停绕Y轴翻到背面显示字段理解器的完整效果说明。翻牌机制复用赌石坊 GambleStoneScreen 那套 perspective+preserve-3d+backface-hidden(QB_CSS .qb-flip/.qb-face)，尺寸适配技能卡。controlBar 高度放宽到116px容纳翻牌卡，换人/结束分支内容改 margin:auto 垂直居中。",
      "④【README】特色玩法新增「斗蛐蛐(快速切磋沙盒)」整节，与旁白攻略并列：全池选人/两模式/玩家控一方/翻牌字段理解器/写伤害/无需key(装key补说书战报)六个卖点，附 src/quickBattle 文件说明；目录结构加 quickBattle 目录、combat 标注为'战斗内核'。",
      "vite build 通过；moveExplainer 冒烟验证各品阶各类型翻译合理；QuickBattleScreen esbuild 通过。",
    ],
  },
  {
    codename: "开始界面第五入口·斗蛐蛐：全池选人的宝可梦式切磋沙盒(复用战斗内核·无需key)",
    time: "2026-07-25 12:00",
    notes: [
      "开始界面加第五个入口「斗蛐蛐」，脱离主线剧情/存档的纯数值沙盒——从全 NPC 池子(游走池+驻场表共56人去重)里挑人分我方/敌方两队开打，验收战斗系统本身，不碰任何存档。灵感是骑砍快速战役 + 宝可梦对战。",
      "①【复用不重造】战斗内核直接复用 combat/resolveTurn.js 的 1v1 回合结算 + npcGeneration.ensureNpcCombatData 生成数值(hp由内功/攻防由外功·玩家NPC同一条战力曲线) + aiDecision.decideNpcMove 本地选招。新代码只是在其上包了团战调度层，没有另写一套伤害公式。",
      "②【两模式】单挑=一对一速战；团战=各排最多6人的队伍、车轮战补位、我方可临阵换人(宝可梦式·换人让位一手让敌方抢攻)。敌方倒下被动补位，主动换人是我方特权(AI主动换人留待After)。",
      "③【玩家控一方】我方全体上场者的招式全程由玩家点选(类宝可梦选技能)，敌方全AI本地决策。每回合玩家点招才推进一步，看得见开始与结束，不是一键甩全自动结果。",
      "④【不需要key】性格权重走 npcDescriptionMapping 本地关键词映射(读personality字段·好战真莽/老成真守)，全程零网络即可完整开打。装了key的增值：battleNarration.js 每回合把纯数值结果异步包装成说书人战报(契合 duel-system-design 第四节·AI只润色不改判)，失败静默降级用系统notes。",
      "⑤【UI复用stones素材】沿用赌石坊那套 public/stones 木质民俗UI(bg_hall_night大厅背景/panel_big木牌/burst火花/frame木框)，签名元素是双方立绘+血槽的宝可梦式对峙区。有写实立绘的8人(兰姐/苏宛/才旦/李若由等)用真图，其余人用品阶色占位卡。视觉语言跟主游戏统一。",
      "⑥【架构】新增 src/quickBattle/ 四文件：battlePool(合池去重+快照生成) / battleEngine(单回合结算·换人·胜负判定·纯函数) / battleNarration(可选AI战报) / QuickBattleScreen(选模式→布阵→对战→战报四阶段)。main.jsx 加 inQuickBattle 独立视图(不经MudRPG·不读存档)，StartScreen 加 onQuickBattle 入口。",
      "vite build 通过(146模块)；逻辑冒烟验证：柳青鸢2回合秒大公鸡(战力差正确)、张商人vs才旦6回合拉锯、3v3车轮战6回合全歼且补位/胜负判定正常、56人去重无重复。",
    ],
  },
  {
    codename: "预设tab精简为纯注入结构：按act动作分类逐块看真原文 + 拉取目前",
    time: "2026-07-24 18:52",
    notes: [
      "把预设 tab 收敛成一件事：看清楚这一轮到底喂了 AI 什么。",
      "①【两头拿掉】按作者要求删掉预设切换/导入酒馆JSON/导出那一排，以及下面可编辑的 Prompt 条目列表。PresetManager / PresetEditor / PresetToolbar 三个模块代码原样保留未删，想接回来还原那段 JSX 即可，不必重写。",
      "②【单一真源·防漂移】buildSysBase 里那 5 段引擎硬文案(引擎身份/创造模式/认知隔离/地图铁律/格式铁律)+物件志尾巴+4 种输出 schema，全部抽到新文件 enginePrompts.js，buildSysBase 与面板 import 同一份常量。此前面板只有一句 summary 概述，要展示真原文就得自己抄一份——抄本迟早跟真正喂出去的漂移，而且漂移了肉眼几乎看不出来。抽取用脚本从源码按锚点抠出，不手抄；抠完写了个校验脚本：把新版源码里的 ${ENGINE_IDENTITY} 这类占位符按常量值回填，再跟 git HEAD 的旧版逐字节比对，确认 buildSysBase 拼出的 prompt 一个字没变。",
      "③【按动作分类】injectionBlocks.js 新增 ACTION_VIEWS(查看/移动/对话/战斗/调查/元问题/结算/创造模式/旁白私聊 九类) + blocksForAction()。此前只按三条路(act/talk/whisper)分，但玩家真正关心的是「我打『查看』和打『拔剑』差在哪」——同一条 act 路在不同动作下亮灭差很多(查看轮不挂物件志、移动轮连认知隔离都砍)。scope 映射抄自 act() 的 promptScope 三元链，改那边记得同步。灭灯的块也列出来并给出灭灯原因——这个面板的价值一半在「为什么没注入」。",
      "④【逐块看，不拼全文】新建 InjectionStructurePanel.jsx。点条目展开看该块真原文，静态块直接给字(标注字数与'与 buildSysBase 共用同一份常量')。上一版那个「拼装全文」textarea 去掉了——三千字糊成一坨等于没给。",
      "⑤【拉取目前】动态块(篇幅/文风/状态串/召回/事实账本/各种门)没有固定原文，默认显示模板说明；点「⟳ 拉取目前」才去主引擎抓当前这一局的真值。做成按钮而不是常驻：面板在开局前也能打开看结构，也不必为了看结构就把一堆实时状态常驻绑进来。MudRPG 侧 buildInjectionPreview(返回一整篇) 改为 getLiveBlockText(view)(返回 blockId→真值 的表)。",
      "vite build 通过；dev server 实机验证：九个分类切换正常，查看档正确显示 15/16 亮灯且物件志标⚫灭，展开引擎身份声明显示 74 字真原文，点拉取目前拉到 7 块真值、篇幅要求那块正确显示 LOOK 判定下的真实字数指令，旁白私聊档 12/12 块，控制台无报错。",
    ],
  },
  {
    codename: "预设栏加'Prompt注入结构'：三条路逐块结构化可视化(学VS Code预设编辑器·只读)",
    time: "2026-07-24 15:30",
    notes: [
      "把上一版'整段全文塞进textarea'的粗预览，升级成学 VS Code 预设编辑器那种逐块拆解的结构化可视化——每个注入块单独成卡片，一个不省。这是自研'预设+世界书'体系的可视化，不是照搬酒馆字段结构。",
      "①新建 injectionBlocks.js：定义 act(主叙事16块)/talk(对话15块)/whisper(旁白私聊12块)三条路的注入块清单，每块含 名称/kind类型/depth段序/summary说明。kind 六类：engine引擎硬规范(不可改)/static静态可编辑/constraint结构化约束/dynamic运行时动态/gated世界书蓝绿灯/worldbook旁白专属世界书。",
      "②设置→预设 tab 下'🧩Prompt注入结构'区，三tab切换，逐块渲染卡片：左边框按 kind 上色、显示 #段序+块名+类型标签+🔒不可改标记+性质说明。顶部有当前路径说明和 kind 颜色图例。",
      "③文体铁律块展开成结构化叙事约束字段清单(CONSTRAINT_FIELDS：字数上下限/禁用词/禁用句式/禁冒号破折号/对话「」/禁抽象总结/成语上限)——自研的字段化文体控制，酒馆无此结构，逐字段列出。",
      "④保留'展开看拼装全文'作为可选 details(接上一版 getInjectionPreview)。借鉴 VS Code 编辑器的是可视化呈现方式，不改自研 prompt 结构本身。本轮只读，编辑/排序/恢复默认/世界书并入后续。esbuild + vite.config.pages.js 完整 build 通过。",
    ],
  },
  {
    codename: "预设面板加'注入全文预览'(主叙事/对话/私聊三tab只读看全文)",
    time: "2026-07-24 14:45",
    notes: [
      "把三条 AI 调用路径(主叙事/对话/私聊)的注入统一收进'预设'一处查看的第一步，本轮只读，编辑/排序/恢复默认/世界书并入留待后续。",
      "①设置→预设 tab 下新增可折叠的'📄注入全文预览'区，内含三个子tab：主叙事(act,scope=full)/对话(talk,scope=talk)/旁白私聊(whisper)，各自展示以当前游戏状态为例拼好的完整 system prompt(只读 textarea，等宽字体)。",
      "②实现：MudRPG 新增 buildInjectionPreview(which)——act/talk 直接调 buildSysBase(对应 scope)，whisper 复刻 talkToNarrator 的 sys 拼装；通过 getInjectionPreview prop 传入 SettingsPanel。",
      "③很多块是运行时按状态/关键词/好感度动态生成的(全知事实账本、向量召回、体貌门、话题门、任务门)，没法当死模板，预览里以当前状态为例展示并标注其动态性质。",
      "④旁白专属世界书目前仍在设置→旁白 tab，下一轮随可编辑化一起并入预设。文末提示想看某一轮真实全文用顶栏'🧭全流程日志/📋Pipeline'。esbuild + vite.config.pages.js 完整 build 通过。",
    ],
  },
  {
    codename: "私聊旁白串行化：一条没跑完不能发第二条(修并发导致的日志出两条/历史重复)",
    time: "2026-07-24 14:15",
    notes: [
      "玩家反馈：私聊旁白日志一下出两条、且连发时两条聊天记录一样。查明两个成因：",
      "①并发——talkToNarrator 设计成不 await、允许并行，玩家一条没返回就发第二条，两条都读到发送前同一份 convo(历史一样)，且流式占位用的 logIdx.current 是共享 ref，两条流式回调互相踩踏，表现为日志出两条/重复。",
      "②act 的 whisper 分支自己 startTrace+endTrace 了一条空壳\"私聊已发送\"，talkToNarrator 内部又开一条完整 trace，全流程日志里每次私聊出现两条 trace。修法：",
      "①私聊串行——新增 talkBusyRef(同步 ref，不等 re-render，能挡住极快连点)，一条在途时挡住第二条实际发送，输入框仍可预打字(只拦发送不拦输入)；ref 在 talkToNarrator 的 CRASHED分支/正常结尾/catch 所有出口重置，确保不永久锁死；act 依赖数组补 pendingTalks。",
      "②删掉 whisper 分支的空壳 trace。",
      "③输入框 placeholder 私聊态改为\"旁白回话中…可先打字，待她说完再发\"(此前误写\"可继续发\")，对话模式不受影响仍可并发。esbuild + vite.config.pages.js 完整 build 通过。",
    ],
  },
  {
    codename: "上报bug/意见信箱系统(Supabase后台)+顶栏分组重排",
    time: "2026-07-24 13:55",
    notes: [
      "玩家反馈收集功能落地。纯前端无后端，借 Supabase(免费云数据库 quocuo_debug 项目)当'账本'。",
      "①【上报组件】新建 BugReportModal.jsx：三个可选文字框(描述bug/想加的功能/意见建议)+知情声明勾选(必须勾同意才能提交，声明写明'聊天记录仅用于debug、不记录其他数据')。",
      "②【按回合选记录】玩家可勾选要附带哪些聊天记录：主日志按回合分组(每个'玩家指令+系统回应'一组，与日志栏分组一致)编号勾选，默认全选，每组可'查看'展开看纯文本内容；pipeline后台AI日志(含prompt/回复)做一个总开关(带/不带全部，默认不带因量大)。buildBugReportTurns 复用主日志分组逻辑。",
      "③【上传】新建 bugReport.js：fetch 直连 Supabase REST API(不引 supabase-js 库省体积)，anon key(role=anon前端安全，配合表RLS策略'anyone insert不能读')，15s超时+人话错误。表 bug_reports(player_note/game_state/conversation/pipeline_log/version/user_agent)。",
      "④【三处入口】顶栏🐞上报bug、🧭全流程日志弹窗内塞一个🐞上报bug(点了跳转)、开始页页脚🐞意见信箱(纯文字反馈无游戏记录)。",
      "⑤【顶栏分组重排】按用户要求：左组=教程·图鉴·版本号(📅日期，点开版本目录)，中组=全流程日志·上报bug，其余(人物关系/任务/见闻录/主菜单/存档/设置/日夜/存档状态)全部右对齐。修了个隐患：anon key 复制时曾混入西里尔字母Ф，已用原始key修正并解码验证 role=anon/ref匹配。esbuild + vite.config.pages.js 完整 build 均通过。",
    ],
  },
  {
    codename: "补开局初始房间的新人物检测(开局在场NPC照常报'※新人物出现'并标记已见)",
    time: "2026-07-24 13:35",
    notes: "承接上一版'内层移动补新人物检测'，这一版补另一个漏检入口——开局。新开局落在初始房间(鱼定村·村口)时本就有在场NPC，但开局不是一次move、走不到 act() 里的新人物检测，于是这些人既不报'※新人物出现'也没被 markAsSeen——玩家开局就见着的人，之后走开再回来或首次互动时反被当新人误报。修法：加一个开局 effect，在开场图文序列(showOpening)和创角(showCharCreate)都结束、真正进游戏主界面后跑一次(不在开场动画期间跑，否则日志顺序错乱)，按初始内层房间可见性过滤 room.npcs，detectNewFaces 查未见过的，照用户要求照常报'※新人物出现'(与走路遇新人一致)并 markAsSeen + updateLastSeen。openingFacesRef 保证只补一次；仅新开局(!restored)补，读档局 varTree 已记过见过谁不重跑。esbuild + vite.config.pages.js 完整 build 通过。至此新人物检测的三个入口(外层移动/内层箱庭移动/开局)全部覆盖。",
  },
  {
    codename: "修内层箱庭移动不触发新人物检测(走到有新NPC的房间不报'※新人物出现')",
    time: "2026-07-24 13:20",
    notes: "玩家反馈：从B箱庭走到A箱庭没刷新'新人物'。查明根因——内层箱庭移动(同据点内房间切换)是纯前端瞬时操作，切完 innerRoomName、本地生成方位描述、setTime+1 后直接 early return，完全不往下走到主流程那段'新人物检测'(在 return 之后很远处)。于是走进绑着只属于该房间NPC的箱庭(如'猎户小屋'的老猎户)，明明有没见过的人也不报。好感度提示正常是因为它走AI回包的MVU指令、跟内层移动无关。修法：在内层移动 early return 前补一段新人物检测，复用与主流程完全相同的判据——按目标内层房间(innerDest)的 isNpcVisibleInInnerRoom 过滤 room.npcs，再 detectNewFaces 查 varTree 里没见过的，有则打'※新人物出现'并 markAsSeen；同时 updateLastSeen 更新久别重逢的'上次见面回合'。纯本地不调AI，契合内层移动瞬时性质。三个函数(detectNewFaces/markAsSeen/updateLastSeen)与 isNpcVisibleInInnerRoom 均已 import。esbuild + vite.config.pages.js 完整 build 通过。",
  },
  {
    codename: "调试面板·增加物品补'从目录选'(类别品阶筛选+具体物品)，与增加武学对齐",
    time: "2026-07-24 13:05",
    notes: [
      "查了现有调试功能：'增加武学'本就已有类型(招式/内功/轻功)+品阶(白绿蓝紫橙红)两级筛选再选具体武学，完整；'增加物品'却只有手打物品名+选类别+选品阶，缺目录选择——手打名若不在 CATALOG 里，makeItem 只按公式生成匿名物，拿不到具名物(如霜牙)的专属数值/特效/描述。补齐：'增加物品'改成两行——",
      "①'目录物'：类别筛选×品阶筛选后从 CATALOG 全量(346件)下拉选具体物品，用 makeCatalogItem 取具名真实数值一键入袋(跟增加武学同款交互)；",
      "②'自定义'：保留原手打名+类别+品阶(用 makeItem 公式生成)，供加目录外的临时物。新增 dbgItemCatF/dbgItemQualF/dbgPickedItem 三个状态。esbuild + vite.config.pages.js 完整 build 均通过。",
    ],
  },
  {
    codename: "图鉴二期+三期：物品分布(在哪获得)+搜索框+收集进度(已获得标记)",
    time: "2026-07-24 12:55",
    notes: [
      "接着一期图鉴做完二三期。",
      "【二期·分布】每件物品新增一行\"📍在哪获得\"：读 distribution.js 的 ITEM_DISTRIBUTION(物品名→{regions,shopTypes})——在表里(可上架货，346件中271件)译成\"<地域>(据点)的<店类>有售\"，地域用 regionMap.js 的 DISTRICT_REGION 反查落到具体据点(如山野→黑风寨/大草甸/熊山)；不在表里(75件神兵/传说/剧情信物/任务物，如霜角/界石下的土/半块银锁片)标为\"奇遇·剧情或支线获得，寻常货架无售\"。命中率实测78%健康，不是大面积误判。武学的\"在哪学\"本就靠武馆分组标题(玉泉/雪山/锦官)表达，不再重复。",
      "【三期·搜索+收集进度】",
      "①两页签共用搜索框，按名字或介绍实时过滤(含清空按钮)；",
      "②\"只看已得\"开关；",
      "③组件新增 inv/skills 两个 props(MudRPG 传入)，用 Set 比对算出已拥有的物品名/已学武功名，每条命中的：玉石去灰度高亮+右下角✓角标+名字后\"已获得/已习得\"绿标；物品页顶显示\"已收录 N/346\"收集进度。未获得的玉石做 grayscale 灰化，一眼区分收没收集到。全部纯读取比对，不改任何状态。esbuild + vite.config.pages.js 完整 build 均通过；node 脚本验证了分布表命中率。至此图鉴三期全部完成。",
    ],
  },
  {
    codename: "新增图鉴系统：百物·武学总览(顶栏入口·复用赌石素材·全量真实数据)",
    time: "2026-07-24 12:40",
    notes: "顶栏\"📖新手教程\"旁新增\"📖图鉴\"入口，打开全屏覆盖层，一站看全所有物品与武学的介绍/品阶/效果。新建 CodexScreen.jsx：物品页读 catalog.js 的 CATALOG 全量(140+件，武器/护甲/饰品/杂物)，支持类别×品阶双筛选(filterCatalog 同款逻辑，用 useMemo)；武学页读 qucuoKungfu.js 的 SKILL_CATALOG，只取武馆分组(玉泉/雪山/锦官，过滤掉突破价目表那些非武馆key)按馆分组展示。UI 走精致版：复用赌石那套 public/stones/ 素材——panel_big 卷轴纸做面板底、bar_wood 做页签、bar_paper 做筛选chip、ingot 元宝做武学价格图标、jade_1~6 品阶玉石(白bai/绿lv/蓝lan/紫zi/橙cheng/红hong)做每条左侧的稀有度标记。关于\"图鉴没有物品图标素材\"的解法：不做图标墙，而是用品阶玉石当稀有度锚点(一颗玉的颜色替代图标，语义上\"这东西什么档次\"比\"这东西长啥样\"更通顺)+ QUALITY_COLOR 品阶色给名字着色 + 排版留白撑质感，契合项目一贯\"不堆图片靠排版\"的美学，风格与赌石完全一致。遮罩复用 overlayClose.js 防误触，跟随 isDayMode。MudRPG 接线仅 4 处(import/状态/顶栏span/底部渲染)，不改任何数据与核心逻辑，纯增量。配套 docs/图鉴系统_规划方案.md(分三期：一期介绍品阶/二期补分布/三期搜索与收集进度)与 docs/图鉴预览.html。esbuild + vite.config.pages.js 完整 build 均通过。",
  },
  {
    codename: "对话即认识：统一所有对话入口 + 不选人时靠AI回报respondedNpcs精准标记",
    time: "2026-07-24 11:17",
    notes: [
      "修\"从底部/侧栏选人对话，聊了半天对方头上还挂'尚未认识'\"的入口不一致。此前只有\"点NPC名字→互动菜单→对话\"(handleNpcTalk)会 markNpcAsKnown，而底部\"💬已在身边·对话\"(4760)和侧栏\"此地之人\"点选(5564)两个入口只 setTalkTarget、没标记认识——同一个\"跟人说话\"行为因入口不同结果不一致。改法不在各UI入口分别补，而在 act() 对话成功结算处统一判定(捕捉\"真的说了话\"这个动作本身，所有入口自动一致，也不会\"一点聚焦就认识\")：",
      "①选定了对话对象(talkTarget)→直接标记该人；",
      "②按用户要求扩展到\"不选人直接聊\"的情况——走路A，对话模式 prompt(modeNote)新增要求 AI 返回顶层字段 respondedNpcs:[名字]，列出本轮正文里真正开口回应玩家的NPC(只是被提及/路过/没搭理的不列，无人回应返回[])，act() 读该字段、且只认在场名单(room.npcs)里的名字(AI报幻觉名字一律丢弃)后标记认识。为何不解析正文猜\"谁说话了\"：散文极易把被提及/路过者误判成对话者，让AI结构化回报是准确且安全的解法(漏报最多是没标记，不会错标记)。parseMainResponse 是整体 JSON.parse、原样保留未知字段，respondedNpcs 能正常读到，无需改 schema；代码 Array.isArray 防御，AI 不返回也不报错。handleNpcTalk 原有\"点菜单对话即刻认识\"保留不动(markNpcAsKnown 内部去重，不冲突)。esbuild 验证通过。",
    ],
  },
  {
    codename: "开始界面加访客计数(免注册公共计数器+失败降级)",
    time: "2026-07-24 10:35",
    notes: [
      "应要求在开始界面页脚显示\"已有 N 位侠客踏足曲措乡\"。前提认知：项目纯前端无后端，统计\"总共多少人来过\"必须借外部\"账本\"——玩家各自浏览器的 localStorage 只知道自己、汇总不出总数。选了免注册的公共计数器 abacus.jasoncameron.dev：打一次 /hit/qucuo-mud/visits 就 +1 并返回累计值。三重稳妥：",
      "①失败降级——6s 超时 + catch，服务挂了/被墙/超时则 visitCount 保持 null，页脚那行静默不显示，绝不拖累游戏加载；",
      "②防刷——用 sessionStorage 标记本会话已计数，同一标签页反复刷新只 /get 读数不再 /hit 自增；",
      "③可迁移——URL 集中一处、注释写明以后想要稳定统计换成自己的 GoatCounter 账号只改这一行。软肋已在注释标明：公共命名空间可被别人刷、数据可能被服务方清掉，仅供人气参考非严肃统计。改动仅 StartScreen.jsx。esbuild 验证通过。",
    ],
  },
  {
    codename: "修移动拾取叙事说捡到却没进包(AI漏填items_add系统兜底补发)+村口放补偿物",
    time: "2026-07-24 10:40",
    notes: [
      "两件。",
      "①【风铃 bug】移动途中系统按气运掷骰触发\"路上拾取\"，设计上让 AI 在 output 里叙述捡到什么、并在 delta.items_add 里加这件物品——但 AI 常常叙事写了\"拾起竟是一枚铜制马铃…收入怀中\"却忘了填 items_add，导致叙事说捡到、背包里却没有(玩家反馈的风铃就是这样)。这跟上一版界石是相反方向的同类脱节。修法：把\"拾取判定兜底\"从 `if (items_add?.length)` 里提出来，无论 AI 填没填都检查一次——若本轮有拾取判定(pickupJudgmentRef)但没被任何结构化物品消费掉(usedJudgment 仍 false)，系统按判定的品质/分类自动补发一件，物品名用新函数 extractPickupName 从叙事原文抠(匹配\"是+一+量词+名字\"句式，如\"竟是一枚铜制马铃\"→\"半旧的铜制马铃\")，抠不到则用\"路遇之物\"通用名兜底，绝不让掷到的拾取凭空蒸发。节点测试四句真实叙事+一句无拾取，命中/兜底均正确。",
      "②【村口补偿】应玩家要求在鱼定村 room.items 补放两件可拾物：\"无主的青锋剑\"(weapon/绿/atkMul1.2，比开局白枪强一档)、\"铜铃\"(misc/白，呼应风铃 bug 的物件)，都带全 quality/category 不会再 undefined。100 两银子因是 char.money 独立货币字段、没法作为地上 room.items 物品被交易系统识别，改为初始银两 50→150(+100补偿)。esbuild 验证 MudRPG.jsx / qucuo.js 通过。",
    ],
  },
  {
    codename: "修旁白读不到背包(inv.join变[object Object])+背包物品品质undefined显示兜底",
    time: "2026-07-24 10:23",
    notes: [
      "两个连着的 bug，现象是玩家在村长家捡了「界石」进背包，旁白却坚称背包里只有青稞粗布看不见界石。根因：",
      "①旁白私聊的 system prompt 里 worldState 用 `玩家背包:${inv.join(\",\")}` 直接拼——但背包物品是对象{name,quality,...}，join 会得到一串 [object Object]，旁白根本读不出玩家身上有什么(而主叙事 act() 用的 invText 是 inv.map 取名字+品阶，一直是对的，只有旁白这条漏了)。改成和主叙事一致的 narratorInvText = inv.map(取名字+品阶+是否装备)。全项目扫描确认没有其他裸 inv.join。",
      "②「界石」本是 presets/qucuo.js 里鱼定村 room.items 的场景地标对象，只有 name/id、没有 quality 字段(catalog.js 里也没登记「界石」本体)，被当道具捡进背包后，右栏包袱列表读 it.quality 得到 undefined，显示成「界石 (undefined)」。显示层兜底：对象物品 quality 缺失时按「白」处理，颜色 QUALITY_COLOR 也兜底到默认金色，key 用 it.id||i 防裸对象无 id。注：界石能否被捡属设计问题(可能想留作剧情道具)，未擅动拾取判定，只做显示兜底止血。基于最新版 190a0b1 重新 clone 后修改，esbuild 验证通过。",
    ],
  },
  {
    codename: "新增体貌档案(两层蓝绿灯)+按体貌荐装；旁白接入全任务stage(报全名才查·好感30解锁)",
    time: "2026-07-24 18:09",
    notes: [
      "两件。",
      "【A·体貌】此前 AI 手上只有名字、性别和七维数字，写到\"他伸手\"\"她抬头\"这类具体动作全靠现编，同一个人这轮精瘦少年、下轮魁梧大汉。新增 bodyProfile.js：12 个字段，每个带「定义」一起发（写法参考 Ji-Haitang/char_card_1 的 <UserInfo>——给模型的不是一个光秃秃的名词，而是「这一栏在描述什么」+「当前是什么样」）。",
      "①【两层蓝绿灯】公开层(身量/体型/面容/肤色/发式/声音/惯常穿着)按场合点灯：full/talk 这类近距离互动轮亮、move/settle 赶路结算轮灭，另开关键词通道(照镜/打量/衣着/长什么样等 23 词)让玩家主动提起时哪怕在赶路轮也亮；私密层(疤痕/体味/身体细节/敏感处/习惯癖好)**只认 ■ 模式**，硬条件，关键词点不亮、场合也点不亮。灭灯不只是省 token——赶路轮塞一段私处描写，模型真的会顺着那个方向写。留空的栏一个字都不发。",
      "②【面板】入口做在姓名右侧(◈体貌 N，N=已填栏数)。「不完全显示文本」的落法：列表默认只露每栏前 14 字、点条目才展开成输入框；私密层更进一步，默认整条打码成 ••••，要先点「显示」才看得见——这个面板是会在别人面前打开的。",
      "③【按体貌荐装】面板底部一个按钮，拿体貌去货架上比一遍挑三件。分工照 catalog.js 顶部那条老规矩：AI 只负责\"从这张清单里挑哪三件\"，数值一概不由它给——挑完拿名字回 CATALOG_INDEX 查真值，AI 报的名字对不上货架就整条丢弃(不做模糊匹配，\"看起来像\"一旦错了玩家拿到的就是另一件东西的数值)。回三件的名称/类别/品阶/描述/真实加成，**不给获取途径**。",
      "④注入点：主叙事 sys 末尾 + 私聊 sys，私聊时公开层常亮(她一直看着你)。",
      "【B·旁白聊任务线】全任务表二十几条线、每条四五个 stage，全量注入等于每次闲聊背一本攻略书，还会把玩家没接的线一起剧透。改成\"报全名才查\"：新增 gateQuestTopic(scanText, affection, quests, progress)——玩家说出任务标题(或标题里 ≥3 字的分段，如「师母之情」)才注入**那一条线**的完整 stage，含当前走到第几节(✓已过/▶当前/○未到)与每节的 playerHint；只泛泛问\"我该干嘛\"则只给一句话让她反问、要玩家报全名，不自己猜也不列任务名单。好感度门槛 30(QUEST_TALK_MIN_AFFECTION)：低于此数只给一条\"你俩还没熟到这份上\"的口径，不泄露任何步骤/人名/地点，且不许她解释这是好感度门槛。两条红绿灯的点灯明细都进 trace。vite build 通过；新增 38 条断言覆盖体貌两层的场合/关键词/■模式各组合、空栏不发、预览截断与打码、荐装请求构造，以及任务线的好感门槛(9/30/50)、报全名只出一条、分段别名命中、泛问不泄露、进度标注四态，全部通过。dev server 实机走完开局→游戏内，验证了体貌入口、编辑展开、折叠截断预览、私密层打码与揭码，干净标签页无控制台报错。荐装按钮需真实 API key 才能端到端跑，未验证模型侧。",
    ],
  },
  {
    codename: "修双调用模式五处：记忆链整条断了、截断不检测、新面孔人设退化、涌现失效、日志看不到prompt",
    time: "2026-07-24 18:05",
    notes: [
      "上一轮修的是双调用的60秒超时整轮回滚，修对了，但双调用分支还欠着五处，本轮一次补齐。",
      "①【最严重·记忆链整条断了】extractionEngine 的 6 个意图 spec 没有一个产出 memory 字段，而双调用里 p = extracted?.p || {}，于是 p.memory 恒为 undefined，MudRPG 里三处 if (p.memory) 全部静默跳过——向量小纸条不写、当日原料 dayMaterialRef 不进(日总结没素材)、事实账本 registerFact 不登记。而事实账本正是旁白「全知事实」的来源(allFactSummaries)，账本空了她私聊时就真的什么都不知道。也就是说开了双调用 = S3小纸条/S4事实账本/日总结三条全哑，convo 还在所以短期上下文没事，断的是长期记忆。",
      "②【同源】mentionedNewNpcs 同样没有 spec 产出，NPC涌现第一阶段(传闻中的人物)在双调用下永不触发。",
      "①②修法：不在 6 份 schema 里各抄一遍，新增 COMMON_EXTRACT_TAIL 统一拼在每个意图 user prompt 末尾，明确要求在同一个顶层 JSON 里补 memory(≤50字客观事实，琐事可省)与 mentionedNewNpcs(被提到但不在场的新具名人物，没有可省)。另新增导出的纯函数 normalizeExtractedFields(parsed) 做规整——提取层通常是小/快模型，格式服从度不如主模型，memory 可能吐成对象或数字、mentionedNewNpcs 可能吐成\"甲、乙\"逗号串或单个字符串，而下游 writeNote/registerFact/recordRumoredNpcs 都假定 string 与 string[]；统一收成 string / 去重后的 string[]，空值直接删键而非留空串(下游一律 if (p.memory) 判断)。脏数据一旦写进事实账本，日后再查是谁写的很麻烦，所以拦在入口。",
      "③【新面孔人设退化】MudRPG 里 narrativeText 写死 (p.output||[]).join('')，但双调用的叙事在 rawFull 散文里、p.output 恒为空，于是喂给 mapDescriptionToGenParams 的只剩 brief，退回吃 luck 兜底——正是那段代码上方注释里说要修的\"猎户和商贩长出同一副筋骨\"，在双调用下静默失效。改为在两个分支各自赋值的统一变量(单调用=p.output拼接，双调用=rawFull)，传闻人物 recordRumoredNpcs 的 context 同一处修正。",
      "④【截断不检测】双调用只取 r.rawFull、把 finishReason 整个丢了，撞 length 上限时既不提示也不重说。现在接住并判定，命中时 trace 记 block 态 + 日志明示\"提取层只能按这段残文结算状态\"。不自动重说：叙事已经打到屏幕上(流式更是已转永久条目)，重说会把同一段剧情印两次；位置放在叙事落日志之后，否则\"以上是已收到的部分\"会排在正文上面。",
      "⑤【日志看不到prompt】单调用有 attachPipeline，双调用一处都没有(上一轮补了 traceStep 但没补这个)，出问题仍看不到喂进去的是什么。补在主叙事成功后、提取调用发起之前——getPipelineLog()[0] 取最近一条，等提取发完再挂就变成提取那条了。vite build 通过；新增 17 条断言覆盖 normalizeExtractedFields 的 memory 类型转换/空值删键、mentionedNewNpcs 的数组原样/顿号串/英文逗号串/单字符串/去重/去空项/空数组/非法类型，以及不误伤其他字段与 null 入参，全部通过。dev server 干净标签页复验无控制台报错。",
    ],
  },
  {
    codename: "好感度五档统一分界+攻略表点灯+篇幅100→500解锁；身世定为无名之人、旧信改赌石邀帖，配私聊话题红绿灯",
    time: "2026-07-24 17:43",
    notes: [
      "两块。",
      "【A·好感度五档收口】",
      "①此前五档分界线在四个地方各写一遍(narratorVoicePrompt 的 if/else、NARRATOR_WHISPER_CONTEXT 的攻略表、affectionLabel、旁白Tab 的标签数组)，改一处漏三处。现在收成 narrator.js 的唯一一份 AFFECTION_TIERS[{key,min,label,words}]，配 affectionTier(affection) 查询函数，affectionLabel/旁白Tab/篇幅/攻略表全部改读它。",
      "②【攻略表点灯】NARRATOR_WHISPER_CONTEXT 原本把五档攻略规则全文一次性塞进 prompt，模型每次都要读另外四档跟当前无关的规则——既烧上下文又容易串档(好感41 读到「≥90 问什么答什么」照样会心软)。常量改成函数 buildNarratorWhisperContext(affection)，只点亮当前所在那一档，同 worldbook 蓝绿灯思路。",
      "③【篇幅分档解锁】上一版的 narratorWhisperWordCount 单值(300)改成 narratorWhisperWords 五档对象，出厂 100/200/300/400/500——冷淡期她本就没什么话，篇幅跟着好感度一起解锁，与文风、攻略档位同一条曲线。loadConfig 加逐键补全，旁白Tab 的单滑块换成五档数字框、当前档位用 ▶ 高亮。",
      "【B·身世与旧信】",
      "④身世此前是空的，玩家一问私聊旁白就只能现编，这局说是将门遗孤下局说是灭门孤儿。现在定死：主角就是无名之人，没有失落的血脉、没有隐藏的仇家、没有门派遗孤身份等着揭晓——这是立意不是留白(他挣到的每一分都是自己挣的)。",
      "⑤旧信从「无落款的旧信」改为「赌石邀帖」：天都镇玉器轩温掌柜托人捎出，请他去后院料场看开石，落款写明是温掌柜本人，措辞是生意人的客气话。物品 desc、开场白(presets/qucuo.js opening 加一句点明无姓氏无师门)、OpeningSequence 两张图的 caption、契诃夫之枪第1条全部同步改写，并在契诃夫之枪里明确写上「不许把这张帖子写成血统悬疑或身世伏笔」。",
      "⑥【私聊话题红绿灯】新增 narrator.js 的 WHISPER_TOPICS + gateWhisperTopics(scanText)：纯关键词匹配，扫描「玩家这句话+上一条回复」，命中才注入，没命中一个字不发。与 gateScenario 的区别是方向相反——gateScenario 是「默认全给、按条目灭灯」(减法)，这里是「默认不给、按命中点灯」(加法)，因为身世/邀帖这类冷门追问绝大多数轮次用不上，常驻纯属白烧。目前两条：origin(身世，keys 含 身世/我是谁/来历/父母/爹娘/血脉/遗孤 等 20 词，含繁体)、letter(赌石邀帖，keys 含 信/邀帖/落款/赌石/温掌柜/天都镇/玉器轩 等)。点灯明细进 trace「私聊话题·红绿灯」。worldbook.js 的契诃夫之枪条目 keys 也补上 邀帖/赌石/温掌柜/来历/无名。vite build 通过；另写了 24 条纯函数断言覆盖档位分界(0/19/20/44/45/69/70/89/90/100)、篇幅解锁与自定义覆盖、攻略表只出当前档不带另外四档、话题红绿灯的命中/未命中/双命中/空输入，全部通过；dev server 实机确认五档篇幅面板渲染与 ▶ 跟随好感度联动正常。",
    ],
  },
  {
    codename: "新增「旁白」设置Tab + 私聊接入世界书蓝绿灯 + 截断检查与前缀累积修复",
    time: "2026-07-24 17:52",
    notes: [
      "承接上一版，把旁白线剩下的三件事一次做完。",
      "①【旁白Tab】落地 docs/旁白系统_黑客帝国支线设计.md §八.1 的\"旁白独立设置Tab\"：设置主页从四卡变五卡，新增🎭旁白。内含好感度(滑块+数字+五档标签一键跳档，标签按 <20/<45/<70/<90/≥90 与 narratorVoicePrompt 同一套分界)、剧情阶段强制切换(第一幕暧昧/第二幕告白后/第三幕宕机，宕机在游戏内不可逆、从这里能掰回来；切到告白后额外露出记忆碎片计数0-8)、私聊篇幅目标字数、私聊token输出上限(与API配置里那项是同一个 callTokenLimits.narratorWhisper)、以及新增的\"旁白专属世界书\"。SettingsPanel 新增 narrator/setNarrator 两个 prop，MudRPG 的两处 <SettingsPanel> 调用点同步传入。",
      "②【旁白专属世界书】新增 cfg.narratorLorebook(默认空)，内容只拼进私聊 system prompt、不进主叙事——主叙事的世界观走预设/scenario 那一套，这里写的是\"只有她自己知道的事\"。留空则一个字不发；有内容时 trace 记一条\"旁白专属世界书·注入N字\"。",
      "③【私聊过蓝绿灯】私聊此前直接拼 preset.scenario 全文，每次闲聊都要背一遍地图拓扑、契诃夫之枪、路途遭遇、装备品质六档表——聊天一句用不上，纯烧上下文还把她往说书人腔调上拽。改为与 act 同一个 gateScenario，scope 走独立的 \"whisper\"(不在任何条目的 scopes 里)，因此专项段全靠关键词点亮：问路才亮拓扑、提到人名才亮具名人物、聊到掉落才亮装备规则。认不出标题的段落照旧常驻(蓝灯)，用户改过 scenario 或换自定义预设都不会丢内容。点灯明细写进 trace「世界书·总纲」，与 act 同款格式。",
      "④【截断检查】私聊此前把 finishReason 整个丢掉(主叙事那条路一直有判定+自动重说)，撞上限时界面毫无提示、只表现成\"她话说一半\"。现在流式/非流式两条分支都接住 finishReason，命中 length/max_tokens 时 trace 记 block 态、日志明确提示撞了多少 token 上限并指路设置→旁白。不做自动重试：私聊不消耗回合、玩家再问一句即可，重试反而多烧一次钱。附带修掉一个更隐蔽的危害——⟦好感X⟧要求写在整段最末尾，被截断就一定读不到，parseAffTag 于是兜底+1，她明明在敷衍系统却在加好感；现在 parseAffTag 多返一个 tagged 标志，截断且未读到标记时好感增量按\"未表态\"处理成 0。",
      "⑤【前缀累积】存 convo 时无条件加「（旁白私聊回应）」，模型看见历史里这个模式后自己也写一遍，于是逐轮累积成「（旁白私聊回应）（旁白私聊回应）…」(用户日志里从第4轮起已是双份)。新增 stripEchoPrefix 在存之前把模型自己写的前缀剥干净——前缀由系统负责加，模型写的一律不算数。vite build(--config vite.config.pages.js)通过，并在 dev server 上实机验证了旁白Tab的渲染、好感度档位高亮联动、阶段切换与记忆碎片条件显示，控制台无报错。",
    ],
  },
  {
    codename: "私聊旁白修\"每次只说半句\"：补篇幅指令(默认300字)+token上限600→6000可调",
    time: "2026-07-24 17:24",
    notes: [
      "用户反馈私聊旁白每次只回几十字、还常断在逗号上。排查日志坐实是两个独立原因叠加，不是一个bug。",
      "①【真截断】talkToNarrator 的 maxTokens 写死 `Math.min(apiCfg.maxTokens, 600)`——这是上一轮\"9处写死maxTokens全抽成callTokenLimits\"漏网的第10处(那轮改了questHarness/pigeonReply/inspect/persuasion/extraction×2/knowledge/direction/连接测试，唯独没动私聊)。600这个值在带思考的模型下会被思考token吃穿，正文写二三十字就撞length上限。日志证据是⟦好感X⟧标记：该标记被要求写在整段最末尾，耗时4.7s的那次完整带标记，耗时8~12s的三次全部缺标记且全部断在半句——缺标记=没写到末尾=撞上限。附带危害：标记被截断后 parseAffTag 兜底给+1，于是她明明在敷衍玩家、系统却在加好感，好感度被静默篡改。修复：DEFAULT_CALL_TOKEN_LIMITS 新增 narratorWhisper:6000，调用点改读 cfg.callTokenLimits.narratorWhisper ?? 6000，SettingsPanel「各类调用·token输出上限」补一行「私聊旁白」(loadConfig 本就是逐键补全，老存档自动吃到新键)。",
      "②【根本原因·没截断也短】私聊的 system prompt 里压根没有篇幅指令——主叙事有 buildSysBase 的「篇幅要求：${lenNote}」硬指令(默认约900字)，私聊那条 sys 只拼了 WHISPER_CONTEXT+voice+worldState+facts+recall+scenario，一个字的长度要求都没有，模型没有目标就按聊天默认长度走。这条不修，token调到10万她照样只说两句。修复：narrator.js 新增 narratorWhisperLengthNote(words)，apiConfig 新增 narratorWhisperWordCount:300(私聊本就不该像叙事那么长，给独立短篇幅线)，拼在 sys 最末尾——沿用本项目已验证的酒馆插入深度经验(Depth 0=贴生成处=最强位)，与\"成文铁律放userContent末尾\"同一条道理，不埋进开头被当耳旁风。该指令保留两个逃生口：冷漠期(<20)对系统元问题的打断式回绝、以及CRASHED后的空壳应答，那两种本就该是一句话，不该被篇幅要求硬撑长。",
      "③需要说清的是：还有一部分\"短\"是设计如此不是bug——好感度41落在<45档，narratorVoicePrompt 该档原文就写着\"简短回应几句\"\"语气冷淡、公事公办\"，私聊分档攻略20-45档也写着\"勉强点一两句，含糊、留一半\"。养到45+才\"愿意闲聊\"。本轮只修掉技术性的短，人设性的短保持不动。vite build(--config vite.config.pages.js)验证通过。注：根目录的 vite.config.js 因 rollupOptions.input 引用了仓库里并不存在的 debug.html/debug-gamble.html/debug-item.html，`npm run build` 在干净检出上必然失败(与本轮改动无关的既有问题)，故用 pages 配置验证。",
    ],
  },
  {
    codename: "双调用主叙事补自动重试+提取失败不再静默(修60秒超时整轮回滚)",
    time: "2026-07-24 17:01",
    notes: [
      "修复双调用模式\"用不了\"的故障：行动日志显示[状态写回]异常回滚·接口超时60.0s，每轮行动都整体回滚。根因两条。",
      "①【核心】双调用分支(extractionEnabled)的主叙事调用此前只试一次——单调用模式有MAX_AUTO_RETRY=2共3次尝试兜底，双调用一次超时就直接抛错、两阶段pipeline整体回滚；而接口超时卡的是首字节(TTFB，fetchWithTimeout默认60s)，非流式请求要等服务器把整段叙事生成完才回第一个字节，主叙事目标字数高+中转站排队，不思考的模型也照样超时。修复：双调用分支主叙事调用接入与单调用一致的3次重试循环（断线提示\"正在自动重试\"、成功提示\"✓重连成功\"，重试用尽才回滚）。",
      "②【可观测性】双调用分支此前完全没有traceStep，行动日志里AI调用/提取调用全程留白，出故障无从排查（这次的超时就是靠\"没有AI调用步骤\"反推出走的是双调用分支）。补齐：主叙事成败、提取调用成败均写trace。",
      "③提取层JSON解析失败此前被静默吞掉(parsed={})，玩家能看到叙事但状态悄悄没更新、毫无感知：extractionEngine返回值新增parseFailed字段，MudRPG收到后明确提示\"返回的不是合法JSON，本轮状态未更新\"。",
      "④顺带修一处死代码：EXTRACTION_SPECS[intentCode]||UNKNOWN的回退写法会让META_QUERY(显式null=本意图不提取)错误落到UNKNOWN，使if(!spec)return null永不触发，改用hasOwnProperty判断（现状下META_QUERY本地秒回走不到提取层，无实际影响，属语义修正）。另排查确认\"关闭思考\"的真实语义：off只是发关闭参数(reasoning_effort:none/enable_thinking:false/thinkingBudget:0)，deepseek-reasoner/o系列/gemini-2.5-pro等服务端强制思考的模型不认照样思考，60s超时与思考开关无必然关系，根因建议是设置→接口超时调大到120~180s(上限300s)或开流式(Gemini类型不支持流式)。esbuild验证MudRPG.jsx/extractionEngine.js两文件通过。",
    ],
  },
  {
    codename: "提取模型加自动检测+日间模式文字配色全面修正",
    time: "2026-07-24 07:59",
    notes: [
      "两件事。",
      "①双调用模式\"默认提取模型\"和6个意图专属模型此前只能手打模型名，没有自动检测入口。补齐：新增modelPickerTarget状态记录\"当前检测结果该填到哪个字段\"(null=主模型/\"extractionModel\"=默认提取模型/意图key=对应意图专属模型)，handleDetectModels加target参数；提取调用渠道(endpoint/key)本就沿用主配置，跟主模型是同一供应商同一份模型列表，不需要重复发请求，复用同一份modelList状态即可。默认提取模型和6个意图专属模型各自加🔍检测按钮+复用列表的选择UI，点选后写入对应字段。",
      "②日间模式的文字配色此前只做了zoneTheme(背景/边框/正文基调)，但主叙事日志用的整套颜色映射clr(desc叙事正文/room地名/cmd命令/item物品/stat状态/skill技能/err错误/choice选项/narrator旁白/crash崩溃/confess告白/affection好感/quest任务共14类)完全写死，WCAG对比度实测在日间米色背景下几乎全部低于2.5(需要4.5+)，desc仅1.62、room仅1.75，这也是用户反馈\"叙事文字该变黑\"\"地名该变深蓝\"的根源。新增clrDay配色表，保留每个类型的色相基因(错误依旧红系/对话依旧粉系)但大幅拉深明度，14项全部核算达标(5.2~10.5不等)，clr = isDayMode ? clrDay : clrNight。同时补上LogEntry.jsx里两处同样写死的高亮色——对话「」原本亮粉e8a0d8(日间对比度仅1.77)、引语\"\"原本琥珀d4a853(仅1.94)，这两处是叙事里最想让人一眼看清的内容，问题比正文更严重，加DIALOGUE_COLOR/QUOTE_COLOR日夜两套(日间对比度分别到7.46/5.48)，LogEntry加isDayMode prop，3处调用点同步传入。esbuild验证SettingsPanel.jsx/MudRPG.jsx/LogEntry.jsx三个改动文件全部通过。",
    ],
  },
  {
    codename: "弹窗遮罩误触修复(全项目)+模型下拉退不掉+双调用框视觉修正",
    time: "2026-07-24 07:49",
    notes: [
      "三个反馈一次性处理。",
      "①【核心】弹窗遮罩误触：原写法(外层遮罩onClick={onClose}+内层stopPropagation)有个经典陷阱——click事件只看mouseup落点，不管mousedown起点。玩家在弹窗内输入框/文本区域选字拖拽复制时，若手一抖把鼠标拖出弹窗范围、松手时已在遮罩区域，浏览器依然会合成一次落在遮罩上的click，stopPropagation完全挡不住，表现为\"选字选着选着弹窗自己关了\"。新建 utils/overlayClose.js 导出 useOverlayCloseGuard(onClose)，用ref记录mousedown起点，要求mousedown和click都精确落在遮罩本身(target===currentTarget)才真正关闭。全项目排查后接入：SettingsPanel/CharacterPage(两处)/DuelScreen/ItemActionMenu(两处)/LoreScreen/NpcActionMenu/PortraitManager 共8个独立文件；MudRPG.jsx内的PipelineViewer(prompt排查面板，选字最高频、受影响最重)/换头像弹窗/版本历史弹窗/大地图放大弹窗共4处；以及最大的一处杠杆——buildings/InnScreen.jsx导出的共享Overlay组件，被13个建筑面板(当铺/武馆/钱庄/医馆/悬赏/镖局/寺庙/赌坊/藏书阁/铁匠铺/茶馆/运镖+任务日志)复用，这一处改好等于一次性修好13处同款问题。TutorialOverlay设计上就是\"点哪都关\"(无stopPropagation分层)，不受此bug影响，未改动。",
      "②模型选择下拉框退不掉：SettingsPanel里`自动检测`出的模型列表此前没有任何关闭方式——选了模型也不清空modelList状态、没有×按钮，真正的功能缺失不是误触。修复：点选模型后自动setModelList(null)收起，另加\"✕ 收起\"按钮可随时手动收起，并把Anthropic静态清单提示行改造成可容纳收起按钮的头部行。",
      "③双调用模式\"各意图单独指定模型\"输入框看不清能否填：非bug，是视觉误导——这些input本身没有disabled、逻辑完全正常，只是值为空时显示的灰色placeholder(继承值提示)太像禁用态占位符。加一行说明文字\"灰字是继承提示不是禁用\"，并且填了值后border变绿色强调，帮助区分\"手动指定\"与\"继承默认值\"两种状态。esbuild验证全部9个改动文件(含MudRPG.jsx整体)通过。",
    ],
  },
  {
    codename: "日间模式(米色底+棕框+深字)一键切换",
    time: "2026-07-24 07:38",
    notes: "新增日间模式，参考 Claude.ai 官方界面的暖米白配色。原有六套 ZONE_THEMES 全是暗夜基调(暗背景+亮字)，本轮不是简单套一份统一浅色，而是给每个地理分区各自做一次\"深→浅\"的忠实转换，保留\"不同地方氛围不同\"的设计初衷：theme.js 新增 ZONE_THEMES_DAY(六套浅色版本，字段与暗夜版一一对应)——bg/bgPanel 换算成米色系(bgPanel 比 bg 略白制造层次)、border 统一收拢到棕色调、text 换成暖黑正文(非纯黑)、accent/accentDim 保留各分区色相基因但大幅拉低明度提高饱和度(暗背景上的亮丽高亮色直接搬到浅背景会糊得看不清，必须换算成深沉浓郁的同色系版本)。getZoneTheme(roomName, isDayMode=false) 加第二参数，两套主题字段完全一致，下游117处 zoneTheme.xxx 引用不需要感知日夜切换、自动生效。MudRPG.jsx 新增 isDayMode 状态(localStorage持久化，同 uiScale 模式)，zoneTheme取值处传入；顶部工具栏加「☀日间/☾夜间」一键切换按钮，同排原本写死 border:#1a1d2e 的9处按钮改为 `1px solid ${zoneTheme.border}`，让这排按钮本身也正确跟随日夜切换(赌石界面等自成一套配色、不消费zoneTheme的模块本就不受影响，不在本次改动范围)。用 WCAG 相对亮度公式核算全部六组 bg×text/bg×accent 对比度，五组直接达AA标准(4.5+)，village分区accent经一轮加深调整后也达标(5.2)。esbuild 验证 theme.js 与 MudRPG.jsx 均通过。",
  },
  {
    codename: "私聊旁白接入行动分层日志(trace)",
    time: "2026-07-24 07:32",
    notes: [
      "talkToNarrator(右栏「◆私聊旁白」)此前完全不进「🧭行动全流程日志」——底层 callModel/callModelStream 其实早就把每次调用的完整 prompt/回复记进了 pipelineLog，但没有一条 trace 把它挂出来，面板里私聊旁白全程留白，出问题(答非所问/召回没生效)时无从排查。按 act() 的既有用法补齐：",
      "①函数开局 startTrace，含 CRASHED 早退分支也归档(不再是\"开了不收\")；",
      "②逐阶段 traceStep——意图(私聊·不消耗回合)、旁白崩溃状态拦截、全知事实账本注入(有/无区分pass/skip)、向量召回(开关关闭/召回为空/命中N条三态)、AI调用(流式/非流式分别标注)；",
      "③attachPipeline(_wt, getPipelineLog()[0])在流式与非流式分支各自紧跟调用点挂上，失败分支同样挂(带错误信息)；",
      "④endTrace收尾摘要带回复前30字预览+好感度增量，一眼看出这次私聊聊了什么、好感怎么变；catch块补上fail态traceStep+attachPipeline+endTrace，不再是私聊报错却在trace系统里查无此事。不消耗回合这件事本身不变——trace只是留痕，不代表计入时间。TraceViewer渲染逻辑本就通用(纯遍历steps+可选pipeline展开)，UI侧零改动即可正确展示。esbuild验证通过。",
    ],
  },
  {
    codename: "玩家预制头像换新(唐卡厚涂8连图)",
    time: "2026-07-24 07:23",
    notes: [
      "右栏「侠客」面板的玩家预制头像整批换新。素材来源：用户给的一张2行4列8宫格唐卡高饱和厚涂风格插画(藏地高原背景+金色描边分割)，按等分硬切成8张干净的2:3竖版单人头像(边缘各收4px去毛刺，统一放大到720×1080)。分配：male=藏剑大叔、female=花商、other=朔风独行刀客(默认兜底款)、preset1~5=飞贼/猎手/猫人/假小子/穿越者。代码改动两处：",
      "①头像选择器候选数组从原来硬编码的 preset1~4(4档)扩到 preset1~5(5档)，把7张非默认款全部纳入可选；",
      "②头像展示框与选择器候选格的 aspectRatio 从旧的 9:16 改成 2:3，匹配新素材实际比例(NPC对话立绘走另一套9:16系统，未动)。同步更新 public/portraits/player/README.md 与相关代码注释，反映当前8张头像的实际内容和来源。esbuild 验证 MudRPG.jsx 语法与依赖解析通过；vite build 本身因仓库缺 debug.html/debug-gamble.html/debug-item.html 三个调试入口文件而失败，与本次改动无关(属仓库既存缺口，入口对应的 debug-*.jsx 源文件都在，只是页面壳文件没推上来)。",
    ],
  },
  {
    codename: "《天都·曲措》发布版(GitHub Pages上线+藏地UI整套)",
    time: "2026-07-24 13:00",
    notes: [
      "项目正式起名《天都·曲措》并上线 GitHub Pages 在线试玩(feihu-lgtm.github.io/qucuo)。本轮以工程化上线+藏地视觉整套为主，逐项：",
      "①部署——vite.config 加 base(DEPLOY_BASE 控制，Pages 用 /qucuo/)，新增 vite.config.pages.js(只打包主入口)与 .github/workflows/deploy.yml(push main 自动构建部署)，.gitignore 忽略 dist(Actions 重建)。",
      "②CORS——apiConfig 给 Anthropic 两处 fetch(非流式+流式)加 anthropic-dangerous-direct-browser-access 头，使浏览器可直连；核实 Gemini generateContent 与 OpenAI 兼容本就放行；withProxy 非 localhost 且无自定义代理时直连；设置面板保留 corsProxy 兜底。",
      "③地图 UI——九宫格 NineGridMap 接入藏地三态贴图(idle 石板/current 翡翠/fog 黑雾，stones/mapui/)，去掉方向字与 boxShadow 光晕(消竖线)、三态统一 cellStyle;放大 topo 图 ClickableMap 重写：节点 rect 换 image 三态贴图、加 pan(拖动平移,防误触3px阈值)+zoom(滚轮0.4~3x+按钮±/复位)，连线改金棕配卷轴;卷轴底 scroll_bg 从原图重抠假透明、清 77 毛边像素;删内层九宫格下方冗余的出据点按钮(出村统一走外层视图,已核实外层 forceLayer:outer 路径独立完整)。",
      "④开始界面——StartScreen 用隶书白字标题 title_tianducuo_v3(去假透明+抹印章+黑字染白)压雪山背景 start-bg，左对齐布局，菜单开始/加载/设置/退出;曾试藏式木牌皮后按需回退纯 CSS。",
      "⑤设置面板——SettingsPanel 从长条 tab 改主页卡片式(API/预设/存档/其他四卡，点进次级面板带返回);API 类型只留 OpenAI 兼容(删 Anthropic/Gemini/千问按钮+快速填入,挂载时强制纠正旧配置 apiType=openai);删金手指/玩法说明 tab,字号移入其他。",
      "⑥favicon——藏式雪山+祥云+经幡圆徽多尺寸(32/180/512/ico),index.html 标题改天都·曲措。",
      "⑦README 顶部加封面(黑字 v2,配 GitHub 白底)+在线试玩/源码互链。藏文 མགར་ཆུ་གནམ་མཚོ 中 chu(河)gnam(天)mtsho(湖)三词根经真实地名(那曲/纳木措)核实,开头 gar(白)无查证依据、四词连写语法待母语者校对——已在 notes 与美术存档标注,上线前需人工核。多次 vite build 通过。",
    ],
  },
  {
    codename: "文档同步(记忆系统闭环+存档IDB全线更新)",
    time: "2026-07-22 19:40",
    notes: [
      "把本轮记忆系统闭环+存档迁IDB的改动同步进各 md（无代码逻辑改动）。",
      "①交接_借鉴总结系统.md：标题/一分钟现状从\"实现待开工\"改为\"主体已实现\"；第4节 8条TODO逐条标状态(1/2/3/5/6/7/8 done、4缓做)+2.5六条现状+本轮额外落地(私有门/AI小总结/对账/回滚确认)+剩余待做；索引加流程总表、下一步改为已闭环。",
      "②项目状态.md：已完成段新增\"记忆系统(主体闭环)\"与\"存档(迁IDB)\"两块，知识系统补0.35/40回合参数、主循环补两阶段回滚。",
      "③README.md：自动存档 localStorage→IndexedDB直写缓存、查看介绍改为worldLook走主叙事+1时间+写小纸条(商店预览不变)、文档地图加记忆与正文流程总表.md。",
      "④记忆系统说明.md：顶部加2026-07-22大更新横幅(统一writeNote/owner三态/四来源/私有门/日总结/AI小总结/对账/存档IDB)，标注下方原文哪几处以横幅为准。",
      "⑤文件树.md：memory段补 note.js/daySummary.js、更新 memoryWrite(垫片)/recallWithVisibility(私有门)/saves.js(IDB)注释。",
      "⑥记忆与总结设计.md：顶部加\"主体已落地\"指引。vite build 通过。",
    ],
  },
  {
    codename: "召回前对账(指纹漂移自愈)+确认act两阶段回滚已完整",
    time: "2026-07-22 19:10",
    notes: [
      "对照参考项目 pipeline.js 的两条机制收尾。",
      "一、act 提交出错的快照回滚：核实后确认本就已做且完整——act 在发送前(1842)把 room/char/dao/skills/inv/exp/pot/flags/mapData/time/varTree/convo 打包成 rollback 快照，try 体内任何一步抛错即在 catch(2308) 整体还原，log 保留错误行不回滚。唯一在 act 之外的 setClaimedMilestones 属另一函数 claimMilestone、不在 act 事务内，无回滚缺口。故不改。",
      "二、召回前对账：参考项目对着 summaryHistory 清单做删孤补缺，但我们的小纸条自带向量、无单独清单，不存在孤儿；真正对应物是换 embedding 模型后老纸条 fingerprint 过期、被 recall 的 m.fingerprint===fp 过滤掉、永久召不回只占库。故实现 findStaleNotes(纯，挑有文本但指纹不符者)+reembedStaleNotes({cfg,maxPerRun=3})(有界重算向量写回、同 id 覆盖、绝不删只重嵌，宁可暂时召不回也不丢记忆)。在 act 召回块开头 fire-and-forget 触发，逐回合把库里过期纸条慢慢补齐、不阻塞本轮时序。debug.mjs note 节加指纹筛选单测，全过；vite build 通过。",
    ],
  },
  {
    codename: "存档迁IndexedDB(直写缓存)+飞鸽切磋改AI小总结",
    time: "2026-07-22 18:30",
    notes: [
      "两件。",
      "一、飞鸽/切磋的事实摘要不再系统拼模板，改走 AI 小总结：新增 aiSummarizeFact(factId,cue) 助手，注册事实时先塞一句结构化线索兜底、随即 fire-and-forget 叫 AI(factSummaryRequest)写成白话古文小总结覆盖(AI关了就留结构化兜底、不再是死模板)。切磋结算、飞鸽发信、飞鸽回信三处接入(发信/回信的 cue 带上信文大意)。",
      "二、存档从 localStorage(约5MB易撑破)迁到 IndexedDB。学参考项目 storage-service.js 的 Write-Through Cache：内存 _cache 作同步读来源，启动 main.jsx 先 await saves.init() 一次把 IDB 全量灌进缓存，此后 loadAutoSave/loadSlot/listSlots 全部同步读缓存——故 MudRPG 的同步 useState 初始化、SettingsPanel 的同步槽位渲染一律不用改(先前误做的\"全异步+父层传restoredSnapshot prop\"已收回)。写：同步写 _cache + 异步 fire-and-forget 写 IDB + 尽力同步写 localStorage(关页兜底，超额跳过)。IDB 不可用自动降级纯 localStorage。迁移：init 时 IDB 空则从旧 localStorage 键迁入，旧档保留不删作安全兜底；autoSave 顺带写 LS，init 取 IDB 与 LS 较新者(治 IDB 异步写关页来不及落盘)。写入一律 structuredClone 断共享引用防串台。槽位 id 加随机后缀防同毫秒撞。node 降级路径快测全绿(autoSave/槽位增删改查/倒序)；vite build 通过。IDB 主路径逻辑同构，需在真浏览器点一遍(新开局/读档/刷新续档/手动存读删)确认。",
    ],
  },
  {
    codename: "记忆系统三件套(私有召回门+日总结+远景注入)",
    time: "2026-07-22 17:15",
    notes: [
      "接着小纸条地基往下推三件。",
      "①私有召回门：owner 三态的兑现——recallWithVisibility 加 presentNames 参数，owner 非空的私有/共同目击条只在 owner 里至少一人此刻在场时才浮现，公共条恒过、旧 flag 私有走 flag。逻辑抽成 note.js 的纯函数 noteVisibleTo(可单测)。三处调用传在场人：主 act 传 room.npcs+对话对象 talkTarget；私聊旁白传[旁白]（旁白私有条浮现、NPC私有条不漏）；知识账本补摘要那处默认[]（私有条本不该喂公共传闻，正好挡掉）。",
      "②日总结（大纸条）：新建 memory/daySummary.js(纯函数 buildDaySummaryRequest/appendDaySummary/buildDistantViewBlock，MAX14天丢最老)。MudRPG 加 dayMaterialRef 攒当日原料(jotNote 与 act 的 p.memory 都推入、与embedding无关)，prevDayRef+useEffect 侦测跨天(floor(time/24)增长)后台 summarizeDay 归纳存 varTree.世界.日总结，fire-and-forget失败静默。apiConfig 加 daySummary token 上限默认2000。",
      "③远景注入：buildDistantViewBlock 取最近5条日总结拼成远景块，注入 userContent 的 ctx 之后、recallBlock 之前(背景层=较弱位，只保连贯不喧宾夺主)。debug.mjs note 节加私有门单测、新增 daysum 节，全过；vite build 通过。账本owner化(内容并入小纸条)暂不做——账本内容同步供 buildInfoDomainBlock、小纸条在IDB异步，并入会逼同步链改异步，得不偿失且非硬需求，留待有token压力时再收拾。",
    ],
  },
  {
    codename: "小纸条六来源接线(2.5六条硬需求)",
    time: "2026-07-22 16:20",
    notes: [
      "把交接文档2.5的六条硬需求全部落地——都是给统一 writeNote 传不同 owner/source。新增稳定助手 jotNote(latest-ref模式，定义在 addLog 之后、早于所有使用者，避免 deps 数组 TDZ；用 ref 兜最新 cfg/回合/地点/名单，故本身 deps 空、恒稳)。逐条：",
      "①look查看走主叙事——inspectItem 加 worldLook 档，玩家端详自己背包/武学时算1回合时间+写公共小纸条+不吃缓存(商店预览等默认不传 opts，仍瞬时缓存不耗回合)；背包/武学三处点击传 worldLook:true。",
      "②飞鸽正文+私有条——sendPigeonLetter/replyPigeonLetter 在全文线之外各额外 jotNote 一张 owner=对方 的私有小纸条(source=pigeon)。",
      "③哑动作系统自写电报体——打坐/练内功/练外功/买/卖(6处交易内联handler) 各 jotNote 一句 source=dumb 公共条。",
      "④对话/私聊你俩私有——act 向量写入去掉!isTalk拦截、按模式定owner(行动=公共owner空，对话=私有owner对话对象talkTarget)；知识账本同步隔离：对话模式只让 talkTarget 一人亲历入账(标签私语)、不摊给同屋外人，行动模式才在场共同目击；私聊旁白 talkToNarrator 额外产 owner=旁白 的私有条(source=whisper)。",
      "⑤900字上一版已做。",
      "⑥出处现状已被",
      "①-",
      "④打破。清理：MudRPG 不再 import recordMemory(其唯一调用已换成 writeNote，memoryWrite.js 薄垫片文件留存未删)。注：内层移动本就走 act() 主叙事(AI叙事+走主路径写条)，不另作哑动作补记，避免双记。vite build 通过、note 纯逻辑单测通过。私有召回门(按在场人过滤owner)/日总结/账本内容并入小纸条 仍是后续TODO。",
    ],
  },
  {
    codename: "感叹号任务节点重做(拆框+仪式行+叙事强位铁律)",
    time: "2026-07-22 15:10",
    notes: [
      "围绕点感叹号的一整套体验改造，五处。",
      "①UI拆框：原来❢触发节点和分支「行动选项」全挤在同一个金色框里没区分度，现拆成上下两个独立框——「❢ 此处可推进」(金色，纯推进节点点一下即走)与「◈ 行动抉择」(绿色，分支任务的选项按钮)，配色+标签分开，天然两行。",
      "②点❢的仪式行：triggerQuestFromPanel 与 triggerQuestChoice 袖手分支在调 act 之前先 addLog 一句金色「❖ 任务开启/推进 「标题」」+ 暗色「〔详情可查任务面板〕」提示(新增 quest 金色日志类型)，让点一下推进这件事有郑重落点、并引导去任务面板看详情。",
      "③选项与叙事先后卡一下：p.choices 从与叙事同帧渲染改为 setTimeout 650ms 延后浮现，先读剧情后给抉择，不糊在一起。",
      "④完整句成文铁律：新增「成文铁律·逐段自查」——每段句子须主谓宾定状补齐全、无残句掐头去尾，涉及的时间/地点/人物/起因/经过/结果须交代到实处、不许用『那人』『某处』含糊带过。",
      "⑤该铁律放到插入深度最低的强位：查证酒馆 prompt-manager 语义(Depth 0=提示末尾=最强)，把这条铁律拼在 userContent 的 hist 之后、cmdSuffix 之前(user块最末尾、贴生成处)，而非埋在 system 里被当耳旁风。另 forcedEvent 情节篇幅上一版已随 targetWordCount 拉到900线。vite build 通过。",
    ],
  },
  {
    codename: "小纸条系统地基(统一写入+owner三态)",
    time: "2026-07-22 14:30",
    notes: "记忆系统 TODO 1 地基。新建 src/memory/note.js 作为「写小纸条」唯一入口：normalizeOwner/ownerTier/buildNoteRecord 三个纯函数(可 debug.mjs 单测) + writeNote 异步入库。正式立起 owner 三态 schema——owner 空=公共(visibility=public)、单人=私有、多人=共同目击(均 visibility=private)；每项 {name,via}，via 亲历/目击/传闻；owner 人名并入 entities 供日后人路召回；新增 place(场景路)/source(来源标签 narrative/talk/whisper/dumb/pigeon)。memoryWrite.js 的 recordMemory 改为委托 writeNote 的公共小纸条薄垫片(现有主叙事调用处不动、无痛接入统一路径)。recallWithVisibility 的返回 meta 透传 owner/ownerTier/place/source(现在无害，后续私有召回门用)。本步按交接文档第6步纪律只跑通「公共小纸条带owner写入+召回」，私有召回门/哑动作补记/私聊-飞鸽产条/账本合并/日总结留后续TODO(届时只是给 writeNote 传不同 owner)。debug.mjs 加 note 小节单测三态+visibility+entities映射，全过；vite build 通过。",
  },
  {
    codename: "任务/剧情叙事拉到900字线",
    time: "2026-07-22 14:10",
    notes: [
      "把剧情类叙事的篇幅从旧的偏短档统一拉到主叙事同一条 900 线。三处：",
      "①forcedEventNote(❢任务情节节点)原写死 150-300 字，改为约 apiCfg.targetWordCount 字(跟随主线字数、允许±15%，要求有场景有对话有起伏)。",
      "②apiConfig DEFAULT_INTENT_BUDGETS 的 COMBAT 700→900、EXPLORE_ACTION 500→900(这俩才是实际生效的上限，覆盖 inputIntent 里的 wordBudget 兜底)。",
      "③老存档迁移：loadConfig 合并 intentBudgets 后，把恰等于旧出厂值的 COMBAT===700/EXPLORE_ACTION===500 顶到 900(只顶没手动改过的，用户特意调过的别值不动)。META/LOOK/MOVE/闲聊等轻动作档不变。vite build 通过。",
    ],
  },
  {
    codename: "完善交接文档与README文档地图",
    time: "2026-07-22 13:50",
    notes: [
      "文档层面收尾（无代码逻辑改动）。",
      "①重写 docs/交接_借鉴总结系统.md：从旧的\"借鉴参考项目16文件\"计划版，改为完整接力版——记忆系统设计定稿摘要(两类小纸条/owner三态/账本合并/飞鸽独立/检索三段)、已落地代码六条倒序、8条待做TODO+顺序、明确不并不借清单、坑(含 version.js notes 别写反引号)、下个session第一步。",
      "②README 文档地图补上 交接_借鉴总结系统.md 一行；梳理记录加 2026-07-22 条目(记忆设计定稿/文件树/交接重写 + 当天代码改动指向 version.js)。version.js 自身条目此前已逐笔记全、倒序、CURRENT 指向最新。",
    ],
  },
  {
    codename: "情节harness并入主叙事(取消单独AI调用)",
    time: "2026-07-22 13:20",
    notes: [
      "把点感叹号任务节点时单独调一次 questHarness 的做法并入主叙事：act() 新增第三参 opts（forcedEvent/forcedEventNpc），在 ctx 末尾（酒馆最强位）追加一段",
      "【本步已定情节】强指令，把原 harness 的收窄约束搬来（只写这一件、不引入别的情节角色、结果不可改写），并加护栏：奖励已由系统 forceAdvanceQuest 结算，AI 不要在 delta、items_add、flags_add 里重复结算，防双重发奖。两个点击 handler（triggerQuestFromPanel 与 triggerQuestChoice 的袖手分支）改为 forceAdvanceQuest 后调 act 并带 forcedEvent，删掉各自手动命令日志与 harness 调用（act 自己会记命令行）。忙时排队 pendingQueue 现在连 opts 一起存取重放，避免排队重放丢 forcedEvent；autoTravel 的 push 无 opts 由空对象兜底。移除 MudRPG 的 harness import、设置面板撤掉情节推进叙事一项（questHarness.js 暂留参考不引用）。行为变化：任务步现在走时间加一、且进 convo 与记忆。飞鸽不并（无当场，延时异地触发保留独立）。look 查看介绍暂未并（其写小纸条依赖尚未实现的小纸条系统）。esbuild 通过。",
    ],
  },
  {
    codename: "闲置AI方向兜底(移动已按钮化)",
    time: "2026-07-22 12:45",
    notes: "移动早已改为点方向按钮/点地图节点/自动寻路(纯查表 resolveExit/autoTravelTo，不走大模型)，那条\"打字口语移动+正则parseDir失手时问小模型判方向\"的 AI 兜底不再需要。闲置处理：MudRPG 里把触发条件 `if(!isTalk && !movingDir && QUCUO_MAP[room.name])` 改为 `if(false && ...)`，整段 judge 逻辑(buildDirectionJudgeRequest/judgeCfg/callModel/parseDirectionJudgeResponse)一行不删、保留原地，日后想恢复\"打字也能口语移动\"去掉 `false &&` 即可。设置面板「各类调用token上限」撤掉 direction 一项(不再触发就不必露出)；callTokenLimits.direction 默认值保留在 config 里(闲置代码仍作兜底引用)。qucuoMap.js 的 buildDirectionJudgeRequest 保留未动。esbuild 通过。",
  },
  {
    codename: "全部调用token上限可调·设置里最高100000",
    time: "2026-07-22 12:30",
    notes: [
      "把原来散在代码里写死的 9 处调用 maxTokens 全部抽出，集中成命名配置 callTokenLimits，并在设置面板加一节「各类调用·token输出上限」逐项可调、上限 100000。起因：gemini-3-flash-preview 这类带思考模型，思考token与正文共用max_tokens，而 questHarness 写死 500、persuasion 200、pigeonReply 800、knowledge 120 等小值会被思考吃穿，正文半句就撞 length 上限截断（主叙事没事是因其上限走 wordCountToMaxTokens 地板 200000）。改动：",
      "①apiConfig 新增 DEFAULT_CALL_TOKEN_LIMITS(questHarness3000/pigeonReply3000/inspect4000/persuasion2000/extraction2000/knowledge2000/direction200/connectionTest200) + CALL_TOKEN_LIMIT_MAX=100000 + defaultConfig.callTokenLimits + loadConfig 嵌套兜底（浅合并会丢新键，改按 默认<-存档 逐键补全，intentBudgets 同样加固）；",
      "②9 处调用点(questHarness/persuasion/inspect/pigeonReply/extraction×2/knowledge/direction/两个连接测试)全部改成读 cfg.callTokenLimits.xxx ?? 兜底；",
      "③SettingsPanel 加数字框 min1/max100000/step100，含说明。connectionTest 默认从50提到200（50在思考模型下返空）。esbuild 通过。",
    ],
  },
  {
    codename: "记忆与总结设计定稿·文档",
    time: "2026-07-22 04:00",
    notes: [
      "几轮商量收敛成 docs/记忆与总结设计.md（纯设计，未改代码）。核心：把\"引主叙事/向量记忆/事实账本/NPC线\"四套坍缩成两大件——",
      "①小纸条统一向量库(一句白描+owner富标签，owner三态：空=公共/单人=私有/多人=在场目击，同时表达属于谁+谁知道；账本被摊平成这个标签)；",
      "②飞鸽全文线独立精确存(逐字重读，不进向量)。定了三条铁律(AI写血肉系统写骨架、AI尽量简单小模型尽量匹配、坍缩两大件)。淡忘系统暂闲置(旧纸条被token预算挤出=软遗忘)。附全部行动主表(自由/对话/私聊/内外移动/打坐/练功/切磋/送礼/拜师/采集/拾取/交易/住店/求医/赌坊/拜佛/点菜/钱庄当铺/武馆/飞鸽 各自：谁结算·走不走AI·叙事·走不走时间·记什么·公共私有·能否调取)——经核实：正经事都走act()→AI叙事+小纸条，哑动作(打坐+1/练功+2/内移+1/交易0)绕过AI且现无小纸条(缺口，需系统补记喂日总结)。含检索三段(近景/人路+场景路回忆/远景)+信息隔离闸+token照搬+8条TODO+实现顺序。挂进README文档地图。",
    ],
  },
  {
    codename: "合包·调试台+地图叙事并入(保时间修复)",
    time: "2026-07-22 03:40",
    notes: [
      "把用户那支（在\"文件树\"版之上并行做的）成果合进本支，两边零冲突（改的是不同区域）。并入的新东西：",
      "①src/mapNarration.js——内层箱庭移动的方位文字纯函数 describeInnerArrival（从哪来/四周内层出口/远处外层据点），MudRPG 内层移动分支改用它（本地生成、不调 AI）；",
      "②src/debugConsole.jsx + debug-main.jsx + 根 debug.html——独立调试台页面（不经开局，点按钮跑 inner/parse/ai/extract 四节检查、结果打进输出面板，AI 节复用 localStorage 的 API 配置）；",
      "③tools/debug.mjs + api.local.json.example——终端版调试（npm run debug）；",
      "④vite 多页打包（index+debug）、package.json 加 debug 脚本、README 加\"代码调试台\"节、新增 .gitignore。本支自带的时间制修复（24制/初正/dayIdx/旅店+24）全部保留，与内层分支互不影响。多页 esbuild 通过（index.html + debug.html）。",
    ],
  },
  {
    codename: "时辰分初正·上下半时辰古法显示",
    time: "2026-07-22 03:20",
    notes: "在 24回合/天（每时辰2回合）基础上，把一个时辰的两个回合按古法分「初/正」上下半：偶数回合=「X初」、奇数回合=「X正」（如丑初/丑正、卯初/卯正，子正即半夜正中）。SHICHEN 由\"子时/丑时…\"带时字改为单字\"子/丑…\"，getTimeStr 输出 第X日·{时辰}{初|正}。取模加 ((t%24)+24)%24 兜底防负。开局 time=6 = 第1日·卯初（晨）。SHICHEN 全项目仅 getTimeStr 引用，无误伤。esbuild 通过。",
  },
  {
    codename: "时间制统一24·修旅店+25双重计时",
    time: "2026-07-22 03:00",
    notes: [
      "代码里原有两套打架的\"一天\"：显示/天数用 100 制（getTimeStr day=floor(t/100)、dayIdx=floor(time/100)），而旅店+24、飞鸽\"1时辰=2回合\"、README 用 24 制。全部统一到 24 回合/天（每时辰2回合，12时辰/天）：",
      "①getTimeStr 改 day=floor(t/24)+1、shi=SHICHEN[floor((t%24)/2)]；",
      "②dayIdx 改 floor(time/24)——游走人口改为按真实一天刷新（原来100回合才算一天太久）；",
      "③初始/重置 time 25→6（24制下正好等于原本的\"第1日·卯时\"，开局显示零变化）。另修旅店+25双重计时 bug：数值段 setTime 从+24改+23，叙事段 act() 再+1，合计正好一天=24（住店\"安睡一日\"）。注意：内功/外功/好感度的 /100 是 0-100 数值上限，与时间无关，未动。esbuild 通过。",
    ],
  },
  {
    codename: "项目文件树·文档",
    time: "2026-07-21 16:00",
    notes: "仿参考项目的注释式结构树，扫真实 src/ 逐文件写成 docs/文件树.md（放文档开头），每文件一句话用途，按 开局界面/系统核心/地图/NPC/装备/combat/memory/items/kungfu/quests/shops/buildings/presets/utils 分组。文末标与参考项目差异：记忆召回同源(recallEngine 照其 memory-recall 写)，但尚无其滚动摘要/周总结(summary-*)与 IndexedDB 存档(idb-snapshot)——即下一步最值得借鉴的两块。挂进 README 文档地图。",
  },
  {
    codename: "驿站·三条通信道·买鸽子·送礼回礼",
    time: "2026-07-21 15:40",
    notes: [
      "把原「马车行」(TRANSPORT)改名为「驿站」，车马传送+邮传合一。三条通信道分开：",
      "①飞鸽传书——需先在驿站买信鸽(char.pigeons，12两/只)，每寄一封耗一只，随处可用、快(距离×1)、只送信不带礼，左侧不在场者🕊按钮触发，没鸽子则拦并提示去驿站；",
      "②驿站寄书——在驿站选相识之人写信寄出，慢(脚程×1.5)、只送信、不需鸽子；",
      "③驿站送礼+信——在驿站附背包一件物+信，慢，收礼方好感够(回信后≥50)才回礼。sendPigeonLetter 泛化为 (npcName,content,{channel,gift})：pigeon消耗鸽子、postgift从背包扣礼；回信 replyPigeonLetter 现解析隐藏标记 ⟦好感X⟧(通信涨/跌好感，-3~+8)与 ⟦回礼:名|类别⟧(仅送过礼且回信后好感≥50才真回赠，品质按好感档50→白绿/70→绿蓝/90→蓝紫由系统裁决，AI只提名合身之物、makeGameItem 创建入袋)。TransportScreen 重写为驿站界面(车马/邮传两栏：买鸽子N只+收信人下拉+附礼下拉+信笺+寄出)。距离时辰、独立/共享记忆、遇遭遇不影响。esbuild 通过。",
    ],
  },
  {
    codename: "记忆系统全解读·新增说明文档",
    time: "2026-07-21 15:00",
    notes: [
      "把记忆机制逐文件读透后写成 docs/记忆系统说明.md：",
      "①厘清两套并行记忆——确定性事实账本(knowledge.js，存 varTree.世界.知识领域，随 localStorage 存档走)+向量长期记忆(src/memory，存 IndexedDB 独立)；",
      "②向量链全流程(AI吐≤50字摘要→HTTP嵌入 SiliconFlow bge-m3→IndexedDB→双路RRF融合+实体聚焦过滤+强弱分层→可见性切分→喂prompt)，全链降级优先/多Key轮询/指纹校验；",
      "③讲清'接不上免费本地小向量库'的真相——检索(B:IndexedDB+纯JS余弦/RRF)本就是本地免费手搓的，缺的是把嵌入(A)从远程HTTP换成浏览器内WASM模型(transformers.js)，那是 getEmbedding 加个 local 分支的事、代价是模型体积与推理速度，非架构接不上；给出正确接法(只换A不动B)。顺带更正阈值口径：实际 MIN_SIM=0.60/ENTITY_BYPASS=0.72(recallEngine.js为准)，旧记忆里的0.55/0.75作废。挂进 README 文档地图。",
    ],
  },
  {
    codename: "人物两段·收放·在场直接对话",
    time: "2026-07-21 14:40",
    notes: [
      "左侧「此地之人」拆成两段独立可收放：",
      "①在场（点标题▾/▸收放，随 room.npcs 每回合刷新）——去掉飞鸽键，改「💬 已在身边·对话」点了直接进 talk 模式对着此人说话（就在眼前无需飞鸽）；",
      "②曾遇·不在场（可收放）——保留🕊飞鸽键 + 好感度/态度/生气。两段各带计数（N）。peoplePanel 状态记两段收放。esbuild 通过。",
    ],
  },
  {
    codename: "自动寻路硬暂停·交互重构收尾",
    time: "2026-07-21 14:10",
    notes: "自动寻路（autoTravelTo）途中若掷中随机遭遇（encounter.js rollEncounter 命中），硬中断剩余队列：清空 pendingQueue、autoTravelRef 复位、提示「余下N程未走」，把玩家留在该据点应对，本步照常叙述这次路遇。靠 autoTravelRef 只在自动寻路时置真、出队到空自动复位——手动排队的命令不受影响（遭遇不清手动队列）。与马车行「花钱直达不触发遭遇」形成对照，保住步行的「免费但有事发生」定位。至此交互重构九条全部落定。",
  },
  {
    codename: "飞鸽传书·独立记忆+共享记忆+按距离回信",
    time: "2026-07-21 13:50",
    notes: [
      "新增飞鸽传书系统。入口：左侧「此地之人」每个人（在场+曾遇不在场）一个🕊飞鸽键→切底部 pigeon 输入模式（琥珀色，横幅显示致信人+预计时辰+取消）写信回车放飞。",
      "①回信时长按距离：玩家当前据点↔收信人「所在地」（进据点自动记 varTree.角色[名].所在地=最后见到他的据点）的 QUCUO_MAP 直线距离，折算 1–12 时辰（1时辰=2回合），到点由 [time] effect 触发 replyPigeonLetter 生成（pigeonProcessing ref 去重）。",
      "②记忆独立：每人一条信件线 varTree.角色[名].飞鸽=[{dir,content,turn}]，回信时全喂 AI，各人各记、前后连贯。",
      "③记忆共享：发信/回信都 registerFact 登进 knowledge 共享账本（标签飞鸽传书），旁白全知、传播系统可扩散。",
      "④持久化：待回队列存 varTree.世界.飞鸽待回，随存档保存、读档到点仍回。回信用收信人口吻+身世性情+好感度（越低越冷淡甚至推拒）+共享见闻，白话古文书信体。关键函数 sendPigeonLetter/replyPigeonLetter/pigeonDelayShichen。esbuild 通过。",
    ],
  },
  {
    codename: "人物面板合并·左侧统一",
    time: "2026-07-21 13:20",
    notes: "删掉右侧「人物关系」面板，内容并进左侧「此地之人」：在场者照旧（名字+简介+好感度右对齐+飞鸽/面板/立绘键），下方新增「曾遇·此刻不在场」段（= 曾经出现人物 减去 当前在场，去重）显示好感度/态度/生气状态、点名字开详情面板。人物信息只在左侧一处看全，右栏腾给背包/武学/装备/旁白。",
  },
  {
    codename: "内层地图UI·行动按钮·自动寻路·解锁门禁",
    time: "2026-07-21 12:50",
    notes: [
      "交互重构",
      "⑥⑦落地。",
      "⑦：地图框头加内/外切换；内层箱庭 SVG 可视化（读 innerMap 房间 x/y，当前所在绿框高亮）；行动按钮（内/外方向键）移入地图框左下角，点了走（派发 act(方向词) 复用既有移动，内层优先）；外层地图节点可点击→自动前往；放大弹层跟随内/外视图、两图皆可放大。",
      "⑥：qucuoMap.js 加 findPath(BFS，限已探索+已解锁节点)+isNodeUnlocked（补总纲10.5说的 resolveExit 没读 unlockCondition）；autoTravelTo 点已探明据点→取路→预填命令队列逐步走（复用出队机制，每步耗一时辰、掷遭遇/拾取）；单步方向移动也接了解锁门禁（黑风寨等未达条件不可入）。修复：插入 autoTravelTo 时误吞 handleNpcDuel 声明行致 await 失去 async 宿主，已补回。",
    ],
  },
  {
    codename: "好感度左移·名字行右对齐·实时刷新",
    time: "2026-07-21 12:10",
    notes: "NPC 好感度从右侧「人物关系」面板移到左侧「此地之人」名字那一行、右对齐显示（读 varTree.角色[名].好感度，每回合/每次变化即时重渲染）；右侧面板去掉好感度行（后续整块并入左侧）。面板/立绘按钮下沉到第二行右对齐。",
  },
  {
    codename: "运功=装备招式·按类型门控招式池",
    time: "2026-07-21 11:40",
    notes: "让「运功」（武学栏 ▶/○）真正决定上阵招式，不再是纯装饰。deriveMovesetFromSkills 从「所有 skills 都映射」改为「只上阵运功中(active)的武学」：每类(攻/防/状)最多运一门，未运功的类型用白档基础招（直拳/硬架/回气）兜底，且永远保底一个回气(0耗能)防能量枯竭无招可出（与 generateNpcMoveset 保底位对齐）。运功切换改同类型互斥+可切回：点亮一门攻击招，同为攻击的其它自动熄灭，再点取消退回基础招。被动加成暂仍与运功解耦（学了即在身，未接门控，留待定）。esbuild 通过。",
  },
  {
    codename: "拜师招统一进武学栏·固定完整招",
    time: "2026-07-21 11:10",
    notes: "NPC 拜师学到的招从「直接塞 moveset」改为并入「武学」栏统一管理，做成固定完整招——学到即完整版、不修炼不成长（无阶段/等级/经验）。新增 makeLearnedMoveSkill 把完整招式本体包成 fixed 条目；deriveMovesetFromSkills 认 fixed 条目原样取用招式本体（不做阶段缩放，区别于武馆买的可修炼武学）；拜师 handler 改 setSkills 加固定条目、去重查 skills+moveset，moveset 由 useEffect 自动重算带出。武学栏区分展示：可修炼武学显示 名字·阶段+Lv+经验条+品阶；拜师绝学显示 名字+品阶+「授」标记+「授业绝学·学即完整」。老存档旧拜师招走兼容路径仍在临阵招式栏。esbuild 通过。",
  },
  {
    codename: "武学品阶UI·临阵招式栏·告白粉感叹号·九条核实",
    time: "2026-07-21 10:40",
    notes: [
      "①武学栏补品阶 UI：makeSkillEntry 学会时带上目录 quality（此前被丢弃的死字段）、开局三脚猫拳法给白品，武学栏每门用 QUALITY_COLOR 按品阶上色+（X品）标签，运功态品阶色左边框。战斗品质仍由修炼阶段（入门→登峰造极）算，与武学本身品阶两回事。",
      "②新增「临阵招式」只读栏：显示非武学派生的招（基础补位招硬架/回气、拜师授的），带类型徽标+品阶。",
      "③告白改粉色❗徽标：删 act() 的「告白」字串分支，好感度满100由粉感叹号点击直接调 confessToNarrator。",
      "④对代码逐条 grep 核实交互重构九条真实状态：发现",
      "②③",
      "④⑤",
      "⑧（私聊分档助手/入场叙事/删localCmd打字命令/服食面板/采摘面板）在上传包里其实已实现（先前路线图照旧摘要写的、严重高估未完成量），已订正 项目状态.md 进度表。esbuild 通过。",
    ],
  },
  {
    codename: "补货59件·特效数值设计",
    time: "2026-07-21 09:00",
    notes: "把AI按《补货生成提示词》跑出的一批货录入catalog。原始69件，校验去掉10件与现有库撞名的（氆氇藏袍/雪豹裘/降魔杵/牦牛粪饼/孟记铁铺淬火油/安息香/格桑花籽/百花楼绸衣/熊山猎哨/大草甸套索，内容雷同保留旧的），净录59件，catalog 263→322件。逐件按desc气质+品阶设计特效：白绿素数值不挂、蓝挂1弱特效、紫挂1~2、橙红挂强特效或组合，共28件带effect。饰品补全线（此前可售饰品仅10件，本批补19件含红档红珊瑚耳坠）、护甲补高阶（橙红：蜀锦软甲/百炼锁子甲/明光铠改制/犀牛皮重甲/天竺金丝软甲）、武器补紫橙（百炼苗刀/陨铁刀/虎骨猎叉/天竺弯刀等）。特效示例：天竺弯刀forceCrit+afterCounterBonus、明光铠immuneControl+partialImmune+rebirthOnce、虎骨猎叉ignoreDefense+lowHpBonus、九眼天珠forceFirst、贡措海蟒皮护腰applyMarkOnHit三件套。全部字段经resolveTurn.js核准真读，59件过makeCatalogItem生成校验通过（数值由statsForQuality系统裁决，AI只提议不写数值），esbuild通过。带effect总数73→101。",
  },
  {
    codename: "百物入库·100件食品药品录入",
    time: "2026-07-21 07:30",
    notes: "消耗品系统五步计划收官（第5步）。把《食品药品设计·50药50食》的 100 件（药品48+食品52，扣掉占位）录入 catalog.js 的 SUNDRIES，catalog 163→263 件。用数据表驱动的 Python 脚本誊录生成 JS entry，自动去重、与现有物件零撞名。字段严格按 useConsumable 已支持清单映射（hpRestore/energyRestore/dispel/dispelAll/rebirthOnce/sixDimTemp/combatBuff/hpRestoreOverTime），C 档按第4步规则降级落地：涂抹武器（毒蝎粉/雪盲药水）砍掉涂抹效果改纯回血、跳回合回满（安魂香）→hpRestore:1.0 即时回满、全队席面（土司府宴/百花全羊席）降级只对自己、狂战丸→战前餐 combatBuff。占位项（青稞酒/桂花糖/醒神丹/涅槃引/雪山当归/老孙糌粑/狼骨青稞酒）跳过未重录；新增「雪山当归丸」是另一味蓝品阶回血药、与已在库「雪山当归」不撞名。单测：新药经 CATALOG_INDEX 可查、useConsumable 正确分档处理（回血/解异常引导/临时六维/战前餐/回满/降级），esbuild 校验通过。至此消耗品系统从设计→道具栏→探索态用物→buffSystem→C档砍降→100件录入全链闭环。遗留衔接：这批新品的店铺铺货属交接任务7（qucuoShops 修bug+充实商品池），不在本计划内。",
  },
  {
    codename: "buff接线·临时增益+战前餐+C档砍降",
    time: "2026-07-21 06:30",
    notes: [
      "消耗品系统第 3、4 步落地，buffSystem 从「只写不读的死 buff」正式接通。",
      "①【关键修复】此前 handleServiceOrder（饭馆点菜）早已用 makeBuffFlag 写 buff flag，但 parseActiveBuffs 全项目零调用、读取端从未接通——buff 挂了不生效。第3步补读取/应用端：MudRPG effectiveSpecialNow=applyBuffsToSpecial(char.special,flags,time)，char/flags/time 任一变即重算，状态面板显示「基础→有效」及每条 buff 剩余回合；监听 time 的 useEffect 每回合 cleanExpiredBuffs 清过期（只清 buff_ 开头、剧情 flag 保留）。计时基准一律用 time（项目无 turnCount）。",
      "②【战斗态】DuelScreen 的 playerChar 现在收到 {...char,special:effectiveSpecialNow}，七维 buff 战斗中自动生效。",
      "③【战前餐】新增 pendingCombatBuff prop，进场 resolveCombatBuff 应用：起手气血按 hpBonusRatio 抬高本场上限、起手真气+energyBonus、外功+waigong（当临时外功点数叠进 atkFromWaigong）、攻击招式倍率+moveMul；第1回合顶部显示药力提示；onFinish 无论胜负清除 pendingCombatBuff。",
      "④【探索态吃B档】useConsumable 补 sixDimTemp（写 buff flag 默认持续30时辰）、combatBuff（存 pendingCombatBuff 可叠）、hpRestoreOverTime（探索态无逐回合结算→降级即时回一笔 ratio×turns）。",
      "⑤【第4步砍降C档】useConsumable 降级兜底：跳回合回满 skipTurnsHeal→即时回满血、全队 teamBuff→降级只对自己、涂抹武器 weaponCoat→砍掉静默忽略不报错。buffSystem 读写闭环 + B/C 档单测全过。下一步（第5步·唯一剩余）：把100件食品药品录入 catalog，字段只用已支持的那批。",
    ],
  },
  {
    codename: "消耗品接线·战斗内道具栏+探索态服用",
    time: "2026-07-21 05:10",
    notes: [
      "消耗品系统五步计划第 1、2 步落地。",
      "①【战斗内道具栏】DuelScreen 切磋界面 select 阶段新增「⊙ 用道具」入口，列出背包里战斗内可用的消耗品（只列 A 档即时救命：回血 hpRestore / 回气 energyRestore / 解异常 dispel / 假死保命 rebirthOnce；B 档不列免得白费回合）。服药=消耗玩家本回合行动：handleUseItem 把药效构造成临时「疗伤型」状态招（type=STATUS、energyCost=0），走与出招完全相同的 handleSelectMove 结算——服药这回合 NPC 照常出招、净值决定续航，复用既有「疗伤」家族博弈设计，无新增分支。假死保命用独立 ref 记本场续命一次（与装备版涅槃引各自独立可叠）。onFinish 新增第五参 usedItems，MudRPG 从背包按名逐件扣（无论胜负/撤退都扣）。",
      "②【探索态用物品总闸】catalog.js 新增 useConsumable(consumable, char) 纯函数（数值算死、AI 不参与）：探索态只认 hpRestore（按最大血比例回、夹上限、血满拒服），energyRestore/dispel/rebirthOnce 是纯战斗内机制、探索态引导去战斗中用，sixDimTemp 等 B 档返回「待实装」（第3步做）。MudRPG 在 localCmd 后拦截「用/服/吃/喝/嗑 <物品名>」，背包精确匹配到一件消耗品才处理（对象带 consumable / 字符串走 CATALOG_INDEX 兜底），应用回血→扣背包→推进回合；没匹配到的放行给 AI 叙事不误伤。useConsumable 九分支单测通过。下一步：接 buffSystem（B档临时增益，计时用 time 不是 turnCount）。",
    ],
  },
  {
    codename: "四字雅名·全员专属招·三只野兽",
    time: "2026-07-20 16:20",
    notes: [
      "①【蓝袍以上招式统一四字雅名】重写 npcSignatureMoves.js，全体 levelCap≥2 驻场NPC + 行脚僧/来访武者，攻/防/状三槽一律标准四字招名（取自百招名池、按攻击/防御/擒拿点穴分类对号），回气槽各人贴身份雅名（端坐纳息/望湖养息/踏雪凝息…）；绿白档保留朴拙。此前批次给柳青鸢/巴桑/罗琦/梵衍那/梅朵配的招式名，本轮按四字规矩统一重命名覆盖（fullBio 未动）。效果仍由原型×品阶自动算。",
      "②【三只野兽·招式不可学】虎王(红5·熊山温泉)、狼王(橙4·大草甸草甸深处·咬死管家独子那头)、白猿(橙4·雪山崖底)，兽性招名，unlearnable=true 拜师被拒。按 residentNpcs.js 顶峰/大草甸 组 + innerMap.js 房间 residentNpcName 绑定固定落位。",
      "③【白猿·不能说话可养好感】cannotSpeak=true：对话被拦（歪头低吼、听不懂人话），但可投喂（赠礼走既有好感度通道）日久亲近；affectionable=true。踞守呼延大侠殒命的崖底暗河潭，需绝顶跳崖（外功或内功≥85）才能抵达，与雪山派旧伤呼应。",
      "④【顺带修潜在bug】toRoomNpc 只保留 id/name/brief，会把驻场/野兽NPC 显式 levelCap 和 beast/unlearnable/cannotSpeak 剥掉→品阶被关键词猜测覆盖（此前设的驻场档位隐性失效）；toRoomNpcWithCombat 现补回这些字段、显式 levelCap 优先，驻场档位真正生效。",
      "⑤野兽不可学、平民(levelCap<1)无武艺可传。",
    ],
  },
  {
    codename: "核心人物fullBio与武学·首批",
    time: "2026-07-20 16:05",
    notes: "给五个派系核心人物补齐 fullBio（总纲原文整合，非概括）+ 专属武学（原型×品阶自动配特效）：柳青鸢(红5·锦官城都事，寻人执念/土司怕她/终局任命梅朵，武学=问牍趁虚·留有余地听桥·拿捏封穴)、巴桑(橙4·黑风寨义匪首领，牦牛抵税逼死父亲/寨规三不抢/顺手护送老乡，武学=开山硬攻·挡刀防反·喝阵致乱)、罗琦(橙4·欢喜教圣女实际管事，茶里下药剂量精准/与兰姐区分，武学=拈香趁虚·曼舞防反·迷魂香施毒)、梵衍那(紫3·欢喜教主天竺流亡王子，攒钱回乡/与都事失踪上司线索交集，武学=梵指·入定·天竺梵音致乱)、梅朵(紫3·土司之女父女道德对照，撕渗透信/骑马冲后山/欠管家一份歉，武学=策马式硬攻·护乡防反·屏息蓄势)。至此驻场专属武学 10/24 人。剩余14人（何雨谢/呼延雪/兰姐/管家/丹增/扎西/老何 + 绿档平民等）待下批。",
  },
  {
    codename: "无限拜师·敌招迷雾·战斗面板上下重构",
    time: "2026-07-20 15:40",
    notes: [
      "三件事。",
      "①【无限拜师】重做 handleNpcLearnSkill：不再卡在只有老猎户一条的 NPC_TEACHABLE_SKILLS 硬编码表上，改为任何有武艺的NPC（levelCap≥1）好感度≥40 即可把",
      "【自己的专属招式】传授给玩家（专属出招表优先、没有则用其品阶生成招式；回气不传）。学到的招含教习者品阶档位的全套特效，威力仍按玩家自己的外功内功结算——学到技法，内力自修。无数量上限、按招式id去重、越学越多，标记 learnedFromMaster 不被武学重算覆盖、赢战后持久化回存档。",
      "②【敌招迷雾】切磋中对方招式初始全为'？未知'，只有被使用过才揭示；揭示后可点开",
      "【详细察看】看到招式类型/耗能/全部机制说明/描述。玩家自己的招式按钮也加了ⓘ察看入口。",
      "③【战斗面板上下重构】参照building的上下分栏：顶部保留双方血条+能量点（血/气），中段上半为操作区（招式按钮网格，无限招式可滚动 + 敌招迷雾条），下半为MUD式结算日志（可滚动、自动到底）——每回合写清'你使X、对方使Y、谁占上风、克制/被防住的过程、双方受创数值、余下能量'。移除旧的居中单回合BattleReport。",
    ],
  },
  {
    codename: "战力统一与招式特效随品阶",
    time: "2026-07-20 15:10",
    notes: [
      "战斗系统大重构，三件事。",
      "①【玩家NPC战力统一】此前玩家baseAtk恒20、气血恒100、从不随修为上档，而NPC baseAtk按4.5/档指数到33257——两者根本不在一条战力梯子上，满配玩家被中档NPC一击秒。现在攻击力统一由外功决定 atkFromWaigong(外功)=18×R^(外功/20)、气血由内功决定 hpFromNeigong，玩家和NPC走同一套函数（R=20^(1/5)，与equipment.js的QUALITY_RATIO同源，白→红全程20倍）。getTierPower的4.5删除。玩家内功+1时气血上限同步抬高。同时移除calcBaseDamage里的waigongCoef/neigongCoef（外功内功已进baseAtk/气血，否则各顶两遍伤害爆炸）。实测满配玩家vs红档桑杰朵杰稳定6-9回合，同时白袍新手vs红档仍是必死（红是墙、练上去才能平视）。",
      "②【招式特效随品阶变浓、因人而异】新增combat/moveArchetypes.js招式原型系统：同一原型（防守反击/硬攻/趁虚/致乱/封穴/蓄势/施毒）的特效随levelCap逐档解锁，红名听桥=近乎全免+满反打+抢先+应对失败重罚，平民听桥=挡一下+小反打。npcSignatureMoves.js改为每槽声明'原型+专属名'，效果由原型×品阶自动算。",
      "③复活一批死flag：forceFirst/ignoreDefense/nullifyStatusOnHit/onCounterFail两项/onCounterSuccessPreemptive真抢先/freezeEnergyRecovery真冻气/nextAttackBonus真蓄势/permanentCostReductionOnUse/lowEnemyEnergyBonus/afterCounterBonus/enemyCostPenalty封穴/applyStatus通用状态施加。",
      "④【防御不能连用两回合】玩家防御按钮置灰+NPC决策清零防御权重；防御被状态克穿也会门户大开一回合。跨回合状态（应对记忆/蓄势/封穴耗气/冻气/防御失效）在DuelScreen线程化传递。",
    ],
  },
  {
    codename: "每人专属出招表",
    time: "2026-07-20 14:30",
    notes: "新增 src/npcSignatureMoves.js（NPC专属招式表）：每个登记的NPC四个槽位（攻击/防御/状态/回气）用自己独立的招式名，不再共用MOVE_POOL的通用名（此前所有白档都叫直拳、红档都叫一剑西来）。品阶只决定数值/效果（继承对应levelCap档位的MOVE_POOL模板），名字/描述专属。npcGeneration.js 新增 deriveSignatureMoveset 并接入 ensureNpcCombatData（有专属表用专属、没有则回退随机品质老逻辑，博弈层招式照常追加）。首批基调样例9人：桑杰朵杰/行脚僧(红)、格桑顿珠/喇嘛庙住持/达摩药堂师父(橙)、嘎则(紫)、来访武者(蓝)、老猎户(绿)。同步简化 quests/learnSkill.js：去掉拜师任务门槛，纯好感度≥40即可学。",
  },
  {
    codename: "地图拓扑修正",
    time: "2026-07-19 20:45",
    notes: "鱼定村正南改接大草甸（原来直连玉泉寨，一步到达感太强），大草甸分叉东→天都镇、南→玉泉寨→东→贡措海；顺带修复一个更底层的bug：开局房间名一直带'曲措乡·'前缀，但地图数据的key是裸名，导致每局游戏的第一步移动完全脱离固定地图裁决（resolveExit查不到就静默放弃锁定，AI可以凭空编一个不存在的地名，实测编出过'狼曲河谷'），现在开局房间名统一成裸名，和其余12个据点一致",
  },
  {
    codename: "切磋确认流程",
    time: "2026-07-19 20:15",
    notes: "点'切磋'不再直接弹战斗界面：先跑一次AI叙事描述邀战/摆开架势的过程，跑完之后显示'确认切磋/算了'的确认条，点确认才真正进入DuelScreen——中间留一步反悔的余地",
  },
  {
    codename: "修炼与战力分层",
    time: "2026-07-19 19:45",
    notes: "新增潜能驱动的内外功修炼（工具栏'运气·内功+1'/'拆招·外功+1'按钮，每点消耗潜能=4+当前值/10取整，随等级递增），切磋获胜/完成任务保底发放潜能，AI不再能直接修改neigong/waigong数值（只能发潜能）；伤害公式改为(基础攻击力+装备攻击力)×招式倍率×外功系数×内功系数×力量系数，装备攻击力第一次真正接入战斗结算（之前只在侧栏显示）；NPC按品质档位（白绿蓝紫橙红）分配基础攻击力和气血上限，每档约20倍综合战力增长，AI生成的普通NPC和剧情具名NPC统一走同一套品质判定",
  },
  {
    codename: "建筑UI统一 + 地点系统加固",
    time: "2026-07-19 19:00",
    notes: "建筑/交易交互统一改成居中列'上（功能按钮）/中（复用现有叙事日志）/下（输入框）'三段式布局，不再是弹窗或侧栏面板；修复NPC'一会好几个人一会都走光'的问题（非移动回合不再让AI的npcs字段覆盖已有在场人物，只通过每日游走刷新/人物涌现/玩家动作改变名单）；修复自由文本移动指令（没有明确方向词）完全绕过地图裁决、导致叙事和小地图状态对不上的问题；修复护镖任务接取后目标NPC不保证当天在目的地出现、导致任务随机卡死无法交货的问题",
  },
  {
    codename: "按字数控制",
    time: "2026-07-07 15:05",
    notes: "输出长度改为直接按目标汉字数设置（默认900字），不再是token数反推的粗略档位；maxTokens变成自动换算的安全上限（字数×2.2+300）；旧配置自动迁移不会跳变",
  },
  {
    codename: "字号与防截断",
    time: "2026-07-07 14:45",
    notes: "设置面板新增全局字号滑块（70%-160%，zoom实现）；顶部工具栏加flexWrap避免按钮被挤出视口；加固存档兼容性校验，room结构也纳入检查（之前只查char），修复黑屏问题",
  },
  {
    codename: "预设置顶",
    time: "2026-07-07 14:20",
    notes: "预设选择/新建/导入/导出移到设置面板最上方常驻工具栏（参照酒馆布局），不用先点进标签页才能找到导入按钮；PresetManager拆分出PresetToolbar",
  },
  {
    codename: "外貌锚点",
    time: "2026-07-07 14:00",
    notes: "6个NPC补充外貌描述，按反差点/身份标记物/动态细节/地域气候细节四类锚点设计，供AI叙事时反复引用而非每次重新编造",
  },
  {
    codename: "留白与墨色",
    time: "2026-07-07 13:40",
    notes: "参考《捉刀》美学方向做UI重构：新增按地理分区动态切换的六套主题色（theme.js），字体从等宽代码字体改宋体，分隔线改水墨渐变，全面加大留白间距，不引入任何图片素材",
  },
  {
    codename: "四件套",
    time: "2026-07-07 13:00",
    notes: "曲措乡改为固定拓扑地图（13个据点，AI只负责描述不负责决定去哪）；完整兼容酒馆Chat Completion预设格式（导入/导出/拖拽排序/单条开关编辑）；文体铁律并入可编辑预设；去掉天道/江湖风声/地上，改为立绘展示区（旁白/主角/NPC，支持导入9:16图片）",
  },
  {
    codename: "地图预告",
    time: "2026-07-07 12:00",
    notes: "去掉顶部出口按钮（避免和输入框移动重复），只保留文字输入移动；小地图/大地图新增未探索方向预告——当前房间的出口如果还没去过，会用虚线连到一个模糊的问号节点",
  },
  {
    codename: "品阶系统落地",
    time: "2026-07-07 11:30",
    notes: "装备品阶系统正式接入代码：指数曲线(ratio≈1.82)自动计算武器/护甲/饰品数值，makeItem强制走系统公式不信任AI给的数值，scenario加入掉落贴合人设规则，右侧面板显示装备总加成，查看物品支持结合真实品质数值生成介绍",
  },
  {
    codename: "装备与拾取",
    time: "2026-07-07 11:00",
    notes: "装备栏改为武器/护甲/饰品三分类无限格数系统；新增路上随机拾取（35%概率触发，品质由气运驱动的线性插值概率表决定，AI只负责命名不决定掉率）；鼓励物品与场景/NPC自然语言互动",
  },
  {
    codename: "React导入修复",
    time: "2026-07-07 10:35",
    notes: "四个jsx文件补上显式 import React，兼容经典JSX转换模式，修复某些环境下 React is not defined 导致的黑屏",
  },
  {
    codename: "顺序修复",
    time: "2026-07-07 10:25",
    notes: "修复 giftToCharacter 定义在 act 之前导致的 ReferenceError（暂时性死区问题），黑屏 bug",
  },
  {
    codename: "流式输出",
    time: "2026-07-07 10:10",
    notes: "新增流式输出开关（Anthropic/OpenAI兼容），边生成边显示；新增JSON容错清洗，减少解析失败；技术细节参考「凡人歪传」项目",
  },
  {
    codename: "角色去重",
    time: "2026-07-07 09:35",
    notes: "修复「鱼定土司之女」与「梅朵」重复设定的问题，合并为同一人（梅朵=鱼定土司之女），角色总数从7个减为6个，好感度60里程碑融入父女关系线索",
  },
  {
    codename: "人物关系页",
    time: "2026-07-07 09:20",
    notes: "新增人物关系页面（卡片网格+详情弹窗），只展示已登场角色；7个角色的30/60好感度手写里程碑剧情；送礼功能接入主引擎叙事流程",
  },
  {
    codename: "存档修复",
    time: "2026-07-06 11:00",
    notes: "修复 buildSnapshot 遗漏 varTree 字段导致人物好感度数据无法持久化的 bug；顶部新增独立「💾 存档」入口；进度恢复时明确提示；JSON解析失败时保留原始内容便于排查；查看物品/武学介绍不再被硬编码字数截断",
  },
  {
    codename: "全知旁白",
    time: "2026-07-06 10:35",
    notes: "重写旁白架构：从「叙事/对话双人格分离」改为「单一全知旁白，好感度只调文风」；私聊共享主引擎对话历史，不再失忆；叙事输出文风也随好感度渗透",
  },
  {
    codename: "篇幅设置",
    time: "2026-07-06 10:05",
    notes: "设置面板新增「每次叙事输出长度」滑块与预设档位（简短/适中/详细/长篇），system prompt 里的字数指令随之动态调整，不再和用户设置打架",
  },
  {
    codename: "并行私聊",
    time: "2026-07-06 09:40",
    notes: "对话模式与私聊旁白支持真正并行（可连续发送多条不用等），行动模式仍需排队保证世界状态一致；好感度变化在日志里显式提示",
  },
  {
    codename: "自动检测",
    time: "2026-07-06 09:15",
    notes: "新增自动检测模型按钮（OpenAI兼容/Gemini真实探测，Anthropic静态清单），修复旧存档结构崩溃问题",
  },
  {
    codename: "打坐",
    time: "2026-07-06 08:45",
    notes: "三态交互模式（行动/对话/私聊旁白）+ 打坐恢复气血内力，对话模式不消耗回合",
  },
  {
    codename: "根骨悟性",
    time: "2026-07-06 08:20",
    notes: "角色数据结构重构：精简状态栏，新增内功/外功/七维属性，武学与包袱可点击查看AI介绍",
  },
  {
    codename: "私聊模式",
    time: "2026-07-06 07:55",
    notes: "旁白触发方式从正则前缀改为独立切换按钮，修复endpoint格式提示",
  },
  {
    codename: "变量树",
    time: "2026-07-06 07:20",
    notes: "MVU 风格动态角色好感度系统，替代硬编码NPC名录；曲措乡五名新角色人设入库",
  },
  {
    codename: "存档与设置",
    time: "2026-07-06 06:30",
    notes: "自动存档+手动多槽位、折叠式日志、API设置面板（支持Anthropic/OpenAI兼容/Gemini）",
  },
  {
    codename: "曲措乡",
    time: "2026-07-06 05:40",
    notes: "曲措乡预设剧本接入引擎，旁白攻略系统（黑客帝国支线）首个可运行版本",
  },
];

export const CURRENT_VERSION = VERSION_HISTORY[0];

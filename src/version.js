// 版本历史：每次迭代给一个代号 + 时间戳，方便区分不同版本的构建
// 新版本加在数组最前面，CURRENT 始终指向最新一条

export const VERSION_HISTORY = [
  {
    codename: "私聊旁白接入行动分层日志(trace)",
    time: "2026-07-24 07:32",
    notes: "talkToNarrator(右栏「◆私聊旁白」)此前完全不进「🧭行动全流程日志」——底层 callModel/callModelStream 其实早就把每次调用的完整 prompt/回复记进了 pipelineLog，但没有一条 trace 把它挂出来，面板里私聊旁白全程留白，出问题(答非所问/召回没生效)时无从排查。按 act() 的既有用法补齐：①函数开局 startTrace，含 CRASHED 早退分支也归档(不再是\"开了不收\")；②逐阶段 traceStep——意图(私聊·不消耗回合)、旁白崩溃状态拦截、全知事实账本注入(有/无区分pass/skip)、向量召回(开关关闭/召回为空/命中N条三态)、AI调用(流式/非流式分别标注)；③attachPipeline(_wt, getPipelineLog()[0])在流式与非流式分支各自紧跟调用点挂上，失败分支同样挂(带错误信息)；④endTrace收尾摘要带回复前30字预览+好感度增量，一眼看出这次私聊聊了什么、好感怎么变；catch块补上fail态traceStep+attachPipeline+endTrace，不再是私聊报错却在trace系统里查无此事。不消耗回合这件事本身不变——trace只是留痕，不代表计入时间。TraceViewer渲染逻辑本就通用(纯遍历steps+可选pipeline展开)，UI侧零改动即可正确展示。esbuild验证通过。",
  },
  {
    codename: "玩家预制头像换新(唐卡厚涂8连图)",
    time: "2026-07-24 07:23",
    notes: "右栏「侠客」面板的玩家预制头像整批换新。素材来源：用户给的一张2行4列8宫格唐卡高饱和厚涂风格插画(藏地高原背景+金色描边分割)，按等分硬切成8张干净的2:3竖版单人头像(边缘各收4px去毛刺，统一放大到720×1080)。分配：male=藏剑大叔、female=花商、other=朔风独行刀客(默认兜底款)、preset1~5=飞贼/猎手/猫人/假小子/穿越者。代码改动两处：①头像选择器候选数组从原来硬编码的 preset1~4(4档)扩到 preset1~5(5档)，把7张非默认款全部纳入可选；②头像展示框与选择器候选格的 aspectRatio 从旧的 9:16 改成 2:3，匹配新素材实际比例(NPC对话立绘走另一套9:16系统，未动)。同步更新 public/portraits/player/README.md 与相关代码注释，反映当前8张头像的实际内容和来源。esbuild 验证 MudRPG.jsx 语法与依赖解析通过；vite build 本身因仓库缺 debug.html/debug-gamble.html/debug-item.html 三个调试入口文件而失败，与本次改动无关(属仓库既存缺口，入口对应的 debug-*.jsx 源文件都在，只是页面壳文件没推上来)。",
  },
  {
    codename: "《天都·曲措》发布版(GitHub Pages上线+藏地UI整套)",
    time: "2026-07-24 13:00",
    notes: "项目正式起名《天都·曲措》并上线 GitHub Pages 在线试玩(feihu-lgtm.github.io/qucuo)。本轮以工程化上线+藏地视觉整套为主，逐项：①部署——vite.config 加 base(DEPLOY_BASE 控制，Pages 用 /qucuo/)，新增 vite.config.pages.js(只打包主入口)与 .github/workflows/deploy.yml(push main 自动构建部署)，.gitignore 忽略 dist(Actions 重建)。②CORS——apiConfig 给 Anthropic 两处 fetch(非流式+流式)加 anthropic-dangerous-direct-browser-access 头，使浏览器可直连；核实 Gemini generateContent 与 OpenAI 兼容本就放行；withProxy 非 localhost 且无自定义代理时直连；设置面板保留 corsProxy 兜底。③地图 UI——九宫格 NineGridMap 接入藏地三态贴图(idle 石板/current 翡翠/fog 黑雾，stones/mapui/)，去掉方向字与 boxShadow 光晕(消竖线)、三态统一 cellStyle;放大 topo 图 ClickableMap 重写：节点 rect 换 image 三态贴图、加 pan(拖动平移,防误触3px阈值)+zoom(滚轮0.4~3x+按钮±/复位)，连线改金棕配卷轴;卷轴底 scroll_bg 从原图重抠假透明、清 77 毛边像素;删内层九宫格下方冗余的出据点按钮(出村统一走外层视图,已核实外层 forceLayer:outer 路径独立完整)。④开始界面——StartScreen 用隶书白字标题 title_tianducuo_v3(去假透明+抹印章+黑字染白)压雪山背景 start-bg，左对齐布局，菜单开始/加载/设置/退出;曾试藏式木牌皮后按需回退纯 CSS。⑤设置面板——SettingsPanel 从长条 tab 改主页卡片式(API/预设/存档/其他四卡，点进次级面板带返回);API 类型只留 OpenAI 兼容(删 Anthropic/Gemini/千问按钮+快速填入,挂载时强制纠正旧配置 apiType=openai);删金手指/玩法说明 tab,字号移入其他。⑥favicon——藏式雪山+祥云+经幡圆徽多尺寸(32/180/512/ico),index.html 标题改天都·曲措。⑦README 顶部加封面(黑字 v2,配 GitHub 白底)+在线试玩/源码互链。藏文 མགར་ཆུ་གནམ་མཚོ 中 chu(河)gnam(天)mtsho(湖)三词根经真实地名(那曲/纳木措)核实,开头 gar(白)无查证依据、四词连写语法待母语者校对——已在 notes 与美术存档标注,上线前需人工核。多次 vite build 通过。",
  },
  {
    codename: "文档同步(记忆系统闭环+存档IDB全线更新)",
    time: "2026-07-22 19:40",
    notes: "把本轮记忆系统闭环+存档迁IDB的改动同步进各 md（无代码逻辑改动）。①交接_借鉴总结系统.md：标题/一分钟现状从\"实现待开工\"改为\"主体已实现\"；第4节 8条TODO逐条标状态(1/2/3/5/6/7/8 done、4缓做)+2.5六条现状+本轮额外落地(私有门/AI小总结/对账/回滚确认)+剩余待做；索引加流程总表、下一步改为已闭环。②项目状态.md：已完成段新增\"记忆系统(主体闭环)\"与\"存档(迁IDB)\"两块，知识系统补0.35/40回合参数、主循环补两阶段回滚。③README.md：自动存档 localStorage→IndexedDB直写缓存、查看介绍改为worldLook走主叙事+1时间+写小纸条(商店预览不变)、文档地图加记忆与正文流程总表.md。④记忆系统说明.md：顶部加2026-07-22大更新横幅(统一writeNote/owner三态/四来源/私有门/日总结/AI小总结/对账/存档IDB)，标注下方原文哪几处以横幅为准。⑤文件树.md：memory段补 note.js/daySummary.js、更新 memoryWrite(垫片)/recallWithVisibility(私有门)/saves.js(IDB)注释。⑥记忆与总结设计.md：顶部加\"主体已落地\"指引。vite build 通过。",
  },
  {
    codename: "召回前对账(指纹漂移自愈)+确认act两阶段回滚已完整",
    time: "2026-07-22 19:10",
    notes: "对照参考项目 pipeline.js 的两条机制收尾。一、act 提交出错的快照回滚：核实后确认本就已做且完整——act 在发送前(1842)把 room/char/dao/skills/inv/exp/pot/flags/mapData/time/varTree/convo 打包成 rollback 快照，try 体内任何一步抛错即在 catch(2308) 整体还原，log 保留错误行不回滚。唯一在 act 之外的 setClaimedMilestones 属另一函数 claimMilestone、不在 act 事务内，无回滚缺口。故不改。二、召回前对账：参考项目对着 summaryHistory 清单做删孤补缺，但我们的小纸条自带向量、无单独清单，不存在孤儿；真正对应物是换 embedding 模型后老纸条 fingerprint 过期、被 recall 的 m.fingerprint===fp 过滤掉、永久召不回只占库。故实现 findStaleNotes(纯，挑有文本但指纹不符者)+reembedStaleNotes({cfg,maxPerRun=3})(有界重算向量写回、同 id 覆盖、绝不删只重嵌，宁可暂时召不回也不丢记忆)。在 act 召回块开头 fire-and-forget 触发，逐回合把库里过期纸条慢慢补齐、不阻塞本轮时序。debug.mjs note 节加指纹筛选单测，全过；vite build 通过。",
  },
  {
    codename: "存档迁IndexedDB(直写缓存)+飞鸽切磋改AI小总结",
    time: "2026-07-22 18:30",
    notes: "两件。一、飞鸽/切磋的事实摘要不再系统拼模板，改走 AI 小总结：新增 aiSummarizeFact(factId,cue) 助手，注册事实时先塞一句结构化线索兜底、随即 fire-and-forget 叫 AI(factSummaryRequest)写成白话古文小总结覆盖(AI关了就留结构化兜底、不再是死模板)。切磋结算、飞鸽发信、飞鸽回信三处接入(发信/回信的 cue 带上信文大意)。二、存档从 localStorage(约5MB易撑破)迁到 IndexedDB。学参考项目 storage-service.js 的 Write-Through Cache：内存 _cache 作同步读来源，启动 main.jsx 先 await saves.init() 一次把 IDB 全量灌进缓存，此后 loadAutoSave/loadSlot/listSlots 全部同步读缓存——故 MudRPG 的同步 useState 初始化、SettingsPanel 的同步槽位渲染一律不用改(先前误做的\"全异步+父层传restoredSnapshot prop\"已收回)。写：同步写 _cache + 异步 fire-and-forget 写 IDB + 尽力同步写 localStorage(关页兜底，超额跳过)。IDB 不可用自动降级纯 localStorage。迁移：init 时 IDB 空则从旧 localStorage 键迁入，旧档保留不删作安全兜底；autoSave 顺带写 LS，init 取 IDB 与 LS 较新者(治 IDB 异步写关页来不及落盘)。写入一律 structuredClone 断共享引用防串台。槽位 id 加随机后缀防同毫秒撞。node 降级路径快测全绿(autoSave/槽位增删改查/倒序)；vite build 通过。IDB 主路径逻辑同构，需在真浏览器点一遍(新开局/读档/刷新续档/手动存读删)确认。",
  },
  {
    codename: "记忆系统三件套(私有召回门+日总结+远景注入)",
    time: "2026-07-22 17:15",
    notes: "接着小纸条地基往下推三件。①私有召回门：owner 三态的兑现——recallWithVisibility 加 presentNames 参数，owner 非空的私有/共同目击条只在 owner 里至少一人此刻在场时才浮现，公共条恒过、旧 flag 私有走 flag。逻辑抽成 note.js 的纯函数 noteVisibleTo(可单测)。三处调用传在场人：主 act 传 room.npcs+对话对象 talkTarget；私聊旁白传[旁白]（旁白私有条浮现、NPC私有条不漏）；知识账本补摘要那处默认[]（私有条本不该喂公共传闻，正好挡掉）。②日总结（大纸条）：新建 memory/daySummary.js(纯函数 buildDaySummaryRequest/appendDaySummary/buildDistantViewBlock，MAX14天丢最老)。MudRPG 加 dayMaterialRef 攒当日原料(jotNote 与 act 的 p.memory 都推入、与embedding无关)，prevDayRef+useEffect 侦测跨天(floor(time/24)增长)后台 summarizeDay 归纳存 varTree.世界.日总结，fire-and-forget失败静默。apiConfig 加 daySummary token 上限默认2000。③远景注入：buildDistantViewBlock 取最近5条日总结拼成远景块，注入 userContent 的 ctx 之后、recallBlock 之前(背景层=较弱位，只保连贯不喧宾夺主)。debug.mjs note 节加私有门单测、新增 daysum 节，全过；vite build 通过。账本owner化(内容并入小纸条)暂不做——账本内容同步供 buildInfoDomainBlock、小纸条在IDB异步，并入会逼同步链改异步，得不偿失且非硬需求，留待有token压力时再收拾。",
  },
  {
    codename: "小纸条六来源接线(2.5六条硬需求)",
    time: "2026-07-22 16:20",
    notes: "把交接文档2.5的六条硬需求全部落地——都是给统一 writeNote 传不同 owner/source。新增稳定助手 jotNote(latest-ref模式，定义在 addLog 之后、早于所有使用者，避免 deps 数组 TDZ；用 ref 兜最新 cfg/回合/地点/名单，故本身 deps 空、恒稳)。逐条：①look查看走主叙事——inspectItem 加 worldLook 档，玩家端详自己背包/武学时算1回合时间+写公共小纸条+不吃缓存(商店预览等默认不传 opts，仍瞬时缓存不耗回合)；背包/武学三处点击传 worldLook:true。②飞鸽正文+私有条——sendPigeonLetter/replyPigeonLetter 在全文线之外各额外 jotNote 一张 owner=对方 的私有小纸条(source=pigeon)。③哑动作系统自写电报体——打坐/练内功/练外功/买/卖(6处交易内联handler) 各 jotNote 一句 source=dumb 公共条。④对话/私聊你俩私有——act 向量写入去掉!isTalk拦截、按模式定owner(行动=公共owner空，对话=私有owner对话对象talkTarget)；知识账本同步隔离：对话模式只让 talkTarget 一人亲历入账(标签私语)、不摊给同屋外人，行动模式才在场共同目击；私聊旁白 talkToNarrator 额外产 owner=旁白 的私有条(source=whisper)。⑤900字上一版已做。⑥出处现状已被①-④打破。清理：MudRPG 不再 import recordMemory(其唯一调用已换成 writeNote，memoryWrite.js 薄垫片文件留存未删)。注：内层移动本就走 act() 主叙事(AI叙事+走主路径写条)，不另作哑动作补记，避免双记。vite build 通过、note 纯逻辑单测通过。私有召回门(按在场人过滤owner)/日总结/账本内容并入小纸条 仍是后续TODO。",
  },
  {
    codename: "感叹号任务节点重做(拆框+仪式行+叙事强位铁律)",
    time: "2026-07-22 15:10",
    notes: "围绕点感叹号的一整套体验改造，五处。①UI拆框：原来❢触发节点和分支「行动选项」全挤在同一个金色框里没区分度，现拆成上下两个独立框——「❢ 此处可推进」(金色，纯推进节点点一下即走)与「◈ 行动抉择」(绿色，分支任务的选项按钮)，配色+标签分开，天然两行。②点❢的仪式行：triggerQuestFromPanel 与 triggerQuestChoice 袖手分支在调 act 之前先 addLog 一句金色「❖ 任务开启/推进 「标题」」+ 暗色「〔详情可查任务面板〕」提示(新增 quest 金色日志类型)，让点一下推进这件事有郑重落点、并引导去任务面板看详情。③选项与叙事先后卡一下：p.choices 从与叙事同帧渲染改为 setTimeout 650ms 延后浮现，先读剧情后给抉择，不糊在一起。④完整句成文铁律：新增「成文铁律·逐段自查」——每段句子须主谓宾定状补齐全、无残句掐头去尾，涉及的时间/地点/人物/起因/经过/结果须交代到实处、不许用『那人』『某处』含糊带过。⑤该铁律放到插入深度最低的强位：查证酒馆 prompt-manager 语义(Depth 0=提示末尾=最强)，把这条铁律拼在 userContent 的 hist 之后、cmdSuffix 之前(user块最末尾、贴生成处)，而非埋在 system 里被当耳旁风。另 forcedEvent 情节篇幅上一版已随 targetWordCount 拉到900线。vite build 通过。",
  },
  {
    codename: "小纸条系统地基(统一写入+owner三态)",
    time: "2026-07-22 14:30",
    notes: "记忆系统 TODO 1 地基。新建 src/memory/note.js 作为「写小纸条」唯一入口：normalizeOwner/ownerTier/buildNoteRecord 三个纯函数(可 debug.mjs 单测) + writeNote 异步入库。正式立起 owner 三态 schema——owner 空=公共(visibility=public)、单人=私有、多人=共同目击(均 visibility=private)；每项 {name,via}，via 亲历/目击/传闻；owner 人名并入 entities 供日后人路召回；新增 place(场景路)/source(来源标签 narrative/talk/whisper/dumb/pigeon)。memoryWrite.js 的 recordMemory 改为委托 writeNote 的公共小纸条薄垫片(现有主叙事调用处不动、无痛接入统一路径)。recallWithVisibility 的返回 meta 透传 owner/ownerTier/place/source(现在无害，后续私有召回门用)。本步按交接文档第6步纪律只跑通「公共小纸条带owner写入+召回」，私有召回门/哑动作补记/私聊-飞鸽产条/账本合并/日总结留后续TODO(届时只是给 writeNote 传不同 owner)。debug.mjs 加 note 小节单测三态+visibility+entities映射，全过；vite build 通过。",
  },
  {
    codename: "任务/剧情叙事拉到900字线",
    time: "2026-07-22 14:10",
    notes: "把剧情类叙事的篇幅从旧的偏短档统一拉到主叙事同一条 900 线。三处：①forcedEventNote(❢任务情节节点)原写死 150-300 字，改为约 apiCfg.targetWordCount 字(跟随主线字数、允许±15%，要求有场景有对话有起伏)。②apiConfig DEFAULT_INTENT_BUDGETS 的 COMBAT 700→900、EXPLORE_ACTION 500→900(这俩才是实际生效的上限，覆盖 inputIntent 里的 wordBudget 兜底)。③老存档迁移：loadConfig 合并 intentBudgets 后，把恰等于旧出厂值的 COMBAT===700/EXPLORE_ACTION===500 顶到 900(只顶没手动改过的，用户特意调过的别值不动)。META/LOOK/MOVE/闲聊等轻动作档不变。vite build 通过。",
  },
  {
    codename: "完善交接文档与README文档地图",
    time: "2026-07-22 13:50",
    notes: "文档层面收尾（无代码逻辑改动）。①重写 docs/交接_借鉴总结系统.md：从旧的\"借鉴参考项目16文件\"计划版，改为完整接力版——记忆系统设计定稿摘要(两类小纸条/owner三态/账本合并/飞鸽独立/检索三段)、已落地代码六条倒序、8条待做TODO+顺序、明确不并不借清单、坑(含 version.js notes 别写反引号)、下个session第一步。②README 文档地图补上 交接_借鉴总结系统.md 一行；梳理记录加 2026-07-22 条目(记忆设计定稿/文件树/交接重写 + 当天代码改动指向 version.js)。version.js 自身条目此前已逐笔记全、倒序、CURRENT 指向最新。",
  },
  {
    codename: "情节harness并入主叙事(取消单独AI调用)",
    time: "2026-07-22 13:20",
    notes: "把点感叹号任务节点时单独调一次 questHarness 的做法并入主叙事：act() 新增第三参 opts（forcedEvent/forcedEventNpc），在 ctx 末尾（酒馆最强位）追加一段【本步已定情节】强指令，把原 harness 的收窄约束搬来（只写这一件、不引入别的情节角色、结果不可改写），并加护栏：奖励已由系统 forceAdvanceQuest 结算，AI 不要在 delta、items_add、flags_add 里重复结算，防双重发奖。两个点击 handler（triggerQuestFromPanel 与 triggerQuestChoice 的袖手分支）改为 forceAdvanceQuest 后调 act 并带 forcedEvent，删掉各自手动命令日志与 harness 调用（act 自己会记命令行）。忙时排队 pendingQueue 现在连 opts 一起存取重放，避免排队重放丢 forcedEvent；autoTravel 的 push 无 opts 由空对象兜底。移除 MudRPG 的 harness import、设置面板撤掉情节推进叙事一项（questHarness.js 暂留参考不引用）。行为变化：任务步现在走时间加一、且进 convo 与记忆。飞鸽不并（无当场，延时异地触发保留独立）。look 查看介绍暂未并（其写小纸条依赖尚未实现的小纸条系统）。esbuild 通过。",
  },
  {
    codename: "闲置AI方向兜底(移动已按钮化)",
    time: "2026-07-22 12:45",
    notes: "移动早已改为点方向按钮/点地图节点/自动寻路(纯查表 resolveExit/autoTravelTo，不走大模型)，那条\"打字口语移动+正则parseDir失手时问小模型判方向\"的 AI 兜底不再需要。闲置处理：MudRPG 里把触发条件 `if(!isTalk && !movingDir && QUCUO_MAP[room.name])` 改为 `if(false && ...)`，整段 judge 逻辑(buildDirectionJudgeRequest/judgeCfg/callModel/parseDirectionJudgeResponse)一行不删、保留原地，日后想恢复\"打字也能口语移动\"去掉 `false &&` 即可。设置面板「各类调用token上限」撤掉 direction 一项(不再触发就不必露出)；callTokenLimits.direction 默认值保留在 config 里(闲置代码仍作兜底引用)。qucuoMap.js 的 buildDirectionJudgeRequest 保留未动。esbuild 通过。",
  },
  {
    codename: "全部调用token上限可调·设置里最高100000",
    time: "2026-07-22 12:30",
    notes: "把原来散在代码里写死的 9 处调用 maxTokens 全部抽出，集中成命名配置 callTokenLimits，并在设置面板加一节「各类调用·token输出上限」逐项可调、上限 100000。起因：gemini-3-flash-preview 这类带思考模型，思考token与正文共用max_tokens，而 questHarness 写死 500、persuasion 200、pigeonReply 800、knowledge 120 等小值会被思考吃穿，正文半句就撞 length 上限截断（主叙事没事是因其上限走 wordCountToMaxTokens 地板 200000）。改动：①apiConfig 新增 DEFAULT_CALL_TOKEN_LIMITS(questHarness3000/pigeonReply3000/inspect4000/persuasion2000/extraction2000/knowledge2000/direction200/connectionTest200) + CALL_TOKEN_LIMIT_MAX=100000 + defaultConfig.callTokenLimits + loadConfig 嵌套兜底（浅合并会丢新键，改按 默认<-存档 逐键补全，intentBudgets 同样加固）；②9 处调用点(questHarness/persuasion/inspect/pigeonReply/extraction×2/knowledge/direction/两个连接测试)全部改成读 cfg.callTokenLimits.xxx ?? 兜底；③SettingsPanel 加数字框 min1/max100000/step100，含说明。connectionTest 默认从50提到200（50在思考模型下返空）。esbuild 通过。",
  },
  {
    codename: "记忆与总结设计定稿·文档",
    time: "2026-07-22 04:00",
    notes: "几轮商量收敛成 docs/记忆与总结设计.md（纯设计，未改代码）。核心：把\"引主叙事/向量记忆/事实账本/NPC线\"四套坍缩成两大件——①小纸条统一向量库(一句白描+owner富标签，owner三态：空=公共/单人=私有/多人=在场目击，同时表达属于谁+谁知道；账本被摊平成这个标签)；②飞鸽全文线独立精确存(逐字重读，不进向量)。定了三条铁律(AI写血肉系统写骨架、AI尽量简单小模型尽量匹配、坍缩两大件)。淡忘系统暂闲置(旧纸条被token预算挤出=软遗忘)。附全部行动主表(自由/对话/私聊/内外移动/打坐/练功/切磋/送礼/拜师/采集/拾取/交易/住店/求医/赌坊/拜佛/点菜/钱庄当铺/武馆/飞鸽 各自：谁结算·走不走AI·叙事·走不走时间·记什么·公共私有·能否调取)——经核实：正经事都走act()→AI叙事+小纸条，哑动作(打坐+1/练功+2/内移+1/交易0)绕过AI且现无小纸条(缺口，需系统补记喂日总结)。含检索三段(近景/人路+场景路回忆/远景)+信息隔离闸+token照搬+8条TODO+实现顺序。挂进README文档地图。",
  },
  {
    codename: "合包·调试台+地图叙事并入(保时间修复)",
    time: "2026-07-22 03:40",
    notes: "把用户那支（在\"文件树\"版之上并行做的）成果合进本支，两边零冲突（改的是不同区域）。并入的新东西：①src/mapNarration.js——内层箱庭移动的方位文字纯函数 describeInnerArrival（从哪来/四周内层出口/远处外层据点），MudRPG 内层移动分支改用它（本地生成、不调 AI）；②src/debugConsole.jsx + debug-main.jsx + 根 debug.html——独立调试台页面（不经开局，点按钮跑 inner/parse/ai/extract 四节检查、结果打进输出面板，AI 节复用 localStorage 的 API 配置）；③tools/debug.mjs + api.local.json.example——终端版调试（npm run debug）；④vite 多页打包（index+debug）、package.json 加 debug 脚本、README 加\"代码调试台\"节、新增 .gitignore。本支自带的时间制修复（24制/初正/dayIdx/旅店+24）全部保留，与内层分支互不影响。多页 esbuild 通过（index.html + debug.html）。",
  },
  {
    codename: "时辰分初正·上下半时辰古法显示",
    time: "2026-07-22 03:20",
    notes: "在 24回合/天（每时辰2回合）基础上，把一个时辰的两个回合按古法分「初/正」上下半：偶数回合=「X初」、奇数回合=「X正」（如丑初/丑正、卯初/卯正，子正即半夜正中）。SHICHEN 由\"子时/丑时…\"带时字改为单字\"子/丑…\"，getTimeStr 输出 第X日·{时辰}{初|正}。取模加 ((t%24)+24)%24 兜底防负。开局 time=6 = 第1日·卯初（晨）。SHICHEN 全项目仅 getTimeStr 引用，无误伤。esbuild 通过。",
  },
  {
    codename: "时间制统一24·修旅店+25双重计时",
    time: "2026-07-22 03:00",
    notes: "代码里原有两套打架的\"一天\"：显示/天数用 100 制（getTimeStr day=floor(t/100)、dayIdx=floor(time/100)），而旅店+24、飞鸽\"1时辰=2回合\"、README 用 24 制。全部统一到 24 回合/天（每时辰2回合，12时辰/天）：①getTimeStr 改 day=floor(t/24)+1、shi=SHICHEN[floor((t%24)/2)]；②dayIdx 改 floor(time/24)——游走人口改为按真实一天刷新（原来100回合才算一天太久）；③初始/重置 time 25→6（24制下正好等于原本的\"第1日·卯时\"，开局显示零变化）。另修旅店+25双重计时 bug：数值段 setTime 从+24改+23，叙事段 act() 再+1，合计正好一天=24（住店\"安睡一日\"）。注意：内功/外功/好感度的 /100 是 0-100 数值上限，与时间无关，未动。esbuild 通过。",
  },
  {
    codename: "项目文件树·文档",
    time: "2026-07-21 16:00",
    notes: "仿参考项目的注释式结构树，扫真实 src/ 逐文件写成 docs/文件树.md（放文档开头），每文件一句话用途，按 开局界面/系统核心/地图/NPC/装备/combat/memory/items/kungfu/quests/shops/buildings/presets/utils 分组。文末标与参考项目差异：记忆召回同源(recallEngine 照其 memory-recall 写)，但尚无其滚动摘要/周总结(summary-*)与 IndexedDB 存档(idb-snapshot)——即下一步最值得借鉴的两块。挂进 README 文档地图。",
  },
  {
    codename: "驿站·三条通信道·买鸽子·送礼回礼",
    time: "2026-07-21 15:40",
    notes: "把原「马车行」(TRANSPORT)改名为「驿站」，车马传送+邮传合一。三条通信道分开：①飞鸽传书——需先在驿站买信鸽(char.pigeons，12两/只)，每寄一封耗一只，随处可用、快(距离×1)、只送信不带礼，左侧不在场者🕊按钮触发，没鸽子则拦并提示去驿站；②驿站寄书——在驿站选相识之人写信寄出，慢(脚程×1.5)、只送信、不需鸽子；③驿站送礼+信——在驿站附背包一件物+信，慢，收礼方好感够(回信后≥50)才回礼。sendPigeonLetter 泛化为 (npcName,content,{channel,gift})：pigeon消耗鸽子、postgift从背包扣礼；回信 replyPigeonLetter 现解析隐藏标记 ⟦好感X⟧(通信涨/跌好感，-3~+8)与 ⟦回礼:名|类别⟧(仅送过礼且回信后好感≥50才真回赠，品质按好感档50→白绿/70→绿蓝/90→蓝紫由系统裁决，AI只提名合身之物、makeGameItem 创建入袋)。TransportScreen 重写为驿站界面(车马/邮传两栏：买鸽子N只+收信人下拉+附礼下拉+信笺+寄出)。距离时辰、独立/共享记忆、遇遭遇不影响。esbuild 通过。",
  },
  {
    codename: "记忆系统全解读·新增说明文档",
    time: "2026-07-21 15:00",
    notes: "把记忆机制逐文件读透后写成 docs/记忆系统说明.md：①厘清两套并行记忆——确定性事实账本(knowledge.js，存 varTree.世界.知识领域，随 localStorage 存档走)+向量长期记忆(src/memory，存 IndexedDB 独立)；②向量链全流程(AI吐≤50字摘要→HTTP嵌入 SiliconFlow bge-m3→IndexedDB→双路RRF融合+实体聚焦过滤+强弱分层→可见性切分→喂prompt)，全链降级优先/多Key轮询/指纹校验；③讲清'接不上免费本地小向量库'的真相——检索(B:IndexedDB+纯JS余弦/RRF)本就是本地免费手搓的，缺的是把嵌入(A)从远程HTTP换成浏览器内WASM模型(transformers.js)，那是 getEmbedding 加个 local 分支的事、代价是模型体积与推理速度，非架构接不上；给出正确接法(只换A不动B)。顺带更正阈值口径：实际 MIN_SIM=0.60/ENTITY_BYPASS=0.72(recallEngine.js为准)，旧记忆里的0.55/0.75作废。挂进 README 文档地图。",
  },
  {
    codename: "人物两段·收放·在场直接对话",
    time: "2026-07-21 14:40",
    notes: "左侧「此地之人」拆成两段独立可收放：①在场（点标题▾/▸收放，随 room.npcs 每回合刷新）——去掉飞鸽键，改「💬 已在身边·对话」点了直接进 talk 模式对着此人说话（就在眼前无需飞鸽）；②曾遇·不在场（可收放）——保留🕊飞鸽键 + 好感度/态度/生气。两段各带计数（N）。peoplePanel 状态记两段收放。esbuild 通过。",
  },
  {
    codename: "自动寻路硬暂停·交互重构收尾",
    time: "2026-07-21 14:10",
    notes: "自动寻路（autoTravelTo）途中若掷中随机遭遇（encounter.js rollEncounter 命中），硬中断剩余队列：清空 pendingQueue、autoTravelRef 复位、提示「余下N程未走」，把玩家留在该据点应对，本步照常叙述这次路遇。靠 autoTravelRef 只在自动寻路时置真、出队到空自动复位——手动排队的命令不受影响（遭遇不清手动队列）。与马车行「花钱直达不触发遭遇」形成对照，保住步行的「免费但有事发生」定位。至此交互重构九条全部落定。",
  },
  {
    codename: "飞鸽传书·独立记忆+共享记忆+按距离回信",
    time: "2026-07-21 13:50",
    notes: "新增飞鸽传书系统。入口：左侧「此地之人」每个人（在场+曾遇不在场）一个🕊飞鸽键→切底部 pigeon 输入模式（琥珀色，横幅显示致信人+预计时辰+取消）写信回车放飞。①回信时长按距离：玩家当前据点↔收信人「所在地」（进据点自动记 varTree.角色[名].所在地=最后见到他的据点）的 QUCUO_MAP 直线距离，折算 1–12 时辰（1时辰=2回合），到点由 [time] effect 触发 replyPigeonLetter 生成（pigeonProcessing ref 去重）。②记忆独立：每人一条信件线 varTree.角色[名].飞鸽=[{dir,content,turn}]，回信时全喂 AI，各人各记、前后连贯。③记忆共享：发信/回信都 registerFact 登进 knowledge 共享账本（标签飞鸽传书），旁白全知、传播系统可扩散。④持久化：待回队列存 varTree.世界.飞鸽待回，随存档保存、读档到点仍回。回信用收信人口吻+身世性情+好感度（越低越冷淡甚至推拒）+共享见闻，白话古文书信体。关键函数 sendPigeonLetter/replyPigeonLetter/pigeonDelayShichen。esbuild 通过。",
  },
  {
    codename: "人物面板合并·左侧统一",
    time: "2026-07-21 13:20",
    notes: "删掉右侧「人物关系」面板，内容并进左侧「此地之人」：在场者照旧（名字+简介+好感度右对齐+飞鸽/面板/立绘键），下方新增「曾遇·此刻不在场」段（= 曾经出现人物 减去 当前在场，去重）显示好感度/态度/生气状态、点名字开详情面板。人物信息只在左侧一处看全，右栏腾给背包/武学/装备/旁白。",
  },
  {
    codename: "内层地图UI·行动按钮·自动寻路·解锁门禁",
    time: "2026-07-21 12:50",
    notes: "交互重构⑥⑦落地。⑦：地图框头加内/外切换；内层箱庭 SVG 可视化（读 innerMap 房间 x/y，当前所在绿框高亮）；行动按钮（内/外方向键）移入地图框左下角，点了走（派发 act(方向词) 复用既有移动，内层优先）；外层地图节点可点击→自动前往；放大弹层跟随内/外视图、两图皆可放大。⑥：qucuoMap.js 加 findPath(BFS，限已探索+已解锁节点)+isNodeUnlocked（补总纲10.5说的 resolveExit 没读 unlockCondition）；autoTravelTo 点已探明据点→取路→预填命令队列逐步走（复用出队机制，每步耗一时辰、掷遭遇/拾取）；单步方向移动也接了解锁门禁（黑风寨等未达条件不可入）。修复：插入 autoTravelTo 时误吞 handleNpcDuel 声明行致 await 失去 async 宿主，已补回。",
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
    notes: "①武学栏补品阶 UI：makeSkillEntry 学会时带上目录 quality（此前被丢弃的死字段）、开局三脚猫拳法给白品，武学栏每门用 QUALITY_COLOR 按品阶上色+（X品）标签，运功态品阶色左边框。战斗品质仍由修炼阶段（入门→登峰造极）算，与武学本身品阶两回事。②新增「临阵招式」只读栏：显示非武学派生的招（基础补位招硬架/回气、拜师授的），带类型徽标+品阶。③告白改粉色❗徽标：删 act() 的「告白」字串分支，好感度满100由粉感叹号点击直接调 confessToNarrator。④对代码逐条 grep 核实交互重构九条真实状态：发现②③④⑤⑧（私聊分档助手/入场叙事/删localCmd打字命令/服食面板/采摘面板）在上传包里其实已实现（先前路线图照旧摘要写的、严重高估未完成量），已订正 项目状态.md 进度表。esbuild 通过。",
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
    notes: "消耗品系统第 3、4 步落地，buffSystem 从「只写不读的死 buff」正式接通。①【关键修复】此前 handleServiceOrder（饭馆点菜）早已用 makeBuffFlag 写 buff flag，但 parseActiveBuffs 全项目零调用、读取端从未接通——buff 挂了不生效。第3步补读取/应用端：MudRPG effectiveSpecialNow=applyBuffsToSpecial(char.special,flags,time)，char/flags/time 任一变即重算，状态面板显示「基础→有效」及每条 buff 剩余回合；监听 time 的 useEffect 每回合 cleanExpiredBuffs 清过期（只清 buff_ 开头、剧情 flag 保留）。计时基准一律用 time（项目无 turnCount）。②【战斗态】DuelScreen 的 playerChar 现在收到 {...char,special:effectiveSpecialNow}，七维 buff 战斗中自动生效。③【战前餐】新增 pendingCombatBuff prop，进场 resolveCombatBuff 应用：起手气血按 hpBonusRatio 抬高本场上限、起手真气+energyBonus、外功+waigong（当临时外功点数叠进 atkFromWaigong）、攻击招式倍率+moveMul；第1回合顶部显示药力提示；onFinish 无论胜负清除 pendingCombatBuff。④【探索态吃B档】useConsumable 补 sixDimTemp（写 buff flag 默认持续30时辰）、combatBuff（存 pendingCombatBuff 可叠）、hpRestoreOverTime（探索态无逐回合结算→降级即时回一笔 ratio×turns）。⑤【第4步砍降C档】useConsumable 降级兜底：跳回合回满 skipTurnsHeal→即时回满血、全队 teamBuff→降级只对自己、涂抹武器 weaponCoat→砍掉静默忽略不报错。buffSystem 读写闭环 + B/C 档单测全过。下一步（第5步·唯一剩余）：把100件食品药品录入 catalog，字段只用已支持的那批。",
  },
  {
    codename: "消耗品接线·战斗内道具栏+探索态服用",
    time: "2026-07-21 05:10",
    notes: "消耗品系统五步计划第 1、2 步落地。①【战斗内道具栏】DuelScreen 切磋界面 select 阶段新增「⊙ 用道具」入口，列出背包里战斗内可用的消耗品（只列 A 档即时救命：回血 hpRestore / 回气 energyRestore / 解异常 dispel / 假死保命 rebirthOnce；B 档不列免得白费回合）。服药=消耗玩家本回合行动：handleUseItem 把药效构造成临时「疗伤型」状态招（type=STATUS、energyCost=0），走与出招完全相同的 handleSelectMove 结算——服药这回合 NPC 照常出招、净值决定续航，复用既有「疗伤」家族博弈设计，无新增分支。假死保命用独立 ref 记本场续命一次（与装备版涅槃引各自独立可叠）。onFinish 新增第五参 usedItems，MudRPG 从背包按名逐件扣（无论胜负/撤退都扣）。②【探索态用物品总闸】catalog.js 新增 useConsumable(consumable, char) 纯函数（数值算死、AI 不参与）：探索态只认 hpRestore（按最大血比例回、夹上限、血满拒服），energyRestore/dispel/rebirthOnce 是纯战斗内机制、探索态引导去战斗中用，sixDimTemp 等 B 档返回「待实装」（第3步做）。MudRPG 在 localCmd 后拦截「用/服/吃/喝/嗑 <物品名>」，背包精确匹配到一件消耗品才处理（对象带 consumable / 字符串走 CATALOG_INDEX 兜底），应用回血→扣背包→推进回合；没匹配到的放行给 AI 叙事不误伤。useConsumable 九分支单测通过。下一步：接 buffSystem（B档临时增益，计时用 time 不是 turnCount）。",
  },
  {
    codename: "四字雅名·全员专属招·三只野兽",
    time: "2026-07-20 16:20",
    notes: "①【蓝袍以上招式统一四字雅名】重写 npcSignatureMoves.js，全体 levelCap≥2 驻场NPC + 行脚僧/来访武者，攻/防/状三槽一律标准四字招名（取自百招名池、按攻击/防御/擒拿点穴分类对号），回气槽各人贴身份雅名（端坐纳息/望湖养息/踏雪凝息…）；绿白档保留朴拙。此前批次给柳青鸢/巴桑/罗琦/梵衍那/梅朵配的招式名，本轮按四字规矩统一重命名覆盖（fullBio 未动）。效果仍由原型×品阶自动算。②【三只野兽·招式不可学】虎王(红5·熊山温泉)、狼王(橙4·大草甸草甸深处·咬死管家独子那头)、白猿(橙4·雪山崖底)，兽性招名，unlearnable=true 拜师被拒。按 residentNpcs.js 顶峰/大草甸 组 + innerMap.js 房间 residentNpcName 绑定固定落位。③【白猿·不能说话可养好感】cannotSpeak=true：对话被拦（歪头低吼、听不懂人话），但可投喂（赠礼走既有好感度通道）日久亲近；affectionable=true。踞守呼延大侠殒命的崖底暗河潭，需绝顶跳崖（外功或内功≥85）才能抵达，与雪山派旧伤呼应。④【顺带修潜在bug】toRoomNpc 只保留 id/name/brief，会把驻场/野兽NPC 显式 levelCap 和 beast/unlearnable/cannotSpeak 剥掉→品阶被关键词猜测覆盖（此前设的驻场档位隐性失效）；toRoomNpcWithCombat 现补回这些字段、显式 levelCap 优先，驻场档位真正生效。⑤野兽不可学、平民(levelCap<1)无武艺可传。",
  },
  {
    codename: "核心人物fullBio与武学·首批",
    time: "2026-07-20 16:05",
    notes: "给五个派系核心人物补齐 fullBio（总纲原文整合，非概括）+ 专属武学（原型×品阶自动配特效）：柳青鸢(红5·锦官城都事，寻人执念/土司怕她/终局任命梅朵，武学=问牍趁虚·留有余地听桥·拿捏封穴)、巴桑(橙4·黑风寨义匪首领，牦牛抵税逼死父亲/寨规三不抢/顺手护送老乡，武学=开山硬攻·挡刀防反·喝阵致乱)、罗琦(橙4·欢喜教圣女实际管事，茶里下药剂量精准/与兰姐区分，武学=拈香趁虚·曼舞防反·迷魂香施毒)、梵衍那(紫3·欢喜教主天竺流亡王子，攒钱回乡/与都事失踪上司线索交集，武学=梵指·入定·天竺梵音致乱)、梅朵(紫3·土司之女父女道德对照，撕渗透信/骑马冲后山/欠管家一份歉，武学=策马式硬攻·护乡防反·屏息蓄势)。至此驻场专属武学 10/24 人。剩余14人（何雨谢/呼延雪/兰姐/管家/丹增/扎西/老何 + 绿档平民等）待下批。",
  },
  {
    codename: "无限拜师·敌招迷雾·战斗面板上下重构",
    time: "2026-07-20 15:40",
    notes: "三件事。①【无限拜师】重做 handleNpcLearnSkill：不再卡在只有老猎户一条的 NPC_TEACHABLE_SKILLS 硬编码表上，改为任何有武艺的NPC（levelCap≥1）好感度≥40 即可把【自己的专属招式】传授给玩家（专属出招表优先、没有则用其品阶生成招式；回气不传）。学到的招含教习者品阶档位的全套特效，威力仍按玩家自己的外功内功结算——学到技法，内力自修。无数量上限、按招式id去重、越学越多，标记 learnedFromMaster 不被武学重算覆盖、赢战后持久化回存档。②【敌招迷雾】切磋中对方招式初始全为'？未知'，只有被使用过才揭示；揭示后可点开【详细察看】看到招式类型/耗能/全部机制说明/描述。玩家自己的招式按钮也加了ⓘ察看入口。③【战斗面板上下重构】参照building的上下分栏：顶部保留双方血条+能量点（血/气），中段上半为操作区（招式按钮网格，无限招式可滚动 + 敌招迷雾条），下半为MUD式结算日志（可滚动、自动到底）——每回合写清'你使X、对方使Y、谁占上风、克制/被防住的过程、双方受创数值、余下能量'。移除旧的居中单回合BattleReport。",
  },
  {
    codename: "战力统一与招式特效随品阶",
    time: "2026-07-20 15:10",
    notes: "战斗系统大重构，三件事。①【玩家NPC战力统一】此前玩家baseAtk恒20、气血恒100、从不随修为上档，而NPC baseAtk按4.5/档指数到33257——两者根本不在一条战力梯子上，满配玩家被中档NPC一击秒。现在攻击力统一由外功决定 atkFromWaigong(外功)=18×R^(外功/20)、气血由内功决定 hpFromNeigong，玩家和NPC走同一套函数（R=20^(1/5)，与equipment.js的QUALITY_RATIO同源，白→红全程20倍）。getTierPower的4.5删除。玩家内功+1时气血上限同步抬高。同时移除calcBaseDamage里的waigongCoef/neigongCoef（外功内功已进baseAtk/气血，否则各顶两遍伤害爆炸）。实测满配玩家vs红档桑杰朵杰稳定6-9回合，同时白袍新手vs红档仍是必死（红是墙、练上去才能平视）。②【招式特效随品阶变浓、因人而异】新增combat/moveArchetypes.js招式原型系统：同一原型（防守反击/硬攻/趁虚/致乱/封穴/蓄势/施毒）的特效随levelCap逐档解锁，红名听桥=近乎全免+满反打+抢先+应对失败重罚，平民听桥=挡一下+小反打。npcSignatureMoves.js改为每槽声明'原型+专属名'，效果由原型×品阶自动算。③复活一批死flag：forceFirst/ignoreDefense/nullifyStatusOnHit/onCounterFail两项/onCounterSuccessPreemptive真抢先/freezeEnergyRecovery真冻气/nextAttackBonus真蓄势/permanentCostReductionOnUse/lowEnemyEnergyBonus/afterCounterBonus/enemyCostPenalty封穴/applyStatus通用状态施加。④【防御不能连用两回合】玩家防御按钮置灰+NPC决策清零防御权重；防御被状态克穿也会门户大开一回合。跨回合状态（应对记忆/蓄势/封穴耗气/冻气/防御失效）在DuelScreen线程化传递。",
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

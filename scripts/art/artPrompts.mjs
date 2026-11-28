// 夜色精修·素材生图模板的单一数据源。
// 画风锚、版式句、禁项只在这里写一次；docs/美术_夜色素材提示词.md 由
// scripts/art/buildArtPrompts.mjs 从这里生成，每条提示词都拼成可整段复制的完整文本。
// 改画风只改 STYLE_ANCHOR，再跑 `npm run art:prompts` 重新生成文档。
//
// 每个格子的 keys 是切图后的文件名（不含扩展名），也是游戏里按字段查图用的键：
// 地点按 room.name，人物按 npc.name，建筑按建筑类型键，物品按 category 加小类。
// 一格对应多个 keys 表示几个人共用一张（如三个血刀门徒）。keys 为空数组的格子留黑。

export const STYLE_ANCHOR = `[STYLE ANCHOR · QUCUO INK-NIGHT v1]
Art for a quiet Chinese wuxia text adventure set in the Sichuan–Tibetan highlands, where Han and Tibetan villages live side by side.
Medium: Chinese ink-wash painting with restrained mineral color, dry-brush strokes and soft ink bleeds, painted at night or deep dusk.
Palette: the ground is a flat warm near-black, exactly #0c0b09, and every edge of every picture fades softly into that near-black with no hard border. Forms are drawn in ink black and warm rice-paper white (#ece6d6). Color is sparse and muted: slate water-blue (#7fa3b0), pale moss green (#8fb57a), antique gold (#cfa95a), ochre and sand (#b9a68a). A single small touch of vermilion (#c8323a) is allowed only where the subject itself has it, such as a lantern, a prayer flag or a cord.
Light: low-key, one soft light source, large calm areas of darkness, high detail only on the subject.
Mood: restrained, still, a little cold, like a thread-bound book read by lamplight.
Rendering: flat 2D painting, no 3D render look, no photorealism, no glossy digital painting, no anime style, no chibi.
Always: no text, no letters, no calligraphy, no seal stamps, no signature, no watermark, no picture frame, no border, no UI elements.`;

export const REFERENCE_LINE = "Match the painting style of the attached reference image exactly.";

// 人物画风锚：照 R01 定稿（#632/#633 高清抠底立绘）的实际效果写——清晰勾线、平涂、亮部足、
// 主色加对比色。夜色锚写的是「低调、用色稀少」，用在人物上会跑出压暗、单一暖棕的图（#673、#679）。
export const PORTRAIT_ANCHOR = `[STYLE ANCHOR · QUCUO PORTRAIT v2]
Character portraits for a Chinese wuxia text adventure set in the Sichuan–Tibetan highlands, where Han and Tibetan people live side by side.
Medium: hand-drawn character illustration with confident, clean ink linework and cel-style flat color with one or two soft shading steps; crisp, readable shapes.
Color: rich, lively jewel tones. Each person has one main costume color and at least one clearly contrasting accent (for example crimson with turquoise, indigo with gold, white with copper, plum with amber), and warm natural skin tones that differ from person to person. Bright clean highlights on faces, hair, metal and beads, so the figure reads bright against the dark ground.
Light: one soft key light from the upper left and a gentle rim light on the far side.
Faces: full of character and clearly individual; age, face shape, build, skin, hair and expression follow each description exactly.
Rendering: 2D illustration, no 3D render look, no photorealism, no muddy brown overall tint, no chibi.
Always: no text, no letters, no calligraphy, no seal stamps, no signature, no watermark, no picture frame, no border, no UI elements.`;

const PORTRAIT_FORMAT = "[FORMAT] One square sheet, 1024x1024, divided into a 3x3 grid of nine equal square cells with thin near-black gutters between them. Each cell holds one tight chest-up portrait: the head is large, about 40% of the cell width, the top of the hair close to the top edge of the cell, the shoulders filling the width of the cell, the body turned three-quarters. Each person holds or wears their signature object near the face or chest and has their own pose and expression; the nine people must look clearly different from each other in age, face, build, skin, hair and expression, never one repeated face. Every cell's background is flat near-black #0c0b09 so the figure can be cut out cleanly. Cells are numbered left to right, top to bottom.";
const BEAST_FORMAT = "[FORMAT] One square sheet, 1024x1024, divided into a 3x3 grid of nine equal square cells with thin near-black gutters between them. Each cell holds one head-and-chest portrait of an animal in three-quarter view, eyes looking slightly to the left, the top of the head about 15% below the top of the cell, the chest cut by the bottom of the cell, all lit by the same soft light from the upper left. Every cell's background is flat near-black #0c0b09 and the animal's edges fade into it. Cells are numbered left to right, top to bottom.";
const PORTRAIT_AVOID = "[AVOID] no names, labels or any text in the cells, no seal stamps, no frames around cells, no weapon pointed at the viewer, no blood, no nudity.";
const PLACE_FORMAT = "[FORMAT] One landscape painting, 1536x1024, eye-level distant view. The subject sits in the middle band of the picture; the top 30% and bottom 30% are calm dark sky and dark ground so the picture can be cropped to a 2:1 banner. All edges fade into near-black #0c0b09.";
const BUILDING_FORMAT = "[FORMAT] One landscape sheet, 1536x1024, divided into a 2x2 grid of four equal cells (each 768x512) with thin near-black gutters. Each cell is one eye-level view of a building's front or doorway at night, the subject centered, warm lamplight from inside, dark sky and ground around it. Every cell's background fades into near-black #0c0b09. Cells are numbered left to right, top to bottom.";
const BUILDING_AVOID = "[AVOID] no signboards with readable characters, no text, no seal stamps, no people in close-up, no frames around cells.";
const ITEM_FORMAT = "[FORMAT] One square sheet, 1024x1024, divided into a 3x3 grid of nine equal square cells with thin near-black gutters. Each cell is a single object shown as a still life from the front, centered, filling about 60% of the cell, lit by the same soft light from the upper left. Every cell's background is flat near-black #0c0b09 and the object's edges fade into it. Cells are numbered left to right, top to bottom.";
const ITEM_AVOID = "[AVOID] no hands or people, no text, no seal stamps, no glowing magic effects, no frames around cells, no shadows cast onto a floor.";

// 素材类别：输出目录、切出来的尺寸、该类用哪张样张作参考。
export const KINDS = {
  map: { label: "舆图底卷", dir: "public/art/map", grid: [1, 1], out: "1024x1024", ref: "place" },
  place: { label: "地点头图", dir: "public/art/place", grid: [1, 1], out: "1024x512", ref: "place" },
  npc: { label: "人物小像", dir: "public/art/npc", grid: [3, 3], out: "330x330 透明底", ref: "npc", anchor: "portrait" },
  building: { label: "建筑头图", dir: "public/art/building", grid: [2, 2], out: "768x384", ref: "place" },
  item: { label: "物品类别图", dir: "public/art/item", grid: [3, 3], out: "256x256", ref: "npc" },
};

// 跑图顺序：先定调（L01、R01），再试每类第一批，再成批，最后舆图。
export const RUN_ORDER = [
  { step: "第一步·定调", ids: ["L01", "R01"], note: "各跑三到四次，各挑一张最满意的作样张；L01 管景，R01 管人。" },
  { step: "第二步·试每类第一批", ids: ["B01", "I01", "R14"], note: "从这一步起附样张，并在提示词最前面加一行参考句。" },
  { step: "第三步·成批", ids: ["L02-L25", "R02-R19", "B02-B20", "I02-I04"], note: "地点、建筑附 L01 样张；人物、物品附 R01 样张。L22-L25、B12-B20 是雪域四地（打箭炉、丹霞城、焚风渡、琼隆古墟），建筑按建筑 id 出专图。" },
  { step: "第四步·收尾", ids: ["M01"], note: "先确认舆图水系走向再跑，附 L01 样张。" },
  { step: "第五步·雪域人物", ids: ["R20-R25"], note: "替换 #673 雪域少年 20 张与 #679 驻场人物 30 张。附 R01 定稿整张作样张；切出后抠成透明底、头顶贴近上边，存成 public/art/npc/<人名>.webp（有损）。" },
];

const place = (id, key, subject, avoid, formatOverride) => ({
  id, kind: "place", title: key,
  format: formatOverride || PLACE_FORMAT,
  cells: [{ keys: [key], en: subject }],
  avoid,
});

const sheet = (id, kind, title, format, avoid, cells) => ({ id, kind, title, format, avoid, cells });
const c = (keys, en) => ({ keys: Array.isArray(keys) ? keys : [keys], en });
const empty = () => ({ keys: [], en: "empty, plain near-black." });

export const BATCHES = [
  {
    id: "M01", kind: "map", title: "舆图底卷",
    format: "[FORMAT] One square painting, 1024x1024, a top-down map view with north at the top, like an old ink-wash topographic scroll seen from directly above. No perspective tilt. The whole picture fades into near-black #0c0b09 at all four edges.",
    cells: [c("qucuo", `A highland region of western Sichuan, painted as terrain only.
Top third of the picture: a range of snow mountains drawn in pale rice-paper white over ink, the highest peak at about 42% from the left and 7% from the top; a deep cliff cave mouth at 25% left, 7% top; a hidden quiet valley at 25% left, 21% top; an open mountain terrace at 42% left, 21% top; a narrow mountain pass at 42% left, 36% top.
Middle band: a monastery slope above a stream at 42% left, 50% top. At 42% left, 64% top, three small streams meet: one comes straight down from the snow mountains in the north; one comes up from the southwest hills; after they meet, a single wider river flows southeast. A raised terrace at 25% left, 64% top. To the east the land drops into a green rainy lowland basin; at 75% left, 64% top two larger rivers meet among bamboo groves; at 92% left, 50% top a wide river beach; at 92% left, 64% top the end of a road leading out of the picture to the east.
Bottom third: a broad open grassland at 42% left, 79% top, lying between the two streams; the southeast-flowing river passes a small market area at 58% left, 79% top and ends in a calm clear lake at 58% left, 93% top that reflects the northern snow peaks; herders' pastures beside the southwest stream at 42% left, 93% top; a hidden scrub-covered gully at 25% left, 93% top; a windswept rocky pass at the far west, 8% left, 79% top; tall cliffs wrapped in faint purple mist at 75% left, 79% top; a sea of bamboo at 92% left, 79% top.
Water is slate water-blue (#7fa3b0) and is the only clearly colored element. Grassland is very muted moss green. Everything else is ink, rice-paper white and darkness.`)],
    avoid: "[AVOID] no buildings, no towns drawn in detail, no roads drawn as lines, no labels, no dots or markers, no compass rose, no grid, no scroll rollers or mounting, no paper texture outside the painted land.",
  },

  place("L01", "鱼定村", "A small highland village at night where three mountain streams meet over a stony shoal. A faded boundary stone stands at the village entrance. A few courtyards of mixed Han and Tibetan style, stone and timber, scattered along the slope; thin cooking smoke drifting low; one or two warm lamp-lit windows. The three streams catch faint slate-blue light.", "[AVOID] no people in close-up, no readable carving on the stone."),
  place("L02", "鱼定土司", "A chieftain's manor on a high stone terrace west of a village, at night. Thick rammed-earth walls, layered flat roofs, small wind chimes hanging from the eaves, a strict and orderly gate. Faint lamplight inside, the courtyard silent.", "[AVOID] no guards in close-up, no banners with writing."),
  place("L03", "喇嘛庙", "A Tibetan Buddhist monastery built on a high slope beside a mountain stream, overlooking a village below at night. Whitewashed walls with dark window frames, golden roof ornaments catching a little light, strings of prayer flags, butter-lamp glow from a hall.", "[AVOID] no monks in close-up, no readable script on the flags."),
  place("L04", "白塔", "A lone ancient white stupa standing at a mountain pass halfway up a snowy slope, at night. Its surface is mottled and worn; a narrow path passes beside it and continues up toward the snow mountains. Wind, cold, stillness.", "[AVOID] no figures."),
  place("L05", "后山平台", "A wide open mountain terrace on the way into the snow mountains, at night, with a sweeping view over dark valleys. A few horse-racing posts and a trampled track across the frozen ground hint at an annual horse race.", "[AVOID] no horses, no crowds."),
  place("L06", "雪山派", "A secluded martial sect hidden deep in a snow valley, at night. Plain timber halls half buried in snow, a cleared practice yard with wooden training posts, one narrow gate as the only way in. Quiet, austere, clean.", "[AVOID] no figures fighting, no banners with writing."),
  place("L07", "山洞", "The mouth of a deep, damp tunnel in a snowy cliff face, a secret passage through the mountain. Icicles at the lip of the cave, darkness inside, a faint cold draft suggested by drifting snow.", "[AVOID] no treasure, no figures."),
  place("L08", "顶峰", "The highest summit of a snow mountain range at night, eternal snow, wind tearing spindrift off the ridge, the whole valley region visible far below as dark folds of land with a few tiny streams.", "[AVOID] no climbers, no flags."),
  place("L09", "天都镇", "A small market town on the lower reach of a river at the edge of a grassland, in the evening. A street of timber shops with hanging lanterns, pack animals tied at posts, the noise of trade implied by many small lights. The river runs past behind the town.", "[AVOID] no readable signboards, no crowds in close-up."),
  place("L10", "大草甸", "A vast empty highland grassland lying between two streams, at night under a wide sky. Low rolling ground, wind-flattened grass, far off a pair of glinting eyes in the dark that could be a wolf. Open, exposed, a little dangerous.", "[AVOID] no clear animal figure, no tents."),
  place("L11", "玉泉寨", "A Tibetan herders' village beside a stream, guarding the water route toward a distant lake, in the evening. Stone houses with flat roofs, yak-hair tents at the edge, smoke and the silhouettes of cattle and sheep in pens.", "[AVOID] no people in close-up."),
  place("L12", "黑风寨", "A hidden settlement in a mountain gully at the end of a narrow path screened by thick shrubs, at night. It looks like an ordinary village: herbs drying on racks, a doorway with a woman's sewing basket. Only a rock wall with carved rules hints that this is not a normal place.", "[AVOID] no readable carving, no weapons on display."),
  place("L13", "贡措海", "A clear crystal lake at the far end of the region, at night, its still surface mirroring snow peaks and a dark forest. On the shore, a few weathered grave cairns of earlier generations. Silent and solemn.", "[AVOID] no boats, no figures."),
  place("L14", "雅江", "A walled Sichuan river city where two rivers meet, on a rainy evening. Green bamboo everywhere, wet flagstone streets shining, tiled roofs, a western gate opening toward the mountains.", "[AVOID] no readable signs."),
  place("L15", "广汉", "A wide river beach at night with something ancient buried under it: here and there the earth is broken and the green edge of a large bronze mask and the tip of a bronze tree branch show through the mud. Eerie, quiet, a faint metallic gleam.", "[AVOID] no full bronze figure, no people."),
  place("L16", "锦官城", "The great gate of a provincial city where the official road leads out into the wider world, at evening. A tall gate tower, the road running in, small lantern-lit figures of merchants and runners as tiny silhouettes far away.", "[AVOID] no readable plaque on the gate."),
  place("L17", "天龙营", "A windswept rocky pass at the western edge of the region, at dusk. Black-and-gold banners torn by fierce wind along the ridge, rows of leather tents and a tall stone platform beyond the pass, a second camp facing it across a ravine.", "[AVOID] no writing on banners, no battle."),
  place("L18", "雾隐寨", "Sheer green cliffs on a hidden southern mountain trail, wrapped in a faint purple miasma that never lifts. Stilt houses of wood hang from the cliff, joined by rattan rope bridges, a few lamps glowing in the mist. Humid, sweet-scented, dangerous.", "[AVOID] no insects in close-up."),
  place("L19", "蜀南唐堡", "A stern fortress of grey brick and iron-tiled roofs standing deep in a sea of bamboo at the end of a bamboo path, at night. A dark moat channel at its foot, small bronze bells on the eaves, a sense that every stone hides a mechanism.", "[AVOID] no figures, no weapons."),
  place("L20", "心灵之海", "A dreamlike shallow sea under a sun stuck on the horizon that never sets. Golden light covers everything; warm water only ankle-deep; far off, a white villa with its lights on. No wind, no birds, only slow waves like breathing. Keep the gold soft and low in saturation so it still sits on a dark interface.", "[AVOID] no figures, no boats.",
    "[FORMAT] One landscape painting, 1536x1024, eye-level distant view. The subject sits in the middle band of the picture; the top 30% and bottom 30% are soft so the picture can be cropped to a 2:1 banner. All edges fade into near-black #0c0b09. Exception to the anchor: this scene is not at night."),
  place("L21", "第三新东京市", "A city regrowing on ruins: scaffolding, freshly turned earth, laundry drying on balconies, a small child running. In the distance the sea is red and the sky is very blue. Painted in the same ink-wash manner as the rest.", "[AVOID] no recognisable characters, no giant robots, no logos.",
    "[FORMAT] One landscape painting, 1536x1024, eye-level distant view. The subject sits in the middle band of the picture; the top 30% and bottom 30% are soft so the picture can be cropped to a 2:1 banner. All edges fade into near-black #0c0b09. Exception to the anchor: this scene is in daylight."),
  // 雪域四地（#663）：按夜色规格画，与 L01-L21 同一画风锚，取代临时借用的 L09/L03/L11/L04。
  place("L22", "打箭炉", "A gorge city at night where two roaring white rivers meet and run straight through the town. Tall flat-roofed stone tower-houses line both banks, wooden waterwheels turn in the current, the glow of iron furnaces shows in a few doorways, and a great caravan inn courtyard has brick tea stacked under its eaves. A rope bridge hangs far upstream; dark mountains close in on both sides.", "[AVOID] no people in close-up, no readable signboards."),
  place("L23", "丹霞城", "A great walled city at night on a terrace of grey-white earth and dark red sandstone cliffs. Low streets of tenant farmers and woodblock carvers in the outer town climb toward a massive flat-roofed stone compound at the city's heart, its walls painted with broad horizontal bands of muted red, white and blue-grey. Dark barley fields surround the walls; a few lamps burn at the gate.", "[AVOID] no people in close-up, no readable carving."),
  place("L24", "焚风渡", "An old ferry crossing in a dry, warm river gorge at night, where a fast river runs between bare ochre slopes and never freezes. Yak-hide coracles are pulled up on a stony beach beside herders' cattle pens and gold panners' sluices. Halfway up the slope stands a pure white flat-roofed compound of white pillars, hundreds of white banners streaming in the wind and one great bronze fire bowl glowing.", "[AVOID] no people in close-up, no readable writing on the banners."),
  place("L25", "琼隆古墟", "A cliff-top city of black stone at night above a deep gorge. Narrow stone lanes cling to the mountainside; on the summit a flat-roofed black hall is held up by twelve square black stone pillars carved with great-bird motifs. Prayer wheels are set into the walls, smoke of burning juniper drifts over the roofs, and an iron chain bridge crosses the chasm below.", "[AVOID] no people in close-up, no swastika symbols, no readable carving."),

  sheet("R01", "npc", "鱼定村与土司府（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("周铭章", "a round, shrewd middle-aged Han merchant, chief of the village trading house, easy smile, dark Shu brocade padded robe with a hidden pattern, an icy-green jade thumb ring, a closed iron-ribbed folding fan."),
    c("泽仁", "an old Tibetan village head, deeply weathered face, worn sheepskin felt robe, holding a black ebony tobacco pipe with a brass mouthpiece."),
    c("才旦", "a young Tibetan woman, the village's sharpest bookkeeper; dress and makeup always immaculate, a finely made silver hairpin from her late mother, calculating eyes, faint ink stains on her fingertips, plain coarse-cloth jacket."),
    c("老孙", "a Han innkeeper in his forties who used to cook for escort caravans, thick forearms, bearskin vest, short beard, a brass porter's tag on his belt."),
    c("鱼定大娘", "a warm-hearted old village woman, cook and matchmaker, round face, headscarf, quilted cloth jacket, a woven good-luck cord."),
    c("梅朵", "the chieftain's daughter, a young Tibetan woman with healthy sun-tanned skin, a grin that narrows her eyes and shows white teeth, Tibetan robe with sleeves rolled high showing riding calluses on her forearms, a manor token hanging at her waist, a riding whip."),
    c("桑杰朵杰", "the chieftain himself, a Tibetan man in his forties, unreadable expression, heavy official armor under a fine robe, a seal cord at his chest."),
    c("管家·陆福生", "the manor's chief steward, a neat careful Han man who used to keep accounts, plain official servant's robe, a patrol tally at his belt."),
    c("格桑顿珠", "the captain of the manor guard, a strong Tibetan warrior, bright ceremonial armor, a halberd shaft over his shoulder, a jade buckle."),
  ]),
  sheet("R02", "npc", "土司府（下）、喇嘛庙与白塔", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("洛桑平措", "the manor's registrar who keeps tax rolls and land deeds, a thin Tibetan scholar in an old wool robe, a bronze paperweight and a cloud-thunder bronze plaque."),
    c("白玛次仁", "deputy commander of the patrol, Tibetan, iron-studded leather armor, a short spear."),
    c("喇嘛庙住持", "an elderly abbot who witnessed an event thirty years ago, worn dark-red patched monastic robe, a long string of old honey-amber beads."),
    c("达摩药堂师父", "a monastery physician skilled in Tibetan medicine and needles, a medicine-stained hemp robe, a silver needle case."),
    c("洛桑", "a wandering monk who carries a bamboo basket and messages, patched travelling robe, a small bronze prayer wheel."),
    c("丹巴", "the monastery cook-monk who secretly stews meat, a greasy coarse apron over his robe, a brass kitchen-god pendant, a mischievous look."),
    c("次仁", "a young novice in the scripture library, ink-stained grey robe, cracked crystal reading glasses, bright memorising eyes."),
    c("罗布桑", "the head guardian of the white stupa, stern and strict, a snow scar through his left eyebrow, coarse brown guardian robe, a black obsidian plaque."),
    c("丹增", "the head of a Tibetan herders' village, missing three fingers on one hand, old riding clothes, a short hunting spear."),
  ]),
  sheet("R03", "npc", "玉泉寨与大草甸", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("李若由", "a young merchant's daughter who runs a small inn in a Tibetan village; plateau-red cheeks, a pair of plain silver earrings, narrowed appraising eyes, calluses from the abacus, a woollen Tibetan robe."),
    c("扎西", "an old Tibetan herdsman, woollen robe, an old hunting fork."),
    c("小牧童阿索", "a Tibetan herd boy about ten years old, patched little sheepskin vest, a yak-hair sling, a small turquoise bead charm."),
    c("巴登阿妈", "an old Tibetan herb woman, thick woollen robe smelling of herbs, a saffron sachet, a pointed herb pick."),
    c("索朗", "the village blacksmith who shoes every horse, fire-proof leather apron, wolf-sinew wrist guards, a black iron wolf-tooth pendant."),
    c("卓玛", "a Tibetan girl with a single high ponytail, woollen robe, silver earrings, a short hunting spear."),
    c("厉天行", "the master of a blood-blade gang, forty years old, thin, deep-set eyes, heavy leather armor, a tiger-tooth pendant, a broad cruel saber."),
    c(["血刀门徒·初七", "血刀门徒·十三", "血刀门徒·廿三"], "a nameless gang follower known only by a number, bearskin vest, a broken blade, a yak-bone thumb ring, an empty expression."),
    empty(),
  ]),
  sheet("R04", "npc", "黑风寨", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("巴桑", "the leader of a hidden mountain stronghold, an old scar across his face, hard leather caravan jacket, a stronghold token."),
    c("卓央", "the leader's younger sister, married at the edge of the stronghold, pleated leather apron, a woven good-luck cord."),
    c("彭措", "the captain of the practice ground, broad, a heavy back-blade saber, hard leather jacket."),
    c("老阿雅婶", "an old woman who runs the kitchen and doubles as a folk doctor, pleated leather apron, knotted cord bracelets."),
    c("嘎则", "a young girl who keeps a white tiger, flower-dyed cloth dress, a little bell, a tiger-tooth pendant, a lasso coiled on her shoulder."),
    c("贡布", "second-in-command and blacksmith, once a tenant farmer, scorched leather apron, an old abacus-bead bracelet."),
    c("旺堆", "the spymaster and keeper of a hidden store, former caravan man, sheepskin coat with double hidden pockets, a short curved dagger."),
    c("彭老四", "a reckless fighter nicknamed Iron-Claw Hawk, black shirt with hidden iron plates, a rusty chain hook, greedy eyes."),
    empty(),
  ]),
  sheet("R05", "npc", "天都镇（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("赫连铸", "a thuggish man who blocks the town gate to collect tolls, leather wrist guards, a yak-bone thumb ring, a heavy hammer."),
    c("温掌柜", "a woman who owns the jade shop and runs the jade-gambling yard, hard leather caravan jacket, honey-amber bead bracelet, sharp knowing eyes."),
    c("梵衍那", "an exiled Indian prince who leads a mystic sect, fine embroidered inner-court robe, a bell-vajra, a fragment of a palm-leaf sutra."),
    c("罗琦", "the sect's sacred maiden, the prince's adopted daughter, a fragrant gauze robe, an old bronze mirror, a brocade sachet."),
    c("老何", "an inner disciple who used to be a ferryman in Dali, porter's shoulder pads, a brass porter's tag."),
    c("阿雅", "an inner disciple from Burma, simple militia cloth armor, a woven good-luck cord."),
    c("桑杰", "an inner disciple from a Tibetan herders' village, woollen Tibetan robe, a short hunting spear."),
    c("李掌柜", "the owner of the town's tea and incense house who knows everybody, an Indian cotton turban, coin-weighted collar, a gold-bead abacus."),
    c("说书人陈七", "the resident storyteller of the town's teahouse, worn old cloth shirt, a string of copper coins, a small paper knife, animated face mid-sentence."),
  ]),
  sheet("R06", "npc", "天都镇（下）与雾隐寨（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("阿芷", "second-in-command of a flower sect who keeps the gu-poison cellar, tight indigo fighting clothes, a black clay golden-silkworm pendant, a short poisoned whip."),
    c("苏折柳", "the sect's bookkeeper and master of disguise, layered blue scholar's robe, an iron-ribbed ink fan, a small box of disguise masks."),
    c("花婆", "an old flower gardener who is also a poison doctor, batik quilted coat, a purple clay herb pot, a chipped herb trowel."),
    c("小蝉", "a young singing girl who secretly passes messages, an orphan from a Tibetan village, goose-yellow padded jacket, a double copper flower hairpin, a woven bamboo bird whistle."),
    c("龙汐月", "the silver-crowned leader of a southern poison sect, beautiful and ruthless, dark-teal Shu brocade dress with silver threads, an elaborate silver crown, a poison-warding pearl."),
    c("麻九娘", "the sect's deputy leader, gloomy and suspicious, red-patterned poison-silkworm robe, a black iron centipede ring, a barbed hook."),
    c("阿萝", "the sect's herb shopkeeper, sharp-tongued but soft-hearted, indigo herb apron, a silver toad pendant, a bamboo blowpipe."),
    c("乌婆婆", "an old herb elder who guards the ancestral hall, faded hemp herb-drying shirt, an old jade pendant, an ebony pestle staff."),
    c("桑七", "an outside agent of the centipede faction, rhino-hide chest guard, a red centipede bronze plaque, a southern miao saber."),
  ]),
  sheet("R07", "npc", "雾隐寨（下）与天龙营（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("苏小青", "a young herb-picking girl who also works at a wisteria tea stall, thick snake-proof hemp mountain clothes, a realgar charm pouch, a crescent herb hoe."),
    c("厉苍龙", "the current Dragon King leader of a western cult, never without his black armor, dragon-patterned red-bronze war armor, a heavy black iron saber."),
    c("厉苍天", "the former leader, deposed and imprisoned, copying sutras in a stone cell; plain white monk's robe, a jade token of truce, calm worn face."),
    c("贺兰昭", "a female physician of the western valley, soft-hearted and protective, grey-blue cloak, a silver needle pouch."),
    c("姬无双", "a guardian known as the Yaksha, face always veiled in black gauze, black gauze robe, a demon mask hanging at the shoulder, twin hooks."),
    c("樊未离", "a guardian known as the Asura, always alone in a red brocade robe, a red-silk saber."),
    c("任天翔", "a guardian known as the Garuda who commands scouts and hawk messages, camel-wool windproof cloak, a golden wing feather, an iron-feather spear."),
    c("凌香儿", "a female guardian known as the Gandharva who leads rituals and feasts, fragrant cloud-silk dance dress, a pipa, a sachet."),
    c("罗那", "a guardian known as the Kinnara who hides behind singing in the guest tents, camel-wool cloak, a silver-stringed instrument, a small silver bell."),
  ]),
  sheet("R08", "npc", "天龙营（下）与雪山派（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("罗蛇君", "a guardian known as the Mahoraga who raises snakes in a cave, python-skin soft armor, a snake-eye stone ring, a serpent staff."),
    c("呼延雪", "the youngest female disciple of a snow-mountain sect, quiet; skin snow-white from never seeing strong sun, a plain silver hairpin shared by outer disciples, a pause-before-speaking stare, light practice clothes even in deep winter, a sword tassel."),
    c("玄女", "a woman in white by a hot spring behind the mountain, red eyes, very few words, a white fox-fur cloak, a plain silver neck ring."),
    c("陆寒枝", "the eldest male disciple and practice-hall instructor, strict outside and suffering inside, frost-iron chest guard over a plain cotton robe, a bronze ruler plaque."),
    c("沈既白", "the third disciple who keeps the stores and buys supplies, dark-blue yak-hide jacket, a brass snow-pattern abacus pendant, a short sword."),
    c("齐照野", "an old one-armed sword-keeper who has guarded the sword pavilion for thirty years, patched sheepskin coat, an old black iron key."),
    c("穆怀青", "the second disciple who leads mountain patrols, cold outside and careful inside, snow-fox fur shoulder guard, a plain jade pendant, a thin cold-iron sword."),
    c("关晚棠", "a female senior disciple who keeps the sect's records, plain cotton robe, cold-iron wrist guards."),
    c("石墩儿", "the youngest boy of the sect who does the guest-house chores, round sturdy face, plain cotton robe, a pine-wood practice sword."),
  ]),
  sheet("R09", "npc", "雪山派（下）与雅江（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("何雨谢", "the sect master's wife; a few strands of early white hair at her temples, a gentle and considerate expression that shows quiet strain, an old string of prayer beads on her wrist, fair skin, a snow-leopard fur cloak, fingers straightening her collar."),
    c("一清道长", "the head of a Taoist sword sect, white eyebrows, sect Taoist robe, a green bamboo staff."),
    c("青霞子", "the former head, retired into the practice hall, Taoist robe, a pine-pattern sword, an otherworldly calm."),
    c("持堂道人", "a handyman Taoist who keeps the practice-hall keys, plain training clothes, an old vine staff."),
    c("青玄", "a young female sword disciple who has lost to her instructor forty-seven times, training clothes, a pine-pattern sword, stubborn eyes."),
    c("挂单道人", "a wild wandering Taoist who sleeps on a rope bridge, shabby militia cloth armor, a peach-wood charm."),
    c("松鹤道长", "the sword-ground instructor with a fiery temper, training clothes under a Taoist robe, a crane-cry sword."),
    c("玉真子", "the master of the herb garden who calls swords needles, Taoist robe, a roll of thirteen needles."),
    c("老道士", "an old gatekeeper Taoist who has swept the steps for forty years, plain clothes, a broom-worn hand, a peach-wood charm."),
  ]),
  sheet("R10", "npc", "雅江（下）、蜀南唐堡与唐三少", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("青衣楼老板娘", "the woman who owns an old cold-pot fish restaurant, pleated leather apron, coin-weighted collar, a tea knife."),
    c("骡马夫", "a mule driver at the west-gate post station, oiled-canvas caravan cloak, porter's shoulder pads."),
    c("护谷弟子", "a young sword disciple who guards a panda valley, training clothes, a pine-pattern sword."),
    c("唐老太", "the seventy-year-old head of a hidden-weapon clan, uses an embroidery needle as a weapon, fragrant gauze robe, a black wooden case, a silver hidden-weapon pouch."),
    c("唐伯渊", "the forty-five-year-old manager of the clan's second branch who sells hidden weapons outside, silk robe with a soft silver chest guard, a gilded mechanism fan, a jade poison ring."),
    c("唐听竹", "a young mechanism maker whose right ear was hurt by a crossbow in childhood, leather work apron, a brass measuring-ruler pendant."),
    c("唐仲衡", "the clan's law-enforcing elder who holds the keys to the secret archive, grey hemp robe, a ring of bronze keys, an iron poison staff."),
    c("陈默", "a mute outsider smith who talks with a charcoal stick, thick buckskin chest guard, a wooden tablet with a broken corner."),
    c("唐三少", "a young, quiet shopkeeper in a back-alley store, regulation soft armor, coin-weighted collar, a hidden-weapon pouch, an emei piercer."),
  ]),
  sheet("R11", "npc", "锦官城·峨眉", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("玄尘师太", "a sixty-year-old Buddhist nun who heads her sect, thin, eyes like a sword, plain blue robe, bodhi-seed beads."),
    c("照微", "the sect's first disciple, twenty years old, beautiful and gentle, the fiercest sword of them all, fragrant gauze robe, a gilded silver hairpin."),
    c("虚白道姑", "a Taoist nun who leads the sect's Taoist branch, Taoist robe, a silver prayer wheel, a charm pouch."),
    c("了因师太", "a nun who runs the Buddha hall and teaches a calming chant, iron-mesh monastic robe, prayer beads, a peach-wood charm."),
    c("铁莲和尚", "a monk who inherited the sect's spear, the only man copying sutras in the sword hall, iron-mesh robe, a red-tasselled spear."),
    c("司徒瑛", "a fighter who claims descent from a white-ape grandmaster, training clothes, knotted cord bracelet, an ebony whip."),
    c("净莲", "a receptionist nun who keeps the register and serves tea, flower-dyed cloth robe, prayer beads, an old charm."),
    c("簪娘", "an old woman in the back yard who forges emei piercers and sells them as hairpins, leather wrist guards, a gilded silver hairpin."),
    c("陈九", "a young male disciple on his eighty-seventh day of copying sutras who has never touched a sword, militia cloth armor, an ox-bone ring, a hopeful face."),
  ]),
  sheet("R12", "npc", "锦官城·官府与广汉（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("柳青鸢", "the city's chief magistrate's agent, plain blue robe, an official lady's hairpin, a private seal on a cord."),
    c("侯敢", "head of the magistrate's runners, constable's black uniform, a regulation waist saber, a patrol tally."),
    c("孙文墨", "a criminal-law secretary of the old school sent from the provincial capital, dark-blue satin secretary's gown, a pair of polished walnuts, an ebony iron-ribbed fan."),
    c("裴九江", "chief constable of the northern patrol who also drills the martial school, black-iron rhino-hide armor, a bronze tiger tally, twin iron rulers."),
    c("宋小乙", "a young constable who frequents a teahouse and runs messages west, dark-blue light uniform, a red-cord bell anklet, a light goose-feather saber."),
    c("沈归尘", "an old archive clerk, secretary to a superior who vanished years ago, plain grey thick cotton robe, tortoiseshell reading glasses."),
    c("纵目者", "a mysterious figure seated at the top of a bronze tree, wearing a golden bronze mask with protruding cylindrical eyes, a ritual robe, an ancient bronze mirror."),
    c(["青铜面人·甲", "青铜面人·乙", "青铜面人·丙"], "a disciple wearing a bronze mask with protruding eyes who never speaks and answers only with the sword, regulation armor, an agate plaque."),
    c("樊枯", "an elder who has guarded a bronze furnace for sixty years, hands full of burn scars, an asbestos apron, a red-bronze branding seal."),
  ]),
  sheet("R13", "npc", "广汉（下）与殷如月", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("姜泠", "a listener who walks the boundary stones outside the ruins, light hemp robe, a small bronze mirror with a sun-bird pattern, a willow-leaf bronze sword."),
    c("严九斤", "an eight-pouch beggar elder who leads the branch, patched eight-pouch robe, a purple leather gourd at the waist, an oiled bamboo staff."),
    c("周小满", "a five-pouch beggar who keeps the branch's intelligence ledgers, short blue jacket, a brass monocle, an iron abacus ruler."),
    c("胡三爷", "a six-pouch law elder with one leg, an old salt-smuggler's leather vest, a black iron crutch."),
    c("白婶", "a four-pouch woman who runs the porridge kitchen and charity house, indigo oilcloth apron, a big iron ladle."),
    c("多吉", "a two-pouch new beggar who escaped from a Tibetan village, patched sheepskin vest, a yak-horn pendant with a broken tip."),
    c("哑巴七", "an old three-pouch beggar who keeps the boundary pact, solitary and silent, an old straw rain cape, a small bronze bell."),
    c("秦小鹊", "a four-pouch female beggar with a wine gourd and lotus clappers, a patched peach-pink short jacket, a string of jingling coins."),
    c("殷如月", "a hooded envoy of a western sect who slipped into the region to look for treasure, a deep hood shading her face, a cloak, a hint of a red sash."),
  ]),
  sheet("R14", "npc", "走兽", BEAST_FORMAT, PORTRAIT_AVOID, [
    c("大公鸡", "a glossy, combative village rooster, proud upright comb."),
    c("雪豹", "a snow leopard, pure white fur with pale grey rosettes, pale blue-grey vertical-pupil eyes, an old healed wound on one forepaw visible at the bottom edge."),
    c("珍珠", "a small pure-white pony with a gentle face, a simple rope bridle and a small saddle with Tibetan patterns."),
    c("虎王", "a huge tiger of the hot-spring hills with hanging brows and a white-marked forehead, massive and calm."),
    c("狼王", "a giant silver-grey one-eyed wolf of the deep grassland."),
    c("白猿", "an old ape with pure white fur from the foot of a snow cliff, wise ancient eyes."),
    empty(), empty(), empty(),
  ]),
  sheet("R15", "npc", "游走人物（一）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("张商人", "a travelling cloth merchant who has crossed the land north and south, a bolt of cloth over his shoulder."),
    c("花嫂", "a Tibetan woman who sells tsampa, headscarf, a basket of tsampa."),
    c("大胡子朱四", "a big-bearded caravan leader."),
    c("刀疤镖师", "an old escort guard with a saber scar across his face."),
    c("愣头侠客", "a young, hot-headed wanderer of the martial world."),
    c("归隐剑客", "a recluse swordsman who no longer cares for the world."),
    c("来访武者", "a visiting swordsman who came to spar with the snow-mountain sect."),
    c("油嘴小贩", "a smooth-talking peddler of sundries with a pack on his back."),
    c("乞丐老七", "a vagrant who wanders around the village."),
  ]),
  sheet("R16", "npc", "游走人物（二）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("戏班旦角", "a female lead of an opera troupe in stage makeup."),
    c("落第书生", "a scholar who has failed the exams again and again, worn scholar's robe."),
    c("杂耍艺人", "a street acrobat of the martial world."),
    c("赶马人阿旺", "a Tibetan man who drives mules along the roads."),
    c("行脚僧", "a wandering monk travelling everywhere."),
    c("香客老夫人", "an elderly lady pilgrim come to fulfil a vow, holding incense."),
    c("磕长头的朝圣者", "a Tibetan pilgrim who prostrates all the way, leather apron and wooden hand pads."),
    c("游方道人", "a wandering Taoist of unknown sect."),
    c("街头混混", "a petty street tough who scrapes a living in the city."),
  ]),
  sheet("R17", "npc", "游走人物（三）与原创冒险者（一）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("老兵退伍汉", "a discharged old soldier drifting on the roads."),
    c("锦官差役", "a city runner who only buys raw weapon blanks."),
    c("雪山弟子", "a young snow-mountain sect disciple who trades by barter."),
    c("黑风寨采买", "a sturdy buyer from a mountain stronghold who pays in favours."),
    c("苏宛", "a girl from a tea shop, a regular at the jade yard."),
    c("兰姐", "the head of a flower sect who fled from Kunming."),
    c("燕绾烟", "a slippery female thief among the flowers who steals treasure and hearts."),
    c("陆濯尘", "a lone swordsman of the snow mountains, cold as frost."),
    c("顾狂澜", "a wandering gambler with saber and wine gourd."),
  ]),
  sheet("R18", "npc", "原创冒险者（二）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("沈弄枢", "an eerie craftsman who takes bones apart and rebuilds puppets, sees the living as wooden dolls."),
    c("萧沉戟", "an old soldier still in his worn armor, whose word is worth a thousand gold."),
    c("裴炽野", "a hot-blooded boxer who fights every injustice."),
    c("沈濯清", "a Confucian doctor who treats the poor for free."),
    c("裴惊蛰", "a strange doctor who raises snakes and brews poison, saves or kills on a whim."),
    c("崔市隐", "an accountant with a smile hiding a knife."),
    c("素商", "a lone night-walker who guards ancient Shu tombs, ruthless and silent."),
    c("厉苍山", "an old martial instructor for whom rules are above heaven, rough outside and careful inside."),
    c("虞照夜", "a peerless female singer with a pipa that understands people."),
  ]),
  sheet("R19", "npc", "原创冒险者（三）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("白染霜", "an icy swordswoman who walks on snow without a trace, keeps strangers away."),
    c("云霁微", "a charming shopkeeper whose glance always calculates."),
    c("叶轻崖", "a bold swordsman who hates evil, sword fast as wind."),
    c("曲幽竹", "a demoness of the southern hills covered in poisons, greedy and unpredictable."),
    c("曲灵犀", "a candidate sacred maiden of a poison sect whose body gives off a strange fragrance."),
    c("燕烈", "a banner-holder of a fire sect, red clothes, a fiery temper."),
    c("白凌霜", "a swordswoman of the far western mountains searching for a rare lotus, solitary sword style."),
    c("曲艳丝", "a gu-poison woman who moves between the white and black ways."),
    c("聂秋红", "a fiery heroine chasing a traitor across a thousand miles, quick-tempered and hard."),
  ]),

  // 雪域人物（替换 #673 雪域少年 20 张、#679 驻场人物 30 张）：每格照 R01 句式写——
  // 年龄段+族属与性别+身份、一处体貌记号、一个表情或动作、衣料主色加对比色、一件标志物，
  // 全部取自游戏设定；同一张九宫格里老少、男女、胖瘦、汉藏、冷暖色错开排，防止同脸。
  sheet("R20", "npc", "打箭炉（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("守关把总赵铁山", "a Han frontier garrison captain in his mid-forties, square heavy jaw, thick black moustache, mouth open mid-shout, a dented iron helmet pushed back, a dark indigo padded uniform under a red-lacquered lamellar vest, holding a blank tea-trade permit slip up to the light to check it."),
    c("格桑央绒", "a young Khampa woman of about twenty-two, the bold heir of a tea-and-salt caravan, broad cheekbones, wind-reddened cheeks, a loud laughing mouth, thick braids threaded with red tassels, a sheepskin-lined leather caravan coat with crimson trim, a big red coral bead string, one hand raised to halt a caravan, the head of a black-and-tan mastiff at her side."),
    c("炉城歌女拉姆", "a cheerful Tibetan folk singer in her early twenties, round bright face, laughing crescent eyes, one hand cupped beside her mouth mid-song, a turquoise-and-coral headdress, a sky-blue silk blouse under a black robe, a striped rainbow apron, one long braid over her shoulder."),
    c("说书瞎子阿吉", "an old blind Han storyteller, eyes closed above a thin knowing smile, wispy white goatee, gaunt cheeks, a faded grey-green cotton gown, a small dark wooden clapper block lifted in one hand, head tilted as if listening to the room."),
    c("马跃川", "a lean, quick young Han escort rider of about twenty, sharp narrow face with a laughing grin, a high topknot tied with a scarlet band, leather wrist guards, dust on his collar, a heavy broad-backed saber resting on his shoulder."),
    c("锅庄大掌柜兰措", "a capable Tibetan woman in her forties who runs the biggest caravan inn, sharp knowing eyes and a half smile, hair coiled under a fox-fur hat, a deep plum silk robe with a gold brocade collar, a heavy amber and turquoise necklace, flicking through an account book with one finger."),
    c("藏医老彭措", "a quiet old Tibetan doctor around seventy, small frame, nearly bald with a few white bristles, deep laugh lines, round brass-rimmed spectacles, a maroon robe with a sheepskin collar, holding up a small brass medicine spoon and a cloth pill pouch."),
    c("康巴总教头·扎巴", "a massive broad-shouldered Khampa martial instructor in his mid-forties, flat broken nose, a red wool cord wound around his head, a calm heavy gaze, a sheepskin robe worn off one shoulder over a muscled arm, a thick leather wrestling belt, a heavy saber held point-down before him."),
    c("炉城铁匠郭三", "a stocky Han blacksmith in his thirties, soot-streaked cheeks, eager wide-open eyes, sleeves rolled over scarred forearms, a scorched leather apron, gripping tongs that hold a glowing arrowhead up near his face."),
  ]),
  sheet("R21", "npc", "打箭炉（下）与丹霞城（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("调停客宗喀", "a composed Tibetan mediator in his fifties, long face, a neatly trimmed grey beard, measured narrow eyes, a plain slate-grey robe with three small cords of red, white and black tied at the chest, three folded agreements held between his fingers."),
    c("朱弦", "a slim, fair-skinned young Han woman of about twenty-four, a gentle soft smile that does not reach her watchful eyes, hair in a neat low bun with a single plain iron pin, a dark teal travelling robe with a silver-grey sash, long pale fingers holding half of a bronze tally token."),
    c("阿洛扎西", "a lanky Khampa youth of about twenty with a lazy half-lidded smile, messy shoulder-length hair under a crooked felt hat, leaning on one elbow, a coil of ox-sinew rope over his shoulder, a red coral string and a striped agate bead at his throat, battered leather caravan armor."),
    c("收租管事·旺堆", "a pinch-faced Tibetan rent steward in his forties, thin moustache, tight-lipped frown, a small square hat, a red-white-blue striped estate sash over a plain brown robe, an abacus held up mid-click."),
    c("白玛令仪", "a graceful young woman of about twenty-one, half Tibetan and half Han, delicate oval face, calm focused eyes, hair in two loops pinned with a paintbrush, a white robe with red and blue striped borders, a cinnabar-red brush lifted near her cheek and a roll of blank paper under her arm."),
    c("雕版老匠人根秋", "a stubborn old woodblock carver around seventy, bushy white eyebrows in a deep frown, a short grey beard, fingertips stained cinnabar red and pine-soot black, a coarse indigo work smock, holding a carved birch printing block up to inspect it."),
    c("赤桑多杰", "a heavy-boned young Tibetan guard of about twenty with a square face and bright fierce eyes, cropped hair, a thick neck, a red-white-blue striped robe over plain armor, a gilded bronze throwing wheel held up beside his head."),
    c("昆·索朗坚赞", "a strict Tibetan noble official in his mid-thirties, thin straight nose, lips pressed together, neat short hair under a tall brocade hat, a deep crimson robe edged with red, white and blue bands, one hand raised palm-out as if posing a question."),
    c("云丹梅朵", "a sharp young Tibetan noblewoman of about twenty-two, high cheekbones, one eyebrow raised in disbelief, a single heavy braid wound with gold thread, a blue-grey brocade robe with red and white stripes, a small brass balance scale held up between two fingers."),
  ]),
  sheet("R22", "npc", "丹霞城（下）与焚风渡（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("金轮护法·达尔巴", "a towering Tibetan guardian elder in his late fifties, huge bald head, thick grey beard, scars across both eyebrows, a crimson shawl over gold-trimmed armor, a pair of gilded bronze throwing wheels held against his chest."),
    c("大轮法王·卓玛嘉", "a proud Tibetan woman martial grandmaster around forty, unmistakably a woman, strong straight brows, cool half-closed eyes and a faint disdainful smile, many fine braids gathered high with gold rings, a deep red and white striped robe, five small golden throwing wheels fanned in one hand."),
    c("洛桑曲培", "a cheeky young monk of about fifteen with a shaved head and big ears, a wide grin, clapping his hands together mid-debate, a maroon robe with a red-white-blue striped shawl, a sutra book open on his forearm."),
    c("昆·阿旺班智达", "a refined, thin Tibetan scholar in his fifties, gaunt elegant face, a wire-thin moustache, a faint amused smile, a yellow scholar's hat with long side flaps, a maroon robe, striking one palm with the other in debate."),
    c("昆·法王丹巴坚赞", "a dignified old hierarch of about sixty-five, heavy-lidded unreadable eyes, deep lines, a long white beard, a tall red and gold ceremonial hat, layered red, white and blue brocade robes, a gilded ritual sceptre held calmly at his chest."),
    c("摆渡老汉多吉", "a lean, sun-blackened old ferryman in his sixties, wiry neck, a gap-toothed grin, a sweat-stained dark cloth wrapped around his head, bare sinewy arms, a short wooden pole over his shoulder and a coracle rope coiled across his chest."),
    c("牧场头人仁青", "a big, round-faced herder chief in his late thirties, ruddy cheeks, a kind simple smile, a thick neck, a white yak-hair felt coat with a fur collar, a heavy skin bag of butter hugged in both arms."),
    c("仁杰洛布", "a slick young gold-trade gang leader of about twenty-one, a smirking sidelong look, one gold tooth, sun-bleached hair tied back, an open white yak-fur coat over a dark red shirt, a deerskin pouch of red-gold dust held up with a little spilling through his fingers."),
    c("索央踏浪", "a quick-footed herd girl of about sixteen, freckled sun-browned face, cheeks puffed in a competitive pout, short choppy hair tied with a white ribbon, a white fur jacket, a copper short blade at her hip, one hand on the forehead of a white yak calf."),
  ]),
  sheet("R23", "npc", "焚风渡（下）与琼隆古墟（上）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("盘道人·白衣赤列", "a stern old gatekeeper monk in his sixties, gaunt face, long white hair loose over the shoulders, piercing eyes and a hard straight mouth, a snow-white single-layer cotton robe, one finger raised in challenge."),
    c("拜火大迦叶·燃灯", "a fiery master in his mid-fifties, broad face, a burn scar along one eyebrow, a thick black beard streaked with grey, a white robe with copper-orange borders, firelight on his face, a short copper saber held across his chest."),
    c("玉珍桑果", "a tall, strong young woman of about twenty-two, senior sister of a white-robed order, sharp fearless eyes, warm brown skin glowing as if with inner heat, hair cropped at the jaw, a thin white cotton robe tied at one shoulder, blowing a small bone whistle."),
    c("拜火三迦叶·明空", "a silent ancient monk of about seventy-five, very thin, eyes closed, long white eyebrows hanging past his eyes, a white robe gone ivory with age, one ear turned forward as if listening to someone breathe."),
    c("拜火二迦叶·灿莲", "a hot-tempered martial monk in his thirties, shaved head, flushed cheeks, eyebrows drawn together in impatience, rolling a white sleeve up over a muscled forearm, faint steam rising from the skin."),
    c("寻访使·楚臣", "a much-travelled envoy in his forties, weather-cracked lips, crow's-feet from squinting at snowfields, a wide-brimmed felt hat, a white robe under a travel-worn fox-fur cape, a small copper reliquary box in his hands."),
    c("转世法王·白衣少年", "a serene seventeen-year-old reincarnate master, slim and pale, a smooth youthful face, a faint distant smile, eyes lifted toward the moon, a single thin white cotton robe, one hand raised with the index finger pointing upward."),
    c("多杰砾", "a hard-faced young treasure digger of about twenty-one, grey rock dust caked on his cheeks and hair, a cold sneer, a notch cut in one ear, black stone-plate armor, a long iron digging spike over his shoulder."),
    c("逆行护法·琼波", "a stubborn bridge guardian in his thirties, jutting chin, arms crossed, eyebrows knitted, long black hair in one thick plait, a black felt robe with turquoise trim, a heavy dark bronze prayer wheel at his belt."),
  ]),
  sheet("R24", "npc", "琼隆古墟（下）", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("天铁匠首·贡布", "a soot-blackened master smith in his forties, eyes blazing white against the soot, burly arms, a black leather apron studded with iron, a lump of dark meteoric iron held up, glinting silver."),
    c("曲珍石燕", "a wiry teenage cliff scout of about seventeen, small sharp face, a mischievous grin, a smudge of charcoal on her nose, a black feathered cap, two tight braids, a black stone-plate vest, a sketchbook and a charcoal stick in her hands."),
    c("九乘长老·木雅仲巴", "a rigid old elder in his sixties, back straight as a pillar, long narrow face, thin pressed lips, iron-grey hair in a tight topknot, a black robe with deep blue lining, a black bronze plaque held upright before his chest."),
    c("央青阿若", "a smiling young stone appraiser of about twenty-three with knowing eyes, a long elegant neck, hair wrapped in a black-and-turquoise headcloth, turquoise earrings, a black robe with copper buttons, a polished black stone held out on her palm."),
    c("铁钎掘藏师·阿旺", "a sharp-eyed treasure hunter in his forties, a layer of pale ancient dust on his clothes and eyebrows, a hooked nose, a canny half grin, a leather cap with a small lamp clip, rolled sheepskin scrolls tucked under one arm."),
    c("平措乌金", "a chubby-cheeked boy of about sixteen with a stubborn pout, close-cropped hair, flour on his hands and sleeves, a black felt vest over a dark blue shirt, a small hard barley-dough yak figure with an extra pair of ears held up in his fingers."),
    c("九算神婆·雍措", "an old diviner woman in her sixties, a sly crooked smile, one eye squinting, a wrinkled face, long grey hair braided with knotted cords, a heavy dark robe, a scorched sheep shoulder-blade held up to look through its cracks."),
    c("象雄大宗主·桑吉坚赞", "a very still old patriarch around seventy, dark skin, deep-set eyes as dark as the night sky, a short white beard, a tall black hat with a small golden bird crest, layered black and deep blue robes, hands folded over a black bronze sceptre."),
    c("金翅武师·阿古顿巴", "a martial instructor in his thirties wearing a black wooden great-bird mask over the upper face, a broad grin beneath it, a strong jaw, a black robe with gold feather trim, flicking a hard barley-dough pellet up with his thumb."),
  ]),
  sheet("R25", "npc", "白塔与焚风渡少年", PORTRAIT_FORMAT, PORTRAIT_AVOID, [
    c("丹增云措", "a handsome young Khampa nobleman of about nineteen, an open, delighted face gazing up at the sky, long black hair tied with a gold band, a blue-and-white wool cloak over a maroon iron-mesh guardian robe, a short green bamboo staff, a white falcon perched on his raised forearm."),
    c("卓嘎听雨", "a quick-witted girl of about seventeen with a playful wink, a small upturned nose, damp hair under a rain-darkened felt hood, a heavy white yak-wool cloak, a small bronze wind-bell hanging from a sword hilt held up beside her ear."),
    c("达杰听风", "a sunburnt young rafter of about nineteen with a big goofy grin and a chipped front tooth, wet tousled hair, a thin white cotton robe hitched up and knotted, a copper blade on his back, a sleek river otter climbing onto his shoulder."),
    c("沈照铃", "a lively young Han woman of about eighteen, quick bright eyes and a small smile, an ink smudge on her chin, hair half up with a pale green ribbon, a grey iron-mesh robe over a white inner shirt, one palm pressing a sheet of rubbing paper flat against the wind."),
    c("洛丹嘉木", "a small novice monk of about fourteen with a shaved head, eyes closed and head tilted, listening, a sweet calm face, a maroon guardian robe with a brown wool shawl, a string of small bronze bells held up to his ear."),
    empty(),
    empty(),
    empty(),
    empty(),
  ]),

  sheet("B01", "building", "客栈、饭馆、茶馆、驿站", BUILDING_FORMAT, BUILDING_AVOID, [
    c("inn", "a two-storey timber inn with a lantern over the door and a stable yard to the side."),
    c("restaurant", "a small eatery with steam rising from the kitchen, a wine banner without writing, benches outside."),
    c("teahouse", "a teahouse with open shutters, low tables, a storyteller's empty chair at the back."),
    c("transport", "a post station with a hitching rail, saddled mules, a cart with a canvas cover."),
  ]),
  sheet("B02", "building", "武馆、镖局、铁匠铺、铸剑坊", BUILDING_FORMAT, BUILDING_AVOID, [
    c("wuguan", "the gate of a martial arts school opening onto a practice yard with wooden posts and a weapon rack."),
    c("escort", "an escort agency compound with loaded carts and a closed heavy gate."),
    c("smithy", "a blacksmith's open shop, the forge glowing orange-red, an anvil, horseshoes on the wall."),
    c("forge", "a sword forge, a long quenching trough, blades cooling on a rack, sparks drifting."),
  ]),
  sheet("B03", "building", "商行、粮行、成衣铺、珠宝行", BUILDING_FORMAT, BUILDING_AVOID, [
    c("shop", "a trading house with bales of tea and cloth stacked by the door."),
    c("grocery", "a grain shop with open sacks of barley and highland barley, wooden measures."),
    c("cloth", "a tailor's shop with robes hanging, bolts of cloth on shelves."),
    c("jewelry", "a jeweller's shop with turquoise, coral and silver pieces glinting in a glass-less wooden case."),
  ]),
  sheet("B04", "building", "钱庄、当铺、古玩店、黑市", BUILDING_FORMAT, BUILDING_AVOID, [
    c("bank", "a money house with a high counter behind bars and stacks of silver ingots."),
    c("pawn", "a pawnshop with a very high counter, a small window, pledged objects tagged on shelves behind."),
    c("antique", "an antique shop crowded with bronzes, porcelain and scrolls rolled up."),
    c("blackmarket", "a black market in a lantern-lit back alley, goods on cloth spread over the ground, hooded silhouettes."),
  ]),
  sheet("B05", "building", "药堂、医馆、大殿、藏经阁", BUILDING_FORMAT, BUILDING_AVOID, [
    c("medicine", "a medicine shop with a wall of small herb drawers, a scale, dried herbs hanging."),
    c("hospital", "a clinic with a treatment bed, needles laid on cloth, a pot of decoction on a stove."),
    c("temple", "the main hall of a Tibetan monastery, rows of butter lamps, a dim golden statue far inside."),
    c("library", "a scripture library with long wrapped sutra bundles on dark shelves, a single lamp."),
  ]),
  sheet("B06", "building", "赌坊、戏楼、告示榜、拍卖行", BUILDING_FORMAT, BUILDING_AVOID, [
    c("gambling", "a gambling house with dice bowls on tables and a crowd as dark silhouettes."),
    c("theater", "an opera house stage with a curtain, lanterns along the eaves."),
    c("bounty", "a public notice board under a small roof, papers pinned on it with no readable writing."),
    c("auction", "an auction hall about seventy percent full, an object on the stage still covered with red cloth."),
  ]),
  sheet("B07", "building", "玉石料场、门派商坊、拜师堂、鸽子笼", BUILDING_FORMAT, BUILDING_AVOID, [
    c("gamblestone", "a jade stone yard, rough jade boulders in rows, a cutting wheel, buyers' lamps."),
    c("sectshop", "a sect's shop inside a mountain gate selling the sect's own goods, plain and orderly."),
    c("sect_entry", "a hall for taking a master, a single empty seat at the head, incense smoke."),
    c("pigeon_coop", "a pigeon coop at a post station, rows of wooden cages, grey pigeons settling for the night."),
  ]),
  sheet("B08", "building", "烹饪台、库房、盛会、地宫", BUILDING_FORMAT, BUILDING_AVOID, [
    c("kitchen", "a stove with a burning firebox and an empty wok waiting for ingredients, spice jars around it."),
    c("chest", "a storeroom with wooden chests and sealed jars, a heavy lock on the door."),
    c("festival", "a festival ground at night with a wrestling stage, rows of lanterns and banners without writing."),
    c("dungeon", "the dark stone entrance of an underground palace sealed for centuries, a faint draft, broken carvings."),
  ]),
  // 家园设施：键名 = "home-" + 设施 id（domain/rules/map/homestead.js 的 HOMESTEAD_FEATURES），
  // 同一 id 在几处家园共用一张图；garden 在四处分别叫菜畦、松院、花坛、银杏院，画成通用小庭院。
  sheet("B09", "building", "家园（上）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("home-cooking", "a home kitchen: a clay stove with embers still glowing in the firebox, an iron wok and a copper kettle on top, a chopping board beside it."),
    c("home-wine", "a cool half-underground stone cellar behind a kitchen, clay wine jars sealed with cloth, moss on their rims."),
    c("home-garden", "a small walled courtyard garden: a stone path, a few planted beds, one old tree with a bench beneath it, quiet and tended."),
    c("home-fireplace", "a fireplace in a sitting room with pine logs crackling, warm light spilling across the floorboards, a dusty cushioned chair."),
  ]),
  sheet("B10", "building", "家园（中）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("home-telescope", "a brass telescope on a tripod by an open window, facing a misty mountain valley."),
    c("home-training", "a small practice yard with wooden training posts and a stone lock, the posts scarred by blades and fists, an old plum tree in bloom at the edge."),
    c("home-study", "a simple study: a writing desk with brush, ink stone and paper, a shelf with a few books on inner cultivation, one lamp."),
    c("home-library", "a library room in an old manor: tall shelves of thread-bound local gazetteers and rolled old maps, one volume open on the desk under a lamp."),
  ]),
  sheet("B11", "building", "家园（下）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("home-guqin", "a guqin zither on a low table beneath a window, three of its strings broken and curling loose."),
    c("home-meditation", "a small household Buddhist hall: a white porcelain Guanyin figure, a censer of cold ash, a worn meditation cushion on the floor."),
    empty(), empty(),
  ]),
  // 雪域四地建筑专图（#663）：格号即建筑 id，切出后存成 public/art/building/<id>.webp，
  // 对上 BUILDING_ID_ART 的专图登记（优先于类型图）。仍是夜里平视门脸，四边渐隐进近黑。
  sheet("B12", "building", "打箭炉（上）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("inn_dajianlu", "the largest caravan inn of a tea-trade town: a two-storey flat-roofed stone courtyard with a timber gallery, horses stabled and brick tea stacked on the ground floor, lamplight along the upper gallery."),
    c("restaurant_dajianlu", "a soup house with steam pouring out of the doorway, a big copper pot of yak-bone broth simmering over a fire just inside, low benches by the door."),
    c("teahouse_dajianlu", "a big flat-roofed teahouse held up by stone pillars, shutters open, long low tables with butter-tea churns and teapots set side by side."),
    c("transport_dajianlu", "an official tea-and-horse post station, a heavy iron-studded gate, fast horses and mules tied at the rails, packs of brick tea ready for loading."),
  ]),
  sheet("B13", "building", "打箭炉（中）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("wuguan_dajianlu", "a martial yard at the foot of a mountain enclosed by huge square stone pillars, racks of heavy single-edged sabres and a packed-earth wrestling ring."),
    c("forge_dajianlu", "an old government forge whose bellows are driven by a river waterwheel, sparks lighting half a stone wall, bundles of heavy arrow shafts and a few metal throwing wheels on the bench."),
    c("shop_dajianlu", "a jewel trading house with a heavy woven wool curtain over the door; on the counter behind it, shallow trays of turquoise, red coral and banded agate beads."),
    c("medicine_dajianlu", "a highland medicine shop on a fur traders' street, pelts hanging outside the door, inside shelves of dried herbs and small cloth pill bags."),
  ]),
  sheet("B14", "building", "打箭炉（下）、丹霞城（上）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("bounty_dajianlu", "a flat-roofed meeting hall held up by eight monolithic stone pillars, blank paper notices pinned along one wall, three banners of different muted colors at the door."),
    c("shop_danxiacheng", "an estate granary and store of red sandstone, open double doors showing sacks of barley, blocks of pink-red rock salt and rolls of woven wool cloth."),
    c("inn_danxiacheng", "a flat-roofed stone-pillared inn in a red-earth outer town, merchants' mules tied outside, a lamplit doorway."),
    c("library_sajia", "a woodblock printing workshop: racks of carved birch printing blocks, long benches, bowls of cinnabar-red ink, printed sheets drying on lines."),
  ]),
  sheet("B15", "building", "丹霞城（中）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("sect_entry_sajia", "a massive flat-roofed stone city gate, the wall painted with broad horizontal bands of muted red, white and blue-grey, a dark fringe of dried tamarisk twigs along the parapet."),
    c("temple_sajia", "the main hall of a noble lineage: eight vermilion-painted monolithic stone pillars, a parapet of dark tamarisk twigs and small gilded victory banners on the roof, one empty stone seat inside."),
    c("wuguan_sajia", "a training hall whose stone pillars are scarred with deep cuts from spinning metal wheels, a rack of metal throwing wheels by the wall."),
    c("sectshop_sajia", "a side courtyard held up by twelve thick stone pillars where guardians' gear is issued: metal throwing wheels and ritual implements on plain shelves."),
  ]),
  sheet("B16", "building", "丹霞城（下）、焚风渡（上）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("bounty_sajia", "a half-official magistrate's hall: a black lacquered judge's desk beside a rack of wooden disciplinary rods, ledgers stacked high, a single lamp."),
    c("chest_sajia", "a locked treasury room in a tower: iron-bound chests, a jade seal resting on a cushion, a stack of iron tally tablets, a heavy lock on the door."),
    c("inn_fenfengdu", "a ferry-side inn of stone and timber with a flat roof, yak-hide coracles leaning against its wall, warm light from the door."),
    c("shop_fenfengdu", "a riverside market on a stony beach where gold panners trade: sluice boxes, small balance scales, sacks of salt and knives laid out on a cloth."),
  ]),
  sheet("B17", "building", "焚风渡（中）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("restaurant_fenfengdu", "a gorge tavern where a copper brazier never goes out, yak ribs roasting over the fire, jugs of barley spirit on the counter."),
    c("sect_entry_gaju", "a pure white flat-roofed mountain gate at the top of a long stone stair, a hundred white banners streaming in the wind."),
    c("wuguan_gaju", "a white training hall with a great bronze fire bowl blazing in the center, plain stone benches around it."),
    c("sectshop_gaju", "a long white-pillared cloister where white robes and short copper sabres are laid out on stone benches."),
  ]),
  sheet("B18", "building", "焚风渡（下）、琼隆古墟（上）", BUILDING_FORMAT, BUILDING_AVOID, [
    c("hospital_gaju", "a white stone pool fed by a snow spring, steam rising off the water into the cold night, folded wet robes on its rim."),
    c("temple_gaju", "a huge flat rock terrace jutting out over a gorge at the edge of a white compound, a cold moon above, one prayer cushion on the stone."),
    c("inn_qionglong", "a black stone guesthouse whose hearth always burns juniper and wormwood, smoke curling up from the flat roof, furs and ore sacks by the door."),
    c("shop_qionglong", "a stone-slab street market of an old highland people, white yak skulls hung over the doorways, lumps of ore, bone tools and barley sacks on display."),
  ]),
  sheet("B19", "building", "琼隆古墟（中）", BUILDING_FORMAT, BUILDING_AVOID.replace("no frames around cells.", "no frames around cells, no swastika symbols."), [
    c("forge_qionglong", "a mountain forge working dark meteoric iron, a glowing furnace cut into a black rock wall, a black nine-pronged iron ritual sceptre and long iron chisels on the anvil."),
    c("kitchen_benmen", "an estate storehouse kitchen where roasted-barley flour and butter are kneaded into hard dough figures shaped like small yaks, sacks and butter churns around."),
    c("sect_entry_benmen", "a flat-roofed black stone gate set with eighteen dark bronze prayer wheels, heavy iron gate leaves."),
    c("wuguan_benmen", "a black stone training ground with black wooden bird masks hanging on posts and deep claw marks gouged into wooden pillars."),
  ]),
  sheet("B20", "building", "琼隆古墟（下）", BUILDING_FORMAT, BUILDING_AVOID.replace("no frames around cells.", "no frames around cells, no swastika symbols."), [
    c("sectshop_benmen", "a vault of unearthed relics in black stone: rolled sheepskin scrolls, dark iron blades and carved animal masks on shelves."),
    c("library_benmen", "a divination tower room with scorched sheep shoulder-blades on a low table, knotted cords, a chart of nine squares on the wall and sheepskin scrolls in niches."),
    c("hospital_benmen", "a healing cave in black rock lit by butter lamps, mineral powders in stone bowls, a tray of long gold needles beside a low pallet."),
    c("temple_benmen", "a flat-roofed main hall held up by eight black monolithic pillars; inside, dimly lit, a dark bronze statue of a sage riding a great garuda bird."),
  ]),

  sheet("I01", "item", "兵器", ITEM_FORMAT, ITEM_AVOID, [
    c("weapon-sword", "a straight Chinese sword in its scabbard, laid diagonally."),
    c("weapon-saber", "a single-edged saber with a ring pommel."),
    c("weapon-spear", "a long spear head with a red tassel, the shaft running out of the cell."),
    c("weapon-staff", "a monk's staff with metal rings at the top."),
    c("weapon-whip", "a coiled soft whip with a bone handle."),
    c("weapon-hammer", "a heavy short-handled hammer."),
    c("weapon-hidden", "a small spread of hidden weapons, three-edged nails and thin needles on a cloth."),
    c("weapon-crossbow", "a compact hunting crossbow."),
    c("weapon-dagger", "a short dagger crossed with a pair of emei piercers."),
  ]),
  sheet("I02", "item", "护甲", ITEM_FORMAT, ITEM_AVOID, [
    c("armor-cloth", "a folded close-fitting cloth fighting jacket."),
    c("armor-leather", "a hard leather caravan vest."),
    c("armor-heavy", "a piece of heavy lamellar armor on a stand."),
    c("armor-taoist", "a folded Taoist robe with a plain crossed collar."),
    c("armor-monk", "a folded dark-red Tibetan monastic robe."),
    c("armor-fur", "a white fur cloak draped over a peg."),
    c("armor-apron", "a thick leather craftsman's apron with scorch marks."),
    c("armor-guard", "a pair of leather wrist guards and a shoulder pad."),
    c("armor-soft", "a thin soft armor vest of overlapping small plates, folded."),
  ]),
  sheet("I03", "item", "饰品", ITEM_FORMAT, ITEM_AVOID, [
    c("accessory-beads", "a string of old honey-amber prayer beads."),
    c("accessory-ring", "a jade thumb ring."),
    c("accessory-jade", "a carved jade pendant on a silk cord."),
    c("accessory-token", "a bronze waist token on a cord, its face blank."),
    c("accessory-charm", "a small knotted good-luck cord with a tiny wooden charm."),
    c("accessory-sachet", "an embroidered fragrance sachet."),
    c("accessory-hairpin", "a silver hairpin with a small flower."),
    c("accessory-fang", "a tiger-tooth pendant on a leather thong."),
    c("accessory-mirror", "a small round bronze mirror, back side with a bird pattern."),
  ]),
  sheet("I04", "item", "杂物", ITEM_FORMAT, ITEM_AVOID, [
    c("misc-pill", "a small porcelain pill bottle with two dark pills beside it."),
    c("misc-herb", "a bundle of dried mountain herbs tied with string."),
    c("misc-wine", "a clay wine jar sealed with cloth."),
    c("misc-food", "a half-empty cloth bag of highland barley and a round flatbread."),
    c("misc-sutra", "a wrapped long Tibetan sutra bundle."),
    c("misc-talisman", "two yellow paper talismans with abstract brush marks, no readable characters."),
    c("misc-key", "an old iron key."),
    c("misc-letter", "a folded invitation card with a red cord and a rolled letter."),
    c("misc-silver", "a few broken pieces of silver and a string of copper coins."),
  ]),
];

// 景物（舆图、地点、建筑、物品）用夜色锚，人物用人物画风锚。
export function anchorFor(kind) {
  return KINDS[kind]?.anchor === "portrait" ? PORTRAIT_ANCHOR : STYLE_ANCHOR;
}

// 把一个批次拼成可整段复制给 GPT 的完整提示词。
export function renderPrompt(batch, { withReference = false } = {}) {
  const [cols, rows] = KINDS[batch.kind].grid;
  const subjects = cols * rows === 1
    ? `[SUBJECTS] ${batch.cells[0].en}`
    : ["[SUBJECTS]", ...batch.cells.map((cell, i) => `Cell ${i + 1}: ${cell.en}`)].join("\n");
  return [
    ...(withReference ? [REFERENCE_LINE] : []),
    anchorFor(batch.kind),
    batch.format,
    subjects,
    batch.avoid,
  ].join("\n");
}

// 格号表：第几格是谁（给人看的，不进提示词）。
export function rosterLine(batch) {
  const [cols, rows] = KINDS[batch.kind].grid;
  if (cols * rows === 1) return "";
  return "格号：" + batch.cells.map((cell, i) => `${i + 1} ${cell.keys.length ? cell.keys.join("、") : "空格"}`).join("，") + "。";
}

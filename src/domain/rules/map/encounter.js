// 随机遭遇系统（Kenshi 取向 · 守契诃夫之枪）
// ------------------------------------------------------------------
// 设计立场：路上要有人气，但绝不刷"没名没姓、见完就散的纯装饰路人"——那违背本作
// 头号铁律"契诃夫之枪"。Kenshi 的精髓不是"随便刷人"，而是"世界自转、人各有归属"。
// 因此这里刷出来的每个过路人都**扛着一面已有的旗**（合稿 16 家势力或散人），
// 其态度受玩家与该势力关系影响，并且**可能捎一句传闻**——传闻若点到新的具名人物，
// 就通过 mentionedNewNpcs 喂进现成的 npcEmergence 传闻系统，成为日后能被顺藤摸瓜拉出来
// 的钩子。于是"随机"的人照样服务于因果：要么是某势力的触手，要么是某条线索的引信。
//
// 系统裁决 / AI 提议 分工照旧：系统掷骰决定"这次遇不遇到、遇到哪一方、是谁"，
// AI 只负责把这个已定的势力过路人写得具体生动。AI 不决定概率、不决定势力。

// 势力与各地权重、身份池、姓名库都和地点里的随机过路人（data/npc/randomPassers.js）共用；
// 这里只管"路上撞不撞得上"的概率和每家给 AI 的行事口吻。
import { random } from "../../../utils/rng.js";
import { getTodaysPasserNames, makeRoadPasser, passerFactionsAt, passerRolesOf } from "../../data/npc/randomPassers.js";

const FLAVOR = {
  鱼定土司府: "代表全乡的世俗权力与税赋地权，行事带官府的做派",
  鱼定村: "土生土长的村里人，守着青稞地和老规矩，怕事也护短",
  喇嘛庙: "全乡的精神信仰中心，言谈多带禅机与劝善",
  雪山派: "深山武学门派，弟子行止带练家子的分寸，对外门户森严",
  玉泉寨: "狼曲边的藏寨牧商聚落，重实利、识行情、扼水路",
  黑风寨: "占山的马匪，见财起意，对落单的外乡人最不客气",
  百花门: "天都镇的苗疆女子门派，笑里藏着耳目，消息比花还多",
  欢喜教: "天都香行背后的密教，人前温软殷勤，教中事一字不漏",
  锦官城: "官府的人，按规矩办差，最忌江湖人带刀生事",
  青城派: "道家名门，正派却带几分傲气，最恨天龙教与用毒之人",
  峨眉派: "佛门剑派，持戒清冷，遇不平事必出手",
  唐门: "蜀南暗器毒药世家，礼数周全，手却从不离袖口",
  丐帮三星分舵: "广汉的叫化子帮，衣衫破、腰杆直，护穷人、恨欺压",
  五仙教: "雾隐寨的苗疆蛊教，与外人隔着一层，惹了便难善了",
  天龙教: "西域来的教门，血刀部横行，见软柿子就捏",
  三星派: "守着广汉古墟的隐秘门派，话少，眼睛总盯着地底下",
  散人: "不属任何势力，各自讨生活，最不把主角当回事的一类",
};

export function factionProfile(factionKey) {
  return {
    label: factionKey === "散人" ? "无门无派的散人" : factionKey,
    roamers: passerRolesOf(factionKey).map((role) => role.role).join("、"),
    flavor: FLAVOR[factionKey] || FLAVOR.散人,
  };
}

// 每个地图节点的基础遭遇概率：荒野/官道高，村镇中，势力腹地低（腹地本就是自家人，
// 新鲜感低），极境（雪顶/深洞）几乎无人。移动"进入"该节点时掷骰；遇到哪一家按
// passerFactionsAt 的权重抽。
const NODE_PROB = {
  鱼定村: 0.25, 鱼定土司: 0.15, 喇嘛庙: 0.18, 白塔: 0.28, 后山平台: 0.30, 雪山派: 0.15,
  山洞: 0.05, 顶峰: 0.05, 天都镇: 0.35, 大草甸: 0.45, 玉泉寨: 0.25, 黑风寨: 0.20,
  贡措海: 0.10, 雅江: 0.35, 广汉: 0.35, 锦官城: 0.40, 天龙营: 0.15, 雾隐寨: 0.20, 蜀南唐堡: 0.15,
};
const DEFAULT_PROB = 0.20;
const DEFAULT_FACTIONS = [["散人", 1]];

function pickWeighted(entries, rng) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

// 路遇起名要避开的名字：玩家认识的人、角色表里的人、今天全图的过路人、眼前已在的人
export function roadNameGuard({ varTree, time = 0, extraNames = [] } = {}) {
  const known = new Set([
    ...(varTree?.世界?.已认识人物 || []),
    ...Object.keys(varTree?.角色 || {}),
    ...extraNames,
  ]);
  // 地点名单撞上熟人会重抽，两种抽法的名字都避开
  const taken = new Set([...known, ...getTodaysPasserNames(time), ...getTodaysPasserNames(time, known)]);
  const guard = (name) => taken.has(name);
  guard.claim = (name) => taken.add(name);
  return guard;
}

// 掷骰：给定要进入的节点名与气运，判定本次是否触发遭遇、遇到哪一方、撞见的是谁。
// isTaken(name) 为真的名字不用（玩家认识的人、今天的过路人）——好感度和认识记录按名字记。
// 返回 { factionKey, faction, passer } 或 null。气运略微抬高遭遇概率。
export function rollEncounter(destNodeName, luck = 5, { isTaken } = {}) {
  const luckBonus = Math.max(0, (luck - 5)) * 0.01; // 气运每高于5一点，+1%，封顶影响很小
  const p = Math.min(0.6, (NODE_PROB[destNodeName] ?? DEFAULT_PROB) + luckBonus);
  if (random() >= p) return null;
  const factionKey = pickWeighted(passerFactionsAt(destNodeName) || DEFAULT_FACTIONS, random);
  const passer = makeRoadPasser(factionKey, random, isTaken);
  if (passer) isTaken?.claim?.(passer.name); // 同一个守卫连掷多次（每日预跑）时不重名
  return { factionKey, faction: factionProfile(factionKey), passer };
}

// 把一次遭遇拼成注入主剧情请求的提示块。守铁律 + Kenshi 取向都写进指令里。
export function buildEncounterNote(encounter, destNodeName) {
  if (!encounter) return "";
  const { faction, passer } = encounter;
  return `\n[系统裁决：本次移动途中触发"路遇"事件] 玩家在前往「${destNodeName}」的路上，会遇到一个隶属【${faction.label}】的过路人（可能是${faction.roamers}之类）。请在 output 里自然地写出这次相遇，并把此人加入 room.npcs（${passer
    ? `此人系统已定：${passer.name}，${passer.gender}，${passer.brief}，${passer.personality}。照抄 {"name":"${passer.name}","id":"roamer_${passer.name}","brief":"${passer.brief}"}，不要改名`
    : `{"name":"（起个符合其身份的名字，可以只是称谓如'押货的老张'）","id":"（自拟英文id）","brief":"≤15字，点明其${faction.label}归属"}`}）。要求：
1. 此人正忙着自己的营生赶自己的路，不是特意来找主角的——可以对主角爱答不理、公事公办、或只是擦肩，别默认热情。（世界不围着主角转）
2. 其态度应参考玩家目前与【${faction.label}】的关系：若已触发的事件或世界状态里体现出交好/交恶，就相应地客气或冷硬；没有明确关系，就以该势力对陌生外来者的一般态度为准（${faction.flavor}）。
3. 此人**可以但不必**顺口漏一句本地见闻或传闻。若这句话点到了一个**新的具名人物**，请在顶层JSON的 mentionedNewNpcs 数组里声明这个名字（供系统记为"传闻人物"，日后玩家可循迹找他）——这是让路遇产生后续因果的关键，不要浪费成纯闲聊。
4. 分寸克制：不必每次都有大事，多数时候就是一次带着势力气味的短暂照面；宁可平淡真实，也不要硬凑戏剧冲突或凭空拔高与主角的关系。
如果当前情境逻辑上确实不宜有人出现（如深夜绝境、正被追杀），可以合理地不触发，在 output 里一笔带过即可，不必强行塞人。`;
}

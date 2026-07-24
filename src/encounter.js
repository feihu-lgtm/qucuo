// 随机遭遇系统（Kenshi 取向 · 守契诃夫之枪）
// ------------------------------------------------------------------
// 设计立场：路上要有人气，但绝不刷"没名没姓、见完就散的纯装饰路人"——那违背本作
// 头号铁律"契诃夫之枪"。Kenshi 的精髓不是"随便刷人"，而是"世界自转、人各有归属"。
// 因此这里刷出来的每个过路人都**扛着一面已有的旗**（土司府/喇嘛庙/玉泉寨/雪山派/散人），
// 其态度受玩家与该势力关系影响，并且**可能捎一句传闻**——传闻若点到新的具名人物，
// 就通过 mentionedNewNpcs 喂进现成的 npcEmergence 传闻系统，成为日后能被顺藤摸瓜拉出来
// 的钩子。于是"随机"的人照样服务于因果：要么是某势力的触手，要么是某条线索的引信。
//
// 系统裁决 / AI 提议 分工照旧：系统掷骰决定"这次遇不遇到、遇到哪一方"，
// AI 只负责把这个已定的势力过路人写得具体生动。AI 不决定概率、不决定势力。

// 势力定义：每方给一个"典型在路上晃悠的人"的角色池，供 AI 拿到具体的"谁"。
export const FACTIONS = {
  土司府: {
    label: "鱼定土司府",
    roamers: "巡丁、税吏、府里派出办差的仆役或马夫",
    flavor: "代表全乡的世俗权力与税赋地权，行事带官府的做派",
  },
  喇嘛庙: {
    label: "喇嘛庙",
    roamers: "下山化缘的行脚僧、上山的香客、庙里采办的小喇嘛",
    flavor: "全乡的精神信仰中心，言谈多带禅机与劝善",
  },
  玉泉寨: {
    label: "玉泉寨",
    roamers: "押货的商队伙计、赶牲口的牧民、扛脚力的脚夫",
    flavor: "狼曲边的藏寨牧商聚落，重实利、识行情、扼水路",
  },
  雪山派: {
    label: "雪山派",
    roamers: "外门弟子、下山采药的门人、办门派差事的执事",
    flavor: "深山武学门派，弟子行止带练家子的分寸，对外门户森严",
  },
  散人: {
    label: "无门无派的散人",
    roamers: "流民、独行的游侠、迷途的旅人、进山的猎户、赶路的小行商",
    flavor: "不属任何势力，各自讨生活，最不把主角当回事的一类",
  },
};

// 每个地图节点：基础遭遇概率 + 该地合理会出现的势力列表（越靠前越常见）。
// 概率按地域调：荒野/官道高，村镇中，势力腹地低（腹地本就是自家人，新鲜感低），
// 极境（雪顶/深洞）几乎无人。移动"进入"该节点时掷骰。
export const NODE_ENCOUNTERS = {
  鱼定村:   { prob: 0.25, factions: ["土司府", "玉泉寨", "喇嘛庙", "散人"] },
  鱼定土司: { prob: 0.15, factions: ["土司府"] },
  喇嘛庙:   { prob: 0.18, factions: ["喇嘛庙", "香客"] },
  白塔:     { prob: 0.28, factions: ["喇嘛庙", "雪山派", "散人"] },
  后山平台: { prob: 0.30, factions: ["雪山派", "喇嘛庙", "散人"] },
  雪山派:   { prob: 0.15, factions: ["雪山派"] },
  山洞:     { prob: 0.05, factions: ["散人"] },
  顶峰:     { prob: 0.05, factions: ["散人"] },
  天都镇:   { prob: 0.35, factions: ["玉泉寨", "土司府", "散人"] },
  大草甸:   { prob: 0.45, factions: ["玉泉寨", "土司府", "散人", "喇嘛庙"] },
  玉泉寨:   { prob: 0.25, factions: ["玉泉寨", "散人", "土司府"] },
  贡措海:   { prob: 0.10, factions: ["玉泉寨", "散人"] },
  锦官城:   { prob: 0.40, factions: ["土司府", "散人"] },
};

const DEFAULT_ENCOUNTER = { prob: 0.20, factions: ["散人"] };

// 掷骰：给定要进入的节点名与气运，判定本次是否触发遭遇、遇到哪一方。
// 返回 { factionKey, faction } 或 null。气运略微抬高遭遇概率（好运的人路上更容易碰上事）。
export function rollEncounter(destNodeName, luck = 5) {
  const cfg = NODE_ENCOUNTERS[destNodeName] || DEFAULT_ENCOUNTER;
  const luckBonus = Math.max(0, (luck - 5)) * 0.01; // 气运每高于5一点，+1%，封顶影响很小
  const p = Math.min(0.6, cfg.prob + luckBonus);
  if (Math.random() >= p) return null;

  // 从该地合理势力里随机挑一方；越靠前的权重略高（简单线性衰减）。
  const list = cfg.factions.filter(Boolean);
  if (!list.length) return null;
  const weights = list.map((_, i) => list.length - i);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let picked = list[0];
  for (let i = 0; i < list.length; i++) {
    if (r < weights[i]) { picked = list[i]; break; }
    r -= weights[i];
  }
  // "香客"这类不是正式势力键，做个兜底归一到喇嘛庙语境
  const factionKey = FACTIONS[picked] ? picked : "喇嘛庙";
  return { factionKey, faction: FACTIONS[factionKey] };
}

// 把一次遭遇拼成注入主剧情请求的提示块。守铁律 + Kenshi 取向都写进指令里。
export function buildEncounterNote(encounter, destNodeName) {
  if (!encounter) return "";
  const { faction } = encounter;
  return `\n[系统裁决：本次移动途中触发"路遇"事件] 玩家在前往「${destNodeName}」的路上，会遇到一个隶属【${faction.label}】的过路人（可能是${faction.roamers}之类）。请在 output 里自然地写出这次相遇，并把此人加入 room.npcs（{"name":"（起个符合其身份的名字，可以只是称谓如'押货的老张'）","id":"（自拟英文id）","brief":"≤15字，点明其${faction.label}归属"}）。要求：
1. 此人正忙着自己的营生赶自己的路，不是特意来找主角的——可以对主角爱答不理、公事公办、或只是擦肩，别默认热情。（世界不围着主角转）
2. 其态度应参考玩家目前与【${faction.label}】的关系：若已触发的事件或世界状态里体现出交好/交恶，就相应地客气或冷硬；没有明确关系，就以该势力对陌生外来者的一般态度为准（${faction.flavor}）。
3. 此人**可以但不必**顺口漏一句本地见闻或传闻。若这句话点到了一个**新的具名人物**，请在顶层JSON的 mentionedNewNpcs 数组里声明这个名字（供系统记为"传闻人物"，日后玩家可循迹找他）——这是让路遇产生后续因果的关键，不要浪费成纯闲聊。
4. 分寸克制：不必每次都有大事，多数时候就是一次带着势力气味的短暂照面；宁可平淡真实，也不要硬凑戏剧冲突或凭空拔高与主角的关系。
如果当前情境逻辑上确实不宜有人出现（如深夜绝境、正被追杀），可以合理地不触发，在 output 里一笔带过即可，不必强行塞人。`;
}

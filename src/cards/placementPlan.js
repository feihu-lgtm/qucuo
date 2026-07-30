// 落脚规划 · AI 荐位
// ============================================================================
// 【为什么独立于 scanPrompts.js】那个文件装的是导入流水线的四个阶段（分类→抽人
// →世界观→开场白改写），它们有固定顺序、由 cardScan.js 串起来跑。落脚规划不在
// 这条流水线上：它发生在审改期，由玩家点按钮触发，可以跑零次也可以反复跑，跑完
// 只是往表单里填草稿。混进 scanPrompts 会让「阶段」这个概念失去意义。
//
// 【AI 在这里被允许做什么】只做「这个人该待在哪」这一个判断。据点名一律从清单里
// 选，返回清单外的名字直接丢弃——跟 catalog.js 顶部那条分工一致（AI 只能引用，
// 不能篡改）。这条不是防模型作恶，是防它把「天都镇」写成「天都城」，那种错误在
// getImportedForDistrict 里表现为角色永远不出现，且没有任何报错。
//
// 【为什么不让 AI 选内层房间】内层房要先知道落哪个据点才能列，一次批量规划里
// 每个人的据点都不同，把全部据点的房间清单都塞进 prompt 会让它膨胀好几倍，而
// 这一项玩家在现成的下拉里点一下就能选。AI 出据点，人补房间。

import { QUCUO_MAP } from "../qucuoMap.js";
import { DISTRICT_REGION } from "../items/regionMap.js";

// 一次调用规划几个人。太多会让模型对后面几个人敷衍（返回千篇一律的 mention），
// 太少则浪费令牌桶额度——桶是 5 次/分钟，六人一批意味着三十人也就六次。
export const PLAN_BATCH = 6;

// 输出 token 上限。量级对齐 cardScan.js 的 STAGE_MAX_TOKENS（1:6000 2:4500
// 3:1500 4:4000），不按正文实际长度给。
//
// 【为什么不能按正文算】一个人的规划正文只有六七十 token，六个人五百上下，看着
// 给 700 就够。但带思考的模型里思考 token 与正文共用这一份额度，700 会在思考阶段
// 就被吃穿，正文只吐出「```json」加一个左方括号就撞 length 上限，三层救援全落空，
// 报出来的却是「返回的不是合法 JSON」——方向完全指错。
// 这个坑 apiConfig.js 的 DEFAULT_CALL_TOKEN_LIMITS 里记过：narratorWhisper
// 原本写死 600，是「9 处写死抽成配置」漏网的第 10 处，症状一模一样。
export const PLAN_MAX_TOKENS = { single: 3000, batch: 6000 };

// 心灵之海是好感解锁的意识空间、第三新东京市是终章一次性据点，都不该当日常落脚点。
// 与 ReviewNpc.jsx 的 DISTRICTS 同一套过滤条件。
export const PLANNABLE_DISTRICTS = Object.keys(QUCUO_MAP)
  .filter(d => d !== "心灵之海" && d !== "第三新东京市");

/** 据点清单文本：名字［地域］描述。描述截断，只要够模型判断氛围就行 */
function districtBrief(districts, descMax = 60) {
  return districts.map(d => {
    const region = DISTRICT_REGION[d] || "野地";
    const desc = String(QUCUO_MAP[d]?.desc || "").replace(/\s+/g, "").slice(0, descMax);
    return `- ${d}［${region}］${desc}`;
  }).join("\n");
}

/** 人物清单文本。entry 截断——判断落脚只需要身份与来历，不需要全文 */
function peopleBrief(npcs, entryMax = 180) {
  return npcs.map((n, i) => {
    const bits = [
      `${i + 1}. ${n.name}`,
      n.brief ? `身份：${n.brief}` : "",
      Number.isFinite(n.levelCap) ? `品阶：${["白", "绿", "蓝", "紫", "橙", "红"][n.levelCap] || "白"}档` : "",
      n.attitude ? `初见态度：${String(n.attitude).slice(0, 60)}` : "",
      n.entry ? `人设：${String(n.entry).replace(/\s+/g, "").slice(0, entryMax)}` : "",
    ].filter(Boolean);
    return bits.join("\n   ");
  }).join("\n\n");
}

/**
 * 构造落脚规划请求。
 * @param {Array} npcs 待规划的人（一批，建议 ≤ PLAN_BATCH 个）
 * @param {string[]} districts 允许的据点白名单
 * @returns {{system:string, user:string}}
 */
export function buildPlacementPlan(npcs, districts = PLANNABLE_DISTRICTS) {
  const system = `你在给中文武侠文字游戏「曲措乡」新入册的人物安排落脚处。这是一个川西藏汉杂居的乡域，玩家在据点之间行走，遇见谁取决于这份安排。

【先按营生落地，世界观差异不是借口】
本作是开放江湖，任何外来人物都能以「不知来路的异乡客」身份安排进来。此人的原作世界观、时代、设定与本作不同，**绝不是**不落地的理由——禁止写「跨世界观」「设定不符」「难以融合」「不属于这个世界」这类依据，那是偷懒。
正确做法：先看清此人的营生与职能（掌勺的、好食的、行商、医者、武人、僧道、官吏、匠人、猎户、卖艺的……），再读下面据点清单里每句描述，挑职能或氛围最贴近的据点——掌勺/饕客去有客栈酒肆食铺的据点，行商贩夫去有市集商路的据点，医者去有药铺医馆的据点，武人门派中人去有武馆门派擂台镖局的据点，僧道去有寺观的据点。有固定营生、坐一地的给 resident；四处走动营生的给 wander。

【三种落脚方式】
- resident 驻场：进了那个据点必定遇见他。适合有固定营生或职守的人——掌柜、厨子、住持、门派长老、看守、坐堂大夫、铁匠。要给一个 district。
- wander 游走：按权重随机出现在若干据点，且只在设定时辰里露面。适合行商、镖师、游方僧、赏金客、觅食的饕客、四处找人的人。要给 weights。
- mention 不落地：他的设定只在被提到时注入，不会出现在任何据点。**只**适合已故的人、纯传闻里从无实体的人、或根本不是人而是概念/旁白的条目。只要是个活着的、有营生或身份的人，就不许选这个。

【硬规矩】
1. 据点名只能从下面清单里逐字照抄，一个字都不能改，绝对不能编造清单外的地名。
2. weights 是「出现概率」，取值 25／50／75／100 四档之一。给 2 到 4 个据点即可，别把清单铺满——处处都能遇见等于没有安排。
3. timeSlot 是 [起, 止] 两个 0-23 的整数，起 ≤ 止。夜间活动的人给 [19,23]，市集上的人给 [7,18]，没有特殊作息给 [0,23]。
4. 判断依据 why 写一句话，二十字以内，写「按他的什么营生/身份落到哪」，例如「饕客，宜在酒肆食铺出没」。绝不要写世界观冲突。
5. 人名照抄给你的原名，不要改写、不要加称号。
6. 拿不准时，按营生给一个游走或驻场，宁可安排成异乡来客，也不要凭空判不落地。

【输出格式】只输出一个 JSON 数组，不要任何说明文字、不要 markdown 围栏：
[{"name":"人名","mode":"resident","district":"据点名","timeSlot":[0,23],"why":"依据"},
 {"name":"人名","mode":"wander","weights":{"据点名":75,"据点名":50},"timeSlot":[7,18],"why":"依据"},
 {"name":"人名","mode":"mention","why":"依据"}]

【可选据点清单】
${districtBrief(districts)}`;

  const user = `请为以下 ${npcs.length} 人安排落脚处：\n\n${peopleBrief(npcs)}`;

  return { system, user };
}

const WEIGHT_STEPS = [25, 50, 75, 100];
const MODES = ["mention", "resident", "wander"];

function snapWeight(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // 就近吸附到四档。模型给 30、给 80 都常见，直接用会让权重档位失去意义
  return WEIGHT_STEPS.reduce((best, s) =>
    Math.abs(s - n) < Math.abs(best - n) ? s : best, WEIGHT_STEPS[0]);
}

function clampHour(v, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(23, n)) : fallback;
}

/**
 * 净化模型返回的规划。只认识清单内的据点，其余一概退回 mention。
 *
 * 【为什么非法配置退 mention 而不是报错】规划是草稿，玩家还要过目。一个人被退回
 * 不落地，界面上看得见（左栏没有「驻」「游」标记），玩家可以自己补；而抛错会让
 * 整批六个人一起白跑，还得重烧一次令牌桶额度。
 *
 * @param {any} raw parseJsonLoose 的产出
 * @param {Array} npcs 这一批送去规划的人，用于把 name 对回索引
 * @param {string[]} districts 允许的据点白名单
 * @returns {Array<{index:number, placement:object, why:string}>}
 */
export function sanitizePlacementPlan(raw, npcs, districts = PLANNABLE_DISTRICTS) {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(districts);
  // 别名也认：模型偶尔会用卡里的别称回话
  const indexOf = new Map();
  npcs.forEach((n, i) => {
    if (n?.name) indexOf.set(String(n.name).trim(), i);
    for (const a of (n?.aliases || [])) if (a) indexOf.set(String(a).trim(), i);
  });

  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const idx = indexOf.get(String(item.name || "").trim());
    if (idx === undefined || seen.has(idx)) continue;   // 认不出的人名、重复的条目都丢
    seen.add(idx);

    const why = String(item.why || "").replace(/\s+/g, " ").trim().slice(0, 40);
    let mode = MODES.includes(item.mode) ? item.mode : "mention";
    const placement = { mode: "mention", district: null, innerRoom: null, weights: {}, timeSlot: [0, 23] };

    const lo = clampHour(item.timeSlot?.[0], 0);
    const hi = clampHour(item.timeSlot?.[1], 23);
    placement.timeSlot = lo <= hi ? [lo, hi] : [hi, lo];

    if (mode === "resident") {
      const d = String(item.district || "").trim();
      if (allowed.has(d)) {
        placement.mode = "resident";
        placement.district = d;
      }
      // 据点不在清单里 → 保持 mention。normalizePlacement 也会做同样的兜底，
      // 这里先做一遍是为了让 why 旁边能显示「这条被退回了」
    } else if (mode === "wander") {
      const w = {};
      for (const [k, v] of Object.entries(item.weights || {})) {
        const name = String(k).trim();
        if (!allowed.has(name)) continue;
        const snapped = snapWeight(v);
        if (snapped > 0) w[name] = snapped;
      }
      if (Object.keys(w).length) {
        placement.mode = "wander";
        placement.weights = w;
      }
    }

    out.push({ index: idx, placement, why, rejected: placement.mode !== mode });
  }
  return out;
}

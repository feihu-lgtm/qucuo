// 生成 docs/路遇随机事件全集.md：20 类的手写提示词与 400 件事件的情节核、来人、检定、得失，供审阅。
// 数据只改 scripts/roadEvents/ 下的源文件，改完跑 `npm run road:doc`。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROAD_EVENTS, ROAD_EVENT_CATEGORIES, CATEGORY_KEYS, ROAD_EVENT_RULES } from "./index.js";
import { parseCast } from "./roadEvents.js";

export const DOC_PATH = "docs/路遇随机事件全集.md";

const Q = (q) => (q === "roll" ? "按气运" : q === "roll+1" ? "按气运再升一阶" : `${q}品`);
function codeText(code) {
  const [h, ...r] = code.split(":");
  switch (h) {
    case "silver": return `银两${r[0]}`;
    case "hp": return `气血${r[0]}`;
    case "item": return `${r[0]}（${Q(r[1])}）`;
    case "skill": return `${r[0] === "any" ? "" : r[0]}武学（${Q(r[1])}·${r[2]}）`;
    case "stat": return `${r[0]}`;
    case "exp": return `经验${r[0]}`;
    case "pot": return `潜能${r[0]}`;
    case "rep": return `${r.join(":")}声誉`.replace(/([+-]\d+)声誉$/, "声誉$1");
    case "aff": return `好感${r[0]}`;
    case "ally": return "**同伴**";
    case "mate": return "**美人**";
    case "beast": return `**${r[1]}·${r[0]}**`;
    case "cond": return `状态「${r[0]}」${r[1]}回合`;
    case "clue": return "传闻";
    case "pact": return "约定";
    case "scene": return "场景改动";
    default: return code;
  }
}
const codesText = (s) => (s ? s.split("|").map(codeText).join("、") : "—");
const castText = (c) => {
  const cast = parseCast(c);
  if (!cast) return "—";
  if (cast.rumor) return "传闻人物";
  return `${cast.name ? `${cast.name}，` : ""}${cast.faction}·${cast.role}·${cast.gender}·${cast.age}`;
};
const cell = (s) => String(s).replace(/\|/g, "／").replace(/\n/g, " ");

export function buildDoc() {
  const parts = [
    "# 路遇随机事件全集（400 件）",
    "",
    "> 本文件由 `scripts/roadEvents/buildRoadEventsDoc.mjs` 从 `scripts/roadEvents/` 的数据源生成，不要手改；改完数据跑 `npm run road:doc`。设计说明见 [路遇随机事件设计.md](路遇随机事件设计.md)。",
    "",
    "每件事的「得失」一栏是系统定死的事实；说书人只照「路遇铁律 + 类别提示词 + 情节核 + 已定事实」写戏。稀有度 1 常见、2 少见、3 罕见；「一次」表示一辈子只遇一次。",
    "",
    "## 路遇铁律（拼在每段类别提示词之前）",
    "",
    "```",
    ROAD_EVENT_RULES,
    "```",
    "",
  ];
  for (const k of CATEGORY_KEYS) {
    const c = ROAD_EVENT_CATEGORIES[k];
    const list = ROAD_EVENTS.filter((e) => e.cat === k);
    parts.push(`## ${k} ${c.name}`, "", `三个可行之事：${c.options.main} / ${c.options.alt} / ${c.options.leave}。默认地头：${c.where.join("、")}。`, "", "```", c.prompt, "```", "");
    parts.push("| 编号 | 名称 | 地头 | 来人 | 主行动检定 | 成功 | 失败 | 次行动 | 稀有度 | 情节核 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const e of list) {
      const check = e.check ? `${e.check} ${e.dc}` : "必成";
      const flags = [`${e.tier}`, e.once ? "一次" : "", e.when, e.req ? "有门槛" : ""].filter(Boolean).join("·");
      parts.push(`| ${e.id} | ${cell(e.name)} | ${cell(e.where.join("、"))} | ${cell(castText(e.cast))} | ${check} | ${cell(codesText(e.win))} | ${cell(codesText(e.lose))} | ${cell(codesText(e.alt))} | ${flags} | ${cell(e.seed)} |`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(DOC_PATH, buildDoc());
  console.log(`wrote ${DOC_PATH}`);
}

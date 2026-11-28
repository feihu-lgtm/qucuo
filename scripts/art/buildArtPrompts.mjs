// 生成 docs/美术_夜色素材提示词.md：每条提示词都拼成完整文本，可整段复制给 GPT。
// 数据只改 scripts/art/artPrompts.mjs，改完跑 `npm run art:prompts`。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BATCHES, KINDS, PORTRAIT_ANCHOR, REFERENCE_LINE, RUN_ORDER, STYLE_ANCHOR, renderPrompt, rosterLine } from "./artPrompts.mjs";

export const DOC_PATH = "docs/美术_夜色素材提示词.md";

const fence = (text) => "```\n" + text + "\n```";

export function buildDoc() {
  const counts = Object.keys(KINDS).map((kind) => {
    const batches = BATCHES.filter((b) => b.kind === kind);
    const pieces = batches.reduce((n, b) => n + b.cells.filter((cell) => cell.keys.length).length, 0);
    const [cols, rows] = KINDS[kind].grid;
    return `| ${KINDS[kind].label} | ${batches.length} | ${cols * rows === 1 ? "1" : `${cols * rows}（${cols}×${rows}）`} | ${pieces} | ${KINDS[kind].out} | ${KINDS[kind].dir}/ |`;
  });

  const parts = [
    "# 美术·夜色素材提示词全集",
    "",
    "> 本文件由 `scripts/art/buildArtPrompts.mjs` 从 `scripts/art/artPrompts.mjs` 生成，不要手改。改画风只改数据源里的 STYLE_ANCHOR，再跑 `npm run art:prompts`。",
    "> 界面骨架一律用代码写；这里只有 GPT 画的五类素材：舆图底卷、地点头图、人物小像、建筑头图、物品类别图。",
    "",
    "## 怎么用",
    "",
    "每条提示词是一个代码框，整段复制贴给 GPT。代码框上方的“格号”一行是给人对照的，不要贴进去。格号是一张大图里九格（或四格）的位置编号，左上为 1，右下为最后一格，只用于切图时认出每一格是谁，游戏里不出现。",
    "",
    "从第二步起，每条都附上样张图，并在提示词最前面加这一行：",
    "",
    fence(REFERENCE_LINE),
    "",
    "## 跑图顺序",
    "",
    "| 步骤 | 跑哪几条 | 说明 |",
    "| --- | --- | --- |",
    ...RUN_ORDER.map((s) => `| ${s.step} | ${s.ids.join("、")} | ${s.note} |`),
    "",
    "## 数量与规格",
    "",
    "| 素材 | 跑几次 | 一次里几张 | 切出多少张 | 最终尺寸 | 入库目录 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...counts,
    "",
    "不画透明底：一律画在与界面同色的近黑 #0c0b09 上、四边渐隐，省掉抠图，也避开假透明棋盘格。临时路人和 AI 临场生成的人物没有固定身份，不出图，界面只显示文字。",
    "",
    "## 验收",
    "",
    "| 项 | 合格标准 |",
    "| --- | --- |",
    "| 底色 | 四边是近黑 #0c0b09，没有灰边、白边、棋盘格 |",
    "| 文字 | 画面里没有任何字、印章、落款、水印 |",
    "| 光 | 光都从左上来；景物大面积是暗部，人物亮部充足、从暗底上跳出来 |",
    "| 用色 | 景物只用夜色锚里的几种颜色，朱红只出现在本身是红的东西上；人物按人物画风锚，每人一个主色加一个对比色，整张不能罩成一片暖棕 |",
    "| 人物区分 | 同一张九宫格里没有两张相同的脸，年龄、脸型、体格、肤色、发型、表情、标志物逐格对得上描述 |",
    "| 构图 | 九格、四格之间有黑缝，顺序与格号一致 |",
    "",
    "## 画风锚",
    "",
    "景物（舆图、地点、建筑、物品）用夜色锚：",
    "",
    fence(STYLE_ANCHOR),
    "",
    "人物用人物画风锚，照 R01 定稿的实际效果写：",
    "",
    fence(PORTRAIT_ANCHOR),
    "",
  ];

  for (const kind of Object.keys(KINDS)) {
    parts.push(`## ${KINDS[kind].label}`, "");
    for (const batch of BATCHES.filter((b) => b.kind === kind)) {
      parts.push(`### ${batch.id} ${batch.title}`, "");
      const roster = rosterLine(batch);
      if (roster) parts.push(roster, "");
      parts.push(fence(renderPrompt(batch)), "");
    }
  }
  return parts.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(DOC_PATH, buildDoc());
  console.log(`wrote ${DOC_PATH}`);
}

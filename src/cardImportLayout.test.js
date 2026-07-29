import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "./items/catalog.js";

// 【为什么要源码级守卫】这三条都是「不报错、不崩溃，只是玩家看不到东西」那一类：
//   · 随身物选择器曾把 406 件的百物录静默截断到 60 件。不搜名字就永远翻不到后面
//     346 件，看起来像是库里只有这些。没有任何报错。
//   · 审改页左栏曾定宽 230px。那是面板还锁在 1120 宽时定的比例，撑满全屏之后
//     名单挤成一条窄带，运行日志每行都折。
//   · 落脚那一节排在 16 个 Section 的第 15 位，横向一窄，据点 chip 疯狂换行把它
//     推到滚动区底部，玩家翻不到，于是以为这个功能没做。
// CSS 在 node 里没法真渲染，所以退一步盯住源码里的关键指纹。
const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = readFileSync(join(HERE, "CardImportScreen.jsx"), "utf-8");
const NPC = readFileSync(join(HERE, "cards", "ReviewNpc.jsx"), "utf-8");

describe("随身物选择器必须能选到整本百物录", () => {
  it("百物录规模够大，值得筛而不是硬截", () => {
    // 这条不是断言具体件数（会随内容增长），只是钉住「这是个大列表」这个前提，
    // 顺带让 406 这个量级出现在测试输出里，方便下次判断上限该怎么给
    expect(CATALOG.length).toBeGreaterThan(300);
  });

  it("候选列表没有对 CATALOG 的硬截断", () => {
    // 找到 CarryPicker 里筛候选的那段（CATALOG.filter 是它的指纹）
    const i = NPC.indexOf("const list = useMemo");
    expect(i, "没找到 CarryPicker 的候选列表，指纹可能变了，请同步这条守卫").toBeGreaterThan(0);
    const block = NPC.slice(i, i + 600);
    expect(block).toContain("CATALOG.filter");
    expect(block, "候选列表又被 slice 截断了——玩家会以为百物录只有这么几件，且没有任何提示")
      .not.toMatch(/\.slice\(\s*0\s*,\s*\d+\s*\)/);
  });

  it("三个筛选维度都在（类别 / 品阶 / 关键词）", () => {
    expect(NPC).toContain("e.category === cat");
    expect(NPC).toContain("e.quality === qual");
    // 关键词要连描述一起搜——找「止血的」比记得住药名实用
    expect(NPC).toMatch(/e\.name\.includes\(k\)\s*\|\|\s*\(e\.desc \|\| ""\)\.includes\(k\)/);
  });

  it("列表上方有计数条，把「库里多少 / 筛出多少」摆在明面上", () => {
    expect(NPC).toContain("百物录 {CATALOG.length} 件");
    expect(NPC).toContain("当前 {list.length} 件");
  });
});

describe("审改页分栏与日志区", () => {
  it("左右是 4:6，且两栏都带 minWidth 0", () => {
    const left = SCREEN.split("\n").find(l => l.includes("flex: 4") && l.includes("borderRight"));
    expect(left, "没找到左栏容器，指纹可能变了，请同步这条守卫").toBeTruthy();
    // flex 子项默认 min-width:auto，长人名会把栏撑破比例
    expect(left, "左栏缺 minWidth 0，长内容会撑破 4:6").toContain("minWidth: 0");

    const right = SCREEN.split("\n").find(l => l.includes("flex: 6") && l.includes("flexDirection"));
    expect(right, "没找到右栏容器").toBeTruthy();
    expect(right).toContain("minWidth: 0");
  });

  it("面板本体撑满，不再锁回 1120×800", () => {
    expect(SCREEN, "panel 又被写死尺寸了——大屏上四边留空，且会把落脚那一节挤到翻不到")
      .not.toContain("min(1120px, 95vw)");
    expect(SCREEN).toMatch(/width:\s*"100%",\s*height:\s*"100%"/);
  });

  it("运行日志用视口比例给高度，不用定值", () => {
    // 定值（原来是 118）在矮窗口下会把上方的人物名单挤没，拉长更要用 vh
    expect(SCREEN).toMatch(/<Terminal[^>]*height="min\(\d+vh,\s*\d+px\)"/);
  });
});

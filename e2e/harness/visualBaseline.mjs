// 视觉回归基线（路线图 U6）：对关键界面各拍一张图。
// ---------------------------------------------------------------------------
// VISUAL_BASELINE=update 时写入 e2e/visual-baseline/<视口>/，作为基线入库；
// 不设时写到 e2e/.artifacts/visual/<视口>/，供与基线逐张对照。
// 每个界面单独尝试：入口 3 秒内找不到就记为跳过、不中断，最后输出清单，
// 便于在本地补准选择器。截图前关掉动画与光标闪烁，减少无关差异。
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STILL = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

async function openBy(page, patterns) {
  for (const pattern of patterns) {
    const target = page.getByRole("button", { name: pattern }).or(page.getByText(pattern)).first();
    try {
      await target.waitFor({ state: "visible", timeout: 3000 });
      await target.click();
      await page.waitForTimeout(300);
      return true;
    } catch {
      // 换下一个候选入口
    }
  }
  return false;
}

async function closeTop(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

export async function captureBaseline({ page, game }, viewportName) {
  const update = process.env.VISUAL_BASELINE === "update";
  const dir = update
    ? resolve(ROOT, "e2e", "visual-baseline", viewportName)
    : resolve(ROOT, "e2e", ".artifacts", "visual", viewportName);
  mkdirSync(dir, { recursive: true });
  const report = { viewport: viewportName, mode: update ? "update" : "compare", shots: [], skipped: [] };
  const shot = async (name) => {
    await page.addStyleTag({ content: STILL });
    await page.screenshot({ path: resolve(dir, `${name}.png`) });
    report.shots.push(name);
  };
  const skip = (name, reason) => report.skipped.push({ name, reason });

  // 运行器在调用用例前已经打开了开始页（e2e/run.mjs 的 page.goto(server.url)）。
  await page.waitForLoadState("networkidle");
  await shot("start");

  await game.loadSave(page, "village");
  await page.waitForTimeout(500);
  await shot("main");

  const screens = [
    ["settings", [/设置/]],
    ["inventory", [/行囊/, /包袱/]],
    ["character", [/人物关系/, /人物/]],
    ["map", [/舆图/, /大地图/, /⤢/]],
    ["trading", [/交易/, /买卖/]],
  ];
  for (const [name, patterns] of screens) {
    if (await openBy(page, patterns)) {
      await shot(name);
      await closeTop(page);
    } else {
      skip(name, `没有找到入口：${patterns.map(String).join(" / ")}`);
    }
  }

  writeFileSync(resolve(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

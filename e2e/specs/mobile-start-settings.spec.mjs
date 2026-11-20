import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const viewport = { width: 390, height: 693 };
const villageSave = JSON.parse(readFileSync(new URL("../fixtures/saves/village.json", import.meta.url), "utf8"));

async function capture(page, filename) {
  const directory = process.env.FONT_SCREENSHOT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, filename), animations: "disabled" });
}

async function configureApi(page, save = null) {
  await page.evaluate(async (fixture) => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
      apiType: "openai",
      endpoint: `${globalThis.location.origin}/__qa_ai/v1/chat/completions`,
      apiKey: "local-test-only",
      model: "browser-fixture",
      streamEnabled: false,
      questTriggerMode: "prompt",
      autoSaveEvery: 1,
    }));
    localStorage.setItem("qucuo_tutorial_seen", "1");
    if (fixture) {
      const saves = await import("/src/infra/saves.js");
      await saves.init();
      saves.importSave(JSON.stringify(fixture));
    }
  }, save);
  await page.reload();
}

export default async function mobileStartSettings({ page, game }) {
  await page.evaluate(() => localStorage.removeItem("wuxia_mud_ui_font"));
  await page.reload();
  await page.getByText("开始游戏", { exact: true }).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-font"), "pixel");
  await capture(page, "start-screen.png");

  await page.getByText("设置", { exact: true }).click();
  await page.getByText("× 关闭", { exact: true }).click();
  await page.getByText("开始游戏", { exact: true }).waitFor();

  await page.getByText("开始游戏", { exact: true }).click();
  await page.getByText("新建角色", { exact: true }).click();
  await page.getByText("尚未配置 API 凭证", { exact: true }).waitFor();
  await page.getByRole("button", { name: "返回主菜单" }).click();
  assert.equal(await page.getByText("开始游戏", { exact: true }).count(), 1);

  await configureApi(page);
  await page.getByText("设置", { exact: true }).click();
  await page.getByText("立绘管理", { exact: true }).click();
  await page.getByText("为旁白、主角本人、或任意已登场角色导入立绘图片", { exact: false }).waitFor();
  await page.getByText("× 关闭", { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });

  await configureApi(page);
  await page.getByText("开始游戏", { exact: true }).waitFor();

  await page.getByText("设置", { exact: true }).click();
  await page.getByText("× 关闭", { exact: true }).click();
  await page.getByText("开始游戏", { exact: true }).waitFor();
  assert.equal(await page.locator(".game-input").count(), 0);

  await configureApi(page, villageSave);
  await page.getByText("设置", { exact: true }).click();
  await page.getByText("💾 存档管理", { exact: true }).click();
  await page.getByText("QA village（导入）", { exact: true }).waitFor();
  await page.getByText("读取", { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });
  assert.equal((await game.state(page)).room, "鱼定村");

  await page.getByText("☰ 菜单", { exact: true }).click();
  await page.getByText("设置", { exact: true }).click();
  await page.getByText("× 关闭", { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });
  assert.equal(await page.getByText("开始游戏", { exact: true }).count(), 0);

  const topMenu = page.locator(".mobile-top-menu");
  if (await topMenu.isVisible()) {
    await page.getByText("☰ 菜单", { exact: true }).click();
    await topMenu.waitFor({ state: "hidden" });
  }
  const narrative = page.getByTestId("narrative-log");
  const firstEntry = narrative.locator(".log-entry").first();
  await firstEntry.waitFor();
  await page.evaluate(async () => { await globalThis.document.fonts.ready; });
  const pixelFamily = await firstEntry.evaluate(element => globalThis.getComputedStyle(element).fontFamily);
  assert.match(pixelFamily, /Fusion Pixel/);
  assert.equal(await page.evaluate(() => globalThis.document.fonts.check('12px "Fusion Pixel"')), true);
  await capture(page, "center-pixel.png");

  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  await tabs.getByRole("button", { name: /^左/ }).click();
  const left = page.getByTestId("left-panel");
  await left.getByRole("button", { name: "下一面" }).first().click();
  const mapModule = left.locator('[data-module="map"]');
  await mapModule.waitFor({ state: "visible" });
  await mapModule.scrollIntoViewIfNeeded();
  await capture(page, "left-map.png");

  await tabs.getByRole("button", { name: /^中/ }).click();
  if (!(await topMenu.isVisible())) await page.getByText("☰ 菜单", { exact: true }).click();
  await topMenu.waitFor({ state: "visible" });
  await topMenu.getByText("设置", { exact: true }).click();
  await page.getByText("🎚 其他", { exact: true }).click();
  await page.getByText("字体", { exact: true }).waitFor();
  await capture(page, "settings-font-row.png");
  await page.getByRole("button", { name: "宋体", exact: true }).click();
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.font === "song");
  await page.waitForFunction(() => localStorage.getItem("wuxia_mud_ui_font") === "song");
  const songFamily = await firstEntry.evaluate(element => globalThis.getComputedStyle(element).fontFamily);
  assert.doesNotMatch(songFamily, /Fusion Pixel/);
  await page.getByText("× 关闭", { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });
  if (await topMenu.isVisible()) {
    await page.getByText("☰ 菜单", { exact: true }).click();
    await topMenu.waitFor({ state: "hidden" });
  }
  await capture(page, "center-song.png");

  await page.reload();
  await page.waitForFunction(() => globalThis.document.documentElement.dataset.font === "song");
  assert.equal(await page.evaluate(() => localStorage.getItem("wuxia_mud_ui_font")), "song");
}

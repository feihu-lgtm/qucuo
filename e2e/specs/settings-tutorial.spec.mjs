import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const viewport = { width: 390, height: 693 };
const villageSave = JSON.parse(readFileSync(new URL("../fixtures/saves/village.json", import.meta.url), "utf8"));

async function capture(page, filename) {
  const directory = process.env.MAPFIT_SCREENSHOT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, filename), animations: "disabled" });
}

export default async function settingsTutorial({ page }) {
  await page.evaluate(() => localStorage.removeItem("qucuo_tutorial_seen"));
  await page.reload();
  await page.getByText("设置", { exact: true }).click();
  await page.getByText("API 配置", { exact: true }).click();
  await page.locator("#api-provider").selectOption("vertex");
  const credential = {
    type: "authorized_user",
    client_id: "mock-client.apps.googleusercontent.com",
    client_secret: "mock-client-secret",
    refresh_token: "mock-refresh-token",
    quota_project_id: "mock-project",
  };
  await page.locator("#vertex-adc").setInputFiles({
    name: "mock-adc.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(credential)),
  });
  await page.getByText("已导入 ADC 凭证", { exact: true }).waitFor();
  assert.equal(await page.locator(".tutorial-overlay").count(), 0);
  await capture(page, "settings-after-import.png");

  await page.getByText("× 关闭", { exact: true }).click();
  await page.getByText("开始游戏", { exact: true }).waitFor();
  await page.evaluate(async fixture => {
    const saves = await import("/src/infra/saves.js");
    await saves.init();
    saves.importSave(JSON.stringify(fixture));
  }, villageSave);
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText(`${villageSave.label}（导入）`, { exact: true }).click();
  await page.locator(".tutorial-overlay").waitFor({ state: "visible" });
}

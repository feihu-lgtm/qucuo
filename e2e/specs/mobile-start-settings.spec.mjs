import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const viewport = { width: 390, height: 693 };
const villageSave = JSON.parse(readFileSync(new URL("../fixtures/saves/village.json", import.meta.url), "utf8"));

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
}

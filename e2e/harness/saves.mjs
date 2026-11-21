import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const fixturesDir = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));

export async function loadSave(page, name) {
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error(`Invalid save name: ${name}`);
  const save = JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), "utf8"));
  const url = page.url() === "about:blank"
    ? `http://127.0.0.1:${Number(process.env.QA_PORT) || 5199}`
    : page.url();
  await page.goto(url);
  await page.evaluate(async (fixture) => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
      apiType: "openai",
      endpoint: `${location.origin}/__qa_ai/v1/chat/completions`,
      apiKey: "local-test-only",
      model: "browser-fixture",
      streamEnabled: false,
      bookkeepEnabled: false,
      softSettleEnabled: false,
      questTriggerMode: "prompt",
      autoSaveEvery: 1,
    }));
    localStorage.setItem("qucuo_tutorial_seen", "1");
    const saves = await import("/src/infra/saves.js");
    await saves.init();
    saves.importSave(JSON.stringify(fixture));
  }, save);
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText(`${save.label}（导入）`, { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });
}

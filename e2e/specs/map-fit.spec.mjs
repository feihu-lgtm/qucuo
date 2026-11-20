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

export default async function mapFit({ page }) {
  const save = structuredClone(villageSave);
  save.snapshot.mapData = { ...save.snapshot.mapData, 雅江: {}, 锦官城: {} };
  await page.evaluate(async fixture => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
      apiType: "openai",
      endpoint: `${globalThis.location.origin}/__qa_ai/v1/chat/completions`,
      apiKey: "local-test-only",
      model: "browser-fixture",
      streamEnabled: false,
    }));
    localStorage.setItem("qucuo_tutorial_seen", "1");
    const saves = await import("/src/infra/saves.js");
    await saves.init();
    saves.importSave(JSON.stringify(fixture));
  }, save);
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText(`${save.label}（导入）`, { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });

  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  await tabs.getByRole("button", { name: /^左/ }).click();
  const left = page.getByTestId("left-panel");
  await left.getByRole("button", { name: "下一面" }).first().click();
  const mapModule = left.locator('[data-module="map"]');
  await mapModule.waitFor({ state: "visible" });
  await mapModule.getByText(/舆图·外/).click();

  const map = page.getByTestId("clickable-map");
  await map.waitFor({ state: "visible" });
  const mapBounds = await map.boundingBox();
  const assertExploredNodesFit = async () => {
    for (const name of ["雅江", "锦官城"]) {
      const bounds = await map.locator("svg text").filter({ hasText: name }).boundingBox();
      assert.ok(bounds, `${name} should be rendered`);
      assert.ok(bounds.x >= mapBounds.x && bounds.y >= mapBounds.y, `${name} is outside the map's top/left`);
      assert.ok(bounds.x + bounds.width <= mapBounds.x + mapBounds.width, `${name} is outside the map's right edge`);
      assert.ok(bounds.y + bounds.height <= mapBounds.y + mapBounds.height, `${name} is outside the map's bottom edge`);
    }
  };
  await assertExploredNodesFit();
  const close = page.getByText("× 关闭", { exact: true });
  assert.equal(await close.evaluate(element => globalThis.getComputedStyle(element).whiteSpace), "nowrap");
  assert.ok((await close.boundingBox()).height < 20);
  const reset = map.getByRole("button", { name: "重置地图视图" });
  const resetBounds = await reset.boundingBox();
  assert.ok(resetBounds.y + resetBounds.height <= mapBounds.y + mapBounds.height);
  await capture(page, "map-open.png");

  await map.getByText("＋", { exact: true }).click();
  await reset.click();
  await assertExploredNodesFit();
}

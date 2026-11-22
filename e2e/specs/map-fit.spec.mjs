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
      bookkeepEnabled: false,
      softSettleEnabled: false,
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
  // 点击区靠上下 padding 放大到 45px（#223），这里只量文字本身是否一行放下。
  assert.ok(await close.evaluate(element => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().height < 20;
  }));
  const reset = map.getByRole("button", { name: "重置地图视图" });
  const resetBounds = await reset.boundingBox();
  assert.ok(resetBounds.y + resetBounds.height <= mapBounds.y + mapBounds.height);
  await capture(page, "map-open.png");

  await map.getByText("＋", { exact: true }).click();
  await reset.click();
  await assertExploredNodesFit();

  await close.click();
  const innerSave = structuredClone(villageSave);
  innerSave.label = "QA inner map";
  innerSave.snapshot.room = { ...innerSave.snapshot.room, name: "锦官城" };
  innerSave.snapshot.innerRoomName = "锦官大车店";
  innerSave.snapshot.mapData = { ...innerSave.snapshot.mapData, 锦官城: { x: 3, y: 0 } };
  await page.evaluate(async fixture => {
    const saves = await import("/src/infra/saves.js");
    await saves.init();
    saves.importSave(JSON.stringify(fixture));
  }, innerSave);
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText(`${innerSave.label}（导入）`, { exact: true }).click();
  await page.getByText("锦官大车店", { exact: true }).waitFor({ state: "visible" });
  await tabs.getByRole("button", { name: /^左/ }).click();
  const innerMapModule = left.locator('[data-module="map"]');
  const nextFace = left.getByRole("button", { name: "下一面" }).first();
  for (let i = 0; i < 3 && !(await innerMapModule.isVisible()); i++) await nextFace.click();
  await innerMapModule.waitFor({ state: "visible" });
  await innerMapModule.getByText("内", { exact: true }).click();
  await innerMapModule.getByText(/村图·内/).click();
  const innerMap = page.getByTestId("clickable-map");
  const horse = innerMap.locator("svg text").filter({ hasText: /^马行$/ });
  await horse.waitFor();
  const horseBounds = await horse.boundingBox();
  const controlsBounds = await innerMap.getByTestId("map-zoom-controls").boundingBox();
  assert.ok(horseBounds.x + horseBounds.width < controlsBounds.x, "马行 should be outside the map controls column");
  await page.mouse.click(horseBounds.x + horseBounds.width / 2, horseBounds.y + horseBounds.height / 2);
  await page.waitForFunction(async () => {
    const { gameStore } = await import("/src/store/gameStore.js");
    return gameStore.getState().innerRoomName === "马行";
  }, null, { timeout: 10000 });
}

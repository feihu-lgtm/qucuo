import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const viewport = { width: 390, height: 693 };

async function capture(page, filename) {
  const directory = process.env.BLOCKED_SCREENSHOT_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, filename) });
}

export default async function blockedDirection({ page, ai, game }) {
  await game.loadSave(page, "village");
  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  await tabs.getByRole("button", { name: /^左/ }).click();
  const left = page.getByTestId("left-panel");
  await left.getByRole("button", { name: "下一面" }).first().click();
  const mapModule = left.locator('[data-module="map"]');
  await mapModule.waitFor({ state: "visible" });
  await mapModule.scrollIntoViewIfNeeded();
  await mapModule.getByText("内", { exact: true }).click();
  const innerBlocked = mapModule.locator('.mobile-mini-map [aria-label$="不通"]');
  await innerBlocked.first().waitFor({ state: "visible" });
  assert.ok(await innerBlocked.count() > 0);
  const mainRequests = () => ai.requests.filter(request => request.kind === "main").length;
  const requestCount = mainRequests();
  await innerBlocked.first().click();
  const toast = page.locator(".blocked-direction-toast");
  await toast.waitFor({ state: "visible" });
  assert.equal(mainRequests(), requestCount);
  await toast.click();

  await mapModule.getByText("外", { exact: true }).click();
  const grid = mapModule.locator(".mobile-mini-map");
  const blocked = grid.locator('[aria-label$="不通"]');
  await blocked.first().waitFor({ state: "visible" });
  assert.ok(await blocked.count() > 0);
  assert.equal(await blocked.first().innerText(), "✕");
  await capture(page, "left-grid.png");

  const held = ai.hold();
  await blocked.first().click();
  await game.waitFor(page, () => Boolean(held.request), { message: "blocked direction AI narration" });
  await toast.waitFor({ state: "visible" });
  assert.match(await toast.innerText(), /此路不通 · 往.{1,2}没有路/);
  await tabs.getByRole("button", { name: /^中/ }).click();
  await capture(page, "center-toast.png");

  held.release();
  const narration = "风过鱼定村，溪声在石阶间潺潺回响。";
  await game.waitFor(page, async () => (await game.state(page)).log.some(text => text.includes(narration)), { message: "mock narration" });
  await game.waitFor(page, async () => {
    const stop = page.getByRole("button", { name: /停止/ });
    return !(await stop.isVisible().catch(() => false));
  }, { message: "turn completion" });
  assert.deepEqual(game.consoleErrors, []);
}

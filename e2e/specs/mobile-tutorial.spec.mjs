import assert from "node:assert/strict";
import { loadSave } from "../harness/saves.mjs";

export const viewport = { width: 390, height: 693 };

export default async function mobileTutorial({ page }) {
  await loadSave(page, "village");
  await page.getByText("☰ 菜单", { exact: true }).click();
  await page.getByText("新手教程", { exact: true }).click();
  const overlay = page.locator(".tutorial-overlay");
  await overlay.waitFor({ state: "visible" });
  const before = await overlay.evaluate(element => ({
    top: element.scrollTop,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  assert.ok(before.scrollHeight > before.height);
  await overlay.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.getByText(/⚙ 其他功能/).waitFor({ state: "visible" });
  const after = await overlay.evaluate(element => element.scrollTop);
  assert.ok(after > before.top);
}

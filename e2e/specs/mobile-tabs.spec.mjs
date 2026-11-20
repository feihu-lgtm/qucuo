import assert from "node:assert/strict";

export const viewport = { width: 390, height: 664 };

export default async function mobileTabs({ page, game }) {
  await game.loadSave(page, "village");
  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  const left = page.getByTestId("left-panel");
  const right = page.getByTestId("right-panel");
  const input = page.locator(".game-input");
  const choose = prefix => tabs.getByRole("button", { name: new RegExp(`^${prefix}`) }).click();
  const activeColumn = () => tabs.locator('[aria-current="page"]').innerText();
  assert.equal(await activeColumn(), "中");
  assert.equal(await input.isVisible(), true);
  assert.equal(await page.locator(".face-bar:visible").count(), 0);
  const inputBox = await input.boundingBox();
  const tabBox = await tabs.boundingBox();
  const statusBox = await page.getByRole("button", { name: /^全流程日志/ }).boundingBox();
  assert.ok(inputBox.y + inputBox.height <= tabBox.y);
  assert.ok(statusBox.y + statusBox.height <= tabBox.y);
  for (const button of await tabs.getByRole("button").all()) {
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
  }

  await choose("左");
  assert.equal(await left.isVisible(), true);
  assert.equal(await left.locator('[aria-current="true"]').innerText(), "此地");
  assert.equal(await activeColumn(), "左 1/2");
  const content = await left.locator(".face-content").boundingBox();
  const touch = await page.context().newCDPSession(page);
  const y = content.y + Math.min(100, content.height / 2);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 280, y }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 100, y }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.detach();
  await game.waitFor(page, async () => (await activeColumn()) === "左 2/2", { message: "touch face switch" });
  assert.equal(await left.locator('[aria-current="true"]').innerText(), "周遭");

  await left.locator('[data-module="buildings"]').getByRole("button").first().click();
  await game.waitFor(page, async () => (await activeColumn()) === "中", { message: "building opens center column" });
  assert.equal(await page.getByText(/现有信鸽.*每日可领/).isVisible(), true);
  await page.getByText("关闭", { exact: true }).click();
  await choose("左");
  assert.equal(await activeColumn(), "左 2/2");

  await choose("右");
  assert.equal(await right.isVisible(), true);
  assert.match(await activeColumn(), /^右 \d+\/\d+$/);
  await right.getByRole("button", { name: "下一面", exact: true }).first().click();
  const rightLabel = await activeColumn();
  await choose("中");
  assert.equal(await input.isVisible(), true);
  assert.equal(await page.locator(".face-bar:visible").count(), 0);
  await choose("右");
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText("QA village（导入）", { exact: true }).click();
  await tabs.waitFor({ state: "visible" });
  assert.equal(await activeColumn(), rightLabel);
  await choose("左");
  assert.equal(await activeColumn(), "左 2/2");
  await choose("中");
  await page.locator("html").evaluate(element => element.setAttribute("data-keyboard-open", ""));
  assert.equal(await tabs.isVisible(), false);
  await page.locator("html").evaluate(element => element.removeAttribute("data-keyboard-open"));
  assert.equal(await tabs.isVisible(), true);
}

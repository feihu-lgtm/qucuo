import assert from "node:assert/strict";

export const viewport = { width: 390, height: 844 };

export default async function mobileKeyboard({ page, game }) {
  await game.loadSave(page, "village");
  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  const input = page.getByPlaceholder("输入行动指令…（消耗1回合）");
  await input.click();
  assert.equal(await input.evaluate(element => element === element.ownerDocument.activeElement), true);
  const originalInput = await input.elementHandle();

  // iOS first reports the keyboard via visualViewport.resize.
  const restoreViewport = await page.evaluateHandle(() => {
    const viewport = globalThis.visualViewport;
    const viewportHeight = Object.getOwnPropertyDescriptor(viewport, "height");
    const innerHeight = Object.getOwnPropertyDescriptor(globalThis, "innerHeight");
    Object.defineProperty(viewport, "height", { configurable: true, value: 524 });
    viewport.dispatchEvent(new globalThis.Event("resize"));
    return () => {
      if (viewportHeight) Object.defineProperty(viewport, "height", viewportHeight);
      else delete viewport.height;
      if (innerHeight) Object.defineProperty(globalThis, "innerHeight", innerHeight);
      else delete globalThis.innerHeight;
      viewport.dispatchEvent(new globalThis.Event("resize"));
    };
  });
  await tabs.waitFor({ state: "hidden" });

  // The ensuing Safari scroll also contracts innerHeight while the keyboard stays open.
  await page.evaluate(() => {
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 524 });
    globalThis.visualViewport.dispatchEvent(new globalThis.Event("scroll"));
  });
  assert.equal(await tabs.isHidden(), true, "Safari scroll must not close the keyboard layout");

  let typed = "";
  for (const character of "abcd") {
    await page.keyboard.press(character);
    typed += character;
    assert.equal(await input.inputValue(), typed);
    assert.equal(await originalInput.evaluate(element => element === element.ownerDocument.activeElement), true);
  }

  await restoreViewport.evaluate(restore => restore());
  assert.equal(await page.evaluate(() => globalThis.innerHeight), viewport.height);
  await tabs.waitFor({ state: "visible" });
}

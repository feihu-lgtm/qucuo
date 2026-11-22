import assert from "node:assert/strict";

export const viewport = { width: 390, height: 664 };

export default async function mobileTabs({ page, game, ai }) {
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
  // 44px 的输入框装在 35px 的输入栏里，底部探出约 5px，把中栏内容撑到 599px
  // （容器 594px）。挂载后 inputRef.focus() 与 logEnd.scrollIntoView 会各自把这
  // 段溢出滚掉，输入框底边才收回标签栏顶之上；在此之前量会量到 5px 重叠的瞬态。
  // 先等这段溢出滚到底，再确认两帧内几何不再变化。
  await game.waitFor(page, () => page.evaluate(() => {
    const col = globalThis.document.querySelector(".mobile-input-bar")?.parentElement;
    return !col || col.scrollTop >= col.scrollHeight - col.clientHeight - 1;
  }), { message: "center column overflow scrolled to bottom" });
  await game.waitFor(page, () => page.evaluate(() => new Promise(resolve => {
    const read = () => [".game-input", ".mobile-tab-bar"].map(sel => {
      const el = globalThis.document.querySelector(sel);
      if (!el) return "absent";
      const r = el.getBoundingClientRect();
      return `${r.x},${r.y},${r.width},${r.height}`;
    }).join("|");
    const first = read();
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve(read() === first)));
  })), { message: "settle first-frame layout before measuring" });
  const inputBox = await input.boundingBox();
  const tabBox = await tabs.boundingBox();
  const statusBox = await page.getByRole("button", { name: /^全流程日志/ }).boundingBox();
  assert.ok(inputBox.y + inputBox.height <= tabBox.y);
  assert.ok(statusBox.y + statusBox.height <= tabBox.y);
  for (const button of await tabs.getByRole("button").all()) {
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 28);
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

  await page.waitForTimeout(550);
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
  const narrative = page.getByTestId("narrative-log");
  assert.equal(await narrative.evaluate(element => element.scrollHeight > element.clientHeight), true);
  await game.waitFor(page, () => narrative.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop < 2), { message: "restored narrative scrolled to bottom" });
  await narrative.evaluate(element => { element.scrollTop = 0; });
  await choose("左");
  await choose("中");
  assert.equal(await narrative.evaluate(element => element.scrollTop), 0);
  await choose("左");
  await page.evaluate(async () => {
    const { gameStore } = await import("/src/store/gameStore.js");
    gameStore.setState(state => ({ log: [...state.log, { t: "sys", text: "QA hidden narrative update" }] }));
  });
  await page.getByText("QA hidden narrative update", { exact: true }).waitFor({ state: "attached" });
  await choose("中");
  await game.waitFor(page, () => narrative.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop < 2), { message: "hidden narrative update scrolled to bottom" });
  await page.locator("html").evaluate(element => {
    element.ownerDocument.activeElement?.blur();
    element.setAttribute("data-keyboard-open", "");
  });
  await tabs.waitFor({ state: "hidden" });
  await page.locator("html").evaluate(element => element.removeAttribute("data-keyboard-open"));
  await tabs.waitFor({ state: "visible" });

  ai.next({ output: ["我整理好行囊，沿着溪边望向村口。"] });
  await game.act(page, "我整理了一下行囊");
  await game.waitFor(page, () => page.evaluate(async () => {
    const { turnMonitor } = await import("/src/infra/turnMonitor.js");
    return turnMonitor.getTrees().some((turn) => turn.raw === "我整理了一下行囊" && turn.phase === "DONE");
  }), { message: "timestamped trace turn" });
  await page.setViewportSize({ width: 390, height: 693 });
  await page.getByRole("button", { name: /^全流程日志/ }).click();
  const dialog = page.getByRole("dialog", { name: "全流程日志" });
  const summary = dialog.locator("details > summary").first();
  await summary.waitFor({ state: "visible" });
  assert.match(await summary.innerText(), /^\d{2}:\d{2}:\d{2} ·/);
  await page.screenshot({ path: "/home/ubuntu/mobshots/logtime/log.png", animations: "disabled" });
}

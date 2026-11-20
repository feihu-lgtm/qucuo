import assert from "node:assert/strict";

export const viewport = { width: 390, height: 693 };

const itemsInRoom = page => page.evaluate(async () => {
  const { gameStore } = await import("/src/store/gameStore.js");
  const state = gameStore.getState();
  return {
    items: state.room?.items || [],
    inventory: state.inv || [],
  };
});

const itemName = item => typeof item === "string" ? item : item?.name;

export default async function mobileSubmenu({ page, ai, game }) {
  await game.loadSave(page, "village");
  const row = page.locator(".mobile-control-row");
  const narrative = page.getByTestId("narrative-log");
  const input = page.locator(".mobile-input-bar");
  assert.equal(await row.count(), 1);
  const [rowBox, narrativeBox, inputBox] = await Promise.all([
    row.boundingBox(), narrative.boundingBox(), input.boundingBox(),
  ]);
  assert.ok(rowBox.y >= narrativeBox.y);
  assert.ok(rowBox.y + rowBox.height <= inputBox.y + 1);

  const mode = page.locator('[data-control-trigger="mode"]');
  const people = page.locator('[data-control-trigger="people"]');
  const ground = page.locator('[data-control-trigger="ground"]');
  const menus = page.locator(".center-control-menu");

  await mode.click();
  await page.locator('[data-control-menu="mode"]').waitFor({ state: "visible" });
  await people.click();
  assert.equal(await menus.count(), 1);
  assert.equal(await page.locator('[data-control-menu="mode"]').count(), 0);
  assert.equal(await page.locator('[data-control-menu="people"]').count(), 1);

  const peopleOptions = page.locator('[data-control-menu="people"] [role="menuitem"]');
  const firstNpc = (await peopleOptions.nth(1).innerText()).trim();
  const secondNpc = (await peopleOptions.nth(2).innerText()).trim();
  if (!firstNpc || !secondNpc) throw new Error("Expected at least two visible village NPCs");
  await peopleOptions.nth(1).click();
  assert.ok((await people.innerText()).includes(firstNpc));

  await mode.click();
  const modeMenu = page.locator('[data-control-menu="mode"]');
  await modeMenu.getByRole("menuitem", { name: /◎ 对话/ }).click();
  assert.ok((await mode.innerText()).includes("对话"));
  assert.ok((await people.innerText()).includes(firstNpc));

  await people.click();
  const nsfw = page.locator('[data-control-action="nsfw"]');
  const nsfwBefore = await nsfw.getAttribute("aria-pressed");
  await nsfw.click();
  assert.equal(await menus.count(), 0);
  assert.notEqual(await nsfw.getAttribute("aria-pressed"), nsfwBefore);

  await mode.click();
  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  await tabs.getByRole("button", { name: /^右/ }).click();
  await tabs.getByRole("button", { name: /^中/ }).click();
  await game.waitFor(page, () => menus.count().then(count => count === 0), { message: "column switch closes submenu" });

  await mode.click();
  await page.locator('[data-control-menu="mode"]').getByRole("menuitem", { name: /◈ 行动/ }).click();
  const groundBefore = await itemsInRoom(page);
  const selectedItem = "界石";
  const firstOtherItem = groundBefore.items.find(item => itemName(item) !== selectedItem);
  if (!groundBefore.items.some(item => itemName(item) === selectedItem) || !firstOtherItem) {
    throw new Error("Expected 界石 and another seeded ground item");
  }
  const firstOtherName = itemName(firstOtherItem);
  const firstOtherInventoryCount = groundBefore.inventory.filter(item => itemName(item) === firstOtherName).length;
  await ground.click();
  const groundMenu = page.locator('[data-control-menu="ground"]');
  await groundMenu.waitFor({ state: "visible" });
  assert.equal((await groundMenu.getByRole("menuitem").first().innerText()).trim(), "不选");
  await page.locator(`[data-ground-select="${selectedItem}"]`).click();
  assert.ok((await ground.innerText()).includes(`${selectedItem} ▾`));
  assert.ok((await itemsInRoom(page)).items.some(item => itemName(item) === selectedItem));

  await ground.click();
  await page.locator(`[data-ground-pickup="${firstOtherName}"]`).click();
  await game.waitFor(page, async () => !(await itemsInRoom(page)).items.some(item => itemName(item) === firstOtherName), {
    message: "separate pickup removes the other item from the ground",
  });
  const afterFirstPickup = await itemsInRoom(page);
  assert.ok((await ground.innerText()).includes(`${selectedItem} ▾`));
  assert.equal(afterFirstPickup.inventory.filter(item => itemName(item) === firstOtherName).length, firstOtherInventoryCount + 1);

  const heldPickupItem = afterFirstPickup.items.find(item => itemName(item) !== selectedItem);
  if (!heldPickupItem) throw new Error("Expected another ground item for the held-turn pickup");
  const heldPickupName = itemName(heldPickupItem);
  const held = ai.hold();
  const heldInventoryBefore = afterFirstPickup.inventory.filter(item => itemName(item) === heldPickupName).length;
  const queuedLogCountBefore = (await game.state(page)).log.filter(line => line.includes("已入队")).length;

  try {
    await game.act(page, "我环顾村口，记下溪流交汇之处。");
    await game.waitFor(page, () => Boolean(held.request), { message: "held AI turn" });
    const mainRequestCount = ai.requests.filter(request => request.kind === "main").length;
    const requestText = JSON.stringify(held.request.body.messages || []);
    assert.ok(requestText.includes("[涉及物品]"));
    assert.ok(requestText.includes(`地上的「${selectedItem}」`));

    await mode.click();
    await page.locator('[data-control-menu="mode"]').getByRole("menuitem", { name: /◎ 对话/ }).click();
    assert.ok((await mode.innerText()).includes("对话"));
    assert.ok((await people.innerText()).includes(firstNpc));

    await people.click();
    await page.locator('[data-control-menu="people"]').getByRole("menuitem", { name: secondNpc, exact: true }).click();
    assert.ok((await people.innerText()).includes(secondNpc));
    assert.equal(ai.requests.filter(request => request.kind === "main").length, mainRequestCount);

    await ground.click();
    await page.locator(`[data-ground-pickup="${heldPickupName}"]`).click();
    await game.waitFor(page, async () => (await game.state(page)).queueCount === 1, { message: "one queued ground pickup" });
    await page.locator('[data-control-action="meditate"]').click();
    const queued = await game.state(page);
    assert.equal(queued.queueCount, 2);
    assert.equal(queued.log.filter(line => line.includes("已入队")).length - queuedLogCountBefore, 2);
    assert.ok((await itemsInRoom(page)).items.some(item => itemName(item) === heldPickupName));
    assert.ok((await ground.innerText()).includes(`${selectedItem} ▾`));

    held.release();
    await game.waitFor(page, async () => {
      const state = await game.state(page);
      const current = await itemsInRoom(page);
      return held.request.done
        && state.queueCount === 0
        && !current.items.some(item => itemName(item) === heldPickupName);
    }, { timeout: 20000, message: "held turn and queued local controls settle" });
    const after = await game.state(page);
    const inventory = await itemsInRoom(page);
    assert.equal(after.rollbackLabel, "↩ 回滚");
    assert.equal(inventory.inventory.filter(item => itemName(item) === heldPickupName).length, heldInventoryBefore + 1);
    assert.equal(after.log.filter(line => line.includes(`你拾起「${heldPickupName}」`)).length, 1);
    assert.ok(inventory.items.some(item => itemName(item) === selectedItem));
    assert.ok((await ground.innerText()).includes(`${selectedItem} ▾`));
    assert.deepEqual(game.consoleErrors, []);
  } finally {
    held.release();
  }
}

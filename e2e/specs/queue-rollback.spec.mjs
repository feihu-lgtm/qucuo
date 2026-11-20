export default async function queueRollback({ page, ai, game }) {
  await game.loadSave(page, "village");
  const before = await game.state(page);
  const missingNpcs = ["才旦", "老孙"].filter((name) => !before.npcs.includes(name));
  if (missingNpcs.length) throw new Error(`Missing 鱼定村 residents ${missingNpcs.join(", ")}; found ${before.npcs.join(", ")}`);
  if (before.silver < 10000) throw new Error(`Expected ample silver in village save; found ${before.silver}`);

  const held = ai.hold();
  await game.act(page, "我拾起一片落叶，仔细辨认上面的纹路。");
  await game.waitFor(page, () => Boolean(held.request), { timeout: 10000, message: "held main AI request" });
  const npcName = page.getByText("才旦", { exact: false }).first();
  await npcName.locator("xpath=../..").getByTitle(/打开互动菜单/).click();
  await page.locator(".mobile-action-panel").getByText("送礼", { exact: true }).click();
  await page.locator(".mobile-action-list").getByText("半袋青稞", { exact: true }).click();

  await game.waitFor(page, async () => {
    const current = await game.state(page);
    return current.queueCount === 1 && current.rollbackLabel === "等待落盘";
  }, { timeout: 10000, message: "queued gift and rollback lock" });
  const queued = await game.state(page);
  if (queued.inventory.filter((item) => item === "半袋青稞").length !== before.inventory.filter((item) => item === "半袋青稞").length) {
    throw new Error("Queued gift changed inventory before the held turn committed");
  }

  held.release();
  await game.waitFor(page, async () => {
    const current = await game.state(page);
    const giftLogs = current.log.filter((line) => line.includes("送出「半袋青稞」") || line.includes("赠予才旦"));
    return current.queueCount === 0
      && current.rollbackLabel === "↩ 回滚"
      && current.inventory.filter((item) => item === "半袋青稞").length === before.inventory.filter((item) => item === "半袋青稞").length - 1
      && giftLogs.length === 1;
  }, { timeout: 20000, message: "queued gift to settle exactly once" });
}

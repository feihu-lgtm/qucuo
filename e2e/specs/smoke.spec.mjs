export default async function smoke({ page, game }) {
  await game.loadSave(page, "village");
  const before = await game.state(page);
  await game.act(page, "我拾起一片落叶，仔细辨认上面的纹路。");
  await game.waitFor(page, async () => {
    const current = await game.state(page);
    return current.turn > before.turn && current.log.some((line) => line.includes("风过鱼定村"));
  }, { timeout: 15000, message: "smoke turn to commit" });
  if (game.consoleErrors.length) throw new Error(`Browser console errors: ${game.consoleErrors.join("\n")}`);
}

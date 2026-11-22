import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const artifacts = fileURLToPath(new URL("../.artifacts/", import.meta.url));
const spirits = ["吃好了", "挠痒痒", "对村里有恩", "力气够大", "打了坏人", "交际够高", "治好雪豹的病"];

async function loadOpeningSave(page, flags) {
  await page.evaluate(async (savedFlags) => {
    const { buildInitialGameState } = await import("/src/engine/newGame.js");
    const { importSave } = await import("/src/infra/saves.js");
    const snapshot = { ...buildInitialGameState(null, 42), savedAt: Date.now(), version: 1, rngState: 42, flags: savedFlags, claimedMilestones: [] };
    importSave(JSON.stringify({ kind: "qucuo-save-export", label: savedFlags.length ? "QA trusted leopard" : "QA opening leopard", snapshot }));
    localStorage.setItem("qucuo_right_faces", JSON.stringify({ faces: [{ id: "jianghu", name: "江湖", modules: ["jianghu"] }], currentIndex: 0 }));
    localStorage.setItem("qucuo_left_faces", JSON.stringify({ faces: [{ id: "surroundings", name: "周遭", modules: ["npcs"] }], currentIndex: 0 }));
  }, flags);
  await page.reload();
  await page.getByText("加载游戏", { exact: true }).click();
  await page.getByText(flags.length ? "QA trusted leopard（导入）" : "QA opening leopard（导入）", { exact: true }).click();
  await page.locator(".game-input").waitFor({ state: "visible" });
}

export default async function snowLeopardQuest({ page, ai, game }) {
  mkdirSync(artifacts, { recursive: true });
  await game.loadSave(page, "village");
  await loadOpeningSave(page, []);
  await page.getByRole("button", { name: "任务", exact: true }).click();
  const content = page.locator(".mobile-overlay-content");
  await content.getByText("收复雪豹", { exact: true }).waitFor();
  assert.equal(await content.locator("span").first().textContent(), "收复雪豹");
  await content.getByText("证明与山川有缘 · 0/5", { exact: true }).waitFor();
  for (const label of spirits) await content.getByText(`○ ${label}`, { exact: true }).waitFor();
  await page.screenshot({ path: `${artifacts}/snow-leopard-opening.png`, fullPage: true, animations: "disabled" });

  await loadOpeningSave(page, ["snow_spirit_meat", "snow_spirit_scratch", "snow_spirit_village", "snow_spirit_duel", "snow_spirit_medicine"]);
  const menuTitle = "打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师";
  await page.getByTitle(menuTitle).locator("..").filter({ hasText: "雪豹" }).getByTitle(menuTitle).click();
  const invite = page.getByText("邀请入队", { exact: true });
  await invite.waitFor({ state: "visible" });
  await page.screenshot({ path: `${artifacts}/snow-leopard-invite.png`, fullPage: true, animations: "disabled" });
  ai.next({ output: ["雪豹把额头抵入掌心，从此与你同行。"] });
  await invite.click();
  await game.waitFor(page, async () => page.evaluate(async () => {
    const { gameStore } = await import("/src/store/gameStore.js");
    const state = gameStore.getState();
    return state.companionState.snowLeopard.unlocked && state.questProgress.snow_leopard_quest.status === "completed";
  }), { message: "leopard companion and completed quest" });
  await page.getByRole("button", { name: "任务", exact: true }).click();
  await content.getByText("✓ 收复雪豹", { exact: true }).waitFor();
  await page.screenshot({ path: `${artifacts}/snow-leopard-completed.png`, fullPage: true, animations: "disabled" });
  assert.deepEqual(game.consoleErrors, []);
}

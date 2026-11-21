import assert from "node:assert/strict";

export const viewport = { width: 390, height: 693 };

export default async function characterCreate({ page, game }) {
  await page.evaluate(() => {
    localStorage.setItem("wuxia_mud_api_config", JSON.stringify({
      apiType: "openai",
      endpoint: `${globalThis.location.origin}/__qa_ai/v1/chat/completions`,
      apiKey: "local-test-only",
      model: "browser-fixture",
      streamEnabled: false,
      bookkeepEnabled: false,
      questTriggerMode: "prompt",
      autoSaveEvery: 1,
    }));
    localStorage.setItem("qucuo_tutorial_seen", "1");
  });
  await page.reload();
  await page.getByRole("button", { name: /开始游戏/ }).click();
  await page.getByText("新建角色", { exact: true }).click();
  await page.getByText("少侠名讳", { exact: true }).waitFor();
  await page.locator(".character-create-card input").first().fill("QA少侠");
  await page.getByRole("button", { name: "下一步：分配七维 ▸" }).click();
  const continueButton = page.getByRole("button", { name: "选好了 ▸" });
  await page.getByText("七维分配 · 尚余 20 点", { exact: true }).waitFor();
  assert.equal(await continueButton.isDisabled(), true);
  if (process.env.QA_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.QA_SCREENSHOT_PATH });
  }
  await page.getByRole("button", { name: "随机分配", exact: true }).click();
  assert.equal(await continueButton.isDisabled(), false);
  await continueButton.click();
  const firstCard = page.locator(".starter-skill-card-list > button").first();
  const skillName = await firstCard.locator("span").first().innerText();
  await firstCard.click();
  await page.getByRole("button", { name: "踏入曲措乡 ▸" }).click();
  await page.locator(".opening-sequence-root").click();
  await page.locator(".opening-sequence-root").click();
  await page.locator(".game-input").waitFor();
  const tabs = page.getByRole("navigation", { name: "界面栏目" });
  await tabs.getByRole("button", { name: /^右/ }).click();
  const right = page.getByTestId("right-panel");
  await right.getByText("武学", { exact: true }).click();
  await right.getByText(skillName).waitFor();
  if (game.consoleErrors.some((error) => !error.startsWith("Request failed:"))) {
    throw new Error(game.consoleErrors.filter((error) => !error.startsWith("Request failed:")).join("\n"));
  }
}

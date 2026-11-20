import assert from "node:assert/strict";

export const viewport = { width: 390, height: 693 };

export default async function mobileStartSettings({ page }) {
  await page.getByText("设置", { exact: true }).click();
  await page.getByText("× 关闭", { exact: true }).click();
  await page.getByText("开始游戏", { exact: true }).waitFor();

  await page.getByText("开始游戏", { exact: true }).click();
  await page.getByText("新建角色", { exact: true }).click();
  await page.getByText("尚未配置 API 凭证", { exact: true }).waitFor();
  await page.getByRole("button", { name: "返回主菜单" }).click();
  assert.equal(await page.getByText("开始游戏", { exact: true }).count(), 1);
}

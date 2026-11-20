import { loadSave } from "./saves.mjs";

export async function act(page, text) {
  const input = page.locator(".game-input");
  await input.waitFor({ state: "visible" });
  await input.fill(text);
  await input.press("Enter");
}

export async function state(page) {
  return page.evaluate(async () => {
    const { gameStore } = await import("/src/store/gameStore.js");
    const current = gameStore.getState();
    const toolbar = document.querySelector(".mobile-center-toolbar-controls");
    const rollbackText = toolbar?.querySelector('[title*="撤销上一步行动"]')?.textContent?.trim() || "";
    const queueLabel = [...document.querySelectorAll("span")]
      .map((element) => element.textContent.trim())
      .find((text) => /^排队中\s+\d+$/.test(text));
    return {
      room: current.room?.name || "",
      inner: current.innerRoomName || "",
      silver: current.char?.money ?? 0,
      turn: current.time ?? 0,
      queueCount: Number(queueLabel?.match(/\d+/)?.[0] || 0),
      rollbackLabel: rollbackText || null,
      inventory: (current.inv || []).map((item) => typeof item === "string" ? item : item?.name).filter(Boolean),
      npcs: (current.room?.npcs || []).map((npc) => npc.name),
      log: (current.log || []).map((entry) => entry.text || ""),
    };
  });
}

export async function waitFor(page, predicate, { timeout = 10000, interval = 50, message = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate(page);
    if (value) return value;
    await page.waitForTimeout(interval);
  }
  throw new Error(`Timed out waiting for ${message}`);
}

export { loadSave };

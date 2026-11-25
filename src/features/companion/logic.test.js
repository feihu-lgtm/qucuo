import { expect, it } from "vitest";
import { switchCompanion, recallCompanion } from "./logic.js";

it.each([["asuka", "明日香"], ["snowLeopard", "雪豹"], [null, null]])("switches the single active companion: %s", (key, label) => {
  const companionState = { asuka: { active: false }, snowLeopard: { active: true } };
  const result = switchCompanion({ companionState }, key);
  const next = result.changes.companionState(companionState);
  expect(next.asuka.active).toBe(key === "asuka");
  expect(next.snowLeopard.active).toBe(key === "snowLeopard");
  expect(companionState.snowLeopard.active).toBe(true);
  expect(result.logs).toEqual([{ t: "sys", text: label ? `  （${label}换上了出战位。）` : "  （换下了出战位，队友照常随行。）" }]);
});

it("names imported companions by their own label", () => {
  const companionState = { imported_元朵朵: { unlocked: true, active: false, label: "元朵朵", data: {} } };
  expect(switchCompanion({ companionState }, "imported_元朵朵").logs[0].text).toContain("元朵朵");
});

it("refuses to deploy a companion stationed elsewhere and changes nothing", () => {
  const companionState = { imported_阿财: { unlocked: true, active: false, label: "阿财", data: {}, stationed: { roomName: "客栈" } } };
  const result = switchCompanion({ companionState }, "imported_阿财");
  expect(result.changes).toBeUndefined();
  expect(result.logs[0].text).toContain("客栈");
});

it("handles an empty companion roster", () => {
  expect(switchCompanion({ companionState: {} }, null).changes.companionState({})).toEqual({});
});

it("recalls a stationed companion only in the room where it waits", () => {
  const companionState = { asuka: { unlocked: true, active: false, label: "明日香", data: {}, stationed: { district: "天都镇", roomId: "茶楼", roomName: "茶楼" } } };
  const away = recallCompanion({ companionState, room: { name: "鱼定村" } }, "asuka");
  expect(away.changes).toBeUndefined();
  const here = recallCompanion({ companionState, room: { name: "天都镇" }, innerRoomName: "茶楼" }, "asuka");
  const next = here.changes.companionState(companionState);
  expect(next.asuka.stationed).toBeUndefined();
  expect(switchCompanion({ companionState: next }, "asuka").changes.companionState(next).asuka.active).toBe(true);
});

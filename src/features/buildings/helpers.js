// buildings/logic 拆分出来的共享小工具——只供本目录内部使用，不经 logic.js 壳导出。
import { makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";

export const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });
export const noOpResult = () => ({ logs: [] });
export const isPositiveAmount = (amount) => Number.isFinite(amount) && amount > 0;
export const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

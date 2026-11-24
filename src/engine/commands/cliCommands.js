// CLI 文本命令注册项：每条 {id, match, parse, execute}，顺序与旧版 runner 逐分支
// if 链完全一致（动词前缀锚定，互相不重叠）。execute 返回命令退出码，或 PASS
// 表示本行未消费、继续尝试后续条目（旧版 `走|去` 匹配后仍可能落到自由输入）。
// execute 只通过 ctx 拿会话服务（applyFeature/featureCtx/runFreeText/session 等），
// 由 cli/runner.mjs 注入——本文件不 import store/cli，保持 engine 层不反向依赖。
import { pickGroundItem, consumeItem } from "../../features/items/logic.js";
import { comfort, resolveTrauma, confessToNarrator } from "../../features/narrator/logic.js";
import { switchCompanion } from "../../features/companion/logic.js";
import { meditate, trainNeigong, trainWaigong, breakthroughSkill } from "../../features/cultivation/logic.js";
import { deposit, withdraw, pledge, redeem } from "../../features/bank/logic.js";
import { innerMove, outerArrival } from "../../features/map/logic.js";
import {
  giftNpc,
  learnNpcSkill,
  lookNpc,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "../../features/npc/logic.js";
import { inviteCompanion } from "../../features/npc/inviteCompanion.js";
import { sendPigeonLetter } from "../../features/pigeon/logic.js";
import {
  buyBook,
  getPriceForDest,
  pray,
  restAtInn,
  travelByCarriage,
} from "../../features/buildings/logic.js";
import { LIBRARY_BOOKS_JINGGUAN } from "../../domain/data/buildings/libraryData.js";
import { getBuildingsForLocation, BUILDING_TYPE } from "../../domain/data/buildings/qucuoBuildings.js";
import { getDistrictAnchor, hasInnerMap, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { serializeSquares } from "../../domain/rules/map/mapSquares.js";
import { resolveExit } from "../../domain/data/map/qucuoMap.js";
import { parseDir } from "../../utils/mudHelpers.js";

export const PASS = Symbol("cli-command-pass");

const byName = (entry) => (typeof entry === "object" ? entry?.name : entry);
const itemNamed = (list, name) => (list || []).find((entry) => byName(entry) === name);
const visibleNpcs = (state) => (state.room?.npcs || []).filter((npc) => (
  isNpcVisibleInInnerRoom(state.room?.name, state.innerRoomName, npc)
));
const pigeonTargets = (state) => {
  const currentNpcNames = new Set((state.room?.npcs || []).map((npc) => npc.name));
  return [...new Set([
    ...visibleNpcs(state).map((npc) => npc.name),
    ...(state.varTree?.世界?.曾经出现人物 || []).filter((name) => !currentNpcNames.has(name)),
  ])].filter(Boolean).sort((a, b) => b.length - a.length);
};
const missingNpc = (ctx, name) => ctx.applyFeature({
  logs: [{ t: "err", text: `  此处没有 ${name}。` }],
});

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const longestNameMatch = (npcs, predicate) => [...npcs]
  .sort((a, b) => (b?.name?.length || 0) - (a?.name?.length || 0))
  .find(predicate);

export const CLI_COMMANDS = [
  {
    id: "cliItemUse",
    match: /^(?:用|服)\s+(.+)$/,
    parse: (m) => ({ itemName: m[1].trim() }),
    execute: (ctx, { itemName }) => {
      const item = itemNamed(ctx.state.inv, itemName);
      if (!item) return ctx.applyFeature({ logs: [{ t: "sys", text: `  背包里没有「${itemName}」。` }] });
      return ctx.applyFeature(consumeItem(ctx.state, item));
    },
  },
  {
    id: "cliItemUse",
    match: /^捡\s+(.+)$/,
    parse: (m) => ({ itemName: m[1].trim() }),
    execute: async (ctx, { itemName }) => {
      const item = itemNamed(ctx.state.room?.items, itemName);
      if (!item) return ctx.applyFeature({ logs: [{ t: "sys", text: `  地上没有「${itemName}」。` }] });
      const status = await ctx.applyFeature(pickGroundItem(ctx.state, item));
      const room = ctx.getState().room;
      ctx.session.roomMap[room.name] = { items: [...room.items], npcs: [...room.npcs] };
      return status;
    },
  },
  {
    id: "cliNarratorCompanion",
    match: /^安抚 (.*)$/,
    parse: (m) => ({ method: m[1].trim() }),
    execute: (ctx, { method }) => ctx.applyFeature(comfort(ctx.state, method)),
  },
  {
    id: "cliNarratorCompanion",
    match: "收束创伤",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(resolveTrauma(ctx.state)),
  },
  {
    id: "cliNarratorCompanion",
    match: "向旁白告白",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(confessToNarrator(ctx.state)),
  },
  {
    id: "cliNarratorCompanion",
    match: /^换队友 (.*)$/,
    parse: (m) => ({ key: m[1].trim() }),
    execute: (ctx, { key }) => ctx.applyFeature(switchCompanion(ctx.state, key === "none" ? null : key)),
  },
  {
    id: "cliInn",
    match: "住店",
    parse: () => ({}),
    execute: (ctx) => {
      const inn = getBuildingsForLocation(ctx.state.room.name)
        .find((building) => building.type === BUILDING_TYPE.INN);
      if (!inn) return ctx.applyFeature({ logs: [{ t: "err", text: "  此处没有客栈。" }] });
      return ctx.applyFeature(restAtInn(ctx.state, {
        cost: inn.innPrice || 10,
        roomType: "普通客房",
        buildingName: inn.name,
      }));
    },
  },
  {
    id: "cliCarriage",
    match: /^坐车\s+(.+)$/,
    parse: (m) => ({ destName: m[1] }),
    execute: async (ctx, { destName }) => {
      const { state } = ctx;
      const hasCarriage = getBuildingsForLocation(state.room?.name)
        .some((building) => building.type === BUILDING_TYPE.TRANSPORT);
      if (!hasCarriage) return ctx.applyFeature({ logs: [{ t: "err", text: "  此处没有驿站。" }] });
      const roomMap = {
        ...ctx.session.roomMap,
        ...(state.room?.name ? {
          [state.room.name]: {
            items: [...(state.room.items || [])],
            npcs: [...(state.room.npcs || [])],
          },
        } : {}),
      };
      const result = travelByCarriage(state, destName, getPriceForDest(destName), { roomMap });
      if (result.changes?.room && state.room?.name) {
        ctx.session.roomMap[state.room.name] = roomMap[state.room.name];
      }
      const status = await ctx.applyFeature(result);
      if (result.changes?.room) {
        ctx.setInnerRoomName(hasInnerMap(destName) ? getDistrictAnchor(destName) : null);
      }
      return status;
    },
  },
  {
    id: "cliBook",
    match: /^买书\s+(.+)$/,
    parse: (m) => ({ bookName: m[1] }),
    execute: (ctx, { bookName }) => {
      const bookshop = getBuildingsForLocation(ctx.state.room?.name)
        .some((building) => building.type === BUILDING_TYPE.LIBRARY && building.id?.includes("jingguan"));
      if (!bookshop) return ctx.applyFeature({ logs: [{ t: "err", text: "  此处没有书肆。" }] });
      const book = LIBRARY_BOOKS_JINGGUAN
        .find((entry) => entry.name === bookName || entry.name.replace(/[《》]/g, "") === bookName);
      return ctx.applyFeature(book
        ? buyBook(ctx.state, book)
        : { logs: [{ t: "err", text: `  没有这本书：${bookName}` }] });
    },
  },
  {
    id: "cliPrayer",
    match: "祈福",
    parse: () => ({}),
    execute: (ctx) => {
      const temple = getBuildingsForLocation(ctx.state.room?.name)
        .find((building) => building.type === BUILDING_TYPE.TEMPLE);
      if (!temple) return ctx.applyFeature({ logs: [{ t: "err", text: "  此处没有寺庙。" }] });
      return ctx.applyFeature(pray(ctx.state, temple.karmaPerPray || 10));
    },
  },
  {
    id: "cliMovement",
    match: /^(走|去)\s+(.+)$/,
    parse: (m, line) => ({ verb: m[1], target: m[2], line }),
    execute: async (ctx, { verb, target, line }) => {
      const isWalk = verb === "走";
      const result = innerMove(ctx.state, {
        target,
        command: line,
        targetKind: verb === "去" ? "room" : "direction",
        forceLayer: isWalk ? null : "inner",
      });
      if (result) return ctx.applyFeature(result);
      if (isWalk) {
        const direction = parseDir(target);
        const destName = direction ? resolveExit(ctx.state.room?.name, direction) : null;
        if (destName) {
          const arrival = outerArrival(ctx.state, {
            direction,
            destName,
            roomMap: ctx.session.roomMap,
            squares: serializeSquares(),
            command: line,
          });
          if (arrival?.cached) {
            ctx.featureCtx.addLog([{ t: "cmd", text: `> ${line}` }]);
            const status = await ctx.applyFeature(arrival);
            ctx.setInnerRoomName(hasInnerMap(destName) ? getDistrictAnchor(destName) : null);
            return status;
          }
          if (arrival) return ctx.runFreeText(line, { squareOps: arrival.squareOps });
        }
      }
      return PASS;
    },
  },
  {
    id: "cliPigeon",
    match: /^飞鸽(?:\s+(.+))?$/,
    parse: (m) => ({ tail: (m[1] || "").trim() }),
    execute: (ctx, { tail }) => {
      const npcName = pigeonTargets(ctx.state)
        .find((name) => tail === name || tail.startsWith(`${name} `));
      if (!npcName) {
        return ctx.applyFeature(tail
          ? { logs: [{ t: "sys", text: "  此人未在曾遇名册中，无法飞鸽传书。" }] }
          : sendPigeonLetter(ctx.state, null, ""));
      }
      return ctx.applyFeature(sendPigeonLetter(ctx.state, npcName, tail.slice(npcName.length).trim()));
    },
  },
  {
    id: "cliNpcLook",
    match: /^看\s+(.+)$/,
    parse: (m) => ({ name: m[1] }),
    execute: async (ctx, { name }) => {
      const npc = visibleNpcs(ctx.state).find((entry) => entry?.name === name);
      if (!npc) return missingNpc(ctx, name);
      const result = lookNpc(ctx.state, npc);
      ctx.applyResult(result);
      return ctx.featureCtx.act(`look ${npc.id}`, result.extraReplies, {
        echoCommand: true,
        displayCmd: `look ${npc.id}`,
        intentPlanNote: `\n[系统裁决：本轮仅端详「${npc.name}」本人。只写对此人的观察——容貌装束、气色伤势、当下神态举止；此人若正与人动手，写到其架势为止，任何一方都不得再出手，也不推进、续写与玩家无关的他人事件。]`,
      });
    },
  },
  {
    id: "cliNpcGift",
    match: /^送\s+(.+)$/,
    parse: (m) => ({ tail: m[1] }),
    execute: (ctx, { tail }) => {
      const npc = longestNameMatch(visibleNpcs(ctx.state), (entry) => tail.endsWith(` ${entry.name}`));
      if (!npc) return missingNpc(ctx, tail.split(/\s+/).at(-1));
      const itemName = tail.slice(0, -(npc.name.length)).trim();
      const item = itemNamed(ctx.state.inv, itemName);
      return ctx.applyFeature(giftNpc(ctx.state, npc, item || null));
    },
  },
  {
    id: "cliNpcTrade",
    match: /^交易\s+(.+)$/,
    parse: (m) => ({ name: m[1] }),
    execute: async (ctx, { name }) => {
      const npc = visibleNpcs(ctx.state).find((entry) => entry?.name === name);
      if (!npc) return missingNpc(ctx, name);
      const result = tradeWithNpc(ctx.state, npc);
      if (result.shop) {
        ctx.applyFeature(result); // 日更刷新的 changes/吆喝落账，shop 字段被忽略
        ctx.emit(`${result.shop.shopName || `${npc.name}的铺子`}已开张。`);
        return 0;
      }
      return ctx.applyFeature(result);
    },
  },
  {
    id: "cliNpcSteal",
    match: /^偷\s+(.+)$/,
    parse: (m) => ({ name: m[1] }),
    execute: async (ctx, { name }) => {
      const npc = visibleNpcs(ctx.state).find((entry) => entry?.name === name);
      if (!npc) return missingNpc(ctx, name);
      return ctx.applyFeature(stealFromNpc(ctx.state, npc));
    },
  },
  {
    id: "cliNpcInvite",
    match: /^邀\s+(.+)$/,
    parse: (m) => ({ name: m[1] }),
    execute: async (ctx, { name }) => {
      const npc = visibleNpcs(ctx.state).find((entry) => entry?.name === name);
      if (!npc) return missingNpc(ctx, name);
      return ctx.applyFeature(inviteCompanion(ctx.state, npc, { getNow: ctx.getNow }));
    },
  },
  {
    id: "cliNpcTalk",
    match: /^交谈\s+(.+)$/,
    parse: (m) => ({ tail: m[1] }),
    execute: async (ctx, { tail }) => {
      const npc = longestNameMatch(visibleNpcs(ctx.state), (entry) => tail.startsWith(`${entry.name} `));
      if (!npc) return missingNpc(ctx, tail.split(/\s+/)[0]);
      const utterance = tail.slice(npc.name.length).trim();
      const result = talkToNpc(ctx.state, npc);
      ctx.applyResult(result);
      if (result.completedEscort || npc.cannotSpeak) return ctx.pendingTurn();
      return ctx.runFreeText(utterance, {
        isTalk: true,
        activeTarget: npc.name,
        talkTarget: npc.name,
      });
    },
  },
  {
    id: "cliNpcLearn",
    match: /^拜师\s+(.+)$/,
    parse: (m) => ({ name: m[1] }),
    execute: (ctx, { name }) => {
      const npc = visibleNpcs(ctx.state).find((entry) => entry?.name === name);
      if (!npc) return ctx.applyFeature({ logs: [{ t: "err", text: `  此处没有 ${name}。` }] });
      return ctx.applyFeature(learnNpcSkill(ctx.state, npc));
    },
  },
  {
    id: "cliMeditateTrain",
    match: "打坐",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(meditate(ctx.state)),
  },
  {
    id: "cliMeditateTrain",
    match: "练内功",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(trainNeigong(ctx.state)),
  },
  {
    id: "cliMeditateTrain",
    match: "练外功",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(trainWaigong(ctx.state)),
  },
  {
    id: "cliMeditateTrain",
    match: /^修炼\s+(.+)$/,
    parse: (m) => ({ skillName: m[1] }),
    execute: (ctx, { skillName }) => ctx.applyFeature(breakthroughSkill(ctx.state, skillName)),
  },
  {
    id: "cliBankPawn",
    match: /^存钱\s+(\S+)$/,
    parse: (m) => ({ amount: parsePositiveInteger(m[1]) }),
    execute: (ctx, { amount }) => ctx.applyFeature(amount === null
      ? { logs: [{ t: "err", text: "  数额无效" }] }
      : deposit(ctx.state, amount)),
  },
  {
    id: "cliBankPawn",
    match: "取钱",
    parse: () => ({}),
    execute: (ctx) => ctx.applyFeature(withdraw(ctx.state)),
  },
  {
    id: "cliBankPawn",
    match: /^质押\s+(.+)\s+(\S+)$/,
    parse: (m) => ({ itemName: m[1], pledgeValue: parsePositiveInteger(m[2]) }),
    execute: (ctx, { itemName, pledgeValue }) => {
      if (pledgeValue === null) {
        return ctx.applyFeature({ logs: [{ t: "err", text: "  数额无效" }] });
      }
      const item = (ctx.state.inv || []).find((entry) => typeof entry === "object" && entry?.name === itemName);
      return ctx.applyFeature(pledge(ctx.state, item?.id, pledgeValue));
    },
  },
  {
    id: "cliBankPawn",
    match: /^赎回\s+(\S+)\s+(\S+)$/,
    parse: (m) => ({ index: parsePositiveInteger(m[1]), redeemCost: parsePositiveInteger(m[2]) }),
    execute: (ctx, { index, redeemCost }) => {
      if (index === null || redeemCost === null) {
        return ctx.applyFeature({ logs: [{ t: "err", text: "  数额无效" }] });
      }
      return ctx.applyFeature(redeem(ctx.state, index - 1, redeemCost));
    },
  },
  {
    id: "cliSystem",
    match: (line) => line.startsWith(":"),
    parse: (m, line) => ({ line }),
    execute: (ctx, { line }) => {
      if (line === ":help narrator") {
        ctx.emit("安抚 <verbal|food|medication|hug|kiss> · 收束创伤 · 向旁白告白 · 换队友 <snowLeopard|asuka|none>");
        return 0;
      }
      ctx.emit(`暂不支持：${line}（PR C 起接入）`);
      return 0;
    },
  },
];

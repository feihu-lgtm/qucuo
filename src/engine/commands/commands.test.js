import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMMANDS, INVENTORY_COMMAND_IDS } from "../../core/commands.js";
import {
  COMMAND_REGISTRY, HOOK_COMMANDS, classifyActCommand, classifyCliCommand,
} from "./index.js";

// 契约：HOOK_COMMANDS 由注册表的 hooks 字段生成，handler→命令 id 映射与各
// hook 文件实际返回的键一一对应（由 core/commandScheduler.test.js 迁入，
// 原用例只改了 import 来源，断言不变）。
const hookFiles = {
  useScreenHandlers: "src/app/hooks/useScreenHandlers.js",
  useBuildingHandlers: "src/app/hooks/useBuildingHandlers.js",
  useProgressionHandlers: "src/app/hooks/useProgressionHandlers.js",
  usePigeonHandlers: "src/app/hooks/usePigeonHandlers.js",
  useQuestPanel: "src/app/hooks/useQuestPanel.js",
  useDuel: "src/app/hooks/useDuel.js",
  usePlayerActionHandlers: "src/app/hooks/usePlayerActionHandlers.js",
  useCardImportHandlers: "src/app/hooks/useCardImportHandlers.js",
  useCraftingAI: "src/app/hooks/useCraftingAI.js",
  useAiInspect: "src/app/hooks/useAiInspect.js",
  useOutfitAdvice: "src/app/hooks/useOutfitAdvice.js",
};

function returnedKeys(file, hookName) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(`export function ${hookName}(`);
  const next = source.indexOf("\nexport function ", start + 1);
  const body = source.slice(start, next < 0 ? source.length : next);
  const returns = [...body.matchAll(/return\s*\{/g)];
  const match = returns.at(-1);
  if (!match) return [];
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < body.length; index += 1) {
    if (body[index] === "{") depth += 1;
    if (body[index] === "}" && --depth === 0) {
      return body.slice(open + 1, index).split(",")
        .map(entry => entry.trim().match(/^(?:\.\.\.)?([\w$]+)/)?.[1])
        .filter(Boolean);
    }
  }
  return [];
}

describe("命令注册表", () => {
  it("注册表条目 id 都在 COMMANDS 清单里登记", () => {
    // 契约：注册项引用的命令 id 必须是清单内已注册的，否则 getCommand 会抛。
    for (const entry of COMMAND_REGISTRY) {
      expect(COMMANDS[entry.id], `注册项 ${entry.id}`).toBeDefined();
    }
  });

  it("duel 组全部映射到 duel 命令", () => {
    // 契约：useDuel 五个 handler 都走 duel（原 commandScheduler.test.js 断言）。
    expect(Object.values(HOOK_COMMANDS.useDuel)).toEqual(["duel", "duel", "duel", "duel", "duel"]);
  });

  it("每个返回的 handler 键都映射到已注册命令", () => {
    // 契约：HOOK_COMMANDS 覆盖各 hook 文件真实返回的全部键，且值均合法
    // （原 commandScheduler.test.js 断言，改为从注册表生成后仍须成立）。
    expect(INVENTORY_COMMAND_IDS.length).toBeGreaterThanOrEqual(111);
    for (const [group, file] of Object.entries(hookFiles)) {
      const handlers = HOOK_COMMANDS[group];
      const actualKeys = returnedKeys(file, group).filter(key => !(group === "useAiInspect" && key === "inspecting"));
      expect(actualKeys.sort(), group).toEqual(Object.keys(handlers).sort());
      for (const [handler, commandId] of Object.entries(handlers)) {
        expect(COMMANDS[commandId], `${group}.${handler} → ${commandId}`).toBeDefined();
      }
    }
  });

  it("classifyCliCommand 由注册表 match 驱动", () => {
    // 契约：行文本归类与 dispatch 用同一份 match，命中即对应命令 id。
    for (const [line, id] of [
      [":new", "cliSystem"], ["坐车 鱼定村", "cliCarriage"], ["走 北", "cliMovement"],
      ["用 金疮药", "cliItemUse"], ["交谈 才旦 你好", "cliNpcTalk"], ["存钱 50", "cliBankPawn"],
      ["随便一句不认识的输入", "cliRunner"],
    ]) {
      expect(classifyCliCommand(line)).toMatchObject({ id });
    }
  });

  it("classifyActCommand 按输入形态归类（从 core/commands.js 迁入）", () => {
    // 契约：autoTravel>whisper>方向/move>talk>settle>localCommand>typedAction 的顺序不变。
    expect(classifyActCommand({ rawCmd: "随便", opts: { autoTravel: true } })).toBe("autoTravel");
    expect(classifyActCommand({ rawCmd: "随便", interactMode: "whisper" })).toBe("actWhisper");
    expect(classifyActCommand({ rawCmd: "n" })).toBe("mapMovement");
    expect(classifyActCommand({ rawCmd: "你好", interactMode: "talk" })).toBe("actDialogue");
    expect(classifyActCommand({ rawCmd: "送礼", opts: { settle: true } })).toBe("actSettle");
    expect(classifyActCommand({ rawCmd: "帮助", localCommand: { kind: "lines" } })).toBe("localHelp");
    expect(classifyActCommand({ rawCmd: "look", localCommand: { kind: "result", localKind: "cachedLook" } })).toBe("localRoomLook");
    expect(classifyActCommand({ rawCmd: "打它" })).toBe("typedAction");
  });
});

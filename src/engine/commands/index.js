// 命令注册表（终局架构第 4 点）：CLI 文本命令与 Web hook 映射共用一张表。
// 条目形态 {id, match, parse, execute}；hook 侧条目只带 {id, hooks} 无 match/execute。
// match 可为正则或函数（函数收到整行文本）；parse 把匹配结果转成参数；
// execute(ctx, args) 返回退出码，返回 PASS 表示未消费、继续尝试后续条目。
import { getCommand } from "../../core/commands.js";
import { CLI_COMMANDS, PASS } from "./cliCommands.js";
import { HOOK_ENTRIES, buildHookCommands } from "./hooks.js";

export { PASS };
export const COMMAND_REGISTRY = Object.freeze([...CLI_COMMANDS, ...HOOK_ENTRIES]);

function matchEntry(entry, line) {
  if (!entry.match) return null;
  if (typeof entry.match === "function") {
    const result = entry.match(line);
    return result || null;
  }
  if (typeof entry.match === "string") return line === entry.match ? [line] : null;
  return line.match(entry.match);
}

// 遍历注册表执行第一个命中的命令；无命中返回 undefined（调用方走 intentRouter/自由输入）。
export async function dispatchCommand(line, ctx) {
  for (const entry of COMMAND_REGISTRY) {
    const m = matchEntry(entry, line);
    if (!m) continue;
    if (!entry.execute) continue;
    const args = { ...(entry.parse ? entry.parse(m, line) : {}), line };
    const out = await entry.execute(ctx, args);
    if (out === PASS) continue;
    return out;
  }
  return undefined;
}

// CLI 命令归类（trace commandId 用）：注册表首个 match 命中的 id，兜底 cliRunner。
// 与 dispatchCommand 共用同一批 match，不再另维护一份近似正则表。
export function classifyCliCommand(line) {
  const text = String(line).trim();
  for (const entry of COMMAND_REGISTRY) {
    if (matchEntry(entry, text)) return getCommand(entry.id);
  }
  return getCommand("cliRunner");
}

// Web 侧 act 命令归类（useTurn 调用）：按输入形态归到调度用命令 id。
export function classifyActCommand({
  rawCmd, opts = {}, interactMode = "action", localCommand = null, isMove = false,
}) {
  if (opts.autoTravel) return "autoTravel";
  if (interactMode === "whisper") return "actWhisper";
  if (opts.forceLayer || isMove || /^(n|s|e|w|north|south|east|west|北|南|东|西)$/i.test(rawCmd.trim())) {
    return "mapMovement";
  }
  if (interactMode === "talk") return "actDialogue";
  if (opts.settle) return "actSettle";
  if (localCommand) {
    if (localCommand.kind === "lines") return "localHelp";
    return localCommand.localKind === "cachedLook" ? "localRoomLook" : "actLocal";
  }
  return "typedAction";
}

// Web 侧 hook → 命令 id 映射，从注册表生成（结构同旧 core/commands.js 字面量）。
export const HOOK_COMMANDS = buildHookCommands(COMMAND_REGISTRY);

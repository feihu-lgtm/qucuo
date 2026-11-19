import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { createSession, parseSeed, runScript } from "./runner.mjs";

const print = (text) => stdout.write(`${text}\n`);

async function main() {
  const args = process.argv.slice(2);
  let script;
  let seed;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--seed":
        seed = parseSeed(args[++i]);
        break;
      case "--script":
        script = args[++i];
        if (!script || script.startsWith("--")) throw new Error("--script requires a file path");
        break;
      default:
        throw new Error(`Unknown argument: ${args[i]}`);
    }
  }

  const options = { out: print, seed };
  if (script) {
    const lines = await readFile(script, "utf8");
    process.exitCode = (await runScript(lines, options)) > 0 ? 1 : 0;
    return;
  }

  const session = createSession(options);
  await session.runLine(":new");
  await session.runLine(":state");

  const rl = createInterface({ input: stdin, output: stdout });
  rl.setPrompt("> ");
  rl.prompt();
  for await (const line of rl) {
    try {
      await session.runLine(line);
    } catch (error) {
      print(error.message);
    }
    rl.prompt();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

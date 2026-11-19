import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { createSession, runScript } from "./runner.mjs";

const print = (text) => stdout.write(`${text}\n`);

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--script") {
    if (!args[1]) throw new Error("--script requires a file path");
    const lines = await readFile(args[1], "utf8");
    process.exitCode = (await runScript(lines, { out: print })) > 0 ? 1 : 0;
    return;
  }

  const session = createSession({ out: print });
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

import { loadDefaultContent } from "../src/content/index.js";
import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { basename, dirname, resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { createSession, parseSeed, runScript } from "./runner.mjs";
import { createHttpAi, createMockAi, createRecordingAi, createReplayAi, createWebAi } from "../src/engine/ports/ai.js";
import { createVertexAuth, parseVertexAdc, vertexDefaultProject } from "../src/infra/vertexAdc.js";

loadDefaultContent();

const print = (text) => stdout.write(`${text}\n`);

async function main() {
  const args = process.argv.slice(2);
  let script;
  let seed;
  let aiType;
  let repliesFile;
  let replayFile;
  let model;
  let project;
  let location;
  let recordFile;
  let intent = false;
  const nextValue = (name, index) => {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    return value;
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--seed":
        seed = parseSeed(args[++i]);
        break;
      case "--script":
        script = nextValue("--script", i);
        i++;
        break;
      case "--ai":
        aiType = nextValue("--ai", i);
        i++;
        break;
      case "--replies":
        repliesFile = nextValue("--replies", i);
        i++;
        break;
      case "--replay":
        replayFile = nextValue("--replay", i);
        i++;
        break;
      case "--model":
        model = nextValue("--model", i);
        i++;
        break;
      case "--project":
        project = nextValue("--project", i++);
        break;
      case "--location":
        location = nextValue("--location", i++);
        break;
      case "--intent":
        intent = true;
        break;
      case "--record":
        recordFile = nextValue("--record", i);
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${args[i]}`);
    }
  }

  if (script && !aiType && !repliesFile) {
    const siblingReplies = resolve(dirname(resolve(script)), `${basename(script).replace(/\.txt$/, "")}-replies.json`);
    try {
      await access(siblingReplies);
      aiType = "mock";
      repliesFile = siblingReplies;
    } catch {}
  }

  let ai = null;
  let apiCfg = {};
  if (aiType === "mock") {
    if (!repliesFile) throw new Error("--ai mock requires --replies");
    const parsed = JSON.parse(await readFile(repliesFile, "utf8"));
    const replies = Array.isArray(parsed) ? parsed : parsed.replies;
    if (!Array.isArray(replies)) throw new Error("Replies file must contain a JSON array");
    ai = createMockAi(replies);
  } else if (aiType === "replay") {
    if (!replayFile) throw new Error("--ai replay requires --replay");
    const lines = (await readFile(replayFile, "utf8")).split(/\r?\n/).filter((line) => line.trim());
    ai = createReplayAi(lines.map((line) => JSON.parse(line)));
  } else if (aiType === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
    model ||= "deepseek-flash";
    apiCfg = { apiType: "openai", model, endpoint: "https://api.deepseek.com/chat/completions" };
    ai = createHttpAi({ baseUrl: "https://api.deepseek.com", apiKey, model });
  } else if (aiType === "vertex") {
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!path) throw new Error("请将 GOOGLE_APPLICATION_CREDENTIALS 设为 ADC JSON 文件路径");
    const adc = parseVertexAdc(await readFile(path, "utf8").catch(() => { throw new Error("无法读取 ADC JSON 文件"); }));
    const getVertexHeaders = createVertexAuth(adc, {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60000) }),
      crypto: webcrypto, now: Date.now,
    });
    apiCfg = {
      apiType: "vertex", vertexModel: model,
      vertexProject: project || vertexDefaultProject(adc), vertexLocation: location || "global",
    };
    ai = createWebAi({ getVertexHeaders });
  } else if (aiType) {
    throw new Error(`Unknown AI adapter: ${aiType}`);
  }
  if (recordFile) {
    if (!ai) throw new Error("--record requires --ai");
    const destination = resolve(recordFile);
    if (destination === (repliesFile && resolve(repliesFile)) || destination === (replayFile && resolve(replayFile))) {
      throw new Error("--record must not overwrite its input fixture");
    }
    await writeFile(destination, "", "utf8");
    ai = createRecordingAi(ai, (entry) => appendFile(destination, `${JSON.stringify(entry)}\n`, "utf8"));
  }

  if (intent) apiCfg = { ...apiCfg, intentRecognitionEnabled: true };
  const options = { out: print, seed, ai, apiCfg };
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

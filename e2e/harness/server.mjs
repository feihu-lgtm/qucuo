import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");

export async function startServer({ port = Number(process.env.QA_PORT) || 5199 } = {}) {
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let readyResolve;
  let readyReject;
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const fail = (error) => {
    if (settled) return;
    settled = true;
    readyReject(error);
  };
  const onOutput = (chunk) => {
    output += chunk.toString();
    if (!settled && output.includes(`http://127.0.0.1:${port}/`)) {
      settled = true;
      readyResolve();
    }
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);
  child.once("error", fail);
  child.once("exit", (code, signal) => {
    if (!settled) fail(new Error(`QA server failed to start on port ${port} (exit ${code ?? signal}):\n${output.trim()}`));
  });

  const timeout = setTimeout(() => {
    fail(new Error(`Timed out waiting for QA server on port ${port}:\n${output.trim()}`));
  }, 15000);
  try {
    await ready;
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise((done) => {
        child.once("exit", done);
        child.kill("SIGTERM");
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let stopping;
  const stop = () => {
    if (stopping) return stopping;
    stopping = new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      const forceKill = setTimeout(() => child.kill("SIGKILL"), 3000);
      child.once("exit", () => {
        clearTimeout(forceKill);
        resolve();
      });
      child.kill("SIGTERM");
    });
    return stopping;
  };
  return { url: `http://127.0.0.1:${port}`, stop };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let server;
  try {
    server = await startServer();
    console.log(server.url);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await server?.stop();
  }
}

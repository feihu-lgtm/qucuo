import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearErrorBuffer, getRecentErrors, installErrorBuffer, recordError } from "./errorBuffer.js";

describe("errorBuffer", () => {
  beforeEach(() => clearErrorBuffer());
  afterEach(() => {
    vi.unstubAllGlobals();
    clearErrorBuffer();
  });

  it("retains only the most recent 50 errors", () => {
    for (let i = 0; i < 55; i++) recordError(new Error(`error ${i}`));

    const errors = getRecentErrors();
    expect(errors).toHaveLength(50);
    expect(errors[0].message).toBe("error 5");
    expect(errors.at(-1).message).toBe("error 54");
  });

  it("captures global errors and unhandled rejections", () => {
    const listeners = new Map();
    const windowRef = {
      addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    };
    const consoleRef = { error: vi.fn() };

    installErrorBuffer({ windowRef, consoleRef });
    listeners.get("error")({ error: new Error("window failure"), filename: "app.js", lineno: 4, colno: 2 });
    listeners.get("unhandledrejection")({ reason: new Error("promise failure") });

    expect(getRecentErrors().map(error => error.message)).toEqual(["window failure", "promise failure"]);
    expect(getRecentErrors()[0].info).toMatchObject({ source: "window.error", filename: "app.js", lineno: 4, colno: 2 });
    expect(getRecentErrors()[1].info).toEqual({ source: "unhandledrejection" });
  });

  it("wraps console.error once when installed more than once", () => {
    const windowRef = { addEventListener: vi.fn() };
    const consoleRef = { error: vi.fn() };
    const originalError = consoleRef.error;

    installErrorBuffer({ windowRef, consoleRef });
    const wrapped = consoleRef.error;
    installErrorBuffer({ windowRef, consoleRef });
    consoleRef.error("reported", new Error("console failure"));

    expect(consoleRef.error).toBe(wrapped);
    expect(windowRef.addEventListener).toHaveBeenCalledTimes(2);
    expect(originalError).toHaveBeenCalledTimes(1);
    expect(getRecentErrors()).toHaveLength(1);
    expect(getRecentErrors()[0]).toMatchObject({
      message: "console failure",
      info: { source: "console.error" },
    });
  });

  it("does not record a React root error again when its console log is captured", () => {
    const consoleRef = { error: vi.fn() };
    installErrorBuffer({ windowRef: null, consoleRef });
    const error = new Error("caught once");

    recordError(error, { source: "react.onCaughtError" });
    consoleRef.error("[ErrorBoundary] 子组件崩溃:", error);

    expect(getRecentErrors()).toHaveLength(1);
    expect(getRecentErrors()[0]).toMatchObject({
      message: "caught once",
      info: { source: "react.onCaughtError" },
    });
  });

  it("scrubs error messages, stacks, and structured console arguments at record time", () => {
    const apiKey = "cfg-value-123456";
    const endpoint = "https://private.example/v1/chat";
    let storedConfig = JSON.stringify({ apiKey, endpoint });
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => storedConfig) });
    const consoleRef = { error: vi.fn() };
    installErrorBuffer({ windowRef: null, consoleRef });
    const error = new Error(`failure ${apiKey}`);
    error.stack = `Error: failure ${apiKey}\n at ${endpoint} sk-abcdefghijklmnop Bearer private-token`;
    const structuredError = {
      [apiKey]: "configured key",
      "sk-abcdefghijklmnop": "key pattern",
      "Bearer private-token": "bearer pattern",
      [endpoint]: "endpoint",
    };
    const errorEntry = recordError(error, { arguments: [structuredError] });
    consoleRef.error(structuredError);
    storedConfig = null;

    const recorded = JSON.stringify(getRecentErrors());
    const entryAtRecordTime = JSON.stringify(errorEntry);
    for (const secret of [apiKey, endpoint, "sk-abcdefghijklmnop", "Bearer private-token"]) {
      expect(entryAtRecordTime).not.toContain(secret);
      expect(recorded).not.toContain(secret);
    }
    expect(errorEntry.message).toContain("[REDACTED]");
    expect(errorEntry.stack).toContain("[REDACTED]");
    expect(Object.keys(errorEntry.info.arguments[0])).toEqual([
      "[REDACTED]",
      "[REDACTED]#2",
      "[REDACTED]#3",
      "[REDACTED]#4",
    ]);
    expect(recorded).toContain("[REDACTED]#2");
  });
});

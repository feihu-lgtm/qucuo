import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

const testGlobals = {
  afterAll: "readonly",
  afterEach: "readonly",
  assert: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  expectTypeOf: "readonly",
  it: "readonly",
  suite: "readonly",
  test: "readonly",
  vi: "readonly",
};

const common = {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { "react-hooks": reactHooks },
  rules: {
    "no-undef": "error",
    "react-hooks/rules-of-hooks": "error",
  },
};

export default [
  {
    ...common,
    files: ["src/**/*.{js,jsx}"],
    languageOptions: { ...common.languageOptions, globals: globals.browser },
  },
  {
    ...common,
    files: ["e2e/**/*.mjs"],
    languageOptions: { ...common.languageOptions, globals: globals.node },
  },
  {
    ...common,
    files: ["e2e/harness/game.mjs", "e2e/harness/saves.mjs"],
    languageOptions: { ...common.languageOptions, globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["src/**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...testGlobals },
    },
  },
  {
    files: ["src/engine/**/*.{js,jsx}", "src/features/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/ui/**", "**/app/**"],
          message: "Engine and feature modules must not depend on UI or app modules.",
        }],
      }],
    },
  },
  {
    files: ["src/features/**/*.{js,jsx}"],
    ignores: ["**/*.{test,spec}.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/ui/**", "**/app/**", "**/infra/**"],
          message: "Feature modules must not depend on UI, app, or infra modules.",
        }],
      }],
    },
  },
  {
    files: ["src/domain/**/*.{js,jsx}"],
    ignores: ["**/*.{test,spec}.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/ui/**", "**/app/**", "**/infra/**"],
          message: "Domain modules must not depend on UI, app, or infra modules.",
        }],
      }],
    },
  },
  {
    files: ["src/store/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/ui/**"],
          message: "Store modules must not depend on UI modules.",
        }],
      }],
    },
  },
  {
    files: ["src/ui/**/*.{js,jsx}"],
    ignores: ["**/*.{test,spec}.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "**/engine/ports/ai*",
            "**/infra/apiTransport*",
            "**/infra/apiConfig*",
            "**/infra/apiDiagnostics*",
          ],
          importNames: ["callModel", "callModelStream"],
          message: "UI modules must not import callModel or callModelStream directly; route AI calls through engine/ports/withAI.js.",
        }],
      }],
    },
  },
];

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
    files: ["cli/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: { ...common.languageOptions, globals: globals.node },
  },
  {
    files: ["src/**/*.{test,spec}.{js,jsx}", "cli/**/*.{test,spec}.{js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...testGlobals },
    },
  },
];

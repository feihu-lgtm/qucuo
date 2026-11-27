import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

// 仓库级杂项守卫（原 docsTree.test.js；手写文件树门禁已删，改由 `npm run tree` 实时打印）。
// 剩下的都是「构建与常规测试都抓不到」的断链类检查：
// npm 脚本指向不存在的文件、version.js 语法、CI 与 verify 分叉、public 资源
// 绝对路径、Hook deps 的 TDZ 引用、app hook 参数先声明后用、ctx 字段形状。

const SRC = "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(name)) out.push(relative(SRC, p));
  }
  return out;
}

describe("npm 脚本引用的本地文件必须存在", () => {
  it("package.json 里 npm 脚本引用的本地文件必须存在", () => {
    // 【为什么补这条】"debug": "node tools/debug.mjs" 指向的 tools/ 目录压根不存在，
    // npm run debug 必然失败——而这事没有任何地方会报出来，直到有人去跑它。
    // 跟「代码引用了不存在的素材」是同一个形状。
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const bad = [];
    for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
      for (const m of String(cmd).matchAll(/(?:^|\s)((?:\.\/)?(?:scripts|tools|src)\/[\w./-]+\.(?:mjs|js|sh|cjs))/g)) {
        const f = m[1].replace(/^\.\//, "");
        if (!existsSync(f)) bad.push(`npm run ${name} → ${f}`);
      }
    }
    expect(bad, `npm 脚本指向了不存在的文件：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

// version.js 的语法守卫。
// 【为什么需要】上一次提交我在 version.js 的中文叙述里用了未转义的英文双引号
// （写成 真在"改名单"），把字符串提前截断 → vite build 直接失败。
// 而我提交前只跑了 vitest：**那批测试没有一条会 import version.js**，
// 所以测试全绿、构建是坏的，推上去才发现。
// 这条测试补上这个缺口：只要能 import 进来、且结构合法，语法就一定是对的。
describe("version.js 语法与结构（防「测试全绿但构建坏了」）", () => {
  it("懒加载历史可用、每条含 codename/time/notes[]，且 CURRENT_VERSION 指向最新一条并严格递增版本号", async () => {
    const { loadVersionHistory, CURRENT_VERSION } = await import("../utils/version.js");
    const { compareSemver } = await import("../../scripts/bumpVersion.mjs");
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const VERSION_HISTORY = await loadVersionHistory();
    expect(VERSION_HISTORY.length).toBeGreaterThan(1);
    for (const e of VERSION_HISTORY.slice(0, 20)) {
      expect(typeof e.codename).toBe("string");
      expect(typeof e.time).toBe("string");
      expect(Array.isArray(e.notes)).toBe(true);
    }
    expect(CURRENT_VERSION.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(`v${pkg.version}`).toBe(CURRENT_VERSION.version);
    expect(CURRENT_VERSION.codename).toBe(VERSION_HISTORY[0].codename);
    expect(CURRENT_VERSION.time).toBe(VERSION_HISTORY[0].time);
    expect(CURRENT_VERSION.version).toBe(VERSION_HISTORY[0].version);
    expect(compareSemver(VERSION_HISTORY[0].version, VERSION_HISTORY[1].version)).toBe(1);
  });
});

// CI 与本地校验的同构守卫。
// 【为什么需要】0728 才发现仓库有 GitHub Actions（deploy.yml），而它当时**只跑
// vite build --config vite.config.pages.js、不跑 vitest**；我这边则一直只跑默认
// config 的 build + vitest。两边各有盲区，而且正好互补：
//   · version.js 写坏（未转义引号）→ 本地 vitest 全绿、CI build 失败
//   · 逻辑改坏但语法没问题        → CI 全绿、本地 vitest 才抓得到
// 现已让 CI 也跑 vitest，并加 `npm run verify` 与 CI 完全同构。
// 这条测试钉住"两边不许再分叉"——CI 改了命令，本地脚本必须跟上。
describe("CI 与 npm run verify 同构（防两边分叉各留盲区）", () => {
  it("CI 既跑测试又跑构建", () => {
    const yml = readFileSync(".github/workflows/deploy.yml", "utf-8");
    expect(yml, "CI 必须跑 vitest").toMatch(/vitest run/);
    expect(yml, "CI 必须跑 pages 配置的构建").toMatch(/vite build --config vite\.config\.pages\.js/);
  });

  it("npm run verify 跑的就是 CI 那两步", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const v = pkg.scripts?.verify || "";
    expect(v).toMatch(/vitest run/);
    expect(v).toMatch(/vite build --config vite\.config\.pages\.js/);
  });

  it("pages 配置的 base 是子路径（否则 Pages 上白屏）", () => {
    const cfg = readFileSync("vite.config.pages.js", "utf-8");
    expect(cfg).toMatch(/base:\s*["']\/qucuo\/["']/);
  });
});

// public 资源路径守卫。
// 【为什么需要】开场两张图当初写成硬编码的 "/intro-1.webp"，在本地（base "/"）
// 完全正常，但 GitHub Pages 把站点部在 /qucuo/ 子路径下，绝对路径会解析成
// https://<user>.github.io/intro-1.webp → 404。而我给它加的 onError 兜底又把 404
// 降级成渐变底，于是表现为"图没渲染"而不是破图，更难察觉。
// 项目里其余 public 资源（stones/ portraits/ mapui/）一直都走 import.meta.env.BASE_URL，
// 只有那两张漏了。这条测试扫源码，防同类漏改再来一次。
describe("public 资源必须走 BASE_URL（防 Pages 子路径下 404）", () => {
  it("源码里没有硬编码的 public 绝对路径", () => {
    const files = walk(SRC).filter(f => !f.includes(".test."));
    const bad = [];
    for (const f of files) {
      const src = readFileSync(join(SRC, f), "utf-8");
      src.split("\n").forEach((line, i) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return; // 注释里出现无妨
        // 形如 "/xxx.webp" 或 "/music/xxx.mp3" 的字符串字面量（相对 public 根的
        // 绝对路径）。
        // 【为什么允许中间带斜杠】老正则是 `\/[A-Za-z0-9_-]+\.(...)`，字符类里没有
        // 斜杠，所以只抓得住 "/intro-1.webp" 这种顶层文件，抓不住
        // "/music/zood.mp3" 这种带子目录的——音乐曲库那两条本地路径就是这么从
        // 守卫底下漏过去的（507/507 全绿、Pages 上必 404）。补上 (?:seg/)* 让它
        // 覆盖任意深度的子目录。
        if (/["'`]\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(webp|png|jpe?g|svg|mp3|ogg)["'`]/.test(line)) {
          bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 70)}`);
        }
      });
    }
    expect(bad, `以下位置硬编码了 public 绝对路径，Pages 子路径下会 404，请改走 import.meta.env.BASE_URL：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("开场图与卷轴都走了 BASE_URL", () => {
    const src = readFileSync("src/ui/screens/OpeningSequence.jsx", "utf-8");
    expect(src).toMatch(/BASE\s*\+\s*"intro-1\.webp"/);
    expect(src).toMatch(/BASE\s*\+\s*"intro-2\.webp"/);
    expect(src).toMatch(/import\.meta\.env\s*&&\s*import\.meta\.env\.BASE_URL/);
  });
});

// TDZ 守卫：deps 数组不许引用后面才定义的量。
// 【为什么需要】上线后报 "Cannot access 'qn' before initialization"。根因是我给
// handleNpcSteal 的依赖数组曾加了 noteAction，而 noteAction 定义在后面——
// **函数体里的调用没问题**（运行时才执行，那时早已初始化），但
// **deps 数组是在 useCallback 那一行同步求值的**，那时 noteAction 还在 TDZ 里，
// 直接抛错、整个组件挂掉。
//
// 而 npm run verify 的 442 个测试一条都没抓到：vitest 里没有任何测试真的渲染
// MudRPG 与 app hooks（没装 testing-library），vite build 也只做语法与打包、不执行组件。
// 也就是说"测试全绿 + 构建成功"对这一类错误完全没有覆盖。
//
// 好在 TDZ 是**静态可查**的：不需要渲染，扫一遍"deps 里的标识符 vs 它的定义行号"
// 就够。这条测试补的正是这个缺口。
// （同类隐患我之前已在 handleToggleEquip 处踩过一次并手动调过顺序——
//   踩两次说明靠记性不行，得让它自动失败。）
describe("Hook deps 不许引用后面才定义的量（TDZ 守卫）", () => {
  it.each([
    "src/MudRPG.jsx",
    "src/app/hooks/useAutosave.js",
    "src/app/hooks/useDaySummary.js",
    "src/app/hooks/usePrivateTalk.js",
    "src/app/hooks/useOutfitAdvice.js",
    "src/app/hooks/useAiInspect.js",
    "src/app/hooks/useTurn.js",
    "src/app/hooks/useQuestPanel.js",
    "src/app/hooks/useDuel.js",
    "src/app/hooks/usePigeonReplies.js",
    "src/app/hooks/usePigeonHandlers.js",
    "src/app/hooks/useAutoTravel.js",
    "src/app/hooks/useCraftingAI.js",
    "src/app/hooks/useScreenHandlers.js",
    "src/app/hooks/useCardImportHandlers.js",
    "src/app/hooks/useBuildingHandlers.js",
    "src/app/hooks/useProgressionHandlers.js",
    "src/app/hooks/usePlayerActionHandlers.js",
    "src/app/hooks/useGameUi.js",
    "src/app/hooks/useWorldRulesRunner.js",
    "src/app/hooks/useNotes.js",
    "src/app/hooks/useGameStartup.js", "src/app/hooks/useUndo.js",
  ])("%s 里没有 TDZ 风险", (file) => {
    const lines = readFileSync(file, "utf-8").split("\n");
    const defs = new Map();
    lines.forEach((l, i) => {
      const m = /^\s*const (\w+) = (useCallback|useMemo|useRef|useGameStore)\(/.exec(l);
      if (m) defs.set(m[1], i);
      const m2 = /^\s*const \[(\w+), set\w+\] = useState/.exec(l);
      if (m2) defs.set(m2[1], i);
      const m3 = /^\s*const \{([^}]+)\} = gameActions/.exec(l);
      if (m3) {
        for (const name of m3[1].split(",").map(x => x.trim())) defs.set(name, i);
      }
    });
    const bad = [];
    lines.forEach((l, i) => {
      const m = /^\s*\}, \[([^\]]*)\]\);/.exec(l);
      if (!m) return;
      for (const name of m[1].match(/\b[a-zA-Z_]\w*\b/g) || []) {
        if (defs.has(name) && defs.get(name) > i) {
          bad.push(`行${i + 1} 的 deps 引用了 ${name}，但它定义在行${defs.get(name) + 1}`);
        }
      }
    });
    expect(bad, `以下位置会在渲染时抛 "Cannot access X before initialization"：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

it("MudRPG app-hook arguments are declared before each hook call", () => {
  const source = readFileSync("src/MudRPG.jsx", "utf-8");
  const lines = source.split("\n");
  const declarations = new Map();
  const lineAt = (offset) => source.slice(0, offset).split("\n").length;
  const addDeclaration = (name, line) => declarations.set(name, line);

  const params = source.match(/function MudRPG\(\s*\{([^}]+)\}\s*=\s*\{\}\s*\)/);
  if (params) {
    const line = lineAt(params.index);
    for (const entry of params[1].split(",")) {
      addDeclaration(entry.trim().split(/\s*=\s*/)[0], line);
    }
  }

  lines.forEach((line, index) => {
    const state = /^\s*const \[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState\b/.exec(line);
    if (state) {
      addDeclaration(state[1], index + 1);
      addDeclaration(state[2], index + 1);
    }
    const value = /^\s*const (\w+)\s*=\s*(?:useCallback|useMemo|useRef|useGameStore|useOverlay)\b/.exec(line);
    if (value) addDeclaration(value[1], index + 1);
    const alias = /^\s*const (\w+)\s*=\s*[\w$]+\s*;?\s*$/.exec(line);
    if (alias) addDeclaration(alias[1], index + 1);
  });

  for (const match of source.matchAll(/const\s*\{([^}]+)\}\s*=\s*[\w$]+\b/g)) {
    const line = lineAt(match.index + match[0].length);
    for (const entry of match[1].split(",")) {
      const name = entry.trim().split(/\s*:\s*/).at(-1).split(/\s*=\s*/)[0].trim();
      addDeclaration(name, line);
    }
  }

  const hookNames = [
    "useAutosave", "useDaySummary",
    "usePrivateTalk", "useOutfitAdvice", "useAiInspect", "useTurn",
    "useGameUi", "usePresetImport", "useWorldRulesRunner",
    "useQuestPanel", "useForcedDuelNpc", "useDuel", "usePigeonReplies", "usePigeonHandlers",
    "useAutoTravel", "useCraftingAI", "useScreenHandlers", "useCardImportHandlers",
    "useBuildingHandlers", "useProgressionHandlers", "usePlayerActionHandlers",
    "useNotes", "useGameStartup", "useGameStartupBindings",
    "useGameStartupOpeningFaces", "useUndo",
  ];
  const failures = [];
  for (const hookName of hookNames) {
    const call = new RegExp(`\\b${hookName}\\s*\\(\\s*\\{`).exec(source);
    if (!call) {
      failures.push(`${hookName} call not found`);
      continue;
    }
    const open = source.indexOf("{", call.index);
    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i++) {
      if (source[i] === "{") depth++;
      if (source[i] === "}" && --depth === 0) { close = i; break; }
    }
    if (close < 0) {
      failures.push(`${hookName} argument object is not closed`);
      continue;
    }

    const callLine = lineAt(call.index);
    const properties = source.slice(open + 1, close).split(",").map(entry => entry.trim()).filter(Boolean);
    for (const property of properties) {
      const value = /^(?:[\w$]+\s*:\s*)?([\w$]+)$/.exec(property)?.[1];
      if (!value) {
        failures.push(`${hookName} has an unsupported argument entry: ${property}`);
        continue;
      }
      const declarationLine = declarations.get(value);
      if (declarationLine == null) failures.push(`${hookName} uses undeclared ${value} at line ${callLine}`);
      else if (declarationLine >= callLine) failures.push(`${hookName} uses ${value} at line ${callLine}, declared at line ${declarationLine}`);
    }
  }
  expect(failures).toEqual([]);
});

describe("layout and overlay ctx inputs match their source shapes", () => {
  function objectBody(source, marker, offset = 0) {
    const markerAt = source.indexOf(marker, offset);
    if (markerAt < 0) return null;
    const open = source.indexOf("{", markerAt);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === "{") depth++;
      if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
    }
    return null;
  }

  function objectKeys(source, marker, offset = 0) {
    const body = objectBody(source, marker, offset);
    if (body == null) return [];
    return body.split(",").map(entry => entry.trim().match(/^(?:\.\.\.)?([\w$]+)/)?.[1]).filter(Boolean);
  }

  function hookReturnKeys(file, hookName) {
    const source = readFileSync(file, "utf-8");
    const start = source.indexOf(`export function ${hookName}`);
    const next = source.indexOf("\nexport function ", start + 1);
    const body = source.slice(start, next < 0 ? source.length : next);
    const returns = [...body.matchAll(/return\s*\{/g)];
    return returns.length ? objectKeys(body, "return {", returns.at(-1).index) : [];
  }

  function memberNames(source, owner) {
    return [...new Set([...source.matchAll(new RegExp(`\\b${owner}\\.([\\w$]+)`, "g"))].map(m => m[1]))];
  }

  it("every ctx field reference exists in the hook or assembly input shape", () => {
    const builder = readFileSync("src/app/contextBuilders.js", "utf-8");
    const mud = readFileSync("src/MudRPG.jsx", "utf-8");
    const failures = [];
    const inputShapes = [
      ["ui", "src/app/hooks/useGameUi.js", "useGameUi"],
      ["autosave", "src/app/hooks/useAutosave.js", "useAutosave"],
    ];

    for (const [owner, file, hookName] of inputShapes) {
      const available = new Set(hookReturnKeys(file, hookName));
      for (const name of memberNames(builder, owner)) {
        if (!available.has(name)) failures.push(`${owner}.${name} is not returned by ${hookName}`);
      }
    }

    // game.* 改由 MudRPG 本层的 game 对象直供（PR-1F：useGameStoreBindings 已废）——
    // 校验 game.foo 必须出现在 MudRPG 的 game 对象字面量里。
    const gameLiteral = mud.match(/const game = useMemo\(\(\) => \(\{([^}]+)\}\)/)?.[1] || "";
    const gameKeys = new Set(gameLiteral.split(",").map(x => x.trim()).filter(Boolean));
    for (const name of memberNames(builder, "game")) {
      if (!gameKeys.has(name)) failures.push(`game.${name} is not in MudRPG's game object`);
    }

    for (const [builderName, paramSource] of [
      ["buildOverlayCtx", "buildOverlayCtx({"],
      ["buildLayoutCtx", "buildLayoutCtx({"],
    ]) {
      const params = builder.match(new RegExp(`export function ${builderName}\\(\\s*\\{([^}]+)\\}`))?.[1]
        .split(",").map(entry => entry.trim().split(":")[0]) || [];
      const passed = new Set(objectKeys(mud, paramSource));
      for (const name of params) {
        if (!passed.has(name)) failures.push(`${builderName} input ${name} is not passed by MudRPG`);
      }
    }

    const actionKeys = new Set(objectKeys(mud, "const actions = {"));
    for (const match of builder.matchAll(/const\s*\{([^}]+)\}\s*=\s*actions/g)) {
      for (const entry of match[1].split(",")) {
        const name = entry.trim().split(":")[0].trim();
        if (name && !actionKeys.has(name)) failures.push(`actions.${name} is not assembled in MudRPG`);
      }
    }
    for (const name of memberNames(builder, "actions")) {
      if (!actionKeys.has(name)) failures.push(`actions.${name} is not assembled in MudRPG`);
    }

    const overlayStateKeys = new Set(objectKeys(mud, "const overlayState = {"));
    for (const match of builder.matchAll(/const\s*\{([^}]+)\}\s*=\s*overlayState/g)) {
      for (const entry of match[1].split(",")) {
        const name = entry.trim().split(":")[0].trim();
        if (name && !overlayStateKeys.has(name)) failures.push(`overlayState.${name} is not assembled in MudRPG`);
      }
    }

    const actionHooks = {
      cardImportHandlers: ["src/app/hooks/useCardImportHandlers.js", "useCardImportHandlers"],
      screenHandlers: ["src/app/hooks/useScreenHandlers.js", "useScreenHandlers"],
      duelHandlers: ["src/app/hooks/useDuel.js", "useDuel"],
      questPanel: ["src/app/hooks/useQuestPanel.js", "useQuestPanel"],
      aiInspect: ["src/app/hooks/useAiInspect.js", "useAiInspect"],
      outfitAdvice: ["src/app/hooks/useOutfitAdvice.js", "useOutfitAdvice"],
      pigeonHandlers: ["src/app/hooks/usePigeonHandlers.js", "usePigeonHandlers"],
      buildingHandlers: ["src/app/hooks/useBuildingHandlers.js", "useBuildingHandlers"],
      craftingAI: ["src/app/hooks/useCraftingAI.js", "useCraftingAI"],
      playerActionHandlers: ["src/app/hooks/usePlayerActionHandlers.js", "usePlayerActionHandlers"],
      progressionHandlers: ["src/app/hooks/useProgressionHandlers.js", "useProgressionHandlers"],
    };
    for (const [group, [file, hookName]] of Object.entries(actionHooks)) {
      const available = new Set(hookReturnKeys(file, hookName));
      for (const name of memberNames(builder, group)) {
        if (!available.has(name)) failures.push(`${group}.${name} is not returned by ${hookName}`);
      }
    }

    const portraitImports = builder.match(/import\s*\{([^}]+)\}\s*from "\.\.\/domain\/rules\/companion\/portraits\.js"/)?.[1] || "";
    const portraitExports = readFileSync("src/domain/rules/companion/portraits.js", "utf-8") + readFileSync("src/domain/rules/companion/portraitStore.js", "utf-8"); // 薄壳+转发目标
    const layoutStart = builder.indexOf("export function buildLayoutCtx");
    const layoutKeys = new Set(objectKeys(builder.slice(layoutStart), "return {"));
    for (const name of ["setSnowLeopardForm", "setPearlForm"]) {
      if (!portraitImports.split(",").map(entry => entry.trim()).includes(name)) {
        failures.push(`${name} is not imported from portraits.js`);
      }
      if (!portraitExports.includes(`export function ${name}(`)) failures.push(`${name} is not exported by portraits.js`);
      if (!layoutKeys.has(name)) failures.push(`${name} is not exposed by buildLayoutCtx`);
    }

    expect(failures).toEqual([]);
  });

  it("layout ctx exposes callable portrait persistence setters", async () => {
    const { buildLayoutCtx } = await import("../app/contextBuilders.js");
    const layout = buildLayoutCtx({
      ui: {},
      game: {
        room: { name: "" }, flags: [], varTree: { 角色: {} }, innerRoomName: "",
        narrator: { stage: "" }, inv: [], log: [],
      },
      overlayHost: null, autosave: {},
      actions: {
        questPanel: {}, pigeonHandlers: {}, duelHandlers: {}, screenHandlers: {}, buildingHandlers: {},
        craftingAI: {}, playerActionHandlers: { enterSeaOfMind() {}, leaveSeaOfMind() {} },
        progressionHandlers: {}, aiInspect: {},
      },
      activeBuffs: [], addLog() {}, jotNote() {},
    });
    expect(typeof layout.setSnowLeopardForm).toBe("function");
    expect(typeof layout.setPearlForm).toBe("function");
  });
});

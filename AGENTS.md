# QuCuo (天都·曲措) Agent Engineering Rules

Read this file first before modifying any code. Source code and CI gates are the single source of truth; archived documents in `docs/_archive/` are historical only.

## 1. Five Non-Negotiable Architectural Rules

1. **Single AI Gateway (`withAI`)**
   All new AI calls must be declared via `definePrompt` and invoked through `src/engine/ports/withAI.js`. Do not add new direct `callModel`, `callModelStream`, or `ai.chat` calls anywhere in `src/ui/`, `src/app/`, `src/features/`, or `src/engine/`. Existing legacy callers are capped in `scripts/ratchet.mjs` (`KNOWN_DIRECT_AI_CALL_DEBT`) and may only decrease.

2. **Single State-Write Boundary (`commitRound` / `features/run`)**
   Turn state mutations belong in `src/engine/act/commitRound.js`. Feature transitions belong in pure `src/features/` functions dispatched via `applyResult` in `src/features/run.js`. Never add new direct `setVarTree`, `setVarTreeState`, or `gameActions.set*` calls inside `src/ui/`, `src/app/hooks/`, or `src/features/`. Existing legacy sites are capped in `scripts/ratchet.mjs` (`KNOWN_STATE_WRITE_DEBT`) and may only decrease.

3. **Mandatory Async Stale and Epoch Guards**
   Every async AI call or background task (`withAI`, backfill, pigeon delivery, summary, reunion line) must check `isStale()` or verify save/pending identity after `await` before applying logs, `convo`, `varTree`, or `gameStore` updates. Never capture `gameStore.getState()` before `await` and apply updates against that stale snapshot afterward.

4. **Unified NPC Context and No Parallel Duplicate Subsystems**
   Extend existing `companion`, `npcTrade`, and unified prompt/context helpers instead of creating parallel subsystems or hand-rolling separate NPC context snippets per screen or hook.

5. **AI 调用链说明同步**
   `docs/AI调用链架构说明.md` 是 AI 调用线的活文档。改动 AI 调用入口、回合管线、事实落盘、状态写入口、提示词冰山、结构化输出契约、判官/场记板/十二律时，必须在同一 PR 更新该文档。CI 的 `npm run docs-gate` 是硬门禁：触碰调用链关键文件而未同 PR 更新文档会失败。

## 2. Layer Boundaries

Import direction flows strictly downward:

```text
entry / debug / ui -> app / store -> features / engine -> domain / core / utils -> infra / content
```

Additional hard rules enforced by ESLint and `scripts/ratchet.mjs`:
- `features/` must not import `engine/` or `infra/`.
- `domain/` must not import `ui/`, `app/`, or `infra/`.
- `store/` must not import `ui/`.
- `engine/act/` must not read or write `.current` React refs.
- `src/ui/` must not import `callModel` or `callModelStream`.

## 3. Mandatory Verification Before Finishing

Every PR or local change must pass all checks with zero skipped tests:

- `npm run verify:fast` runs ESLint and Vitest locally.
- `npm run verify` runs ESLint, Vitest, and the production Pages build (matches CI).
- `npm run ratchet` enforces all architectural red lines and debt ceilings (matches CI).
- `npm run stats` prints current metrics (`largeFiles`, `externalInfraImports`, `mudRpgHookArgs`, `directAiCalls`, `directStateWrites`).

See `docs/护栏.md` for details on the CI checks and ratchet ceilings.

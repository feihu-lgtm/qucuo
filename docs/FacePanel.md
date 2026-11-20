# FacePanel

`useFaces(storageKey, defaults, options)` is the state/persistence controller. Keep the
storage key, defaults, and module registry stable for a mounted instance; remount it
when switching to a different configuration. Preferences use
`{ faces: [{ id, name, modules: [moduleId] }], currentIndex }`.

Options:
- `availableModules`: required array of `{ id, label }`.
- `editable = true`: enables editor operations (including module selection and reset).
- `minFaces = 1`, `maxFaces = 6`: caller supplies valid defaults within these bounds.
- `enableKeyboard = false`: explicit keyboard opt-in.

Return: `preferences`, `face`, `index` (zero-based), `count`, `direction`, `availableModules`, `editable`,
`minFaces`, `maxFaces`, `enableKeyboard`, `select(index)`, `rotate(delta)`,
`rename(name)`, `toggleModule(id)`, `moveModule(id, delta)`, `add()`, `remove()`,
`reset()`. Editor operations are no-ops when `editable` is false.

`FacePanel` props:
- `faces`: controller returned by `useFaces`.
- `theme`: existing theme object, used by `chromeBtn` and the editor input.
- `renderModule(id)`: returns a React node.
- `isModuleVisible(id) = () => true`: omits unavailable modules before spacing.
- `isMobile = false`: disables keyboard navigation on mobile.
- `swipe = true`: enables self-contained touch swipes starting in face content; false leaves touch gestures alone.
- `isKeyboardBlocked() = () => false`: caller-specific overlay/focus guard.
- `label = "面板"`: accessible navigation label prefix.
- `className = ""`: optional additional root class.

Place it inside a height-constrained flex column. Every face fills the remaining
height; gaps are measured and capped to 6–28px, with internal scrolling when tall.
Tabs scroll horizontally on narrow panels; 22px controls stay on the same row at the right, with 8px gaps.
Touch swipes beginning in content are isolated from ancestor gesture handlers.
Keyboard ignores typing/modified/consumed events and visible modal layers. Prefer
one keyboard-enabled instance per view; if multiple opt in, the first eligible
listener consumes each arrow event, so only one rotates. Use the caller guard to
select an active instance when desired. Tab/panel DOM IDs are instance-unique.

```jsx
const defaults = { faces: [{ id: "overview", name: "概览", modules: ["summary"] }], currentIndex: 0 };
const modules = [{ id: "summary", label: "摘要" }];

function SummaryPanel({ theme }) {
  const faces = useFaces("summary_faces", defaults, {
    availableModules: modules, enableKeyboard: true,
  });
  return <FacePanel faces={faces} theme={theme}
    renderModule={() => <Summary />} />;
}
```
